<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getAreaApi } from '@/api/trackingapi/area'
import { percentage } from '@/utils/percent'
import arrowIcon from '@/assets/images/icon.png'
import { useLatestOnly } from '@/composables/useLatestOnly'

const props = defineProps<{
  commonParams: Record<string, unknown>
}>()

const router = useRouter()
const loadingRefresh = ref(false)
const { next, isLatest } = useLatestOnly()
const areaList = ref<Record<string, unknown>[]>([])
const copyRight = window.globalConfig.copyRight || 'ClkLog'

// 地图未接入期间用表格替代。接口不保证按访问次数倒序，直接 slice(0,10) 取到的不是 Top10，
// 因此这里先排序再截断（v2 是地图，按省份匹配，不依赖返回顺序）。
const topAreaList = computed(() =>
  [...areaList.value]
    .sort((a, b) => Number(b.visitCount || 0) - Number(a.visitCount || 0))
    .slice(0, 10),
)

function getArea() {
  const token = next()
  loadingRefresh.value = true
  getAreaApi({ ...props.commonParams })
    .then((res) => {
      if (!isLatest(token)) return
      loadingRefresh.value = false
      areaList.value = (res.data as Record<string, unknown>[]) || []
    })
    .catch(() => {
      if (!isLatest(token)) return
      loadingRefresh.value = false
    })
}

defineExpose({ getArea })
</script>

<template>
  <div v-loading="loadingRefresh" class="LocalDistribution block-main public-hoverItem">
    <div class="block-head" @click="router.push('/visitorAnalysis/regional')">
      <div class="block-title">地域分布</div>
      <div class="block-head-icon">
        <img :src="arrowIcon" alt="" width="10" />
      </div>
    </div>
    <el-table class="public-radius" :data="topAreaList" style="width: 100%" max-height="320">
      <el-table-column prop="province" label="省份" show-overflow-tooltip />
      <el-table-column prop="visitCount" label="访问次数" align="center" width="100" />
      <el-table-column label="访问占比" align="center" width="100">
        <template #default="{ row }">{{ percentage(row.visitCountRate as number) }}</template>
      </el-table-column>
      <el-table-column prop="uv" label="访客数" align="center" width="90" />
      <el-table-column label="访客占比" align="center" width="100">
        <template #default="{ row }">{{ percentage(row.uvRate as number) }}</template>
      </el-table-column>
    </el-table>
    <div class="map-placeholder">中国地图将在第 6 步接入</div>
    <!-- v2 的地图底部有 IP2Location LITE 署名，地图未接入期间同样要保留（授权要求注明出处） -->
    <div class="ip2location-notice">
      {{ copyRight }} uses the IP2Location LITE database for
      <a href="https://lite.ip2location.com" target="_blank">IP geolocation</a>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.map-placeholder {
  margin-top: 12px;
  text-align: center;
  color: #909399;
  font-size: 12px;
}

.ip2location-notice {
  margin-top: 15px;
  text-align: center;
  font-size: 13px;

  a {
    cursor: pointer;
    color: #2c7be5;
  }
}
</style>
