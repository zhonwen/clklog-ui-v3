<script setup lang="ts">
/**
 * 趋势分析-趋势图（v2 views/visitor-analysis/trend-analysis/components/trendChart.vue）。
 * 父组件通过 ref 调 apiDetailList(data, dateFlag, commonParams)。
 *
 * v2 里 components 注册了 Chart(LineMarker) / pieChart 但模板没用过，v3 不再引入。
 * v2 的 props: ["flowTrendListed"] 也没有任何使用点，一并省掉。
 */
import { nextTick, onMounted, ref, watch } from 'vue'
import type { EChartsOption } from 'echarts'
import { useChart } from '@/composables/useChart'
import { useSettingsStore } from '@/stores/settings'

interface TrendRow {
  /** 接口回来的是字符串；对比时补齐的占位行用的是数字 0（与 v2 一致，0 是 falsy，会被跳过） */
  statTime?: string | number
  pv?: number
  uv?: number
  visitCount?: number
  ipCount?: number
  bounceRate?: number
  [key: string]: unknown
}

/** 对比模式下接口返回的是数组，父组件又往数组上挂了一个 dateTime 属性 */
type TrendArray = TrendRow[] & { dateTime?: string }

const settingsStore = useSettingsStore()

// 两张图：indicator（多选折线）/ radioEchart（对比单选折线），模板上用 v-if 互斥
const { elRef: indicatorRef, init: initIndicator, setOption: setIndicatorOption } = useChart()
const { elRef: radioEchartRef, init: initRadio, setOption: setRadioOption } = useChart()

const firstDateRadio = ref<(number | undefined)[]>([])
const secondDateRadio = ref<(number | undefined)[]>([])
const dateTimeX = ref<(string | number)[]>([])
const headLegeRadio = ref('pv')
const pointValue = ref<string[]>(['pv', 'visitCount'])
const options = [
  { value: 'pv', label: '浏览量' },
  { value: 'uv', label: '访客数' },
  { value: 'visitCount', label: '访问次数' },
  { value: 'ipCount', label: 'IP数' },
  { value: 'bounceRate', label: '跳出率' },
]

const pv = ref<number[]>([])
const uv = ref<number[]>([])
const visitCount = ref<number[]>([])
const ipCount = ref<number[]>([])
const bounceRate = ref<number[]>([])
const time = ref<(string | number)[]>([])
const headLege = ref<(string | number)[]>(['pv', 'visitCount'])
const headLeges = ref<string[]>([])
const flowTrendList = ref<TrendRow[]>([])
const dateFlag = ref<number | null>(null) // 日期区别
const allRadioList = ref<TrendArray[]>([])
const dateName = ref('')
const dateNameTwo = ref('')
const timeFlag = ref('')
const pointered = ref('浏览量')

function radioTooltipFormatter(rawParams: unknown): string {
  const params = (Array.isArray(rawParams) ? rawParams : [rawParams]) as Array<{
    name?: string
    seriesName?: string
    data?: unknown
    newTime?: string
  }>
  const first = params[0]
  let res = ''
  if (timeFlag.value == 'hour') {
    res =
      "<div style='display:flex;justify-content: space-between;padding:7px'>" +
      "<div style=''>" +
      String(first?.name ?? '') +
      '</div>' +
      "<div style=''>" +
      pointered.value +
      '</div>' +
      '</div>'
    for (let i = 0; i < params.length; i++) {
      const item = params[i]
      res +=
        "<div style='display:flex;padding:5px 7px;'>" +
        String(item?.seriesName ?? '') +
        "<div style='min-width:100px;text-align:right;margin-right:20px'>" +
        String(item?.data ?? '') +
        '</div>' +
        '</div>'
    }
    return res
  } else {
    res =
      "<div style='display:flex;justify-content: space-between;padding:7px'>" +
      "<div style=''>" +
      '时间' +
      '</div>' +
      "<div style=''>" +
      pointered.value +
      '</div>' +
      '</div>'
    let result: (string | number)[] = [0, 0]
    if (first?.name) {
      result = first.name.split('与')
    }

    for (let i = 0; i < params.length; i++) {
      const item = params[i]
      if (!item) continue
      if (i == 0) {
        item.newTime = String(result[0] ?? '')
      } else if (i == 1) {
        item.newTime = String(result[1] ?? '')
      }
      res +=
        "<div style='padding:5px 0;'>" +
        "<div style='display:flex;justify-content: space-between;margin-left:8px;'>" +
        String(item.newTime ?? '') +
        "<div style='min-width:100px;text-align:right;margin-right:20px'>" +
        String(item.data ?? '') +
        '</div>' +
        '</div>'
      // 与 v2 一致（v2 此处逻辑存疑：这里少闭合一个 </div>，v2 写成了一句无效的表达式语句）
    }

    return res
  }
}

