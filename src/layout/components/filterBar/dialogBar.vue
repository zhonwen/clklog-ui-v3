<script setup lang="ts">
/**
 * 弹窗内的筛选条（对应 v2 src/layout/components/filterBar/dialogBar.vue）。
 *
 * 与同目录的 filterBar/index.vue 是两个组件：dialogBar 用在 custom-dialog 下的
 * 「地域详情」「受访页面详情」弹窗里，没有刷新/重置按钮，下载走 bus 的 publicDialogDown。
 *
 * 对外契约（与 v2 一致）：
 *   props  Byhour / ByArea / ByData / ByDownLoad（外加 v2 原有的其余 props）
 *   事件   setFilterBarParams(val, dateFlag)
 *   方法   dialogbarEvent(commonParams) / clearEvent()  —— 父组件通过 ref 调用
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowDown, ArrowUp, Download } from '@element-plus/icons-vue'
import provinceJson from '@/utils/province.json'
import { copyObj } from '@/utils/copy'
import { debounce } from '@/utils/index'
import {
  formatDateToday,
  formatDateYMD,
  getFirstDayOfMonths,
  getMondayOfPreviousWeeks,
  timeStampFunc,
  todateFunc,
} from '@/utils/date'
import { useUserStore } from '@/stores/user'
import { bus } from '@/utils/event-bus'

const props = withDefaults(
  defineProps<{
    Byhour?: boolean
    bySub?: boolean
    byChnnel?: boolean
    ByData?: boolean
    ByArea?: boolean
    ByContrast?: boolean
    ByActive?: boolean
    ByTimeSlot?: boolean
    ByDimension?: boolean
    ByTime?: boolean
    ByCalendar?: boolean
    ByVisitor?: boolean
    ByDownLoad?: boolean
  }>(),
  {
    Byhour: true,
    bySub: false,
    byChnnel: false,
    ByData: false,
    ByArea: false,
    ByContrast: false,
    ByActive: false,
    ByTimeSlot: false,
    ByDimension: false,
    ByTime: true,
    ByCalendar: true,
    ByVisitor: true,
    ByDownLoad: true,
  },
)

const emit = defineEmits<{
  setFilterBarParams: [val: Record<string, unknown>, dateFlag: number | null]
}>()

const route = useRoute()
const userStore = useUserStore()

type DateOption = { value: string; label: string }
type ProvinceItem = { provinceName: string; country?: string }

const dateFlag = ref<number | null>(null) // 触发的日历个数
const active_options = ref<DateOption[]>(
  // 与 v2 的 created() 一致：这两个页面把「日/周/月活跃」换成「按日/按周/按月」
  route.name == 'silentUsers' || route.name == 'retainedUsers'
    ? [
        { value: 'day', label: '按日' },
        { value: 'week', label: '按周' },
        { value: 'month', label: '按月' },
      ]
    : [
        { value: 'day', label: '日活跃' },
        { value: 'week', label: '周活跃' },
        { value: 'month', label: '月活跃' },
      ],
)
const date_options = ref<DateOption[]>([])
const dateWeek_options: DateOption[] = [
  { value: '3', label: '近4周' },
  { value: '7', label: '近8周' },
  { value: '11', label: '近12周' },
]

const checked = ref(false)
const contrastFlag = ref(false)
const checkLabel = ref('对比时间段')
// 与 v2 一致：未开启对比时是空字符串而不是空数组
const contrastValue = ref<string[] | ''>('')
const dimensionValue = ref('save')
const activeValue = ref('day')
const timeSlotValue = ref('day')
const dayFlag = ref(true)
const weekFlag = ref(true)
const monthFlag = ref(true)
const checkDateTime = ref('')
const timeType = ref(props.Byhour ? 'hour' : 'day')
const timeFlag = ref('day')
const startTime = ref('')
const endTime = ref('')
const areaValue = ref('全部')
const country = ref<string[]>([])
const channelValue = ref('')
const visitorType = ref('')
const popflag = ref(false)
const currentTime = ref<string[]>([])
const commonData = ref<Record<string, unknown>>({})
// 与 v2 一致：dialogbarEvent 里置 true、下一次 initEvent 里置回 false，v2 里未参与其它判断
const openTimeFlag = ref(false)

const disabledDate = (date: Date) => date.getTime() > Date.now()
const pickerBeginOption = {
  disabledDate,
  shortcuts: [
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
  ],
}

const allChaneList = computed(() => userStore.channelList)
const channel = computed(() => (channelValue.value ? [channelValue.value] : []))
const province = computed(() => (areaValue.value == '全部' ? [] : [areaValue.value]))
// 与 v2 一致：地域分析页把「全部」这一项去掉
const provinceData = computed(() => {
  const list = (provinceJson as { province: ProvinceItem[] }).province
  if (route.path.indexOf('/visitorAnalysis/regional') > -1) {
    return list.filter((item) => item.provinceName != '全部')
  }
  return list
})

const defaultParams = computed(() => ({
  startTime: startTime.value,
  endTime: endTime.value,
  channel: channel.value,
}))

const commonParams = computed(() => {
  let obj: Record<string, unknown> = { ...defaultParams.value }
  if (props.ByArea) obj = { ...obj, province: province.value, country: country.value }
  if (props.ByData) obj = { ...obj, timeType: timeType.value }
  if (props.ByContrast) obj = { ...obj, contrastValue: contrastValue.value }
  if (props.ByVisitor) obj = { ...obj, visitorType: visitorType.value }
  if (props.ByDimension) obj = { ...obj, dimensionValue: dimensionValue.value }
  return obj
})

function setTopFilterParams(val: Record<string, unknown>) {
  emit('setFilterBarParams', val, dateFlag.value)
}

// 与 v2 的 watch(commonParams, _.debounce(..., 200)) 一致
const emitDebounced = debounce((val: Record<string, unknown>) => {
  nextTick(() => {
    const payload = { ...val }
    if (props.ByActive) payload.timeType = activeValue.value
    setTopFilterParams(payload)
    commonData.value = payload
    openTimeFlag.value = false
  })
}, 200)

watch(commonParams, (val) => emitDebounced(val))

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

function timestampToTime(timestamp: number) {
  const date = new Date(timestamp)
  const Y = date.getFullYear() + '-'
  const M = (date.getMonth() + 1 < 10 ? '0' + (date.getMonth() + 1) : date.getMonth() + 1) + '-'
  const D = (date.getDate() < 10 ? '0' + date.getDate() : date.getDate()) + ''
  checkDateTime.value = Y + M + D
}

function dateTimeCount(result: number) {
  // 与 v2 一致（v2 此处逻辑存疑：条件写的是 `if (6 <= result < 29)`，JS 里等价于
  // `(6 <= result) < 29` —— true/false 与 29 比较恒为 true，也就是这段无条件执行。
  // 这里直接去掉那个恒真的 if，运行结果与 v2 完全相同。
  // 注意这跟 filterBar/index.vue 里「修正过」的写法不同，那边 result>=29 时不会把
  // timeType 从 month 拨回 week，dialogBar 这边按 v2 原样保留。）
  weekFlag.value = false
  dayFlag.value = false
  monthFlag.value = true
  if (timeType.value === 'month') timeType.value = 'week'

  if (result >= 29) {
    monthFlag.value = false
    weekFlag.value = false
    dayFlag.value = false
  }
  if (result < 6) {
    dayFlag.value = false
    monthFlag.value = true
    weekFlag.value = true
    if (timeType.value === 'month' || timeType.value === 'week') timeType.value = 'day'
  }
}

function initCheckDayNum() {
  if (route.name == 'retainedUsers') {
    date_options.value = [
      { value: 'day', label: '过去7天' },
      { value: 'week', label: '过去14天' },
      { value: 'month', label: '过去30天' },
    ]
  } else {
    date_options.value = [
      { value: 'day', label: '近7天' },
      { value: 'week', label: '近14天' },
      { value: 'month', label: '近30天' },
    ]
  }
}

function checkWeekEvent(num: number | string) {
  startTime.value = getMondayOfPreviousWeeks(Number(num))
  endTime.value = toDateNow()
}

function checkMonthEvent(num: number | string) {
  startTime.value = getFirstDayOfMonths(Number(num))
  endTime.value = toDateNow()
}

/** 顶部「今日/昨日/近7天/近30天」切换（v2 handleChange） */
function handleChange(val: string | number | boolean | undefined) {
  checked.value = false // 暂定清空日期
  contrastFlag.value = false
  checkLabel.value = '对比时间段'
  contrastValue.value = ''
  // 与 v2 一致：上面刚把 checked 置为 false，所以这里恒为 null
  dateFlag.value = null
  const dateTime = toDateNow()
  const toData = new Date(new Date().toLocaleDateString()).getTime() + 8 * 3600 * 1000
  if (val == 'day') {
    currentTime.value = [dateTime, dateTime]
    dateTimeCount(1)
    timeType.value = props.Byhour ? 'hour' : 'day'
  } else if (val == 'previous') {
    timestampToTime(toData - 3600 * 24 * 1000)
    currentTime.value = [checkDateTime.value, checkDateTime.value]
    dateTimeCount(1)
    timeType.value = props.Byhour ? 'hour' : 'day'
  } else if (val == 'week') {
    timestampToTime(toData - 6 * 3600 * 24 * 1000)
    currentTime.value = [checkDateTime.value, dateTime]
    dateTimeCount(6)
    timeType.value = 'day'
  } else {
    timestampToTime(toData - 29 * 3600 * 24 * 1000)
    currentTime.value = [checkDateTime.value, dateTime]
    dateTimeCount(29)
    timeType.value = 'week'
  }
  startTime.value = currentTime.value[0] || ''
  endTime.value = currentTime.value[1] || ''
}

