<script setup lang="ts">
/** 站外搜索词分析（对应 v2 views/access-analysis/searchTerm/siteoutSearch.vue） */
import { computed, ref, watch } from 'vue'
import { FilterBar } from '@/layout/components'
import searchAnalysis from './components/siteout.vue'
import { copyObj } from '@/utils/copy'
import { useTrackingStore } from '@/stores/tracking'

const trackingStore = useTrackingStore()

const loadingRefresh = ref(false)
// 与 v2 一致：v2 的初值是空字符串 ""，Object.assign({projectName}, "") 的结果与传 {} 相同
const filterBarParams = ref<Record<string, unknown>>({})

const searchAnalysisRef = ref<{
  updatePagination: (pageNum: number, pageSize?: number | null) => void
  initTableList: (row: Record<string, unknown>) => void
} | null>(null)

const projectName = computed(() => trackingStore.projectName)
const commonParams = computed<Record<string, unknown>>(() =>
  Object.assign({ projectName: projectName.value }, filterBarParams.value),
)

watch(commonParams, (newval) => {
  // 与 v2 一致：updatePagination(1) 内部已经会取一次数，这里紧接着又 initTableList 了一次，
  // 同一份参数会连发两个请求（v2 此处逻辑存疑，照迁）
  searchAnalysisRef.value?.updatePagination(1)
  searchAnalysisRef.value?.initTableList(newval)
})

function setFilterBarParams(val: Record<string, unknown>) {
  filterBarParams.value = copyObj(val)
}
</script>

<template>
  <div>
    <FilterBar ByArea @set-filter-bar-params="setFilterBarParams" />
    <div v-loading="loadingRefresh" class="public-block">
      <searchAnalysis ref="searchAnalysisRef" />
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
