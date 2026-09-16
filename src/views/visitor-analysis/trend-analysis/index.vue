<script setup lang="ts">
/**
 * 趋势分析（v2 views/visitor-analysis/trend-analysis/index.vue）。
 *
 * v2 里 import 了 originView / exportFlowTrendDetailApi / getFlowTrendDetailApi / percentage
 * 但模板和逻辑都没用到（流量概览用的是 contrastFlow），script setup 下未使用的 import 会报错，v3 不再引入。
 */
import { computed, nextTick, ref, watch } from 'vue'
import contrastFlow from '@/components/contrastFlow/index.vue'
import { FilterBar } from '@/layout/components'
import { copyObj } from '@/utils/copy'
import { useLatestOnly } from '@/composables/useLatestOnly'
import { useTrackingStore } from '@/stores/tracking'
import trendChart from './components/trendChart.vue'
import trendTable from './components/trendTable.vue'
import { getFlowTotalApi, getFlowDetailApi } from '@/api/trackingapi/flow'

interface TrendRow {
  statTime?: string | number
  dateTime?: string
  [key: string]: unknown
}

/** 对比模式下接口返回的是数组，这里再往数组上挂一个 dateTime 属性（与 v2 一致） */
type TrendArray = TrendRow[] & { dateTime?: string }

interface FlowTotal {
  pv?: number
  visitCount?: number
  uv?: number
  ipCount?: number
  avgPv?: number
  avgVisitTime?: number
  bounceRate?: number
  dateTime?: string
}

const trackingStore = useTrackingStore()

const originViewRef = ref<{
  originEvent: (val: unknown, flag?: number | boolean | null) => void
} | null>(null)
const trendChartRef = ref<{
  apiDetailList: (val: unknown, flag: number | null, params: Record<string, unknown>) => void
} | null>(null)
const trendTableRef = ref<{
  apiDetailList: (
    val: unknown,
    params: Record<string, unknown>,
    flag?: number | null,
  ) => void
} | null>(null)

const { next: nextTotal, isLatest: isLatestTotal } = useLatestOnly()
const { next: nextDetail, isLatest: isLatestDetail } = useLatestOnly()
const { next: nextSecond, isLatest: isLatestSecond } = useLatestOnly()
const { next: nextPage, isLatest: isLatestPage } = useLatestOnly()

const contrastValue = ref<string[]>([]) // 对比日期
const filterBarParams = ref<Record<string, unknown>>({})
const flowTotalView = ref<FlowTotal>({})
const allFlowList = ref<FlowTotal[]>([])
const dateFlag = ref<number | null>(null)
const emptyObj: FlowTotal = {
  pv: 0,
  visitCount: 0,
  uv: 0,
  ipCount: 0,
  avgPv: 0,
  avgVisitTime: 0,
  bounceRate: 0,
}
const contrastEchartList = ref<TrendArray[]>([])
const contrastTableList = ref<TrendArray[]>([])
const loadingRefresh = ref(false)
const loadingSecond = ref(false)

const commonParams = computed<Record<string, unknown>>(() => ({
  projectName: trackingStore.projectName,
  ...filterBarParams.value,
}))

/** 取 commonParams.contrastValue 的 [start, end] */
function contrastRange(): string[] {
  const cv = commonParams.value.contrastValue
  return Array.isArray(cv) ? (cv as string[]) : []
}

// 流量概览
function totalApiEvent(params: Record<string, unknown>, flag?: boolean) {
  loadingRefresh.value = true
  const token = nextTotal()
  getFlowTotalApi(params)
    .then((res) => {
      if (!isLatestTotal(token)) return
      if (res?.code != 200) return
      loadingRefresh.value = false
      const dateTime = `${String(params.startTime)} ~ ${String(params.endTime)}`
      if (flag) {
        // 对比接口数据
        allFlowList.value = []
        const secondDateList = (res.data as FlowTotal) || emptyObj
        secondDateList.dateTime = dateTime
        allFlowList.value.push(flowTotalView.value, secondDateList)
        originViewRef.value?.originEvent(allFlowList.value, dateFlag.value)
      } else {
        if (dateFlag.value == 1 || dateFlag.value == 3) {
          void nextTick(() => {
            flowTotalView.value = (res.data as FlowTotal) || emptyObj
            flowTotalView.value.dateTime = dateTime
            allFlowList.value[0] = flowTotalView.value
            originViewRef.value?.originEvent(allFlowList.value, dateFlag.value)
          })
        } else if (dateFlag.value == null) {
          flowTotalView.value = (res.data as FlowTotal) || emptyObj
          flowTotalView.value.dateTime = dateTime
          void nextTick(() => {
            originViewRef.value?.originEvent(flowTotalView.value, dateFlag.value)
          })
        }
      }
    })
    .catch(() => {
      if (!isLatestTotal(token)) return
      loadingRefresh.value = false
    })
}

// 流量概览对比头部新版 开发状态
function getFlowTotalView() {
  const params = copyObj(commonParams.value) as Record<string, unknown>
  contrastValue.value = contrastRange()
  delete params.contrastValue
  if (dateFlag.value == 1) {
    totalApiEvent(params)
  } else if (dateFlag.value == 2) {
    const range = contrastRange()
    params.startTime = range[0]
    params.endTime = range[1]
    totalApiEvent(params, true)
  } else if (!dateFlag.value) {
    totalApiEvent(params)
  } else if (dateFlag.value == 3) {
    totalApiEvent(params)
    const secondParams = copyObj(params)
    setTimeout(() => {
      const range = contrastRange()
      secondParams.startTime = range[0]
      secondParams.endTime = range[1]
      totalApiEvent(secondParams, true)
    }, 300)
  }
}

