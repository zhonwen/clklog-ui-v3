<template>
  <div style="width: 100%; height: 100%">
    <div ref="elRef" style="width: 100%; height: 100%"></div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import type { EChartsOption } from 'echarts'
import { copyObj } from '@/utils/copy'
import { chartColorList } from '@/utils/chart-constants'
import { useChart } from '@/composables/useChart'
import type { FunnelResult, FunnelRow } from '../types'

/**
 * 漏斗各步骤的折线图。
 * 与 v2 的 src/views/funnel-analysis/components/metricLineChart.vue 一一对应。
 * resize / dispose 由 useChart 统一接管（v2 是自己 addEventListener('resize') + beforeDestroy 里 dispose）。
 */
defineOptions({ name: 'MetricLineChart' })

const { elRef, init, setOption } = useChart()

/** 图表上的一个数据点，tooltip 要用到 rate / isFirstStep */
interface MetricPoint {
  value: number
  rate: number
  isFirstStep: boolean
  labelName: string
}

interface MetricSeries {
  name: string
  type: 'line'
  smooth: boolean
  data: MetricPoint[]
}

const resDataList = ref<FunnelResult | null>(null)
const groupsListShow = ref<string[]>([])
/** 'dim'（图例是维度，弹窗用）或 'date'（图例是日期，主页面用） */
const mode = ref<'dim' | 'date'>('dim')

onMounted(() => init())

function initChart(res: FunnelResult, list: string[], chartMode: 'dim' | 'date' = 'dim') {
  // 显式重置数据，解决缓存问题
  resDataList.value = null
  groupsListShow.value = []

  void nextTick(() => {
    resDataList.value = copyObj(res)
    groupsListShow.value = copyObj(list)
    mode.value = chartMode
    render()
  })
}

function render() {
  const data = resDataList.value
  if (!data || !data.rows) return

  const rows = data.rows

  // 1. 构造 X 轴：转化步骤指标 (总体转换 + 第1步 + 各环节转化率)
  const sampleRow = rows.find((r) => r.byValues[0] === '$ALL') || rows[0]
  if (!sampleRow) return
  // 与 v2 一致：v2 注释掉了 ['总体转换', '第1步'] 的写法，用的是下面这行
  const xAxisData = ['第1步']
  if (sampleRow.steps) {
    for (let i = 1; i < sampleRow.steps.length; i++) {
      xAxisData.push(`第${i}步转化`)
    }
  }

  // 2. 构造 Series 数据
  const series: MetricSeries[] = []
  if (mode.value === 'dim') {
    // 弹窗模式：根据 byValues 匹配维度
    groupsListShow.value.forEach((groupVal) => {
      const row = rows.find((r) => r.byValues.join(',') === groupVal)
      if (row) {
        series.push({
          name: groupVal === 'null,null' || groupVal === '$ALL' ? '总体' : groupVal,
          type: 'line',
          smooth: true,
          data: extractValues(row),
        })
      }
    })
  } else {
    // 主页面模式：根据 dimDate 匹配日期
    groupsListShow.value.forEach((date) => {
      const row = rows.find((r) => r.dimDate === date && r.byValues[0] === '$ALL')
      if (row) {
        series.push({
          name: date,
          type: 'line',
          smooth: true,
          data: extractValues(row),
        })
      }
    })
  }

  void nextTick(() => {
    draw(xAxisData, series)
  })
}

function extractValues(row: FunnelRow): MetricPoint[] {
  const values: MetricPoint[] = []
  // 第1步
  values.push({
    value: row.steps && row.steps[0] ? (row.steps[0]?.convertedUser ?? 0) : 0, // Y 轴改为人数
    rate: 100,
    isFirstStep: true,
    labelName: '第1步',
  })
  // 后续转化率
  if (row.steps) {
    for (let i = 1; i < row.steps.length; i++) {
      const step = row.steps[i]
      values.push({
        value: step?.convertedUser || 0, // Y 轴改为人数
        rate: step?.conversionRate || 0,
        isFirstStep: false,
        labelName: `第${i}步转化`,
      })
    }
  }
  return values
}

/** tooltip 回调里拿到的单项 */
interface TooltipParam {
  name: string
  marker: string
  seriesName: string
  data: MetricPoint
}

function draw(xAxisData: string[], series: MetricSeries[]) {
  // v2 在这里 dispose 后重新 init，useChart 的 init 同样是「先 dispose 再建」，语义一致
  init()

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: TooltipParam[]) => {
        let res = (params[0]?.name ?? '') + '<br/>'
        params.forEach((item) => {
          const dataObj = item.data
          const unit = resDataList.value?.measurementType === 'PV' ? '次' : '人'
          if (dataObj.isFirstStep) {
            // 第1步：只显示人数
            res += `${item.marker} ${item.seriesName}: ${dataObj.value}${unit}<br/>`
          } else {
            // 其他：显示人数和转化率
            res += `${item.marker} ${item.seriesName}: ${dataObj.value}${unit} (${dataObj.rate.toFixed(2)}%)<br/>`
          }
        })
        return res
      },
    },
    legend: {
      bottom: 0,
      data: series.map((s) => s.name),
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '10%',
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: xAxisData,
      axisLabel: {
        interval: 0,
        rotate: 30,
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        formatter: (value: number) => {
          const unit = resDataList.value && resDataList.value.measurementType === 'PV' ? '次' : '人'
          return value + unit
        },
      },
    },
    series: series.map((s, index) => ({
      ...s,
      color: chartColorList[index],
    })),
  }

  setOption(option as unknown as EChartsOption, true)
}

defineExpose({ initChart })
</script>
