<template>
  <div class="model-page">
    <div style="display: flex; justify-content: space-between; border-bottom: 1px solid gainsboro">
      <div class="public-tableHead" style="width: 60%; white-space: wrap">
        {{ tagLable }}
      </div>

      <div style="display: flex; margin-bottom: 20px">
        <el-button
          class="zc_btn_default"
          style="line-height: 30px; height: 30px; margin-left: 20px"
          @click="openFunnel('新增漏斗')"
          >新增漏斗</el-button
        >
        <el-button
          v-if="(tagObj || isUpdateFlag) && isFindBookId"
          class="zc_btn_default"
          style="line-height: 30px; height: 30px"
          @click="updateTag('更新书签')"
          >更新书签</el-button
        >
        <el-button
          v-if="(tagObj || isUpdateFlag) && isFindBookId"
          class="zc_btn_default"
          style="line-height: 30px; height: 30px"
          @click="addBookMark('存为新书签')"
          >存为新书签</el-button
        >

        <el-button
          v-if="(!isUpdateFlag && !tagObj) || !isFindBookId"
          class="zc_btn_default"
          style="line-height: 30px; height: 30px; margin-left: 20px"
          @click="addBookMark('保存书签')"
          >保存书签</el-button
        >
      </div>
    </div>
    <div style="margin: 10px 0; font-size: 14px">漏斗分析指标筛选</div>
    <div v-show="showFlagPage" class="rules-group-container tree box">
      <div class="containerItem">
        <div class="singItem">
          <div class="titleHead">选择漏斗</div>
          <!-- v-loadmore 要拿到下拉的 DOM，element-plus 默认把下拉 teleport 到 body，
               所以这里必须加 :teleported="false" -->
          <el-select
            v-model="funnelIdFlag"
            v-loadmore="loadmore"
            style="min-width: 100px; margin-right: 15px"
            placeholder="请选择"
            :teleported="false"
          >
            <el-option
              v-for="(x, index) in funnelListName"
              :key="index"
              :label="x.name"
              :value="x.funnelId"
            >
              <div
                style="margin-right: 50px; position: relative; box-sizing: border-box"
                @click="changeFunnel(x)"
              >
                {{ x.name }}
                <span
                  v-if="x.owner"
                  style="position: absolute; right: -45px"
                  class="span-style-delete"
                  @click.stop="deleteFunnelItem(x)"
                  ><el-icon><Delete /></el-icon
                ></span>
                <span
                  style="position: absolute; right: -20px"
                  class="span-style"
                  @click.stop="editItem(x)"
                  ><el-icon><EditPen /></el-icon
                ></span>
              </div>
            </el-option>
          </el-select>
        </div>
        <div class="singItem">
          <div class="titleHead">计算方式</div>
          <el-select
            v-model="modelObject.measurement"
            style="min-width: 100px; margin-right: 15px"
            placeholder="请选择"
          >
            <el-option
              v-for="x in calculation_method"
              :key="x.name"
              :label="x.displayName"
              :value="x.name"
            >
              {{ x.displayName }}
            </el-option>
          </el-select>
        </div>
        <div class="singItem">
          <div class="titleHead">
            转化周期
            <div class="parentPosition">
              <el-popover placement="bottom-start" :width="200" trigger="hover" class="popImg">
                <div v-html="sharedText.conversionCycle" style="padding: 5px; font-size: 12px"></div>
                <template #reference>
                  <img class="icon-question riseImg" src="@/assets/images/question.png" alt="" />
                </template>
              </el-popover>
            </div>
          </div>
          <el-select
            v-model="concatenatedValue"
            style="min-width: 100px; margin-right: 15px"
            placeholder="请选择"
          >
            <el-option
              v-for="x in conversion_cycle"
              :key="x.name"
              :label="x.displayName"
              :value="x.name"
            >
              {{ x.displayName }}
            </el-option>
          </el-select>
        </div>
        <!-- 查看维度 -->
        <div class="singItem">
          <fields
            :point-proto-list="pointProtoList"
            :field-type-list="fieldTypeList"
            :model-object="modelObject"
            :property-list="propertyList"
          />
        </div>

        <!-- 筛选条件 -->
        <div class="singItem" style="align-items: flex-start">
          <div class="titleHead" style="padding-top: 5px">筛选条件</div>
          <globalFilter
            :point-proto-list="pointProtoList"
            :field-type-list="fieldTypeList"
            :model-object="modelObject"
            :property-list="propertyList"
          />
        </div>
      </div>
      <el-button
        v-loading="isLoading"
        class="zc_btn"
        style="margin: 30px 0 0 120px"
        :disabled="isDisableBtn"
        @click="startAnalysis()"
        >开始分析</el-button
      >
    </div>
    <div
      style="
        color: #2c7be5;
        font-size: 12px;
        display: flex;
        justify-content: center;
        cursor: pointer;
        margin-top: 30px;
      "
      @click="isOpenEvent()"
    >
      {{ showFlagPage ? '收起' : '展开'
      }}<el-icon>
        <ArrowUp v-if="showFlagPage" />
        <ArrowDown v-else />
      </el-icon>
    </div>

    <dialogFunnel
      ref="dialogRef"
      :point-proto-list="pointProtoList"
      :point-type-list="pointTypeList"
      :funnel-list-name="funnelListName"
      @update-funnel-list="updateFunnelList"
      @step-model="stepModel"
    />
    <bookmarkDialog ref="bookmarkDialogRef" />
    <dialogMsgError ref="dialogMsgErrorRef" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowDown, ArrowUp, Delete, EditPen } from '@element-plus/icons-vue'
