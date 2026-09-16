<template>
  <div>
    <customBar
      ByRefresh
      ByDayOrHour
      @setFilterBarParams="setFilterBarParams"
      @startAnalysiApi="startAnalysiApi"
    />
    <div class="public-block">
      <div class="block_online block-main public-hoverItem" style="margin-top: 20px">
        <div
          style="display: flex; justify-content: space-between; border-bottom: 1px solid gainsboro"
        >
          <div class="public-tableHead" style="width: 60%; white-space: wrap">
            {{ tagLable }}
          </div>
          <div style="display: flex">
            <el-button
              v-if="!isNoBookMark && (tagObj || isUpdateFlag)"
              class="zc_btn_default"
              style="line-height: 30px; height: 30px"
              @click="updateTag"
              >更新书签</el-button
            >
            <el-button
              v-if="!isNoBookMark && (tagObj || isUpdateFlag)"
              class="zc_btn_default"
              style="line-height: 30px; height: 30px"
              @click="addBookMark('存为新书签')"
              >存为新书签</el-button
            >
            <el-button
              v-if="isNoBookMark || (!isUpdateFlag && !tagObj)"
              class="zc_btn_default"
              style="line-height: 30px; height: 30px; margin-left: 20px"
              @click="addBookMark('保存书签')"
              >保存书签</el-button
            >
          </div>
        </div>
        <div style="margin: 10px 0; font-size: 14px">事件分析指标筛选</div>
        <div class="new-rule-form" style="margin-top: 30px">
          <create-rule
            ref="createRuleRef"
            @customListEvent="customListEvent"
            @customLoading="customLoading"
            @addTagStore="addTagStore"
            @bookmarkRefresh="bookmarkRefresh"
          />
        </div>
      </div>
    </div>
    <!-- 数据变化趋势图 -->
    <div v-if="resultList" ref="chartContent" class="public-block">
      <div class="block_online block-main public-hoverItem" style="margin-top: 20px">
        <div class="public-tableHead">趋势图</div>
        <customEchart ref="customEchartRef" v-loading="loading" @startAnalysiApi="startAnalysiApi" />
      </div>
    </div>
    <!-- 分析结果 -->
    <div v-if="resultList" class="public-block">
      <div class="block_online block-main public-hoverItem" style="margin-top: 20px">
        <div class="public-tableHead" style="display: flex; justify-content: space-between">
          分析结果
        </div>
        <customTable ref="customTableRef" v-loading="loading" />
      </div>
    </div>
    <bookmarkDialog ref="bookmarkDialogRef" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { copyObj } from '@/utils/copy'
import { bus } from '@/utils/event-bus'
import { CUSTOM_ANALYSIS_PATH } from '@/router/paths'
import { useTrackingStore } from '@/stores/tracking'
import customBar from './components/customBar.vue'
import CreateRule from './components/index.vue'
import customEchart from './components/customEchart.vue'
import customTable from './components/customTable.vue'
import bookmarkDialog from './components/bookmarkDialog.vue'
import type { BookmarkTag, CustomFilterBarParams, ModelObject, ResultDetail } from './types'

defineOptions({ name: 'NewRuleForm' })

const route = useRoute()
const router = useRouter()
const trackingStore = useTrackingStore()
const projectName = computed(() => trackingStore.projectName)

const tagLable = ref('事件分析')
const isUpdateFlag = ref(false)
const filterBarParams = ref<CustomFilterBarParams | null>(null)
/** v2 的 loading 可能被赋成 'clearnData'（字符串同样是 truthy），这里保持一致 */
const loading = ref<boolean | string>(false)
const tagObj = ref<BookmarkTag | null>(null)
const resultList = ref<ResultDetail | null>(null)
/** 用户是否有书签  true:无书签 false:有书签 */
const isNoBookMark = ref(false)

const createRuleRef = ref<InstanceType<typeof CreateRule> | null>(null)
const customEchartRef = ref<InstanceType<typeof customEchart> | null>(null)
const customTableRef = ref<InstanceType<typeof customTable> | null>(null)
const bookmarkDialogRef = ref<InstanceType<typeof bookmarkDialog> | null>(null)
const chartContent = ref<HTMLDivElement | null>(null)
/** 分析完成后滚动到趋势图的定时器，卸载时要清 */
let scrollTimer: ReturnType<typeof setTimeout> | null = null

