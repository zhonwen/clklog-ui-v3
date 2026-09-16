<script setup lang="ts">
/**
 * 留存 / 流失分析（对应 v2 views/user-behavior/retainedUsers/index.vue）。
 * 矩阵的计算、分桶、字段名、图表配置全部按 v2 原样搬运，只做 Vue3 / echarts 6 的适配。
 */
import { computed, onMounted, ref, watch } from 'vue'
import type { EChartsOption } from 'echarts'
import {
  getVisitorRemainTrendApi,
  getVisitorChurnTrendApi,
} from '@/api/trackingapi/visitor'
import { FilterBar } from '@/layout/components'
import { copyObj } from '@/utils/copy'
import { percenTableNull } from '@/views/user-behavior/filters'
import { useTrackingStore } from '@/stores/tracking'
import { useChart } from '@/composables/useChart'
import { useLatestOnly } from '@/composables/useLatestOnly'

/** 矩阵里的一个格子（第 N 日/周/月） */
interface MatrixCell {
  statTime?: string
  churnRate?: number
  churnCount?: number
  remainRate?: number
  remainCount?: number
  /** getChartsData 里就地挂上去的表头文案（次日 / 第2日 …） */
  headLead?: string
}

/** 矩阵的一行（一个统计周期） */
interface MatrixRow {
  rawStatTime?: string
  rawUvCount?: number
  rows: MatrixCell[]
  /** getChartsData 里就地挂上去的 { 次日: "12.34" } 列表 */
  newArray?: Record<string, string>[]
  /** getChartsData 里就地挂上去的 { 2024-01-01: "12.34" } 列表 */
  changeRate?: Record<string, string>[]
}

/** 一条折线 */
interface SeriesItem {
  name: string
  data: string[]
  type?: string
}

/** 表格单元格的展示数据（v2 是在模板里现算的，这里预先算好，避免模板重复求值） */
interface CellView {
  show: boolean
  bg: string
  statTime: string
  rateText: string
  countText: string | number
}

interface TableViewRow {
  rawStatTime?: string
  rawUvCount?: number
  outCells: CellView[]
  saveCells: CellView[]
}

const trackingStore = useTrackingStore()
const { next, isLatest } = useLatestOnly()
const { elRef: trendChartRef, init: initTrendChart, setOption: setTrendOption } = useChart()
const { elRef: dataChartRef, init: initDataChart, setOption: setDataOption } = useChart()

const loadingRefresh = ref(false)
const dimension = ref('save')
/**
 * 与 v2 一致（v2 此处逻辑存疑：legend 数组从不清空，每刷新一次就往里追加一轮 name，
 * 不过 tendEcharts / drawEcharts 的 option.legend 里并没有用 data，所以不影响渲染）。
 */
const dataChart = ref<{ legend: string[]; seriesData: SeriesItem[]; roundsData: string[] }>({
  legend: [],
  seriesData: [],
  roundsData: [],
})
const dataChart2 = ref<{ legend: string[]; seriesData: SeriesItem[]; roundsData: string[] }>({
  legend: [],
  seriesData: [],
  roundsData: [],
})
const filterBarParams = ref<Record<string, unknown>>({})
const outSaveTableList = ref<MatrixRow[]>([])
const tableLabel = ref<{ label: string }[]>([
  { label: '次日' },
  { label: '第2日' },
  { label: '第3日' },
  { label: '第4日' },
])
const startTime = ref<string[]>([])
const resultList = ref<SeriesItem[]>([])

const projectName = computed(() => trackingStore.projectName)
const commonParams = computed<Record<string, unknown>>(() =>
  Object.assign({ projectName: projectName.value }, filterBarParams.value),
)

/** 把矩阵行摊成表格用的展示结构，列数跟着 tableLabel 走 */
const tableViewRows = computed<TableViewRow[]>(() =>
  outSaveTableList.value.map((row) => {
    const outCells: CellView[] = []
    const saveCells: CellView[] = []
    for (let index = 0; index < tableLabel.value.length; index++) {
      const cell = row.rows?.[index]
      // 与 v2 一致：churnCount / remainCount 有值或恰好为 0 时才显示这一格
      outCells.push({
        show: !!(row.rows && cell && (cell.churnCount || cell.churnCount == 0)),
        bg: `rgba(102,148,227,${cell?.churnRate})`,
        statTime: cell?.statTime ?? '',
        rateText: percenTableNull(cell?.churnRate),
        countText: cell?.churnCount ? '(' + cell.churnCount + ')' : 0,
      })
      saveCells.push({
        show: !!(row.rows && cell && (cell.remainCount || cell.remainCount == 0)),
        // 与 v2 一致：留存这一版的 rgba 第四个参数前多一个空格
        bg: `rgba(102,148,227, ${cell?.remainRate})`,
        statTime: cell?.statTime ?? '',
        rateText: percenTableNull(cell?.remainRate),
        countText: cell?.remainCount ? '(' + cell.remainCount + ')' : 0,
      })
    }
    return {
      rawStatTime: row.rawStatTime,
      rawUvCount: row.rawUvCount,
      outCells,
      saveCells,
    }
  }),
)

