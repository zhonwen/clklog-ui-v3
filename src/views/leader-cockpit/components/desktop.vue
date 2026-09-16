<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { CSSProperties } from 'vue'
import type { EChartsOption } from 'echarts'
import { RefreshRight } from '@element-plus/icons-vue'
import { getVisitorActiveTrendApi } from '@/api/trackingapi/visitor'
import { getChannelOverviewApi } from '@/api/trackingapi/channel'
import { useChart } from '@/composables/useChart'
import { useLatestOnly } from '@/composables/useLatestOnly'
import { useAppStore } from '@/stores/app'
import { useTrackingStore } from '@/stores/tracking'
import { useUserStore } from '@/stores/user'
import { copyObj } from '@/utils/copy'
import {
  formatDateYMD,
  get3WeekdaysFromDate,
  getThirtyDaysAgo,
  getTwelveMonthsAgoFirstDay,
  todateFunc,
} from '@/utils/date'
import { formatTime } from '@/utils/format'
import { averageRules, averageRulesTable } from '@/utils/percent'
import type { ChannelItem } from '@/types/app'

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

/** 表格行：第一列用 label / statDate，渠道列按 c0、c1… 取值 */
interface TableRow {
  label: string
  statDate: string
  [key: string]: string | number
}

const appStore = useAppStore()
const trackingStore = useTrackingStore()
const userStore = useUserStore()

const device = computed(() => appStore.device)
const projectName = computed(() => trackingStore.projectName)

const dataListBlock = ref<OverviewBlock[]>([])
const activeList = ref<ActiveItem[]>([])
const totalFlowDetail = ref<TotalFlowDetail>({}) // 总计
const uvTotal = ref<number[]>([])
const activeCount = ref<number[]>([])
const startTime = ref<(string | number)[]>([])
const tableLoading = ref(false)
const timeFlag = ref('month')
const checkDateTime = ref(todateFunc())
const statTime = ref(getTwelveMonthsAgoFirstDay(todateFunc()))
const endTime = ref(todateFunc())
const loadingApi = ref(false)
const loadingEchart = ref(false)

const { elRef, init, setOption } = useChart()
// 两个取数各自一套序号，互不影响
const channelReq = useLatestOnly()
const activeReq = useLatestOnly()

let refreshTimer: ReturnType<typeof setTimeout> | null = null

// 与 v2 的 pickerOptions.disabledDate 一致
function disabledDate(time: Date) {
  return time.getTime() > Date.now()
}

// 与 v2 的 pickerOptions.shortcuts 一致：
// v2 的 onClick(picker){ picker.$emit('pick', date) } 在 element-plus 里改成 value
const shortcuts = [
  {
    text: '今天',
    value: () => new Date(),
  },
  {
    text: '昨天',
    value: () => {
      const date = new Date()
      date.setTime(date.getTime() - 3600 * 1000 * 24)
      return date
    },
  },
  {
    text: '一周前',
    value: () => {
      const date = new Date()
      date.setTime(date.getTime() - 3600 * 1000 * 24 * 7)
      return date
    },
  },
]

const allChaneList = computed<ChannelItem[]>(() => {
  const chaneTypeList = copyObj(userStore.channelList)
  chaneTypeList.map((item) => {
    if (item.displayName == '全部') {
      item.displayName = '总计'
      item.id = '总计'
    }
  })
  return chaneTypeList
})

// 与 v2 的 deleteSumEvent 一致：平均访问页数 / 平均访问时长两张表不显示「总计」列
const noSumChaneList = computed(() => allChaneList.value.filter((item) => item.displayName != '总计'))

const channelColumns = computed(() =>
  allChaneList.value.map((item, index) => ({ prop: `c${index}`, label: item.displayName })),
)
const noSumColumns = computed(() =>
  noSumChaneList.value.map((item, index) => ({ prop: `c${index}`, label: item.displayName })),
)

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