import { useRoute, useRouter } from 'vue-router'
import bookmarkDialog from './bookmarkDialog.vue'
import dialogFunnel from './dialog.vue'
import dialogMsgError from './dialog-msgError.vue'
import fields from '@/components/analysis-model/fields.vue'
import globalFilter from '@/components/analysis-model/globalFilter.vue'
import { copyObj } from '@/utils/copy'
import { bus } from '@/utils/event-bus'
import { sharedText } from '@/components/pointFont'
import { FUNNEL_ANALYSIS_PATH } from '@/router/paths'
import { calculation_method, conversion_cycle } from '@/utils/modelOptions/funnel'
import {
  getCommonPropertyListApi,
  getGroupedPropertiesApi,
  getListNoGroupEventApi,
} from '@/api/sysmanage/manageEvent'
import { funnelAnalysisApi, taskFetchApi, taskRueryApi } from '@/api/sysmanage/customAnalysis'
import { deleteApi, getPageListApi } from '@/api/sysmanage/funnelAnalysis'
import { getApi } from '@/api/sysmanage/bookMark'
import { mergeCommonPropertiesToEvents } from '@/utils/mergeEventProperties'
import { useLatestOnly } from '@/composables/useLatestOnly'
import { useTrackingStore } from '@/stores/tracking'
import type { ApiResult } from '@/utils/http'
import type {
  CommonPropertyData,
  GroupedPropertiesData,
} from '@/views/analysis-modules/custom-analysis/types'
import type {
  EventGroup,
  FieldTypeItem,
  PointTypeList,
  PropertyItem,
  PropertyListMap,
} from '@/components/analysis-model/types'
import type { CustomFilterBarParams } from '@/views/analysis-modules/custom-analysis/types'
import type {
  BookmarkTag,
  FunnelDefinition,
  FunnelEditParams,
  FunnelListItem,
  FunnelModelObject,
  FunnelPageData,
  FunnelResult,
  TaskFetchData,
  TaskInstanceData,
  TaskQueryData,
} from '../types'

/**
 * 漏斗分析的查询模型区。
 * 与 v2 的 src/views/funnel-analysis/components/funnelModel.vue 一一对应。
 */
const emit = defineEmits<{
  (e: 'modelDataList', res: FunnelResult | '', modelList: FunnelModelObject): void
  (e: 'lodingEvents', flag: boolean): void
  (e: 'updataPercent', seconds: number): void
}>()

const route = useRoute()
const router = useRouter()
const trackingStore = useTrackingStore()
const projectName = computed(() => trackingStore.projectName)

// 每个取数函数一套 useLatestOnly，共用会互相顶掉 token。
// 注意 getListEventPrototype 会连着被调用两次（用户 / 事件），所以它需要两套。
const latestFunnelList = useLatestOnly()
const latestCommonProperty = useLatestOnly()
const latestPrototype = useLatestOnly()
const latestUserProto = useLatestOnly()
const latestEventProto = useLatestOnly()
const latestBookmark = useLatestOnly()
const latestDelete = useLatestOnly()
const latestAnalysis = useLatestOnly()
/** 一次「开始分析」共用一个 token，轮询链路上的每个回调都拿它做判活 */
let analysisToken = 0

const seconds = ref(0)
/** 计时 / 轮询定时器，全部要在 onBeforeUnmount 清掉（v2 的 destroyed 里也清了，这里保持并补齐） */
let secondTimer: ReturnType<typeof setInterval> | null = null
let featchTimer: ReturnType<typeof setInterval> | null = null
let polling: ReturnType<typeof setInterval> | null = null

