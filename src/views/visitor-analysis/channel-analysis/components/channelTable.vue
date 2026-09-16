<script setup lang="ts">
/**
 * 渠道分析表格（v2 views/visitor-analysis/channel-analysis/components/channelTable.vue）。
 * 父组件通过 ref 调 refreshEvent(loading) / getChannelList(rows)。
 */
import { computed, getCurrentInstance, onMounted, ref } from 'vue'
import type { EChartsOption } from 'echarts'
import originView from '@/components/origin-view/index.vue'
import flowPoint from '@/components/flowPoint/index.vue'
import { percentage, averageRules } from '@/utils/percent'
import { formatTime } from '@/utils/format'
import { useChart } from '@/composables/useChart'

interface ChannelRow {
  channel?: string
  pv?: number
  pvRate?: number | string
  visitCount?: number
  visitCountRate?: number | string
  uv?: number
  uvRate?: number | string
  newUv?: number
  newUvRate?: number | string
  ipCount?: number
  ipCountRate?: number | string
  avgPv?: number
  avgVisitTime?: number
  visitTimeRate?: number | string
  bounceRate?: number | string
  [key: string]: unknown
}

const proxy = getCurrentInstance()?.proxy

const { elRef: chartOneRef, init: initChartOne, setOption: setChartOneOption } = useChart()

const loadingRefresh = ref(false)
const filterChannelList = ref<ChannelRow[]>([])
const currentPage = ref(1)
const channelTableData = ref<ChannelRow[]>([])
const pageSize = ref(10)

const pv = ref(false)
const visitCount = ref(false)
const newUv = ref(false)
const newUvRate = ref(false)
const uv = ref(false)
const ipCount = ref(false)
const avgPv = ref(false)
const avgVisitTime = ref(false)
const bounceRate = ref(false)
const pvRate = ref(false)
const visitTimeRate = ref(false)
const avgPvRate = ref(false)
const visitCountRate = ref(false)
const uvRate = ref(false)
const ipCountRate = ref(false)

const current = ref<{ sortName: string | null; sortOrder: string | null }>({
  sortName: '',
  sortOrder: '',
})

const XlabelFirst = ['浏览量', '访问次数', '访客数', '新访客数']
const firstLabelList = ref<number[]>([10, 20, 30, 40])

const emit = defineEmits<{
  (e: 'currentPage'): void
}>()

// 模板里不重复调用 slice，预算成 computed
const pagedChannelList = computed(() =>
  channelTableData.value.slice(
    (currentPage.value - 1) * pageSize.value,
    currentPage.value * pageSize.value,
  ),
)

function refreshEvent(val: boolean) {
  loadingRefresh.value = val
}

function ascDscEvent() {
  const nameAttr = current.value.sortName
  if (nameAttr && current.value.sortOrder === 'ascending') {
    channelTableData.value = channelTableData.value.sort(function (a, b) {
      return Number(a[nameAttr]) - Number(b[nameAttr])
    })
  } else if (nameAttr && current.value.sortOrder === 'descending') {
    channelTableData.value = channelTableData.value.sort(function (a, b) {
      return Number(b[nameAttr]) - Number(a[nameAttr])
    })
  }
}

function sortChange(e: { prop?: string | null; order?: string | null }) {
  if (e.order && e.order == 'ascending') {
    // 降序
    current.value.sortName = e.prop ?? null
    current.value.sortOrder = 'ascending'
  } else if (e.order && e.order == 'descending') {
    // 升序
    current.value.sortName = e.prop ?? null
    current.value.sortOrder = 'descending'
  } else {
    current.value.sortName = null
    current.value.sortOrder = null
    emit('currentPage')
  }
  ascDscEvent()
}

function averageRulesEvent(num: number | undefined) {
  return averageRules(num)
}

function formatTimeEvent(val: number | undefined) {
  return formatTime(Math.floor(Number(val)))
}

function uvApiEcharts() {
  const option: EChartsOption = {
    tooltip: {
      trigger: 'axis',
    },
    // v2 是 legend: { data: ['全部'], x: 'center' }，echarts 5+ 换成 left
    legend: {
      data: ['全部'],
      left: 'center',
    },
    grid: {
      left: '15%',
      top: '5%',
      bottom: '10%',
    },
    yAxis: [
      {
        type: 'category',

        axisTick: {
          show: false,
          alignWithLabel: true,
        },
        data: XlabelFirst,
      },
    ],
    xAxis: [
      {
        type: 'value',
        axisTick: {
          show: false,
        },
        axisLabel: {
          interval: 0,
          // v2 写的是字符串 '0'，echarts 5+ 要求数字
          rotate: 0,
        },
      },
    ],
    series: [
      {
        name: '全部',
        type: 'bar',
        barWidth: 10,
        data: firstLabelList.value,
        label: {
          show: true,
          position: 'right',
        },
        itemStyle: {
          color: '#2c7be5',
        },
      },
    ],
  }
  setChartOneOption(option, true)
}

