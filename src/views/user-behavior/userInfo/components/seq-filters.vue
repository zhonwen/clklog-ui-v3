<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Refresh, RefreshRight } from '@element-plus/icons-vue'
import { getGroupedPropertiesApi } from '@/api/sysmanage/manageEvent'
import { mergeCommonPropertiesToEvents } from '@/utils/mergeEventProperties'
import { copyObj } from '@/utils/copy'
import { debounce } from '@/utils/index'
import { formatDateYMD } from '@/utils/date'
import type { GroupedPropertiesData } from '@/views/analysis-modules/custom-analysis/types'
import type { EventGroup, SeqEventMeta, SeqFilterParams, SeqFilterValue } from '../types'

const props = withDefaults(
  defineProps<{
    modelValue?: SeqFilterValue
    /** 自定义时间范围 */
    byCursorTime?: boolean
    /** 选择时间段 */
    byDatePeriod?: boolean
    /** 选择事件 */
    bySelectEvent?: boolean
    showKeyWord?: boolean
    /** 缓存的事件列表 */
    cachedEventOptions?: EventGroup[]
    cachedEventMeta?: SeqEventMeta | null
  }>(),
  {
    modelValue: () => ({}),
    byCursorTime: false,
    byDatePeriod: false,
    bySelectEvent: false,
    showKeyWord: false,
    cachedEventOptions: () => [],
    cachedEventMeta: null,
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: SeqFilterValue): void
  (e: 'update:cachedEventOptions', value: EventGroup[]): void
  (e: 'update:cachedEventMeta', value: SeqEventMeta | null): void
  (e: 'set-filter-bar-params', params: SeqFilterParams): void
}>()

const route = useRoute()

const rootRef = ref<HTMLDivElement | null>(null)
const tempEvents = ref<string[]>([])
const tempKeyWord = ref('')
const localValue = ref<SeqFilterValue>({
  dateMode: 'latest',
  rangeTime: null,
  events: [],
  keyWord: '',
  timeFlag: 'month',
})
// 时间范围选择相关数据，默认近30天
const timeFlag = ref('month')
const newParams = ref<SeqFilterParams | null>(null)
const protoList = ref<EventGroup[]>([])
// v2 里 isCascaderOpen 没写进 data，是个非响应式的实例属性，这里对齐成普通变量
let isCascaderOpen = false

/**
 * 与 v2 的 utils/date-picker-options.js 等价。
 * element-plus 不再吃 picker-options，拆成 :disabled-date / :shortcuts，
 * shortcut 由 onClick(picker) → picker.$emit('pick', [start, end]) 改成 value() 返回区间。
 */
const disabledDate = (date: Date) => {
  const today = new Date()
  return date.getTime() > today.getTime()
}

const pickerShortcuts = [
  { text: '近一周', days: 7 },
  { text: '近一个月', days: 30 },
  { text: '近三个月', days: 90 },
  { text: '近六个月', days: 180 },
  { text: '近一年', days: 365 },
].map(({ text, days }) => ({
  text,
  value: () => {
    const end = new Date()
    const start = new Date()
    start.setTime(start.getTime() - 3600 * 1000 * 24 * days)
    return [start, end]
  },
}))

/* --------------------------- moment 的替代实现 --------------------------- */
// v3 没有 moment。下面三个函数复刻 moment().subtract(n, unit) 的语义，
// 关键是 month / year 会「夹到目标月最后一天」（5-31 减 3 个月是 2-28 而不是 3-2），
// 原生 setMonth / setFullYear 会溢出到下个月，所以要用 setDate(0) 回退。
function todayYMD() {
  return formatDateYMD(new Date())
}

function subtractDays(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return formatDateYMD(d)
}

function subtractMonths(months: number) {
  const d = new Date()
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() - months)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, lastDay))
  return formatDateYMD(d)
}

function subtractYears(years: number) {
  const d = new Date()
  const day = d.getDate()
  const month = d.getMonth()
  d.setDate(1)
  d.setFullYear(d.getFullYear() - years)
  const lastDay = new Date(d.getFullYear(), month + 1, 0).getDate()
  d.setDate(Math.min(day, lastDay))
  return formatDateYMD(d)
}

/* ------------------------------ lodash 的替代 ------------------------------ */
// v3 没有 lodash，_.isEqual 只用来比对纯 JSON 数据（筛选值对象 / 字符串数组），
// 这里按值做递归比较，语义与这些数据上的 _.isEqual 一致。
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((item, i) => deepEqual(item, b[i]))
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a as Record<string, unknown>)
    const kb = Object.keys(b as Record<string, unknown>)
    if (ka.length !== kb.length) return false
    return ka.every(
      (k) =>
        Object.prototype.hasOwnProperty.call(b, k) &&
        deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
    )
  }
  return false
}

