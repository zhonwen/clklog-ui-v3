<script setup lang="ts">
import { computed, nextTick, watch, ref } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { copyObj } from '@/utils/copy'
import { todateFunc } from '@/utils/date'
import { useAppStore } from '@/stores/app'

/**
 * 崩溃设备弹窗里的筛选条（v2 src/views/collapse-analysis/components/eventBar.vue）。
 *
 * 与 analysis-modules/event-analysis 下的同名组件不是一个东西：
 * 这里多了「应用版本 / 操作系统 / 设备类型」三个筛选项，少了分组与事件名搜索。
 */
const props = withDefaults(
  defineProps<{
    /** 对比事件 */
    ByContrast?: boolean
    BySearchWord?: boolean
    ByRefresh?: boolean
    ByDayOrHour?: boolean
  }>(),
  {
    ByContrast: false,
    BySearchWord: false,
    ByRefresh: false,
    ByDayOrHour: false,
  },
)

const emit = defineEmits<{
  setFilterBarParams: [val: Record<string, unknown>]
}>()

const appStore = useAppStore()

type SelectOption = { label: string; id: string }

const allChaneList: SelectOption[] = [
  { label: '全部', id: '' },
  { label: '安卓', id: '安卓' },
  { label: '苹果', id: '苹果' },
]

const monthFlag = ref(true)
const weekFlag = ref(true)
const dayFlag = ref(false)
const timeType = ref('day')
const channel = ref('')
const checked = ref(false)
const contrastFlag = ref(false)
const checkLabel = ref('对比时间段')
/** 对比时间 */
const contrastValue = ref('')
const timeFlag = ref('day')
// 与 v2 一致（v2 此处逻辑存疑：currentTime 初值写成空串 ""，daterange 的 v-model 应当是数组；
// 这里改成空数组，语义同样是「未选择」，避免类型冲突）
const currentTime = ref<string[]>([])
const startTime = ref('')
const endTime = ref('')
/** 搜索词 */
const name = ref('')
/** 事件名称 */
const eventName = ref('')
const versionEqual = ref('')
const version = ref('')
const modelEqual = ref('')
const model = ref('')
const commonData = ref<Record<string, unknown> | ''>('')

// v2 里这些是运行时直接挂到 this 上的、未声明的非响应式临时值
let checkDateTime = ''
let timeDifference = 0
// 「第几次触发」：statisticEvent 会把它重置成 1，只有 > 1 时才向外 emit，
// 用来吃掉弹窗打开时由灌值引起的那一次参数变化
let apiFlagRefresh = 1

const disabledDate = (date: Date) => {
  const today = new Date()
  return date.getTime() > today.getTime()
}

const pickerShortcuts = [
  {
    text: '近一周',
    value: () => {
      const end = new Date()
      const start = new Date()
      start.setTime(start.getTime() - 3600 * 1000 * 24 * 7)
      return [start, end]
    },
  },
  {
    text: '近一个月',
    value: () => {
      const end = new Date()
      const start = new Date()
      start.setTime(start.getTime() - 3600 * 1000 * 24 * 30)
      return [start, end]
    },
  },
  {
    text: '近三个月',
    value: () => {
      const end = new Date()
      const start = new Date()
      start.setTime(start.getTime() - 3600 * 1000 * 24 * 90)
      return [start, end]
    },
  },
  {
    text: '近六个月',
    value: () => {
      const end = new Date()
      const start = new Date()
      start.setTime(start.getTime() - 3600 * 1000 * 24 * 180)
      return [start, end]
    },
  },
  {
    text: '近一年',
    value: () => {
      const end = new Date()
      const start = new Date()
      start.setTime(start.getTime() - 3600 * 1000 * 24 * 365)
      return [start, end]
    },
  },
]

const device = computed(() => appStore.device || 'desktop')

const defaultParams = computed(() => ({
  startTime: startTime.value,
  endTime: endTime.value,
  version: version.value,
  channel: channel.value,
  model: model.value,
}))

