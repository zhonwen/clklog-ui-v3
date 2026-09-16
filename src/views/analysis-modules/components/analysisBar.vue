<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { Refresh, RefreshRight, Search } from '@element-plus/icons-vue'
import type { CascaderOption, CascaderProps } from 'element-plus'
import { copyObj } from '@/utils/copy'
import { getGroupNameListEventApi, getGroupedPropertiesApi } from '@/api/sysmanage/manageEvent'
import { mergeCommonPropertiesToEvents } from '@/utils/mergeEventProperties'
import { useAppStore } from '@/stores/app'
import { useTrackingStore } from '@/stores/tracking'
import { useLatestOnly } from '@/composables/useLatestOnly'

/**
 * analysis-modules 的公共分析条（v2 src/views/analysis-modules/components/analysisBar.vue）。
 * 事件分析、日志分析共用；custom-analysis 有自己的 customBar，不走这里。
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
    BySearchCustom?: boolean
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
    BySearchCustom: false,
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
const timeType = ref('hour')
const groupList = ref<SelectOption[]>([])
const all: SelectOption = { label: '全部', value: '' }
const protoList = ref<CascaderOption[]>([])
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
const startTime = ref('')
const endTime = ref('')
/** 搜索词（真正进 commonParams 的那个） */
const name = ref('')
/** 级联选择器选中的事件英文名，默认 'all' 表示全部 */
const searchWord = ref('all')
/** 日志查询搜索词（输入框里的即时值，回车/点放大镜后才写进 name） */
const eventName = ref('')

// v2 里 checkDateTime / timeDifference 是运行时直接挂到 this 上的、未声明的非响应式临时值
let checkDateTime = ''
let timeDifference = 0

const { next: nextProto, isLatest: isLatestProto } = useLatestOnly()
const { next: nextGroup, isLatest: isLatestGroup } = useLatestOnly()

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

// v2 的 :props="{ value:'name', label:'displayName', children:'events', multiple:false, emitPath:false }"
const cascaderProps: CascaderProps = {
  value: 'name',
  label: 'displayName',
  children: 'events',
  multiple: false,
  emitPath: false,
}

