<script setup lang="ts">
/**
 * 公用流量指标勾选器（对应 v2 src/components/flowPoint/index.vue）。
 *
 * 1. 勾选变化时向父级 emit('flowPoint', 合并后的字段数组)，父级据此控制表格列。
 * 2. 监听 bus 的 publicEventDown / publicDialogDown，按当前路由调对应的导出接口。
 * 3. 监听 bus 的 clearListEvent，把勾选恢复默认。
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { bus } from '@/utils/event-bus'
import { blobDownloads } from '@/utils/localDownloadUtil'
import { useTrackingStore } from '@/stores/tracking'
import {
  exportAreaDetailApi,
  exportChannelDetailApi,
  exportDeviceDetailApi,
  exportFlowTrendDetailApi,
  exportInternalSearchWordDetailApi,
  exportOsDetailApi,
  exportSearchWordDetailApi,
  exportSourceWebsiteDetailApi,
} from '@/api/trackingapi/download'

withDefaults(
  defineProps<{
    byChannel?: boolean
    byNewOldVisit?: boolean
    bySite?: boolean
    byNoQuality?: boolean
  }>(),
  {
    byChannel: false,
    byNewOldVisit: false,
    bySite: false,
    byNoQuality: false,
  },
)

const emit = defineEmits<{
  (e: 'flowPoint', val: string[]): void
}>()

const route = useRoute()
const trackingStore = useTrackingStore()

// el-checkbox-group 的 modelValue 类型是 (string | number)[]，v-model 双向绑定时
// 必须与之一致，否则 vue-tsc 会在 update:modelValue 回填处报错。实际值全是字符串。
type CheckboxGroupValue = (string | number)[]

// 与 v2 一致：默认勾选项里带了 'searchCount'，但模板里没有对应的 checkbox，
// 它只会被原样合并进 emit 出去的数组
const channelList = ref<CheckboxGroupValue>(['pv', 'uv', 'ipCount', 'searchCount'])
const flowQuality = ref<CheckboxGroupValue>(['avgPv'])
const mergedArr = ref<string[]>([])

type DownloadParams = Record<string, unknown>
type DownloadResponse = { data: BlobPart; headers?: unknown }

function clearArray() {
  channelList.value = ['pv', 'uv', 'ipCount', 'searchCount']
  flowQuality.value = ['avgPv']
}

/** 与 v2 一致：从 content-disposition 里截 filename= 之后的部分 */
function sliceTypeFile(res: DownloadResponse) {
  // axios 1.x 的 headers 是 AxiosHeaders 实例，下标能取到，这里补一个 .get() 兜底
  const headers = res.headers as
    ({ get?: (k: string) => unknown } & Record<string, unknown>) | undefined
  const fileName = String(
    headers?.['content-disposition'] || headers?.get?.('content-disposition') || '',
  )
  const index1 = fileName.indexOf('filename=')
  let result = fileName.substring(index1)
  result = decodeURIComponent(decodeURI(result.slice(9)))
  return result
}

function download(promise: Promise<DownloadResponse>) {
  void promise.then((res) => {
    const name = sliceTypeFile(res)
    blobDownloads(res.data, name)
  })
}

