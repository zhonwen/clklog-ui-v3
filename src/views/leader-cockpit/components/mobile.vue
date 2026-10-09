<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { CSSProperties } from 'vue'
import type { EChartsOption } from 'echarts'
import { getVisitorActiveTrendApi } from '@/api/trackingapi/visitor'
import { getChannelOverviewApi } from '@/api/trackingapi/channel'
import { useChart } from '@/composables/useChart'
import { useLatestOnly } from '@/composables/useLatestOnly'
import { useTrackingStore } from '@/stores/tracking'
import { bus } from '@/utils/event-bus'
import { copyObj } from '@/utils/copy'
import {
  formatDateYMD,
  get3WeekdaysFromDate,
  getThirtyDaysAgo,
  getTwelveMonthsAgoFirstDay,
  todateFunc,
} from '@/utils/date'
import { formatTime } from '@/utils/format'
import { averageRulesTable } from '@/utils/percent'

/** 渠道概览里的一行渠道数据 */
interface ChannelRow {
  channel?: string
  uvCount?: number
  visitCount?: number
  uv?: number
  newUv?: number
  avgVisitTime?: number
  avgPv?: number
}

/** 渠道概览按时间维度（本周/上周/本月…）分组的一段 */
interface OverviewBlock {
  timeType?: string
  statDate?: string
  rows?: ChannelRow[]
}

interface TotalFlowDetail {
  statTime?: string
  uvCount?: number
  visitCount?: number
  uv?: number
  newUv?: number
  avgPv?: number
  avgVisitTime?: number
}

interface ActiveItem {
  statTime?: string
  uvCount?: number
  newCount?: number
  historyCount?: number
  activeCount?: number
}

type MetricKey = 'uvCount' | 'visitCount' | 'uv' | 'newUv' | 'avgVisitTime' | 'avgPv'
type TimeTypeKey =
  | 'currentWeek'
  | 'previousWeek'
  | 'currentMonth'
  | 'previousMonth'
  | 'currentYear'
  | 'previousYear'

const METRIC_KEYS: MetricKey[] = ['uvCount', 'visitCount', 'uv', 'newUv', 'avgVisitTime', 'avgPv']
const TIME_TYPE_KEYS: TimeTypeKey[] = [
  'currentWeek',
  'previousWeek',
  'currentMonth',
  'previousMonth',
  'currentYear',
  'previousYear',
]

const trackingStore = useTrackingStore()
const projectName = computed(() => trackingStore.projectName)

const tableLoading = ref(false)
const loadingSecond = ref(false)
const dataListBlock = ref<OverviewBlock[]>([])
const activeList = ref<ActiveItem[]>([])
const totalFlowDetail = ref<TotalFlowDetail>({}) // 总计
const uvTotal = ref<number[]>([])
const activeCount = ref<number[]>([])
const startTime = ref<(string | number)[]>([])
const checkDateTime = ref(todateFunc())
const timeFlag = ref('month')
const statTime = ref(getTwelveMonthsAgoFirstDay(todateFunc()))
const endTime = ref(todateFunc())
// 与 v2 一致：$downPage 时置 true、mobileEvent() 置 false。v2 模板里并没有用到它，
// 保留是为了 index.vue 通过 ref 调 mobileEvent() 的调用链不变
const showDateFlag = ref(false)

const { elRef, init, setOption } = useChart()
// 两个取数各自一套序号，互不影响
const channelReq = useLatestOnly()
const activeReq = useLatestOnly()

// 根据时间类型动态生成活跃数标签
const activeCountLabel = computed(() => {
  switch (timeFlag.value) {
    case 'day':
      return '日活跃数'
    case 'week':
      return '周活跃数'
    case 'month':
      return '月活跃数'
    default:
      return '月活跃数'
  }
})

const projectDisplayName = computed(() => {
  // 与 v2 的 filterProjectEvent 一致：v2 直接读 localStorage 的 projectList，
  // store 的 projectArray 就是同一份数据，这里走 store 以便切项目时自动更新
  const target = trackingStore.projectArray.find((item) => item.projectName == projectName.value)
  return target ? target.projectDisplayName : ''
})