function outAndSaveTableEvent() {
  const token = next()
  loadingRefresh.value = true
  const params = copyObj(commonParams.value)
  // this.diffTimeEvent();
  dimension.value = String(commonParams.value.dimensionValue ?? '')
  delete params.dimensionValue
  const api = dimension.value == 'out' ? getVisitorChurnTrendApi : getVisitorRemainTrendApi
  api(params)
    .then((res) => {
      if (!isLatest(token)) return
      if (res?.code == 200) {
        loadingRefresh.value = false
        const labelName: { label: string }[] = []
        outSaveTableList.value = []
        outSaveTableList.value = copyObj((res.data as MatrixRow[] | null) || [])
        outSaveTableList.value.map((item, index) => {
          const a = initLabelEvent(index)
          labelName.push(a)
        })
        tableLabel.value = labelName
        getChartsData(outSaveTableList.value)
      }
    })
    .catch(() => {
      if (!isLatest(token)) return
      loadingRefresh.value = false
    })
}

function initLabelEvent(index: number) {
  let a: { label: string }
  if (commonParams.value.timeType == 'day') {
    a = index == 0 ? { label: '次日' } : { label: '第' + (index + 1) + '日' }
  } else if (commonParams.value.timeType == 'week') {
    a = index == 0 ? { label: '次周' } : { label: '第' + (index + 1) + '周' }
  } else {
    a = index == 0 ? { label: '次月' } : { label: '第' + (index + 1) + '月' }
  }
  return a
}

/** 把每一行的 rows 补齐到和第一行一样长（缺的补空对象） */
function emptyObjEvent(data: MatrixRow[]) {
  const first = data[0]
  if (!first) return
  const targetLength = first.rows.length
  data.forEach((item) => {
    const currentLength = item.rows.length
    const diff = targetLength - currentLength
    if (diff > 0) {
      for (let i = 0; i < diff; i++) {
        item.rows.push({})
      }
    }
  })
}