function publicEventDown(val: DownloadParams, area?: string) {
  // 与 v2 一致：直接在 bus 传来的对象上写字段（没有拷贝）
  const params = val
  params.projectName = trackingStore.projectName
  let cols = [...channelList.value, ...flowQuality.value].map(String)
  params.cols = cols
  const path = route.path
  switch (path) {
    case '/trendAnalysis/trend': {
      const regular = ['statTime']
      cols = [...cols, ...regular] // 增加固定列
      params.cols = cols
      download(exportFlowTrendDetailApi(params) as Promise<DownloadResponse>)
      break
    }
    case '/access/searchTerm/siteoutSearch': {
      const regular = ['index', 'searchword']
      cols = [...cols, ...regular] // 增加固定列
      params.cols = cols
      download(exportSearchWordDetailApi(params) as Promise<DownloadResponse>)
      break
    }
    case '/access/searchTerm/siteonSearch': {
      const regular = ['index', 'searchword']
      cols = [...cols, ...regular] // 增加固定列
      params.cols = cols
      download(exportInternalSearchWordDetailApi(params) as Promise<DownloadResponse>)
      break
    }
    case '/visitorAnalysis/regional': {
      // 与 v2 一致：v2 写的是 `areaOption == 0`（route.query 里是字符串，靠 == 做宽松比较），
      // 这里用 Number() 转换后再严格比较，对 '0' / '1' 结果相同
      const areaOption = Number(route.query.areaOption)
      let regular: string[] = []
      if (areaOption === 0) {
        params.areaOption = 'Province'
        regular = ['index', 'province']
      } else if (areaOption === 1) {
        params.areaOption = 'Country'
        regular = ['index', 'country']
      }
      if (area == 'city') {
        params.areaOption = 'City'
        regular = ['index', 'city']
      }
      cols = [...cols, ...regular]
      params.cols = cols
      download(exportAreaDetailApi(params) as Promise<DownloadResponse>)
      break
    }
    case '/visitorAnalysis/equipment': {
      // 与 v2 一致：v2 注释掉了 store 里的 equipmentFlag，改读路由 query
      const id = Number(route.query.deviceOption)
      if (id === 0) {
        const regular = ['index', 'device']
        params.cols = [...cols, ...regular]
        download(exportDeviceDetailApi(params) as Promise<DownloadResponse>)
      } else if (id === 1) {
        const regular = ['index', 'os']
        params.cols = [...cols, ...regular]
        download(exportOsDetailApi(params) as Promise<DownloadResponse>)
      }
      break
    }
    case '/visitorAnalysis/sourceWeb': {
      const regular = ['index', 'sourcesite']
      cols = [...cols, ...regular]
      cols.unshift('latestReferrer')
      params.cols = cols
      download(exportSourceWebsiteDetailApi(params) as Promise<DownloadResponse>)
      break
    }
    case '/visitorAnalysis/channel': {
      const regular = ['index', 'channel']
      cols = [...cols, ...regular]
      params.cols = cols
      download(exportChannelDetailApi(params) as Promise<DownloadResponse>)
      break
    }
  }
}

function initShowTable() {
  mergedArr.value = []
  // .map(String) 只为满足类型（值本来就是字符串），与 v2 的 [...channelList, ...flowQuality] 等价
  mergedArr.value = [...channelList.value, ...flowQuality.value].map(String)
  emit('flowPoint', mergedArr.value)
}

function handelChannelList() {
  initShowTable()
}

function handelFlowQuality() {
  initShowTable()
}

// mitt 只能传一个参数，这里的负载就是 v2 `$bus.$emit("publicEventDown", this.commonData)` 的 commonData
const onPublicEventDown = (val: unknown) => publicEventDown(val as DownloadParams)
const onPublicDialogDown = (val: unknown) => publicEventDown(val as DownloadParams, 'city')
const onClearListEvent = () => clearArray()

onMounted(() => {
  initShowTable()
  // 与 v2 的差异：v2 在 $on 之前先 $off("publicEventDown")（不带 handler），
  // 那会把**其它组件**注册的同名监听一起摘掉；v3 改成只注册/注销自己的 handler 引用。
  bus.on('publicEventDown', onPublicEventDown)
  bus.on('publicDialogDown', onPublicDialogDown)
  bus.on('clearListEvent', onClearListEvent)
})

onBeforeUnmount(() => {
  bus.off('publicEventDown', onPublicEventDown)
  bus.off('publicDialogDown', onPublicDialogDown)
  bus.off('clearListEvent', onClearListEvent)
})

defineExpose({ channelList, flowQuality, clearArray, initShowTable })
</script>