const updateTimeText = computed(() => {
  const dateRangeString = totalFlowDetail.value.statTime
  const regex = /(\d{4}-\d{2}-\d{2})~(\d{4}-\d{2}-\d{2}) \d{2}:\d{2}:\d{2}\.\d/
  if (dateRangeString) {
    const match = dateRangeString.match(regex)
    if (match) {
      const startDate = match[1]
      const endDate = match[2]
      return `${startDate} ~ ${endDate}`
    }
  }
  return dateRangeString || '--'
})

// v2 的 formatTime 会先 Math.floor(seconds)，v3 的 utils/format 没有这一步，
// 这里补上以保持与 v2 输出一致（否则会出现 00:01:23.456 这种小数秒）
function fmtTime(value: number | null | undefined) {
  return formatTime(Math.floor(Number(value) || 0))
}

/**
 * 与 v2 的 filterNumEvent 一致：按 timeType 找到那一段，再取 channel === '全部' 的行。
 * v2 是在模板里一格一个函数调用（共 30 多次），这里预先算成结构化数据。
 * 模板里 v2 写的是 `{{ ... || "--" }}`，所以这里把 '--' 的兜底一起算进去。
 */
const cells = computed(() => {
  const result = {} as Record<TimeTypeKey, Record<MetricKey, string | number>>
  TIME_TYPE_KEYS.forEach((timeType) => {
    const empty = {} as Record<MetricKey, string | number>
    METRIC_KEYS.forEach((metric) => {
      empty[metric] = '--'
    })
    result[timeType] = empty
  })

  dataListBlock.value.forEach((block) => {
    const timeType = block.timeType
    if (!timeType) return
    if (!TIME_TYPE_KEYS.includes(timeType as TimeTypeKey)) return
    const target = result[timeType as TimeTypeKey]
    const rows = block.rows || []
    // 与 v2 一致（v2 此处逻辑存疑：`totals ? totals[0][num] : 0` 里 totals 是 filter 的返回值，
    // 空数组也是真值，v2 会直接读 totals[0][num] 而抛 TypeError，这里补一次判空）
    const total = rows.length > 0 ? rows.filter((item) => item.channel == '全部')[0] : undefined
    METRIC_KEYS.forEach((metric) => {
      let amount: string | number = total ? total[metric] || 0 : 0
      if (metric == 'avgVisitTime') {
        amount = fmtTime(Number(amount))
      }
      if (metric == 'avgPv') {
        amount = averageRulesTable(Number(amount))
      }
      target[metric] = amount || '--'
    })
  })
  return result
})

function tableHeaderColor({ columnIndex }: { columnIndex: number }): CSSProperties {
  if (columnIndex === 0) {
    return { textAlign: 'left' }
  }
  return { textAlign: 'center' }
}

function buildCountLineOption(): EChartsOption {
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        lineStyle: {
          color: '#C0CADB',
          width: 2,
        },
      },
    },
    legend: {
      // v2 写的是 x/y（echarts 2 的旧别名），echarts 6 的类型里只有 left/top，语义一致。
      // v2 的 data 绑的是从未定义过的 this.headLege（undefined），等同于不设置，图例自动取 series.name
      left: 'center',
      top: 'top',
    },
    grid: {
      left: '5%',
      right: '0',
      top: '10%',
      bottom: '10%',
      containLabel: true,
    },

    dataZoom: [
      {
        type: 'inside',
        startValue: 0,
        endValue: 5,
        minValueSpan: 10,
        zoomOnMouseWheel: false,
        moveOnMouseWheel: true,
        moveOnMouseMove: true,
      },
    ],

    xAxis: {
      type: 'category',
      data: startTime.value,
      axisTick: {
        show: false,
      },
      axisLabel: {
        interval: 0,
        // v2 写的是字符串 "60"，echarts 6 的类型要求数字，取值一致
        rotate: 60,
      },
    },
    yAxis: {
      axisTick: {
        show: false,
      },
      type: 'value',
    },
    series: [
      {
        data: activeCount.value,
        name: activeCountLabel.value,
        type: 'line',
        color: '#2c7be5',
      },
      {
        data: uvTotal.value,
        type: 'line',
        name: '用户总数',
        color: '#FFDE84',
      },
    ],
  }
}