function getChartsData(data: MatrixRow[]) {
  startTime.value = []
  emptyObjEvent(data)

  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    if (!row) continue
    for (let j = 0; j < row.rows.length; j++) {
      const cell = row.rows[j]
      if (!cell) continue
      if (commonParams.value.timeType == 'day') {
        cell.headLead = j == 0 ? '次日' : '第' + (1 + j) + '日'
      } else if (commonParams.value.timeType == 'week') {
        cell.headLead = j == 0 ? '次周' : '第' + (1 + j) + '周'
      } else {
        cell.headLead = j == 0 ? '次月' : '第' + (1 + j) + '月'
      }

      if (!row.newArray) {
        row.newArray = []
        row.changeRate = []
      }
      if (dimension.value == 'out') {
        if (commonParams.value.timeType == 'day') {
          row.newArray.push({
            [j == 0 ? '次日' : '第' + (j + 1) + '日']: formatterEvent(cell.churnRate),
          })
        } else if (commonParams.value.timeType == 'week') {
          row.newArray.push({
            [j == 0 ? '次周' : '第' + (j + 1) + '周']: formatterEvent(cell.churnRate),
          })
        } else {
          row.newArray.push({
            [j == 0 ? '次月' : '第' + (j + 1) + '月']: formatterEvent(cell.churnRate),
          })
        }

        row.changeRate?.push({
          [String(row.rawStatTime)]: formatterEvent(cell.churnRate),
        })
      } else {
        if (commonParams.value.timeType == 'day') {
          row.newArray.push({
            [j == 0 ? '次日' : '第' + (j + 1) + '日']: formatterEvent(cell.remainRate),
          })
        } else if (commonParams.value.timeType == 'week') {
          row.newArray.push({
            [j == 0 ? '次周' : '第' + (j + 1) + '周']: formatterEvent(cell.remainRate),
          })
        } else {
          row.newArray.push({
            [j == 0 ? '次月' : '第' + (j + 1) + '月']: formatterEvent(cell.remainRate),
          })
        }
        row.changeRate?.push({
          [String(row.rawStatTime)]: formatterEvent(cell.remainRate),
        })
      }
    }
    startTime.value.push(String(row.rawStatTime))
  }

  const first = data[0]
  const XtoDay = (first?.rows ?? []).map((item) => String(item.headLead))
  // 变化趋势
  const abc = data.map((item) => item.newArray ?? [])

  // 过滤为0的值（v2 注释掉了）
  // abc = abc.map((subArray) => subArray.filter((obj) => Object.values(obj)[0] !== 0));

  // 变化率
  const changeRate = data.map((item) => item.changeRate ?? [])
  // changeRate = changeRate.map((subArray) => subArray.filter((obj) => Object.values(obj)[0] !== 0));
  changeRateEvent(changeRate, XtoDay)
  // ----end-----
  const organizedData: Record<string, string[]> = {}
  abc.forEach((dayData) => {
    dayData.forEach((entry) => {
      const key = Object.keys(entry)[0]
      if (key === undefined) return
      const value = entry[key]

      if (!organizedData[key]) {
        organizedData[key] = []
      }

      organizedData[key].push(String(value))
    })
  })

  resultList.value = []
  resultList.value = Object.keys(organizedData).map((key) => ({
    name: key,
    data: organizedData[key] ?? [],
  }))

  // 超过七天按七天展示数据
  if (commonParams.value.timeType == 'day') {
    dataChart.value.seriesData = resultList.value.slice(0, 7)
  } else {
    dataChart.value.seriesData = resultList.value
  }

  dataChart.value.roundsData = startTime.value
  for (let i = 0; i < dataChart.value.seriesData.length; i++) {
    const series = dataChart.value.seriesData[i]
    if (!series) continue
    series.type = 'line'
    // series.smooth = true;
    dataChart.value.legend.push(series.name)
  }

  tendEcharts(dataChart.value.roundsData, dataChart.value.seriesData)
}

function formatterEvent(s?: number) {
  if (s) {
    return (s * 100).toFixed(2)
  }
  return ''
}

/** 留存/流失趋势色板（v2 里注释掉的几个色值一并保留在注释中） */
const CHART_COLORS = [
  '#2c7be5',
  '#80bdef',
  '#c4ebad',
  '#85dec8',
  '#fff2ce',
  '#ffde84',
  // "#003366",
  // "#006699",
  '#4cabce',
  // "#e5323e",
  '#9AFF9A',
  '#7B68EE',
  '#87CEFA',
  '#E0FFFF',
  '#2E8B57',
  '#FFFFE0',
  '#E9967A',
]

/** tooltip 的 formatter，两张图完全一样（v2 也是各写了一份一模一样的） */
function trendTooltipFormatter(
  params: { name?: string; value?: unknown; color?: string; seriesName?: string }[],
) {
  let res = ''
  for (let i = 0; i < params.length; i++) {
    const p = params[i]
    if (!p) continue
    if (i == 0) {
      res += '<div>' + p.name + '</div>'
    }
    if (p.value) {
      res +=
        "<div style='display:flex;align-items:center;'>" +
        ` <div style=' width: 10px; height: 10px; border-radius: 50%;background-color: ${p.color};'>
                </div>` +
        "<div style='margin-left:3px;'>" +
        p.seriesName +
        ' :' +
        p.value +
        '%' +
        '</div>' +
        '</div>'
    }
  }
  return res
}