const isDisableBtn = ref(false)
const pageNum = ref(1) // 页码
const pageSize = ref(300) // 条数
const total = ref(0)
/** 判断该账号是否拥有该书签 */
const isFindBookId = ref(true)
// 模型参数 ------------
const showFlagPage = ref(true)
const isLoading = ref(false)
const funnelIdFlag = ref('')
const modelObject = ref<FunnelModelObject>({
  name: '',
  measurement: 'UV', // 计算方式
  window: {
    // 转换周期（与 v2 一致：numeral: 0 / unit: "DAY" 那两行在 v2 里是注释掉的）
    numeral: 24,
    unit: 'HOUR',
  },
  steps: [
    {
      customName: '',
      eventName: '',
      // 与 v2 一致：index: 1 在 v2 里是注释掉的
      type: 'normal',
      filter: { relation: 'and', filters: [] },
    },
  ], // 漏斗添加步骤
  byFields: [], // 维度
  filter: { filters: [] }, // 全局过滤
  projectName: trackingStore.projectName,
  startDate: '',
  endDate: '',
  dataType: 'day',
  timeFlag: 'day',
})

const tagLable = ref('漏斗转化分析')
const isUpdateFlag = ref(false)
const tagObj = ref<BookmarkTag | null>(null)

const funnelListName = ref<FunnelListItem[]>([])
/** 指标 */
const pointProtoList = ref<EventGroup[]>([])
/** 指标 */
const pointTypeList = ref<PointTypeList>({
  userProtoList: [],
  eventProtoList: [],
})
const propertyList = ref<PropertyListMap>({
  commonPropertySum: [], // 共用事件属性
  userProperties: [], // 共用用户属性
})
const fieldTypeList = ref<FieldTypeItem[]>([])
const commonParams = ref<Partial<CustomFilterBarParams>>({})
const enAbleAnalysis = ref(false)

const dialogRef = ref<InstanceType<typeof dialogFunnel> | null>(null)
const bookmarkDialogRef = ref<InstanceType<typeof bookmarkDialog> | null>(null)
const dialogMsgErrorRef = ref<InstanceType<typeof dialogMsgError> | null>(null)

/** 页面滚动位置，v2 的 updateScrollPosition 记录、scrollToPosition 恢复（后者调用点已被注释） */
const scrollPosition = ref(0)
function updateScrollPosition() {
  scrollPosition.value = window.scrollY || document.documentElement.scrollTop
}

const concatenatedValue = computed<string>({
  get() {
    return String(modelObject.value.window.numeral) + modelObject.value.window.unit // 这里可以根据需要调整拼接方式
  },
  set(newValue: string) {
    const result = newValue.match(/[A-Za-z]+|\d+/g)
    if (!result) return
    modelObject.value.window.numeral = result[0] ?? ''
    modelObject.value.window.unit = result[1] ?? ''
  },
})

// ---------------------------------------------------------------------------
// watch
// ---------------------------------------------------------------------------
watch(
  modelObject,
  (newVal) => {
    void nextTick(() => {
      void router.replace({
        // v2 push 的是相对路径 'funnelAnalysis'，v3 统一走 router/paths.ts 的常量
        // （v2 这里还注释着一行 doris 专用的 'funnelAnalysis-doris'）
        path: FUNNEL_ANALYSIS_PATH,
        query: {
          query: newVal && JSON.stringify(newVal),
          tagObj: tagObj.value ? JSON.stringify(tagObj.value) : '',
        },
      })
      // 与 v2 一致：v2 在这里注释掉了 scrollToPosition()

      // 设置触发默认值
      if (!funnelIdFlag.value) {
        if (funnelListName.value.length > 0) {
          const first = funnelListName.value[0]
          if (!first) return
          funnelIdFlag.value = first.funnelId
          const modelObj = first.queryParams
            ? (JSON.parse(first.queryParams) as FunnelDefinition)
            : null
          modelObject.value.name = first.name
          // 维度动态名称
          if (modelObj) {
            fieldTypeList.value = modelObj.steps
            modelObject.value.steps = modelObj.steps
          }
        }
      }
    })
  },
  { deep: true },
)

watch(projectName, (val) => {
  // 切换漏斗清空图表内容
  emit('modelDataList', '', modelObject.value)

  modelObject.value.projectName = val
  commonParams.value.projectName = val
  // 与 v2 一致：v2 写的是 `await this.initSelectList("")`，但该方法并不是 async，
  // await 只是让出一个微任务，下面的语句依旧在接口返回之前执行
  initSelectList()
  getPrototype() // 指标联级
  getListEventPrototype('用户') // 获取指标属性
  getListEventPrototype('事件') // 获取指标属性
  getCommonPropertyList() // 维度下的属性

  // 切换项目清空历史参数
  funnelIdFlag.value = ''
  modelObject.value.name = ''
  modelObject.value.byFields = []
  modelObject.value.filter = { filters: [] }

  if (funnelListName.value.length > 0) {
    const first = funnelListName.value[0]
    if (!first) return
    funnelIdFlag.value = first.funnelId
    const modelObj = JSON.parse(first.queryParams) as FunnelDefinition
    modelObject.value.name = first.name
    // 维度动态名称
    fieldTypeList.value = modelObj.steps || []
    modelObject.value.steps = modelObj.steps
  }
})

