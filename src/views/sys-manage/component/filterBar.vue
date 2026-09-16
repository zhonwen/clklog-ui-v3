<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Refresh, RefreshRight } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import { bus } from '@/utils/event-bus'

/**
 * sys-manage 模块自带的筛选条（v2 src/views/sys-manage/component/filterBar.vue）。
 * 与 layout 里的公共 FilterBar 不是同一个组件：这里的时间单选多了「上线至今」，
 * 且默认值就是「上线至今」（startTime / endTime 为空串）。
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

const loadingApi = ref(false)
/** 是否展示开始分析，由事件总线 $isOpen 写入 */
const isNotAnalysis = ref(true)
const monthFlag = ref(false)
const weekFlag = ref(false)
const dayFlag = ref(false)
const timeType = ref('hour')
const checked = ref(false)
const contrastFlag = ref(false)
const checkLabel = ref('对比时间段')
/** 对比时间 */
const contrastValue = ref('')
const timeFlag = ref<string | null>('')
// 与 v2 一致（v2 此处逻辑存疑：currentTime 初值是空串 ""，daterange 的 v-model 应当是数组；
// 这里改成空数组，语义同样是「未选择」，避免类型冲突）
const currentTime = ref<string[]>([])
const groupName = ref('')
const startTime = ref('')
const endTime = ref('')
/** 搜索词 */
const name = ref('')
const commonData = ref<Record<string, unknown> | null>(null)

// v2 里 checkDateTime / timeDifference 是运行时直接挂到 this 上的、未声明的非响应式临时值
let checkDateTime = ''
let timeDifference = 0
let refreshTimer: ReturnType<typeof setTimeout> | null = null

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
  return obj
})

function setTopFilterParams(val: Record<string, unknown>) {
  emit('setFilterBarParams', val)
}

watch(commonParams, (newVal, oldVal) => {
  commonData.value = newVal
  if (JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
    void nextTick(() => {
      setTopFilterParams(newVal)
    })
  }
})

function refreshApiList() {
  loadingApi.value = true
  if (!commonData.value) {
    commonData.value = commonParams.value
  }
  setTopFilterParams(commonData.value)
  refreshTimer = setTimeout(() => {
    loadingApi.value = false
  }, 500)
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
  } else if (val == 'month') {
    timeDifference = toData - 29 * 3600 * 24 * 1000
    timestampToTime(timeDifference)
    currentTime.value = [checkDateTime, dateTime]
  } else {
    startTime.value = ''
    endTime.value = ''
    currentTime.value = ['', '']
    return
  }
  startTime.value = currentTime.value[0] ?? ''
  endTime.value = currentTime.value[1] ?? ''
}

function resetApiList() {
  timeFlag.value = ''
  handleChange('')
}

function checkDateEvnet(val: string[] | null) {
  checked.value = false // 暂定清空日期
  contrastFlag.value = false
  checkLabel.value = '对比时间段'
  contrastValue.value = ''
  timeFlag.value = null
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

function handleIsOpen(val: unknown) {
  isNotAnalysis.value = Boolean(val)
}

onMounted(() => {
  bus.on('$isOpen', handleIsOpen)
  setTopFilterParams(defaultParams.value)
})

onBeforeUnmount(() => {
  // mitt 的 off 必须传同一个 handler 引用
  bus.off('$isOpen', handleIsOpen)
  if (refreshTimer) clearTimeout(refreshTimer)
})
</script>

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
                <el-radio value="">上线至今</el-radio>
                <el-radio value="day">今日</el-radio>
                <el-radio value="previous">昨日</el-radio>
                <el-radio value="week">过去7天</el-radio>
                <el-radio value="month">过去30天</el-radio>
              </el-radio-group>
            </div>
            <el-date-picker
              v-model="currentTime"
              class="timnePickCSS"
              style="width: 250px; height: 30px"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
              :disabled-date="disabledDate"
              :shortcuts="pickerShortcuts"
              @change="checkDateEvnet"
            />
            <div v-if="ByContrast" style="margin-left: 20px; line-height: 30px">
              <el-checkbox v-model="checked" @change="checkTimeSlot">{{ checkLabel }}</el-checkbox>
            </div>

            <div v-if="ByDayOrHour">
              <el-radio-group
                v-model="timeType"
                size="small"
                style="font-size: 13px; height: 30px; margin-left: 20px"
              >
                <el-radio-button value="hour" :disabled="dayFlag">按时</el-radio-button>
                <el-radio-button value="day" :disabled="dayFlag">按日</el-radio-button>
                <el-radio-button value="week" :disabled="weekFlag">按周</el-radio-button>
                <el-radio-button value="month" :disabled="monthFlag">按月</el-radio-button>
              </el-radio-group>
            </div>

            <div
              :style="
                device == 'desktop'
                  ? 'position: fixed; right: 0px'
                  : 'position:relative;margin-left:50px;margin-right:30px'
              "
            >
              <div class="tabBarBtn" style="position: relative">
                <el-button
                  v-loading="loadingApi"
                  class="zc_btn refresh"
                  element-loading-background="#fff"
                  @click="refreshApiList"
                >
                  <el-icon><RefreshRight /></el-icon>刷新
                </el-button>
                <el-button class="zc_btn_default reset" @click="resetApiList">
                  <el-icon><Refresh /></el-icon>重置
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
// v2 这里还 @import 了 TopFilter.scss 与 custom-radio.scss：
// 前者的 .TopFilter 本组件并未使用；后者已在 v3 src/styles/index.scss 全局引入，
// 且 sass 不允许 @use 出现在嵌套块内，这里都不再重复引入。
:deep() {
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
  .el-loading-spinner {
    margin-top: -6px;
  }

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
    padding: 15px 20px;
    position: fixed;
    z-index: 999;
    background: #fff;
    display: flex;
    flex-direction: column;
    flex-wrap: nowrap !important;
    justify-content: center;
    overflow-x: auto;
    overflow-y: hidden;
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