function countLineEcharts() {
  setOption(buildCountLineOption(), true)
}

function getChannelDetail() {
  const token = channelReq.next()
  tableLoading.value = true
  const params = {
    projectName: projectName.value,
    endTime: endTime.value,
  }
  getChannelOverviewApi(params)
    .then((res) => {
      if (!channelReq.isLatest(token)) return
      if (res?.code == 200) {
        tableLoading.value = false
        const data = (res.data || {}) as { rows?: OverviewBlock[]; totalFlowDetail?: TotalFlowDetail }
        dataListBlock.value = data.rows || []
        totalFlowDetail.value = data.totalFlowDetail || {}
      } else {
        tableLoading.value = false
      }
    })
    .catch(() => {
      if (!channelReq.isLatest(token)) return
      tableLoading.value = false
    })
}

function getActiveList() {
  const token = activeReq.next()
  loadingSecond.value = true
  const params = {
    projectName: projectName.value,
    startTime: statTime.value,
    endTime: endTime.value,
    timeType: timeFlag.value,
  }

  getVisitorActiveTrendApi(params)
    .then((res) => {
      if (!activeReq.isLatest(token)) return
      if (res?.code == 200) {
        loadingSecond.value = false
        uvTotal.value = []
        activeCount.value = []
        startTime.value = []
        const list = (res.data as ActiveItem[]) || []
        activeList.value = copyObj(list).reverse()
        list.map((item) => {
          startTime.value.push(item.statTime || 0)
          uvTotal.value.push(item.uvCount || 0)
          activeCount.value.push(item.activeCount || 0)
        })
        countLineEcharts()
      }
      // 【有意偏离 v2】v2 在非 200 分支不关 loading，图表区会一直转圈
      loadingSecond.value = false
    })
    .catch(() => {
      if (!activeReq.isLatest(token)) return
      loadingSecond.value = false
    })
}

function clickDate(val: string) {
  switch (val) {
    case 'month':
      statTime.value = getTwelveMonthsAgoFirstDay(endTime.value)
      break
    case 'week':
      statTime.value = formatDateYMD(get3WeekdaysFromDate(endTime.value))
      break
    case 'day':
      statTime.value = getThirtyDaysAgo(endTime.value)
      break
  }
}

function checkDateEvent(val: unknown) {
  const date = typeof val === 'string' ? val : ''
  if (date) {
    endTime.value = date
    clickDate(timeFlag.value)
    getActiveList()
    getChannelDetail()
  }
}

function changeDateEvent(val: unknown) {
  if (typeof val === 'string') {
    timeFlag.value = val
  }
  clickDate(timeFlag.value)
  getActiveList()
}

function mobileEvent() {
  showDateFlag.value = false
}

// mitt 只能传一个参数；v2 是 $bus.$on('$downPage', (val) => {...})，这里 payload 未使用
function handleDownPage() {
  showDateFlag.value = true
}

watch(projectName, () => {
  getChannelDetail()
  getActiveList()
})

onMounted(() => {
  init()
  getChannelDetail()
  getActiveList()
  bus.on('$downPage', handleDownPage)
})

onBeforeUnmount(() => {
  // v2 的 mobile.vue 没有解绑（组件销毁后 $bus 上仍挂着旧 handler），这里按 v3 的要求补上
  bus.off('$downPage', handleDownPage)
})

defineExpose({ mobileEvent })
</script>