/**
 * 弹窗打开时按外部传入的 commonParams 回填日期（v2 dialogParamsEvent）。
 * 注意 timeFlag 来自 localStorage，取不到时走 else 分支，直接用外部的起止时间。
 */
function dialogParamsEvent(commonParams: Record<string, unknown>) {
  const val = timeFlag.value
  const dateTime = toDateNow()
  const toData = new Date(new Date().toLocaleDateString()).getTime() + 8 * 3600 * 1000
  if (val == 'day') {
    currentTime.value = [dateTime, dateTime]
    dateTimeCount(1)
    timeType.value = props.Byhour ? 'hour' : 'day'
  } else if (val == 'previous') {
    timestampToTime(toData - 3600 * 24 * 1000)
    currentTime.value = [checkDateTime.value, checkDateTime.value]
    dateTimeCount(1)
    timeType.value = props.Byhour ? 'hour' : 'day'
  } else if (val == 'week') {
    timestampToTime(toData - 6 * 3600 * 24 * 1000)
    currentTime.value = [checkDateTime.value, dateTime]
    dateTimeCount(6)
    timeType.value = 'day'
  } else if (val == 'month') {
    timestampToTime(toData - 29 * 3600 * 24 * 1000)
    currentTime.value = [checkDateTime.value, dateTime]
    dateTimeCount(29)
    timeType.value = 'week'
  } else {
    currentTime.value = [String(commonParams.startTime ?? ''), String(commonParams.endTime ?? '')]
  }
  startTime.value = String(commonParams.startTime ?? '')
  endTime.value = String(commonParams.endTime ?? '')
}