// 单选事件
function countLineEcharts() {
  const option: EChartsOption = {
    tooltip: {
      trigger: 'axis',
      showContent: true,
      formatter: radioTooltipFormatter,
    },
    // v2 是 legend: { x: 'center', y: 'top' }，echarts 5+ 换成 left/top
    legend: {
      left: 'center',
      top: 'top',
    },
    grid: {
      top: '15%',
      left: '2%',
      right: '2%',
      bottom: '2%',
      containLabel: true,
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
    xAxis: {
      type: 'category',
      data: dateTimeX.value,
      axisTick: {
        show: true,
      },

      axisLabel: {
        formatter: (value: string) => {
          if (value) {
            return value.length > 10 ? value.slice(0, 20) + '...' : value
          }
          return ''
        },
        show: true,
        interval: 1,
        // v2 写的是字符串 '45'，echarts 5+ 要求数字
        rotate: 45,
        // v2 是 axisLabel.textStyle.fontSize，echarts 5+ 已移除 textStyle
        fontSize: 12,
      },
    },
    yAxis: {
      axisTick: {
        show: false,
      },
      type: 'value',
    },
    series: [
      {
        data: firstDateRadio.value,
        type: 'line',
        name: dateName.value,
        color: '#2c7be5',
      },
      {
        data: secondDateRadio.value,
        type: 'line',
        name: dateNameTwo.value,
        color: '#FFDE84',
      },
    ],
  }
  // v2 是 echarts.init + clear + setOption，useChart 的 init 会先 dispose 再建，等价
  initRadio()
  setRadioOption(option, true)
}

function initChart() {
  const colors = settingsStore.cologStyle
  const option: EChartsOption = {
    backgroundColor: '#fff',
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        lineStyle: {
          color: '#C0CADB',
          width: 3,
        },
      },
    },
    legend: {
      left: 'center',
      top: 'top',
      data: headLeges.value,
      textStyle: {
        fontSize: 12,
        color: 'black',
      },
    },
    dataZoom: [
      {
        type: 'inside',
        startValue: 0,
        endValue: 30,
        minValueSpan: 10,
        zoomOnMouseWheel: false, // 关闭滚轮缩放
        moveOnMouseWheel: true, // 开启滚轮平移
        moveOnMouseMove: true, // 鼠标移动能触发数据窗口平移
      },
    ],
    grid: {
      top: '15%',
      left: '2%',
      right: '2%',
      bottom: '2%',
      containLabel: true,
    },
    xAxis: [
      {
        type: 'category',
        boundaryGap: false,
        data: time.value,
        nameTextStyle: {
          fontWeight: 600,
          fontSize: 18,
        },
        axisTick: {
          show: false,
        },
        axisLabel: {
          formatter: (value: string) => {
            if (value) {
              return value.length > 10 ? value.slice(0, 20) + '...' : value
            }
            return ''
          },
          show: true,
          interval: 1,
          rotate: 45,
          fontSize: 12,
        },
      },
    ],
    yAxis: [
      {
        type: 'value',
        nameTextStyle: {
          fontWeight: 600,
          fontSize: 18,
        },
        axisTick: {
          show: false,
        },
      },
    ],
    series: [
      {
        name: '浏览量',
        type: 'line',
        // v2 是 itemStyle.normal.color，echarts 5+ 去掉了 normal 这层
        itemStyle: { color: colors.$pv },
        lineStyle: { width: 3 },
        data: pv.value,
      },
      {
        name: '访客数',
        type: 'line',
        itemStyle: { color: colors.$uv },
        lineStyle: { width: 3 },
        data: uv.value,
      },
      {
        name: '访问次数',
        type: 'line',
        itemStyle: { color: colors.$visitCount },
        lineStyle: { width: 3 },
        data: visitCount.value,
      },
      {
        name: 'IP数',
        type: 'line',
        itemStyle: { color: colors.$ipCount },
        lineStyle: { width: 3 },
        data: ipCount.value,
      },
      {
        name: '跳出率',
        type: 'line',
        itemStyle: { color: colors.$bounceRate },
        lineStyle: { width: 3 },
        data: bounceRate.value,
      },
    ],
  }
  initIndicator()
  setIndicatorOption(option, true)
}

