<script setup lang="ts">
/** 用户忠诚度分析（对应 v2 views/user-behavior/loyaltyAnalysis/index.vue） */
import { computed, ref, watch } from 'vue'
import type { TabsPaneContext } from 'element-plus'
import { FilterBar } from '@/layout/components'
import { getUserVisitApi, getUserVisitTimeApi, getUserPvApi } from '@/api/trackingapi/uservisit'
// v2 这里是 import { ... } from "./components/index"（纯导出文件），v3 直接 import 组件
import visitNum from './components/visitNum.vue'
import visitPage from './components/visitPage.vue'
import visitTime from './components/visitTime.vue'
import visitDepth from './components/visitDepth.vue'
import visitLastTime from './components/visitLastTime.vue'
import type { LoyaltyRow } from './components/summary'
import { copyObj } from '@/utils/copy'
import { useTrackingStore } from '@/stores/tracking'
import { useLatestOnly } from '@/composables/useLatestOnly'

const trackingStore = useTrackingStore()
// 三个取数函数各一套「只认最新一次」
const visitLatest = useLatestOnly()
const visitTimeLatest = useLatestOnly()
const pvLatest = useLatestOnly()

const loadingRefresh = ref(false)
const ByCalendar = ref(true)
const ByTime = ref(true)
const filterBarParams = ref<Record<string, unknown>>({})
const activeTab = ref('访问页数')

const visitPageRef = ref<{ getVisitPage: (val: LoyaltyRow[]) => void } | null>(null)
const visitDepthRef = ref<{ getDepthEvent: (params: Record<string, unknown>) => void } | null>(null)
const visitTimeRef = ref<{ getVisitTime: (val: LoyaltyRow[]) => void } | null>(null)
const visitLastTimeRef = ref<{ initApiEvent: (params: Record<string, unknown>) => void } | null>(
  null,
)
const visitNumRef = ref<{ getVisitNum: (val: LoyaltyRow[]) => void } | null>(null)

const projectName = computed(() => trackingStore.projectName)
const commonParams = computed<Record<string, unknown>>(() =>
  Object.assign({ projectName: projectName.value }, filterBarParams.value),
)

function getUserVisit() {
  const token = visitLatest.next()
  loadingRefresh.value = true
  getUserVisitApi(commonParams.value)
    .then((res) => {
      if (!visitLatest.isLatest(token)) return
      if (res?.code == 200) {
        loadingRefresh.value = false
        visitNumRef.value?.getVisitNum((res.data as LoyaltyRow[] | null) || [])
      }
    })
    .catch(() => {
      if (!visitLatest.isLatest(token)) return
      loadingRefresh.value = false
    })
}

function getUserVisitTime() {
  const token = visitTimeLatest.next()
  loadingRefresh.value = true
  getUserVisitTimeApi(commonParams.value)
    .then((res) => {
      if (!visitTimeLatest.isLatest(token)) return
      if (res?.code == 200) {
        loadingRefresh.value = false
        visitTimeRef.value?.getVisitTime((res.data as LoyaltyRow[] | null) || [])
      }
    })
    .catch(() => {
      if (!visitTimeLatest.isLatest(token)) return
      loadingRefresh.value = false
    })
}

function getUserPv() {
  const token = pvLatest.next()
  loadingRefresh.value = true
  getUserPvApi(commonParams.value)
    .then((res) => {
      if (!pvLatest.isLatest(token)) return
      if (res?.code == 200) {
        loadingRefresh.value = false
        visitPageRef.value?.getVisitPage((res.data as LoyaltyRow[] | null) || [])
      }
    })
    .catch(() => {
      if (!pvLatest.isLatest(token)) return
      loadingRefresh.value = false
    })
}

// v2 的 handleClick(val) 里读的是 val.label（element-ui 的 tab-click 直接给的是 pane 实例），
// element-plus 的 TabsPaneContext 把它挪到了 props.label
function handleClick(pane: TabsPaneContext) {
  const label = String(pane.props.label ?? '')
  if (label == '上次访问时间') {
    ByTime.value = false
    ByCalendar.value = false
    visitLastTimeRef.value?.initApiEvent(commonParams.value)
  } else {
    ByTime.value = true
    ByCalendar.value = true
    switch (label) {
      case '访问页数':
        getUserPv() // 页数
        break
      case '访问频次':
        getUserVisit() // 频次
        break
      case '访问时长':
        getUserVisitTime() // 时长
        break
      case '访问深度':
        visitDepthRef.value?.getDepthEvent(commonParams.value)
        break
    }
  }
}

function setFilterBarParams(val: Record<string, unknown>) {
  filterBarParams.value = copyObj(val)
}

watch(commonParams, (val) => {
  switch (activeTab.value) {
    case '访问页数':
      getUserPv() // 页数
      break
    case '访问频次':
      getUserVisit() // 频次
      break
    case '访问时长':
      getUserVisitTime() // 时长
      break
    case '上次访问时间':
      visitLastTimeRef.value?.initApiEvent(val)
      break
    case '访问深度':
      visitDepthRef.value?.getDepthEvent(val)
      break
  }
})
</script>

<template>
  <div>
    <FilterBar
      :ByCalendar="ByCalendar"
      :ByTime="ByTime"
      ByArea
      @set-filter-bar-params="setFilterBarParams"
    />
    <div class="userLoyalty public-hoverItem">
      <el-tabs v-model="activeTab" @tab-click="handleClick">
        <el-tab-pane label="访问页数" name="访问页数">
          <visitPage ref="visitPageRef" v-loading="loadingRefresh" />
        </el-tab-pane>
        <el-tab-pane label="访问深度" name="访问深度">
          <visitDepth ref="visitDepthRef" class="colItem" />
        </el-tab-pane>
        <el-tab-pane label="访问时长" name="访问时长">
          <visitTime ref="visitTimeRef" v-loading="loadingRefresh" class="colItem" />
        </el-tab-pane>
        <el-tab-pane label="上次访问时间" name="上次访问时间">
          <visitLastTime ref="visitLastTimeRef" v-loading="loadingRefresh" class="colItem" />
        </el-tab-pane>
        <el-tab-pane label="访问频次" name="访问频次">
          <visitNum ref="visitNumRef" v-loading="loadingRefresh" class="colItem" />
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.el-tabs__header) {
  background-color: #f9fafd;
  margin: 0 0;
  border-radius: 6px 6px 0 0;
}

:deep(.el-tabs__item.is-active) {
  background-color: #fff;
  border-radius: 6px 0 0 0;
}

:deep(.el-tabs__nav-wrap::after) {
  background-color: #fff;
}

:deep(.el-tabs__item) {
  padding: 0 0;
  width: 130px;
  height: 65px;
  line-height: 65px;
  text-align: center;
  font-size: 15px;
  font-weight: bold;
  color: #4d4d4d;
}

.colItem {
  margin-top: 20px;
}

.userLoyalty {
  height: 1109px;
  margin: 20px;
  background: #fff;
  border-radius: 6px !important;
}
</style>
