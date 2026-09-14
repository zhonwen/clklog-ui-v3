<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowDown, ArrowUp, Download, Refresh, RefreshRight } from '@element-plus/icons-vue'
import { blobDownloads } from '@/utils/localDownloadUtil'
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
} from '@/utils/filters'
import {
  exportUserList,
  exportVisitorApi,
  exportVisitorDetailApi,
} from '@/api/trackingapi/download'
import { useTrackingStore } from '@/stores/tracking'
import { useUserStore } from '@/stores/user'
import { bus } from '@/utils/event-bus'

const props = withDefaults(
  defineProps<{
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
const trackingStore = useTrackingStore()

type DateOption = { value: string; label: string }
type ProvinceItem = { provinceName: string; country?: string }

const loadingApi = ref(false)
const dateFlag = ref<number | null>(null)
const active_options = ref<DateOption[]>(
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
const contrastValue = ref<string[]>([])
const dimensionValue = ref('save')
const activeValue = ref('day')
const timeSlotValue = ref('day')
const dayFlag = ref(true)
const weekFlag = ref(true)
const monthFlag = ref(true)
const checkDateTime = ref('')
const timeType = ref(props.ByData ? 'hour' : 'day')
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
const pickerBeginOptionTwo = { disabledDate }

const allChaneList = computed(() => userStore.channelList)
const channel = computed(() => (channelValue.value ? [channelValue.value] : []))
const province = computed(() => (areaValue.value == '全部' ? [] : [areaValue.value]))
const provinceData = computed(() => (provinceJson as { province: ProvinceItem[] }).province)

const defaultParams = computed(() => ({
  startTime: startTime.value,
  endTime: endTime.value,
  channel: channel.value,
}))

const commonParams = computed(() => {
  let obj: Record<string, unknown> = { ...defaultParams.value }
  if (props.ByArea) {
    obj = { ...obj, province: province.value, country: country.value }
  }
  if (props.ByData) obj = { ...obj, timeType: timeType.value }
  if (props.ByContrast) obj = { ...obj, contrastValue: contrastValue.value }
  if (props.ByVisitor) obj = { ...obj, visitorType: visitorType.value }
  if (props.ByDimension) obj = { ...obj, dimensionValue: dimensionValue.value }
  return obj
})

function setTopFilterParams(val: Record<string, unknown>) {
  emit('setFilterBarParams', val, dateFlag.value)
}

const emitDebounced = debounce((val: Record<string, unknown>) => {
  nextTick(() => {
    const payload = { ...val }
    if (props.ByActive) payload.timeType = activeValue.value
    commonData.value = payload
    setTopFilterParams(payload)
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
  if (6 <= result && result < 29) {
    weekFlag.value = false
    dayFlag.value = false
    monthFlag.value = true
    if (timeType.value === 'month') timeType.value = 'week'
  }
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

function handleChange(val: string) {
  localStorage.setItem('timeFlag', timeFlag.value)
  checked.value = false
  contrastFlag.value = false
  checkLabel.value = '对比时间段'
  contrastValue.value = []
  dateFlag.value = null
  const dateTime = toDateNow()
  const toData = new Date(new Date().toLocaleDateString()).getTime() + 8 * 3600 * 1000
  if (val == 'day') {
    currentTime.value = [dateTime, dateTime]
    dateTimeCount(1)
    timeType.value = 'hour'
  } else if (val == 'previous') {
    timestampToTime(toData - 3600 * 24 * 1000)
    currentTime.value = [checkDateTime.value, checkDateTime.value]
    dateTimeCount(1)
    timeType.value = 'hour'
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
    const result = Number((val[1] || '').split('-').join('')) - Number((val[0] || '').split('-').join(''))
    dateTimeCount(result)
  }
}

function handleAdd() {
  const dateTime = toDateNow()
  currentTime.value = [dateTime, dateTime]
  initDate(currentTime.value)
}

function resetApiList() {
  timeType.value = props.ByData ? 'hour' : 'day'
  timeFlag.value = 'day'
  handleChange('day')
  channelValue.value = ''
  visitorType.value = ''
  areaValue.value = '全部'
  activeValue.value = 'day'
  timeSlotValue.value = 'day'
  dimensionValue.value = 'save'
}

function refreshApiList() {
  loadingApi.value = true
  setTopFilterParams(commonData.value)
  setTimeout(() => {
    loadingApi.value = false
  }, 500)
}

function channelEvent() {
  dateFlag.value = checked.value ? 3 : null
}

function checkContrast() {
  dateFlag.value = 2
  const copyDate = copyObj(contrastValue.value)
  const dateOne = Date.parse(currentTime.value[1] || '') - Date.parse(currentTime.value[0] || '')
  const toDate = todateFunc()
  const rangeDate = Date.parse(toDate) - Date.parse(contrastValue.value[0] || '')
  if (rangeDate >= dateOne) {
    const dateTwoEndtimeStamp = Date.parse(contrastValue.value[0] || '') + dateOne
    contrastValue.value[1] = timeStampFunc(dateTwoEndtimeStamp)
  } else {
    const reverseDate = Date.parse(contrastValue.value[0] || '') - dateOne
    contrastValue.value[0] = timeStampFunc(reverseDate)
    contrastValue.value[1] = copyDate[1] || ''
  }
}

function handleDateFilter(val: string) {
  const toDay = toDateNow()
  switch (val) {
    case 'day':
      if (route.name == 'retainedUsers') {
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

function handleMultipleDate(val: string) {
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
    checkWeekEvent(val)
  } else if (activeValue.value == 'month') {
    checkMonthEvent(val)
  }
}

function checkDateEvnet(val: string[] | null) {
  if (!val || val.length < 2) return
  localStorage.setItem('timeFlag', 'null')
  checked.value = false
  contrastFlag.value = false
  checkLabel.value = '对比时间段'
  contrastValue.value = []
  dateFlag.value = null
  timeFlag.value = ''
  startTime.value = val[0] || ''
  endTime.value = val[1] || ''
  const end = new Date(val[1] || '').getTime()
  const start = new Date(val[0] || '').getTime()
  const timeStamp = end - start
  const result = timeStamp / (3600 * 24 * 1000)
  dateTimeCount(result)
  if (timeStamp == 0) timeType.value = 'hour'
  else if (timeStamp > 0 && timeStamp < 2592000000) timeType.value = 'day'
  else if (timeStamp >= 2592000000 && timeStamp < 7776000000) timeType.value = 'week'
  else timeType.value = 'month'
}

function checkTimeSlot(val: boolean) {
  if (val) {
    checkLabel.value = '对比'
    contrastValue.value = []
  } else {
    checkLabel.value = '对比时间段'
    contrastValue.value = []
    dateFlag.value = null
  }
  contrastFlag.value = val
}

function canclePopEvent() {
  popflag.value = false
}

function handleCheckProvince(item: ProvinceItem) {
  country.value = item.provinceName == '全部' ? [] : item.country ? [item.country] : ['中国']
  areaValue.value = item.provinceName
  nextTick(() => {
    const el = document.activeElement as HTMLElement | null
    if (el && el.classList.contains('el-radio__original')) el.blur()
  })
}

function sliceTypeFile(res: { headers?: unknown }) {
  const headers = res.headers as { get?: (k: string) => unknown; [k: string]: unknown } | undefined
  const raw = headers?.['content-disposition'] || headers?.get?.('content-disposition') || ''
  const fileName = String(raw)
  const index1 = fileName.indexOf('filename=')
  return decodeURIComponent(decodeURI(fileName.substring(index1).slice(9)))
}

function download() {
  const path = route.path
  const payload: Record<string, unknown> = {
    ...commonData.value,
    projectName: trackingStore.projectName,
  }
  switch (path) {
    case '/userbehavior/loyaltyAnalysis':
      void exportVisitorApi(payload).then((res) => blobDownloads(res.data, sliceTypeFile(res)))
      break
    case '/userbehavior/userBehavior':
      payload.cols = ['userId', 'visitorType', 'visitCount', 'pv', 'visitTime', 'avgPv', 'latestTime']
      void exportUserList(payload).then((res) => blobDownloads(res.data, sliceTypeFile(res)))
      break
    case '/ups/personalPortrait':
      payload.cols = ['userId', 'visitorType', 'pv', 'visitCount', 'visitTime', 'avgPv', 'latestTime']
      void exportUserList(payload).then((res) => blobDownloads(res.data, sliceTypeFile(res)))
      break
    case '/visitorAnalysis/newoldVisitor':
      payload.cols = [
        'pv', 'uv', 'ipCount', 'pvRate', 'visitCount', 'uvRate', 'avgPv', 'bounceRate', 'avgVisitTime', 'index', 'visitorType',
      ]
      delete payload.contrastValue
      payload.visitorType = ''
      void exportVisitorDetailApi(payload).then((res) => blobDownloads(res.data, sliceTypeFile(res)))
      break
    default:
      bus.emit('publicEventDown', payload)
  }
}

onMounted(() => {
  handleAdd()
  initCheckDayNum()
  localStorage.setItem('timeFlag', 'day')
})
</script>

<template>
  <div
    class="documentation-container"
    :style="ByTime || ByCalendar || ByActive ? 'min-height : 103px;' : 'min-height:60px;'"
  >
    <div class="checkContent">
      <div style="display: flex">
        <div v-if="ByTime" class="check_item filterbar-tab-right public_border_color" style="margin-bottom: 12px">
          <span class="headLable">时间:</span>
          <el-radio-group v-model="timeFlag" class="checkBoxStyle" @change="handleChange">
            <el-radio value="day">今日</el-radio>
            <el-radio value="previous">昨日</el-radio>
            <el-radio value="week">近7天</el-radio>
            <el-radio value="month">近30天</el-radio>
          </el-radio-group>
        </div>
        <el-date-picker
          v-if="ByCalendar"
          v-model="currentTime"
          class="timnePickCSS filterbar-tab-right"
          style="width: 250px; height: 30px; margin-bottom: 12px"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="YYYY-MM-DD"
          :disabled-date="disabledDate"
          :shortcuts="pickerBeginOption.shortcuts"
          @change="checkDateEvnet"
        />
        <div v-if="ByContrast" class="filterbar-tab-right" style="line-height: 30px">
          <el-checkbox v-model="checked" @change="checkTimeSlot">{{ checkLabel }}</el-checkbox>
        </div>
        <div v-show="contrastFlag">
          <el-date-picker
            v-if="ByCalendar"
            v-model="contrastValue"
            class="timnePickCSS filterbar-tab-right"
            style="width: 250px; height: 30px"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            :disabled-date="disabledDate"
            @change="checkContrast"
          />
        </div>
        <div v-if="ByData" class="filterbar-tab-right" style="height: 30px">
          <el-radio-group v-model="timeType" size="small" style="font-size: 13px; height: 30px">
            <el-radio-button value="hour" :disabled="dayFlag">按时</el-radio-button>
            <el-radio-button value="day" :disabled="dayFlag">按日</el-radio-button>
            <el-radio-button value="week" :disabled="weekFlag">按周</el-radio-button>
            <el-radio-button value="month" :disabled="monthFlag">按月</el-radio-button>
          </el-radio-group>
        </div>
        <div v-if="ByActive" class="filterbar-tab-right" style="height: 30px; margin-bottom: 12px">
          <el-radio-group v-model="activeValue" size="small" style="font-size: 13px; height: 30px" @change="handleDateFilter">
            <el-radio-button v-for="item in active_options" :key="item.value" :value="item.value">
              {{ item.label }}
            </el-radio-button>
          </el-radio-group>
        </div>
        <div v-if="ByTimeSlot" class="check_item filterbar-tab-right public_border_color">
          <span class="headLable">时间:</span>
          <el-radio-group v-model="timeSlotValue" class="checkBoxStyle" @change="handleMultipleDate">
            <el-radio v-for="item in date_options" :key="item.value" :value="item.value">{{ item.label }}</el-radio>
          </el-radio-group>
        </div>
        <div v-if="!contrastFlag" class="tabBarBtn">
          <el-button class="zc_btn refresh" :loading="loadingApi" @click="refreshApiList">
            <el-icon><RefreshRight /></el-icon>刷新
          </el-button>
          <el-button class="zc_btn_default reset" @click="resetApiList">
            <el-icon><Refresh /></el-icon>重置
          </el-button>
        </div>
      </div>
      <div class="channelSecond">
        <div style="display: flex">
          <div
            v-if="!byChnnel && allChaneList.length > 0"
            class="check_item filterbar-tab-right public_border_color"
            style="max-width: 1000px; overflow-x: auto; overflow-y: hidden"
          >
            <span class="headLable">渠道:</span>
            <el-radio-group v-model="channelValue" style="margin-right: 10px" @change="channelEvent">
              <el-radio v-for="item in allChaneList" :key="item.id" :value="item.id">{{ item.displayName }}</el-radio>
            </el-radio-group>
          </div>
          <div v-if="ByVisitor" class="check_item filterbar-tab-right public_border_color">
            <span class="headLable">访客:</span>
            <el-radio-group v-model="visitorType" class="checkBoxStyle">
              <el-radio value="">全部</el-radio>
              <el-radio value="新访客">新访客</el-radio>
              <el-radio value="老访客">老访客</el-radio>
            </el-radio-group>
          </div>
          <div v-if="ByArea" class="areaContent filterbar-tab-right">
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
                      <el-icon class="iconArrow"><ArrowUp v-if="popflag" /><ArrowDown v-else /></el-icon>
                    </div>
                  </template>
                </el-popover>
              </div>
            </div>
          </div>
          <div v-if="ByDimension" class="check_item filterbar-tab-right public_border_color">
            <span class="headLable">分析维度:</span>
            <el-radio-group v-model="dimensionValue" class="checkBoxStyle">
              <el-radio value="out">流失</el-radio>
              <el-radio value="save">留存</el-radio>
            </el-radio-group>
          </div>
        </div>
        <div style="display: flex; position: fixed; right: 20px">
          <div v-if="ByDownLoad && !dateFlag" class="btnEvent" @click="download">
            <el-icon style="padding-right: 3px; font-size: 14px"><Download /></el-icon>下载
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.el-radio-button--small .el-radio-button__inner) {
  padding: 9px 15px;
}

:deep(.el-checkbox__input.is-checked + .el-checkbox__label) {
  color: #4d4d4d;
}

:deep(.el-checkbox__label) {
  font-size: 13px;
  padding-left: 5px;
}

:deep(.el-date-editor .el-range-input) {
  font-size: 13px;
}

.popCancle {
  position: absolute;
  right: -10px;
  top: -10px;
  cursor: pointer;
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 1px #d8e2ef solid;
  line-height: 20px;
  text-align: center;
}

.popCancle:hover {
  border: 1px solid #727171;
}

.documentation-container {
  min-height: 103px;
  width: 100%;

  .checkContent {
    padding: 15px 20px;
    white-space: nowrap;
    position: relative;
    width: 100%;
    min-height: 40px;
    z-index: 500;
    background-color: #fff;
    border-bottom: 1px #eee solid;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  .areaContent {
    height: 3px;

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
        border-left: 0;
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
    background-color: #fff;
    height: 30px;
    border-radius: 4px;
    display: flex;
    align-items: center;

    .headLable {
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

  .channelSecond {
    min-height: 30px;
    box-sizing: border-box;
    width: 100%;
    display: flex;
    align-items: flex-start;
    position: relative;
  }
}
</style>