/** 父组件通过 ref 调用：把外层筛选条的条件同步进弹窗（v2 dialogbarEvent） */
function dialogbarEvent(commonParams: Record<string, unknown>) {
  timeFlag.value = localStorage.getItem('timeFlag') || ''
  openTimeFlag.value = true
  dialogParamsEvent(commonParams)
  const provinceParam = commonParams.province
  if (provinceParam instanceof Array && provinceParam.length > 0) {
    areaValue.value = String(provinceParam[0])
    // 需考虑地域分析 - 省份地图 - 会默认带 province 的问题
    country.value = ['中国']
  }

  const channelParam = commonParams.channel
  if (channelParam instanceof Array) {
    channelValue.value = channelParam.length > 0 ? String(channelParam[0]) : ''
  } else {
    channelValue.value = channelParam == null ? '' : String(channelParam)
  }

  visitorType.value = commonParams.visitorType == null ? '' : String(commonParams.visitorType)
}

/** 父组件通过 ref 调用：弹窗关闭时把地域恢复成「全部」（v2 clearEvent） */
function clearEvent() {
  areaValue.value = '全部'
}

function initDate(val: string[]) {
  if (props.ByActive) {
    const currentDate = new Date()
    const sevenDaysAgo = new Date(currentDate)
    sevenDaysAgo.setDate(currentDate.getDate() - 6)
    startTime.value = formatDateYMD(sevenDaysAgo)
    endTime.value = formatDateToday()
  } else {
    startTime.value = val[0] || ''
    endTime.value = val[1] || ''
    const result =
      Number((val[1] || '').split('-').join('')) - Number((val[0] || '').split('-').join(''))
    dateTimeCount(result)
  }
}

