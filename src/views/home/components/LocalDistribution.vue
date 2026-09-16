<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { getAreaApi } from '@/api/trackingapi/area'
import arrowIcon from '@/assets/images/icon.png'
import mapArea from '@/components/Charts/mapArea.vue'
import { useLatestOnly } from '@/composables/useLatestOnly'

const props = defineProps<{
  commonParams: Record<string, unknown>
}>()

const router = useRouter()
const loadingRefresh = ref(false)
const { next, isLatest } = useLatestOnly()
const mapAreaRef = ref<InstanceType<typeof mapArea> | null>(null)

function getArea() {
  const token = next()
  loadingRefresh.value = true
  getAreaApi({ ...props.commonParams })
    .then((res) => {
      if (!isLatest(token)) return
      loadingRefresh.value = false
      // v2 是 this.$refs.mapArea.getMapChartsData(res.data)
      mapAreaRef.value?.getMapChartsData(res.data as Parameters<
        NonNullable<typeof mapAreaRef.value>['getMapChartsData']
      >[0])
    })
    .catch(() => {
      if (!isLatest(token)) return
      loadingRefresh.value = false
    })
}

defineExpose({ getArea })
</script>

<template>
  <div v-loading="loadingRefresh" class="documentation-container block-main public-hoverItem">
    <div class="block-head" @click="router.push('/visitorAnalysis/regional')">
      <div class="block-title">地域分布</div>
      <div class="block-head-icon">
        <img :src="arrowIcon" alt="" width="10" />
      </div>
    </div>
    <!-- IP2Location LITE 署名在 mapArea 内部（与 v2 一致，授权要求注明出处） -->
    <mapArea ref="mapAreaRef" style="height: 100%" />
  </div>
</template>
