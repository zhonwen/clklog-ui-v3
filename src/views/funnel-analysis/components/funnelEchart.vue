<template>
  <div style="width: 100%; height: 100%">
    <div ref="elRef" class="customEchart"></div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import type { EChartsOption } from 'echarts'
import { copyObj } from '@/utils/copy'
import { useChart } from '@/composables/useChart'
import type { FunnelResult } from '../types'

/**
 * 漏斗转化率折线图。
 * 与 v2 的 src/views/funnel-analysis/components/funnelEchart.vue 一一对应。
 *
 * 与 v2 一致（v2 此处逻辑存疑：chartModel.vue 虽然 import 并注册了这个组件，
 * 但模板里并没有渲染它，checkGuide 里的 this.$refs.funnelEchartRef 恒为 undefined，
 * 所以这个组件在 v2 里实际上是走不到的，迁移时原样保留）。
 */
defineOptions({ name: 'funnelEchart' })

const { elRef, init, setOption } = useChart()

/** 图表 series。v2 里同一个数组既放折线也放 markLine 辅助线 */
interface FunnelSeries {
  name?: string
  type: 'line'
  data?: number[]
  smooth?: boolean
  stack?: string
  symbolSize?: number
  markLine?: { data: { name: string; yAxis: number }[]; label: { distance: number[] } }
  /** 与 v2 一致：v2 的 drawEcharts 会读 item.value 覆盖 data，但从来没有人写过这个字段 */
  value?: number[]
  /** tooltip 里显示的人数 / 次数，v2 同样从未写入 */
  convertedUser?: number[]
}

const stepPoint = ref(0) // 默认总体
const resDataList = ref<FunnelResult | null>(null)
const guideLine = ref<string[]>([])
const transformedData = ref<FunnelSeries[]>([])
const dataChart = ref<{ legend: string[]; dateList: string[] }>({
  legend: [],
  dateList: [],
})
const groupsListShow = ref<string[]>([])
const measurementType = ref('UV')
/** 'dim' 或 'date' */
const mode = ref<'dim' | 'date'>('dim')

onMounted(() => init())

function guideLineEvent(line: string[], point: number) {
  stepPoint.value = point
  guideLine.value = line
  // Remove any existing guide line series
  transformedData.value = transformedData.value.filter((item) => !item.markLine)

  if (guideLine.value.includes('line')) {
    let yAxisValue = 0.5 // Default value

    const maxValues = transformedData.value
      .map((series) => {
        if (series.value && series.value.length > 0) {
          return Math.max(...series.value)
        }
        return -Infinity
      })
      .filter((val) => val !== -Infinity)

    if (maxValues.length > 0) {
      const sum = maxValues.reduce((a, b) => a + b, 0)
      yAxisValue = sum / maxValues.length
    }
    const lineMark: FunnelSeries = {
      type: 'line',
      stack: 'all',
      symbolSize: 16,
      markLine: {
        data: [{ name: 'start', yAxis: yAxisValue }],
        label: {
          distance: [20, 8],
        },
      },
    }
    transformedData.value.push(lineMark)
  }
  // Redraw the chart
  drawEcharts(dataChart.value.legend, dataChart.value.dateList, transformedData.value)
}

/** 响应 res */
function echartResEvent(
  res: FunnelResult,
  point: number,
  list: string[],
  measurement: string,
  chartMode: 'dim' | 'date' = 'dim',
) {
  measurementType.value = measurement // 人数/次数
  groupsListShow.value = copyObj(list) // 接口维度限制的条数
  stepPoint.value = point // 图表步骤第几步转换
  resDataList.value = copyObj(res)
  mode.value = chartMode
  updateFunnelChartBySlice()
}

/**
 * 根据 dateList / byValues 筛选 rows，动态渲染 echarts。
 * 与 v2 一致（v2 此处逻辑存疑：v2 在这里先后算了 xAxisData / finalXAxis / sortedXAxis /
 * xAxisLabels 四份 X 轴，最后只用了 actualXAxis，前面几份都是没有副作用的死代码，这里不再保留）。
 */
function updateFunnelChartBySlice() {
  const data = resDataList.value
  if (!data || !data.rows) return

  const rows = data.rows

  const sampleRow = rows.find((r) => r.dimDate === '$ALL' && r.byValues[0] === '$ALL') || rows[0]
  if (!sampleRow) return

  const stepsCount = sampleRow.steps ? sampleRow.steps.length : 0
  // 按照 tabOptions 的逻辑: 总体转换, 第1步, 第1步转化, 第2步转化...
  const actualXAxis = ['总体转换', '第1步']
  for (let i = 1; i < stepsCount; i++) {
    actualXAxis.push(`第${i}步转化`)
  }

  const series: FunnelSeries[] = []

  if (mode.value === 'dim') {
    // 弹窗模式：Legend 是维度 (groupsListShow)
    groupsListShow.value.forEach((groupVal) => {
      const row = rows.find((r) => r.dimDate === '$ALL' && r.byValues.join(',') === groupVal)
      if (row) {
        const values: number[] = []
        // 总体转换
        values.push(row.conversionRate || 0)
        // 第1步
        values.push(100) // 第一步通常是100%或者由人数决定，这里按转化率轴通常第一步是基准
        // 步骤转化
        if (row.steps) {
          row.steps.slice(1).forEach((s) => {
            values.push(s.conversionRate || 0)
          })
        }
        series.push({
          name: groupVal === 'null,null' || groupVal === '$ALL' ? '总体' : groupVal,
          type: 'line',
          data: values,
          smooth: true,
        })
      }
    })
    dataChart.value.dateList = actualXAxis
  } else {
    // 外部模式：Legend 是时间 (groupsListShow 存的是日期)
    groupsListShow.value.forEach((date) => {
      const row = rows.find((r) => r.dimDate === date && r.byValues[0] === '$ALL')
      if (row) {
        const values: number[] = []
        values.push(row.conversionRate || 0)
        values.push(100)
        if (row.steps) {
          row.steps.slice(1).forEach((s) => {
            values.push(s.conversionRate || 0)
          })
        }
        series.push({
          name: date,
          type: 'line',
          data: values,
          smooth: true,
        })
      }
    })
    dataChart.value.dateList = actualXAxis
  }

  dataChart.value.legend = series.map((s) => s.name ?? '')
  transformedData.value = series

  void nextTick(() => {
    drawEcharts(dataChart.value.legend, dataChart.value.dateList, transformedData.value)
  })
}

