<script setup lang="ts">
/**
 * 地域分析（v2 views/visitor-analysis/regional-analysis.vue）。
 *
 * v2 的 components 里还注册了 regionalView（chart-component/regional-view.vue），
 * 但模板里从未使用，script setup 下 import 了不用会报未使用变量，所以 v3 这里不再引入。
 * v2 还有一个 getAreaProvinceList 方法（把原始参数直接丢给 regionalTable.getDetailList），
 * 同样没有任何调用点，属于死代码，v3 未迁。
 */
import { computed, nextTick, ref, watch } from 'vue'
import { copyObj } from '@/utils/copy'
import { FilterBar } from '@/layout/components'
import contrastFlow from '@/components/contrastFlow/index.vue'
import { useLatestOnly } from '@/composables/useLatestOnly'
import { useTrackingStore } from '@/stores/tracking'
import regionalShow from './chart-component/regional-analysis-show.vue'
import regionalTable from './chart-component/regional-analysis-table.vue'
import {
  getAreaDetailTotalApi,
  getAreaDetailListApi,
  getAreaCountryListApi,
  getAreaCountryCompareApi,
  getAreaProvinceCompareApi,
} from '@/api/trackingapi/area'

interface FlowTotal {
  pv?: number
  visitCount?: number
  uv?: number
  ipCount?: number
  avgPv?: number
  avgVisitTime?: number
  bounceRate?: number
  dateTime?: string
  [key: string]: unknown
}

interface CompareRowItem {
  compareTiem?: string
  startTime?: string
  [key: string]: unknown
}

interface TableListPayload {
  rows?: unknown[]
  total?: number
}

const trackingStore = useTrackingStore()

const originViewRef = ref<{
  originEvent: (val: unknown, flag?: number | boolean | null) => void
} | null>(null)
const regionalShowRef = ref<{
  getAreaProvince: (params: Record<string, unknown>) => void
} | null>(null)
const regionalTableRef = ref<{
  initParamsEvent: (params: Record<string, unknown>) => void
  initCurrentPage: () => void
  getDetailList: (res: TableListPayload, flag: number | null, map: string) => void
} | null>(null)

const { next: nextTotal, isLatest: isLatestTotal } = useLatestOnly()
const { next: nextCompare, isLatest: isLatestCompare } = useLatestOnly()
const { next: nextProvince, isLatest: isLatestProvince } = useLatestOnly()
const { next: nextCountry, isLatest: isLatestCountry } = useLatestOnly()

const loadingSecond = ref(false)
const loadingRefresh = ref(false)
const filterBarParams = ref<Record<string, unknown>>({})
const comparePageSize = ref(10)
const comparePageNum = ref(1)
const pageNum = ref(1)
const pageSize = ref(10)
const sortName = ref<string | null>(null)
const sortOrder = ref<string | null>(null)
const contrastValue = ref<string[]>([])
const flowTotalView = ref<FlowTotal>({})
const activeMap = ref('province')
// v2 的 data 里没声明这三个，是运行时挂到 this 上的
const dateFlag = ref<number | null>(null)
const allFlowList = ref<FlowTotal[]>([])
const newValue = ref<Record<string, unknown>>({})

const emptyObj: FlowTotal = {
  pv: 0,
  visitCount: 0,
  uv: 0,
  ipCount: 0,
  avgPv: 0,
  avgVisitTime: 0,
  bounceRate: 0,
  newValue: {},
}

const commonParams = computed<Record<string, unknown>>(() => ({
  projectName: trackingStore.projectName,
  ...filterBarParams.value,
}))

/** 取 commonParams.contrastValue 的 [start, end] */
function contrastRange(): string[] {
  const cv = commonParams.value.contrastValue
  return Array.isArray(cv) ? (cv as string[]) : []
}