function getChannelList(val: ChannelRow[]) {
  channelTableData.value = val.sort((a, b) => {
    if (a.channel === '全部') {
      return -1
    } else if (b.channel === '全部') {
      return 1
    }
    return 0
  })
  channelTableData.value.forEach((item) => {
    if (item.bounceRate) {
      item.bounceRate = percentage(item.bounceRate as number)
    }
    if (item.uvRate) {
      item.uvRate = percentage(item.uvRate as number)
    }
    if (item.newUvRate) {
      item.newUvRate = percentage(item.newUvRate as number)
    }
    if (item.visitCountRate) {
      item.visitCountRate = percentage(item.visitCountRate as number)
    }
    if (item.ipCountRate) {
      item.ipCountRate = percentage(item.ipCountRate as number)
    }

    if (item.pvRate) {
      item.pvRate = percentage(item.pvRate as number)
    }
    if (item.visitTimeRate) {
      item.visitTimeRate = percentage(item.visitTimeRate as number)
    }
  })

  let filteredArr = channelTableData.value.filter((item) => item.channel == '全部')
  if (filteredArr.length == 0) {
    filteredArr = [{}]
  }
  filterChannelList.value = filteredArr
  // echarts
  firstLabelList.value = []
  // XlabelFirst: ["浏览量", "访问次数", "访客数", "新访客数"],
  const first = filteredArr[0]
  const array = [first?.pv || 0, first?.visitCount || 0, first?.uv || 0, first?.newUv || 0]
  firstLabelList.value = array
  uvApiEcharts()
}

function flowPointEvent(val: string[]) {
  if (val.length > 0) {
    pv.value = val.includes('pv')
    visitCount.value = val.includes('visitCount')
    newUv.value = val.includes('newUv')
    newUvRate.value = val.includes('newUvRate')
    uv.value = val.includes('uv')
    ipCount.value = val.includes('ipCount')
    avgPv.value = val.includes('avgPv')
    avgVisitTime.value = val.includes('avgVisitTime')
    bounceRate.value = val.includes('bounceRate')
    pvRate.value = val.includes('pvRate')
    visitCountRate.value = val.includes('visitCountRate')
    uvRate.value = val.includes('uvRate')
    ipCountRate.value = val.includes('ipCountRate')
    visitTimeRate.value = val.includes('visitTimeRate')
    avgPvRate.value = val.includes('avgPvRate')
  }
}

onMounted(() => initChartOne())

defineExpose({ refreshEvent, getChannelList })
</script>

