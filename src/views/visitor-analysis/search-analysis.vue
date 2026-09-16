<script setup lang="ts">
/**
 * 搜索词分析（v2 views/visitor-analysis/search-analysis.vue）。
 *
 * 与 v2 一致（v2 此处逻辑存疑）：模板里的 <searchAnalysis> 是注释掉的，
 * 但 getFlowTrendDetail 成功回调里仍然调 this.$refs.searchAnalysis.searchTable(res.data)，
 * v2 跑起来这里必定抛 TypeError（$refs.searchAnalysis 是 undefined）。
 * v3 用可选链保留同样的结构：接口照常请求，拿到数据后没有组件可喂，静默跳过。
 */
import { computed, ref, watch } from 'vue'
import { FilterBar } from '@/layout/components'
import { copyObj } from '@/utils/copy'
import { getSearchWordDetailApi } from '@/api/trackingapi/searchword'
import { useLatestOnly } from '@/composables/useLatestOnly'
import { useTrackingStore } from '@/stores/tracking'

const trackingStore = useTrackingStore()

const searchAnalysisRef = ref<{ searchTable: (val: unknown) => void } | null>(null)

const { next, isLatest } = useLatestOnly()

const filterBarParams = ref<Record<string, unknown> | string>('')
const pageNum = ref(1)
const pageSize = ref(10)
const sortName = ref<string | null>(null)
const sortOrder = ref<string | null>(null)

const commonParams = computed(() => ({
  projectName: trackingStore.projectName,
  ...(typeof filterBarParams.value === 'string' ? {} : filterBarParams.value),
}))

function getFlowTrendDetail(val?: Record<string, unknown>) {
  const nextValue = copyObj(commonParams.value) as Record<string, unknown>
  if (val) {
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
  }

  const token = next()
  getSearchWordDetailApi(nextValue)
    .then((res) => {
      if (!isLatest(token)) return
      if (res?.code != 200) return
      searchAnalysisRef.value?.searchTable(res.data)
    })
    .catch(() => {
      /* 报错已由请求层统一提示 */
    })
}

function setFilterBarParams(val: Record<string, unknown>) {
  filterBarParams.value = copyObj(val)
}

watch(commonParams, () => {
  getFlowTrendDetail()
})

// v2 模板里的 <searchAnalysis @currentPage="currentPage"> 是注释掉的，
// 这个方法在 v2 里同样没有调用点，保留以对齐结构
function currentPage(val: Record<string, unknown>) {
  getFlowTrendDetail(val)
}

defineExpose({ currentPage })
</script>

<template>
  <div>
    <FilterBar ByArea @set-filter-bar-params="setFilterBarParams" />
    <div class="public-block">
      <!-- <searchAnalysis
        @currentPage="currentPage"
        ref="searchAnalysisRef"
      ></searchAnalysis> -->
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