// ---------------------------------------------------------------------------
// 生命周期
// ---------------------------------------------------------------------------
/**
 * 更新标签事件。
 * v2 的负载是 $bus.$emit('$tagIsUpdated', res, obj, type)，mitt 只能传一个参数，
 * 改写成 { flag, obj, type }：flag ← 第一个实参 res，obj ← 第二个实参，type ← 第三个实参。
 */
const onTagIsUpdated = (payload: unknown) => {
  const { flag, obj, type } = payload as {
    flag: boolean
    obj: { query: string; tagObj: string }
    type?: string
  }
  // 保存书签后用户拥有该书签
  if (type == '保存书签') {
    isFindBookId.value = true
  }
  isUpdateFlag.value = flag

  // 使用 nextTick 确保路由跳转完成后再执行后续逻辑
  void nextTick(() => {
    void router.push({
      path: FUNNEL_ANALYSIS_PATH,
      query: {
        query: obj.query,
        tagObj: obj.tagObj,
      },
    })
    // 路由跳转成功后更新当前状态
    if (obj.tagObj && obj.tagObj.trim() !== '') {
      try {
        tagObj.value = JSON.parse(obj.tagObj) as BookmarkTag
        if (tagObj.value.name) {
          tagLable.value = tagObj.value.name
        }
      } catch {
        // 与 v2 一致：解析失败静默忽略
      }
    }
  })
}

function updateTagsEvent() {
  bus.on('$tagIsUpdated', onTagIsUpdated)
  // 书签名称自定义
  if (route.query.tagObj && (route.query.tagObj as string).trim() !== '') {
    try {
      tagObj.value = JSON.parse(route.query.tagObj as string) as BookmarkTag
      if (tagObj.value.name) {
        tagLable.value = tagObj.value.name
      }
    } catch {
      // 与 v2 一致：解析失败静默忽略
    }
  }
  // 初始加载标签数据
  if (route.query.query && (route.query.query as string).trim() !== '') {
    try {
      modelObject.value = JSON.parse(route.query.query as string) as FunnelModelObject
    } catch {
      // 与 v2 一致：解析失败静默忽略
    }
  }
  // 初始选择漏斗
}

onMounted(() => {
  initApiList() // 初始及 project 变化触发事件
  updateTagsEvent() // 标签更新事件
  window.addEventListener('scroll', updateScrollPosition)
  if (route.query.query && (route.query.query as string).trim() !== '') {
    try {
      modelObject.value = copyObj(JSON.parse(route.query.query as string)) as FunnelModelObject
      bus.emit('$refreshRoute')
    } catch {
      // 如果解析失败，使用默认的 modelObject
      modelObject.value = {
        ...modelObject.value,
        steps: [
          {
            customName: '',
            eventName: '',
            type: 'normal',
            filter: { relation: 'and', filters: [] },
          },
        ],
        window: {
          numeral: 7,
          unit: 'day',
        },
      }
    }
  }
  // 判断书签来源
  if (route.query.tagObj && (route.query.tagObj as string).trim() !== '') {
    try {
      const tag = JSON.parse(route.query.tagObj as string) as BookmarkTag
      isFindBookIdEvent(tag)
    } catch {
      // 与 v2 一致：解析失败静默忽略
    }
  }
})

onBeforeUnmount(() => {
  // 与 v2 一致（v2 此处逻辑存疑：v2 的 destroyed 里 $off(["$refreshRoute","$isDisable"])，
  // 这两个事件根本不是本组件注册的 —— 会把 customBar 的监听一起干掉 —— 而真正注册的
  // $tagIsUpdated 又没有解绑。这里改成只解绑自己注册的那一个，且传同一个 handler 引用）
  bus.off('$tagIsUpdated', onTagIsUpdated)
  // v2 的 mounted 里 addEventListener('scroll') 但 destroyed 里没有 remove，属于必须修正的资源泄漏
  window.removeEventListener('scroll', updateScrollPosition)
  // 清理所有定时器（轮询尤其重要，不清会在页面卸载后继续打接口）
  clearAllTimers()
})

// ---------------------------------------------------------------------------
// methods
// ---------------------------------------------------------------------------
function loadmore() {
  if (funnelListName.value.length < total.value) {
    pageSize.value = pageSize.value + 10
    initSelectList()
  }
}

