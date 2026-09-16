<script setup lang="ts">
/**
 * 入口页分析（对应 v2 views/access-analysis/InterviewedPage/portalpage.vue）。
 *
 * v2 里「流量概览」那一段模板是注释掉的，配套的 originView 组件、getVisitUriTotalApi
 * 以及 getVisitUriTotal() 方法都成了死代码（引用的 $refs.originView 根本不存在），
 * 这里只保留注释掉的模板，死代码不再迁移。
 */
import { computed, ref, watch } from 'vue'
import { FilterBar } from '@/layout/components'
import portalpage from './components/portalpage-analysis.vue'
import { copyObj } from '@/utils/copy'
import { useTrackingStore } from '@/stores/tracking'

const trackingStore = useTrackingStore()

const filterBarParams = ref<Record<string, unknown>>({})

const portalpageRef = ref<{
  pageNum: number
  portalpageEvent: (commonParams: Record<string, unknown>) => void
} | null>(null)

const projectName = computed(() => trackingStore.projectName)
const commonParams = computed<Record<string, unknown>>(() =>
  Object.assign({ projectName: projectName.value }, filterBarParams.value),
)

function getVisitUriPathTreeTotal() {
  portalpageRef.value?.portalpageEvent(commonParams.value)
}

watch(commonParams, () => {
  if (portalpageRef.value) portalpageRef.value.pageNum = 1
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
    <!-- <div class="Overview public-hoverItem">
        <div class="public-firstHead">流量概览</div>
        <div class="bid-list-page">
          <originView ref="originView" byVisitedPage></originView>
        </div>
      </div> -->
    <portalpage ref="portalpageRef" @current-page="currentPage" />
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