/** v2 handleAdd：默认初始日期（v2 dialogBar 的 mounted 并未调用它，这里保持不调用） */
function handleAdd() {
  const dateTime = toDateNow()
  currentTime.value = [dateTime, dateTime]
  initDate(currentTime.value)
}

function channelEvent() {
  dateFlag.value = checked.value ? 3 : null
}

/** 对比日期 2（v2 checkContrast） */
function checkContrast() {
  // 清空日期选择器时 el-date-picker 给的是 null，v2 在这里会抛 TypeError；这里直接复位
  const picked = contrastValue.value
  if (!Array.isArray(picked) || picked.length < 2) {
    contrastValue.value = ''
    dateFlag.value = null
    return
  }
  dateFlag.value = 2
  const copyDate = copyObj(picked)
  const next = [...picked]
  const dateOne = Date.parse(currentTime.value[1] || '') - Date.parse(currentTime.value[0] || '')
  const toDate = todateFunc()
  const rangeDate = Date.parse(toDate) - Date.parse(next[0] || '')
  if (rangeDate >= dateOne) {
    next[1] = timeStampFunc(Date.parse(next[0] || '') + dateOne)
  } else {
    // 没有这个范围进行逆向取值
    next[0] = timeStampFunc(Date.parse(next[0] || '') - dateOne)
    next[1] = copyDate[1] || ''
  }
  contrastValue.value = next
}

function handleDateFilter(val: string | number | boolean | undefined) {
  const toDay = toDateNow()
  switch (val) {
    case 'day':
      if (route.name == 'retainedUsers') {
        // 不包含今天的日期（昨日）
        const toData = new Date(new Date().toLocaleDateString()).getTime() + 8 * 3600 * 1000
        timestampToTime(toData - 3600 * 24 * 1000)
        initCheckDayNum()
        timeSlotValue.value = 'day'
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(new Date().getDate() - 7)
        startTime.value = formatDateYMD(sevenDaysAgo)
        endTime.value = checkDateTime.value
      } else {
        initCheckDayNum()
        timeSlotValue.value = 'day'
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(new Date().getDate() - 6)
        startTime.value = formatDateYMD(sevenDaysAgo)
        endTime.value = toDay
      }
      break
    case 'week':
      if (route.name == 'retainedUsers') {
        date_options.value = [
          { value: '5', label: '近6周' },
          { value: '8', label: '近9周' },
          { value: '11', label: '近12周' },
        ]
        timeSlotValue.value = '5'
        checkWeekEvent(5)
      } else {
        date_options.value = dateWeek_options
        timeSlotValue.value = '3'
        checkWeekEvent(3)
      }
      break
    case 'month':
      if (route.name == 'retainedUsers') {
        date_options.value = [
          { value: '5', label: '近6月' },
          { value: '8', label: '近9月' },
          { value: '11', label: '近12月' },
        ]
        timeSlotValue.value = '5'
        checkMonthEvent(5)
      } else {
        date_options.value = [
          { value: '2', label: '近3月' },
          { value: '5', label: '近6月' },
          { value: '11', label: '近12月' },
        ]
        timeSlotValue.value = '2'
        checkMonthEvent(2)
      }
      break
  }
}

