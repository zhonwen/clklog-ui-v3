<template>
  <div>
    <div class="documentation-container">
      <div class="headerFilter">
        <!-- 第一行 -->
        <div class="tabBar">
          <div style="display: flex; align-items: center; white-space: nowrap">
            <div class="check_item public_border_color filterbar-tab-right">
              <span>时间:</span>
              <el-radio-group v-model="timeFlag" class="checkBoxStyle" @change="handleChange">
                <el-radio value="day">今日</el-radio>
                <el-radio value="previous">昨日</el-radio>
                <el-radio value="week">过去7天</el-radio>
                <el-radio value="month">过去30天</el-radio>
              </el-radio-group>
            </div>
            <!-- 日期 -->
            <el-date-picker
              v-model="currentTime"
              class="timnePickCSS filterbar-tab-right"
              style="width: 250px; height: 30px"
              range-separator="至"
              start-placeholder="开始日期"
              type="daterange"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
              :disabled-date="disabledDate"
              :shortcuts="pickerShortcuts"
              @change="checkDateEvnet"
            />
            <div v-if="ByContrast" class="filterbar-tab-right">
              <el-checkbox v-model="checked" @change="checkTimeSlot">{{ checkLabel }}</el-checkbox>
            </div>

            <div v-if="ByDayOrHour" class="filterbar-tab-right">
              <el-radio-group
                v-model="timeType"
                size="small"
                style="font-size: 13px; height: 30px"
              >
                <el-radio-button value="day" :disabled="dayFlag ? true : false">按日</el-radio-button>
                <el-radio-button value="week" :disabled="weekFlag ? true : false"
                  >按周</el-radio-button
                >
                <el-radio-button value="month" :disabled="monthFlag ? true : false"
                  >按月</el-radio-button
                >
              </el-radio-group>
            </div>
            <div
              v-if="ByRefresh"
              :style="
                device == 'desktop'
                  ? 'position: fixed; right: 0px'
                  : 'position:relative;margin-left:50px;margin-right:30px'
              "
            >
              <div class="tabBarBtn" style="position: relative">
                <el-button
                  class="zc_btn refresh"
                  :icon="RefreshRight"
                  :disabled="isDisableBtn"
                  @click="customAnalysisRefreshApi('refresh')"
                  >刷新</el-button
                >
                <el-button :icon="Refresh" class="zc_btn_default reset" @click="collapseResetApiList"
                  >重置</el-button
                >
              </div>
            </div>
            <div v-if="ByCollapse" class="tabBarBtn">
              <el-button
                v-loading="loadingApi"
                class="zc_btn refresh"
                :icon="RefreshRight"
                element-loading-background="#fff"
                @click="collapseRefreshApi"
                >刷新</el-button
              >
              <el-button :icon="Refresh" class="zc_btn_default reset" @click="collapseResetApiList"
                >重置</el-button
              >
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, nextTick, ref, watch } from 'vue'
import { Refresh, RefreshRight } from '@element-plus/icons-vue'
import { useRoute } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { debounce } from '@/utils/index'
import { todateFunc } from '@/utils/date'
import { bus } from '@/utils/event-bus'
import type { CustomFilterBarParams } from '../types'

/**
 * 自定义分析专用筛选条。
 * 与 v2 的 custom-analysis/components/customBar.vue 一一对应，保留全部 By* 开关
 * （当前页面只用到 ByRefresh / ByDayOrHour，其余分支照迁）。
 */
const props = withDefaults(
  defineProps<{
    ByEventGrop?: boolean
    ByReceive?: boolean
    ByGrop?: boolean
    ByTag?: boolean
    /** 对比事件 */
    ByContrast?: boolean
    BySearchWord?: boolean
    ByRefresh?: boolean
    ByCollapse?: boolean
    ByDayOrHour?: boolean
  }>(),
  {
    ByEventGrop: false,
    ByReceive: false,
    ByGrop: false,
    ByTag: false,
    ByContrast: false,
    BySearchWord: false,
    ByRefresh: false,
    ByCollapse: false,
    ByDayOrHour: false,
  },
)