function checkSearchValue(val: (string | number)[]) {
  const timeArr: (string | number)[] = []
  const pvArr: number[] = []
  const uvArr: number[] = []
  const visitCountArr: number[] = []
  const ipCountArr: number[] = []
  const bounceRateArr: number[] = []
  flowTrendList.value.forEach((item) => {
    if (item.statTime) {
      // item.statTime = item.statTime.replace(/2023-/g, "");
      // v2 直接取 .length（数字时是 undefined，比较为 false），这里显式判断字符串，行为一致
      if (typeof item.statTime === 'string' && item.statTime.length <= 2) {
        item.statTime = item.statTime + '时'
      }
      timeArr.push(item.statTime)
    } else {
      timeArr.push(0)
    }
  })
  if (val.includes('pv')) {
    flowTrendList.value.forEach((item) => {
      if (item.pv) {
        pvArr.push(item.pv)
      } else {
        pvArr.push(0)
      }
    })
  }
  if (val.includes('uv')) {
    flowTrendList.value.forEach((item) => {
      if (item.uv) {
        uvArr.push(item.uv)
      } else {
        uvArr.push(0)
      }
    })
  }
  if (val.includes('ipCount')) {
    flowTrendList.value.forEach((item) => {
      if (item.ipCount) {
        ipCountArr.push(item.ipCount)
      } else {
        ipCountArr.push(0)
      }
    })
  }
  if (val.includes('visitCount')) {
    flowTrendList.value.forEach((item) => {
      if (item.visitCount) {
        visitCountArr.push(item.visitCount)
      } else {
        visitCountArr.push(0)
      }
    })
  }

  if (val.includes('bounceRate')) {
    flowTrendList.value.forEach((item) => {
      if (item.bounceRate) {
        bounceRateArr.push(item.bounceRate)
      } else {
        bounceRateArr.push(0)
      }
    })
  }
  time.value = timeArr
  pv.value = pvArr
  uv.value = uvArr
  visitCount.value = visitCountArr
  ipCount.value = ipCountArr
  bounceRate.value = bounceRateArr
  void nextTick(() => initChart())
}

function changeChartValue(val: (string | number)[]) {
  const headName: string[] = []
  const headId: string[] = []
  for (let i = 0; i <= val.length; i++) {
    options.find((item) => {
      if (item.value == val[i]) {
        headName.push(item.label)
        headId.push(item.value)
      }
      return false
    })
  }
  headLeges.value = headName
  pointValue.value = headId
  checkSearchValue(headId)
}

// echarts radio 单选
function changeChartRadio(val: string) {
  options.forEach((item) => {
    if (headLegeRadio.value == item.value) {
      pointered.value = item.label
    }
  })
  dateName.value = (allRadioList.value[0]?.dateTime ?? '') + ' '
  dateNameTwo.value = (allRadioList.value[1]?.dateTime ?? '') + ' '
  if (dateFlag.value) {
    const first: (number | undefined)[] = []
    const second: (number | undefined)[] = []
    allRadioList.value[0]?.forEach((item) => {
      first.push(item[val] as number | undefined)
    })
    allRadioList.value[1]?.forEach((item) => {
      second.push(item[val] as number | undefined)
    })
    firstDateRadio.value = first
    secondDateRadio.value = second
    countLineEcharts()
  }
}

