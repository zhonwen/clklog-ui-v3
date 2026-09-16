<script setup lang="ts">
/**
 * 设备分析（v2 views/visitor-analysis/equipment-analysis/index.vue）。
 * v2 的 components/index.js 只是把两个子组件再导出一遍，v3 直接 import 具体文件，不再建这个文件。
 */
import { computed, onMounted, ref, watch } from 'vue'
import type { TabsPaneContext } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import { FilterBar } from '@/layout/components'
import { getDeviceDetailApi } from '@/api/trackingapi/device'
import { copyObj } from '@/utils/copy'
import { bus } from '@/utils/event-bus'
import { useLatestOnly } from '@/composables/useLatestOnly'
import { useTrackingStore } from '@/stores/tracking'
import NetWorkType from './components/netWorkType.vue'
import operaSystem from './components/operaSystem.vue'

interface DeviceRow {
  device?: string
  [key: string]: unknown
}

interface DevicePayload {
  rows?: DeviceRow[]
  total?: number
}

const trackingStore = useTrackingStore()
const route = useRoute()
const router = useRouter()

const equipmentTableRef = ref<{
  currentPage: number
  initCurrentPage: () => void
  equipmentTableEvent: (
    val: DevicePayload,
    params: Record<string, unknown>,
    pageNum: number,
  ) => void
  PagingEvent: (res: DevicePayload) => void
} | null>(null)
const operaSystemRef = ref<{
  currentPage: number
  initCurrentPage: () => void
  operaSystemEvent: (params: Record<string, unknown>) => void
} | null>(null)

const { next: nextPaging, isLatest: isLatestPaging } = useLatestOnly()
const { next: nextDetail, isLatest: isLatestDetail } = useLatestOnly()

const loadingRefresh = ref(false)
const activeTab = ref('网络设备类型')
const filterBarParams = ref<Record<string, unknown>>({})
const pageNum = ref(1)
const pageSize = ref(10)
const sortName = ref<string | null>(null)
const sortOrder = ref<string | null>(null)

const commonParams = computed(() => ({
  projectName: trackingStore.projectName,
  ...filterBarParams.value,
}))

function setFilterBarParams(val: Record<string, unknown>) {
  filterBarParams.value = copyObj(val)
}

function getDeviceDetail(val?: Record<string, unknown>) {
  pageNum.value = 1
  const nextValue = copyObj(commonParams.value) as Record<string, unknown>
  loadingRefresh.value = true
  if (val) {
    // 分页事件
    nextValue.pageNum = val.page
    nextValue.pageSize = val.size
    pageNum.value = Number(val.page)
    pageSize.value = Number(val.size)
    nextValue.sortName = val.sortName
    nextValue.sortOrder = val.sortOrder
    sortName.value = (val.sortName as string | null) ?? null
    sortOrder.value = (val.sortOrder as string | null) ?? null

    const token = nextPaging()
    getDeviceDetailApi(nextValue)
      .then((res) => {
        if (!isLatestPaging(token)) return
        if (res?.code != 200) return
        loadingRefresh.value = false
        equipmentTableRef.value?.PagingEvent((res.data as DevicePayload) || {})
      })
      .catch(() => {
        if (!isLatestPaging(token)) return
        loadingRefresh.value = false
      })
  } else {
    nextValue.sortName = sortName.value
    nextValue.sortOrder = sortOrder.value
    nextValue.pageNum = pageNum.value
    nextValue.pageSize = pageSize.value

    const token = nextDetail()
    getDeviceDetailApi(nextValue)
      .then((res) => {
        if (!isLatestDetail(token)) return
        if (res?.code != 200) return
        loadingRefresh.value = false
        equipmentTableRef.value?.equipmentTableEvent(
          (res.data as DevicePayload) || {},
          commonParams.value,
          Number(nextValue.pageNum),
        )
      })
      .catch(() => {
        if (!isLatestDetail(token)) return
        loadingRefresh.value = false
      })
  }
}

function callAPiEvent(val: string) {
  switch (val) {
    case '网络设备类型':
      getDeviceDetail()
      break
    case '操作系统':
      operaSystemRef.value?.operaSystemEvent(commonParams.value)
      break
  }
}

function handleClick(pane: TabsPaneContext) {
  if (equipmentTableRef.value) equipmentTableRef.value.currentPage = 1
  // v2 是 this.$router.push({ path: "equipment", query: {...} })，相对路径解析后就是当前页
  void router.push({
    path: route.path,
    query: { deviceOption: pane.index },
  })
  // v2: this.$bus.$emit("clearListEvent", "")，mitt 只能传一个参数，原负载就是空字符串
  bus.emit('clearListEvent', '')
  callAPiEvent(String(pane.props.label ?? ''))
}

function currentPage(val: Record<string, unknown>) {
  getDeviceDetail(val)
}

watch(commonParams, () => {
  pageNum.value = 1

  // 根据当前激活的标签页重置对应组件的分页器到第1页
  if (activeTab.value === '网络设备类型' && equipmentTableRef.value) {
    equipmentTableRef.value.currentPage = 1
    equipmentTableRef.value.initCurrentPage()
  }

  if (activeTab.value === '操作系统' && operaSystemRef.value) {
    operaSystemRef.value.currentPage = 1
    operaSystemRef.value.initCurrentPage()
  }

  callAPiEvent(activeTab.value)
})

onMounted(() => {
  // v2 是在 created 里 push 的，效果一样：把 deviceOption 写进地址栏
  void router.push({ path: route.path, query: { deviceOption: 0 } })
})
</script>

<template>
  <div>
    <FilterBar ByArea @set-filter-bar-params="setFilterBarParams" />
    <div class="userLoyalty public-hoverItem">
      <el-tabs v-model="activeTab" @tab-click="handleClick">
        <el-tab-pane label="网络设备类型" name="网络设备类型">
          <NetWorkType
            v-loading="loadingRefresh"
            ref="equipmentTableRef"
            @current-page="currentPage"
          />
        </el-tab-pane>
        <el-tab-pane label="操作系统" name="操作系统">
          <operaSystem ref="operaSystemRef" />
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

.userLoyalty {
  min-height: 1109px;
  margin: 20px;
  background: #fff;
  border-radius: 6px !important;
}
</style>
