<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { copyObj } from '@/utils/copy'
import { useTrackingStore } from '@/stores/tracking'
import TopFilter from './components/TopFilter.vue'
import FlowView from './components/FlowView.vue'
import TrendChart from './components/TrendChart.vue'
import NewOldVisitors from './components/NewOldVisitors.vue'
import PageView from './components/PageView.vue'
import SearchWord from './components/SearchWord.vue'
import SourceWebsite from './components/SourceWebsite.vue'
import LocalDistribution from './components/LocalDistribution.vue'

const trackingStore = useTrackingStore()
const topFilterParams = ref<Record<string, unknown>>({})
const timeTypeFlag = ref('')

const flowViewRef = ref<{ getFlow: () => void } | null>(null)
const trendChartRef = ref<{ getFlowTrend: () => void } | null>(null)
const newOldVisitorsRef = ref<{ getVisitor: () => void } | null>(null)
const pageViewRef = ref<{ getVisitUri: () => void } | null>(null)
const searchWordRef = ref<{ getSearchWord: () => void } | null>(null)
const sourceWebsiteRef = ref<{ getSourceWebsite: () => void } | null>(null)
const localDistributionRef = ref<{ getArea: () => void } | null>(null)

const commonParams = computed(() => ({
  projectName: trackingStore.projectName,
  ...topFilterParams.value,
}))

function getIndexData() {
  void nextTick(() => {
    flowViewRef.value?.getFlow()
    pageViewRef.value?.getVisitUri()
    searchWordRef.value?.getSearchWord()
    sourceWebsiteRef.value?.getSourceWebsite()
    newOldVisitorsRef.value?.getVisitor()
    localDistributionRef.value?.getArea()
    trendChartRef.value?.getFlowTrend()
  })
}

function timeTypeCheck(val: string) {
  timeTypeFlag.value = val
}

function setTopFilterParams(val: Record<string, unknown>) {
  topFilterParams.value = copyObj(val)
}

watch(commonParams, () => {
  if (!topFilterParams.value.startTime) return
  getIndexData()
})
</script>

<template>
  <div class="documentation-container">
    <div style="height: 61px">
      <TopFilter @set-top-filter-params="setTopFilterParams" @time-type-check="timeTypeCheck" />
    </div>
    <div class="public-block">
      <FlowView ref="flowViewRef" :common-params="commonParams" :time-type-flag="timeTypeFlag" />
      <div class="block-line">
        <TrendChart ref="trendChartRef" class="left" :common-params="commonParams" />
        <NewOldVisitors ref="newOldVisitorsRef" class="right" :common-params="commonParams" />
      </div>
      <div class="block-line">
        <PageView ref="pageViewRef" class="left" :common-params="commonParams" />
        <SearchWord ref="searchWordRef" class="right" :common-params="commonParams" />
      </div>
      <div class="block-line">
        <SourceWebsite ref="sourceWebsiteRef" class="left" :common-params="commonParams" />
        <LocalDistribution ref="localDistributionRef" class="right" :common-params="commonParams" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.block-line {
  box-sizing: border-box;
  margin: 20px 0;
  min-height: 300px;
  display: flex;
  justify-content: space-between;

  .left {
    width: 50%;
    margin-right: 10px;
  }

  .right {
    width: 50%;
    margin-left: 10px;
  }
}
</style>
