<script setup lang="ts">
/** 结构化页面分析（对应 v2 views/access-analysis/InterviewedPage/treePage.vue） */
import { computed, ref, watch } from 'vue'
import { getVisitUriPathTreeTotalApi, getVisitUriTotalApi } from '@/api/trackingapi/visituri'
import { FilterBar } from '@/layout/components'
import originView from '@/components/origin-view/index.vue'
import treePage from './components/treepage-analysis.vue'
import { copyObj } from '@/utils/copy'
import { useTrackingStore } from '@/stores/tracking'
import { useLatestOnly } from '@/composables/useLatestOnly'

const trackingStore = useTrackingStore()
// 每个取数函数一套 token，共用会互相顶掉
const treeLatest = useLatestOnly()
const totalLatest = useLatestOnly()

const loadingRefresh = ref(false)
const loadingSecond = ref(false)
const filterBarParams = ref<Record<string, unknown>>({})

const originViewRef = ref<{ originEvent: (val: unknown) => void } | null>(null)
const treePageRef = ref<{
  treeListEvent: (val: unknown, params: Record<string, unknown>) => void
} | null>(null)

const projectName = computed(() => trackingStore.projectName)
const commonParams = computed<Record<string, unknown>>(() =>
  Object.assign({ projectName: projectName.value }, filterBarParams.value),
)

// 树状结构
function getVisitUriPathTreeTotal() {
  const token = treeLatest.next()
  loadingSecond.value = true
  getVisitUriPathTreeTotalApi(commonParams.value)
    .then((res) => {
      if (!treeLatest.isLatest(token)) return
      loadingSecond.value = false
      if (res?.code == 200) {
        treePageRef.value?.treeListEvent(res.data, commonParams.value)
      }
    })
    .catch(() => {
      if (!treeLatest.isLatest(token)) return
      loadingSecond.value = false
    })
}

function getVisitUriTotal() {
  const token = totalLatest.next()
  loadingRefresh.value = true
  getVisitUriTotalApi(commonParams.value)
    .then((res) => {
      if (!totalLatest.isLatest(token)) return
      loadingRefresh.value = false
      if (res?.code == 200) {
        originViewRef.value?.originEvent(res.data)
      }
    })
    .catch(() => {
      if (!totalLatest.isLatest(token)) return
      loadingRefresh.value = false
    })
}

watch(commonParams, () => {
  getVisitUriTotal()
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
    <div class="Overview public-hoverItem">
      <div class="public-firstHead">流量概览</div>
      <div class="bid-list-page">
        <originView ref="originViewRef" v-loading="loadingRefresh" by-visited-page is-update-duration />
      </div>
    </div>
    <treePage ref="treePageRef" v-loading="loadingSecond" @current-page="currentPage" />
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