function filterLable(lable: string | undefined) {
  switch (lable) {
    case 'currentWeek':
      return '本周'
    case 'previousWeek':
      return '上周'
    case 'currentMonth':
      return '本月'
    case 'previousMonth':
      return '上月'
    case 'currentYear':
      return '本年'
    case 'previousYear':
      return '上年'
    default:
      // 与 v2 一致：未命中时 v2 返回 undefined，模板渲染成空
      return ''
  }
}

/** 与 v2 的 filterChannelEvent 一致 */
function channelValue(
  rows: ChannelRow[] | undefined,
  key: MetricKey,
  channelName: string,
): string | number | undefined {
  const list = rows || []
  if (channelName == '总计') {
    // 与 v2 一致：总计列只认 channel === '全部' 那一行；
    // v2 对 avgVisitTime / avgPv 直接 return undefined（这两张表本来就没有总计列）
    if (key == 'avgVisitTime' || key == 'avgPv') return undefined
    if (list.length > 0) {
      const total = list.filter((item) => item.channel == '全部')[0]
      // 与 v2 一致（v2 此处逻辑存疑：`totals ? totals[0][name] : 0` 里 totals 是 filter 的返回值，
      // 空数组也是真值，v2 会直接读 totals[0][name] 而抛 TypeError，这里补一次判空）
      return total ? total[key] : 0
    }
    return 0
  }

  for (const item of list) {
    if (item.channel == channelName) {
      if (key == 'avgVisitTime') {
        return fmtTime(item.avgVisitTime)
      }
      if (key == 'avgPv') {
        return averageRulesTable(item.avgPv)
      }
      return item[key]
    }
  }
  return undefined
}

/** v2 每个单元格都在模板里调 filterChannelEvent，这里预先算成结构化数据 */
function buildRows(key: MetricKey, channels: ChannelItem[]): TableRow[] {
  return dataListBlock.value.map((block) => {
    const row: TableRow = {
      label: filterLable(block.timeType),
      statDate: block.statDate || '',
    }
    channels.forEach((channel, index) => {
      // 模板里 v2 写的是 `{{ ... || 0 }}`
      row[`c${index}`] = channelValue(block.rows, key, channel.displayName) || 0
    })
    return row
  })
}

const uvCountRows = computed(() => buildRows('uvCount', allChaneList.value))
const visitCountRows = computed(() => buildRows('visitCount', allChaneList.value))
const uvRows = computed(() => buildRows('uv', allChaneList.value))
const newUvRows = computed(() => buildRows('newUv', allChaneList.value))
const avgPvRows = computed(() => buildRows('avgPv', noSumChaneList.value))
const avgVisitTimeRows = computed(() => buildRows('avgVisitTime', noSumChaneList.value))

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
        endValue: 13,
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
        // v2 写的是字符串 "45"，echarts 6 的类型要求数字，取值一致
        rotate: 45,
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

function getActiveList() {
  const token = activeReq.next()
  loadingEchart.value = true
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
        loadingEchart.value = false
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
      // 与 v2 一致（v2 此处逻辑存疑：非 200 时不关 loading，图表区会一直转圈）
    })
    .catch(() => {
      if (!activeReq.isLatest(token)) return
      // 与 v2 一致（v2 此处逻辑存疑：catch 里写的是 loadingEchart = true，出错后永远转圈）
      loadingEchart.value = true
    })
}

function getChannelDetail() {
  const token = channelReq.next()
  const params = {
    projectName: projectName.value,
    endTime: endTime.value,
  }
  tableLoading.value = true
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
      // 与 v2 一致（v2 此处逻辑存疑：desktop 的 getChannelDetail 没有 catch 分支，
      // 请求失败时 tableLoading 不会关掉，这里只吞掉 rejection，不改变表现）
    })
}

function resetApiList() {
  loadingApi.value = true
  getChannelDetail()
  getActiveList()
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => {
    loadingApi.value = false
  }, 300)
}

function recalcStatTime(val: string) {
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
    recalcStatTime(timeFlag.value)
    getActiveList()
    getChannelDetail()
  }
}

