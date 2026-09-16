<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { DocumentCopy } from '@element-plus/icons-vue'
import type { EChartsOption } from 'echarts'
import SeqFilters from './seq-filters.vue'
import {
  getUserEventReportByDateApi,
  getUserEventReportsApi,
  pageGetUserEventsApi,
} from '@/api/trackingapi/userreview'
import { copyObj } from '@/utils/copy'
import { chartColorList } from '@/utils/chart-constants'
import { makeTableCellCenterByIndex, parseTime, queryToString } from '@/utils/index'
import { useChart } from '@/composables/useChart'
import { useLatestOnly } from '@/composables/useLatestOnly'
import type {
  AnalysisCache,
  AnalysisQueryParams,
  EventGroup,
  EventLogRow,
  EventReportByDateRow,
  EventReportRow,
  PieDatum,
  PieTableRow,
  SeqFilterParams,
  SeqFilterValue,
  TrendPoint,
} from '../types'

const props = withDefaults(
  defineProps<{
    projectName?: string | null
    userId?: string | null
    cacheData?: AnalysisCache | null
  }>(),
  { projectName: null, userId: null, cacheData: null },
)

const emit = defineEmits<{ (e: 'update-cache', state: AnalysisCache): void }>()

const route = useRoute()
const proxy = getCurrentInstance()?.proxy

// 顶部事件趋势（v2 的 #eventTotalChart）与事件统计饼图（v2 的 #timePieChart）
const {
  elRef: topChartRef,
  chart: topChart,
  init: initTopChart,
  setOption: setTopChartOption,
} = useChart()
const {
  elRef: pieChartRef,
  chart: pieChart,
  init: initPieChart,
  setOption: setPieChartOption,
} = useChart()

const { next: nextTopChart, isLatest: isLatestTopChart } = useLatestOnly()
const { next: nextPieChart, isLatest: isLatestPieChart } = useLatestOnly()
const { next: nextLogList, isLatest: isLatestLogList } = useLatestOnly()

const filterParams = ref<Partial<SeqFilterParams>>({})
const topChartStyle = {
  width: '100%',
  height: '380px',
  marginTop: '25px',
  paddingLeft: '25px',
  paddingRight: '25px',
}
const leftChartStyle = {
  width: '100%',
  height: '350px',
}
const topSummary = ref<{ total: number; distinct: number }>({ total: 0, distinct: 0 })
const topSeries = ref<{ x: string[]; bar: TrendPoint[]; line: TrendPoint[] }>({
  x: [],
  bar: [],
  line: [],
})
const pieTitle = ref('事件统计')
const logTitle = ref('事件日志')
const pieMode = ref('pie')
const pieData = ref<PieDatum[]>([])
const colorList = chartColorList
const dayDisabled = ref(false)
const queryParams = ref<AnalysisQueryParams>({
  userId: props.userId || queryToString(route.query.userId),
  startDate: '',
  endDate: '',
  pageNum: 1,
  pageSize: 10,
  dimension: 'day',
  events: [],
})
const logList = ref<EventLogRow[]>([])
const logTotal = ref(0)
const totalCountLoading = ref(false)
const reportLoading = ref(false)
const logListLoading = ref(false)
const openChartObj = ref<{ startDate: string; endDate: string; isClick: boolean }>({
  startDate: '',
  endDate: '',
  isClick: false,
})
const seqFilter = ref<SeqFilterValue>({
  dateMode: 'latest',
  rangeTime: null,
  events: [],
  timeFlag: 'month',
})
let isRestoring = false
let restoreTimer: ReturnType<typeof setTimeout> | null = null
const eventOptions = ref<EventGroup[]>([]) // 缓存的事件列表

/* ---------------------------- moment 的替代实现 ---------------------------- */
// v3 没有 moment。checkDateDuration 依赖 moment 的「小数月份差」，
// 边界（正好 3 个月 / 正好 1 年）会决定粒度，所以这里原样复刻 moment 的 monthDiff。

