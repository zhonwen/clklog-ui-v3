<script setup lang="ts">
/**
 * 新老访客对比 + 访客趋势图（v2 views/visitor-analysis/chart-component/newOld-visitor-analysisTable.vue）。
 * 父组件 newOld-visitor-analysis.vue 通过 ref 调 getVisitorDetail(commonParams, dateFlag)。
 */
import { onMounted, ref } from 'vue'
import type { EChartsOption } from 'echarts'
import { copyObj } from '@/utils/copy'
import { formatTime } from '@/utils/format'
// v2 模板里的 `| percentage` 用的是 filters 版，与 @/utils/percent 的实现一致，直接复用
import { percentage } from '@/utils/percent'
import { getVisitorDetailApi } from '@/api/trackingapi/visitor'
import { getFlowDetailApi } from '@/api/trackingapi/flow'
import { useChart } from '@/composables/useChart'
import { useLatestOnly } from '@/composables/useLatestOnly'

interface VisitorItem {
  visitorType?: string
  dateTime?: string
  pv?: number | string
  uv?: number | string
  ipCount?: number | string
  bounceRate?: number | string
  visitCount?: number | string
  avgVisitTime?: number | string
  avgPv?: number | string
  pvRate?: number
  uvRate?: number
  [key: string]: unknown
}

interface FlowDetailItem {
  statTime?: string
  [key: string]: unknown
}

type MetricOption = { value: string; label: string }

/**
 * 复刻 v2 src/filters/index.js 的 percenBracket 过滤器：带括号的百分比，falsy 返回 '--'。
 * v3 的 @/utils/percent 里没有这个函数。
 */
function percenBracketFilter(s: unknown): string {
  if (s == 1) return '100%'
  if (s) return '(' + (Number(s) * 100).toFixed(2) + '%' + ')'
  return '--'
}

/**
 * 复刻 v2 src/filters/index.js 的 formatTime 过滤器。
 * 注意它比 @/utils/format 的同名函数多一步 Math.floor（先取整再拆时分秒），
 * 所以 0.5 秒在 filters 版里是 "00:00:00"，直接调 utils 版会得到 '--'，不能混用。
 */
function formatTimeFilter(seconds: unknown): string {
  if (seconds) {
    return formatTime(Math.floor(Number(seconds)))
  }
  return '--'
}

/**
 * 复刻 v2 src/filters/index.js 的 averageRules 过滤器：
 * 整数原样返回、非整数向上取整、falsy 返回 '--'。
 * 与 @/utils/percent 的同名函数（小数点后四位为 0 才不进位）实现不同，不能混用。
 */
function averageRulesFilter(num: unknown): number | string {
  if (num) {
    const n = Number(num)
    if (Number.isInteger(n)) return n
    return Math.ceil(n)
  }
  return '--'
}

const { elRef: countLineRef, init: initCountLine, setOption: setCountLineOption } = useChart()

// 每个取数函数一套 token，避免互相顶掉
const { next: nextVisitor, isLatest: isLatestVisitor } = useLatestOnly()
const { next: nextNew, isLatest: isLatestNew } = useLatestOnly()
const { next: nextOld, isLatest: isLatestOld } = useLatestOnly()

const loadingRefresh = ref(false)
const loadingSecond = ref(false)
const timeType = ref('hour')
const headLege = ref('pv')
const options: MetricOption[] = [
  { value: 'pv', label: '浏览量' },
  { value: 'uv', label: '访客数' },
  { value: 'visitCount', label: '访问次数' },
  { value: 'ipCount', label: 'IP数' },
  { value: 'bounceRate', label: '跳出率' },
  { value: 'avgVisitTime', label: '平均访问时长' },
  { value: 'avgPv', label: '平均访问页数' },
]

const commonParams = ref<Record<string, unknown>>({})

// 新老对比
const newVisitorList = ref<VisitorItem>({})
const oldVisitorList = ref<VisitorItem>({})
// 5 行：0=新访客(无对比) 1=新访客(对比) 2=指标名 3=老访客(无对比) 4=老访客(对比)
const allVisitTableList = ref<VisitorItem[]>([
  {},
  {},
  {
    dateTime: '指标',
    pv: '浏览量',
    uv: '访客数',
    ipCount: 'IP数',
    bounceRate: '跳出率',
    visitCount: '访问次数',
    avgVisitTime: '平均访问时长',
    avgPv: '平均访问页数',
  },
  {},
  {},
])

