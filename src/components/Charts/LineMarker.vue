<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import { nextTick } from 'vue'
import { useChart } from '@/composables/useChart'
import { useSettingsStore } from '@/stores/settings'

export type FlowTrendItem = {
  statTime?: string
  pv?: number
  uv?: number
  visitCount?: number
  ipCount?: number
  bounceRate?: number
}

withDefaults(
  defineProps<{
    className?: string
    height?: string
    width?: string
  }>(),
  {
    className: 'chart',
    height: '350px',
    width: '100%',
  },
)

const { elRef, chart, init, setOption } = useChart()
const settingsStore = useSettingsStore()
let flowTrendList: FlowTrendItem[] = []
let headLege: string[] = []

function collect(key: keyof FlowTrendItem, enabled: boolean) {
  if (!enabled) return []
  return flowTrendList.map((item) => Number(item[key] || 0))
}

function buildOption(): EChartsOption {
  const colors = settingsStore.cologStyle
  const statTime = flowTrendList.map((item) => {
    if (!item.statTime) return '0'
    return item.statTime.length <= 2 ? `${item.statTime}时` : item.statTime
  })
  return {
    backgroundColor: '#fff',
    tooltip: {
      trigger: 'axis',
      axisPointer: { lineStyle: { color: '#C0CADB', width: 3 } },
    },
    legend: {
      top: 20,
      icon: 'rect',
      itemWidth: 14,
      itemHeight: 5,
      itemGap: 13,
      data: headLege,
      right: '4%',
      textStyle: { fontSize: 12, color: 'black' },
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
    grid: { top: 100, left: '2%', right: '2%', bottom: '2%', containLabel: true },
    xAxis: [
      {
        type: 'category',
        boundaryGap: false,
        data: statTime,
        axisTick: { show: false },
        axisLabel: { interval: 0, rotate: 45 },
      },
    ],
    yAxis: [{ type: 'value', axisTick: { show: false } }],
    series: [
      { name: '浏览量', type: 'line', lineStyle: { width: 3 }, itemStyle: { color: colors.$pv }, data: collect('pv', headLege.includes('浏览量')) },
      { name: '访客数', type: 'line', lineStyle: { width: 3 }, itemStyle: { color: colors.$uv }, data: collect('uv', headLege.includes('访客数')) },
      { name: '访问次数', type: 'line', lineStyle: { width: 3 }, itemStyle: { color: colors.$visitCount }, data: collect('visitCount', headLege.includes('访问次数')) },
      { name: 'IP数', type: 'line', lineStyle: { width: 3 }, itemStyle: { color: colors.$ipCount }, data: collect('ipCount', headLege.includes('IP数')) },
      { name: '跳出率', type: 'line', lineStyle: { width: 3 }, itemStyle: { color: colors.$bounceRate }, data: collect('bounceRate', headLege.includes('跳出率')) },
    ],
  }
}

function renderChart() {
  void nextTick(() => {
    if (!chart.value) init()
    setOption(buildOption(), true)
  })
}

function getApiTrendList(val: FlowTrendItem[], lege: string[]) {
  flowTrendList = val || []
  headLege = lege || []
  renderChart()
}

function changeLegend(val: string[]) {
  headLege = val || []
  renderChart()
}

defineExpose({ getApiTrendList, changeLegend })
</script>

<template>
  <div ref="elRef" :class="className" :style="{ height, width }" />
</template>