/** 把 'YYYY-MM-DD' 按本地时区解析（new Date('2024-01-01') 会按 UTC 解析，和 moment 不一致） */
function parseYMD(value: string): Date {
  const parts = String(value).split('-')
  const y = Number(parts[0])
  const m = Number(parts[1])
  const d = Number(parts[2])
  return new Date(y, (m || 1) - 1, d || 1)
}

/** 与 moment 的 add(n, 'months') 一致：溢出时夹到目标月最后一天 */
function addMonths(date: Date, n: number): Date {
  const r = new Date(date.getTime())
  const day = r.getDate()
  r.setDate(1)
  r.setMonth(r.getMonth() + n)
  const lastDay = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate()
  r.setDate(Math.min(day, lastDay))
  return r
}

/** 复刻 moment 的 monthDiff(a, b)：a.diff(b, 'months', true) === momentMonthDiff(a, b) */
function momentMonthDiff(a: Date, b: Date): number {
  const wholeMonthDiff = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
  const anchor = addMonths(a, wholeMonthDiff)
  let adjust: number
  if (b.getTime() - anchor.getTime() < 0) {
    const anchor2 = addMonths(a, wholeMonthDiff - 1)
    adjust = (b.getTime() - anchor.getTime()) / (anchor.getTime() - anchor2.getTime())
  } else {
    const anchor2 = addMonths(a, wholeMonthDiff + 1)
    adjust = (b.getTime() - anchor.getTime()) / (anchor2.getTime() - anchor.getTime())
  }
  return -(wholeMonthDiff + adjust) || 0
}

/* -------------------------------- computed -------------------------------- */

const pieTableData = computed<PieTableRow[]>(() => {
  const sum = pieData.value.reduce((s, it) => s + it.value, 0) || 1
  return pieData.value.map((it) => ({
    name: it.eventName,
    eventDisplay: it.eventDisplay,
    value: it.value,
    rate: it.value / sum,
  }))
})

const sucessTableCellCenter = makeTableCellCenterByIndex([2, 3])
const tableHeaderPosition = makeTableCellCenterByIndex([0])

/**
 * 事件日志的展开行：v2 在模板里直接 v-for 对象再调 filterTimeStep，
 * 这里预先算成数组，避免模板里重复调用同一函数。
 */
const logRowProps = computed(() => {
  const map = new Map<EventLogRow, { key: string; text: string }[]>()
  logList.value.forEach((row) => {
    map.set(
      row,
      Object.entries(row.parsedEventProp || {}).map(([key, item]) => ({
        key,
        text: filterTimeStep(key, item),
      })),
    )
  })
  return map
})

/* -------------------------------- methods -------------------------------- */

function copyRowId(id: string) {
  const textarea = document.createElement('textarea')
  textarea.value = id
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
  ElMessage.success('复制成功！')
}

function clearCacheData() {
  if (!route.query.userId || !route.query.projectName) {
    filterParams.value = {}
    topSummary.value = { total: 0, distinct: 0 }
    topSeries.value = { x: [], bar: [], line: [] }
    logList.value = []
    seqFilter.value = {
      dateMode: 'latest',
      rangeTime: null,
      events: [],
      timeFlag: 'month',
    }
  }
}

function resetAll() {
  filterParams.value = {}
  topSummary.value = { total: 0, distinct: 0 }
  topSeries.value = { x: [], bar: [], line: [] }
  logList.value = []
  seqFilter.value = {
    dateMode: 'latest',
    rangeTime: null,
    events: [],
    timeFlag: 'month',
  }
  pieData.value = []
  logTotal.value = 0
  eventOptions.value = []
}

