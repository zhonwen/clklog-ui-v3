<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import type { EChartsOption } from 'echarts'
import { formatTime } from '@/utils/format'
import { useChart } from '@/composables/useChart'
import { useLatestOnly } from '@/composables/useLatestOnly'
import { getUserEventReportsApi } from '@/api/trackingapi/userreview'
import { getPageListEventApi } from '@/api/sysmanage/manageEvent'
import type { EventReportRow, UserBaseInfo } from '../types'

const props = withDefaults(
  defineProps<{
    userBaseInfo?: UserBaseInfo
    userInfoLoading?: boolean
    projectName?: string | null
    userId?: string | null
  }>(),
  {
    userBaseInfo: () => ({}),
    userInfoLoading: false,
    projectName: null,
    userId: null,
  },
)

const route = useRoute()

const { elRef, chart, init, setOption } = useChart()
const { next, isLatest } = useLatestOnly()

const dateViewLoad = ref(false)
const eventTopData = ref<EventReportRow[]>([])
const eventCounts = ref<Record<string, string | number>>({
  $AppStart: '--',
  $MPLaunch: '--',
  $SignUp: '--', // 登录次数暂时模拟取该字段
  $AppEnd: '--',
})

const queryParams = {
  projectName: (typeof route.query.projectName === 'string' && route.query.projectName) || null,
  userId: props.userId || route.query.userId,
}

function formatWithSuffix(val: number | string | null | undefined, suffix: string) {
  if (val === 0) return `0${suffix}`
  if (val === null || val === undefined || val === '') return '--'
  return `${val}${suffix}`
}

function updateEventCountsFromData(list: EventReportRow[]) {
  const keys = ['$AppStart', '$AppEnd', '$MPLaunch', '$SignUp']
  // v2 里这个局部变量也叫 next，这里改名避让 useLatestOnly 的 next
  const nextCounts: Record<string, string | number> = {
    $AppStart: '--',
    $AppEnd: '--',
    $MPLaunch: '--',
    $SignUp: '--',
  }
  ;(list || []).forEach((i) => {
    const name = i && i.eventName
    const count = i && i.count
    if (name && keys.indexOf(name) !== -1 && count !== undefined) {
      nextCounts[name] = count
    }
  })
  eventCounts.value = nextCounts
}