// echarts 二次调用对比接口
function secondDateApi(rows: Record<string, unknown>) {
  const params = copyObj(rows) as Record<string, unknown>
  params.startTime = contrastValue.value[0]
  params.endTime = contrastValue.value[1]
  const token = nextSecond()
  getFlowDetailApi(params)
    .then((res) => {
      if (!isLatestSecond(token)) return
      if (res?.code != 200) return
      const dateTime = `${String(params.startTime)} ~ ${String(params.endTime)}`
      const data = ((res.data as TrendArray) || []) as TrendArray
      data.dateTime = dateTime
      contrastEchartList.value[1] = data
      contrastTableList.value[1] = data
      contrastTableList.value[1]?.forEach((item) => {
        item.dateTime = dateTime
      })
      trendTableRef.value?.apiDetailList(
        contrastTableList.value,
        commonParams.value,
        dateFlag.value,
      )
      trendChartRef.value?.apiDetailList(
        contrastEchartList.value,
        dateFlag.value,
        commonParams.value,
      )
    })
    .catch(() => {
      /* 报错已由请求层统一提示 */
    })
}

// 第一级接口
function getTrendDetailList(rows: Record<string, unknown>, flag?: boolean) {
  const params = copyObj(rows) as Record<string, unknown>
  loadingSecond.value = true

  const token = nextDetail()
  getFlowDetailApi(params)
    .then((res) => {
      if (!isLatestDetail(token)) return
      if (res?.code != 200) return
      loadingSecond.value = false
      if (flag) {
        // 对比数据
        const dateTime = `${String(rows.startTime)} ~ ${String(rows.endTime)}`
        const data = ((res.data as TrendArray) || []) as TrendArray
        data.dateTime = dateTime
        contrastEchartList.value[0] = data
        contrastTableList.value[0] = data
        contrastTableList.value[0]?.forEach((item) => {
          item.dateTime = dateTime
        })
        secondDateApi(params) // 对比日期接口
      } else {
        // 没有对比
        trendTableRef.value?.apiDetailList(
          JSON.parse(JSON.stringify(res.data)),
          commonParams.value,
          dateFlag.value,
        )
        trendChartRef.value?.apiDetailList(res.data, dateFlag.value, commonParams.value)
      }
    })
    .catch(() => {
      if (!isLatestDetail(token)) return
      loadingSecond.value = false
    })
}

function getFlowTrendDetail() {
  const params = copyObj(commonParams.value) as Record<string, unknown>
  delete params.contrastValue
  if (dateFlag.value == 1) {
    getTrendDetailList(params)
  } else if (dateFlag.value == 2) {
    getTrendDetailList(params, true)
  } else if (!dateFlag.value) {
    getTrendDetailList(params)
  } else if (dateFlag.value == 3) {
    getTrendDetailList(params, true)
  }
}

function setFilterBarParams(val: Record<string, unknown>, flag: number | null) {
  dateFlag.value = flag
  filterBarParams.value = copyObj(val)
}

function tablePageEvent() {
  const params = copyObj(commonParams.value) as Record<string, unknown>
  const token = nextPage()
  getFlowDetailApi(params)
    .then((res) => {
      if (!isLatestPage(token)) return
      if (res?.code != 200) return
      // 与 v2 一致：这里没有把 dateFlag 传下去
      trendTableRef.value?.apiDetailList(
        JSON.parse(JSON.stringify(res.data)),
        commonParams.value,
      )
    })
    .catch(() => {
      /* 报错已由请求层统一提示 */
    })
}

function currentPage() {
  tablePageEvent()
}

watch(commonParams, () => {
  getFlowTotalView()
  getFlowTrendDetail()
})
</script>

<template>
  <div>
    <div class="documentation-container">
      <FilterBar ByArea ByData bySub ByContrast @set-filter-bar-params="setFilterBarParams" />
    </div>
    <div class="public-block">
      <div v-loading="loadingRefresh" class="Overview public-hoverItem">
        <div class="trendAnalysis public-firstHead">流量概览</div>
        <contrastFlow ref="originViewRef" byAreaAnaly />
      </div>
      <trendChart v-loading="loadingSecond" ref="trendChartRef" />
      <trendTable v-loading="loadingSecond" ref="trendTableRef" @current-page="currentPage" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.bid-list-page {
  display: flex;
  flex-direction: column;

  .bid-list-header {
    display: flex;

    img {
      width: 11.44px;
      height: 11.44px;
      margin-left: 12px;
      cursor: pointer;
    }

    .header-name {
      width: 14%;
      justify-content: center;
      height: 30px;
      display: flex;
      align-items: center;
      position: relative;

      .icon-question {
        width: 11.44px;
        height: 11.44px;
        margin-left: 12px;
        cursor: pointer;
        position: absolute;
        transform: translate(0, -50%);
      }
    }

    .w156 {
      font-size: 13px;
      color: #3f3e3e;
    }
  }

  .bid-list-record {
    display: flex;

    .bid-list-item {
      width: 14%;
      justify-content: center;
      height: 30px;
      display: flex;
      align-items: center;
    }

    .w157 {
      color: #252424;
      font-size: 14px;
      line-height: 14px;
    }

    .w158 {
      color: #3a98e6;
      font-size: 17px;
      line-height: 17px;
    }
  }
}
</style>