<template>
  <div class="documentation-container" style="white-space: nowrap; box-sizing: border-box">
    <div id="headerFilter" class="headerFilter">
      <div id="tabBar">
        <div
          id="setFilter"
          class="TopFilter setFilter"
          style="
            position: relative;
            border-bottom: none;
            padding-left: 25px;
            padding-right: 25px;
            flex-wrap: wrap;
            display: flex;
            flex-direction: column;
          "
        >
          <div style="display: flex; align-items: center">
            <div style="margin-right: 0; line-height: 30px; width: 30vw; text-align: left">
              {{ projectDisplayName }}
            </div>
            <!-- 日历 -->
            <div id="calendar">
              <div
                style="
                  display: flex;
                  align-items: center;
                  width: calc(100vw - 30vw - 60px);
                  text-align: right;
                "
              >
                <div class="accumulate_title" style="line-height: 30px">截止时间：</div>
                <div>
                  <el-date-picker
                    v-model="checkDateTime"
                    type="date"
                    placeholder="选择日期"
                    value-format="YYYY-MM-DD"
                    style="width: 150px; height: 30px"
                    @change="checkDateEvent"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- 换行1 -->
          <div id="timeFlag" style="width: 60vw">累计数据统计时间：{{ updateTimeText }}</div>
        </div>
      </div>
    </div>

    <div class="public-block" style="box-sizing: border-box">
      <div class="block_online">
        <div v-loading="tableLoading" class="block-main public-hoverItem">
          <div>
            <div class="accumulate_title">用户数</div>
            <div class="accumulate_num">
              {{ totalFlowDetail.uvCount }}
              <div class="colFont">累计</div>
            </div>
          </div>
          <!-- 本周月 -->
          <div class="col_warry">
            <div class="col_item setSpace">
              <div class="arrange">本周</div>
              <div class="arrange totalNum">{{ cells.currentWeek.uvCount }}</div>
            </div>
            <div class="col_item setSpace">
              <div class="arrange">本月</div>
              <div class="arrange totalNum">{{ cells.currentMonth.uvCount }}</div>
            </div>
            <div class="col_item setSpace">
              <div class="arrange">本年</div>
              <div class="arrange totalNum">{{ cells.currentYear.uvCount }}</div>
            </div>
          </div>
          <!-- 上周月 -->
          <div class="col_warry">
            <div class="col_item setSpace">
              <div class="arrange">上周</div>
              <div class="arrange totalNum">{{ cells.previousWeek.uvCount }}</div>
            </div>
            <div class="col_item setSpace">
              <div class="arrange">上月</div>
              <div class="arrange totalNum">{{ cells.previousMonth.uvCount }}</div>
            </div>
            <div class="col_item setSpace">
              <div class="arrange">上年</div>
              <div class="arrange totalNum">{{ cells.previousYear.uvCount }}</div>
            </div>
          </div>
        </div>
      </div>
      <div class="block_online">
        <div v-loading="tableLoading" class="block-main public-hoverItem">
          <div>
            <div class="accumulate_title">访问次数</div>
            <div class="accumulate_num">
              {{ totalFlowDetail.visitCount }}
              <div class="colFont">累计</div>
            </div>
          </div>

          <!-- 本周月 -->
          <div class="col_warry">
            <div class="col_item setSpace">
              <div class="arrange">本周</div>
              <div class="arrange totalNum">{{ cells.currentWeek.visitCount }}</div>
            </div>
            <div class="col_item setSpace">
              <div class="arrange">本月</div>
              <div class="arrange totalNum">{{ cells.currentMonth.visitCount }}</div>
            </div>
            <div class="col_item setSpace">
              <div class="arrange">本年</div>
              <div class="arrange totalNum">{{ cells.currentYear.visitCount }}</div>
            </div>
          </div>
          <!-- 上周月 -->
          <div class="col_warry">
            <div class="col_item setSpace">
              <div class="arrange">上周</div>
              <div class="arrange totalNum">{{ cells.previousWeek.visitCount }}</div>
            </div>
            <div class="col_item setSpace">
              <div class="arrange">上月</div>
              <div class="arrange totalNum">{{ cells.previousMonth.visitCount }}</div>
            </div>
            <div class="col_item setSpace">
              <div class="arrange">上年</div>
              <div class="arrange totalNum">{{ cells.previousYear.visitCount }}</div>
            </div>
          </div>
        </div>
      </div>
      <!-- 访客总数 -->
      <div class="block_online">
        <div v-loading="tableLoading" class="block-main public-hoverItem">
          <div>
            <div class="accumulate_title">访客数</div>
            <div class="accumulate_num">
              {{ totalFlowDetail.uv }}
              <div class="colFont">累计</div>
            </div>
          </div>
          <!-- 本周月 -->
          <div class="col_warry">
            <div class="col_item">
              <div class="arrange" />
              <div class="arrange">总计</div>
              <div class="arrange">新用户</div>
            </div>
            <div class="col_item setSpace">
              <div class="arrange">本周</div>
              <div class="arrange totalNum">{{ cells.currentWeek.uv }}</div>
              <div class="arrange">{{ cells.currentWeek.newUv }}</div>
            </div>
            <div class="col_item setSpace">
              <div class="arrange">本月</div>
              <div class="arrange totalNum">{{ cells.currentMonth.uv }}</div>
              <div class="arrange">{{ cells.currentMonth.newUv }}</div>
            </div>
            <div class="col_item setSpace">
              <div class="arrange">本年</div>
              <div class="arrange totalNum">{{ cells.currentYear.uv }}</div>
              <div class="arrange">{{ cells.currentYear.newUv }}</div>
            </div>
          </div>
          <!-- 上周月 -->
          <div class="col_warry">
            <div class="col_item">
              <div class="arrange" />
              <div class="arrange">总计</div>
              <div class="arrange">新用户</div>
            </div>
            <div class="col_item setSpace">
              <div class="arrange">上周</div>
              <div class="arrange totalNum">{{ cells.previousWeek.uv }}</div>
              <div class="arrange">{{ cells.previousWeek.newUv }}</div>
            </div>
            <div class="col_item setSpace">
              <div class="arrange">上月</div>
              <div class="arrange totalNum">{{ cells.previousMonth.uv }}</div>
              <div class="arrange">{{ cells.previousMonth.newUv }}</div>
            </div>
            <div class="col_item setSpace">
              <div class="arrange">上年</div>
              <div class="arrange totalNum">{{ cells.previousYear.uv }}</div>
              <div class="arrange">{{ cells.previousYear.newUv }}</div>
            </div>
          </div>
        </div>
      </div>
      <div class="block_online">
        <div v-loading="tableLoading" class="block-main public-hoverItem">
          <div>
            <div class="accumulate_title">平均访问时长</div>
            <div class="accumulate_num">
              {{ fmtTime(totalFlowDetail.avgVisitTime) }}
            </div>
            <div>
              <!-- 本周月 -->
              <div class="col_warry">
                <div class="col_item">
                  <div class="arrange">本周</div>
                  <div class="arrange totalNum">{{ cells.currentWeek.avgVisitTime }}</div>
                </div>
                <div class="col_item setSpace">
                  <div class="arrange">本月</div>
                  <div class="arrange totalNum">{{ cells.currentMonth.avgVisitTime }}</div>
                </div>
                <div class="col_item setSpace">
                  <div class="arrange">本年</div>
                  <div class="arrange totalNum">{{ cells.currentYear.avgVisitTime }}</div>
                </div>
              </div>
              <!-- 上周月 -->
              <div class="col_warry">
                <div class="col_item">
                  <div class="arrange">上周</div>
                  <div class="arrange totalNum">{{ cells.previousWeek.avgVisitTime }}</div>
                </div>
                <div class="col_item setSpace">
                  <div class="arrange">上月</div>
                  <div class="arrange totalNum">{{ cells.previousMonth.avgVisitTime }}</div>
                </div>
                <div class="col_item setSpace">
                  <div class="arrange">上年</div>
                  <div class="arrange totalNum">{{ cells.previousYear.avgVisitTime }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="block_online">
        <div v-loading="tableLoading" class="block-main public-hoverItem">
          <div>
            <div class="accumulate_title">平均访问页数</div>
            <div class="accumulate_num">
              {{ averageRulesTable(totalFlowDetail.avgPv) }}
            </div>
          </div>
          <div>
            <div>
              <!-- 本周月 -->
              <div class="col_warry">
                <div class="col_item">
                  <div class="arrange">本周</div>
                  <div class="arrange totalNum">{{ cells.currentWeek.avgPv }}</div>
                </div>
                <div class="col_item setSpace">
                  <div class="arrange">本月</div>
                  <div class="arrange totalNum">{{ cells.currentMonth.avgPv }}</div>
                </div>
                <div class="col_item setSpace">
                  <div class="arrange">本年</div>
                  <div class="arrange totalNum">{{ cells.currentYear.avgPv }}</div>
                </div>
              </div>
              <!-- 上周月 -->
              <div class="col_warry">
                <div class="col_item">
                  <div class="arrange">上周</div>
                  <div class="arrange totalNum">{{ cells.previousWeek.avgPv }}</div>
                </div>
                <div class="col_item setSpace">
                  <div class="arrange">上月</div>
                  <div class="arrange totalNum">{{ cells.previousMonth.avgPv }}</div>
                </div>
                <div class="col_item setSpace">
                  <div class="arrange">上年</div>
                  <div class="arrange totalNum">{{ cells.previousYear.avgPv }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 活跃用户 -->
      <div v-loading="loadingSecond" class="block_online">
        <div class="SourceWebsite block-main public-hoverItem" style="width: 100%; margin-bottom: 0">
          <div style="display: flex; justify-content: space-between; align-items: center">
            <div class="accumulate_title">活跃用户数据</div>
            <div>
              <el-radio-group
                v-model="timeFlag"
                size="small"
                style="font-size: 13px; height: 30px; padding-left: 20px"
                @change="changeDateEvent"
              >
                <!-- <el-radio-button value="hour">按时</el-radio-button> -->
                <el-radio-button value="day">按日</el-radio-button>
                <el-radio-button value="week">按周</el-radio-button>
                <el-radio-button value="month">按月</el-radio-button>
              </el-radio-group>
            </div>
          </div>

          <div ref="elRef" style="width: 95%; height: 600px; margin-top: 20px" />

          <div class="block-index-form">
            <el-table
              :data="activeList"
              :cell-style="tableHeaderColor"
              class="public-radius"
              style="width: 100%"
              border
            >
              <el-table-column label="时间" align="center" width="115px" prop="statTime" />
              <el-table-column label="用户总数" align="center">
                <template #default="{ row }">
                  {{ row.uvCount || 0 }}
                </template>
              </el-table-column>
              <el-table-column :label="activeCountLabel" align="center" prop="activeCount">
                <template #default="{ row }">
                  {{ row.activeCount || 0 }}
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use '@/styles/components/TopFilter.scss';

:deep(.el-input--medium .el-input__inner) {
  height: 30px;
  line-height: 30px;
}

:deep(.warryCalendar) {
  height: 45px;
  padding-left: 20px;
  padding-right: 20px;
  padding-bottom: 20px;
  box-sizing: border-box;
  width: 100%;
  background-color: #fff;
}

#calendar {
  display: flex;
}

#timeFlag {
  margin-top: 15px;
}