// echarts
const visitorRadio = ref('新访客')
const xAxisVisitor = ref<(string | number)[]>([])
const newEchartList = ref<(number | string | undefined)[]>([])
const oldEchartList = ref<(number | string | undefined)[]>([])
const echartsName = ref('浏览量')
const newAllList = ref<FlowDetailItem[]>([])
const oldAllList = ref<FlowDetailItem[]>([])
// 与 v2 一致：初始值是空数组（真值），所以首次渲染会先显示「对比」那套布局，
// 直到父组件第一次把筛选条参数传进来才会被替换成 '' / 数组
const contrastValue = ref<string | string[]>([])
const dateFlag = ref<number | null>(null)
const visitorName = ref('新访客')
const visitorNameTwo = ref('老访客')
const endValue = ref(24)

/** 取 commonParams.contrastValue 的 [start, end] */
function contrastRange(): string[] {
  const cv = commonParams.value.contrastValue
  return Array.isArray(cv) ? (cv as string[]) : []
}

function getVisitorDetail(item: Record<string, unknown>, flag: number | null) {
  dateFlag.value = flag
  contrastValue.value = (item.contrastValue as string | string[]) ?? ''
  const rows = copyObj(item)
  delete rows.contrastValue
  commonParams.value = copyObj(item)
  // 新老访客对比事件
  visitContrastApiEvent(rows)
}

// 编写访客对比时间
function visitContrastApiEvent(rows: Record<string, unknown>) {
  const params = copyObj(commonParams.value)
  delete params.contrastValue
  if (dateFlag.value == 1) {
    getVisitorApi(params)
    // echarts 接口对比事件
    newAnalysisEvent(params)
  } else if (dateFlag.value == 2) {
    const secondParams = copyObj(rows)
    delete params.contrastValue
    const range = contrastRange()
    params.startTime = range[0]
    params.endTime = range[1]
    getVisitorApi(params, true)
    newAnalysisEvent(secondParams, true)
  } else if (!dateFlag.value) {
    getVisitorApi(params)
    newAnalysisEvent(params)
    visitorName.value = '新访客'
    visitorNameTwo.value = '老访客'
  } else if (dateFlag.value == 3) {
    // 渠道事件调用两个接口
    getVisitorApi(params)
    const secondParams = copyObj(params)
    newAnalysisEvent(params, true)
    setTimeout(() => {
      const range = contrastRange()
      secondParams.startTime = range[0]
      secondParams.endTime = range[1]
      getVisitorApi(secondParams, true)
    }, 200)
  }
}

function getVisitorApi(rows: Record<string, unknown>, flag?: boolean) {
  const token = nextVisitor()
  loadingRefresh.value = true
  const dateTime = `${String(rows.startTime)} ~ ${String(rows.endTime)}`
  getVisitorDetailApi(rows)
    .then((res) => {
      if (!isLatestVisitor(token)) return
      if (res?.code != 200) return
      loadingRefresh.value = false
      const data = res.data as VisitorItem[] | undefined
      if (flag) {
        // 对比事件
        if (data && data.length > 0) {
          const oldValue: VisitorItem = data.find((item) => item.visitorType == '老访客') || {
            visitorType: '老访客',
          }
          const newValue: VisitorItem = data.find((item) => item.visitorType == '新访客') || {
            visitorType: '新访客',
          }
          const allVisitor: VisitorItem[] = []
          allVisitor.push(oldValue, newValue)
          allVisitor.forEach((item) => {
            if (item.visitorType == '老访客') {
              oldVisitorList.value = item
              item.dateTime = dateTime
              allVisitTableList.value[4] = item
            }
            if (item.visitorType == '新访客') {
              newVisitorList.value = item
              item.dateTime = dateTime
              allVisitTableList.value[1] = item
            }
          })
        } else {
          allVisitTableList.value[4] = { dateTime }
          allVisitTableList.value[1] = { dateTime }
        }
      } else {
        // 没有对比接口事件
        if (data) {
          // 处理缺少数据的问题
          const oldValue: VisitorItem = data.find((item) => item.visitorType == '老访客') || {
            visitorType: '老访客',
          }
          const newValue: VisitorItem = data.find((item) => item.visitorType == '新访客') || {
            visitorType: '新访客',
          }
          const allVisitor: VisitorItem[] = []
          allVisitor.push(oldValue, newValue)
          compareEvent(allVisitor, rows)
        } else {
          allVisitTableList.value[3] = { dateTime }
          allVisitTableList.value[0] = { dateTime }
        }
      }
    })
    .catch(() => {
      if (!isLatestVisitor(token)) return
      loadingRefresh.value = false
    })
}