function changeDateEvent(val: unknown) {
  if (typeof val === 'string') {
    timeFlag.value = val
  }
  recalcStatTime(timeFlag.value)
  getActiveList()
}

watch(projectName, () => {
  getChannelDetail()
  getActiveList()
})

onMounted(() => {
  init()
  getChannelDetail()
  getActiveList()
})

onBeforeUnmount(() => {
  if (refreshTimer) {
    clearTimeout(refreshTimer)
    refreshTimer = null
  }
})
</script>

<template>
  <div class="documentation-container" style="white-space: nowrap">
    <div id="headerFilter" class="headerFilter">
      <div id="tabBar">
        <div
          class="TopFilter setFilter"
          style="position: relative; border-bottom: none"
          :style="
            device == 'mobile'
              ? 'width:100%;justify-content:center;'
              : 'width : calc(100% - 210px); position: relative;border-bottom: none;'
          "
        >
          <div v-if="device != 'mobile'" style="display: flex; padding-left: 25px; align-items: center">
            <div>项目名称：</div>
            <div>{{ projectDisplayName }}</div>
            <!-- 日期 -->
            <div id="calendar">
              <div style="display: flex">
                <div class="accumulate_title" style="line-height: 30px; margin-left: 50px">
                  截止时间：
                </div>
                <div>
                  <el-date-picker
                    v-model="checkDateTime"
                    type="date"
                    placeholder="选择日期"
                    :disabled-date="disabledDate"
                    :shortcuts="shortcuts"
                    value-format="YYYY-MM-DD"
                    style="width: 250px; height: 30px"
                    @change="checkDateEvent"
                  />
                </div>
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: center; justify-content: center">
            <div :style="device != 'mobile' ? 'padding-right:110px' : 'padding-right:0;'">
              累计数据统计时间：{{ updateTimeText }}
            </div>
            <el-button
              class="zc_btn zc_refreshApi"
              style="right: 20px"
              :loading="loadingApi"
              :icon="RefreshRight"
              @click="resetApiList"
            >
              刷新
            </el-button>
          </div>
        </div>
      </div>
    </div>
    <div class="public-block">
      <!-- 第一列 -->
      <div class="block_online">
        <!-- 累计用户总数 -->
        <div class="SourceWebsite block-main public-hoverItem" style="width: calc(50% - 10px)">
          <div>
            <div class="accumulate_title">用户数</div>
            <div class="accumulate_num">
              {{ totalFlowDetail.uvCount || '--' }}
              <div class="colFont">累计</div>
            </div>
          </div>
          <div class="block-index-form">
            <el-table
              v-loading="tableLoading"
              :data="uvCountRows"
              :cell-style="tableHeaderColor"
              class="public-radius"
              style="width: 100%"
            >
              <el-table-column align="left" prop="sourcesite" show-overflow-tooltip>
                <template #default="{ row }">
                  <el-popover placement="bottom-start" :width="180" trigger="hover" class="popImg">
                    <div style="padding: 5px; font-size: 12px">
                      {{ row.statDate }}
                    </div>
                    <template #reference>
                      <div class="icon-question" style="cursor: pointer">{{ row.label }}</div>
                    </template>
                  </el-popover>
                </template>
              </el-table-column>

              <el-table-column
                v-for="col in channelColumns"
                :key="col.prop"
                :prop="col.prop"
                :label="col.label"
                align="center"
              />
            </el-table>
          </div>
        </div>
        <!-- 累计访问总次数  -->
        <div class="SourceWebsite block-main public-hoverItem" style="width: calc(50% - 10px)">
          <div>
            <div class="accumulate_title">访问次数</div>
            <div class="accumulate_num">
              {{ totalFlowDetail.visitCount || '--' }}
              <div class="colFont">累计</div>
            </div>
          </div>
          <div class="block-index-form">
            <el-table
              v-loading="tableLoading"
              :data="visitCountRows"
              :cell-style="tableHeaderColor"
              class="public-radius"
              style="width: 100%"
            >
              <el-table-column align="left" prop="sourcesite" label="" show-overflow-tooltip>
                <template #default="{ row }">
                  <el-popover placement="bottom-start" :width="180" trigger="hover" class="popImg">
                    <div style="padding: 5px; font-size: 12px">
                      {{ row.statDate }}
                    </div>
                    <template #reference>
                      <div class="icon-question" style="cursor: pointer">{{ row.label }}</div>
                    </template>
                  </el-popover>
                </template>
              </el-table-column>
              <el-table-column
                v-for="col in channelColumns"
                :key="col.prop"
                :prop="col.prop"
                :label="col.label"
                align="center"
              />
            </el-table>
          </div>
        </div>
      </div>
      <!-- 第二例 -->
      <div class="block_online" style="margin-top: 20px">
        <div class="SourceWebsite block-main public-hoverItem" style="width: calc(50% - 10px)">
          <div>
            <div class="accumulate_title">访客数</div>
            <div class="accumulate_num">
              {{ totalFlowDetail.uv || '--' }}
              <div class="colFont">累计</div>
            </div>
          </div>
          <!-- 访客总数 -->
          <div class="block-index-form">
            <el-table
              v-loading="tableLoading"
              :data="uvRows"
              :cell-style="tableHeaderColor"
              class="public-radius"
              style="width: 100%"
            >
              <el-table-column align="left" prop="sourcesite" label="" show-overflow-tooltip>
                <template #default="{ row }">
                  <el-popover placement="bottom-start" :width="180" trigger="hover" class="popImg">
                    <div style="padding: 5px; font-size: 12px">
                      {{ row.statDate }}
                    </div>
                    <template #reference>
                      <div class="icon-question" style="cursor: pointer">{{ row.label }}</div>
                    </template>
                  </el-popover>
                </template>
              </el-table-column>

              <el-table-column
                v-for="col in channelColumns"
                :key="col.prop"
                :prop="col.prop"
                :label="col.label"
                align="center"
              />
            </el-table>
          </div>
        </div>
        <!-- 新访客数 -->
        <div class="SourceWebsite block-main public-hoverItem" style="width: calc(50% - 10px)">
          <div>
            <div class="accumulate_title">新访客数</div>
            <div class="accumulate_num">
              {{ totalFlowDetail.newUv || '--' }}
              <div class="colFont">累计</div>
            </div>
          </div>
          <div class="block-index-form">
            <el-table
              v-loading="tableLoading"
              :data="newUvRows"
              :cell-style="tableHeaderColor"
              class="public-radius"
              style="width: 100%"
            >
              <el-table-column align="left" prop="sourcesite" label="" show-overflow-tooltip>
                <template #default="{ row }">
                  <el-popover placement="bottom-start" :width="180" trigger="hover" class="popImg">
                    <div style="padding: 5px; font-size: 12px">
                      {{ row.statDate }}
                    </div>
                    <template #reference>
                      <div class="icon-question" style="cursor: pointer">{{ row.label }}</div>
                    </template>
                  </el-popover>
                </template>
              </el-table-column>
              <el-table-column
                v-for="col in channelColumns"
                :key="col.prop"
                :prop="col.prop"
                :label="col.label"
                align="center"
              />
            </el-table>
          </div>
        </div>
      </div>
      <!-- 第三列 -->
      <div class="block_online" style="margin-top: 20px">
        <div class="SourceWebsite block-main public-hoverItem" style="width: calc(40% - 10px)">
          <div>
            <div class="accumulate_title">平均访问页数</div>
            <div class="accumulate_num">
              {{ averageRules(totalFlowDetail.avgPv) }}
            </div>
          </div>
          <div class="block-index-form">
            <el-table
              v-loading="tableLoading"
              :data="avgPvRows"
              :cell-style="tableHeaderColor"
              class="public-radius"
              style="width: 100%"
            >
              <el-table-column align="left" prop="sourcesite" label="" show-overflow-tooltip>
                <template #default="{ row }">
                  <el-popover placement="bottom-start" :width="180" trigger="hover" class="popImg">
                    <div style="padding: 5px; font-size: 12px">
                      {{ row.statDate }}
                    </div>
                    <template #reference>
                      <div class="icon-question" style="cursor: pointer">{{ row.label }}</div>
                    </template>
                  </el-popover>
                </template>
              </el-table-column>
              <el-table-column
                v-for="col in noSumColumns"
                :key="col.prop"
                :prop="col.prop"
                :label="col.label"
                align="center"
              />
            </el-table>
          </div>
        </div>
        <div class="SourceWebsite block-main public-hoverItem" style="width: calc(60% - 10px)">
          <div>
            <div class="accumulate_title">平均访问时长</div>
            <div class="accumulate_num">
              {{ fmtTime(totalFlowDetail.avgVisitTime) }}
            </div>
          </div>
          <div class="block-index-form">
            <el-table
              v-loading="tableLoading"
              :data="avgVisitTimeRows"
              :cell-style="tableHeaderColor"
              class="public-radius"
              style="width: 100%"
            >
              <el-table-column align="left" prop="sourcesite" label="" show-overflow-tooltip>
                <template #default="{ row }">
                  <el-popover placement="bottom-start" :width="180" trigger="hover" class="popImg">
                    <div style="padding: 5px; font-size: 12px">
                      {{ row.statDate }}
                    </div>
                    <template #reference>
                      <div class="icon-question" style="cursor: pointer">{{ row.label }}</div>
                    </template>
                  </el-popover>
                </template>
              </el-table-column>
              <el-table-column
                v-for="col in noSumColumns"
                :key="col.prop"
                :prop="col.prop"
                :label="col.label"
                align="center"
              />
            </el-table>
          </div>
        </div>
      </div>
      <!-- echarts -->
      <div v-loading="loadingEchart" class="block_online" style="margin-top: 20px">
        <div class="SourceWebsite block-main public-hoverItem" style="width: 100%">
          <div style="display: flex; justify-content: space-between">
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
              :header-cell-style="{
                textAlign: 'center',
                background: '#f7fafe ',
              }"
              class="public-radius"
              style="width: 100%"
              border
            >
              <el-table-column label="时间" align="center" prop="statTime" />
              <el-table-column label="用户总数" align="center">
                <template #default="{ row }">
                  {{ row.uvCount || 0 }}
                </template>
              </el-table-column>
              <el-table-column label="新用户数" align="center">
                <template #default="{ row }">
                  {{ row.newCount || 0 }}
                </template>
              </el-table-column>
              <el-table-column label="老用户数" align="center">
                <template #default="{ row }">
                  {{ row.historyCount || 0 }}
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

:deep(.el-input--prefix .el-input__inner) {
  height: 30px;
  line-height: 30px;
}

:deep(.el-range-editor--medium .el-range-input) {
  font-size: 13px;
}

:deep(.el-date-editor .el-range__icon) {
  font-size: 13px;
  line-height: 25px;
}

:deep(.el-range-editor--medium .el-range-separator) {
  font-size: 13px;
  line-height: 25px;
}

:deep(.el-input__prefix) {
  top: 0;
}

:deep(.el-input__icon) {
  line-height: 30px;
}

:deep(.el-input--medium .el-input__inner) {
  height: 30px;
  line-height: 30px;
}

:deep(.el-loading-spinner) {
  margin-top: -8px !important;
}

.headerFilter {
  height: 60px;
  color: #194580;
  font-size: 13px;
  background: #fff;

  #tabBar {
    position: fixed;
    width: 100%;
    z-index: 999;
    background: #fff;
  }

  .setFilter {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: nowrap !important;
    overflow-x: auto;
  }
}

.block_online {
  display: flex;
  width: 100%;
  justify-content: space-between;
}

.public-block {
  .accumulate_title {
    font-size: 14px;
    font-weight: 600;
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

  .block-index-form {
    margin-top: 10px;
  }
}
</style>