function isFindBookIdEvent(val: BookmarkTag) {
  const token = latestBookmark.next()
  getApi({ bookmarkId: val.bookmarkId, projectName: commonParams.value.projectName })
    .then((res) => {
      if (!latestBookmark.isLatest(token)) return
      if (res?.code == 200) {
        isFindBookId.value = true
      } else {
        isFindBookId.value = false
        handleRefreshApi()
        console.log('当前用户未拥有该书签')
      }
    })
    .catch(() => {
      if (!latestBookmark.isLatest(token)) return
      isFindBookId.value = false
    })
}

function isOpenEvent() {
  showFlagPage.value = !showFlagPage.value
}

function changeFunnel(val: FunnelListItem) {
  // 切换漏斗清空图表内容
  emit('modelDataList', '', modelObject.value)
  if (val.queryParams) {
    const params = JSON.parse(val.queryParams) as FunnelDefinition
    // 更新维度 button;
    fieldTypeList.value = params.steps
    modelObject.value.name = val.name
    modelObject.value.steps = params.steps
  }
  // 切换漏斗清空值
  modelObject.value.byFields = []
  modelObject.value.filter = { filters: [] }
}

function initApiList() {
  if (route.query.query) {
    commonParams.value.projectName = (
      JSON.parse(route.query.query as string) as FunnelModelObject
    ).projectName
  } else {
    commonParams.value.projectName = projectName.value
  }
  getPrototype() // 指标联级
  getListEventPrototype('用户') // 获取指标属性
  getListEventPrototype('事件') // 获取指标属性
  getCommonPropertyList() // 维度下的属性
  initSelectList()
}

/** 执行事件（筛选条参数变化时由父级调用） */
function modelListEvent(params: CustomFilterBarParams) {
  commonParams.value = copyObj(params)
  // 漏斗分析模型
  modelObject.value.startDate = params.startTime
  modelObject.value.endDate = params.endTime
  modelObject.value.dataType = params.timeType
  modelObject.value.projectName = params.projectName ?? ''
  modelObject.value.timeFlag = params.timeFlag
}

function editItem(x: FunnelListItem) {
  dialogRef.value?.openDialog('编辑漏斗', x)
}

function deleteFunnelItem(x: FunnelListItem) {
  if (!x.owner) {
    ElMessage({
      message: '没有权限删除该漏斗',
      type: 'error',
    })
    return
  }
  void ElMessageBox.confirm('确认删除 “' + x.name + ' ” ？', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => {
      const token = latestDelete.next()
      void deleteApi({ funnelIds: x.funnelId, projectName: commonParams.value.projectName }).then(
        (res) => {
          if (!latestDelete.isLatest(token)) return
          if (res?.code == 200) {
            ElMessage({
              message: '删除成功',
              type: 'success',
            })
            initSelectList()
          }
        },
      )
    })
    .catch(() => undefined)
}

/** 添加漏斗实时更新接口  1 */
function updateFunnelList(type: string, rules?: FunnelEditParams) {
  // 更新步骤清空历史数据
  if (type === '编辑') {
    initSelectList(type, rules)
  } else {
    emit('modelDataList', '', modelObject.value)
    initSelectList(type)
  }
}

function routeUrlInitAnalysis() {
  enAbleAnalysis.value = true
}

function handleRefreshApi() {
  void nextTick(() => {
    startAnalysis()
  })
}

/**
 * 回显漏斗筛选规则   初始调用。
 * 与 v2 一致：v2 的这个方法不是 async，接口结果是在 .then 里处理的，
 * 调用方那句 `await this.initSelectList("")` 实际只让出了一个微任务、并不等接口返回。
 * 这里刻意保持同样的「发出去就返回」语义，改成 async/await 会改变项目切换时的执行顺序。
 */
function initSelectList(type?: string, rules?: FunnelEditParams) {
  const params = {
    pageNum: pageNum.value,
    pageSize: pageSize.value,
    projectName: commonParams.value.projectName,
    name: '',
  }
  const token = latestFunnelList.next()
  void getPageListApi<FunnelPageData>(params)
    .then((res) => {
      if (!latestFunnelList.isLatest(token)) return
      if (res?.code != 200 || !res.data) return
      applyFunnelPage(res.data, type, rules)
    })
    .catch(() => undefined)
}