function formatTimestamp(timestamp: string | number | null | undefined) {
  if (!timestamp) return null
  const pad = (n: number) => String(n).padStart(2, '0')
  let ts: string | number = timestamp
  if (typeof ts === 'string') {
    const s = ts.trim()
    if (/^\d+$/.test(s)) {
      ts = Number(s)
    } else {
      const d = new Date(s)
      if (!isNaN(d.getTime())) {
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
          d.getHours(),
        )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
      }
      return ''
    }
  }
  if (typeof ts === 'number' && ts < 1e12) {
    ts = ts * 1000
  }
  const date = new Date(ts)
  if (isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function formatTimeData(val: number | string | null | undefined) {
  if (val === 0) return formatTime(0)
  if (val === null || val === undefined || val === '') return '--'
  const n = Number(val)
  if (isNaN(n)) return '--'
  return formatTime(Math.floor(n))
}

function updateEventTopChart() {
  const inst = chart.value
  if (!inst) return
  const labels = eventTopData.value.map((i) => i.eventDisplay || i.eventName || '')
  const values = eventTopData.value.map((i) => i.count ?? 0)
  const visibleCount = 10
  const needSlider = labels.length > visibleCount
  const sliderConf = {
    type: 'slider',
    yAxisIndex: 0,
    startValue: 0,
    endValue: Math.min(labels.length - 1, visibleCount - 1),
    width: 8,
    right: 4,
  }
  const insideConf = {
    type: 'inside',
    yAxisIndex: 0,
    startValue: 0,
    endValue: 10,
    zoomOnMouseWheel: false,
    moveOnMouseWheel: true,
    moveOnMouseMove: true,
    preventDefaultMouseMove: true,
  }

  // 获取图表总宽度
  const chartWidth = inst.getWidth()
  // 估算 Y 轴标签最大宽度 (假设每个字符平均 12px，稍微留余量)
  // ECharts 的 containLabel: true 会自动计算，但我们需要预估 grid 宽度
  // Grid 左右预留 roughly: left 10% + right 6%
  // 但如果标签很长，left 会变大。我们取两者的较大值来估算绘图区域。
  const maxLabelLen = Math.max(
    ...labels.map((l) => {
      // 简单的字符宽度估算：汉字/大写字母 12px，其他 8px
      let width = 0
      for (const char of l) {
        width += char.charCodeAt(0) > 255 ? 12 : 8
      }
      return width
    }),
    0,
  )

  // 估算 Grid 左侧留白：至少 10%，或者是 标签宽度 + 10px padding
  const estimatedGridLeft = Math.max(chartWidth * 0.1, maxLabelLen + 15)
  const estimatedGridRight = chartWidth * 0.06
  const estimatedGridWidth = chartWidth - estimatedGridLeft - estimatedGridRight

  // 计算最大值，用于判断柱子是否太短
  const maxValue = Math.max(...values) || 1

  const seriesData = values.map((val) => {
    // 估算当前数值文本的宽度 (数字按 8px 一个字符算，加 5px padding)
    const textWidth = String(val).length * 8 + 5
    // 估算当前数值对应的柱子像素宽度
    const barWidth = (val / maxValue) * estimatedGridWidth

    // 如果柱子宽度小于文本宽度，则放外面
    const isSmall = barWidth < textWidth

    return {
      value: val,
      label: {
        position: isSmall ? 'right' : 'insideRight',
        color: isSmall ? '#4d4d4d' : '#fff',
      },
    }
  })

  const option = {
    legend: {
      top: 5,
      icon: 'rect',
      itemWidth: 14,
      itemHeight: 5,
      itemGap: 13,
      right: '4%',
      textStyle: {
        fontSize: 12,
        color: 'black',
      },
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: { name: string; value: number }[]) => {
        const first = params[0]
        if (!first) return ''
        const name = first.name
        const count = first.value
        return `${name}<br>次数: ${count}`
      },
    },
    dataZoom: needSlider ? [sliderConf, insideConf] : [],
    grid: {
      left: '10%',
      right: '6%',
      bottom: '6%',
      top: '12%',
      containLabel: true,
    },
    xAxis: {
      type: 'value',
      axisLabel: { interval: 1 },
      nameTextStyle: {
        fontWeight: 400,
        fontSize: 12,
      },
      axisTick: {
        show: true,
      },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#edf2f9' } },
    },
    yAxis: {
      barCategoryGap: '50%',
      barGap: '30%',
      axisLabel: { fontSize: 12 },
      type: 'category',
      inverse: true,
      axisTick: { show: false },
      axisLine: { show: false },
      data: labels,
    },
    series: [
      {
        name: '次数',
        type: 'bar',
        data: seriesData,
        barWidth: 15,
        itemStyle: { color: '#2c7be5' },
        // label: { show: true, position: "right", color: "#4d4d4d" },
        label: { show: true },
      },
    ],
  }
  setOption(option as unknown as EChartsOption)
}

