<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import LineMarker from '@/components/Charts/LineMarker.vue'
import { getFlowTrendApi } from '@/api/trackingapi/flow'
import arrowIcon from '@/assets/images/icon.png'

const props = defineProps<{
  commonParams: Record<string, unknown>
}>()

const router = useRouter()
const loadingRefresh = ref(false)
const trendChartRef = ref<{
  getApiTrendList: (val: unknown[], lege: string[]) => void
  changeLegend: (val: string[]) => void
} | null>(null)
const headLege = ref(['IP数', '访问次数'])
const options = [
  { value: '浏览量', label: '浏览量' },
  { value: '访客数', label: '访客数' },
  { value: '访问次数', label: '访问次数' },
  { value: 'IP数', label: 'IP数' },
  { value: '跳出率', label: '跳出率' },
]

function getFlowTrend() {
  loadingRefresh.value = true
  getFlowTrendApi({ ...props.commonParams })
    .then((res) => {
      loadingRefresh.value = false
      if (res.code == 200) {
        trendChartRef.value?.getApiTrendList((res.data as unknown[]) || [], headLege.value)
      }
    })
    .catch(() => {
      loadingRefresh.value = false
    })
}

function handleCheckPointer(e: string[]) {
  headLege.value = e.flat(Infinity) as string[]
  trendChartRef.value?.changeLegend(headLege.value)
}

defineExpose({ getFlowTrend })
</script>

<template>
  <div v-loading="loadingRefresh" class="TrendChart block-main public-hoverItem">
    <div class="block-head" @click="router.push('/trendAnalysis/trend')">
      <div class="block-title">趋势图</div>
      <el-select
        v-model="headLege"
        class="custom_select"
        multiple
        placeholder="请选择"
        style="margin-left: 20px; min-width: 280px"
        @change="handleCheckPointer"
        @click.stop
      >
        <el-option v-for="item in options" :key="item.value" :label="item.label" :value="item.value">
          <div style="display: flex; align-items: center">
            <span class="checkbox__inner"><div class="inner-box" /></span>
            <span>{{ item.label }}</span>
          </div>
        </el-option>
      </el-select>
      <div class="block-head-icon">
        <img :src="arrowIcon" alt="" width="10" />
      </div>
    </div>
    <LineMarker ref="trendChartRef" height="350px" width="100%" style="padding: 20px" />
  </div>
</template>

<style lang="scss" scoped>
.TrendChart {
  .block-head {
    display: flex;
    align-items: center;
  }
}
</style>