// 传递数据内容
function apiDetailList(val: unknown, flag: number | null, commonParams: Record<string, unknown>) {
  timeFlag.value = String(commonParams.timeType ?? '')
  allRadioList.value = val as TrendArray[]
  dateFlag.value = flag
  if (flag) {
    const list = val as TrendArray[]
    options.forEach((item) => {
      if (headLegeRadio.value == item.value) {
        pointered.value = item.label
      }
    })
    const listZero = list[0]
    const listOne = list[1]
    if (!listZero || !listOne) return
    dateName.value = (listZero.dateTime ?? '') + ' '
    dateNameTwo.value = (listOne.dateTime ?? '') + ' '
    const first: (number | undefined)[] = []
    const second: (number | undefined)[] = []
    dateTimeX.value = []
    if (listZero.length > listOne.length) {
      listOne.push({ statTime: 0, pv: 0, uv: 0, visitCount: 0, ipCount: 0, bounceRate: 0 })
    } else if (listZero.length < listOne.length) {
      listZero.push({ statTime: 0, pv: 0, uv: 0, visitCount: 0, ipCount: 0, bounceRate: 0 })
    }
    listZero.forEach((item) => {
      if (item[headLegeRadio.value]) {
        first.push(item[headLegeRadio.value] as number)
      } else {
        first.push(0)
      }
    })
    listOne.forEach((item) => {
      if (item[headLegeRadio.value]) {
        second.push(item[headLegeRadio.value] as number)
      } else {
        second.push(0)
      }
    })
    firstDateRadio.value = first
    secondDateRadio.value = second

    for (let i = 0; i < listOne.length; i++) {
      for (let j = 0; j < listZero.length; j++) {
        if (i == j) {
          const rowZero = listZero[i]
          const rowOne = listOne[i]
          if (rowZero && rowZero.statTime) {
            if (commonParams.timeType != 'hour') {
              dateTimeX.value.push(`${rowZero.statTime}与${String(rowOne?.statTime ?? '')}`)
            } else {
              dateTimeX.value.push(rowZero.statTime)
            }
          }
        }
      }
    }
    void nextTick(() => countLineEcharts())
  } else {
    // 与 v2 一致（v2 此处逻辑存疑：原来按「今天 + 按时」做过一次截断，代码已被注释掉，
    // if / else 两个分支最后都是 this.flowTrendList = val，等价于直接赋值）
    flowTrendList.value = (val as TrendRow[]) || []
  }
}

watch(flowTrendList, (val) => {
  if (val && val.length > 0) {
    checkSearchValue(pointValue.value)
  } else {
    checkSearchValue([])
  }
})

onMounted(() => {
  const headName: string[] = []
  for (let i = 0; i <= pointValue.value.length; i++) {
    options.find((item) => {
      if (item.value == pointValue.value[i]) {
        headName.push(item.label)
      }
      return false
    })
  }
  headLeges.value = headName
  initChart()
})

defineExpose({ apiDetailList })
</script>

<template>
  <div>
    <div class="chartsIcon public-echart-block">
      <div class="chartLeft public-hoverItem">
        <div class="trendHead">
          <div class="public-firstHead" style="padding: 0 13px 0 0">趋势图</div>
          <div v-show="!dateFlag" class="block">
            <el-select
              v-model="headLege"
              class="custom_select"
              multiple
              placeholder="请选择"
              style="min-width: 280px"
              @change="changeChartValue"
            >
              <el-option
                v-for="item in options"
                :key="item.value"
                :label="item.label"
                :value="item.value"
                style="min-width: 280px !important"
              >
                <div style="display: flex; align-items: center">
                  <span class="checkbox__inner">
                    <div class="inner-box"></div>
                  </span>
                  <span style="">{{ item.label }}</span>
                </div>
              </el-option>
            </el-select>
          </div>
          <!-- 单选 -->
          <div v-show="dateFlag" class="block">
            <el-select
              v-model="headLegeRadio"
              class="custom_select"
              placeholder="请选择"
              style="min-width: 280px"
              @change="changeChartRadio"
            >
              <el-option
                v-for="item in options"
                :key="item.value"
                :label="item.label"
                :value="item.value"
                style="min-width: 280px !important"
              >
                {{ item.label }}
              </el-option>
            </el-select>
          </div>
        </div>
        <div v-if="!dateFlag" ref="indicatorRef" style="height: 400px; width: 97%"></div>
        <div v-if="dateFlag" ref="radioEchartRef" style="height: 400px; width: 97%"></div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
// v2 这里是 @import custom-select.scss（v3 已全局引入）+ ::v-deep { @import el-checkbox.scss }
// el-checkbox.scss 在 v3 里每条规则已写成 :deep(...)，只能在 scoped 块顶部 @use
@use '@/styles/components/el-checkbox.scss';

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
  // margin:20px 0;
  // width: calc(100% -20px);
  // min-height: 300px;
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