const projectName = computed(() => {
  const name = route.query.projectName
  return typeof name === 'string' && name ? name : null
})

// 默认参数
const defaultParams = computed<SeqFilterParams>(() => {
  const { rangeTime, events, keyWord } = localValue.value
  const queryProject = route.query.projectName
  const params: SeqFilterParams = {
    rangeTime: rangeTime ?? null,
    events: events || [],
    projectName: typeof queryProject === 'string' && queryProject ? queryProject : null,
  }
  if (props.showKeyWord) {
    params.keyWord = keyWord || ''
  }
  return params
})

const commonParams = computed<SeqFilterParams>(() => ({ ...defaultParams.value }))

watch(
  () => props.modelValue,
  (val) => {
    if (val && !deepEqual(val, localValue.value)) {
      // 只在确实不同时才更新，避免循环
      // 只有当有实质内容时才覆盖
      if (Object.keys(val).length > 0) {
        // 确保 localValue 包含必要的响应式属性
        const newVal = copyObj(val)
        // 补全缺失的字段，确保 v-model 绑定和 computed 依赖正常工作
        if (newVal.rangeTime === undefined) newVal.rangeTime = null
        if (newVal.events === undefined) newVal.events = []
        if (newVal.keyWord === undefined) newVal.keyWord = ''
        if (newVal.timeFlag === undefined) newVal.timeFlag = 'month'
        if (newVal.dateMode === undefined) newVal.dateMode = 'latest'

        localValue.value = newVal
        tempEvents.value = localValue.value.events || []
        tempKeyWord.value = localValue.value.keyWord || ''
        // 如果是日期段模式，尝试恢复 timeFlag
        if (props.byDatePeriod && localValue.value.timeFlag) {
          timeFlag.value = localValue.value.timeFlag
        }
      }
    }
  },
  { deep: true, immediate: true },
)

watch(
  localValue,
  (val) => {
    emit('update:modelValue', val)
  },
  { deep: true },
)

const emitCommonParams = debounce((newVal: SeqFilterParams) => {
  newParams.value = newVal
  nextTick(() => {
    setTopFilterParams(newVal)
  })
}, 200)

watch(commonParams, (newVal) => emitCommonParams(newVal), { deep: false })

function refreshEvent() {
  // 如果开启了事件选择，刷新时强制更新事件列表
  if (props.bySelectEvent) {
    getPrototype(true)
  }
  if (newParams.value) emit('set-filter-bar-params', newParams.value)
}

function onResetEvent() {
  localValue.value.events = []
  tempEvents.value = []
  localValue.value.keyWord = ''
  tempKeyWord.value = ''
  if (props.byDatePeriod) {
    timeFlag.value = 'month'
    localValue.value.timeFlag = 'month'
    handleChange('month')
  } else {
    localValue.value.dateMode = 'latest'
    localValue.value.rangeTime = '' // 最新默认传全部
  }
}

function onDateModeChange() {
  if (localValue.value.dateMode === 'latest') {
    // 设置为最新：与 v2 一致，置空串代表「全部」
    localValue.value.rangeTime = ''
  }
}

function setTopFilterParams(params: SeqFilterParams) {
  emit('set-filter-bar-params', params)
}

// 时间范围选择相关方法
function handleChange(val: string | number | boolean | undefined) {
  const flag = String(val ?? '')
  const today = todayYMD()
  let startDate = ''
  let endDate = ''

  if (flag === 'week') {
    // 近7天
    startDate = subtractDays(7)
    endDate = today
  } else if (flag === 'month') {
    // 近30天
    startDate = subtractDays(30)
    endDate = today
  } else if (flag === 'quarter') {
    // 近三个月
    startDate = subtractMonths(3)
    endDate = today
  } else if (flag === 'year') {
    // 与 v2 一致（v2 此处注释写的是「近3年」，实际 subtract 的是 1 年）
    startDate = subtractYears(1)
    endDate = today
  }

  localValue.value.rangeTime = [startDate, endDate]
  localValue.value.timeFlag = flag
}

// 日期选择器变化事件
function checkDateEvent() {
  // 当用户手动选择日期时，清除时间范围选择的标记
  timeFlag.value = ''
  localValue.value.timeFlag = ''
}

function handleCascaderChange(val: unknown) {
  // 如果下拉框未打开（例如点击了清空按钮或移除了标签），则立即同步
  if (!isCascaderOpen) {
    localValue.value.events = (val as string[]) || []
  }
}