function filterTimeStep(key: string, item: unknown): string {
  if (key == 'lastloginTime' || key == 'registerTime') {
    // 与 v2 的 moment(item).format("YYYY-MM-DD HH:mm:ss") 等价；
    // 与 v2 一致（v2 此处逻辑存疑：item 为空时 moment(undefined) 会返回「当前时间」，
    // 这里返回空串，没有把「无值」显示成 now）
    return parseTime(item as string | number, '{y}-{m}-{d} {h}:{i}:{s}') || ''
  }
  return item === null || item === undefined ? '' : String(item)
}

function formatPercent(v: number | null | undefined) {
  if (!v && v !== 0) return '-'
  return (v * 100).toFixed(2) + '%'
}

function buildRangeTitle(
  startDate: string | undefined,
  endDate: string | undefined,
  baseTitle: string,
) {
  if (!startDate && !endDate) return baseTitle
  if (startDate && endDate && startDate !== endDate) {
    return ` ${baseTitle} ${startDate} ~ ${endDate}`
  }
  const singleDate = startDate || endDate
  return `${baseTitle} ${singleDate}`
}

/** filterParams 上的 rangeTime（v2 写的是 this.filterParams.rangeTime ? ...[0] : ""） */
function filterRangeAt(idx: 0 | 1): string {
  const range = filterParams.value.rangeTime
  if (!range) return ''
  return range[idx] ?? ''
}

function renderTopChart() {
  if (!topChartRef.value) return
  if (!topChart.value) initTopChart()
  const option = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['事件总量', '事件数量'], top: 10, textStyle: { color: '#4d4d4d' } },
    // grid: { left: 30, right: 30, top: 50, bottom: 40 },
    grid: {
      left: '5%',
      right: '5%',
      top: '15%',
      bottom: '5%',
      containLabel: true,
    },

    dataZoom: [
      {
        type: 'inside',
        startValue: 0,
        endValue: 24,
        minValueSpan: 10,
        zoomOnMouseWheel: false,
        moveOnMouseWheel: true,
        moveOnMouseMove: true,
      },
    ],
    xAxis: [
      {
        type: 'category',
        data: topSeries.value.x,
        axisTick: { show: false },
        axisLabel: {
          interval: 1,
          // echarts 6 的 rotate 只认数字，v2 里写的是字符串 "45"
          rotate: 45,
          color: '#4d4d4d',
          formatter: function (value: string) {
            if (value) {
              return value.length > 10 ? value.slice(0, 20) + '...' : value
            }
            // 与 v2 一致：value 为空时不 return，等于返回 undefined
            return undefined
          },
        },
      },
    ],
    yAxis: [
      {
        type: 'value',
        name: '总量',
        min: 0,
        axisLabel: { color: '#4d4d4d' },
        axisTick: { show: false },
      },
      {
        type: 'value',
        name: '数量',
        min: 0,
        position: 'right',
        axisLabel: { color: '#4d4d4d' },
        axisTick: { show: false },
      },
    ],
    series: [
      {
        name: '事件总量',
        type: 'bar',
        data: topSeries.value.bar,
        itemStyle: { color: '#2c7be5' },
        barWidth: 12,
      },
      {
        name: '事件数量',
        type: 'line',
        yAxisIndex: 1,
        data: topSeries.value.line,
        itemStyle: { color: '#ff9f43' },
        smooth: true,
      },
    ],
  }
  setTopChartOption(option as unknown as EChartsOption, true)

  // 移除已有的点击事件，防止重复绑定
  topChart.value?.off('click')
  // 绑定点击事件
  topChart.value?.on('click', (params) => {
    openChartObj.value.isClick = true
    const p = params as { name?: string; data?: TrendPoint }
    if (p && p.name) {
      openChartObj.value.startDate = p.data?.startDate || p.name
      openChartObj.value.endDate = p.data?.endDate || p.name
      logEventDetail()
      getPieChartData(p.data?.startDate || p.name, p.data?.endDate || p.name)
    }
  })
}