function compareEvent(allVisitor: VisitorItem[], rows: Record<string, unknown>) {
  const dateTime = `${String(rows.startTime)} ~ ${String(rows.endTime)}`
  allVisitor.forEach((item) => {
    if (item.visitorType == '新访客') {
      newVisitorList.value = item
      item.dateTime = dateTime
      allVisitTableList.value[0] = item
    }
    if (item.visitorType == '老访客') {
      oldVisitorList.value = item
      item.dateTime = dateTime
      allVisitTableList.value[3] = oldVisitorList.value
    }
  })
}

function checkPointEvent(item: MetricOption) {
  echartsName.value = item.label
  const val = item.value
  newEchartList.value = []
  oldEchartList.value = []
  newAllList.value.forEach((row) => {
    // 与 v2 一致：这里直接 push 原值，字段缺失时会 push undefined（echarts 渲染成断点）
    newEchartList.value.push(row[val] as number | string | undefined)
  })
  oldAllList.value.forEach((row) => {
    oldEchartList.value.push(row[val] as number | string | undefined)
  })
  countLineEcharts()
}

// echarts 图标触发
function changeDateEvent() {
  if (!dateFlag.value) {
    newAnalysisEvent(commonParams.value)
  } else {
    const params = copyObj(commonParams.value)
    delete params.contrastValue
    newAnalysisEvent(params, true)
  }
}

function changeVisitEvent() {
  const params = copyObj(commonParams.value)
  delete params.contrastValue
  newAnalysisEvent(params, true)
}

// 第一级接口
function newAnalysisEvent(rows: Record<string, unknown>, flag?: boolean) {
  const params = copyObj(rows)
  params.timeType = timeType.value
  if (flag) {
    params.visitorType = visitorRadio.value
  } else {
    params.visitorType = '新访客'
  }
  loadingSecond.value = true
  const token = nextNew()
  getFlowDetailApi(params)
    .then((res) => {
      if (!isLatestNew(token)) return
      if (res?.code != 200) return
      loadingSecond.value = false
      const data = (res.data as FlowDetailItem[]) || []
      if (flag) {
        // 对比
        newAllList.value = data
        newEchartList.value = []
        xAxisVisitor.value = []
        visitorName.value = `${String(params.startTime)} ~ ${String(params.endTime)}`
        data.forEach((item) => {
          if (item[headLege.value]) {
            newEchartList.value.push(item[headLege.value] as number | string)
          } else {
            newEchartList.value.push(0)
          }
        })
        // 老访客
        oldAnalysisEvent(rows, flag) // echarts 图标
      } else {
        // 没有对比
        newAllList.value = data
        newEchartList.value = []
        xAxisVisitor.value = []
        data.forEach((item) => {
          if (item[headLege.value]) {
            newEchartList.value.push(item[headLege.value] as number | string)
          } else {
            newEchartList.value.push(0)
          }
          // 日期
          if (item.statTime) {
            if (item.statTime.length <= 2) {
              item.statTime = item.statTime + '时'
            }
            xAxisVisitor.value.push(item.statTime)
          }
        })
        // 老访客
        oldAnalysisEvent(rows) // echarts 图标
      }
    })
    .catch(() => {
      if (!isLatestNew(token)) return
      loadingSecond.value = false
    })
}