function onVisibleChange(visible: boolean) {
  isCascaderOpen = visible
  if (visible) {
    setTimeout(() => {
      renderFooterButtons()
    }, 100)
  } else {
    // 当下拉框关闭时，检查是否有变更，如果有变更则同步数据
    if (!deepEqual(localValue.value.events, tempEvents.value)) {
      localValue.value.events = tempEvents.value
    }
  }
}

function handleNodeClick(node: unknown, event: Event) {
  // element-plus 的 cascader 插槽给的是它自己的 Node 实例，这里只用到三个字段
  const n = node as { isLeaf?: boolean; value?: string | number; checked?: boolean }
  if (n.isLeaf) {
    if (event) event.stopPropagation()
    if (n.value === undefined || n.value === null) return
    const val = String(n.value)
    const index = tempEvents.value.indexOf(val)
    if (index > -1) {
      tempEvents.value.splice(index, 1)
      n.checked = false
    } else {
      tempEvents.value.push(val)
      n.checked = true
    }
    // 强制更新，确保 UI 同步
    tempEvents.value = [...tempEvents.value]
  }
}

/**
 * 与 v2 一致（v2 此处逻辑存疑：模板里的 el-cascader 上根本没写 ref="cascader"，
 * this.$refs.cascader 永远是 undefined，函数第一行就 return 了，
 * 这段自定义「取消 / 确定」页脚从来没有渲染过）。
 * 这里保留同样的短路，不去依赖 element-plus 的 cascader 内部实例。
 */
function renderFooterButtons() {
  return
}

function applyKeyWord() {
  localValue.value.keyWord = tempKeyWord.value
}

function getPrototype(force = false) {
  if (!route.query.userId || !route.query.projectName) return
  // 如果不是强制刷新，且已经有数据，则不请求
  if (!force && protoList.value && protoList.value.length > 0) {
    return
  }

  getGroupedPropertiesApi({ projectName: projectName.value })
    .then((res) => {
      if (res?.code == 200) {
        if (res.data) {
          const mergedData = mergeCommonPropertiesToEvents(res.data as GroupedPropertiesData)
          protoList.value = mergedData && mergedData.events ? mergedData.events : []
          emit('update:cachedEventOptions', protoList.value)
          emit('update:cachedEventMeta', res.data as SeqEventMeta)
        } else {
          protoList.value = []
          emit('update:cachedEventOptions', [])
          emit('update:cachedEventMeta', null)
        }
      } else {
        protoList.value = []
        emit('update:cachedEventOptions', [])
        emit('update:cachedEventMeta', null)
      }
    })
    .catch(() => {
      protoList.value = []
      emit('update:cachedEventOptions', [])
      emit('update:cachedEventMeta', null)
    })
}

// 修复：避免 aria-hidden=true 的原生 radio 获得焦点导致的可访问性警告
function fixAriaHiddenOnRadios() {
  nextTick(() => {
    const el = rootRef.value
    if (!el) return
    const radios = el.querySelectorAll('input.el-radio__original[aria-hidden="true"]')
    radios.forEach((node) => {
      try {
        node.setAttribute('aria-hidden', 'false')
      } catch {
        /* 与 v2 一致：忽略 */
      }
    })
  })
}

function onFocusIn(e: FocusEvent) {
  const t = e.target
  if (t instanceof Element && t.matches('input.el-radio__original[aria-hidden="true"]')) {
    try {
      t.setAttribute('aria-hidden', 'false')
    } catch {
      /* 与 v2 一致：忽略 */
    }
  }
}

onMounted(() => {
  fixAriaHiddenOnRadios()
  // 初始化时设置默认的最新日期范围
  if (props.byDatePeriod) {
    handleChange(timeFlag.value)
  } else {
    onDateModeChange()
  }

  // 如果有缓存的事件列表，直接使用，避免重复请求
  if (props.bySelectEvent) {
    if (props.cachedEventOptions && props.cachedEventOptions.length > 0) {
      protoList.value = props.cachedEventOptions
    } else {
      getPrototype()
    }
  }
})

onBeforeUnmount(() => {
  // 防抖回调不取消的话，卸载后还会 emit 一次，父组件会去写已卸载组件的状态
  emitCommonParams.cancel()
})
</script>

