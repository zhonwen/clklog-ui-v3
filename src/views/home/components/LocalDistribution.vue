<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { getAreaApi } from '@/api/trackingapi/area'
import { percentage } from '@/utils/percent'
import arrowIcon from '@/assets/images/icon.png'

const props = defineProps<{
  commonParams: Record<string, unknown>
}>()

const router = useRouter()
const loadingRefresh = ref(false)
const areaList = ref<Record<string, unknown>[]>([])

function getArea() {
  loadingRefresh.value = true
  getAreaApi({ ...props.commonParams })
    .then((res) => {
      loadingRefresh.value = false
      areaList.value = (res.data as Record<string, unknown>[]) || []
    })
    .catch(() => {
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
    <el-table class="public-radius" :data="areaList.slice(0, 10)" style="width: 100%" max-height="320">
      <el-table-column prop="province" label="省份" show-overflow-tooltip />
      <el-table-column prop="visitCount" label="访问次数" align="center" width="100" />
      <el-table-column prop="uv" label="访客数" align="center" width="90" />
      <el-table-column label="访客占比" align="center" width="100">
        <template #default="{ row }">{{ percentage(row.uvRate as number) }}</template>
      </el-table-column>
    </el-table>
    <div class="map-placeholder">中国地图将在第 6 步接入</div>
  </div>
</template>

<style lang="scss" scoped>
.map-placeholder {
  margin-top: 12px;
  text-align: center;
  color: #909399;
  font-size: 12px;
}
</style>