function applyFunnelPage(data: FunnelPageData, type?: string, rules?: FunnelEditParams) {
  total.value = data.total
  if (data.rows && data.rows.length > 0) {
    funnelListName.value = data.rows

    // 与 v2 一致：这里先解析一次 route.query.query，解析失败或没有就直接 return
    if (route.query.query && (route.query.query as string).trim() !== '') {
      try {
        JSON.parse(route.query.query as string)
      } catch {
        return
      }
    } else {
      return
    }
    // 刷新路由选择步骤
    if (type == '新增') {
      if (funnelListName.value.length > 0) {
        const first = funnelListName.value[0]
        if (first) {
          funnelIdFlag.value = first.funnelId
          const modelObj = JSON.parse(first.queryParams) as FunnelDefinition
          modelObject.value.name = first.name
          // 维度动态名称
          fieldTypeList.value = modelObj.steps
          modelObject.value.steps = modelObj.steps
        }
      } else {
        funnelIdFlag.value = ''
      }
    } else if (type == '编辑') {
      if (rules && rules.funnelId === funnelIdFlag.value) {
        const parsed = JSON.parse(rules.queryParams) as FunnelDefinition
        modelObject.value.steps = parsed.steps
        fieldTypeList.value = JSON.parse(rules.queryParams).steps
        emit('modelDataList', '', modelObject.value)
      }
    } else if (route.query.query && (route.query.query as string).trim() !== '') {
      if (!funnelIdFlag.value) {
        let query: FunnelModelObject | null = null
        try {
          query = JSON.parse(route.query.query as string) as FunnelModelObject
        } catch {
          return
        }
        if (funnelListName.value) {
          funnelListName.value.forEach((item) => {
            if (item.name == query?.name) {
              funnelIdFlag.value = item.funnelId
              const funnelSteps = item.queryParams
                ? (JSON.parse(item.queryParams) as FunnelDefinition)
                : null
              modelObject.value.steps = funnelSteps ? funnelSteps.steps : []
              fieldTypeList.value = funnelSteps ? funnelSteps.steps : []
            }
          })
        }
      } else {
        if (funnelListName.value.length > 0) {
          const first = funnelListName.value[0]
          if (first) {
            funnelIdFlag.value = first.funnelId
            const modelObj = JSON.parse(first.queryParams) as FunnelDefinition
            modelObject.value.name = first.name
            // 维度动态名称
            fieldTypeList.value = modelObj.steps
            modelObject.value.steps = modelObj.steps
          }
        } else {
          funnelIdFlag.value = ''
          modelObject.value.steps = [
            {
              customName: '',
              eventName: '',
              type: 'normal',
              filter: { relation: 'and', filters: [] },
            },
          ]
        }
      }
    }
    // 从书签过来 / 页面刷新 - 需开始分析，但需和选择漏斗进行匹配
    //（因为漏斗步骤有可能编辑或者删除后，规则不匹配的问题）
    if (enAbleAnalysis.value) {
      enAbleAnalysis.value = false
      let query: FunnelModelObject | null = null
      if (route.query.query) {
        try {
          query = JSON.parse(route.query.query as string) as FunnelModelObject
        } catch {
          return
        }
      }

      if (!query || !query.name) {
        return
      }

      const currentFunnelStep = funnelListName.value.find((item) => item.name === query?.name)

      if (!currentFunnelStep) {
        void ElMessageBox.confirm('原书签内的漏斗模型已被删除', '提示', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          cancelButtonClass: 'custom-cancel-button',
          type: 'warning',
        })
          .then(() => undefined)
          .catch(() => undefined)
        return
      }
      const querySteps = JSON.stringify(query.steps)
      const funnelSteps = JSON.stringify(modelObject.value.steps)
      if (querySteps === funnelSteps) {
        startAnalysis()
      } else {
        void ElMessageBox.confirm(
          '原书签内的漏斗模型已改变，系统将按照最新的漏斗模型进行查询',
          '提示',
          {
            confirmButtonText: '开始分析',
            cancelButtonText: '取消分析',
            cancelButtonClass: 'custom-cancel-button',
            type: 'warning',
          },
        )
          .then(() => {
            startAnalysis()
          })
          .catch(() => undefined)
      }
    }
  } else {
    // 切换 projectName 清空漏斗列表
    modelObject.value.name = ''
    modelObject.value.byFields = []
    modelObject.value.filter = { filters: [] }
    funnelListName.value = []
    fieldTypeList.value = []
    funnelIdFlag.value = ''
    modelObject.value.steps = [
      {
        customName: '',
        eventName: '',
        type: 'normal',
        filter: { relation: 'and', filters: [] },
      },
    ]
  }
}

/** 与 v2 一致：dialog 保存后回传模型，v2 的实现就是空的 */
function stepModel(_model: FunnelDefinition) {}