<template>
  <!-- 公用流量指标 -->
  <div class="flow-indicator public_indicator">
    <div class="flow-item">
      <div class="flow-title">流量基础指标</div>
      <el-checkbox-group v-model="channelList" class="checkBoxStyle" @change="handelChannelList">
        <!-- 搜索次数占比 -->
        <el-checkbox v-if="bySite" value="pv">搜索次数</el-checkbox>
        <el-checkbox v-if="bySite" value="pvRate">搜索次数占比</el-checkbox>
        <el-checkbox v-if="!bySite" value="pv">浏览量</el-checkbox>
        <el-checkbox v-if="!bySite" value="pvRate">浏览量占比</el-checkbox>
        <el-checkbox value="visitCount">访问次数</el-checkbox>
        <el-checkbox v-if="byChannel || bySite" value="visitCountRate">访问次数占比</el-checkbox>
        <el-checkbox value="uv">访客数</el-checkbox>
        <el-checkbox v-if="byChannel && !bySite" value="uvRate">访客数占比</el-checkbox>
        <el-checkbox v-if="!byNewOldVisit || bySite" value="newUv">新访客数</el-checkbox>
        <el-checkbox v-if="!byNewOldVisit && !bySite" value="newUvRate">新访客数占比</el-checkbox>
        <el-checkbox v-if="byNewOldVisit" value="uvRate">访客数占比</el-checkbox>
        <el-checkbox value="ipCount">IP数</el-checkbox>
        <el-checkbox v-if="byChannel || bySite" value="ipCountRate" style="margin-right: 0">
          IP数占比
        </el-checkbox>
      </el-checkbox-group>
    </div>
    <!-- byNoQuality 站内搜索没有质量指标 -->
    <div v-if="!byNoQuality" class="flow-item setSpace">
      <div class="flow-title">流量质量指标</div>
      <el-checkbox-group v-model="flowQuality" class="checkBoxStyle" @change="handelFlowQuality">
        <el-checkbox value="bounceRate">跳出率</el-checkbox>
        <el-checkbox value="avgVisitTime">平均访问时长</el-checkbox>
        <el-checkbox v-if="byChannel" value="visitTimeRate">平均访问时长占比</el-checkbox>
        <el-checkbox value="avgPv">平均访问页数</el-checkbox>
        <!-- <el-checkbox v-if="byChannel" value="avgPvRate">平均访问页数占比</el-checkbox> -->
      </el-checkbox-group>
    </div>
    <div v-else style="margin-bottom: 10px" />
  </div>
</template>

<style lang="scss" scoped>
// 来源：v2 src/styles/components/el-checkbox.scss（v2 是在 ::v-deep {} 里 @import 的，
// v3 的 @use 不能出现在嵌套块内，这里直接用 :deep() 平铺）
@use '@/styles/components/el-checkbox.scss';

// 与 v2 一致：这一段在 v2 里也是包在 .chartsIcon 下的，
// .chartsIcon 来自**父组件**模板（多数用到 flowPoint 的页面外层就是 .chartsIcon），
// scoped 后编译成 `.chartsIcon .flow-indicator[data-v-x]`，仍然能命中本组件根节点。
.chartsIcon {
  box-sizing: border-box;
  margin: 20px;
  padding-top: 1px;
  min-height: 461px;
  background: #fff;
  border-radius: 6px;
  padding: 22px;

  .flow-indicator {
    margin-top: 10px;
    min-height: 58px;
    border: 1px solid #f0f0f5;
    border-radius: 6px;
    box-sizing: border-box;

    .setSpace {
      margin-bottom: 12px;
    }

    .flow-item {
      display: flex;
      margin-top: 12px;
      margin-left: 10px;

      .flow-title {
        white-space: nowrap;
        margin-right: 21px;
        font-size: 13px;
        font-weight: 400;
        line-height: 32px;
        color: #4d4d4d;
      }
    }

    .check_item {
      background-color: #ffffff;
      margin-left: 20px;
      height: 40px;
      border-radius: 4px;
      border: 1px solid #eee;
      display: flex;
      align-items: center;

      span {
        font-size: 14px;
        padding: 0 10px;
      }

      .checkBoxStyle {
        padding-right: 10px;
      }
    }
  }
}
</style>
