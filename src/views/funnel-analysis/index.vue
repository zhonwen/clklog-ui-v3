<template>
  <div>
    <customBar
      ref="customBarRef"
      ByRefresh
      ByDayOrHour
      @setFilterBarParams="setFilterBarParams"
      @startAnalysiApi="startAnalysiApi"
    />
    <div class="public-block">
      <div
        class="block_online block-main public-hoverItem"
        style="overflow: none !important"
      >
        <funnelModel
          ref="funnelModelRef"
          @modelDataList="modelDataList"
          @lodingEvents="lodingEvents"
          @updataPercent="updataPercent"
        />
      </div>
    </div>
    <!-- 图表 -->
    <div class="custom_lodaing">
      <!-- v2 还写了 element-loading-spinner="el-icon-loading"，element-plus 的
           loading 指令不再认这种字符串图标类名，去掉后走默认转圈 -->
      <div
        ref="chartContent"
        v-loading="isLoading"
        class="public-block"
        :element-loading-text="loadingText"
      >
        <div v-if="isLoading" class="block_online block-main public-hoverItem">
          <div style="height: 300px"></div>
        </div>

        <div v-if="!isLoading && resDataList" class="block_online block-main public-hoverItem">
          <chartModel ref="chartModelRef" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { copyObj } from '@/utils/copy'
import { bus } from '@/utils/event-bus'
import { useTrackingStore } from '@/stores/tracking'
import customBar from '../analysis-modules/custom-analysis/components/customBar.vue'
import funnelModel from './components/funnelModel.vue'
import chartModel from './components/chartModel.vue'
import type { CustomFilterBarParams } from '../analysis-modules/custom-analysis/types'
import type { FunnelModelObject, FunnelResult } from './types'

/**
 * 漏斗分析页。
 * 与 v2 的 src/views/funnel-analysis/index.vue 一一对应。
 */
defineOptions({ name: 'funnelAnalysis' })

const route = useRoute()
const trackingStore = useTrackingStore()

const loadingText = ref('查询中')
const filterBarParams = ref<CustomFilterBarParams | null>(null)
const isLoading = ref(false)
const resDataList = ref<FunnelResult[] | ''>('')

const customBarRef = ref<InstanceType<typeof customBar> | null>(null)
const funnelModelRef = ref<InstanceType<typeof funnelModel> | null>(null)
const chartModelRef = ref<InstanceType<typeof chartModel> | null>(null)
const chartContent = ref<HTMLDivElement | null>(null)

/** 分析完成后滚动到图表的定时器，卸载时要清 */
let scrollTimer: ReturnType<typeof setTimeout> | null = null

/**
 * 与 v2 一致：v2 是在 computed projectName 里顺手 $bus.$emit('$CHECKPROJECT', ...) 的
 * （computed 里带副作用），这里把取值和副作用拆开：computed 只取值，emit 交给 watch，
 * 触发时机（路由 query.query 变化）与 v2 相同。
 */
const projectName = computed(() => {
  if (route.query.query) {
    const query = JSON.parse(route.query.query as string) as FunnelModelObject
    return query.projectName
  }
  return trackingStore.projectName
})

watch(
  () => route.query.query,
  (val) => {
    if (val) {
      const query = JSON.parse(val as string) as FunnelModelObject
      bus.emit('$CHECKPROJECT', query.projectName)
    }
  },
  { immediate: true },
)

const commonParams = computed(() => Object.assign({ projectName: projectName.value }, filterBarParams.value))

watch(
  commonParams,
  (newVal, oldVal) => {
    if (JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
      funnelModelRef.value?.modelListEvent(newVal as CustomFilterBarParams)
    }
  },
  { deep: false, immediate: false },
)

/** v2 的形参是 (seconds, percent)，percent 在函数体里没有被使用 */
function updataPercent(seconds: number) {
  if (seconds >= 0) {
    loadingText.value = '查询中 已耗时：' + seconds + 's'
  } else if (seconds == -1) {
    loadingText.value = '查询中'
  }
}

function modelDataList(res: FunnelResult | '', modelList: FunnelModelObject) {
  if (res) {
    resDataList.value = [res]
  } else {
    resDataList.value = ''
    return
  }
  void nextTick(() => {
    chartModelRef.value?.modelListEvent(res, modelList)
    if (resDataList.value) {
      scrollTimer = setTimeout(() => {
        const divTop = chartContent.value
        if (!divTop) return
        const offsetTop = divTop.getBoundingClientRect().top + window.scrollY
        window.scrollTo(0, offsetTop - 245)
      }, 200)
    }
  })
}

function lodingEvents(res: boolean) {
  isLoading.value = res
}

function setFilterBarParams(val: CustomFilterBarParams) {
  filterBarParams.value = copyObj(val)
}

function startAnalysiApi(isRefresh?: string) {
  // 增加只有来自于书签页才允许请求接口模型 || 刷新事件
  const isBookMark = route.query.isBookMark
  if (isBookMark) {
    funnelModelRef.value?.routeUrlInitAnalysis()
  } else if (isRefresh == 'refresh') {
    funnelModelRef.value?.handleRefreshApi()
  }
}

onBeforeUnmount(() => {
  if (scrollTimer) clearTimeout(scrollTimer)
  scrollTimer = null
})
</script>

<style lang="scss" scoped>
.custom_lodaing :deep(.el-loading-mask) {
  border-radius: 6px;
}
</style>