function apiResCodeEvent(res?: ApiResult | null) {
  clearAllTimers()
  seconds.value = 0
  emit('updataPercent', 0)

  emit('modelDataList', '', modelObject.value)
  isLoading.value = false
  emit('lodingEvents', false)
  bus.emit('$isDisable', false)
  isDisableBtn.value = false

  if (res && res.code === 504) {
    dialogMsgErrorRef.value?.openErrorMsg(
      '由于您的请求数据量过大导致连接超时，请调整查询时间范围或数据查看维度后重新进行查询！',
    )
  } else {
    dialogMsgErrorRef.value?.openErrorMsg(res && res.msg ? res.msg : '请求超时')
  }
}

function startAnalysis() {
  if (!funnelIdFlag.value) {
    ElMessage.error('请选择漏斗')
    return
  }
  if (isLoading.value) return

  // 1. 彻底清除并重置所有状态
  clearAllTimers()
  seconds.value = 0
  emit('updataPercent', 0)

  // 2. 开启新的计时器
  secondTimer = setInterval(() => {
    seconds.value++
    emit('updataPercent', seconds.value)
  }, 1000)

  isLoading.value = true
  emit('lodingEvents', true)
  // 开启禁用按钮 防止多次点击操作
  isDisableBtn.value = true
  bus.emit('$isDisable', true)

  analysisToken = latestAnalysis.next()
  funnelAnalysisInit()
}

function clearAllTimers() {
  if (secondTimer) {
    clearInterval(secondTimer)
    secondTimer = null
  }
  if (polling) {
    clearInterval(polling)
    polling = null
  }
  if (featchTimer) {
    clearInterval(featchTimer)
    featchTimer = null
  }
}

/** 漏斗异步轮询机制开始分析 */
function funnelAnalysisInit() {
  const params = copyObj(modelObject.value) as unknown as Record<string, unknown>
  // 与 v2 一致：v2 在这里注释掉了 params.funnelId = this.funnelIdFlag
  // 接口获取 ID
  funnelAnalysisApi<TaskInstanceData>(params)
    .then((res) => {
      if (!latestAnalysis.isLatest(analysisToken)) return
      if (res?.code == 200 && res.data) {
        instanceIdFindEvent(res.data.instanceId)
      } else {
        apiResCodeEvent(res)
      }
    })
    .catch((error) => {
      if (!latestAnalysis.isLatest(analysisToken)) return
      console.log(error, 'error')
      apiResCodeEvent()
    })
}

function instanceIdFindEvent(instanceId: string) {
  // 设置循环时间过长取消请求操作（v2 在这里注释着一行写死 20 秒的判断）
  const timer = window.globalConfig?.clklog_api_load_maxtime || 60
  if (seconds.value > timer) {
    clearAllTimers()
    emit('updataPercent', 0)
    seconds.value = 0
    emit('modelDataList', '', modelObject.value)
    isLoading.value = false
    emit('lodingEvents', false)
    bus.emit('$isDisable', false)
    isDisableBtn.value = false
    // 如果有报错则提示 msg 内容
    dialogMsgErrorRef.value?.openErrorMsg(
      '您的查询时间范围过长或数据查看维度数据过多，请调整查询时间范围或数据查看维度后重新进行查询！',
    )
    return
  }
  taskRueryApi<TaskQueryData>({ instanceId: instanceId, projectName: projectName.value })
    .then((res) => {
      if (!latestAnalysis.isLatest(analysisToken)) return
      if (res?.code == 200) {
        if (res.data?.code == 200) {
          if (polling) {
            clearInterval(polling)
            polling = null
          }
          if (!featchTimer) {
            featchTimer = setInterval(() => {
              seconds.value = seconds.value + 1
              emit('updataPercent', seconds.value)
            }, 1000)
          }
          // end
          taskFetchApi<TaskFetchData>({
            instanceId: instanceId,
            projectName: projectName.value,
          })
            .then((fetchRes) => {
              if (!latestAnalysis.isLatest(analysisToken)) return
              if (fetchRes?.code == 200) {
                clearAllTimers()
                seconds.value = 0
                emit('updataPercent', 0)

                isLoading.value = false
                if (fetchRes.data?.result) {
                  emit('modelDataList', fetchRes.data.result, modelObject.value)
                  emit('lodingEvents', false)
                  bus.emit('$isDisable', false)
                  isDisableBtn.value = false
                  if (fetchRes.data.result.partial) {
                    dialogMsgErrorRef.value?.openErrorMsg(
                      '您的查询时间范围过长或数据查看维度数据过多，为保证您的页面数据能够正常加载，系统仅返回部分数据进行展示。',
                    )
                  }
                } else {
                  emit('modelDataList', '', modelObject.value)
                  emit('lodingEvents', false)
                  bus.emit('$isDisable', false)
                  isDisableBtn.value = false
                  dialogMsgErrorRef.value?.openErrorMsg(
                    '查询模型错误，请检查并修改查询模型后重新进行分析。',
                  )
                }
              } else {
                apiResCodeEvent(fetchRes)
              }
            })
            .catch(() => {
              if (!latestAnalysis.isLatest(analysisToken)) return
              apiResCodeEvent()
            })
        } else if (res.data?.code == 102) {
          if (secondTimer) {
            clearInterval(secondTimer)
            secondTimer = null
          }
          if (!polling) {
            // 数据量大时按 clklog_api_load_maxtime（秒）为上限轮询查询结果，
            // 定时器统一由 clearAllTimers / onBeforeUnmount 清理
            polling = setInterval(() => {
              seconds.value++
              const isMultipleOfTwo = (num: number) => num % 2 === 0
              if (isMultipleOfTwo(seconds.value)) {
                instanceIdFindEvent(instanceId)
              }
              emit('updataPercent', seconds.value)
            }, 1000)
          }
        } else {
          apiResCodeEvent(res)
        }
      } else {
        apiResCodeEvent(res)
      }
    })
    .catch(() => {
      if (!latestAnalysis.isLatest(analysisToken)) return
      apiResCodeEvent()
    })
}

