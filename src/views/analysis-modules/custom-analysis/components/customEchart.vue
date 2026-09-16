<template>
  <div class="logCon">
    <div v-if="transformedData.length > 0">
      <div style="margin-left: 100px; margin-top: -20px">
        <el-select v-model="byValue" placeholder="请选择" @change="startAnalys()">
          <el-option
            v-for="item in optionList"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </div>
      <div ref="elRef" class="customEchart" />
    </div>
    <div v-else style="font-size: 18px; line-height: 438px; text-align: center">暂无数据</div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue'
import type { EChartsOption } from 'echarts'
import { copyObj } from '@/utils/copy'
import { useChart } from '@/composables/useChart'
import type { ResultDetail } from '../types'

/** 单条折线：v2 的 transformedData 元素，字段名一律保持 v2 原样（含 lableId / dataTyped 的拼写） */
interface TransformedItem {
  dataTyped: number
  name: string
  smooth: boolean
  type: string
  value: { value: number | string; dataType: string | undefined }[]
  lableId: string
}

const emit = defineEmits<{ (e: 'startAnalysiApi', isRefresh: string): void }>()

const { elRef, init, setOption } = useChart()

const byValue = ref(5)
const optionList = [
  { value: 5, label: '前5项' },
  { value: 10, label: '前10项' },
  { value: 15, label: '前15项' },
  { value: 20, label: '前20项' },
  { value: 30, label: '前30项' },
  { value: 50, label: '前50项' },
]

/** 时间轴（x 轴） */
const seriesList = ref<string[]>([])
/** v2 的 dataChart.legend 始终是空数组，drawEcharts 里也没用上，这里保留同样的语义 */
const legendData = ref<string[]>([])
const transformedData = ref<TransformedItem[]>([])

/** 切换「前 N 项」时让父级重新发起分析，与 v2 一致 */
function startAnalys() {
  emit('startAnalysiApi', 'refresh')
}

function timestampToDateString(timestamp: string): string {
  const date = new Date(parseInt(timestamp))
  return date.toISOString().split('T')[0] ?? ''
}

function initEchartEvent(val: ResultDetail) {
  const dataList = copyObj(val)
  dataList.rows.forEach((obj) => {
    obj.byValues.forEach((value, index) => {
      if (obj.byFields[index] === 'DATETIME') {
        obj.byValues[index] = timestampToDateString(value)
      }
    })
  })

  const list: TransformedItem[] = []
  dataList.rows.forEach((item) => {
    item.pointList.forEach((point, index) => {
      // 与 v2 一致：维度值里过滤掉空串后用「，」拼接，再接指标名
      const byValuesStr = item.byValues.length
        ? `${item.byValues.filter((v) => v).join('，')}，`
        : ''
      const name = `${byValuesStr}${point}`
      const lableId = point
      const smooth = false
      const dataTyped = 123
      const type = 'line'
      const value = item.values.map((row) => ({
        value: row[index] || 0,
        dataType: item.byFields[index],
      }))
      list.push({ dataTyped, name, smooth, type, value, lableId })
    })
  })

  transformedData.value =
    byValue.value && list.length > byValue.value ? list.slice(0, byValue.value) : list

  if (val.rows.length > 0) {
    seriesList.value = val.series
  } else {
    seriesList.value = [] // 时间
  }

  void nextTick(() => {
    if (transformedData.value.length > 0) {
      drawEcharts(legendData.value, seriesList.value, transformedData.value)
    }
  })
}

function drawEcharts(_legendData: string[], xAxisData: string[], echartList: TransformedItem[]) {
  const series = echartList.map((item) => ({
    ...item,
    data: item.value,
  }))
  const option = {
    color: [
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
    ],
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow', // 默认为直线，可选为：'line' | 'shadow'
      },
      enterable: true, // 鼠标是否可进入提示框浮层中
      hideDelay: 200, // 浮层隐藏的延迟
      confine: true,
      backgroundColor: 'rgba(255,255,255, 1)',
      formatter: function (params: { name: string; marker: string; seriesName: string; value: unknown }[]) {
        let htmlStr =
          '<div style="height: auto;max-height: 490px;overflow-y: auto;color:#666;"><p>' +
          '时间：' +
          (params[0]?.name ?? '') +
          '</p>'
        for (let i = 0; i < params.length; i++) {
          const p = params[i]
          if (!p) continue
          htmlStr +=
            '<p style="color: #666;">' + p.marker + p.seriesName + '：' + String(p.value) + '</p>'
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
      orient: 'vertical', // 垂直排列
      right: 10,
      type: 'scroll', // 使用滚动条
      top: 24,
      bottom: 20,
      textStyle: {
        fontSize: 12,
        color: '#666',
      },
    },
    grid: {
      left: '3%',
      right: '20%',
      bottom: '0%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: xAxisData,
      axisLabel: {
        interval: 3,
        rotate: '45',
      },
    },
    yAxis: {
      type: 'value',
    },
    // 与 v2 一致（v2 此处逻辑存疑：option 根级还写了一个 itemStyle.normal.color 回调，
    // 一来根级 itemStyle 不是合法的 echarts 配置、不会被读取，二来回调里引用了整个文件都没有定义的
    // COLORS，一旦真被调用就是 ReferenceError。迁移时移除该无效配置，渲染结果不变）
    series,
  }
  init()
  setOption(option as unknown as EChartsOption, true)
}

defineExpose({ initEchartEvent })
</script>

<style>
.tooltip {
  /* 设置 tooltip 的最大宽度 */
  max-width: 150px;
  /* 开启滚动条 */
  overflow: auto;
}
</style>

<style lang="scss" scoped>
.logCon {
  width: 100%;
  min-height: 438px;
  background-color: #fff;

  .customEchart {
    width: 100%;
    height: 600px;
  }
}
</style>