const emit = defineEmits<{
  (e: 'setFilterBarParams', val: CustomFilterBarParams): void
  (e: 'startAnalysiApi', isRefresh?: string): void
}>()

const route = useRoute()
const appStore = useAppStore()
const device = computed(() => appStore.device || 'desktop')

/** 是否禁用刷新 */
const isDisableBtn = ref(false)
/** 是否展示开始分析（v2 通过 $isOpen 同步展开/收起状态，模板里未直接使用） */
const isNotAnalysis = ref(true)
const monthFlag = ref(true)
const weekFlag = ref(true)
const dayFlag = ref(false)
const timeType = ref('day')
const checked = ref(false)
const checkLabel = ref('对比时间段')
const timeFlag = ref('day')
// 与 v2 一致（v2 此处逻辑存疑：currentTime 初值写成空串 ""，daterange 的 v-model 应当是数组；
// 这里改成空数组，语义同样是「未选择」，避免类型冲突）
const currentTime = ref<string[]>([])
const groupName = ref('')
const startTime = ref('')
const endTime = ref('')
/** 搜索词 */
const name = ref('')
const loadingApi = ref(false)

// 下面这几个在 v2 里没有声明在 data 上、直接 this.xxx = 赋值，只在方法之间传递，
// 不参与渲染，这里用普通变量承接。
// _contrastFlag / _contrastValue 在 v2 里只写不读（对比时间段的中间状态没有消费方），
// 为忠实保留赋值链路又不触发 no-unused-vars，统一加 _ 前缀。
let _contrastFlag = false
let _contrastValue = ''
let checkDateTime = ''
let timeDifference = 0
let commonData: CustomFilterBarParams | null = null

/** 日历：不能选未来 */
function disabledDate(date: Date) {
  const today = new Date()
  return date.getTime() > today.getTime()
}

/** v2 的 pickerBeginOption.shortcuts，onClick(picker){picker.$emit('pick',[start,end])} → value: () => [start, end] */
function rangeFromDaysAgo(days: number): [Date, Date] {
  const end = new Date()
  const start = new Date()
  start.setTime(start.getTime() - 3600 * 1000 * 24 * days)
  return [start, end]
}

const pickerShortcuts = [
  { text: '近一周', value: () => rangeFromDaysAgo(7) },
  { text: '近一个月', value: () => rangeFromDaysAgo(30) },
  { text: '近三个月', value: () => rangeFromDaysAgo(90) },
  { text: '近六个月', value: () => rangeFromDaysAgo(180) },
  { text: '近一年', value: () => rangeFromDaysAgo(365) },
]

const defaultParams = computed(() => ({
  startTime: startTime.value,
  endTime: endTime.value,
  timeFlag: timeFlag.value,
}))

const commonParams = computed<CustomFilterBarParams>(() => {
  let obj = {} as CustomFilterBarParams
  obj = Object.assign(obj, defaultParams.value)
  if (props.BySearchWord) {
    obj = Object.assign(obj, { name: name.value })
  }
  if (props.ByGrop) {
    obj = Object.assign(obj, { groupName: groupName.value })
  }
  if (props.ByDayOrHour) {
    obj = Object.assign(obj, { groupName: groupName.value, timeType: timeType.value })
  }
  return obj
})

const emitParams = debounce((newVal: CustomFilterBarParams) => {
  commonData = newVal
  void nextTick(() => {
    setTopFilterParams(newVal)
  })
}, 500)

watch(
  commonParams,
  (newVal, oldVal) => {
    if (JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
      emitParams(newVal)
    }
  },
  { deep: true, immediate: false },
)

function collapseResetApiList() {
  timeType.value = 'day'
  timeFlag.value = 'day'
  handleChange(timeFlag.value)
}