// v2 还有一个 computed commonParams（projectName + filterBarParams）和一个空实现的
// watch commonParams(val) {}，两者都没有任何副作用，迁移时省略。

function readTagObjFromRoute() {
  if (route.query.tagObj) {
    tagObj.value = JSON.parse(route.query.tagObj as string) as BookmarkTag
    if (tagObj.value.name) {
      tagLable.value = tagObj.value.name
    }
  }
}

/**
 * 更新之后修改标签名。
 * v2 的负载是 $bus.$emit('$tagIsUpdate', res, obj)，mitt 只能传一个参数，
 * 改写成 { flag, obj }：flag 对应原来的第一个实参 res，obj 对应第二个实参。
 */
const onTagIsUpdate = (payload: unknown) => {
  const { flag, obj } = payload as { flag: boolean; obj: { query: string; tagObj: string } }
  isUpdateFlag.value = flag
  isNoBookMark.value = false
  void router.push({
    path: CUSTOM_ANALYSIS_PATH,
    query: {
      query: obj.query,
      tagObj: obj.tagObj,
    },
  })
  // 与 v2 一致（v2 此处逻辑存疑：push 还没落地就读 this.$route.query.tagObj，
  // 读到的其实是跳转前的旧值；新建书签时这里读不到任何值，标题不会立刻刷新）
  readTagObjFromRoute()
}

onMounted(() => {
  bus.on('$tagIsUpdate', onTagIsUpdate)
  // 初始加載标签名
  readTagObjFromRoute()
})

onBeforeUnmount(() => {
  bus.off('$tagIsUpdate', onTagIsUpdate)
  if (scrollTimer) clearTimeout(scrollTimer)
  scrollTimer = null
})

/** 当前用户未拥有该书签，可进行分享查看调用操作 */
function bookmarkRefresh() {
  isNoBookMark.value = true
  startAnalysiApi('refresh')
}

/** 添加新书签立即存储模式 */
function addBookMark(label: string) {
  createRuleRef.value?.addTagEvent(label)
}

function addTagStore(model: ModelObject, flag: string) {
  if (flag == '更新书签') {
    if (route.query.tagObj) {
      tagObj.value = JSON.parse(route.query.tagObj as string) as BookmarkTag
    }
    // 与 v2 一致：tagObj 为空时也照样打开弹窗（v2 传的是空串）
    bookmarkDialogRef.value?.openDialog(flag, tagObj.value, model)
  } else {
    bookmarkDialogRef.value?.openDialog(flag, model)
  }
}

function updateTag() {
  createRuleRef.value?.addTagEvent('更新书签')
}

function customListEvent(val: ResultDetail, modelObject: ModelObject) {
  resultList.value = val
  void nextTick(() => {
    if (resultList.value) {
      customEchartRef.value?.initEchartEvent(val)
      customTableRef.value?.initTableEvent(val, modelObject)
      // 分析后的跳转事件
      scrollTimer = setTimeout(() => {
        const divTop = chartContent.value
        if (!divTop) return
        const offsetTop = divTop.getBoundingClientRect().top + window.scrollY
        // 与 v2 一致：v2 注释掉了 -255 那一行，用的是 -245
        window.scrollTo(0, offsetTop - 245)
      }, 500)
    }
  })
}

function customLoading(flag: boolean | string) {
  if (flag == 'clearnData') {
    resultList.value = null
  }
  loading.value = flag
}

function startAnalysiApi(isRefresh?: string) {
  const isBookMark = route.query.isBookMark
  if (isBookMark) {
    createRuleRef.value?.startAnalysis()
  } else if (isRefresh == 'refresh') {
    createRuleRef.value?.startAnalysis()
  }
}

function setFilterBarParams(val: CustomFilterBarParams) {
  const params = copyObj(val)
  params.projectName = projectName.value
  filterBarParams.value = params
  createRuleRef.value?.customInitEvent(params)
}
</script>

<style scoped lang="scss"></style>