function provinceTableApi(rows: Record<string, unknown>) {
  loadingSecond.value = true
  const token = nextProvince()
  getAreaDetailListApi(rows)
    .then((res) => {
      if (!isLatestProvince(token)) return
      if (res?.code != 200) return
      loadingSecond.value = false
      regionalTableRef.value?.getDetailList(
        (res.data as TableListPayload) || {},
        dateFlag.value,
        activeMap.value,
      )
    })
    .catch(() => {
      if (!isLatestProvince(token)) return
      loadingSecond.value = false
    })
}

function countryApiEvent(params: Record<string, unknown>) {
  loadingSecond.value = true
  const token = nextCountry()
  getAreaCountryListApi(params)
    .then((res) => {
      if (!isLatestCountry(token)) return
      loadingSecond.value = false
      if (res?.code != 200) return
      regionalTableRef.value?.getDetailList(
        (res.data as TableListPayload) || {},
        dateFlag.value,
        activeMap.value,
      )
    })
    .catch(() => {
      if (!isLatestCountry(token)) return
      loadingSecond.value = false
    })
}

function compareApiEvent(rows: Record<string, unknown>) {
  // v2 是直接在传进来的对象上挂 compareStartTime/pageNum（有时就是 this.commonParams 本身），
  // v3 的 commonParams 是 computed，不能写，所以先拷一份，发出去的报文完全一致
  const params = copyObj(rows) as Record<string, unknown>
  params.compareStartTime = contrastValue.value[0]
  params.compareEndTime = contrastValue.value[1]
  params.pageNum = comparePageNum.value
  params.pageSize = comparePageSize.value
  const token = nextCompare()
  const api = activeMap.value == 'province' ? getAreaProvinceCompareApi : getAreaCountryCompareApi
  api(params)
    .then((res) => {
      if (!isLatestCompare(token)) return
      if (res?.code != 200) return
      const tableList = (res.data as TableListPayload) || {}
      const rowList = (tableList.rows as CompareRowItem[]) || []
      if (params.compareEndTime == params.compareStartTime) {
        rowList.forEach((item) => {
          item.compareTiem = String(params.compareStartTime)
          item.startTime = String(params.startTime)
        })
      } else {
        rowList.forEach((item) => {
          item.compareTiem = `${String(params.compareStartTime)}~${String(params.compareEndTime)}`
          item.startTime = `${String(params.startTime)}~${String(params.endTime)}`
        })
      }
      regionalTableRef.value?.getDetailList(tableList, dateFlag.value, activeMap.value)
    })
    .catch(() => {
      /* 报错已由请求层统一提示 */
    })
}

// 流量概览头部
function totalApiEvent(params: Record<string, unknown>, flag?: boolean) {
  loadingRefresh.value = true
  const token = nextTotal()
  getAreaDetailTotalApi(params)
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
        void nextTickOrigin(allFlowList.value)
      } else {
        if (dateFlag.value == 1 || dateFlag.value == 3) {
          flowTotalView.value = (res.data as FlowTotal) || emptyObj
          flowTotalView.value.dateTime = dateTime
          allFlowList.value[0] = flowTotalView.value
          void nextTickOrigin(allFlowList.value)
        } else if (dateFlag.value == null) {
          // 没有对比事件
          flowTotalView.value = (res.data as FlowTotal) || emptyObj
          flowTotalView.value.dateTime = dateTime
          void nextTickOrigin(flowTotalView.value)
        }
      }
    })
    .catch(() => {
      if (!isLatestTotal(token)) return
      loadingRefresh.value = false
    })
}

/** v2 是 this.$nextTick(() => this.$refs.originView.originEvent(...)) */
function nextTickOrigin(payload: unknown) {
  return nextTick(() => {
    originViewRef.value?.originEvent(payload, dateFlag.value)
  })
}