function collapseRefreshApi() {
  loadingApi.value = true
  if (!commonData) {
    commonData = commonParams.value
  }
  setTopFilterParams(commonData)
  setTimeout(() => {
    loadingApi.value = false
  }, 500)
}

function customAnalysisRefreshApi(isRefresh?: string) {
  emit('startAnalysiApi', isRefresh)
}

/** 单选切换时间 */
function handleChange(val: string | number | boolean | undefined) {
  checked.value = false // 暂定清空日期
  _contrastFlag = false
  checkLabel.value = '对比时间段'
  const dateTime = toDateNow()
  const toData = new Date(new Date().toLocaleDateString()).getTime() + 8 * 3600 * 1000

  if (val == 'day') {
    currentTime.value = [dateTime, dateTime]
    dateTimeCount(1)
    timeType.value = 'day'
  } else if (val == 'previous') {
    timeDifference = toData - 3600 * 24 * 1000
    timestampToTime(timeDifference)
    currentTime.value = [checkDateTime, checkDateTime]
    dateTimeCount(1)
    timeType.value = 'day'
  } else if (val == 'week') {
    timeDifference = toData - 6 * 3600 * 24 * 1000
    timestampToTime(timeDifference)
    currentTime.value = [checkDateTime, dateTime]
    dateTimeCount(6)
    timeType.value = 'day'
  } else {
    timeDifference = toData - 29 * 3600 * 24 * 1000
    timestampToTime(timeDifference)
    currentTime.value = [checkDateTime, dateTime]
    dateTimeCount(29)
    timeType.value = 'day'
  }
  startTime.value = currentTime.value[0] ?? ''
  endTime.value = currentTime.value[1] ?? ''
}

/** 日期计算：决定「按日/按周/按月」哪些可选 */
function dateTimeCount(result: number) {
  // 与 v2 一致（v2 此处逻辑存疑：原写法是 `if (6 <= result <= 29)`，JS 会先算 `6 <= result` 得到布尔、
  // 再拿布尔和 29 比较，结果恒为 true，即该分支无条件执行）
  weekFlag.value = false
  dayFlag.value = false
  monthFlag.value = true

  if (result >= 29) {
    monthFlag.value = false
    weekFlag.value = false
    dayFlag.value = false
  }
  if (result < 6) {
    dayFlag.value = false
    monthFlag.value = true
    weekFlag.value = false
  }
}

/** 按时 按日：根据起止时间反推顶部单选的选中项 */
function anTimeEcho() {
  const toDate = todateFunc() // 当日
  const timeStamp = new Date(endTime.value).getTime() - new Date(startTime.value).getTime()
  if (timeStamp == 0) {
    if (toDate == startTime.value) {
      timeFlag.value = 'day'
    } else {
      timeFlag.value = 'previous'
    }
  } else if (timeStamp == 518400000) {
    timeFlag.value = 'week'
  } else if (timeStamp == 2505600000) {
    timeFlag.value = 'month'
  } else {
    timeFlag.value = ''
  }
}

function toDateNow() {
  const date = new Date()
  return (
    date.getFullYear() +
    '-' +
    (date.getMonth() + 1 < 10 ? '0' + (date.getMonth() + 1) : date.getMonth() + 1) +
    '-' +
    (date.getDate() < 10 ? '0' + date.getDate() : date.getDate())
  )
}

/** 时间戳转换器 */
function timestampToTime(timestamp: number) {
  const date = new Date(timestamp)
  const Y = date.getFullYear() + '-'
  const M = (date.getMonth() + 1 < 10 ? '0' + (date.getMonth() + 1) : date.getMonth() + 1) + '-'
  const D = (date.getDate() < 10 ? '0' + date.getDate() : date.getDate()) + ''
  checkDateTime = Y + M + D
}

/** 默认初始日期 */
function initDateHandle() {
  const date = new Date()
  const dateTime =
    date.getFullYear() +
    '-' +
    (date.getMonth() + 1 < 10 ? '0' + (date.getMonth() + 1) : date.getMonth() + 1) +
    '-' +
    (date.getDate() < 10 ? '0' + date.getDate() : date.getDate())
  currentTime.value = [dateTime, dateTime]
  initDate(currentTime.value) // 默认日期
}