// echarts 老访客
function oldAnalysisEvent(rows: Record<string, unknown>, flag?: boolean) {
  if (timeType.value != 'hour') {
    endValue.value = 13
  } else {
    endValue.value = 24
  }
  const params = copyObj(rows)
  params.timeType = timeType.value
  if (flag) {
    params.visitorType = visitorRadio.value
    const range = contrastRange()
    params.startTime = range[0]
    params.endTime = range[1]
    visitorNameTwo.value = `${String(params.startTime)} ~ ${String(params.endTime)}`
  } else {
    params.visitorType = '老访客'
  }
  const token = nextOld()
  getFlowDetailApi(params)
    .then((res) => {
      if (!isLatestOld(token)) return
      if (res?.code != 200) return
      const data = (res.data as FlowDetailItem[]) || []
      xAxisVisitor.value = []
      if (flag) {
        // 对比状态
        oldAllList.value = data
        oldEchartList.value = []
        for (let i = 0; i < oldAllList.value.length; i++) {
          for (let j = 0; j < newAllList.value.length; j++) {
            if (i == j) {
              const newRow = newAllList.value[i]
              const oldRow = oldAllList.value[i]
              if (timeType.value != 'hour') {
                xAxisVisitor.value.push(`${String(newRow?.statTime)}与${String(oldRow?.statTime)}`)
              } else {
                if (newRow?.statTime) {
                  if (newRow.statTime.length <= 2) {
                    newRow.statTime = newRow.statTime + '时'
                  }
                  xAxisVisitor.value.push(newRow.statTime)
                } else {
                  xAxisVisitor.value.push(0)
                }
              }
            }
          }
        }

        data.forEach((item) => {
          if (item[headLege.value]) {
            oldEchartList.value.push(item[headLege.value] as number | string)
          } else {
            oldEchartList.value.push(0)
          }
        })
      } else {
        oldAllList.value = data
        oldEchartList.value = []
        data.forEach((item) => {
          if (item[headLege.value]) {
            oldEchartList.value.push(item[headLege.value] as number | string)
          } else {
            oldEchartList.value.push(0)
          }
          if (item.statTime) {
            if (item.statTime.length <= 2) {
              item.statTime = item.statTime + '时'
            }
            xAxisVisitor.value.push(item.statTime)
          }
        })
      }
      countLineEcharts()
    })
    .catch(() => {
      /* 报错已由请求层统一提示 */
    })
}

type TooltipParam = { name?: string; seriesName?: string; data?: unknown; newTime?: string }

function tooltipFormatter(rawParams: unknown): string {
  const params = (Array.isArray(rawParams) ? rawParams : [rawParams]) as TooltipParam[]
  const first = params[0]
  let res = ''
  if (contrastValue.value) {
    if (timeType.value == 'hour') {
      res =
        "<div style='display:flex;justify-content: space-between;padding:7px'>" +
        '<div>' +
        String(first?.name ?? '') +
        '</div>' +
        '<div>' +
        echartsName.value +
        '</div>' +
        '</div>'

      for (let i = 0; i < params.length; i++) {
        const item = params[i]
        res +=
          "<div style='display:flex;padding:5px 7px;'>" +
          String(item?.seriesName ?? '').split('：')[0] +
          "<div style='min-width:100px;text-align:right;margin-right:20px'>" +
          String(item?.data ?? '') +
          '</div>' +
          '</div>'
      }
      return res
    } else {
      res =
        "<div style='display:flex;justify-content: space-between;padding:7px'>" +
        '<div>' +
        '时间' +
        '</div>' +
        '<div>' +
        echartsName.value +
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
  } else {
    // 没有对比
    res =
      "<div style='display:flex;justify-content: space-between;padding:7px'>" +
      "<div style='margin-right:20px'>" +
      String(first?.name ?? '') +
      '</div>' +
      "<div style=''>" +
      echartsName.value +
      '</div>' +
      '</div>'
    for (let i = 0; i < params.length; i++) {
      const item = params[i]
      res +=
        "<div style='display:flex;padding:5px 7px;justify-content: space-between;'>" +
        String(item?.seriesName ?? '').split('：')[0] +
        "<div style='min-width:100px;text-align:right;margin-right:20px'>" +
        String(item?.data ?? '') +
        '</div>' +
        '</div>'
    }
    return res
  }
}

function countLineEcharts() {
  const option: EChartsOption = {
    tooltip: {
      trigger: 'axis',
      showContent: true,
      formatter: tooltipFormatter,
    },
    // v2 是 legend: { x: 'center', y: 'top' }，echarts 5+ 换成 left/top
    legend: {
      left: 'center',
      top: 'top',
    },
    grid: {
      left: '5%',
      right: '0%',
      top: '15%',
      bottom: '5%',
      containLabel: true,
    },

    dataZoom: [
      {
        type: 'inside',
        startValue: 0,
        endValue: endValue.value,
        minValueSpan: 10,
        zoomOnMouseWheel: false,
        moveOnMouseWheel: true,
        moveOnMouseMove: true,
      },
    ],

    xAxis: {
      type: 'category',
      data: xAxisVisitor.value,
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
        // v2 写的是字符串 '45'，echarts 5+ 要求数字
        rotate: 45,
        // v2 是 axisLabel.textStyle.fontSize，echarts 5+ 已移除 textStyle，平铺到 axisLabel 上
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
        data: newEchartList.value,
        type: 'line',
        name: visitorName.value + '：' + echartsName.value,
        color: '#2c7be5',
      },
      {
        data: oldEchartList.value,
        type: 'line',
        name: visitorNameTwo.value + '：' + echartsName.value,
        color: '#FFDE84',
      },
    ],
  }
  setCountLineOption(option, true)
}

