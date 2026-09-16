<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import AnalysisChart from './analysis-chart.vue'
import DataOverview from './data-overview.vue'
import VisitHistory from './visit-history.vue'
import BehaviorSequence from './behavior-sequence.vue'
import type { AnalysisCache, SequenceCache, UserBaseInfo, VisitHistoryCache } from '../types'

const props = withDefaults(
  defineProps<{
    userBaseInfo?: UserBaseInfo
    projectName?: string | null
    userId?: string | null
  }>(),
  { userBaseInfo: () => ({}), projectName: null, userId: null },
)

const emit = defineEmits<{ (e: 'tab-change', tab: string): void }>()

const route = useRoute()

const userInfoLoading = ref(false)
const activeTab = ref('user-portrait')
// const activeTab = ref("b-analysis");
const sequenceCache = ref<SequenceCache | null>(null)
const analysisCache = ref<AnalysisCache | null>(null)
const visitHistoryCache = ref<VisitHistoryCache | null>(null)

watch(
  () => props.userId,
  (newVal, oldVal) => {
    if (newVal !== oldVal) {
      sequenceCache.value = null
      analysisCache.value = null
      visitHistoryCache.value = null
    }
  },
)

/**
 * v2 用的是 el-tabs 的 :value + @tab-click，点击时自己把 activeTab 赋上。
 * v3 换成 v-model + @tab-change：element-plus 的 tab-click 回调参数是 TabsPaneContext，
 * 拿名字要走 pane.paneName，而这里只需要「切到哪个 tab」，tab-change 直接给的就是它。
 */
function onTabChange(name: string | number) {
  const routeQuery = route.query
  activeTab.value = String(name)
  emit('tab-change', activeTab.value)

  if (!routeQuery.userId) {
    ElMessage.error('缺少用户ID，无法加载画像')
    return
  }
  if (!routeQuery.projectName) {
    ElMessage.error('缺少项目名称，无法加载画像')
    return
  }
}

onMounted(() => {
  if (typeof route.query.tabType === 'string' && route.query.tabType) {
    activeTab.value = route.query.tabType
  }
  emit('tab-change', activeTab.value)
})
</script>

<template>
  <div class="tab-content-item">
    <el-tabs v-model="activeTab" @tab-change="onTabChange">
      <el-tab-pane
        :label="activeTab === 'user-portrait' ? '用户画像' : '用户信息'"
        name="user-portrait"
      />
      <el-tab-pane label="访问概览" name="data-overview" />
      <el-tab-pane label="浏览历史" name="visit-history" />
      <el-tab-pane label="行为轨迹" name="b-sequence" />
      <el-tab-pane label="行为分析" name="b-analysis" />
    </el-tabs>
    <div class="tab-content">
      <slot v-if="activeTab === 'user-portrait'" name="user-portrait" />
      <!-- 数据概览 -->
      <data-overview
        v-if="activeTab === 'data-overview' && props.userBaseInfo"
        :key="props.userId || ''"
        :user-base-info="props.userBaseInfo"
        :user-info-loading="userInfoLoading"
        :project-name="props.projectName"
        :user-id="props.userId"
      />
      <!-- 访问历史 -->
      <visit-history
        v-if="activeTab === 'visit-history'"
        :key="props.userId || ''"
        :project-name="props.projectName"
        :user-id="props.userId"
        :cache-data="visitHistoryCache"
        @update-cache="visitHistoryCache = $event"
      />
      <!-- 行为序列 -->
      <behavior-sequence
        v-if="activeTab === 'b-sequence'"
        :key="props.userId || ''"
        :project-name="props.projectName"
        :user-id="props.userId"
        :cache-data="sequenceCache"
        @update-cache="sequenceCache = $event"
      />
      <!-- 行为分析 -->
      <analysis-chart
        v-if="activeTab === 'b-analysis'"
        :key="props.userId || ''"
        :project-name="props.projectName"
        :user-id="props.userId"
        :cache-data="analysisCache"
        @update-cache="analysisCache = $event"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
:deep(.el-tabs__item) {
  font-size: 14px;
  font-weight: bold !important;
}

:deep(.el-tabs__header) {
  padding: 0 15px;
  background: #fff;
  border-radius: 6px;
  margin: 0 !important;
  // margin-bottom: 20px !important;
}

:deep(.el-tabs__nav-wrap::after) {
  background: #fff;
}

.tab-content {
  box-sizing: border-box;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.tab-content > * {
  flex: 1;
  min-height: 0;
}

.common-title {
  font-size: 14px;
  font-weight: 600;
  line-height: 31px;
  color: #4d4d4d !important;
}

.tab-content-item {
  display: flex;
  flex-direction: column;
  width: 100%;
  box-sizing: border-box;
  min-height: 0;
  flex: 1;
}
</style>