// 流失趋势
function tendEcharts(xAxisData: string[], seriesData: SeriesItem[]) {
  const option = {
    color: CHART_COLORS,
    tooltip: {
      trigger: 'axis',
      showContent: true,
      formatter: trendTooltipFormatter,
    },
    // 与 v2 一致（v2 此处逻辑存疑：option 里写了两个 dataZoom 键，
    // 第一个 { endValue: 30, minValueSpan: 10 } 被后一个直接覆盖，从来没生效过。
    // 这里只保留真正生效的那一个）。
    dataZoom: [
      {
        type: 'inside',
        startValue: 0,
        endValue: 10,
        zoomOnMouseWheel: false,
        moveOnMouseWheel: true,
        moveOnMouseMove: true,
      },
    ],
    legend: {
      // v2: legend.y = "top" / legend.x = "center"（echarts 4 写法）
      top: 'top',
      left: 'center',
    },
    grid: {
      left: '5%',
      right: '10%',
      bottom: '2%',
      top: '22%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: xAxisData,
      axisLabel: {
        interval: 0,
        // v2 是字符串 "45"，echarts 6 要数字
        rotate: 45,
      },
      axisTick: {
        show: false,
      },
    },
    yAxis: {
      // name: "流失率",
      // 与 v2 一致（v2 此处逻辑存疑：type: "value" 在同一个对象里写了两遍）
      type: 'value',
      nameTextStyle: {
        fontWeight: 400,
        fontSize: 13,
        color: '#4D4D4D',
      },
      axisTick: {
        show: false,
      },
      axisLabel: {
        formatter: '{value}%', // 设置 Y 轴标签的格式为百分比
      },
    },
    // 与 v2 一致（v2 此处逻辑存疑：option 顶层还写了
    // itemStyle: { normal: { color: (item) => COLORS[item.dataIndex % COLORS.length] } }，
    // COLORS 这个变量在整个文件里没有定义，而 echarts 也不认顶层的 itemStyle，
    // 属于永远不会执行的死配置，这里不再搬运）。
    series: seriesData,
  }
  setTrendOption(option as unknown as EChartsOption, true)
}

// 流失变化
function changeRateEvent(changeRate: Record<string, string>[][], XtoDay: string[]) {
  const changeValue: Record<string, string[]> = {}
  changeRate.forEach((dayData) => {
    dayData.forEach((entry) => {
      const key = Object.keys(entry)[0]
      if (key === undefined) return
      const value = entry[key]

      if (!changeValue[key]) {
        changeValue[key] = []
      }

      changeValue[key].push(String(value))
    })
  })
  let changeList: SeriesItem[] = []
  changeList = Object.keys(changeValue).map((key) => ({
    name: key,
    data: changeValue[key] ?? [],
  }))

  // 超过七天按七天展示数据
  if (commonParams.value.timeType == 'day') {
    dataChart2.value.seriesData = changeList
    dataChart2.value.roundsData = XtoDay.slice(0, 7)
  } else {
    dataChart2.value.seriesData = changeList
    dataChart2.value.roundsData = XtoDay
  }

  for (let i = 0; i < dataChart2.value.seriesData.length; i++) {
    const series = dataChart2.value.seriesData[i]
    if (!series) continue
    series.type = 'line'
    // series.smooth = true;
    dataChart2.value.legend.push(series.name)
  }
  drawEcharts(dataChart2.value.roundsData, dataChart2.value.seriesData)
}

function drawEcharts(xAxisData: string[], seriesData: SeriesItem[]) {
  const option = {
    color: CHART_COLORS,
    tooltip: {
      // 与 v2 一致（v2 此处逻辑存疑：trigger: "axis" 在同一个对象里写了两遍）
      trigger: 'axis',
      // show: true,
      // appendToBody: true,
      position: 'bottom',
      confine: true,
      axisPointer: {
        type: 'none',
      },
      textStyle: {
        color: 'fff',
      },
      enterable: true, // 允许鼠标进入提示框浮层中，默认为false
      extraCssText:
        'min-width:150px;max-height:450px;overflow:auto;background:rgba(50, 50, 50, 0.7);color:#fff;', // 出现滚动条
      // extraCssText: 'box-shadow: inset 0px 0px 20px 0px rgba(0,87,161,1);z-index: 1000',
      // position: "center",
      formatter: trendTooltipFormatter,
    },
    dataZoom: [
      {
        type: 'inside',
        startValue: 0,
        endValue: 10,
        minValueSpan: 10,
        zoomOnMouseWheel: false,
        moveOnMouseWheel: true,
        moveOnMouseMove: true,
      },
    ],
    legend: {
      // y: "top",
      // x: "center",
      type: 'scroll', // 使用滚动型分页
      pageIconColor: '#1890ff', // 页码图标的颜色
      pageTextStyle: {
        color: '#1890ff', // 页码文本的颜色
      },
    },
    grid: {
      left: '5%',
      right: '10%',
      bottom: '5%',
      top: '20%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: xAxisData,
    },
    yAxis: {
      // name: "流失率",
      // 与 v2 一致（v2 此处逻辑存疑：type: "value" 在同一个对象里写了两遍）
      type: 'value',
      nameTextStyle: {
        fontWeight: 400,
        fontSize: 13,
        color: '#4D4D4D',
      },
      axisTick: {
        show: false,
      },
      axisLabel: {
        formatter: '{value}%', // 设置 Y 轴标签的格式为百分比
      },
    },
    // 与 v2 一致：同 tendEcharts，顶层 itemStyle.normal.color 引用了未定义的 COLORS，是死配置，不搬运
    series: seriesData,
  }
  setDataOption(option as unknown as EChartsOption, true)
}

