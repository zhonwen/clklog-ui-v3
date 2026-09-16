<script setup lang="ts">
/** 渠道分析（v2 views/visitor-analysis/channel-analysis/index.vue） */
import { computed, ref, watch } from 'vue'
import { FilterBar } from '@/layout/components'
import { getChannelDetailApi } from '@/api/trackingapi/channel'
import { copyObj } from '@/utils/copy'
import { useLatestOnly } from '@/composables/useLatestOnly'
import { useTrackingStore } from '@/stores/tracking'
import channelTable from './components/channelTable.vue'

interface ChannelRow {
  channel?: string
  [key: string]: unknown
}

const trackingStore = useTrackingStore()

const channelTableRef = ref<{
  refreshEvent: (val: boolean) => void
  getChannelList: (val: ChannelRow[]) => void
} | null>(null)

const filterBarParams = ref<Record<string, unknown>>({})
// 与 v2 一致：loadingRefresh 在本组件里只被赋值、没有绑到模板上（真正的 loading 在子组件里）
const loadingRefresh = ref(false)

const { next, isLatest } = useLatestOnly()

const commonParams = computed(() => ({
  projectName: trackingStore.projectName,
  ...filterBarParams.value,
}))

function getChannelDetail() {
  channelTableRef.value?.refreshEvent(true)
  const params = copyObj(commonParams.value) as Record<string, unknown>
  const token = next()
  getChannelDetailApi(params)
    .then((res) => {
      if (!isLatest(token)) return
      if (res?.code != 200) return
      loadingRefresh.value = false
      channelTableRef.value?.getChannelList((res.data as ChannelRow[]) || [])
      channelTableRef.value?.refreshEvent(false)
    })
    .catch(() => {
      if (!isLatest(token)) return
      loadingRefresh.value = false
      channelTableRef.value?.refreshEvent(false)
    })
}

function setFilterBarParams(val: Record<string, unknown>) {
  filterBarParams.value = copyObj(val)
}

function currentPage() {
  getChannelDetail()
}

watch(commonParams, () => {
  getChannelDetail()
})
</script>

<template>
  <div>
    <FilterBar ByArea byChnnel @set-filter-bar-params="setFilterBarParams" />
    <channelTable ref="channelTableRef" @current-page="currentPage" />
  </div>
</template>

<style lang="scss" scoped></style>