<template>
  <div ref="rootRef" class="page-warry">
    <div class="seq-filters commonBackgrond" @focusin="onFocusIn">
      <div style="display: flex; justify-content: space-between">
        <div class="filter-item-container">
          <div v-if="byCursorTime" class="seq-filter-item radio-group setFilterTop setFilterRight">
            <div class="check_item public_border_color">
              <span class="common-title" style="padding: 0 10px">时间:</span>
              <el-radio-group
                v-model="localValue.dateMode"
                class="customize_radio"
                @change="onDateModeChange"
              >
                <el-radio value="latest">最新</el-radio>
                <el-radio value="customize">自定义</el-radio>
              </el-radio-group>
            </div>
            <el-date-picker
              v-if="localValue.dateMode === 'customize'"
              v-model="localValue.rangeTime"
              type="daterange"
              value-format="YYYY-MM-DD"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              size="small"
              :disabled-date="disabledDate"
              :shortcuts="pickerShortcuts"
              style="margin-left: 10px; width: 210px"
            />
          </div>
          <!-- 时间范围选择 -->
          <div v-if="byDatePeriod" class="seq-filter-item radio-group setFilterTop setFilterRight">
            <div class="check_item public_border_color">
              <span class="common-title" style="padding: 0 10px">时间:</span>
              <el-radio-group v-model="timeFlag" class="checkBoxStyle" @change="handleChange">
                <el-radio value="week">近7天</el-radio>
                <el-radio value="month">近30天</el-radio>
                <el-radio value="quarter">近3个月</el-radio>
                <el-radio value="year">近1年</el-radio>
              </el-radio-group>
            </div>
            <!-- 日期选择器（v2 这里写的是 rangeTime-separator，是个拼错的属性，
                 element-ui / element-plus 都不认，实际用的是默认分隔符 "-"，这里不再保留） -->
            <el-date-picker
              v-model="localValue.rangeTime"
              style="margin-left: 10px; width: 210px; height: 30px"
              size="small"
              type="daterange"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
              :disabled-date="disabledDate"
              :shortcuts="pickerShortcuts"
              @change="checkDateEvent"
            />
          </div>

          <div
            v-if="showKeyWord"
            class="seq-filter-item setFilterTop setFilterRight seq-filter-keyword"
          >
            <span class="common-title" style="padding: 0 10px">关键属性:</span>
            <el-input
              v-model="tempKeyWord"
              size="small"
              clearable
              placeholder="请输入关键属性"
              style="width: 200px"
              @blur="applyKeyWord()"
              @keyup.enter="applyKeyWord()"
              @clear="applyKeyWord()"
            />
          </div>
        </div>

        <div class="seq-filter-actions setFilterTop">
          <el-button class="zc_btn refresh" style="width: 70px" :icon="RefreshRight" @click="refreshEvent">
            刷新
          </el-button>
          <el-button class="zc_btn_default reset" style="width: 70px" :icon="Refresh" @click="onResetEvent">
            重置
          </el-button>
        </div>
      </div>
      <!-- 选择事件 -->
      <div v-if="bySelectEvent" class="seq-filter-item setFilterTop setFilterRight">
        <div class="event-label-wrapper">
          <span class="common-title event_name">选择事件：</span>
          <div v-if="tempEvents && tempEvents.length > 0" class="event-count-tip">
            已选{{ tempEvents.length }} 个
          </div>
        </div>
        <el-cascader
          v-model="tempEvents"
          :teleported="false"
          :options="protoList"
          :show-all-levels="false"
          style="font-size: 13px; max-width: 100%; width: auto; min-height: 30px"
          class="custom_cascader"
          filterable
          clearable
          :collapse-tags="false"
          popper-class="custom-cascader-popper"
          :props="{
            value: 'name',
            label: 'displayName',
            children: 'events',
            multiple: true,
            emitPath: false,
          }"
          size="small"
          @change="handleCascaderChange"
          @visible-change="onVisibleChange"
        >
          <template #default="{ node, data }">
            <span style="display: inline-block; width: 100%" @click="handleNodeClick(node, $event)">
              {{ data.displayName }}
            </span>
          </template>
        </el-cascader>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
:deep(.custom_cascader .el-cascader__tags .el-cascader__search-input) {
  height: 20px !important;
}

:deep(.custom-cascader-popper .el-cascader-node .el-cascader-node__label) {
  padding-left: 15px !important;
}

