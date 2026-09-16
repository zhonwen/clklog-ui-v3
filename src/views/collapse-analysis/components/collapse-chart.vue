<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { EChartsOption } from 'echarts'
import { copyObj } from '@/utils/copy'
import { trendSummaryApi } from '@/api/trackingapi/collapse'
import { useSettingsStore } from '@/stores/settings'
import { useChart } from '@/composables/useChart'
import { useLatestOnly } from '@/composables/useLatestOnly'

/** 崩溃率趋势图（v2 src/views/collapse-analysis/components/collapse-chart.vue） */

interface TrendItem {
  statTime?: string
  visitCount?: number
  crashedCount?: number
  pvRate?: number
  crashedUv?: number
  uv?: number
  uvRate?: number
}

type ChartType = 'all' | 'IOS' | 'Android'

interface SeriesItem {
  data: Array<number | undefined>
  type: 'line'
  name: string
  smooth: boolean
  color: string
}

/**
 * v2 模板/formatter 里用的是 `percenTable` 过滤器（src/filters/index.js）：
 * 1 -> '100%'，其余真值 -> 两位小数百分比，falsy -> 数字 0（注意不是 '--'）。
 * v3 的 utils/percent 里暂时没有同名函数，这里就地实现，语义与 v2 完全一致。
 */
function percenTable(s: unknown): string | number {
  if (s == 1) return '100%'
  if (s) {
    return (Number(s) * 100).toFixed(2) + '%'
  }
  return 0
}

const settingsStore = useSettingsStore()
const cologStyle = settingsStore.cologStyle

const { elRef: countLineRef, init: initCountLine, setOption: setCountLineOption } = useChart()
const { elRef: iosRef, init: initIos, setOption: setIosOption } = useChart()
const { elRef: andiorRef, init: initAndior, setOption: setAndiorOption } = useChart()

// 三个图表各自一套取数令牌
const { next: nextAll, isLatest: isLatestAll } = useLatestOnly()
const { next: nextIos, isLatest: isLatestIos } = useLatestOnly()
const { next: nextAndroid, isLatest: isLatestAndroid } = useLatestOnly()

const headLege = ref<string[]>(['崩溃触发次数', '崩溃率', '崩溃用户数'])
const headLegeAndior = ref<string[]>(['崩溃触发次数', '崩溃率', '崩溃用户数'])
const headLegeIos = ref<string[]>(['崩溃触发次数', '崩溃率', '崩溃用户数'])
const options = [
  { value: '访问次数', label: '访问次数', disabled: false },
  { value: '崩溃触发次数', label: '崩溃触发次数', disabled: false },
  { value: '崩溃率', label: '崩溃率', disabled: false },
  { value: '崩溃用户数', label: '崩溃用户数', disabled: false },
  { value: '用户数', label: '用户数', disabled: false },
  { value: '崩溃用户占比', label: '崩溃用户占比', disabled: false },
]
const commonParams = ref<Record<string, unknown>>({})
const channelAllList = ref<TrendItem[]>([])
const channelIosList = ref<TrendItem[]>([])
const channelAndroidList = ref<TrendItem[]>([])
const loadingRefresh = ref(false)
// 与 v2 一致：三张图共用同一份 statTime，每次 filterEvent 都会先清空再按当前通道重填
const statTime = ref<string[]>([])

/** tooltip 三张图完全一样：崩溃率 / 崩溃用户占比 走百分比，其余原样 */
function tooltipFormatter(
  params: { name: string; marker: string; seriesName: string; value: unknown }[],
) {
  let html = (params[0]?.name ?? '') + '<br>'
  let number: unknown = 0
  for (let i = 0; i < params.length; i++) {
    const p = params[i]
    if (!p) continue
    number = p.value
    if (p.seriesName == '崩溃率' || p.seriesName == '崩溃用户占比') {
      number = percenTable(p.value)
    }
    // 与 v2 一致（v2 此处逻辑存疑：结尾的 "</div>" 被写成了一条独立的 `+"</div>"` 表达式语句，
    // 并没有拼进 html，所以每行只有开标签没有闭标签）
    html += '<div>' + p.marker + p.seriesName + '：' + String(number)
  }
  return html + '<br>'
}