// 流量概览事件
function getAreaDetailTotal() {
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

// 父组件调整接口事件 没有对比事件
function regionalApiEvent(val?: Record<string, unknown>) {
  const nextValue = copyObj(commonParams.value) as Record<string, unknown>
  contrastValue.value = contrastRange()
  delete nextValue.contrastValue

  pageNum.value = 1
  if (val) {
    // 跳转分页和排序重新调用事件
    nextValue.pageNum = val.page
    nextValue.pageSize = val.size
    nextValue.sortName = val.sortName
    nextValue.sortOrder = val.sortOrder
    sortName.value = (val.sortName as string | null) ?? null
    sortOrder.value = (val.sortOrder as string | null) ?? null
    pageNum.value = Number(val.page)
    pageSize.value = Number(val.size)
  } else {
    nextValue.sortName = sortName.value
    nextValue.sortOrder = sortOrder.value
    nextValue.pageNum = pageNum.value
    nextValue.pageSize = pageSize.value
    regionalTableRef.value?.initCurrentPage()
  }
  newValue.value = nextValue
  if (activeMap.value == 'country') {
    countryApiEvent(nextValue)
  } else {
    provinceTableApi(nextValue)
  }
}

// 增加对比事件
function getFlowTrendDetail() {
  const params = copyObj(commonParams.value) as Record<string, unknown>

  delete params.contrastValue
  regionalTableRef.value?.initParamsEvent(params)
  comparePageNum.value = 1
  comparePageSize.value = 10
  if (dateFlag.value == 1) {
    regionalApiEvent()
  } else if (!dateFlag.value) {
    // 不对比事件
    regionalApiEvent()
  } else if (dateFlag.value == 2) {
    // 对比事件
    compareApiEvent(params)
  } else if (dateFlag.value == 3) {
    // 对比事件
    compareApiEvent(params)
  }
}

function getArea() {
  regionalShowRef.value?.getAreaProvince(commonParams.value)
}

function handleCustomEvent(data: string) {
  activeMap.value = data
  if (!dateFlag.value || dateFlag.value == 1) {
    if (data == 'province') {
      newValue.value.pageNum = 1
      newValue.value.pageSize = 10
      provinceTableApi(newValue.value)
    } else {
      newValue.value.pageNum = 1
      newValue.value.pageSize = 10
      countryApiEvent(newValue.value)
    }
  } else if (dateFlag.value == 2 || dateFlag.value == 3) {
    // 对比事件
    comparePageNum.value = 1
    comparePageSize.value = 10
    regionalTableRef.value?.initCurrentPage()
    compareApiEvent(commonParams.value)
  }
}

function setFilterBarParams(val: Record<string, unknown>, flag: number | null) {
  filterBarParams.value = copyObj(val)
  dateFlag.value = flag
}

function currentPage(val?: Record<string, unknown>, compareFlag?: boolean) {
  if (compareFlag && val) {
    comparePageNum.value = Number(val.pageNum)
    comparePageSize.value = Number(val.pageSize)
    compareApiEvent(commonParams.value)
  } else {
    regionalApiEvent(val)
  }
}

watch(commonParams, () => {
  getAreaDetailTotal() // 概览
  getFlowTrendDetail() // 对比
  getArea() // echarts
})
</script>

<template>
  <div>
    <FilterBar ByContrast @set-filter-bar-params="setFilterBarParams" />
    <div class="public-block">
      <div v-loading="loadingRefresh" class="Overview public-hoverItem">
        <div class="public-firstHead">流量概览</div>
        <contrastFlow ref="originViewRef" byAreaAnaly />
      </div>
      <regionalShow ref="regionalShowRef" @custom-event="handleCustomEvent" />
      <regionalTable
        v-loading="loadingSecond"
        ref="regionalTableRef"
        @current-page="currentPage"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.Overview {
  box-sizing: border-box;
  margin-bottom: 20px;
  min-height: 118px;
  background-color: #fff;

  img {
    width: 11.44px;
    height: 11.44px;
    margin-left: 12px;
    cursor: pointer;
  }

  .trafficHead {
    font-size: 16px;
    font-weight: 600;
    line-height: 16px;
    color: #4d4d4d;
    padding: 15px 30px 15px;
    padding-left: 0;
  }
}
</style>