onMounted(() => initCountLine())

defineExpose({ getVisitorDetail })
</script>

<template>
  <div class="chartsIcon">
    <div class="public-block">
      <!-- 新老访客 no 对比 -->
      <div v-loading="loadingRefresh" class="setSpace public-hoverItem block-main">
        <div v-show="!contrastValue" class="visitLog">
          <div class="visitLeft">
            <div class="contrast">
              <div>新访客</div>
              <img
                src="@/assets/images/newVisit.png"
                style="width: 113px; height: 113px; object-fit: cover; margin: 18px 0"
              />
              <div>{{ percentage(newVisitorList.uvRate) }}</div>
            </div>
            <div>
              <div class="pointItem">
                <div class="pointFornt pointTh">浏览量：</div>
                <div class="pointFornt">
                  {{ newVisitorList.pv || '--' }}
                  {{ percenBracketFilter(newVisitorList.pvRate) }}
                </div>
              </div>
              <div class="pointItem">
                <div class="pointFornt pointTh">访客数：</div>
                <div class="pointFornt">
                  {{ newVisitorList.uv || '--' }}
                  {{ percenBracketFilter(newVisitorList.uvRate) }}
                </div>
              </div>
              <div class="pointItem">
                <div class="pointFornt pointTh">IP 数：</div>
                <div class="pointFornt">
                  {{ newVisitorList.ipCount || '--' }}
                </div>
              </div>
              <div class="pointItem">
                <div class="pointFornt pointTh">跳出率：</div>
                <div class="pointFornt">
                  {{ percentage(newVisitorList.bounceRate) }}
                </div>
              </div>
              <div class="pointItem">
                <div class="pointFornt pointTh">访问次数：</div>
                <div class="pointFornt">
                  {{ newVisitorList.visitCount || '--' }}
                </div>
              </div>
              <div class="pointItem">
                <div class="pointFornt pointTh">平均访问时长：</div>
                <div class="pointFornt">
                  {{ formatTimeFilter(newVisitorList.avgVisitTime) }}
                </div>
              </div>
              <div class="pointItem">
                <div class="pointFornt pointTh">平均访问页数：</div>
                <div class="pointFornt">
                  {{ averageRulesFilter(newVisitorList.avgPv) }}
                </div>
              </div>
            </div>
          </div>
          <div class="visitRight">
            <div class="contrast">
              <div style="color: #4d4d4d">老访客</div>
              <img
                src="@/assets/images/oldVisit.png"
                style="width: 113px; height: 113px; object-fit: cover; margin: 18px 0"
              />
              <div style="color: #4d4d4d">
                {{ percentage(oldVisitorList.uvRate) }}
              </div>
            </div>
            <div>
              <div class="pointItem">
                <div class="pointFornt pointTh">浏览量：</div>
                <div class="pointFornt">
                  {{ oldVisitorList.pv || '--' }}
                  {{ percenBracketFilter(oldVisitorList.pvRate) }}
                </div>
              </div>
              <div class="pointItem">
                <div class="pointFornt pointTh">访客数：</div>
                <div class="pointFornt">
                  {{ oldVisitorList.uv || '--' }}
                  {{ percenBracketFilter(oldVisitorList.uvRate) }}
                </div>
              </div>
              <div class="pointItem">
                <div class="pointFornt pointTh">IP 数：</div>
                <div class="pointFornt">
                  {{ oldVisitorList.ipCount || '--' }}
                </div>
              </div>
              <div class="pointItem">
                <div class="pointFornt pointTh">跳出率：</div>
                <div class="pointFornt">
                  {{ percentage(oldVisitorList.bounceRate) }}
                </div>
              </div>
              <div class="pointItem">
                <div class="pointFornt pointTh">访问次数：</div>
                <div class="pointFornt">
                  {{ oldVisitorList.visitCount || '--' }}
                </div>
              </div>
              <div class="pointItem">
                <div class="pointFornt pointTh">平均访问时长：</div>
                <div class="pointFornt">
                  {{ formatTimeFilter(oldVisitorList.avgVisitTime) }}
                </div>
              </div>
              <div class="pointItem">
                <div class="pointFornt pointTh">平均访问页数：</div>
                <div class="pointFornt">
                  {{ averageRulesFilter(oldVisitorList.avgPv) }}
                </div>
              </div>
            </div>
          </div>
        </div>
        <!-- 对比情况下 -->
        <div v-show="contrastValue" class="visitLog">
          <div class="contrast hascontrast" style="width: 15%">
            <div>新访客</div>
            <img
              src="@/assets/images/newVisit.png"
              style="width: 113px; height: 113px; object-fit: cover; margin: 18px 0"
            />
            <div>{{ percentage(newVisitorList.uvRate) }}</div>
          </div>
          <div style="width: 70%">
            <div class="tableVisit">
              <div
                v-for="(item, index) in allVisitTableList"
                :key="index"
                style="width: 20%"
              >
                <div class="bid-list-header">
                  {{ item.dateTime || '' }}
                </div>
                <div class="bid-list-record">
                  <div v-show="index != 2" class="bidFont">
                    {{ item.pv || '--' }}
                    {{ percenBracketFilter(item.pvRate) }}
                  </div>
                  <div v-show="index == 2" class="bidFont">
                    {{ item.pv }}
                  </div>
                  <div v-show="index != 2" class="bidFont">
                    {{ item.uv || '--' }}
                    {{ percenBracketFilter(item.uvRate) }}
                  </div>
                  <div v-show="index == 2" class="bidFont">
                    {{ item.uv }}
                  </div>
                  <div class="bidFont">
                    {{ item.ipCount || '--' }}
                  </div>
                  <div v-show="index != 2" class="bidFont">
                    {{ percentage(item.bounceRate) }}
                  </div>
                  <div v-show="index == 2" class="bidFont">
                    {{ item.bounceRate }}
                  </div>
                  <div class="bidFont">
                    {{ item.visitCount || '--' }}
                  </div>
                  <div v-show="index != 2" class="bidFont">
                    {{ formatTimeFilter(item.avgVisitTime) }}
                  </div>
                  <div v-show="index == 2" class="bidFont">
                    {{ item.avgVisitTime }}
                  </div>
                  <div v-show="index != 2" class="bidFont">
                    {{ averageRulesFilter(item.avgPv) }}
                  </div>
                  <div v-show="index == 2" class="bidFont">
                    {{ item.avgPv }}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="contrast hascontrast" style="width: 15%">
            <div style="color: #4d4d4d">老访客</div>
            <img
              src="@/assets/images/oldVisit.png"
              style="width: 113px; height: 113px; object-fit: cover; margin: 18px 0"
            />
            <div style="color: #4d4d4d">
              {{ percentage(oldVisitorList.uvRate) }}
            </div>
          </div>
        </div>
      </div>

      <!-- echarts -->
      <div v-loading="loadingSecond" class="trendDiv setSpace public-hoverItem block-main">
        <div class="block-head">
          <div class="block-title">访客分析</div>
          <div>
            <el-radio-group
              v-model="timeType"
              size="small"
              style="font-size: 13px; height: 30px; padding-left: 20px"
              @change="changeDateEvent"
            >
              <el-radio-button value="hour">按时</el-radio-button>
              <el-radio-button value="day">按日</el-radio-button>
              <el-radio-button value="week">按周</el-radio-button>
              <el-radio-button value="month">按月</el-radio-button>
            </el-radio-group>
          </div>
          <div v-show="contrastValue" class="check_item public_border_color">
            <span>访客:</span>
            <el-radio-group
              v-model="visitorRadio"
              class="checkBoxStyle"
              @change="changeVisitEvent"
            >
              <el-radio value="新访客">新访客</el-radio>
              <el-radio value="老访客">老访客</el-radio>
            </el-radio-group>
          </div>
        </div>
        <div
          style="
            display: flex;
            border: 1px solid #d8e2ef;
            border-radius: 4px;
            align-items: center;
            height: 30px;
            margin-left: 78px;
            width: 220px;
          "
        >
          <div style="font-size: 12px; color: #4d4d4d; padding-left: 6px">指标:</div>
          <el-select
            v-model="headLege"
            class="appli_select appli-select-style"
            placeholder="请选择指标"
            size="small"
            style="width: 175px"
          >
            <el-option
              v-for="item in options"
              :key="item.value"
              :label="item.label"
              :value="item.value"
              @click="checkPointEvent(item)"
            />
          </el-select>
        </div>
        <div ref="countLineRef" style="width: 90%; height: 400px; margin-top: 20px" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