function buildOption(legendData: string[], echartList: SeriesItem[]) {
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        lineStyle: {
          color: '#C0CADB',
          width: 2,
        },
      },
      formatter: tooltipFormatter,
    },
    legend: {
      // v2 用的是 echarts 4 的 legend.x / legend.y，echarts 6 对应 left / top
      left: 'center',
      top: 'top',
      data: legendData,
    },
    grid: {
      left: '10%',
      right: '2%',
      top: '10%',
      bottom: '10%',
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
      data: statTime.value,
      axisTick: {
        show: false,
      },
      axisLabel: {
        interval: 2,
        // v2 写的是字符串 "45"，echarts 6 的 rotate 需要数字
        rotate: 45,
      },
    },
    yAxis: {
      axisTick: {
        show: false,
      },
      type: 'value',
    },
    series: echartList,
  }
}

function filterEvent(type: ChartType) {
  statTime.value = []
  const visitCount: Array<number | undefined> = []
  const crashedCount: Array<number | undefined> = []
  const pvRate: Array<number | undefined> = []
  const crashedUv: Array<number | undefined> = []
  const uv: Array<number | undefined> = []
  const uvRate: Array<number | undefined> = []
  let newHeadLege: string[] = []
  let dynamicTrendList: TrendItem[] = []

  switch (type) {
    case 'all':
      newHeadLege = headLege.value
      dynamicTrendList = channelAllList.value
      break
    case 'IOS':
      newHeadLege = headLegeIos.value
      dynamicTrendList = channelIosList.value
      break
    case 'Android':
      newHeadLege = headLegeAndior.value
      dynamicTrendList = channelAndroidList.value
      break
  }
  for (let i = 0; i < dynamicTrendList.length; i++) {
    const item = dynamicTrendList[i]
    if (!item) continue
    for (let j = 0; j < newHeadLege.length; j++) {
      const lege = newHeadLege[j]
      if (lege == '崩溃触发次数') {
        crashedCount.push(item.crashedCount)
      }
      if (lege == '访问次数') {
        visitCount.push(item.visitCount)
      }
      if (lege == '崩溃率') {
        pvRate.push(item.pvRate)
      }
      if (lege == '崩溃用户数') {
        crashedUv.push(item.crashedUv)
      }
      if (lege == '用户数') {
        uv.push(item.uv)
      }
      if (lege == '崩溃用户占比') {
        uvRate.push(item.uvRate)
      }
    }
    statTime.value.push(item.statTime ?? '')
  }

  // 与 v2 一致：六条线永远都建出来，靠 legend.data 决定显示哪几条；
  // 未被勾选的那几条 data 是空数组
  const echartList: SeriesItem[] = [
    {
      data: visitCount,
      type: 'line',
      name: '访问次数',
      smooth: true,
      color: cologStyle.$pv,
    },
    {
      data: crashedCount,
      type: 'line',
      smooth: true,
      name: '崩溃触发次数',
      color: cologStyle.$uv,
    },
    {
      data: pvRate,
      type: 'line',
      smooth: true,
      name: '崩溃率',
      color: cologStyle.$visitCount,
    },
    {
      data: crashedUv,
      type: 'line',
      smooth: true,
      name: '崩溃用户数',
      color: cologStyle.$ipCount,
    },
    {
      data: uv,
      type: 'line',
      smooth: true,
      name: '用户数',
      color: cologStyle.$bounceRate,
    },
    {
      data: uvRate,
      type: 'line',
      smooth: true,
      name: '崩溃用户占比',
      color: 'pink',
    },
  ]

  switch (type) {
    case 'all':
      setCountLineOption(
        buildOption(headLege.value, echartList) as unknown as EChartsOption,
        true,
      )
      break
    case 'IOS':
      setIosOption(buildOption(headLegeIos.value, echartList) as unknown as EChartsOption, true)
      break
    case 'Android':
      setAndiorOption(
        buildOption(headLegeAndior.value, echartList) as unknown as EChartsOption,
        true,
      )
      break
  }
}