function initEventTopChart() {
  const routeQuery = route.query
  if (!routeQuery.projectName || !routeQuery.userId) return
  dateViewLoad.value = true
  const params = {
    projectName: routeQuery.projectName,
    pageNum: 1,
    pageSize: 1000,
    isPreset: true,
  }
  const token = next()
  // 需要过滤掉元事件的预置属性；
  getPageListEventApi(params).then((presetRes) => {
    if (!isLatest(token)) return
    const presetData = presetRes?.data as { rows?: { name?: string }[] } | undefined
    const presetNames = new Set((presetData?.rows || []).map((item) => item.name))
    // 用户细查Top10;
    getUserEventReportsApi(queryParams)
      .then((res) => {
        if (!isLatest(token)) return
        if (res?.code === 200) {
          dateViewLoad.value = false
          const data = (res.data as EventReportRow[]) || []
          updateEventCountsFromData(data)
          const list = data.filter((item) => !presetNames.has(item.eventName))
          if (list && list.length > 0) {
            eventTopData.value = list.slice(0, 10)
          } else {
            eventTopData.value = data.slice(0, 10)
          }

          nextTick(() => {
            if (eventTopData.value && eventTopData.value.length > 0) {
              if (!elRef.value) return
              if (!chart.value) {
                init()
              }
              updateEventTopChart()
            }
          })
        }
      })
      .finally(() => {
        if (!isLatest(token)) return
        dateViewLoad.value = false
      })
  })
}

onMounted(() => {
  nextTick(() => initEventTopChart())
})
</script>

<template>
  <el-row class="overview-row">
    <div class="overview-item commonBackgrond public-hoverItem">
      <div class="block-gap-bottom common-title">总计</div>
      <div v-loading="userInfoLoading" class="overview-metrics">
        <div class="metric-item">
          <div class="metric-label">访问总次数</div>
          <div class="metric-value">
            {{ formatWithSuffix(props.userBaseInfo.pv, '次') }}
          </div>
        </div>
        <div class="metric-item">
          <div class="metric-label">平均访问页数</div>
          <div class="metric-value">
            {{ formatWithSuffix(props.userBaseInfo.avgPv, '页') }}
          </div>
        </div>
        <div class="metric-item">
          <div class="metric-label">首次访问时间</div>
          <div class="metric-value">
            {{ formatTimestamp(props.userBaseInfo.firstTime) }}
          </div>
        </div>
        <div class="metric-item">
          <div class="metric-label">访问总时长</div>
          <div class="metric-value">
            {{ formatTimeData(props.userBaseInfo.visitTime) }}
          </div>
        </div>
        <div class="metric-item">
          <div class="metric-label">平均访问时长</div>
          <div class="metric-value">
            {{ formatTimeData(props.userBaseInfo.avgVisitTime) || '--' }}
          </div>
        </div>
        <div class="metric-item">
          <div class="metric-label">最后访问时间</div>
          <div class="metric-value">
            {{ formatTimestamp(props.userBaseInfo.latestTime) || '--' }}
          </div>
        </div>
      </div>
      <div v-loading="userInfoLoading" class="device block-gap-top">
        <span class="device-label common-title">访问设备</span>
        <div class="describe setFont" :style="props.userBaseInfo.manufacturer ? '' : 'margin-left: 8px'">
          {{ props.userBaseInfo.manufacturer || '--' }}
        </div>
      </div>
      <div v-loading="userInfoLoading" class="whereFrom block-gap-top">
        <span class="device-label common-title">访问位置</span>
        <div
          class="describe setFont"
          style="display: flex; flex-direction: column; line-height: 20px; margin-top: 5px"
        >
          <div
            v-if="
              props.userBaseInfo.areaList &&
              props.userBaseInfo.areaList.length > 0 &&
              (props.userBaseInfo.areaList[0]?.province ||
                props.userBaseInfo.areaList[0]?.city ||
                props.userBaseInfo.areaList[0]?.country)
            "
            style="display: flex; flex-wrap: wrap"
          >
            <div
              v-for="(item, index) in props.userBaseInfo.areaList"
              :key="index"
              style="display: flex; margin-right: 10px; margin-top: 5px; box-sizing: border-box"
            >
              {{ item.country == '中国' ? '' : (item.country || '') + (item.province || '') }}
              {{ item.province }}
              <div class="number" style="white-space: nowrap">
                {{ item.city == item.province ? '' : item.city }}
              </div>
            </div>
          </div>
          <div
            v-else
            style="display: flex; margin-left: 10px; margin-top: 5px; box-sizing: border-box"
          >
            {{ '--' }}
          </div>
        </div>
      </div>
    </div>
    <div
      v-loading="dateViewLoad"
      class="overview-item commonBackgrond public-hoverItem"
      style="margin-left: 20px"
    >
      <div class="block-gap-bottom common-title">行为概览</div>
      <div class="event_label">
        <div class="event_item">
          <span>App启动次数</span>
          <div class="event_value">{{ eventCounts['$AppStart'] }}</div>
        </div>
        <div class="event_item">
          <span>小程序启动次数</span>
          <div class="event_value">{{ eventCounts['$MPLaunch'] }}</div>
        </div>
      </div>
      <div class="event_label">
        <div class="event_item">
          <span>登录次数</span>
          <div class="event_value">{{ eventCounts['$SignUp'] }}</div>
        </div>
        <div class="event_item">
          <span>App 退出</span>
          <div class="event_value">{{ eventCounts['$AppEnd'] }}</div>
        </div>
      </div>
      <div class="total-head setFont block-gap-top">
        <div class="common-title">自定义事件Top10</div>
        <div v-if="eventTopData && eventTopData.length > 0" ref="elRef" class="event-top-chart"></div>
        <div v-else class="empty-tips">暂无数据</div>
      </div>
    </div>
  </el-row>