function renderPieChart() {
  if (!pieData.value || pieData.value.length === 0) {
    pieChart.value?.clear()
    return
  }
  if (!pieChartRef.value) return
  if (!pieChart.value) initPieChart()
  const option = {
    tooltip: { trigger: 'item' },
    legend: { type: 'scroll', bottom: 0, textStyle: { color: '#4d4d4d' } },
    grid: { left: 30, right: 30, top: 50, bottom: 40 },
    series: [
      {
        type: 'pie',
        radius: ['35%', '55%'],
        center: ['50%', '50%'],
        label: {
          formatter: '{b}: {c}',
          color: '#4d4d4d',
        },
        data: pieData.value,
      },
    ],
    color: colorList,
  }
  setPieChartOption(option as unknown as EChartsOption, true)
}

function getTopChartData() {
  clearCacheData()
  const params = {
    userId: filterParams.value.userId || queryParams.value.userId,
    startDate: filterRangeAt(0),
    endDate: filterRangeAt(1),
    dimension: queryParams.value.dimension,
    projectName: filterParams.value.projectName || null,
    events: filterParams.value.events || [],
  }
  totalCountLoading.value = true
  const token = nextTopChart()
  getUserEventReportByDateApi(params)
    .then((res) => {
      if (!isLatestTopChart(token)) return
      totalCountLoading.value = false
      if (res?.code === 200) {
        const data = (res.data as EventReportByDateRow[]) || []
        const x: string[] = []
        const bar: TrendPoint[] = []
        const line: TrendPoint[] = []
        let total = 0
        let distinct = 0

        data.forEach((item) => {
          if (['week', 'month'].includes(queryParams.value.dimension)) {
            x.push(`${item.startDate} ~ ${item.endDate}`)
          } else {
            x.push(item.dimDate || '')
          }
          bar.push({
            value: item.totalCount,
            startDate: item.startDate,
            endDate: item.endDate,
          })
          line.push({
            value: item.eventCount,
            startDate: item.startDate,
            endDate: item.endDate,
          })
          total += item.totalCount
          distinct += item.eventCount
        })

        topSummary.value = { total, distinct }
        topSeries.value = { x, bar, line }
        renderTopChart()
      }
    })
    .finally(() => {
      if (!isLatestTopChart(token)) return
      totalCountLoading.value = false
    })
}

function getPieChartData(startDate?: string, endDate?: string) {
  clearCacheData()
  reportLoading.value = true
  const params = {
    userId: queryParams.value.userId || '',
    startDate: startDate || filterRangeAt(0),
    endDate: endDate || filterRangeAt(1),
    dimension: 'day',
    projectName: filterParams.value.projectName || null,
    events: filterParams.value.events || [],
  }
  pieTitle.value = buildRangeTitle(startDate, endDate, '事件统计')
  logTitle.value = buildRangeTitle(startDate, endDate, '事件日志')
  const token = nextPieChart()
  getUserEventReportsApi(params)
    .then((res) => {
      if (!isLatestPieChart(token)) return
      reportLoading.value = false
      if (res?.code === 200) {
        const data = (res.data as EventReportRow[]) || []
        pieData.value = data.map((item) => ({
          name: item.eventDisplay || item.eventName || '',
          value: item.count ?? 0,
          ...item,
        }))
        if (pieData.value.length === 0) {
          pieChart.value?.clear()
        }
        nextTick(() => {
          renderPieChart()
        })
      }
    })
    .finally(() => {
      if (!isLatestPieChart(token)) return
      reportLoading.value = false
    })
}