function handleMultipleDate(val: string | number | boolean | undefined) {
  if (activeValue.value == 'day') {
    const currentDate = new Date()
    const todateTime = formatDateToday()
    if (val == 'day') {
      const sevenDaysAgo = new Date(currentDate)
      sevenDaysAgo.setDate(currentDate.getDate() - 6)
      startTime.value = formatDateYMD(sevenDaysAgo)
      endTime.value = todateTime
    } else if (val == 'week') {
      const fourteenDaysAgo = new Date(currentDate)
      fourteenDaysAgo.setDate(currentDate.getDate() - 13)
      startTime.value = formatDateYMD(fourteenDaysAgo)
      endTime.value = todateTime
    } else if (val == 'month') {
      const thirtyDaysAgo = new Date(currentDate)
      thirtyDaysAgo.setDate(currentDate.getDate() - 29)
      startTime.value = formatDateYMD(thirtyDaysAgo)
      endTime.value = todateTime
    }
  } else if (activeValue.value == 'week') {
    checkWeekEvent(String(val ?? ''))
  } else if (activeValue.value == 'month') {
    checkMonthEvent(String(val ?? ''))
  }
}

function checkDateEvnet(val: string[] | null) {
  if (!val || val.length < 2) return
  checked.value = false // 暂定清空日期
  contrastFlag.value = false
  checkLabel.value = '对比时间段'
  contrastValue.value = ''
  dateFlag.value = null
  timeFlag.value = ''
  startTime.value = val[0] || ''
  endTime.value = val[1] || ''
  const end = new Date(val[1] || '').getTime()
  const start = new Date(val[0] || '').getTime()
  const timeStamp = end - start
  const result = timeStamp / (3600 * 24 * 1000)
  dateTimeCount(result)

  // 选择日期进行按时按日自动筛选
  if (timeStamp == 0) {
    timeType.value = 'hour'
  } else if (timeStamp >= 604800000 && timeStamp < 2592000000) {
    timeType.value = 'day'
  } else if (timeStamp >= 2592000000 && timeStamp < 7776000000) {
    timeType.value = 'week'
  } else {
    timeType.value = 'month'
  }
}

function checkTimeSlot(val: string | number | boolean | undefined) {
  if (val === true) {
    checkLabel.value = '对比'
    contrastValue.value = ''
  } else if (val === false) {
    checkLabel.value = '对比时间段'
    contrastValue.value = ''
    dateFlag.value = null
  }
  contrastFlag.value = val === true
}

function canclePopEvent() {
  popflag.value = false
}

/** 下载：与 v2 一致，走 bus 的 publicDialogDown，由页面上的 flowPoint 接住 */
function downloadDialog() {
  bus.emit('publicDialogDown', commonData.value)
}

// 切换省份
function handleCheckProvince(e: ProvinceItem) {
  country.value = e.provinceName == '全部' ? [] : e.country ? [e.country] : ['中国']
  areaValue.value = e.provinceName
}

onMounted(() => {
  // 与 v2 一致：dialogBar 的 mounted 只做这一件事（不像 filterBar 还会 handleAdd）
  initCheckDayNum()
})

onBeforeUnmount(() => {
  // 弹窗关闭/页面切换时组件会卸载，200ms 防抖若在卸载后触发会向已卸载的父级 emit，
  // 触发「已卸载组件的更新」并打断路由导航
  emitDebounced.cancel()
})

defineExpose({ dialogbarEvent, clearEvent, handleAdd })
</script>

