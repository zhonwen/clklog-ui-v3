<script setup lang="ts">
/**
 * 来源网站 TOP10 指标图（v2 views/visitor-analysis/chart-component/sourceWeb-analysis-chart.vue）。
 * 父组件通过 ref 调 getSourceChart(rows)，切换指标时 emit sortChange 让父组件重新取数。
 *
 * v2 同目录下还有一个 "sourceWeb-analysis-chart copy.vue"，已废弃，未迁。
 */
import { onMounted, ref } from 'vue'
import type { CSSProperties } from 'vue'
import type { EChartsOption, SeriesOption } from 'echarts'
import { useChart } from '@/composables/useChart'
import { useSettingsStore } from '@/stores/settings'

interface SourceRow {
  sourcesite?: string
  pv?: number
  uv?: number
  visitCount?: number
  ipCount?: number
  bounceRate?: number
}

const settingsStore = useSettingsStore()
const { elRef: myChartRef, init: initMyChart, setOption: setMyChartOption } = useChart()

const emit = defineEmits<{
  (e: 'sortChange', val: { sortName: string; sortOrder: string }): void
}>()

const sourceChartList = ref<SourceRow[]>([])
const options = [
  { value: '浏览量', label: '浏览量', sortName: 'pv' },
  { value: '访客数', label: '访客数', sortName: 'uv' },
  { value: '访问次数', label: '访问次数', sortName: 'visitCount' },
  { value: 'IP数', label: 'IP数', sortName: 'ipCount' },
  { value: '跳出率', label: '跳出率', sortName: 'bounceRate' },
]

const xData = ref<(string | number)[]>([]) // website
const myChartStyle: CSSProperties = { float: 'left', width: '100%', height: '400px' }
const pv = ref<number[]>([])
const uv = ref<number[]>([])
const visitCount = ref<number[]>([])
const ipCount = ref<number[]>([])
const bounceRate = ref<number[]>([])
// pointValue: [ "访客数","访问次数"],
const pointValue = ref('浏览量')

function tooltipFormatter(rawParams: unknown): string {
  const params = (Array.isArray(rawParams) ? rawParams : [rawParams]) as Array<{
    name?: string
    seriesName?: string
    value?: unknown
  }>
  let res = '<div><p>' + String(params[0]?.name ?? '') + '</p></div>'
  for (let i = 0; i < params.length; i++) {
    const item = params[i]
    res += '<p>' + String(item?.seriesName ?? '') + ':' + String(item?.value ?? '') + '</p>'
  }
  return res
}

/** 带必填 name 的 series，方便下面按 name 过滤（SeriesOption 联合类型上的 name 是可选的） */
type NamedSeries = SeriesOption & { name: string }

function initEcharts(val: NamedSeries[]) {
  const sourceChart: EChartsOption = {
    tooltip: {
      trigger: 'axis',
      showContent: true,
      formatter: tooltipFormatter,
    },
    xAxis: {
      type: 'category',
      boundaryGap: true,
      data: xData.value,
      axisLabel: {
        interval: 0, // 强制文字产生间隔
        // v2 写的是字符串 '30'，echarts 5+ 要求数字
        rotate: 30, // 旋转角度
      },
      axisLine: {
        onZero: false,
      },
      axisTick: {
        show: false,
        alignWithLabel: true,
      },
    },
    grid: {
      bottom: '22%',
    },
    legend: {
      data: [pointValue.value],
      top: '0%',
    },
    dataZoom: [
      {
        type: 'inside',
        startValue: 0,
        endValue: 10,
        zoomOnMouseWheel: false, // 关闭滚轮缩放
        moveOnMouseWheel: true, // 开启滚轮平移
        moveOnMouseMove: true, // 鼠标移动能触发数据窗口平移
      },
    ],
    yAxis: {},
    series: val,
  }
  setMyChartOption(sourceChart, true)
}