</template>

<style scoped lang="scss">
.empty-tips {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: $font-size-medium;
  color: $black;
  min-height: 100px;
}

.whereFrom {
  box-sizing: border-box;
  min-height: 50px;
  display: flex;
  flex-direction: column;
}

.describe {
  box-sizing: border-box;
  display: flex;
  line-height: 27px;
  color: #5a607f;

  .number {
    font-size: 18px;
    color: #2c7be5;
    font-weight: 500;
  }
}

.block-gap-top {
  margin-top: 20px;
}

.block-gap-bottom {
  margin-bottom: 10px;
}

.block-gap-bold {
  text-align: left !important;
  font-size: $font-size-small;
  color: $blue !important;
}

.block-gap-left {
  text-align: left !important;
}

.commonBackgrond {
  background-color: #fff;
}

.common-title {
  font-size: $font-size-medium;
  font-weight: 600;
  line-height: 26px;
  color: $black !important;
}

.overview-row {
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  box-sizing: border-box;
  font-size: 12px;
  font-weight: 500;
  line-height: 15px;
  margin-top: 20px;

  .event_label {
    display: flex;
    font-size: 14px;
    font-weight: 500;
    line-height: 20px;
    color: #3d3d3d;

    .event_item {
      width: 100%;
      text-align: center;

      span {
        color: $black;
        font-size: $font-size-medium;
      }

      .event_value {
        padding-top: 5px;
        color: $blue;
        font-size: $font-size-medium;
        text-align: center;
      }
    }
  }

  .overview-item {
    box-sizing: border-box;
    width: calc(50% - 10px);
    min-height: 140px;
    border-radius: 6px;
    padding: 10px 15px 15px 15px;

    .overview-metrics {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px 20px;
      padding: 6px 0 2px;

      .metric-item {
        text-align: left;
        overflow: hidden;

        .metric-label {
          font-size: $font-size-small;
          line-height: 18px;
          color: #3d3d3d;
          font-size: 14px;
        }

        .metric-value {
          margin-top: 4px;
          font-size: $font-size-medium;
          line-height: 20px;
          color: $blue;
          word-break: break-word;
        }
      }
    }

    .total-head {
      line-height: 20px;
      color: $light-black;
      font-size: $font-size-medium;
    }
  }
}

.event-top-chart {
  width: 100%;
  //height: 330px;
  height: calc(100vh - 350px);
  max-height: 500px;
}
</style>
