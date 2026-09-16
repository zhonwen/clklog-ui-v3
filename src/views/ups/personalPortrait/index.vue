<script setup lang="ts">
/** 个人画像（对应 v2 `views/ups/personalPortrait/index.vue`） */
import { computed, ref, watch } from 'vue'
import { FilterBar } from '@/layout/components'
import behaviorChart from './components/behavior-analysis-charts.vue'
import { copyObj } from '@/utils/copy'
import { useTrackingStore } from '@/stores/tracking'

const trackingStore = useTrackingStore()

const filterBarParams = ref<Record<string, unknown> | null>(null)

const behaviorChartRef = ref<{
  updateVisitorList: (params: { filterParams: Record<string, unknown> | null }) => void
} | null>(null)

const projectName = computed(() => trackingStore.projectName)
const commonParams = computed<Record<string, unknown>>(() =>
  Object.assign({ projectName: projectName.value }, filterBarParams.value),
)

function setFilterBarParams(val: Record<string, unknown>) {
  filterBarParams.value = copyObj(val)
}

// v2 是 watch commonParams -> this.$refs.behaviorChart.updateVisitorList({ filterParams: commonParams })
watch(commonParams, () => {
  behaviorChartRef.value?.updateVisitorList({ filterParams: commonParams.value })
})
</script>

<template>
  <div>
    <FilterBar ByArea @set-filter-bar-params="setFilterBarParams" />
    <behaviorChart ref="behaviorChartRef" />
  </div>
</template>

<style lang="scss" scoped>
.Overview {
  margin: 20px;
  min-height: 118px;
  background-color: #fff;
  border-radius: 6px;

  img {
    width: 11.44px;
    height: 11.44px;
    margin-left: 12px;
    cursor: pointer;
  }

  .trafficHead {
    font-size: 14px;
    font-weight: 500;
    line-height: 14px;
    color: #4d4d4d;
    padding: 15px 30px 15px;
    padding-left: 0;
  }

  .bid-list-page {
    // 与 v2 一致（v2 此处逻辑存疑：写的是 `width: clas(100% -20px)`，既不是 calc 也不是
    // 合法函数，这条 width 在浏览器里会被丢弃，等同于没写）
    display: flex;
    flex-direction: column;

    .bid-list-header {
      display: flex;

      .header-name {
        width: 14%;
        justify-content: center;
        height: 30px;
        display: flex;
        align-items: center;
      }

      .w156 {
        font-size: 13px;
        font-weight: 400;
        line-height: 14px;
        color: #4d4d4d;
      }
    }

    .bid-list-record {
      display: flex;

      .bid-list-item {
        width: 14%;
        justify-content: center;
        height: 30px;
        display: flex;
        align-items: center;
      }

      .w157 {
        font-size: 12px;
        font-weight: 400;
        line-height: 14px;
        color: #4d4d4d;
      }

      .w158 {
        font-size: 16px;
        font-weight: bold;
        color: #2c7be5;
        line-height: 17px;
      }
    }
  }
}
</style>