const commonParams = computed<Record<string, unknown>>(() => {
  let obj: Record<string, unknown> = {}
  obj = Object.assign(obj, defaultParams.value)
  if (props.BySearchWord) {
    obj = Object.assign(obj, { name: name.value })
  }
  if (props.ByDayOrHour) {
    obj = Object.assign(obj, { timeType: timeType.value })
  }
  return obj
})

function setTopFilterParams(val: Record<string, unknown>) {
  emit('setFilterBarParams', val)
}

function searchVersion() {
  version.value = versionEqual.value
}

function searchmodel() {
  model.value = modelEqual.value
}

function yesterdayFunc() {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  const year = yesterday.getFullYear()
  const month =
    yesterday.getMonth() + 1 < 10 ? '0' + (yesterday.getMonth() + 1) : yesterday.getMonth() + 1
  const day = yesterday.getDate() < 10 ? '0' + yesterday.getDate() : yesterday.getDate()

  return year + '-' + month + '-' + day
}

function byCheckimeEvent(timeStamp: number) {
  if (timeStamp == 0) {
    timeType.value = 'day'
  } else if (timeStamp >= 518400000 && timeStamp < 2592000000) {
    timeType.value = 'day'
  } else if (timeStamp >= 2592000000 && timeStamp < 7776000000) {
    timeType.value = 'week'
  } else {
    timeType.value = 'month'
  }
}

/**
 * 由父组件（dialog.vue）通过 ref 调用：拿父级筛选条的参数反推单选项与统计粒度。
 * 518400000 = 6 天、2505600000 = 29 天，对应「过去7天 / 过去30天」两个档。
 */
function statisticEvent(params: Record<string, unknown>, flag: number) {
  apiFlagRefresh = flag
  const toDate = todateFunc() // 当日
  const paramStart = String(params.startTime ?? '')
  const paramEnd = String(params.endTime ?? '')
  const timeStamp = new Date(paramEnd).getTime() - new Date(paramStart).getTime()
  if (timeStamp == 0) {
    if (toDate == paramStart) {
      timeFlag.value = 'day'
    } else if (paramStart == yesterdayFunc()) {
      timeFlag.value = 'previous'
    } else {
      timeFlag.value = ''
    }
  } else if (timeStamp == 518400000) {
    timeFlag.value = 'week'
  } else if (timeStamp == 2505600000) {
    timeFlag.value = 'month'
  } else {
    timeFlag.value = ''
  }
  currentTime.value = [paramStart, paramEnd]
  startTime.value = paramStart
  endTime.value = paramEnd
  eventName.value = String(params.eventName ?? '')
  byCheckimeEvent(timeStamp)
  // v2 这里注释掉了一段「把 Android/苹果 回显到下拉」的逻辑，直接用 toString()
  channel.value = Array.isArray(params.channel)
    ? (params.channel as unknown[]).toString()
    : String(params.channel ?? '')

  modelEqual.value = String(params.model ?? '')
  // 与 v2 一致（v2 此处逻辑存疑：searchVersion() 在 versionEqual 被赋值之前调用，
  // 于是 version 拿到的是上一次的旧值；而下面的 searchmodel() 是在 modelEqual 赋值之后调用的，行为不一致）
  searchVersion()
  versionEqual.value = String(params.version ?? '')
  searchmodel()
}