/** 日期初始值（v2 这里还算了一个没用上的 result，已省略） */
function initDate(val: string[]) {
  startTime.value = val[0] ?? ''
  endTime.value = val[1] ?? ''
}

function setTopFilterParams(val: CustomFilterBarParams) {
  emit('setFilterBarParams', val)
}

function checkDateEvnet(val: string[] | null) {
  checked.value = false // 暂定清空日期
  _contrastFlag = false
  checkLabel.value = '对比时间段'
  _contrastValue = ''
  timeFlag.value = ''
  // 与 v2 一致（v2 此处逻辑存疑：清空日期时 el-date-picker 给的是 null，
  // v2 直接取 val[0] 会抛 TypeError；这里在前面的复位做完之后再兜住空值）
  if (!val || val.length < 2) return
  startTime.value = val[0] ?? ''
  endTime.value = val[1] ?? ''
  changeTimestamp(startTime.value, endTime.value)
}

/** 计算时间戳，决定「按日/按周/按月」的可选性与默认值 */
function changeTimestamp(start: string, end: string) {
  const endTimed = new Date(end).getTime()
  const startTimed = new Date(start).getTime()
  const timeStamp = endTimed - startTimed
  if (timeStamp == 0) {
    timeType.value = 'day'
    monthFlag.value = true
    weekFlag.value = true
    dayFlag.value = false
    // 604800000
  } else if (timeStamp <= 604800000) {
    timeType.value = 'day'
    monthFlag.value = true
    weekFlag.value = false
    dayFlag.value = false
  }
  // 2592000000
  else if (timeStamp <= 2592000000) {
    // 三个月
    timeType.value = 'day'
    monthFlag.value = false
    weekFlag.value = false
    dayFlag.value = false
  } else if (timeStamp <= 15552000000) {
    // 六个月
    timeType.value = 'week'
    monthFlag.value = false
    weekFlag.value = false
    dayFlag.value = false
  } else if (timeStamp >= 31536000000) {
    timeType.value = 'month'
    monthFlag.value = false
    weekFlag.value = false
    dayFlag.value = false
  }
}

function checkTimeSlot(val: string | number | boolean | undefined) {
  switch (val) {
    case true:
      checkLabel.value = '对比'
      _contrastValue = ''
      break
    case false:
      checkLabel.value = '对比时间段'
      _contrastValue = ''
      // v2 这里还写了 this.dateFlag = null，dateFlag 既未声明也无任何读取方，迁移时省略
      break
  }
  _contrastFlag = val === true
}

// ===== bus 监听（卸载时必须逐个 off，且要用同一个 handler 引用） =====
const onIsOpen = (val: unknown) => {
  isNotAnalysis.value = val as boolean
}
/** 初始调用漏斗接口 */
const onRefreshRoute = () => {
  customAnalysisRefreshApi()
}
const onIsDisable = (val: unknown) => {
  isDisableBtn.value = val as boolean
}

onMounted(() => {
  // 参数更新
  if (route.query.query) {
    const routeObj = JSON.parse(route.query.query as string) as {
      startDate: string
      endDate: string
      dataType: string
      timeFlag?: string
    }
    startTime.value = routeObj.startDate
    endTime.value = routeObj.endDate
    timeType.value = routeObj.dataType
    currentTime.value = [startTime.value, endTime.value]
    // 今日/昨天/近7天/近30天 相关逻辑
    if (routeObj.timeFlag) {
      timeFlag.value = routeObj.timeFlag
      // 与 v2 一致：v2 这里把 handleChange(this.timeFlag) 注释掉了
    }
    anTimeEcho()

    // 计算开始时间和结束时间之间的天数
    const startDate = new Date(startTime.value)
    const endDate = new Date(endTime.value)
    const timeDiff = endDate.getTime() - startDate.getTime()
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1 // 加1是因为包含开始日期
    dateTimeCount(daysDiff)
  } else {
    initDateHandle()
  }
  bus.on('$isOpen', onIsOpen)
  bus.on('$refreshRoute', onRefreshRoute)
  bus.on('$isDisable', onIsDisable)
})