const projectName = computed(() => trackingStore.projectName)
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
  if (props.BySearchCustom) {
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

function getPrototype() {
  const token = nextProto()
  getGroupedPropertiesApi({ projectName: projectName.value })
    .then((res) => {
      if (!isLatestProto(token)) return
      if (res?.code == 200) {
        if (res.data) {
          // 用 Parameters<> 取形参类型，避免为了一个类型去 import custom-analysis 模块
          const mergedData = mergeCommonPropertiesToEvents(
            res.data as Parameters<typeof mergeCommonPropertiesToEvents>[0],
          )
          protoList.value = (
            mergedData && mergedData.events ? mergedData.events : []
          ) as unknown as CascaderOption[]
          if (protoList.value.length > 0) {
            protoList.value.unshift({ displayName: '全部', name: 'all' })
          }
        } else {
          protoList.value = []
        }
      } else {
        protoList.value = []
      }
    })
    .catch((error) => {
      if (!isLatestProto(token)) return
      console.error('获取原型数据失败:', error)
      protoList.value = []
    })
}

function getPageList() {
  const params = { projectName: projectName.value }
  if (props.ByGrop) {
    const token = nextGroup()
    getGroupNameListEventApi(params)
      .then((res) => {
        if (!isLatestGroup(token)) return
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
        if (!isLatestGroup(token)) return
      })
  }
}

function refreshAPI() {
  const params = copyObj(commonParams.value)
  if (props.BySearchCustom) {
    // 联级事件-选中全部-需绑定非空值 all
    name.value = searchWord.value || 'all'
  } else {
    // 其它事件可 默认为''
    name.value = eventName.value
  }
  params.name = name.value
  setTopFilterParams(params)
}

function fileterCascader(event: unknown) {
  if (event && event !== 'all') {
    searchWord.value = String(event)
  }
  refreshAPI()
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

function collapseResetApiList() {
  timeFlag.value = 'day'
  handleChange(timeFlag.value)
  searchWord.value = 'all'
  eventName.value = ''
  name.value = ''
  groupName.value = ''
  // 重置后重新获取原型数据
  if (props.BySearchCustom) {
    getPrototype()
  }
}

function searchEvent() {
  name.value = eventName.value
}

/** 日期初始值 */
function initDate(val: string[]) {
  startTime.value = val[0] ?? ''
  endTime.value = val[1] ?? ''
  // v2 这里还算了一个 result = endTime - startTime，算完没有任何使用方，迁移时省略
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

watch(projectName, () => {
  groupName.value = ''
  searchWord.value = 'all'
  if (props.BySearchCustom) {
    // el-cascader-选中全部-需绑定非空值 all
    name.value = searchWord.value
    // 清空 protoList 以确保组件重新初始化
    protoList.value = []
  } else {
    // 其它事件可 默认为''
    name.value = eventName.value
  }
  // 与 v2 一致（v2 此处逻辑存疑：这里无条件拉原型数据，
  // 而 mounted 里只有 BySearchCustom 为真时才拉；不用级联的页面切项目会白发一次请求）
  getPrototype()
})

watch(commonParams, (newVal, oldVal) => {
  if (JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
    void nextTick(() => {
      setTopFilterParams(newVal)
    })
  }
})

onMounted(() => {
  initDateHandle()
  getPageList() // 事件分组
  // 只有在需要时才获取原型数据
  if (props.BySearchCustom) {
    getPrototype()
  }
})
</script>

<template>
  <div class="documentation-container">
    <div class="headerFilter">
      <!-- 第一行 -->
      <div class="tabBar">
        <div style="display: flex; align-items: center; white-space: nowrap">
          <!-- style="height: 30" 是 v2 原样保留的写法（缺单位，浏览器会忽略） -->
          <div class="check_item public_border_color filterbar-tab-right" style="height: 30">
            <span>时间:</span>

            <!-- 单选事件 -->
            <el-radio-group v-model="timeFlag" class="checkBoxStyle" @change="handleChange">
              <el-radio value="day">今日</el-radio>
              <el-radio value="previous">昨日</el-radio>
              <el-radio value="week">过去7天</el-radio>
              <el-radio value="month">过去30天</el-radio>
              <!-- <el-checkbox label="all">总计</el-checkbox> -->
            </el-radio-group>
          </div>
          <el-date-picker
            v-model="currentTime"
            class="timnePickCSS filterbar-tab-right"
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
          <div v-if="ByContrast" class="filterbar-tab-right">
            <el-checkbox v-model="checked" @change="checkTimeSlot">{{ checkLabel }}</el-checkbox>
          </div>
          <div
            v-if="ByRefresh"
            :style="
              device == 'desktop'
                ? 'position: fixed; right: 20px'
                : 'position:relative;margin-left:10px;margin-right:20px'
            "
          >
            <div class="tabBarBtn" style="position: relative; right: 0">
              <el-button class="zc_btn refresh" @click="refreshAPI">
                <el-icon><RefreshRight /></el-icon>刷新
              </el-button>
              <el-button class="zc_btn_default reset" @click="collapseResetApiList">
                <el-icon><Refresh /></el-icon>重置
              </el-button>
            </div>
          </div>
        </div>

        <!-- 第二行 -->
        <div style="display: flex; margin-top: 12px">
          <div v-if="ByDayOrHour" class="filterbar-tab-right">
            <el-radio-group v-model="timeType" size="small" style="font-size: 13px; height: 30px">
              <el-radio-button value="hour" :disabled="dayFlag">按时</el-radio-button>
              <el-radio-button value="day" :disabled="dayFlag">按日</el-radio-button>
              <el-radio-button value="week" :disabled="weekFlag">按周</el-radio-button>
              <el-radio-button value="month" :disabled="monthFlag">按月</el-radio-button>
            </el-radio-group>
          </div>
          <div v-if="ByGrop" class="warry_select filterbar-tab-right">
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
            v-model="eventName"
            class="custom_input filterbar-tab-right"
            style="width: 250px; border-radius: 4px; height: 30px"
            placeholder="请输入事件英文名"
            clearable
            @keyup.enter="searchEvent()"
          >
            <template #prefix>
              <el-icon class="el-input__icon" style="cursor: pointer" @click="searchEvent()">
                <Search />
              </el-icon>
            </template>
          </el-input>
          <!-- v2 用的是 :append-to-body="false"，element-plus 对应的属性是 teleported -->
          <el-cascader
            v-if="BySearchCustom && protoList.length > 0"
            v-model="searchWord"
            :teleported="false"
            :options="protoList"
            :show-all-levels="false"
            style="font-size: 13px"
            class="custom_cascader filterbar-tab-right"
            filterable
            :props="cascaderProps"
            @change="fileterCascader"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.el-select-dropdown__empty {
  display: none !important;
}
</style>

<style lang="scss" scoped>
// v2 这里还 @import 了 TopFilter.scss 与 custom-radio.scss：
// 前者的 .TopFilter 本组件并未使用；后者已在 v3 src/styles/index.scss 全局引入，
// 且 sass 不允许 @use 出现在嵌套块内（会整页编译失败），这里都不再重复引入。
:deep() {
  .el-cascader--medium {
    line-height: 30px;
  }

  .el-select .el-input .el-select__caret {
    line-height: 30px;
  }

  .el-select-dropdown__list {
    padding: 0 0 6px;
  }

  .el-radio-group {
    margin: 0 5px;
  }

  .el-radio-button__inner {
    border-left: 1px solid #dcdfe6;
    border-radius: 4px;
  }

  .el-radio-button:last-child .el-radio-button__inner {
    border-radius: 4px;
  }

  .el-radio-button:first-child .el-radio-button__inner {
    border-radius: 4px;
  }

  .el-radio-button {
    height: 20px;
    font-size: 12px;
  }

  .el-radio-button--medium .el-radio-button__inner {
    padding: 6px;
    font-size: 13px;
  }

  .el-input--medium .el-input__inner {
    height: 30px;
    line-height: 30px;
    font-size: 12px;
  }

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

.empty-text {
  display: flex;
  text-align: center;
  color: #909399;
  padding: 10px 0;
  margin-bottom: 10px;
}

.select_empty {
  text-align: center;
  margin-bottom: 10px;
  font-size: 12px;
  color: #909399;
}

.custom_button {
  height: 30px;
  color: #fff;
  font-size: 13px;
  background-color: #2c7be5;
}

.headerFilter {
  min-height: 105px;
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
    min-height: 105px;
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
    padding: 15px 20px;
    box-sizing: border-box;
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