<template>
  <div class="documentation-container">
    <div class="checkContent">
      <div style="display: flex; padding-top: 15px">
        <div v-if="ByTime" class="check_item public_border_color">
          <span style="white-space: nowrap">时间:</span>
          <el-radio-group
            v-model="timeFlag"
            class="checkBoxStyle"
            style="white-space: nowrap"
            @change="handleChange"
          >
            <el-radio value="day">今日</el-radio>
            <el-radio value="previous">昨日</el-radio>
            <el-radio value="week">近7天</el-radio>
            <el-radio value="month">近30天</el-radio>
          </el-radio-group>
        </div>
        <!-- 日期1 -->
        <el-date-picker
          v-if="ByCalendar"
          v-model="currentTime"
          class="timnePickCSS"
          style="margin-left: 20px; width: 250px; height: 30px"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="YYYY-MM-DD"
          :disabled-date="disabledDate"
          :shortcuts="pickerBeginOption.shortcuts"
          @change="checkDateEvnet"
        />
        <!-- 地域调整到第二列 -->
        <div v-if="ByArea" class="areaContent">
          <div class="areaItem">
            <div class="areaHead public_border_color">地域</div>
            <div class="area_select sing_special_popover">
              <el-popover v-model:visible="popflag" placement="bottom" :width="510" trigger="click">
                <div style="position: relative">
                  <el-radio-group v-model="areaValue" size="small">
                    <el-radio
                      v-for="(item, index) in provinceData"
                      :key="index"
                      style="margin-top: 11px"
                      :value="item.provinceName"
                      @change="handleCheckProvince(item)"
                    >
                      {{ item.provinceName }}
                    </el-radio>
                  </el-radio-group>
                  <div class="popCancle" @click="canclePopEvent">X</div>
                </div>
                <template #reference>
                  <div class="areaBox public_font_color">
                    {{ areaValue }}
                    <el-icon class="iconArrow">
                      <ArrowUp v-if="popflag" />
                      <ArrowDown v-else />
                    </el-icon>
                  </div>
                </template>
              </el-popover>
            </div>
          </div>
        </div>
        <!-- 对比时间段 -->
        <div v-if="ByContrast" style="margin-left: 20px; line-height: 30px">
          <el-checkbox v-model="checked" @change="checkTimeSlot">{{ checkLabel }}</el-checkbox>
        </div>
        <div v-show="contrastFlag">
          <!-- 日期2 -->
          <el-date-picker
            v-if="ByCalendar"
            v-model="contrastValue"
            class="timnePickCSS"
            style="margin-left: 20px; width: 250px; height: 30px"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            :disabled-date="disabledDate"
            @change="checkContrast"
          />
        </div>
        <div v-if="ByData" style="margin-left: 20px; height: 30px">
          <el-radio-group v-model="timeType" size="small" style="font-size: 13px; height: 30px">
            <el-radio-button v-if="Byhour" value="hour" :disabled="dayFlag">按时</el-radio-button>
            <el-radio-button value="day" :disabled="dayFlag">按日</el-radio-button>
            <el-radio-button value="week" :disabled="weekFlag">按周</el-radio-button>
            <el-radio-button value="month" :disabled="monthFlag">按月</el-radio-button>
          </el-radio-group>
        </div>

        <div v-if="ByActive" style="margin-left: 20px; height: 30px">
          <el-radio-group
            v-model="activeValue"
            size="small"
            style="font-size: 13px; height: 30px"
            @change="handleDateFilter"
          >
            <el-radio-button v-for="item in active_options" :key="item.value" :value="item.value">
              {{ item.label }}
            </el-radio-button>
          </el-radio-group>
        </div>
        <!-- 选择时间范围 用户行为分析 -->
        <div v-if="ByTimeSlot" class="check_item public_border_color">
          <span>时间:</span>
          <el-radio-group v-model="timeSlotValue" class="checkBoxStyle" @change="handleMultipleDate">
            <el-radio v-for="item in date_options" :key="item.value" :value="item.value">
              {{ item.label }}
            </el-radio>
          </el-radio-group>
        </div>
      </div>

      <div class="channelSecond">
        <div style="display: flex">
          <div
            v-if="!byChnnel && allChaneList.length > 0"
            class="check_item public_border_color"
            style="max-width: 1000px; overflow-x: auto; overflow-y: hidden; white-space: nowrap"
          >
            <span>渠道:</span>
            <el-radio-group v-model="channelValue" style="margin-right: 10px" @change="channelEvent">
              <el-radio v-for="item in allChaneList" :key="item.id" :value="item.id">
                {{ item.displayName }}
              </el-radio>
            </el-radio-group>
          </div>
          <div v-if="ByVisitor" class="check_item public_border_color">
            <span>访客:</span>
            <el-radio-group v-model="visitorType" class="checkBoxStyle">
              <el-radio value="">全部</el-radio>
              <el-radio value="新访客">新访客</el-radio>
              <el-radio value="老访客">老访客</el-radio>
            </el-radio-group>
          </div>

          <div v-if="ByDimension" class="check_item public_border_color">
            <span>分析维度:</span>
            <el-radio-group v-model="dimensionValue" class="checkBoxStyle">
              <el-radio value="out">流失</el-radio>
              <el-radio value="save">留存</el-radio>
            </el-radio-group>
          </div>
        </div>
        <div style="display: flex; position: absolute; right: 30px">
          <div v-if="ByDownLoad && !dateFlag" class="btnEvent" @click="downloadDialog">
            <el-icon style="padding-right: 3px; font-size: 14px"><Download /></el-icon>下载
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
// v2 这里在 ::v-deep 里 @import 了 custom-radio.scss，v3 已在 styles/index.scss 全局引入，不再重复引
:deep(.el-radio-button--small .el-radio-button__inner) {
  padding: 9px 15px;
}