function silientTableEvent(type?: string) {
  loadingRefresh.value = true
  const params = copyObj(commonParams.value)
  params.channel = type ? [type] : []
  let token: number
  if (type == '苹果') {
    token = nextIos()
  } else if (type == '安卓') {
    token = nextAndroid()
  } else {
    token = nextAll()
  }
  const stillLatest = () => {
    if (type == '苹果') return isLatestIos(token)
    if (type == '安卓') return isLatestAndroid(token)
    return isLatestAll(token)
  }
  trendSummaryApi(params)
    .then((res) => {
      if (!stillLatest()) return
      if (res?.code == 200) {
        loadingRefresh.value = false
        if (type == '苹果') {
          channelIosList.value = (res.data ?? []) as TrendItem[]
          filterEvent('IOS')
        } else if (type == '安卓') {
          channelAndroidList.value = (res.data ?? []) as TrendItem[]
          filterEvent('Android')
        } else {
          channelAllList.value = (res.data ?? []) as TrendItem[]
          filterEvent('all')
        }
      }
    })
    .catch(() => {
      if (!stillLatest()) return
      loadingRefresh.value = false
    })
}

function paramsEvent(params: Record<string, unknown>) {
  commonParams.value = copyObj(params)
  silientTableEvent()
  silientTableEvent('安卓')
  silientTableEvent('苹果')
}

function handleCheckPointer(type: ChartType) {
  filterEvent(type)
}

onMounted(() => {
  initCountLine()
  initIos()
  initAndior()
})

// v2 里父组件用 this.$refs.collapseChart.paramsEvent(...) 调用，<script setup> 默认对外封闭
defineExpose({ paramsEvent })
</script>

<template>
  <div class="chart_container">
    <div class="singItem">
      <div v-loading="loadingRefresh" class="block-main public-hoverItem collapseLeft">
        <div class="block-head">
          <div class="block-title">崩溃率</div>
          <el-select
            v-model="headLege"
            class="custom_select"
            multiple
            placeholder="请选择"
            style="margin-left: 13px; min-width: 280px"
            @change="handleCheckPointer('all')"
          >
            <el-option
              v-for="item in options"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            >
              <div style="display: flex; align-items: center">
                <span class="checkbox__inner"><div class="inner-box"></div></span>
                <span>{{ item.label }}</span>
              </div>
            </el-option>
          </el-select>
        </div>
        <!-- 图表 -->
        <div ref="countLineRef" style="width: 90%; height: 400px"></div>
      </div>
    </div>

    <div class="singItem" style="margin-top: 20px">
      <div v-loading="loadingRefresh" class="block-main public-hoverItem applicationLeft">
        <div class="block-head">
          <div class="block-title">IOS|应用版本崩溃率</div>
          <el-select
            v-model="headLegeIos"
            class="custom_select"
            multiple
            placeholder="请选择"
            style="margin-left: 13px; min-width: 280px"
            @change="handleCheckPointer('IOS')"
          >
            <el-option
              v-for="item in options"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            >
              <div style="display: flex; align-items: center">
                <span class="checkbox__inner"><div class="inner-box"></div></span>
                <span>{{ item.label }}</span>
              </div>
            </el-option>
          </el-select>
        </div>
        <div style="display: flex; align-items: center"></div>
        <!-- 图表 -->
        <div ref="iosRef" style="width: 90%; height: 400px; margin-top: 10px"></div>
      </div>
      <div v-loading="loadingRefresh" class="block-main public-hoverItem applicationRight">
        <div class="block-head">
          <div class="block-title">Andriod|应用版本崩溃率</div>
          <el-select
            v-model="headLegeAndior"
            class="custom_select"
            multiple
            placeholder="请选择"
            style="margin-left: 13px; min-width: 280px"
            @change="handleCheckPointer('Android')"
          >
            <el-option
              v-for="item in options"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            >
              <div style="display: flex; align-items: center">
                <span class="checkbox__inner"><div class="inner-box"></div></span>
                <span>{{ item.label }}</span>
              </div>
            </el-option>
          </el-select>
        </div>

        <!-- 图表 -->
        <div ref="andiorRef" style="width: 90%; height: 400px; margin-top: 10px"></div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
// v2 这里 @import 了 custom-select.scss，v3 已在 src/styles/index.scss 全局引入，不再重复引入。
:deep() {
  // v2 是 .el-radio-button--mini，element-plus 的 mini 档已并入 small
  .el-radio-button--small .el-radio-button__inner {
    height: 30px;
  }
}

.chart_container {
  .singItem {
    display: flex;
    width: 100%;
    box-sizing: border-box;
    justify-content: space-between;

    .collapseLeft {
      width: 100%;
      min-height: 400px;
    }

    .applicationRight {
      width: calc(50% - 10px);
      min-height: 500px;
    }

    .applicationLeft {
      width: calc(50% - 10px);
      min-height: 500px;
    }
  }
}
</style>