<template>
  <div>
    <div class="documentation-container">
      <div v-loading="loadingRefresh" class="Overview public-hoverItem">
        <div class="public-firstHead">流量概览</div>
        <div class="bid-list-page">
          <originView byChannel />
          <div v-for="(item, index) in filterChannelList" :key="index" class="bid-list-card">
            <div
              class="bid-list-item w111"
              :style="index == 0 ? 'color:#2c7be5' : 'color:#4d4d4d'"
            >
              <p>{{ item.pv || '--' }}</p>
            </div>
            <div
              class="bid-list-item w111"
              :style="index == 0 ? 'color:#2c7be5' : 'color:#4d4d4d'"
            >
              <p>{{ item.visitCount || '--' }}</p>
            </div>
            <div
              class="bid-list-item w111"
              :style="index == 0 ? 'color:#2c7be5' : 'color:#4d4d4d'"
            >
              <p>{{ item.uv || '--' }}</p>
            </div>
            <div
              class="bid-list-item w111"
              :style="index == 0 ? 'color:#2c7be5' : 'color:#4d4d4d'"
            >
              <p>{{ item.ipCount || '--' }}</p>
            </div>
            <div
              class="bid-list-item w111"
              :style="index == 0 ? 'color:#2c7be5' : 'color:#4d4d4d'"
            >
              <p>{{ averageRulesEvent(item.avgPv) || '--' }}</p>
            </div>
            <div
              class="bid-list-item w111"
              :style="index == 0 ? 'color:#2c7be5' : 'color:#4d4d4d'"
            >
              <p>{{ formatTimeEvent(item.avgVisitTime) || '--' }}</p>
            </div>
            <div
              class="bid-list-item w111"
              :style="index == 0 ? 'color:#2c7be5' : 'color:#4d4d4d'"
            >
              <p>{{ item.bounceRate || '--' }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- echarts -->
    <div v-loading="loadingRefresh" class="chartsIcon public-hoverItem">
      <div class="public-firstHead">渠道指标分析图</div>
      <div ref="chartOneRef" class="chartStyle"></div>
    </div>

    <div v-loading="loadingRefresh" class="chartsIcon public-hoverItem">
      <div class="public-firstHead">渠道分析</div>
      <flowPoint byChannel @flow-point="flowPointEvent" />
      <div>
        <div class="public-Table-minHeight">
          <el-table
            class="public-radius"
            :data="pagedChannelList"
            :header-cell-style="{ textAlign: 'center', background: '#f7fafe ' }"
            :cell-style="{ textAlign: 'center' }"
            border
            style="width: 100%"
            @sort-change="sortChange($event)"
          >
            <el-table-column type="index" label="序号" :width="proxy?.$fixedWidth.FwIndex" />
            <el-table-column prop="channel" label="渠道类型" width="150" />
            <el-table-column prop="date" label="流量基础指标" width="150">
              <el-table-column v-if="pv" prop="pv" label="浏览量" sortable />
              <el-table-column v-if="pvRate" prop="pvRate" label="浏览量占比" sortable />
              <el-table-column v-if="visitCount" prop="visitCount" label="访问次数" sortable />
              <el-table-column
                v-if="visitCountRate"
                prop="visitCountRate"
                label="访问次数占比"
                sortable
              />
              <el-table-column v-if="uv" prop="uv" label="访客数" sortable />
              <el-table-column v-if="uvRate" prop="uvRate" label="访客数占比" sortable />
              <el-table-column v-if="newUv" prop="newUv" label="新访客数" sortable />
              <el-table-column
                v-if="newUvRate"
                prop="newUvRate"
                label="新访客数占比"
                sortable
              />
              <el-table-column v-if="ipCount" prop="ipCount" label="IP数" sortable />
              <el-table-column
                v-if="ipCountRate"
                prop="ipCountRate"
                label="IP数占比"
                sortable
              />
            </el-table-column>
            <el-table-column prop="date" label="流量质量指标" width="150">
              <el-table-column v-if="bounceRate" prop="bounceRate" label="跳出率" sortable />
              <el-table-column
                v-if="avgVisitTime"
                prop="avgVisitTime"
                label="平均访问时长"
                sortable
              >
                <template #default="scope">
                  {{ formatTimeEvent(scope.row.avgVisitTime) }}
                </template>
              </el-table-column>
              <el-table-column
                v-if="visitTimeRate"
                prop="visitTimeRate"
                label="平均访问时长占比"
                sortable
              />
              <el-table-column v-if="avgPv" prop="avgPv" label="平均访问页数" sortable>
                <template #default="scope">
                  {{ averageRulesEvent(scope.row.avgPv) }}
                </template>
              </el-table-column>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
// v2 这里是 ::v-deep { @import "~@/styles/components/el-checkbox.scss"; }
// v3 的 el-checkbox.scss 每条规则已经写成 :deep(...)，只能在 scoped 块顶部 @use
@use '@/styles/components/el-checkbox.scss';
// v2 还 @import 了 el-pagination.scss，v3 已在 styles/index.scss 全局引入，这里不再重复

.chartStyle {
  width: 100%;
  height: 400px;
}

.trafficHead {
  font-size: 16px;
  font-weight: 600;
  color: #4d4d4d;
  padding: 20px 30px 20px;
}

img {
  width: 11.44px;
  height: 11.44px;
  margin-left: 12px;
  cursor: pointer;
}

.Overview {
  margin: 20px;
  min-height: 118px;
  background-color: #fff;

  .bid-list-page {
    // 与 v2 一致（v2 此处逻辑存疑：clas(100% -20px) 不是合法函数，浏览器会忽略这条声明）
    width: clas(100% -20px);
    display: flex;
    flex-direction: column;

    .bid-list-header {
      display: flex;

      .header-name {
        width: 14%;
        justify-content: center;
        height: 30px;
        display: flex;
        align-items: center;
      }

      .w156 {
        font-size: 13px;
        color: #3f3e3e;
      }
    }

    .bid-list-card {
      display: flex;

      .bid-list-item {
        width: 14%;
        justify-content: center;
        height: 30px;
        display: flex;
        align-items: center;
      }

      .w157 {
        color: #4d4d4d;
        font-size: 12px;
        line-height: 14px;
      }

      .w158 {
        color: #3a98e6;
        font-size: 17px;
        line-height: 17px;
      }
    }
  }
}

.w111 {
  font-size: 16px;
  font-weight: 600;
  line-height: 16px;
  color: #2c7be5;
}

.chartsIcon {
  position: relative;
  box-sizing: border-box;
  margin: 20px;
  min-height: 461px;
  background: #fff;
  padding: 22px;
  border-radius: 6px;
}
</style>
