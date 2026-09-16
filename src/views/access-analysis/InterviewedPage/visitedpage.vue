<script setup lang="ts">
/** 受访页面分析（对应 v2 views/access-analysis/InterviewedPage/visitedpage.vue） */
import { computed, ref, watch } from 'vue'
import { getVisitUriTotalApi } from '@/api/trackingapi/visituri'
import { FilterBar } from '@/layout/components'
import originView from '@/components/origin-view/index.vue'
import visitedAnalysis from './components/visited-page-analysis.vue'
import { copyObj } from '@/utils/copy'
import { useTrackingStore } from '@/stores/tracking'
import { useLatestOnly } from '@/composables/useLatestOnly'

const trackingStore = useTrackingStore()
const { next, isLatest } = useLatestOnly()

const loadingRefresh = ref(false)
// 与 v2 一致：loadingSecond 只绑在 visitedAnalysis 上，页面里没有地方改它
const loadingSecond = ref(false)
const filterBarParams = ref<Record<string, unknown>>({})

const originViewRef = ref<{ originEvent: (val: unknown) => void } | null>(null)
const visitedAnalysisRef = ref<{
  current: { pageNum: number }
  initTableList: (row: Record<string, unknown>) => void
} | null>(null)

const projectName = computed(() => trackingStore.projectName)
const commonParams = computed<Record<string, unknown>>(() =>
  Object.assign({ projectName: projectName.value }, filterBarParams.value),
)

function getVisitUriTotal() {
  const token = next()
  loadingRefresh.value = true
  getVisitUriTotalApi(commonParams.value)
    .then((res) => {
      if (!isLatest(token)) return
      loadingRefresh.value = false
      if (res?.code == 200) {
        originViewRef.value?.originEvent(res.data)
      }
    })
    .catch(() => {
      if (!isLatest(token)) return
      loadingRefresh.value = false
    })
}

watch(commonParams, (newval) => {
  getVisitUriTotal()
  if (visitedAnalysisRef.value) {
    visitedAnalysisRef.value.current.pageNum = 1
    // table 表格
    visitedAnalysisRef.value.initTableList(newval)
  }
})

function setFilterBarParams(val: Record<string, unknown>) {
  filterBarParams.value = copyObj(val)
}
</script>

<template>
  <div>
    <FilterBar ByArea @set-filter-bar-params="setFilterBarParams" />
    <div class="Overview public-hoverItem">
      <div class="public-firstHead">流量概览</div>
      <div class="bid-list-page">
        <originView ref="originViewRef" v-loading="loadingRefresh" by-visited-page is-update-duration />
      </div>
    </div>
    <visitedAnalysis ref="visitedAnalysisRef" v-loading="loadingSecond" />
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
    font-size: 16px;
    font-weight: 600;
    line-height: 16px;
    color: #4d4d4d;
    padding: 15px 30px 15px;
    padding-left: 0;
  }

  .bid-list-page {
    // 与 v2 一致（v2 此处逻辑存疑：写的是 `clas(100% -20px)`，既不是 calc 也不是合法函数，
    // 这条 width 在浏览器里会被丢弃，等同于没写）
    display: flex;
    flex-direction: column;
  }
}
</style>