/**
 * 与 v2 一致（v2 此处逻辑存疑：itemStyle.normal.color 里引用了一个全局并不存在的 COLORS，
 * 真走到会 ReferenceError；这里把它指向同一份 option.color 色板，其余不变）。
 */
const COLORS = [
  '#2c7be5',
  '#80bdef',
  '#c4ebad',
  '#85dec8',
  '#fff2ce',
  '#ffde84',
  '#003366',
  '#006699',
  '#4cabce',
  '#e5323e',
  '#9AFF9A',
  '#7B68EE',
  '#87CEFA',
  '#E0FFFF',
  '#2E8B57',
  '#FFFFE0',
  '#E9967A',
]

/** tooltip 回调里拿到的单项 */
interface TooltipParam {
  name: string
  marker: string
  seriesName: string
  value: number
  dataIndex?: number
  seriesIndex?: number
}

function drawEcharts(legendData: string[], dateList: string[], echartList: FunnelSeries[]) {
  // 与 v2 一致（v2 此处逻辑存疑：series 上并没有 value 字段，这一步会把 data 抹成 undefined，
  // 图表因此画不出内容）
  const seriesList = echartList.map((item) => ({
    ...item,
    data: item.value,
  }))

  // v2 在这里 dispose 后重新 init，useChart 的 init 同样是「先 dispose 再建」，语义一致
  init()

  const unitLabel = measurementType.value == 'UV' ? '人数' : '次数'
  const option = {
    color: COLORS,
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow', // 默认为直线，可选为：'line' | 'shadow'
      },
      showAssistTooltip: true,
      enterable: true, // 鼠标是否可进入提示框浮层中
      hideDelay: 200, // 浮层隐藏的延迟
      confine: true,
      backgroundColor: 'rgba(255,255,255, 1)',
      formatter: (params: TooltipParam[]) => {
        let htmlStr =
          '<div style="height: auto;max-height: 490px;overflow-y: auto;overflow-x:auto;max-width:500px;color:#666;"><p>' +
          '时间：' +
          (params[0]?.name ?? '') +
          '</p>'
        for (let i = 0; i < params.length; i++) {
          const item = params[i]
          if (!item) continue
          // 获取 convertedUser
          let convertedUser: number | string = ''
          if (
            item.dataIndex !== undefined &&
            item.seriesIndex !== undefined &&
            item.seriesIndex < echartList.length
          ) {
            const series = echartList[item.seriesIndex]
            if (series?.convertedUser && Array.isArray(series.convertedUser)) {
              convertedUser = series.convertedUser[item.dataIndex] ?? ''
            }
          }
          htmlStr +=
            '<p style="color: #666;">' +
            item.marker +
            (filterLableLength(item.seriesName) === '$ALL'
              ? '总体'
              : filterLableLength(item.seriesName)) +
            '：' +
            '（转换率：' +
            item.value +
            '%' +
            '）' +
            (convertedUser !== '' ? '（' + unitLabel + '：' + convertedUser + '）' : '') +
            '</p>'
        }
        htmlStr += '</div>'
        return htmlStr
      },
      extraCssText: 'box-shadow: 0 0 3px rgba(150,150,150, 0.7);',
      textStyle: {
        fontSize: 12,
        color: '#fff',
      },
    },
    dataZoom: [
      {
        type: 'inside',
        startValue: 0,
        endValue: 30,
        minValueSpan: 10,
        zoomOnMouseWheel: false,
        moveOnMouseWheel: true,
        moveOnMouseMove: true,
      },
    ],
    legend: {
      type: 'scroll', // 使用滚动条
      // echarts 6 不再支持 legend.x / legend.y，等价写法是 left / top
      left: 'center',
      top: 'bottom',
      data: legendData,
      textStyle: {
        fontSize: 12,
        color: '#666',
      },
    },
    grid: {
      left: '5%',
      right: '5%',
      bottom: '13%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: dateList,
      axisLabel: {
        interval: 3,
        // echarts 6 的 rotate 必须是数字，v2 写的是字符串 "45"
        rotate: 45,
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: '{value}%', // 设置 Y 轴标签的格式为百分比
      },
    },
    // echarts 6 取消了 itemStyle.normal 这一层，直接平铺
    itemStyle: {
      color: (item: { dataIndex: number }) => {
        return COLORS[item.dataIndex % COLORS.length]
      },
    },
    series: seriesList,
  }

  setOption(option as unknown as EChartsOption, true)
}

function filterLableLength(val: string) {
  // 与 v2 一致：v2 里截断成 15 个字的那段是注释掉的
  return val
}

defineExpose({ guideLineEvent, echartResEvent })
</script>

<style lang="scss" scoped>
.customEchart {
  width: 100%;
  height: 500px;
}
</style>