function setFilterBarParams(val: Record<string, unknown>) {
  filterBarParams.value = copyObj(val)
}

watch(commonParams, () => {
  outAndSaveTableEvent()
})

onMounted(() => {
  initTrendChart()
  initDataChart()
})
</script>

<template>
  <div class="wrapItem">
    <FilterBar
      :ByCalendar="false"
      :ByTime="false"
      ByActive
      ByTimeSlot
      ByArea
      ByDimension
      :ByVisitor="false"
      :ByDownLoad="false"
      @set-filter-bar-params="setFilterBarParams"
    />
    <div class="public-block">
      <div class="blockDiv setSpace">
        <div v-loading="loadingRefresh" class="blockLeft public-hoverItem block-main">
          <div class="block-head">
            <div v-show="dimension == 'out'" class="block-title">流失趋势</div>
            <div v-show="dimension == 'save'" class="block-title">留存趋势</div>
          </div>
          <div ref="trendChartRef" style="width: 100%; height: 550px" />
        </div>

        <div v-loading="loadingRefresh" class="blockRight public-hoverItem block-main">
          <div class="block-head">
            <div v-show="dimension == 'out'" class="block-title">流失变化</div>
            <div v-show="dimension == 'save'" class="block-title">留存变化</div>
            <div class="block-head-icon" />
          </div>
          <div ref="dataChartRef" style="width: 100%; height: 550px" />
        </div>
      </div>

      <div v-loading="loadingRefresh" class="statistics setSpace public-hoverItem block-main">
        <div class="block-head">
          <div v-show="dimension == 'out'" class="block-title">流失分析图</div>
          <div v-show="dimension == 'save'" class="block-title">留存分析图</div>
          <div class="block-head-icon" />
        </div>
        <div style="width: 100%">
          <el-table
            :data="tableViewRows"
            class="public-radius"
            :header-cell-style="{
              textAlign: 'center',
              background: '#f7fafe ',
            }"
            :cell-style="{
              textAlign: 'center',
            }"
            style="width: 100%"
            border
          >
            <el-table-column
              prop="rawStatTime"
              show-overflow-tooltip
              fixed
              width="200"
              label="日期"
            />

            <el-table-column
              fixed
              prop="rawUvCount"
              label="用户数"
              width="100"
              show-overflow-tooltip
            />
            <el-table-column
              v-for="(item, index) in tableLabel"
              :key="index"
              width="180"
              :label="item.label"
              style="cursor: pointer; height: 60px"
            >
              <template #default="scope">
                <div v-show="dimension == 'out'">
                  <div
                    v-if="scope.row.outCells[index]?.show"
                    :style="{
                      backgroundColor: scope.row.outCells[index]?.bg,
                      padding: '5px 0',
                    }"
                  >
                    <div>{{ scope.row.outCells[index]?.statTime }}</div>
                    <div>
                      {{ scope.row.outCells[index]?.rateText }}
                    </div>
                    <div style="margin-top: 3px">
                      {{ scope.row.outCells[index]?.countText }}
                    </div>
                  </div>
                </div>
                <div v-show="dimension == 'save'">
                  <div
                    v-if="scope.row.saveCells[index]?.show"
                    :style="{
                      backgroundColor: scope.row.saveCells[index]?.bg,
                      padding: '5px 0',
                    }"
                  >
                    <div>{{ scope.row.saveCells[index]?.statTime }}</div>
                    <div>
                      {{ scope.row.saveCells[index]?.rateText }}
                    </div>
                    <div style="margin-top: 3px">
                      {{ scope.row.saveCells[index]?.countText }}
                    </div>
                  </div>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
      <div class="explain public-hoverItem block-main">
        <div class="block-head">
          <div class="block-title">名词解释</div>
          <div class="block-head-icon" />
        </div>
        <!-- 流失 -->
        <div v-show="dimension == 'out'" style="width: 100%" class="customTable">
          <div class="customTable" style="width: 100%">
            <table border="1" width="100%" cellpadding="0" cellspacing="0" align="center">
              <tr>
                <td style="width: 20%">流失用户</td>
                <td colspan="2">
                  选定时间范围开始日期前一日/周/月访问过但在选定时间范围内连续N日/周/月都没有访问过的用户
                </td>
              </tr>
              <tr>
                <td style="width: 20%" rowspan="3">流失率</td>
                <td>按日返回</td>
                <td>
                  返回选定范围内每一日的流失数据，以选定时间范围开始前一日的用户数为基准，计算之后的第一日、第
                  二日、第三日至第N日的流失率
                </td>
              </tr>
              <tr>
                <td style="width: 15%; background-color: #fff">按周返回</td>
                <td>
                  返回选定范围内每一周的流失数据，以选定时间范围开始前一周的用户数为基准，计算之后的第一周、第
                  二周、第三周至第N周的流失率
                </td>
              </tr>
              <tr>
                <td style="width: 15%; background-color: #fff">按月返回</td>
                <td>
                  返回选定范围内每个月的流失数据，以选定时间范围开始前一月的用户数为基准，计算之后的第一月、第
                  二月、第三月至第N月的流失率
                </td>
              </tr>
            </table>
          </div>
        </div>
        <!-- 留存解释 -->
        <div v-show="dimension == 'save'" class="customTable" style="width: 100%">
          <table border="1" width="100%" cellpadding="0" cellspacing="0" align="center">
            <tr>
              <td style="width: 20%">留存用户</td>
              <td colspan="2">
                选定时间范围开始日期前一日/周/月访问过且在选定时间范围内任意一日/周/月也有访问过的用户
              </td>
            </tr>
            <tr>
              <td style="width: 20%" rowspan="3">留存率</td>
              <td>按日返回</td>
              <td>
                返回选定范围内每一日的留存数据，以选定时间范围开始前一日的用户数为基准，计算之后的第一日、第
                二日、第三日至第N日的留存率
              </td>
            </tr>
            <tr>
              <td style="width: 15%; background-color: #fff">按周返回</td>
              <td>
                返回选定范围内每一周的留存数据，以选定时间范围开始前一周的用户数为基准，计算之后的第一周、第
                二周、第三周至第N周的留存率
              </td>
            </tr>
            <tr>
              <td style="width: 15%; background-color: #fff">按月返回</td>
              <td>
                返回选定范围内每个月的留存数据，以选定时间范围开始前一月的用户数为基准，计算之后的第一月、第
                二月、第三月至第N月的留存率
              </td>
            </tr>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.el-table tr) {
  height: 46px;
}