.col_warry {
  display: flex;
  justify-content: space-between;
  margin-top: 7px;

  .col_item {
    text-align: center;
    overflow: auto;
  }

  .totalNum {
    color: rgb(77, 77, 77);
    font-weight: 400;
  }

  .arrange {
    color: rgb(77, 77, 77) !important;
    height: 32px;
    line-height: 32px;
  }

  .setSpace {
    padding-left: 10px;
  }
}

.documentation-container {
  height: auto;
  overflow-y: auto;
}

.headerFilter {
  height: 90px;
  font-size: 14px;
  font-weight: 600;
  color: #414243;
  background-color: #fff;
  box-sizing: border-box;

  #tabBar {
    position: fixed;
    background-color: #fff;
    width: 100%;
    z-index: 1000;
  }

  .setFilter {
    justify-content: space-between;
    // flex-wrap: nowrap !important;
    // overflow-x: auto;
  }
}

.block_online {
  display: flex;
  width: 100%;
  justify-content: space-between;
}

.public-block {
  .block-main {
    width: 100%;
    min-height: 170px;
    margin-bottom: 20px;
    box-sizing: border-box;
  }

  .accumulate_title {
    font-size: 15px;
    font-weight: 600;
    color: #3b3c3e;
  }

  .accumulate_num {
    color: #2c7be5;
    margin-top: 10px;
    font-size: 15px;
    font-weight: 600;
    display: flex;

    .colFont {
      font-size: 13px;
      color: #3b3c3e;
      margin-left: 5px;
      font-weight: 400;
      align-items: center;
    }
  }
}
</style>