// v2 这里是 @import "~@/styles/components/custom-select.scss";
// v3 已在 styles/index.scss 全局 @use，组件内不再重复引入

.check_item {
  background-color: #ffffff;
  margin-left: 20px;
  height: 30px;
  border-radius: 4px;
  display: flex;
  align-items: center;

  span {
    font-size: 12px;
    font-weight: 400;
    line-height: 13px;
    color: #4d4d4d;
    padding: 0 10px;
  }

  .checkBoxStyle {
    padding-right: 10px;
  }
}

:deep(.el-radio__label) {
  font-size: 12px;
}

// v2 是 .el-radio-button--mini，element-plus 的 size="small" 对应 --small
:deep(.el-radio-button--small .el-radio-button__inner) {
  height: 30px;
}

.visitorAll {
  display: flex;
  height: 654px;
  justify-content: space-between;

  .newVisitor {
    width: calc(50% - 10px);
    background-color: #fff;
  }

  .oldVisitor {
    width: calc(50% - 10px);
    background-color: #fff;
  }
}

.visitLog {
  min-height: 311px;
  background-color: #fff;
  border-radius: 6px;
  padding: 60px;
  box-sizing: border-box;
  display: flex;

  .contrast {
    text-align: center;
    font-size: 18px;
    font-weight: bold;
    line-height: 33px;
    color: #6ba3ed;
  }

  .pointItem {
    display: flex;
    margin-left: 54px;

    .pointTh {
      width: 150px;
      // width: 30%;
      text-align: right;
      margin-right: 10px;
    }

    .pointFornt {
      font-size: 13px;
      font-weight: 400;
      line-height: 33px;
      color: #4d4d4d;
    }
  }

  .visitLeft {
    width: 50%;
    display: flex;
  }

  .visitRight {
    width: 50%;
    display: flex;
  }
}

.trendDiv {
  min-height: 462px;
  background-color: #fff;
  border-radius: 6px;
}

.setSpace {
  margin-bottom: 20px;
}

.tableVisit {
  display: flex;

  .bid-list-header {
    height: 38px;
    line-height: 38px;
    font-size: 13px;
    font-weight: bold;
    color: #4d4d4d;
    border-bottom: 1px solid #dee0ec;
    text-align: center;
  }

  .bidFont {
    height: 38px;
    line-height: 38px;
    font-size: 13px;
    font-weight: 400;
    color: #4d4d4d;
    border-bottom: 1px solid #dee0ec;
    text-align: center;
  }
}

.hascontrast {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}
</style>
