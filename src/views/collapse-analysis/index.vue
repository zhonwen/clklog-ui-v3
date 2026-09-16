<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import customBar from '@/views/analysis-modules/custom-analysis/components/customBar.vue'
import collapseChart from './components/collapse-chart.vue'
import collapseTable from './components/collapse-table.vue'
import trafficOverview from './components/trafficOverview.vue'
import type { CustomFilterBarParams } from '@/views/analysis-modules/custom-analysis/types'
import { copyObj } from '@/utils/copy'
import { totalSummaryApi } from '@/api/trackingapi/collapse'
import { useTrackingStore } from '@/stores/tracking'
import { useLatestOnly } from '@/composables/useLatestOnly'

/**
 * 崩溃分析（v2 src/views/collapse-analysis/index.vue，组件名 funnelAnalysis —— v2 里就写错了，
 * 与漏斗分析无关，v3 用 <script setup>，不再声明 name）
 */

interface CollapseOverviewItem {
  visitCount?: number
  crashedCount?: number
  pvRate?: number
  uv?: number
  crashedUv?: number
  uvRate?: number
}

const trackingStore = useTrackingStore()
const { next, isLatest } = useLatestOnly()

const filterBarParams = ref<Record<string, unknown> | null>(null)
const loadingRefresh = ref(false)

const trafficOverviewRef = ref<{ dataListEvent: (val: CollapseOverviewItem[]) => void } | null>(
  null,
)
const collapseChartRef = ref<{ paramsEvent: (params: Record<string, unknown>) => void } | null>(
  null,
)
const collapseTableRef = ref<{
  pageNum: number
  paramsEvent: (params: Record<string, unknown>) => void
} | null>(null)

const projectName = computed(() => trackingStore.projectName)

// v2：Object.assign({ projectName }, this.filterBarParams)；
// filterBarParams 初值在 v2 里是空串 ""，Object.assign 会忽略它，等价于这里的 ?? {}
const commonParams = computed<Record<string, unknown>>(() =>
  Object.assign({ projectName: projectName.value }, filterBarParams.value ?? {}),
)

function getList(newVal: Record<string, unknown>) {
  const params = copyObj(newVal)
  params.channel = []
  loadingRefresh.value = true
  const token = next()
  totalSummaryApi(params)
    .then((res) => {
      if (!isLatest(token)) return
      if (res?.code == 200) {
        loadingRefresh.value = false
        trafficOverviewRef.value?.dataListEvent((res.data ?? []) as CollapseOverviewItem[])
      }
    })
    .catch(() => {
      if (!isLatest(token)) return
      loadingRefresh.value = false
    })
}

function setFilterBarParams(val: CustomFilterBarParams) {
  // copyObj 与 v2 一致；再摊一层只是为了让后面的 delete timeFlag / groupName 在类型上成立
  filterBarParams.value = { ...copyObj(val) }
}

watch(commonParams, (newVal, oldVal) => {
  if (JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
    // 与 v2 一致：直接在 computed 返回的对象上 delete。
    // 副作用照搬：下一轮比较时 oldVal 里已经没有 timeFlag / groupName 了，
    // 所以只要筛选条再发一次参数就必然「不相等」，即每次都会重新取数。
    delete newVal.timeFlag
    delete newVal.groupName
    getList(newVal)
    if (collapseTableRef.value) collapseTableRef.value.pageNum = 1
    collapseChartRef.value?.paramsEvent(newVal)
    collapseTableRef.value?.paramsEvent(newVal)
  }
})
</script>

<template>
  <div>
    <customBar ByDayOrHour ByCollapse @set-filter-bar-params="setFilterBarParams" />
    <div class="public-block">
      <div class="public-hoverItem">
        <div
          class="public-firstHead"
          style="height: 151px; background-color: #fff; margin-top: 16px; border-radius: 6px"
        >
          <div class="public-firstHead" style="padding: 15px 15px 0 15px">流量概览</div>
          <trafficOverview ref="trafficOverviewRef" v-loading="loadingRefresh" />
        </div>
      </div>
    </div>
    <!-- 图表 -->
    <div class="public-block">
      <collapseChart ref="collapseChartRef" />
    </div>
    <div>
      <collapseTable ref="collapseTableRef" />
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
