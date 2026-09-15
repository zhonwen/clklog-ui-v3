<script setup lang="ts">
import type { EChartsOption } from 'echarts'
import { nextTick } from 'vue'
import { useChart } from '@/composables/useChart'

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
let oldValue = 0
let newValue = 0
let oldPercent = '0.00'
let newPercent = '0.00'

function emptyOption(text = ''): EChartsOption {
  return {
    title: {
      text,
      left: 'center',
      top: 'center',
      textStyle: { color: '#999', fontSize: 14, fontWeight: 'normal' },
    },
    series: [],
    legend: {},
    tooltip: { show: false },
  }
}

function pieOption(): EChartsOption {
  const filteredData: { value: number; name: string }[] = []
  if (newValue > 0) filteredData.push({ value: newValue, name: '新访客' })
  if (oldValue > 0) filteredData.push({ value: oldValue, name: '老访客' })
  if (filteredData.length === 0) return emptyOption('暂无数据')
  return {
    title: { left: 'center', top: 'center' },
    tooltip: {
      trigger: 'item',
      formatter(params) {
        const item = Array.isArray(params) ? params[0] : params
        if (!item) return ''
        const percent = item.name === '新访客' ? newPercent : oldPercent
        return `${item.name}: ${item.value} (${percent})`
      },
    },
    legend: { orient: 'vertical', right: 'right', bottom: 'bottom' },
    series: [
      {
        type: 'pie',
        radius: ['50%', '70%'],
        avoidLabelOverlap: false,
        label: { show: false, position: 'center' },
        labelLine: { show: true },
        emphasis: {
          label: {
            show: true,
            fontSize: 28,
            fontWeight: 'bold',
            formatter: (params) => params.name,
          },
        },
        itemStyle: {
          color(colors) {
            if (colors.name === '新访客') return '#2c7be5'
            if (colors.name === '老访客') return '#FFA500'
            return ['#2c7be5', 'rgba(253,126,20,0.8)'][colors.dataIndex] || '#2c7be5'
          },
        },
        data: filteredData,
      },
    ],
  }
}

function render(option: EChartsOption) {
  void nextTick(() => {
    if (!chart.value) init()
    setOption(option, true)
  })
}

function getPercentData(val: Record<string, unknown>) {
  const oldCount = Number(val?.oldUvCount ?? val?.oldUv ?? 0)
  const newCount = Number(val?.newUvCount ?? val?.newUv ?? 0)
  oldPercent = String(val?.oldVistorPercent ?? val?.oldPercent ?? '0.00')
  newPercent = String(val?.newVistorPercent ?? val?.newPercent ?? '0.00')
  if (oldCount === 0 && newCount === 0) {
    render(emptyOption())
    return
  }
  oldValue = oldCount
  newValue = newCount
  render(pieOption())
}

defineExpose({ getPercentData })
</script>

<template>
  <div ref="elRef" :class="className" :style="{ height, width }" />
</template>