:deep(.el-checkbox__input.is-checked + .el-checkbox__label) {
  color: #4d4d4d;
}

:deep(.el-checkbox__label) {
  font-size: 13px;
}

// 日历样式 start
:deep(.el-date-editor .el-range-input) {
  font-size: 13px;
}

:deep(.el-date-editor .el-range__icon) {
  font-size: 13px;
  line-height: 25px;
}

:deep(.el-date-editor .el-range-separator) {
  font-size: 13px;
  line-height: 25px;
}

.popCancle:hover {
  border: 1px solid #727171;
  border-radius: 4px;
}

.popCancle {
  position: absolute;
  right: 0;
  top: 0;
  cursor: pointer;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px #d8e2ef solid;
  line-height: 20px;
  text-align: center;
}

.documentation-container {
  min-height: 103px;
  width: 100%;

  .checkContent {
    border-radius: 6px;
    width: 100%;
    min-height: 80px;
    z-index: 500;
    background-color: #fff;
    border-bottom: 1px #eee solid;

    .areaContent {
      height: 3px;
      margin-left: 20px;

      .area_select {
        position: relative;

        .iconArrow {
          position: absolute;
          font-size: 13px;
          top: 3px;
          right: 5px;
          transform: translate(0, 50%);
        }
      }

      .areaItem {
        display: flex;
        align-items: center;

        .areaHead {
          width: 40px;
          height: 30px;
          line-height: 30px;
          text-align: center;
          font-size: 13px;
          font-weight: 400;
          color: #4d4d4d;
          border-top-left-radius: 5px;
          border-bottom-left-radius: 5px;
        }

        .areaBox {
          position: relative;
          height: 30px !important;
          line-height: 30px;
          font-size: 12px;
          font-weight: 400;
          border: 1px solid #d8e2ef;
          border-left: 0px;
          border-top-right-radius: 5px;
          border-bottom-right-radius: 5px;
          padding: 0 8px;
          padding-right: 20px;
          box-sizing: border-box;
          cursor: pointer;
        }
      }
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

    .btnEvent {
      cursor: pointer;
      width: 65px;
      height: 28px;
      color: #194580;
      border: 1px solid #d8e2ef;
      border-radius: 4px;
      font-size: 12px;
      line-height: 28px;
      text-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .SetSpace {
      margin-right: 9px;
    }

    .channelSecond {
      height: 57px;
      box-sizing: border-box;
      width: 100%;
      display: flex;
      padding: 12px 0 15px 0;
      align-items: center;
      position: relative;
    }
  }
}
</style>