function refreshAPI() {
  const params = copyObj(commonParams.value)
  params.name = modelEqual.value
  setTopFilterParams(params)
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

/** 单选切换时间 */
function handleChange(val: string | number | boolean | undefined) {
  checked.value = false // 暂定清空日期
  contrastFlag.value = false
  checkLabel.value = '对比时间段'
  const dateTime = toDateNow()
  const toData = new Date(new Date().toLocaleDateString()).getTime() + 8 * 3600 * 1000
  if (val == 'day') {
    currentTime.value = [dateTime, dateTime]
  } else if (val == 'previous') {
    timeDifference = toData - 3600 * 24 * 1000
    timestampToTime(timeDifference)
    currentTime.value = [checkDateTime, checkDateTime]
  } else if (val == 'week') {
    timeDifference = toData - 6 * 3600 * 24 * 1000
    timestampToTime(timeDifference)
    currentTime.value = [checkDateTime, dateTime]
  } else {
    // 与 v2 一致：除 day / previous / week 外的所有取值都按「过去30天」处理
    timeDifference = toData - 29 * 3600 * 24 * 1000
    timestampToTime(timeDifference)
    currentTime.value = [checkDateTime, dateTime]
  }
  startTime.value = currentTime.value[0] ?? ''
  endTime.value = currentTime.value[1] ?? ''
}

function checkDateEvnet(val: string[] | null) {
  checked.value = false // 暂定清空日期
  contrastFlag.value = false
  checkLabel.value = '对比时间段'
  contrastValue.value = ''
  timeFlag.value = ''
  // 与 v2 一致（v2 此处逻辑存疑：清空日期时 el-date-picker 给的是 null，
  // v2 直接取 val[0] 会抛 TypeError；这里在前面的复位做完之后再兜住空值）
  if (!val || val.length < 2) return
  startTime.value = val[0] ?? ''
  endTime.value = val[1] ?? ''
}

function checkTimeSlot(val: string | number | boolean | undefined) {
  switch (val) {
    case true:
      checkLabel.value = '对比'
      contrastValue.value = ''
      break
    case false:
      checkLabel.value = '对比时间段'
      contrastValue.value = ''
      // v2 这里还写了 this.dateFlag = null，dateFlag 既未声明也无任何读取方，迁移时省略
      break
  }
  contrastFlag.value = val === true
}

watch(commonParams, (newVal, oldVal) => {
  if (JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
    void nextTick(() => {
      commonData.value = newVal
      if (apiFlagRefresh > 1) {
        setTopFilterParams(newVal)
      }
      apiFlagRefresh++
    })
  }
})

// v2 里父组件用 this.$refs.eventBar.statisticEvent(params, 1) 调用，<script setup> 默认对外封闭
defineExpose({ statisticEvent })
</script>

<template>
  <div>
    <div class="documentation-container">
      <div class="headerFilter">
        <!-- 第一行 -->
        <div class="tabBar">
          <div style="display: flex; align-items: center; white-space: nowrap">
            <!-- style="height: 30" 是 v2 原样保留的写法（缺单位，浏览器会忽略） -->
            <div class="check_item public_border_color" style="height: 30">
              <span>时间:</span>
              <el-radio-group v-model="timeFlag" class="checkBoxStyle" @change="handleChange">
                <el-radio value="day">今日</el-radio>
                <el-radio value="previous">昨日</el-radio>
                <el-radio value="week">过去7天</el-radio>
                <el-radio value="month">过去30天</el-radio>
              </el-radio-group>
            </div>
            <div v-if="ByDayOrHour" style="margin-left: 20px">
              <el-radio-group v-model="timeType" size="small" style="font-size: 13px; height: 30px">
                <!-- v2 注释掉了「按时」这一档 -->
                <!-- <el-radio-button value="hour" :disabled="dayFlag">按时</el-radio-button> -->
                <el-radio-button value="day" :disabled="dayFlag">按日</el-radio-button>
                <el-radio-button value="week" :disabled="weekFlag">按周</el-radio-button>
                <el-radio-button value="month" :disabled="monthFlag">按月</el-radio-button>
              </el-radio-group>
            </div>

            <div v-if="ByContrast" style="margin-left: 20px; line-height: 30px">
              <el-checkbox v-model="checked" @change="checkTimeSlot">{{ checkLabel }}</el-checkbox>
            </div>

            <div
              v-if="ByRefresh"
              :style="
                device == 'desktop'
                  ? 'position: fixed; right: 50px'
                  : 'position:relative;margin-left:50px;margin-right:30px'
              "
            >
              <el-button class="custom_button" @click="refreshAPI">查询</el-button>
            </div>
            <!-- 日期 -->
            <el-date-picker
              v-model="currentTime"
              class="timnePickCSS"
              style="margin-left: 20px; width: 250px; height: 30px"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
              :disabled-date="disabledDate"
              :shortcuts="pickerShortcuts"
              @change="checkDateEvnet"
            />
          </div>

          <!-- 第二行 -->
          <div style="display: flex; margin-left: 20px; margin-top: 12px">
            <!-- v2 这里注释掉了一个「应用版本」下拉，改用下面的输入框 -->
            <el-input
              v-model="versionEqual"
              class="custom_input"
              placeholder="请输入应用版本"
              style="width: 200px; border-radius: 4px"
              clearable
              @keyup.enter="searchVersion()"
              @blur="searchVersion"
              @clear="searchVersion"
            >
              <template #prefix>
                <el-icon class="el-input__icon" style="cursor: pointer" @click="searchVersion">
                  <Search />
                </el-icon>
              </template>
            </el-input>

            <div class="warry_select">
              <div class="title">操作系统:</div>
              <el-select v-model="channel" style="width: 100px" class="single_select">
                <el-option
                  v-for="item in allChaneList"
                  :key="item.id"
                  :label="item.label"
                  :value="item.id"
                />
              </el-select>
            </div>
            <el-input
              v-model="modelEqual"
              class="custom_input"
              style="width: 250px; border-radius: 4px; height: 30px"
              placeholder="请输入设备类型"
              clearable
              @keyup.enter="searchmodel()"
              @clear="searchmodel"
              @blur="searchmodel"
            >
              <template #prefix>
                <el-icon class="el-input__icon" style="cursor: pointer" @click="searchmodel">
                  <Search />
                </el-icon>
              </template>
            </el-input>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
// v2 这里还 @import 了 TopFilter.scss 与 custom-radio.scss：
// 前者只提供 .TopFilter / .radio-com，本组件并未使用；后者已在 v3 src/styles/index.scss 全局引入，
// 且 sass 不允许 @use 出现在嵌套块内（会整页编译失败），这里都不再重复引入。
:deep() {
  // v2 是 .el-radio-button--mini，element-plus 的 mini 档已并入 small
  .el-radio-button--small .el-radio-button__inner {
    padding: 9px 15px;
  }

  .el-checkbox__input.is-checked + .el-checkbox__label {
    color: #4d4d4d;
  }

  .el-checkbox__label {
    font-size: 13px;
  }

  .warry_select {
    display: flex;
    border: 1px solid #d5dfed;
    border-radius: 4px;
    align-items: center;
    min-height: 30px;
    margin-right: 20px;
    width: 153px;

    .title {
      font-size: 12px;
      color: #4d4d4d;
      padding-left: 6px;
      white-space: nowrap;
    }
  }

  // 日历样式start
  .el-range-editor--medium .el-range-input {
    font-size: 13px;
  }

  .el-date-editor .el-range__icon {
    font-size: 13px;
    line-height: 24px;
  }

  .el-range-editor--medium .el-range-separator {
    font-size: 13px;
    line-height: 24px;
  }
}

:deep() {
  .custom_input {
    .el-input__inner {
      font-size: 11px;
    }
  }

  .custom_input .el-input--medium .el-input__inner {
    width: 250px !important;
  }

  .el-button--medium {
    padding: 0 20px;
  }

  .el-input--medium .el-input__inner {
    height: 30px;
    line-height: 30px;
  }

  .el-input--medium .el-input__icon {
    line-height: 30px;
  }

  .el-input__inner {
    font-size: 13px;
  }

  .single_select .el-input__inner {
    border-radius: 0px;
    border-top-width: 0px;
    border-left-width: 0px;
    border-right-width: 0px;
    border-bottom-width: 1px;
    border-bottom: 1px solid #acb2ba;
    background-color: transparent;
    font-size: 12px;
    height: 30px;
    line-height: 30px;
    border-bottom-width: 0;
    padding-left: 10px;
    width: 100px;
  }
}

.custom_button {
  height: 30px;
  color: #fff;
  font-size: 13px;
  background-color: #2c7be5;
}

.headerFilter {
  .tabBar {
    min-height: 105px;
    width: calc(80vw - 40px);
    border-radius: 6px;
    background: #fff;
    display: flex;
    flex-direction: column;
    flex-wrap: nowrap !important;
    justify-content: center;
    overflow-x: auto;
    overflow-y: hidden;
    box-sizing: border-box;
  }

  .check_item {
    background-color: #ffffff;
    margin-left: 20px;
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
    border: 1px solid #d5dfed;
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