:deep(.el-table .cell) {
  padding-right: 0;
  padding-left: 0;
}

:deep(.el-table--medium th),
:deep(.el-table--medium td) {
  padding: 0 0 !important;
}

.wrapItem {
  .personTh {
    width: 58px;
    height: 30px;
    background: rgba(255, 255, 255, 0.39);
    border: 1px solid #dee0ec;
    border-radius: 6px 0px 0px 6px;
    line-height: 30px;
    text-align: center;
    font-size: 16px;
    font-weight: bold;
    color: #2c7be5;
  }

  .timeTd {
    width: 99px;
    height: 30px;
    background: rgba(255, 255, 255, 0.39);
    border: 1px solid #dee0ec;
    border-radius: 0px 6px 6px 0px;
    line-height: 30px;
    text-align: center;
    font-size: 13px;
    font-weight: 400;
    color: #4d4d4d;
  }

  .innerFont {
    font-size: 13px;
    font-weight: 400;
    color: #4d4d4d;
    margin-left: 8px;
  }

  .setSpace {
    margin-bottom: 20px;
  }

  .blockDiv {
    box-sizing: border-box;
    min-height: 300px;
    display: flex;
    justify-content: space-between;

    .blockLeft {
      width: calc(50% - 10px);
      background-color: #fff;
      min-height: 502px;
      border-radius: 6px;
    }

    .blockRight {
      width: calc(50% - 10px);
      background-color: #fff;
      min-height: 502px;
      border-radius: 6px;
    }
  }

  .localMap {
    height: 514px;
    background-color: #fff;
    border-radius: 6px;
  }

  .visitLog {
    height: 585px;
    background-color: #fff;
    border-radius: 6px;
  }
}
</style>