// 事件日志
function logEventDetail() {
  clearCacheData()
  logListLoading.value = true
  queryParams.value.events = filterParams.value.events || []
  queryParams.value.projectName = filterParams.value.projectName || null
  if (openChartObj.value.isClick) {
    queryParams.value.startDate = openChartObj.value.startDate
    queryParams.value.endDate = openChartObj.value.endDate
  } else {
    queryParams.value.startDate = filterRangeAt(0)
    queryParams.value.endDate = filterRangeAt(1)
  }

  const token = nextLogList()
  pageGetUserEventsApi(queryParams.value)
    .then((res) => {
      if (!isLatestLogList(token)) return
      if (res?.code === 200) {
        logListLoading.value = false
        const data = res.data as { total?: number; rows?: EventLogRow[] } | undefined
        logTotal.value = data?.total || 0
        const rows = data?.rows || []
        logList.value = rows.map((item) => {
          let parsedEventProp: Record<string, unknown> = {}
          try {
            parsedEventProp = JSON.parse(item.eventProp || '{}')
          } catch {
            /* 与 v2 一致：解析失败就留空对象 */
          }

          return {
            ...item,
            time: item.createdAt,
            parsedEventProp,
          }
        })
      }
    })
    .finally(() => {
      if (!isLatestLogList(token)) return
      logListLoading.value = false
    })
}

function checkDateDuration(rangeTime: SeqFilterParams['rangeTime']) {
  dayDisabled.value = false
  if (rangeTime && rangeTime.length >= 2) {
    const start = parseYMD(String(rangeTime[0] ?? ''))
    const end = parseYMD(String(rangeTime[1] ?? ''))
    const durationMonths = momentMonthDiff(end, start)
    const durationYears = durationMonths / 12

    if (durationYears > 1 || durationYears == 1) {
      queryParams.value.dimension = 'month'
      dayDisabled.value = true
    } else if (durationMonths > 3 || durationMonths == 3) {
      queryParams.value.dimension = 'week'
    } else if (durationMonths < 3) {
      queryParams.value.dimension = 'day'
    }
  }

  getTopChartData()
  // 默认加载开始日期的事件统计
  getPieChartData()
  // 触发数据更新
  logEventDetail()
}

function setTopFilterParams(params: SeqFilterParams) {
  if (!route.query.userId || !route.query.projectName) {
    resetAll()
    renderTopChart()
    return
  }
  if (isRestoring) return
  filterParams.value = copyObj(params)
  queryParams.value.pageNum = 1
  checkDateDuration(params.rangeTime)
  // filterbar 重置图表点击事件
  openChartObj.value.isClick = false
}

function onGranularityChange() {
  //事件日志
  queryParams.value.pageNum = 1
  logEventDetail()
  getTopChartData()
  getPieChartData()
}

function onLogSizeChange(val: number) {
  queryParams.value.pageSize = val
  queryParams.value.pageNum = 1
  logEventDetail()
}

function onLogPageChange(val: number) {
  queryParams.value.pageNum = val
  logEventDetail()
}

/* ------------------------------ 生命周期 ------------------------------ */

// v2 的 created()
if (!route.query.userId || !route.query.projectName) {
  resetAll()
} else if (props.cacheData) {
  isRestoring = true
  const cache = props.cacheData
  seqFilter.value = cache.seqFilter ? copyObj(cache.seqFilter) : seqFilter.value
  filterParams.value = cache.filterParams || {}
  topSummary.value = cache.topSummary || { total: 0, distinct: 0 }
  topSeries.value = cache.topSeries || { x: [], bar: [], line: [] }
  pieData.value = cache.pieData || []
  logList.value = cache.logList || []
  logTotal.value = cache.logTotal || 0
  queryParams.value = cache.queryParams ? copyObj(cache.queryParams) : queryParams.value
  pieMode.value = cache.pieMode || 'pie'
  openChartObj.value = cache.openChartObj || { startDate: '', endDate: '', isClick: false }
  eventOptions.value = cache.eventOptions || []
}

onMounted(() => {
  if (!route.query.userId || !route.query.projectName) {
    resetAll()
    return
  }
  if (props.cacheData) {
    nextTick(() => {
      if (topSeries.value && topSeries.value.x && topSeries.value.x.length > 0) {
        renderTopChart()
      }
      renderPieChart()
    })

    restoreTimer = setTimeout(() => {
      isRestoring = false
    }, 500)
  }
})