function filterData(val: string) {
  const cologStyle = settingsStore.cologStyle
  const pvArr = pv.value
  const uvArr = uv.value
  const visitCountArr = visitCount.value
  const ipCountArr = ipCount.value
  const bounceRateArr = bounceRate.value
  if (val === '浏览量') {
    sourceChartList.value.forEach((item) => {
      if (item.pv) {
        pvArr.push(item.pv)
      } else {
        pvArr.push(0)
      }
    })
  } else {
    pv.value = []
  }
  if (val === '访客数') {
    sourceChartList.value.forEach((item) => {
      if (item.uv) {
        uvArr.push(item.uv)
      } else {
        uvArr.push(0)
      }
    })
  } else {
    uv.value = []
  }
  if (val === 'IP数') {
    sourceChartList.value.forEach((item) => {
      if (item.ipCount) {
        ipCountArr.push(item.ipCount)
      } else {
        ipCountArr.push(0)
      }
    })
  } else {
    ipCount.value = []
  }
  if (val === '访问次数') {
    sourceChartList.value.forEach((item) => {
      if (item.visitCount) {
        visitCountArr.push(item.visitCount)
      } else {
        visitCountArr.push(0)
      }
    })
  } else {
    visitCount.value = []
  }

  if (val === '跳出率') {
    sourceChartList.value.forEach((item) => {
      if (item.bounceRate) {
        bounceRateArr.push(item.bounceRate)
      } else {
        bounceRateArr.push(0)
      }
    })
  } else {
    bounceRate.value = []
  }
  // #2c7be5,#4c8fe9,#6ba3ed,#8bb6f1,#abcaf5
  const seriesdata: NamedSeries[] = [
    {
      type: 'bar',
      data: pv.value,
      barWidth: 20,
      barGap: '100%',
      name: '浏览量',
      label: { show: true, position: 'top' },
      itemStyle: { color: cologStyle.$pv },
    },
    {
      type: 'bar',
      data: uv.value,
      barWidth: 20,
      name: '访客数',
      label: { show: true, position: 'top' },
      itemStyle: { color: cologStyle.$uv },
    },
    {
      type: 'bar',
      data: visitCount.value,
      barWidth: 20,
      name: '访问次数',
      label: { show: true, position: 'top' },
      itemStyle: { color: cologStyle.$visitCount },
    },
    {
      type: 'bar',
      data: ipCount.value,
      barWidth: 20,
      name: 'IP数',
      label: { show: true, position: 'top' },
      itemStyle: { color: cologStyle.$ipCount },
    },
    {
      type: 'bar',
      data: bounceRate.value,
      barWidth: 20,
      name: '跳出率',
      label: { show: true, position: 'top' },
      itemStyle: { color: cologStyle.$bounceRate },
    },
  ]
  // 与 v2 完全一致的「只留当前指标」写法（splice + i--）
  for (let i = 0; i < seriesdata.length; i++) {
    if (pointValue.value !== seriesdata[i]?.name) {
      seriesdata.splice(i--, 1)
    }
  }
  initEcharts(seriesdata)
}

function getHost(url: string) {
  let host = ''
  const regex = /^\w+:\/\/([^/]*).*/
  const match = url.match(regex)
  if (match) {
    host = match[1] ?? ''
  } else {
    host = url
  }
  return host
}

function getSourceChart(val: SourceRow[]) {
  pv.value = []
  uv.value = []
  visitCount.value = []
  ipCount.value = []
  bounceRate.value = []
  xData.value = []
  // this.sourceChartList = val.detail;
  sourceChartList.value = val || []
  sourceChartList.value.forEach((item) => {
    if (item.sourcesite) {
      const hostName = getHost(item.sourcesite)
      xData.value.push(hostName)
    } else {
      xData.value.push(0)
    }
  })
  filterData(pointValue.value)
}

function changeChartValue(e: string) {
  pv.value = []
  uv.value = []
  visitCount.value = []
  ipCount.value = []
  bounceRate.value = []

  // 找到选中的选项，获取对应的sortName
  const selectedOption = options.find((option) => option.value === e)
  if (selectedOption) {
    // 调用父组件的排序方法
    emit('sortChange', {
      sortName: selectedOption.sortName,
      sortOrder: 'desc',
    })
  }

  filterData(pointValue.value)
}

onMounted(() => initMyChart())

defineExpose({ getSourceChart })
</script>

<template>
  <div>
    <div class="chartsIcon">
      <div class="chartLeft public-hoverItem">
        <div class="trendHead">
          <div class="trafficHead">TOP10来源网站指标展示</div>
          <div class="block">
            <el-select
              v-model="pointValue"
              class="custom_select"
              placeholder="请选择"
              style="min-width: 280px"
              @change="changeChartValue"
            >
              <el-option
                v-for="item in options"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </div>
        </div>
        <div ref="myChartRef" :style="myChartStyle"></div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
// v2 这里是 @import "~@/styles/components/custom-select.scss";
// v3 已在 styles/index.scss 全局 @use，组件内不再重复引入

.trafficHead {
  font-size: 16px;
  font-weight: 600;
  color: #4d4d4d;
  padding: 15px 13px 18px 0px;
}

img {
  width: 11.44px;
  height: 11.44px;
  margin-left: 12px;
  cursor: pointer;
}

.trendHead {
  display: flex;
  align-items: center;
  position: relative;

  .iconFlag {
    position: absolute;
    right: 13px;
    top: 19px;
    color: #acaaaa;
    font-size: 16px;
    cursor: pointer;
  }
}

.chartsIcon {
  margin: 20px;
  // width: calc(100% -20px);
  box-sizing: border-box;
  min-height: 300px;
  display: flex;
  justify-content: space-between;

  .chartLeft {
    background-color: #fff;
    padding: 15px;
    width: 100%;
    min-height: 400px;

    .point {
      padding-right: 10px;
    }
  }
}
</style>
