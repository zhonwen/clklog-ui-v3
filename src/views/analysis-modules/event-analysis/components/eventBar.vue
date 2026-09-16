<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { copyObj } from '@/utils/copy'
import { todateFunc } from '@/utils/date'
import { getGroupNameListEventApi } from '@/api/sysmanage/manageEvent'
import { useAppStore } from '@/stores/app'
import { useTrackingStore } from '@/stores/tracking'
import { useLatestOnly } from '@/composables/useLatestOnly'

/**
 * 事件详情弹窗里的筛选条（v2 src/views/analysis-modules/event-analysis/components/eventBar.vue）。
 * 与同模块的 analysisBar 不是同一个组件：这里多了 eventName 透传、timeType 反推，
 * 且默认不做 initDateHandle（初值由父组件通过 statisticEvent 灌入）。
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
    ByDayOrHour: false,
  },
)

const emit = defineEmits<{
  setFilterBarParams: [val: Record<string, unknown>]
}>()

const appStore = useAppStore()
const trackingStore = useTrackingStore()

type SelectOption = { label: string; value: string }

const monthFlag = ref(false)
const weekFlag = ref(false)
const dayFlag = ref(false)
const timeType = ref('day')
const groupList = ref<SelectOption[]>([])
const all: SelectOption = { label: '全部', value: '' }
const checked = ref(false)
const contrastFlag = ref(false)
const checkLabel = ref('对比时间段')
/** 对比时间 */
const contrastValue = ref('')
const timeFlag = ref('day')
// 与 v2 一致（v2 此处逻辑存疑：currentTime 初值写成空串 ""，daterange 的 v-model 应当是数组；
// 这里改成空数组，语义同样是「未选择」，避免类型冲突）
const currentTime = ref<string[]>([])
const groupName = ref('')
const searchWord = ref('')
const startTime = ref('')
const endTime = ref('')
/** 搜索词 */
const name = ref('')
/** 事件名称 */
const eventName = ref('')

// v2 里 checkDateTime / timeDifference 是运行时直接挂到 this 上的、未声明的非响应式临时值
let checkDateTime = ''
let timeDifference = 0

const { next, isLatest } = useLatestOnly()

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

const projectName = computed(() => trackingStore.projectName)
const device = computed(() => appStore.device || 'desktop')

const defaultParams = computed(() => ({
  startTime: startTime.value,
  endTime: endTime.value,
  eventName: eventName.value,
}))

const commonParams = computed<Record<string, unknown>>(() => {
  let obj: Record<string, unknown> = {}
  obj = Object.assign(obj, defaultParams.value)
  if (props.BySearchWord) {
    obj = Object.assign(obj, { name: name.value })
  }
  if (props.ByGrop) {
    obj = Object.assign(obj, { groupName: groupName.value })
  }
  if (props.ByDayOrHour) {
    obj = Object.assign(obj, { timeType: timeType.value })
  }
  return obj
})

function setTopFilterParams(val: Record<string, unknown>) {
  emit('setFilterBarParams', val)
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
 * 由父组件（event_dialog）通过 ref 调用：拿父级筛选条的时间区间反推单选项与统计粒度。
 * 518400000 = 6 天、2505600000 = 29 天，对应「过去7天 / 过去30天」两个档。
 */
function statisticEvent(params: Record<string, unknown>) {
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
}

function refreshAPI() {
  const params = copyObj(commonParams.value)
  params.name = searchWord.value
  setTopFilterParams(params)
}

function getPageList() {
  const params = { projectName: projectName.value }
  if (props.ByGrop) {
    const token = next()
    getGroupNameListEventApi(params)
      .then((res) => {
        if (!isLatest(token)) return
        if (res?.code == 200) {
          const rows = (res.data || []) as unknown[]
          const filtered = rows.filter((item) => {
            if (typeof item === 'string') {
              return item.trim() !== ''
            }
            return true
          })
          groupList.value = filtered.map((item) => ({ label: String(item), value: String(item) }))
          groupList.value.unshift(all)
        }
      })
      .catch(() => {
        if (!isLatest(token)) return
      })
  }
}

function searchEvent() {
  name.value = searchWord.value
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
      setTopFilterParams(newVal)
    })
  }
})

onMounted(() => {
  // v2 这里注释掉了 initDateHandle()，初始区间由父组件 statisticEvent 灌入
  getPageList() // 事件分组
})

// v2 里父组件用 this.$refs.eventBar.statisticEvent(...) 调用，<script setup> 默认对外封闭，必须显式暴露
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
          </div>

          <!-- 第二行 -->
          <div style="display: flex; margin-left: 20px; margin-top: 12px">
            <!-- 日期1 -->
            <div style="height: 30px; line-height: 30px">自定义时间</div>
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
            <div v-if="ByGrop" class="warry_select">
              <div class="title">分组:</div>
              <el-select v-model="groupName" class="single_select" placeholder="请选择状态">
                <el-option
                  v-for="item in groupList"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </div>
            <el-input
              v-if="BySearchWord"
              v-model="searchWord"
              class="custom_input"
              style="width: 250px; border-radius: 4px; height: 30px"
              placeholder="请输入事件名称、事件标识符搜索"
              clearable
              @keyup.enter="searchEvent()"
            >
              <template #prefix>
                <el-icon class="el-input__icon" style="cursor: pointer" @click="searchEvent">
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
// 前者的 .TopFilter 本组件并未使用；后者已在 v3 src/styles/index.scss 全局引入，
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