:deep(.custom_cascader) {
  line-height: normal;
  display: inline-grid;
  vertical-align: middle;
  min-width: 100px;
  max-width: 100%;
  width: auto;
  position: relative;
  min-height: 30px;
  height: auto !important; // 允许根据内容伸缩

  /* 将输入框和标签区域放在同一个网格单元格中，实现完美堆叠 */
  .el-input,
  .el-cascader__tags {
    grid-area: 1 / 1;
  }

  .el-input {
    display: flex;
    width: 100%;
    height: 100% !important; // 关键：跟随网格高度撑开
    min-height: 30px !important;

    .el-input__inner {
      height: 100% !important;
      min-height: 30px !important;
      line-height: 30px !important;
      padding: 0 30px 0 10px !important;
      display: block !important;
      box-sizing: border-box !important;
    }
  }

  /* 彻底隐藏主输入框的占位符，防止在多选标签间隙中露出 */
  .el-input__inner::placeholder {
    opacity: 0 !important;
  }

  /* 仅在没有任何选中项（空状态）时，才显示占位符 */
  &.el-cascader--empty .el-input__inner::placeholder {
    opacity: 1 !important;
    color: #c0c4cc !important;
  }

  .el-cascader__tags {
    position: relative;
    grid-area: 1 / 1;
    transform: none;
    top: 0;
    left: 0;
    padding: 2px 30px 2px 6px;
    display: flex;
    flex-wrap: wrap;
    height: auto;
    min-height: 30px;
    max-height: 60px;
    overflow-y: auto;
    box-sizing: border-box;
    align-items: center;

    .el-tag {
      margin: 2px 0 1px 6px;
      height: 24px;
      line-height: 22px; // border-box
    }

    /* 优化搜索输入框：在非聚焦状态下不占据剩余空间，消除“空洞”感 */
    .el-cascader__search-input {
      background: transparent !important;
      border: none !important;
      outline: none !important;
      box-shadow: none !important;
      margin: 2px 0 2px 10px !important;
      width: 10px !important; // 默认极小宽度
      flex: 0 0 auto !important; // 不自动拉伸
      height: 24px;
      line-height: 24px;
      color: #606266;

      /* 只有在输入内容或聚焦时才拉伸 */
      &:focus {
        flex: 1 !important;
        min-width: 60px !important;
      }
    }
  }

  .el-input__suffix {
    display: flex;
    align-items: center;
    position: absolute;
    right: 5px;
    top: 0;
    height: 30px; // 箭头固定在第一行高度，不随高度滚动
    z-index: 2;
  }
}

// 自定义单选框样式, 间距, 字体大小
:deep(.el-radio) {
  margin-right: 15px;
}

:deep(.el-radio__label) {
  font-size: 12px;
}

:deep(.el-radio__inner) {
  width: 12px;
  height: 12px;
}

// 自定义输入框高度, 行高, 字体大小
:deep(.el-input--medium .el-input__inner) {
  height: 30px;
  line-height: 30px;
}

:deep(.el-input__suffix) {
  display: flex;
  align-items: center;
}

:deep(.el-input__inner) {
  font-size: 12px;
}

// 时间选择器样式
:deep(.checkBoxStyle) {
  .el-radio {
    margin-right: 15px;
  }
}

// 日期选择器样式
:deep(.timnePickCSS) {
  .el-input__inner {
    font-size: 12px;
    height: 30px;
    line-height: 30px;
  }
}

/* 调整父级容器对齐方式 */
.seq-filter-item.setFilterTop {
  align-items: flex-start;

  .event-label-wrapper {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    margin-right: 5px;

    .event_name {
      line-height: 30px;
    }

    .event-count-tip {
      font-size: 11px;
      color: #2c7be5;
      background: #eaf2fd;
      padding: 0;
      border-radius: 2px;
      margin-top: -4px;
      margin-bottom: 4px;
      white-space: nowrap;
    }
  }

  .common-title {
    line-height: 30px;
  }
}

.commonBackgrond {
  background-color: #fff;
}

.seq-filters {
  margin-bottom: 20px;
  white-space: nowrap;
  display: flex;
  flex-wrap: wrap;
  flex-direction: column;
  justify-content: space-between;
  width: 100%;
  font-size: 12px;
  line-height: 15px;
  font-weight: 400;
  border-radius: 0 0 6px 6px;
  padding: 0 12px 10px 12px;
  box-sizing: border-box;
}

.setFilterTop {
  padding-top: 10px;
}

.setFilterLeft {
  margin-left: 10px;
}

.setFilterRight {
  margin-right: 10px;
}

.filter-item-container {
  display: flex;
  //flex-wrap: wrap;
  align-items: center;
  width: calc(100% - 150px);
}

.check_item {
  background-color: #ffffff;
  height: 30px;
  border-radius: 4px;
  display: flex;
  align-items: center;
}

.seq-filter-item {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;

  .event_name {
    margin-left: 0px;
  }
}

.seq-filter-actions {
  display: flex;
}
</style>