onBeforeUnmount(() => {
  // v2 的 beforeDestroy 只 off 了 $isOpen，$refreshRoute / $isDisable 是漏掉的，这里一并清理
  bus.off('$isOpen', onIsOpen)
  bus.off('$refreshRoute', onRefreshRoute)
  bus.off('$isDisable', onIsDisable)
  emitParams.cancel()
})
</script>

<style lang="scss" scoped>
@use '@/styles/components/TopFilter.scss';

// v2 这里还在 ::v-deep 里 @import 了 custom-radio.scss；
// v3 已在 src/styles/index.scss 全局 @use，且 @use 不允许出现在嵌套块内，故不再引入。
:deep(.el-radio-button--small .el-radio-button__inner) {
  padding: 9px 15px;
}

:deep(.el-checkbox__input.is-checked + .el-checkbox__label) {
  color: #4d4d4d;
}

:deep(.el-checkbox__label) {
  font-size: 13px;
}

// 日历样式start
:deep(.el-range-editor .el-range-input) {
  font-size: 13px;
}

:deep(.el-date-editor .el-range__icon) {
  font-size: 13px;
  line-height: 24px;
}

:deep(.el-range-editor .el-range-separator) {
  font-size: 13px;
  line-height: 24px;
}

:deep(.custom_input .el-input__inner) {
  font-size: 11px;
}

:deep(.custom_input .el-input__inner) {
  width: 250px !important;
}

:deep(.el-button) {
  padding: 0 20px;
}

:deep(.el-input__wrapper) {
  height: 30px;
  line-height: 30px;
}

:deep(.el-input__icon) {
  line-height: 30px;
}

:deep(.el-input__inner) {
  font-size: 13px;
}

:deep(.single_select .el-input__inner) {
  border-radius: 0px;
  border-top-width: 0px;
  border-left-width: 0px;
  border-right-width: 0px;
  border-bottom: 1px solid #acb2ba;
  background-color: transparent;
  font-size: 12px;
  height: 30px;
  line-height: 30px;
  border-bottom-width: 0;
  padding-left: 10px;
  width: 100px;
}

.custom_button {
  height: 30px;
  color: #fff;
  font-size: 13px;
  background-color: #2c7be5;
}

.headerFilter {
  min-height: 60px;
  color: #194580;
  font-size: 13px;
  background: #fff;
  box-sizing: border-box;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: nowrap !important;
  overflow-x: auto;

  .tabBar {
    min-height: 60px;
    position: fixed;
    z-index: 999;
    background: #fff;
    display: flex;
    flex-direction: column;
    flex-wrap: nowrap !important;
    justify-content: center;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 15px 20px;
    box-sizing: border-box;
    width: 100%;
  }

  .check_item {
    background-color: #ffffff;
    height: 30px;
    border-radius: 4px;
    display: flex;
    align-items: center;

    span {
      font-size: 13px;
      font-weight: 400;
      line-height: 13px;
      color: #4d4d4d;
      padding: 0 10px;
    }

    .checkBoxStyle {
      padding-right: 10px;
    }
  }

  .singleItem {
    display: flex;
    margin-right: 30px;
  }

  .setTitle {
    height: 30px;
    line-height: 30px;
  }

  .custom_select {
    width: 100px;
    margin-left: 10px;
    height: 30px;
    line-height: 30px;
  }

  .warry_select {
    display: flex;
    border: 1px solid #acb2ba;
    border-radius: 4px;
    align-items: center;
    height: 30px;
    margin-right: 20px;

    .title {
      font-size: 12px;
      color: #4d4d4d;
      padding-left: 6px;
      white-space: nowrap;
    }
  }
}
</style>
