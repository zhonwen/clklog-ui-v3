<script setup lang="ts">
/**
 * 来源网站分析（v2 views/visitor-analysis/sourceWeb-analysis.vue）。
 *
 * v2 里还有一个 getSourceWebSiteTop10（调 getSourceWebsiteApi 再喂给图表），
 * 但 watch 里走的是 getSourceWebSiteChartData（分页接口 + 排序），getSourceWebSiteTop10
 * 没有任何调用点，属于死代码，v3 未迁。
 */
import { computed, ref, watch } from 'vue'
import originView from '@/components/origin-view/index.vue'
import { FilterBar } from '@/layout/components'
import { copyObj } from '@/utils/copy'
import { useLatestOnly } from '@/composables/useLatestOnly'
import { useTrackingStore } from '@/stores/tracking'
import sourceWebChart from './chart-component/sourceWeb-analysis-chart.vue'
import sourceWebTable from './chart-component/sourceWeb-analysis-table.vue'
import {
  getSourceWebSiteTotalApi,
  getSourceSiteDetailApi,
} from '@/api/trackingapi/sourcewebsite'

interface SourceRow {
  sourcesite?: string
  pv?: number
  uv?: number
  visitCount?: number
  ipCount?: number
  bounceRate?: number
}

interface SourceSitePayload {
  rows?: SourceRow[]
  total?: number
}

const trackingStore = useTrackingStore()

const originViewRef = ref<{ originEvent: (val: unknown) => void } | null>(null)
const sourceWebChartRef = ref<{ getSourceChart: (val: SourceRow[]) => void } | null>(null)
const sourceWebTableRef = ref<{
  getSourceSite: (val: SourceSitePayload) => void
  initCurrentPage: () => void
} | null>(null)

const { next: nextTotal, isLatest: isLatestTotal } = useLatestOnly()
const { next: nextDetail, isLatest: isLatestDetail } = useLatestOnly()
const { next: nextChart, isLatest: isLatestChart } = useLatestOnly()

const loadingRefresh = ref(false)
const loadingSecond = ref(false)
const loadingThird = ref(false)
const filterBarParams = ref<Record<string, unknown>>({})
const pageNum = ref(1)
const pageSize = ref(10)
const sortName = ref('uv')
const sortOrder = ref('desc')

const commonParams = computed(() => ({
  projectName: trackingStore.projectName,
  ...filterBarParams.value,
}))

function setFilterBarParams(val: Record<string, unknown>) {
  filterBarParams.value = copyObj(val)
}

function getSourceWebSiteTotal() {
  loadingRefresh.value = true
  const params = copyObj(commonParams.value) as Record<string, unknown>
  const token = nextTotal()
  getSourceWebSiteTotalApi(params)
    .then((res) => {
      if (!isLatestTotal(token)) return
      if (res?.code != 200) return
      loadingRefresh.value = false
      originViewRef.value?.originEvent(res.data)
    })
    .catch(() => {
      if (!isLatestTotal(token)) return
      loadingRefresh.value = false
    })
}

function getSourceSiteDetail(val?: Record<string, unknown>) {
  loadingThird.value = true
  const nextValue = copyObj(commonParams.value) as Record<string, unknown>
  pageNum.value = 1
  if (val) {
    nextValue.pageNum = val.page
    nextValue.pageSize = val.size
    nextValue.sortName = val.sortName
    nextValue.sortOrder = val.sortOrder
    sortName.value = String(val.sortName)
    sortOrder.value = String(val.sortOrder)
    pageNum.value = Number(val.page)
    pageSize.value = Number(val.size)
  } else {
    nextValue.sortName = sortName.value
    nextValue.sortOrder = sortOrder.value
    nextValue.pageNum = pageNum.value
    nextValue.pageSize = pageSize.value
    sourceWebTableRef.value?.initCurrentPage()
  }
  const token = nextDetail()
  getSourceSiteDetailApi(nextValue)
    .then((res) => {
      if (!isLatestDetail(token)) return
      if (res?.code != 200) return
      loadingThird.value = false
      sourceWebTableRef.value?.getSourceSite((res.data as SourceSitePayload) || {})
    })
    .catch(() => {
      if (!isLatestDetail(token)) return
      loadingThird.value = false
    })
}

function getSourceWebSiteChartData() {
  loadingSecond.value = true
  const params = copyObj(commonParams.value) as Record<string, unknown>

  // 设置分页参数，只获取前10条数据
  params.pageNum = 1
  params.pageSize = 10

  // 添加排序参数（确保总是有默认值）
  params.sortName = sortName.value || 'uv'
  params.sortOrder = sortOrder.value || 'desc'

  const token = nextChart()
  getSourceSiteDetailApi(params)
    .then((res) => {
      if (!isLatestChart(token)) return
      if (res?.code != 200) return
      loadingSecond.value = false
      // 传递分页接口返回的数据给图表组件
      const data = res.data as SourceSitePayload | undefined
      sourceWebChartRef.value?.getSourceChart(data?.rows || [])
    })
    .catch(() => {
      if (!isLatestChart(token)) return
      loadingSecond.value = false
    })
}

function handleSortChange(sortParams: { sortName: string; sortOrder: string }) {
  // 更新排序参数
  sortName.value = sortParams.sortName
  sortOrder.value = sortParams.sortOrder

  // 调用分页接口获取排序后的数据
  getSourceWebSiteChartData()
}

function currentPage(val: Record<string, unknown>) {
  getSourceSiteDetail(val)
}

watch(commonParams, () => {
  getSourceSiteDetail()
  getSourceWebSiteChartData()
  getSourceWebSiteTotal()
})
</script>

<template>
  <div>
    <FilterBar ByArea @set-filter-bar-params="setFilterBarParams" />
    <div v-loading="loadingRefresh" class="Overview public-hoverItem">
      <div class="public-firstHead">流量概览</div>
      <originView ref="originViewRef" byAreaAnaly />
    </div>
    <sourceWebChart
      v-loading="loadingSecond"
      ref="sourceWebChartRef"
      @sort-change="handleSortChange"
    />
    <sourceWebTable
      ref="sourceWebTableRef"
      v-loading="loadingThird"
      @current-page="currentPage"
    />
  </div>
</template>

<style lang="scss" scoped>
.Overview {
  margin: 20px;
  min-height: 118px;
  background-color: #fff;

  img {
    width: 11.44px;
    height: 11.44px;
    margin-left: 12px;
    cursor: pointer;
  }

  .trafficHead {
    font-size: 14px;
    font-weight: 500;
    line-height: 14px;
    color: #4d4d4d;
    padding: 15px 30px 15px;
    padding-left: 0;
  }

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
        font-weight: 400;
        line-height: 14px;
        color: #4d4d4d;
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
        font-size: 12px;
        font-weight: 400;
        line-height: 14px;
        color: #4d4d4d;
      }

      .w158 {
        font-size: 16px;
        font-weight: bold;
        color: #2c7be5;
        line-height: 17px;
      }
    }
  }
}
</style>