function updateTag(label: string) {
  if (!tagObj.value) return
  tagObj.value.queryParams = JSON.stringify(modelObject.value)
  bookmarkDialogRef.value?.openDialog(label, tagObj.value, modelObject.value)
}

function addBookMark(label: string) {
  bookmarkDialogRef.value?.openDialog(label, modelObject.value, '', '漏斗分析')
}

function openFunnel(name: string) {
  dialogRef.value?.openDialog(name, modelObject.value)
}

/** 通用属性 */
function getCommonPropertyList() {
  const token = latestCommonProperty.next()
  void getCommonPropertyListApi({
    projectName: commonParams.value.projectName,
  }).then((res) => {
    if (!latestCommonProperty.isLatest(token)) return
    // 共用的 manageEvent api 没有开泛型（其它模块也在用），这里在调用点收口类型
    const data = res.data as CommonPropertyData | undefined
    if (res?.code == 200 && data) {
      propertyList.value.commonPropertySum = [
        ...data.commonProperties,
        ...data.commonPresetProperties,
      ]
      propertyList.value.userProperties = data.userProperties
    }
  })
}

/** 指标联级事件 */
function getPrototype() {
  const token = latestPrototype.next()
  void getGroupedPropertiesApi({
    projectName: commonParams.value.projectName,
  }).then((res) => {
    if (!latestPrototype.isLatest(token)) return
    const data = res.data as GroupedPropertiesData | undefined
    if (res?.code == 200) {
      if (data) {
        const mergedData = mergeCommonPropertiesToEvents(data)
        pointProtoList.value = mergedData ? mergedData.events : []
      }
    }
  })
}

/** 指标属性 */
function getListEventPrototype(type: '用户' | '事件') {
  const latest = type == '用户' ? latestUserProto : latestEventProto
  const token = latest.next()
  const params = {
    projectName: commonParams.value.projectName,
    type: type,
  }
  void getListNoGroupEventApi(params).then((res) => {
    if (!latest.isLatest(token)) return
    const data = res.data as PropertyItem[] | undefined
    if (res?.code == 200) {
      if (type == '用户') {
        pointTypeList.value.userProtoList = data ?? []
      } else {
        pointTypeList.value.eventProtoList = data ?? []
      }
    }
  })
}

defineExpose({ modelListEvent, routeUrlInitAnalysis, handleRefreshApi })
</script>

<style lang="scss" scoped>
:deep(.el-loading-spinner .circular) {
  height: 30px !important;
  margin-top: 5px;
}

:deep(.el-input--medium .el-input__inner) {
  height: 30px;
  line-height: 30px;
  font-size: 12px;
}

:deep(.el-input--medium .el-input__icon) {
  line-height: 30px;
}

:deep(.el-select-dropdown__list) {
  padding: 0 0 6px;
}

.model-page {
  width: 100%;
  // min-height: 400px;
  background-color: #fff;
  position: relative;

  .riseImg {
    cursor: pointer;
    width: 12px;
    height: 12px;
    margin-left: 7px;
    margin-top: 3px;
  }

  .parentPosition {
    position: relative;

    .popImg {
      position: absolute;
      left: 0;
      transform: translate(0, -50%); //左右上下
    }
  }

  .containerItem {
    padding: 0 20px;
    margin-top: 30px;
    box-sizing: border-box;

    .singItem {
      display: flex;
      align-items: center;
      margin-bottom: 20px;

      .titleHead {
        display: flex;
        align-items: center;
        width: 100px;
        color: #6d6e70;
        font-size: 13px;
      }
    }
  }
}
</style>