onBeforeUnmount(() => {
  if (restoreTimer) {
    clearTimeout(restoreTimer)
    restoreTimer = null
  }
  // 图表的 resize 监听和 dispose 由 useChart 自己收尾
  emit('update-cache', {
    seqFilter: seqFilter.value,
    filterParams: filterParams.value,
    topSummary: topSummary.value,
    topSeries: topSeries.value,
    pieData: pieData.value,
    logList: logList.value,
    logTotal: logTotal.value,
    queryParams: queryParams.value,
    pieMode: pieMode.value,
    openChartObj: openChartObj.value,
    eventOptions: eventOptions.value,
  })
})
</script>

<template>
  <div style="flex: 1; min-height: 0; display: flex; flex-direction: column">
    <seq-filters
      v-model="seqFilter"
      v-model:cached-event-options="eventOptions"
      by-date-period
      by-select-event
      @set-filter-bar-params="setTopFilterParams"
    />
    <div class="analysis-chart" style="flex: 1; overflow-y: auto; overflow-x: hidden">
      <div>
        <div class="chart-total-number public-hoverItem commonBackgrond">
          <div class="common-title">事件趋势</div>
          <div class="trendHead">
            <!-- 累加没有去重 -->
            <div class="total-number-header"></div>

            <div class="granularity-selector">
              <el-radio-group
                v-model="queryParams.dimension"
                size="small"
                class="customize_radio"
                @change="onGranularityChange"
              >
                <el-radio-button value="day" :disabled="dayDisabled">按日</el-radio-button>
                <el-radio-button value="week">按周</el-radio-button>
                <el-radio-button value="month">按月</el-radio-button>
              </el-radio-group>
            </div>
          </div>
          <div ref="topChartRef" v-loading="totalCountLoading" :style="topChartStyle"></div>
        </div>
      </div>

      <div class="analysis-bottom" style="display: flex; margin-top: 20px">
        <!-- 事件统计 -->
        <div class="statistics commonBackgrond public-hoverItem" style="flex: 1">
          <div class="head-wrap">
            <div class="common-title">{{ pieTitle }}</div>
          </div>
          <div style="display: flex; align-items: flex-start">
            <div style="flex: 1; min-width: 0">
              <div
                v-show="pieTableData && pieTableData.length > 0"
                ref="pieChartRef"
                v-loading="reportLoading"
                :style="leftChartStyle"
              ></div>
              <div v-if="!pieTableData || pieTableData.length === 0" class="empty-tips">
                暂无数据
              </div>
            </div>
            <div
              v-loading="reportLoading"
              style="flex: 1; min-width: 0; padding-left: 20px"
              class="public-Table-minHeight"
            >
              <el-table
                class="public-radius"
                :header-cell-style="{
                  textAlign: 'center',
                  background: '#f7fafe ',
                }"
                :data="pieTableData"
                border
                style="width: 100%"
                max-height="500px"
                :cell-style="sucessTableCellCenter"
              >
                <el-table-column
                  prop="eventDisplay"
                  label="事件显示名"
                  align="center"
                  show-overflow-tooltip
                />
                <el-table-column
                  prop="name"
                  label="事件英文名"
                  align="center"
                  show-overflow-tooltip
                />
                <el-table-column
                  prop="value"
                  label="次数"
                  align="center"
                  :width="proxy?.$fixedWidth.FwValue"
                />
                <el-table-column
                  prop="rate"
                  label="占比"
                  align="center"
                  :width="proxy?.$fixedWidth.FwValue"
                >
                  <template #default="{ row }">{{ formatPercent(row.rate) }}</template>
                </el-table-column>
              </el-table>
            </div>
          </div>
        </div>
      </div>
      <!-- 事件日志 -->
      <div class="item-right commonBackgrond public-hoverItem" style="margin-top: 20px">
        <div class="common-title" style="padding: 10px">{{ logTitle }}</div>
        <div style="padding: 0 15px 15px 15px">
          <el-table
            v-loading="logListLoading"
            class="public-radius"
            :header-cell-style="{
              textAlign: 'center',
              background: '#f7fafe ',
            }"
            :cell-style="tableHeaderPosition"
            :data="logList"
            border
            style="width: 100%"
            max-height="500px"
          >
            <el-table-column type="expand">
              <template #default="{ row }">
                <div>
                  <div class="column-title">事件属性</div>
                  <div
                    v-for="(prop, index) in logRowProps.get(row) || []"
                    :key="index"
                    style="display: flex"
                  >
                    <div class="column-propKey">{{ prop.key }}：{{ prop.text }}</div>
                  </div>
                </div>
              </template>
            </el-table-column>

            <el-table-column prop="logTime" label="时间" :width="proxy?.$fixedWidth.FwTime" />
            <el-table-column
              prop="eventDisplayName"
              label="事件显示名"
              :width="proxy?.$fixedWidth.FwEventName"
            />
            <el-table-column
              prop="eventName"
              label="事件英文名"
              align="center"
              :width="proxy?.$fixedWidth.FwEventName"
            />
            <el-table-column prop="eventProp" label="事件属性">
              <template #default="{ row }">
                <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap">
                  {{ row.eventProp }}
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="logId" label="日志ID">
              <template #default="{ row }">
                <div
                  style="
                    position: relative;
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: flex-start;
                    padding: 0;
                    box-sizing: border-box;
                  "
                >
                  <span
                    style="
                      overflow: hidden;
                      text-overflow: ellipsis;
                      white-space: nowrap;
                      padding-right: 15px;
                    "
                  >
                    {{ row.logId }}
                  </span>
                  <el-icon
                    v-if="row.logId"
                    style="color: #2c7be5; cursor: pointer; position: absolute; right: 0"
                    @click.stop="copyRowId(row.logId)"
                  >
                    <DocumentCopy />
                  </el-icon>
                </div>
              </template>
            </el-table-column>
          </el-table>
          <div class="block">
            <el-pagination
              next-text="下一页"
              :current-page="queryParams.pageNum"
              :page-size="queryParams.pageSize"
              :page-sizes="[10, 20, 30, 40]"
              :total="logTotal"
              @size-change="onLogSizeChange"
              @current-change="onLogPageChange"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.text-ellipsis {
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
}

