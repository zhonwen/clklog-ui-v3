<script setup lang="ts">
/**
 * 退出页分析（对应 v2 views/access-analysis/InterviewedPage/exitpage.vue）。
 *
 * 与 portalpage 一样，v2 里的 originView / getVisitUriTotalApi / getVisitUriTotal() 是死代码
 * （模板里没有 ref="originView" 的节点），这里不再迁移。
 */
import { computed, ref, watch } from 'vue'
import { FilterBar } from '@/layout/components'
import exitpage from './components/exitpage-analysis.vue'
import { copyObj } from '@/utils/copy'
import { useTrackingStore } from '@/stores/tracking'

const trackingStore = useTrackingStore()

const filterBarParams = ref<Record<string, unknown>>({})

const exitpageRef = ref<{
  pageNum: number
  exitpageEvent: (commonParams: Record<string, unknown>) => void
} | null>(null)

const projectName = computed(() => trackingStore.projectName)
const commonParams = computed<Record<string, unknown>>(() =>
  Object.assign({ projectName: projectName.value }, filterBarParams.value),
)

function getVisitUriPathTreeTotal() {
  exitpageRef.value?.exitpageEvent(commonParams.value)
}

watch(commonParams, () => {
  if (exitpageRef.value) exitpageRef.value.pageNum = 1
  getVisitUriPathTreeTotal()
})

function setFilterBarParams(val: Record<string, unknown>) {
  filterBarParams.value = copyObj(val)
}

// 与 v2 一致：子组件 emit 的 currentPage 在 v2 里是空实现
function currentPage() {}
</script>

<template>
  <div>
    <FilterBar :ByDownLoad="false" ByArea @set-filter-bar-params="setFilterBarParams" />
    <exitpage ref="exitpageRef" @current-page="currentPage" />
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
    // 与 v2 一致（v2 此处逻辑存疑：`width: clas(100% -20px)` 不是合法 CSS，浏览器会丢弃这条声明）
    display: flex;
    flex-direction: column;
  }
}
</style>