.column-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 10px;
}

.column-propKey {
  font-size: 13px;
  width: 100%;
  padding-right: 5px;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 20px;
}

.column-eventName {
  display: flex;
  justify-content: flex-start;
  position: relative;
}

.empty-tips {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: $font-size-medium;
  color: $black;
  min-height: 150px;
}

.analysis-chart {
  width: 100%;
  box-sizing: border-box;
  //overflow: hidden;
  height: calc(100vh - 260px);

  .common-title {
    font-size: 14px;
    font-weight: 600;
    white-space: nowrap;
    line-height: 26px;
    color: #4d4d4d !important;
  }

  .trendHead {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;

    .total-number-header {
      .summary-label {
        font-size: 13px;
        font-weight: 500;
      }

      display: flex;
      align-items: center;
      justify-content: flex-start;
      flex: 1;
    }
  }

  .chart-total-number-title {
    font-size: 12px;
    font-weight: bold;
    color: #3d3d3d;
  }

  .commonBackgrond {
    background-color: #fff;
  }

  .head-wrap {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .chart-total-number {
    font-size: 12px;
    font-weight: bold;
    color: #3d3d3d;
    background-color: #fff;
    padding: 10px 15px;
  }

  .analysis-bottom {
    width: 100%;
    box-sizing: border-box;

    .statistics {
      box-sizing: border-box;
      padding: 15px;
      width: 100%;
    }

    .item-right {
      padding: 0 15px;
      width: 100%;
      box-sizing: border-box;
    }
  }
}
</style>
