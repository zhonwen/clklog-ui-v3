<script setup lang="ts">
/**
 * 群画像-画像分析-合并视图（v2 views/ups/userPortrait/merge-echart.vue）。
 *
 * 父组件 portrait-analyze.vue 通过 ref 调用：
 *   initApiList(infoList, contrastCrowdList, targetCrowd)
 *   updateComputeStatus(data, status, portraitInfoList)
 *
 * v2 里未被模板或上述入口引用的死代码（tableData / radioOptions / behaviorRadio /
 * targetType / selectedIdx / chart / contrastInstances，以及 handelRandio、confirmPopover、
 * closePopover、intervalBlur、addDevideEvent、deleteInterval、mathRandomEvent、
 * initSort、portraitInfoListApi、handleEdite 这批方法）在本文件里未迁移：
 * 它们在 merge-echart 的模板里没有任何触发点，closePopover 还引用了本模板并不存在的
 * customPopover ref（调用即报错）。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import type { ComponentPublicInstance, CSSProperties } from 'vue'
import * as echarts from 'echarts'
import type { ECharts, EChartsOption } from 'echarts'
import { ElMessage } from 'element-plus'
import { useRoute } from 'vue-router'
import Sortable from 'sortablejs'
import { deleteportrait, getDistribution } from '@/api/upsapi/groupportrait'
import { useLatestOnly } from '@/composables/useLatestOnly'
import { chartColorList } from '@/utils/chart-constants'
import { copyObj } from '@/utils/copy'
import { formatDateHMS, formatDateYMD } from '@/utils/date'
import { debounce } from '@/utils/index'
import type { GropPortraitInfo, PortraitInfoItem } from './types'

/** 分布明细的一项（接口 getDistribution 返回的 distributions 元素） */
interface DistributionItem {
  name?: string
  count?: number
  /** processData 里把 count 赋给 value，供 echarts 取数 */
  value?: number
  [key: string]: unknown
}

/** 一个人群（目标人群 / 对比人群）的分布结果 */
interface ContrastGroup {
  name?: string
  count?: number
  totalUser?: number
  distributions: DistributionItem[]
  [key: string]: unknown
}

/** 画像信息里的一条指标（formula.measures 元素） */
interface MergeMeasure {
  name?: string
  displayName?: string
  earlistTime?: string | number
  latestTime?: string | number
  [key: string]: unknown
}

/** 画像信息的筛选条件（formula.filters） */
interface MergeFilters {
  type?: string
  count?: number | string
  sort?: string
  [key: string]: unknown
}

/** 画像信息的 formula（入参里是 JSON 字符串，本组件解析成对象后原地覆盖） */
interface MergeFormula {
  filters: MergeFilters
  measures?: MergeMeasure[]
  [key: string]: unknown
}

/** 卡片对应的一条画像信息 */
interface MergeItem {
  id?: string
  type?: string
  timestamp?: string
  /** 标签属性分布卡片头部展示的占比（v2 由外部塞入） */
  userRate?: number | string
  /** 与 v2 一致（v2 此处逻辑存疑：commonSortItem 里写的是 rate，模板读的却是 userRate） */
  rate?: string
  formula: MergeFormula
  targerChartList: DistributionItem[]
  contrastChartlist?: ContrastGroup[]
  [key: string]: unknown
}

/** 目标人群信息（父组件传入，只用到 creator / displayName） */
interface TargetCrowdInfo {
  creator?: boolean
  displayName?: string
  [key: string]: unknown
}

/** 对比人群信息 */
interface ContrastCrowdItem {
  displayName?: string
  [key: string]: unknown
}

/** 合并视图的一条 series */
interface MergeSeries {
  name: string
  type: 'bar'
  /** 与 v2 一致（v2 此处逻辑存疑：对比人群缺少某个维度值时 find 返回 undefined，会直接塞进 data） */
  data: (DistributionItem | undefined)[]
  barMaxWidth: number
  label: { show: boolean; position: 'top' }
}

/** tooltip 回调里用到的字段 */
interface TooltipParam {
  seriesName?: string
  color?: string
  value?: number | string
  data?: DistributionItem
}

/** 卡片头部的展示文案，避免模板里重复调用 filterDisplay / filterDatePicker */
interface CardView {
  display: string
  dateText: string
  targetCount: number | string
}

const route = useRoute()
const projectName = computed(() => route.query.projectName)

const defaultType = ref('bar')
const portraitOrigin = ref<PortraitInfoItem[]>([])
const targetCrowdInfo = ref<TargetCrowdInfo>({})
const portraitInfoList = ref<MergeItem[]>([])
const contrastList = ref<ContrastCrowdItem[]>([])
/** 合并图表名称（v2 在 initApiList 里赋值，后续未再使用，原样保留） */
const mergeXAxis = ref<(string | undefined)[]>([])
const compute_status = ref('待计算')
const colorList = chartColorList

const chartTypeList = [
  {
    value: 'bar',
    label: '柱状图',
  },
  // {
  //   value: "table",
  //   label: "表格",
  // },
]

const firstFewItemsList = [
  { value: 5, label: '前5项' },
  { value: 10, label: '前10项' },
  { value: 15, label: '前15项' },
  { value: 20, label: '前20项' },
  { value: 30, label: '前30项' },
  { value: 50, label: '前50项' },
]

const targetTypeList = [
  { value: 'count_desc', label: '按目标人群的覆盖人数降序' },
  { value: 'count_asc', label: '按目标人群的覆盖人数升序' },
  { value: 'dimension_asc', label: '按纬度值升序' },
  { value: 'dimension_desc', label: '按纬度值降序' },
]

/**
 * 图表数量随 portraitInfoList 动态变化，useChart 的单 elRef 撑不住，
 * 因此本文件内用 shallowRef 数组 + echarts.init 手动管理，
 * 并自行补 resize 监听与 onBeforeUnmount 的 dispose。
 */
const chartElList = shallowRef<(HTMLDivElement | null)[]>([])
const chartInstances = shallowRef<(ECharts | null)[]>([])

function setChartRef(el: Element | ComponentPublicInstance | null, index: number) {
  chartElList.value[index] = (el as HTMLDivElement | null) ?? null
}

const blockAreaStyle = computed<CSSProperties>(() =>
  contrastList.value.length > 0 ? { width: '100%' } : { width: '48%' },
)

const cardViews = computed<CardView[]>(() =>
  portraitInfoList.value.map((item) => ({
    display: filterDisplay(item),
    dateText: item.type == '标签属性分布' ? '' : filterDatePicker(item),
    targetCount: item.targerChartList?.[0]?.count || 0,
  })),
)

function isJsonString(str: unknown): boolean {
  try {
    JSON.parse(str as string)
    return true // 如果没有抛出异常，说明是有效的 JSON 字符串
  } catch {
    return false // 如果抛出异常，说明不是有效的 JSON 字符串
  }
}

function filterDisplay(item: MergeItem): string {
  const measure = item.formula?.measures?.[0]
  if (item.type == '标签属性分布') {
    return String(measure?.displayName ?? '')
  } else {
    return String(measure?.name ?? '')
  }
}

/**
 * 提取相对天数，如果是 '7day' 或 '-7day' 返回数字天数；
 * 如果是纯数字（如时间戳），直接返回 null 或 0（视业务需求）。
 */
function extractDays(relativeDateString: string | number | undefined): number | null {
  // 先判断是否为纯数字（时间戳），如果是则直接返回 null
  if (/^\d+$/.test(String(relativeDateString))) {
    // 你可以根据业务需要返回 null 或 0 或直接返回原值
    return null
  }
  // 匹配 '7day' 或 '-7day' 这种格式
  const match = String(relativeDateString).match(/-?(\d+)day/)
  if (match) {
    return parseInt(match[1] as string, 10)
  }
  return null
}

/**
 * v2 是 moment().subtract(day, 'days').format('YYYY-MM-DD')；
 * v3 没有 moment，用 Date.setDate 做按日历的天数回退（与 moment 等价），
 * day 为 null 时 moment 视作 0 天（即今天），这里保持一致。
 */
function getDateRange(day: number | null): string {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - (day ?? 0))
  return formatDateYMD(startDate)
}

function filterDatePicker(item: MergeItem): string {
  const measures = item.formula?.measures?.[0]
  const earlistTime = measures?.earlistTime
  const latestTime = measures?.latestTime
  const pdValue = typeof latestTime === 'number' && typeof earlistTime === 'number'
  if (pdValue) {
    // v2: moment(measures.earlistTime * 1000).format('YYYY-MM-DD')
    const earlist = formatDateYMD(new Date((earlistTime as number) * 1000))
    const latest = formatDateYMD(new Date((latestTime as number) * 1000))
    return earlist + '至' + latest
  } else {
    if (latestTime == 'now') {
      const endDate = formatDateYMD(new Date())
      const startDate = getDateRange(extractDays(earlistTime))
      return `${startDate}至${endDate}`
    } else {
      const startDate = getDateRange(extractDays(earlistTime))
      const endDate = getDateRange(extractDays(latestTime))
      return `${startDate}至${endDate}`
    }
  }
}

/** 严格判断是否 'YYYY-MM-DD HH:mm:ss' 或 ISO 8601 字符串（替代 moment(x, fmt, true).isValid()） */
function isStrictDateTimeString(value: unknown): boolean {
  const str = String(value)
  const dateTimeRE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/
  const iso8601RE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/
  if (!dateTimeRE.test(str) && !iso8601RE.test(str)) {
    return false
  }
  return !isNaN(new Date(str).getTime())
}

/** 是否 13 位毫秒时间戳（v2 的 !isNaN(x) && String(x).length === 13 && /^\d+$/ 判断） */
function isMsTimestamp(value: unknown): boolean {
  return (
    value != null &&
    value !== '' &&
    !isNaN(Number(value)) &&
    String(value).length === 13 &&
    /^\d+$/.test(String(value))
  )
}

function processData(
  targetList: DistributionItem[],
  contrastGroupList: ContrastGroup[] | undefined,
): MergeSeries[] {
  // let targetNames = targetList.map((item) => item.name);
  const targetNames: (string | undefined)[] = []
  targetList = targetList.map((item) => {
    item.value = item.count
    targetNames.push(item.name)
    return item
  })
  // 创建目标人群数据
  const newArray: MergeSeries[] = [
    {
      name: '目标人群',
      type: 'bar',
      data: targetList,
      barMaxWidth: 100,
      label: {
        show: true,
        position: 'top',
      },
    },
  ]

  // 创建对比视图数据
  // 与 v2 一致（v2 此处逻辑存疑：未判空，contrastChartlist 为 undefined 时会抛错，这里容错成空数组）
  ;(contrastGroupList ?? []).forEach((contrast) => {
    const filteredData = targetNames.map((name) => {
      // 与 v2 一致：find 的回调里顺手把 count 赋给 value（有副作用，只作用到命中为止）
      const item = contrast.distributions.find((sub) => {
        sub.value = sub.count
        return sub.name === name
      })
      return item
    })

    newArray.push({
      name: String(contrast.name ?? ''),
      type: 'bar',
      data: filteredData,
      barMaxWidth: 100,
      label: {
        show: true,
        position: 'top',
      },
    })
  })

  return newArray
}

// 设置动态目标人群-图表
function drawDevice(
  index: number,
  series: MergeSeries[],
  xAxisList: (string | undefined)[],
  unit: string[],
  item: MergeItem,
) {
  // let xAxis_name =
  //   (item.formula.measures && item.formula.measures[0].displayName) || "";
  let xAxis_name = ''
  if (item && item.type == '用户行为分布') {
    const name = item.formula?.measures?.[0]?.name || ''
    xAxis_name = String(name)
  } else {
    xAxis_name = String(item.formula?.measures?.[0]?.displayName || '')
  }
  const formattedData = xAxisList.map((value) => {
    if (isMsTimestamp(value)) {
      // 时间戳（v2: moment(parseInt(item)).format('YYYY-MM-DD HH:mm:ss')）
      return formatDateHMS(parseInt(String(value), 10))
    } else if (value != null && isStrictDateTimeString(value)) {
      // ISO 8601 日期字符串或类似格式
      return formatDateHMS(String(value))
    } else {
      // 其他情况
      return value
    }
  })
  const setEndValue = 30
  nextTick(() => {
    const el = chartElList.value[index]
    if (!el) return
    // v2 在同一个 DOM 上重复 echarts.init（echarts 会返回已有实例并 merge 配置）；
    // 这里先 dispose 再 init，结果等价且不会残留旧 series。
    chartInstances.value[index]?.dispose()
    const myChart = echarts.init(el)

    // v2: option.dataZoom[0].show = true（inside 型 dataZoom 其实不认 show，属于 v2 遗留写法，原样保留）
    const dataZoomItem: Record<string, unknown> = {
      type: 'inside',
      startValue: 0,
      endValue: 20,
      minValueSpan: 10,
      zoomOnMouseWheel: false,
      moveOnMouseWheel: true,
      moveOnMouseMove: true,
    }
    if ((series[0]?.data.length ?? 0) > setEndValue) {
      dataZoomItem.show = true
    }

    // 不给 option 标注 EChartsOption：v2 的 nameTextStyle.italic 不在 echarts 的类型里
    // （见下方注释），标注后会触发多余属性检查，这里统一在 setOption 处断言。
    const option = {
      legend: {
        show: true,
        data: unit,
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          lineStyle: {
            color: '#C0CADB',
            width: 1,
          },
        },
        formatter: function (rawParams: unknown) {
          const params = (Array.isArray(rawParams) ? rawParams : [rawParams]) as TooltipParam[]
          let res = ''

          for (let i = 0; i < params.length; i++) {
            const current = params[i]
            if (!current) continue
            let seriesName = current.seriesName || ''

            if (seriesName && isMsTimestamp(seriesName)) {
              // 时间戳
              seriesName = formatDateHMS(parseInt(String(seriesName), 10))
            }
            if (i == 0) {
              res += '<div>' + xAxis_name + '</div>'
            }
            if (current.value) {
              res +=
                "<div style='display:flex;align-items:center;'>" +
                ` <div style=' width: 10px; height: 10px; border-radius: 50%;background-color: ${current.color};'>
                  </div>` +
                "<div style='margin-left:3px;'>" +
                seriesName +
                '为' +
                '【' +
                (current.data?.name || '') +
                '】' +
                '的总人数' +
                ' :' +
                current.value +
                '</div>' +
                '</div>'
            }
          }
          return res
        },
      },
      xAxis: [
        {
          type: 'category',
          data: formattedData,
          nameTextStyle: {
            color: '#2c7be5',
            fontSize: 13, // 设置字体大小
            fontWeight: 'bold', // 可选：设置字体粗细
            // 与 v2 一致（v2 此处逻辑存疑：echarts 没有 italic 配置项，应为 fontStyle: 'italic'）
            italic: true, // 可选：设置字体为斜体
            overflow: 'truncate', // 超出显示省略号
            // formatter: function (value) {
            //   return value.length > 4
            //     ? value.substring(0, 4) + "..."
            //     : value;
            // },
          },
          // nameLocation: "end", // 将 name 放在右边
          boundaryGap: true,
          axisLabel: {
            interval: 0, // 强制文字产生间隔
            rotate: 25, // 旋转角度
            overflow: 'truncate', // 超出显示省略号
            formatter: function (value: string) {
              if (value) {
                return value.length > 10 ? value.substring(0, 10) + '...' : value
              }
              // v2 此处不 return（等价于 undefined），echarts 同样渲染为空串
              return ''
            },
          },
          axisLine: {
            onZero: false,
          },
          axisTick: {
            show: false,
            alignWithLabel: true,
          },
        },
      ],
      yAxis: [
        {
          type: 'value',
          axisTick: {
            show: false,
            alignWithLabel: true,
          },
          // name: "总人数",
          nameTextStyle: {
            color: '#2c7be5',
            fontSize: 13,
            fontWeight: 'bold',
            // 与 v2 一致（v2 此处逻辑存疑：echarts 没有 italic 配置项）
            italic: true,
          },
          position: 'left',
          axisLabel: {
            formatter: '{value}',
          },
        },
      ],
      dataZoom: [dataZoomItem],
      series: series,
      color: colorList,
    }

    myChart.setOption(option as unknown as EChartsOption, true)
    chartInstances.value[index] = myChart
  })
}

/** initApiList / 拖拽重排后按下标重绘单张图（等价于 v2 initApiList 循环体里的那几行） */
function drawItem(item: MergeItem, index: number) {
  const series_list = processData(item.targerChartList, item.contrastChartlist)
  const xAxisList = item.targerChartList.map((sub) => sub.name)
  const unit = series_list.map((sub) => sub.name)
  drawDevice(index, series_list, xAxisList, unit, item)
}

function handleResize() {
  chartInstances.value.forEach((instance) => {
    if (instance) {
      instance.resize()
    }
  })
}

const onResize = debounce(() => handleResize(), 100)

// 与 v2 的 mixins/resize.js 一致：侧栏折叠只认宽度过渡
function onSidebarTransitionEnd(e: Event) {
  if ((e as TransitionEvent).propertyName === 'width') onResize()
}

function handleEchartType(index: number) {
  // v2 模板传的是 (index, $event, item)，而方法签名是 (index, item, $event)，
  // 后两个参数在方法体里根本没用到，这里只保留 index。
  nextTick(() => {
    const instance = chartInstances.value[index]
    if (instance && instance.resize) {
      instance.resize()
    }
  })
}

const { next: nextDistribution, isLatest: isLatestDistribution } = useLatestOnly()

function getTargetName(index?: number): string {
  try {
    const raw = localStorage.getItem('gropPortraitInfo')
    const portraitInfo = (raw ? JSON.parse(raw) : {}) as Partial<GropPortraitInfo>
    if (portraitInfo.formula && portraitInfo.formula.length > 0) {
      return portraitInfo.formula[index ? index : 0]?.name || ''
    }
  } catch {
    /* ignore */
  }
  return ''
}

function commonSortItem(item: MergeItem, index: number) {
  const sortItem = String(item.formula.filters.sort ?? '')
  const sort = [
    {
      property: sortItem.split('_')[0] || 'count',
      direction: sortItem.split('_')[1] || 'desc',
    },
  ]
  const takes = item.formula.filters.count || '10'
  const token = nextDistribution()
  getDistribution({
    id: item.id,
    takes: takes,
    sort: sort,
    projectName: projectName.value,
  }).then((res) => {
    if (!isLatestDistribution(token)) return
    // 与 v2 一致：此处没有判 code，直接用 res.data
    const list = (res?.data ?? []) as ContrastGroup[]
    item.contrastChartlist = []
    list.forEach((subItem) => {
      if (subItem.name == getTargetName()) {
        item.targerChartList = subItem.distributions
        const userRate = (((subItem.count ?? 0) / (subItem.totalUser ?? 0)) * 100).toFixed(2)
        item.rate = userRate
      } else {
        item.contrastChartlist?.push(subItem)
      }
    })
    portraitInfoList.value[index] = item
    // 筛选事项处理合并视图
    const series_list = processData(item.targerChartList, item.contrastChartlist)

    const xAxisList = item.targerChartList.map((sub) => sub.name)
    const unit = series_list.map((sub) => sub.name)
    drawDevice(index, series_list, xAxisList, unit, item)

    return
  })
}

// 前几项
function handleFirstFewItems(_event: unknown, item: MergeItem, index: number) {
  commonSortItem(item, index)
}

// 升降序
function handleDescAsc(_event: unknown, item: MergeItem, index: number) {
  commonSortItem(item, index)
}

function handleDelete(item: MergeItem, index: number) {
  deleteportrait({ id: item.id, projectName: projectName.value }).then(() => {
    // 与 v2 一致：不判 code，直接按成功处理
    // 与 v2 一致（v2 此处逻辑存疑：只删了数据、没有重绘图表，
    // 卡片按下标复用 DOM，删除后第 index 张图仍是旧数据、最后一张图会残留）
    portraitInfoList.value.splice(index, 1)
    portraitOrigin.value.splice(index, 1)
    ElMessage.success('删除成功')
  })
}

/**
 * 卡片拖拽：与 v2 mounted 里的 sortablejs 调用保持一致
 *   new Sortable(this.$refs.example, { handle: '.handle', onStart(evt) {}, onEnd({ newIndex, oldIndex }) {} })
 * v2 的 onStart / onEnd 都是空函数，sortablejs 只搬 DOM 节点、不回写数据数组，
 * 所以 v2 的真实效果是「按住卡片头部（.handle）能拖、松手后视觉顺序变化、但数据顺序不变」——
 * 列表一旦重新渲染即复原，保存/导出的仍是原顺序。这里照搬同样的行为。
 * v2 组件销毁时没有 destroy 实例，v3 补上，避免路由切换后残留监听。
 */
const containerRef = ref<HTMLElement | null>(null)
let sortable: Sortable | null = null

function initApiList(
  data: PortraitInfoItem[],
  contrastCrowdList: ContrastCrowdItem[],
  targetCrowd: TargetCrowdInfo,
) {
  contrastList.value = contrastCrowdList
  targetCrowdInfo.value = targetCrowd
  // 合并图表名称
  mergeXAxis.value = [
    targetCrowd.displayName,
    ...contrastCrowdList.map((item) => item.displayName),
  ]
  portraitOrigin.value = data
  const list = copyObj(data) as unknown as MergeItem[]
  list.forEach((item) => {
    const rawFormula: unknown = item.formula
    if (rawFormula && isJsonString(rawFormula)) {
      item.formula = JSON.parse(String(rawFormula)) as MergeFormula
    }
  })
  portraitInfoList.value = list
  portraitInfoList.value.forEach((item, index) => {
    drawItem(item, index)
  })
  setTimeout(() => {
    handleResize()
  }, 700)
}

function updateComputeStatus(
  targetCrowd: TargetCrowdInfo | null | undefined,
  status: string,
  _portraitInfoList?: PortraitInfoItem[],
) {
  if (targetCrowd) {
    setTimeout(() => {
      nextTick(() => {
        targetCrowdInfo.value = targetCrowd
      })
    }, 700)
  }
  compute_status.value = status
}

onMounted(() => {
  window.addEventListener('resize', onResize)
  const sidebar = document.getElementsByClassName('sidebar-container')[0]
  sidebar?.addEventListener('transitionend', onSidebarTransitionEnd)
  if (containerRef.value) {
    sortable = new Sortable(containerRef.value, {
      handle: '.handle',
      onStart() {},
      onEnd() {},
    })
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  const sidebar = document.getElementsByClassName('sidebar-container')[0]
  sidebar?.removeEventListener('transitionend', onSidebarTransitionEnd)
  sortable?.destroy()
  sortable = null
  chartInstances.value.forEach((instance) => instance?.dispose())
  chartInstances.value = []
  chartElList.value = []
})

defineExpose({
  initApiList,
  updateComputeStatus,
})
</script>

<template>
  <div ref="containerRef" class="container">
    <div
      v-for="(item, index) in portraitInfoList"
      :id="String(index)"
      :key="index"
      class="blockArea"
      :style="blockAreaStyle"
    >
      <div class="header handle" style="cursor: move">
        <div class="header_left">
          <div v-if="item.type == '标签属性分布'">
            <div class="ectTitle">
              <p style="padding-left: 0" class="ectItem">
                {{ cardViews[index]?.display }}
              </p>
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;的属性分布
            </div>
            <div class="ectTitle">
              <div style="display: flex">
                画像
                <p class="ectItem">目标人群</p>
                中
              </div>
              <span class="ectItem">{{ item.userRate }}%</span>
              <p>拥有</p>

              <span class="ectItem">{{ cardViews[index]?.display }}</span>
              <p>属性;</p>
            </div>
          </div>
          <div v-else>
            <div class="ectTitle">
              在
              <span style="padding: 0 3px; color: #303133">
                {{ cardViews[index]?.dateText }}
              </span>
              完成
              <span style="padding: 0 3px; color: #303133">
                {{ cardViews[index]?.display }}
              </span>
              的行为分布
            </div>
            <div class="ectTitle">
              画像
              <div class="ectItem">目标人群</div>
              <p>中完成</p>
              <span class="ectItem">{{ cardViews[index]?.display }}</span>
              <p>共计</p>
              <div class="ectItem">
                {{ cardViews[index]?.targetCount }}
              </div>
              <p>次</p>
            </div>
          </div>

          <!-- 筛选条件 -->
          <div style="display: flex; padding: 10px 10px 0px 0; position: relative">
            <el-select
              v-model="defaultType"
              :disabled="!targetCrowdInfo.creator"
              placeholder="请选择"
              class="custom_select"
              @change="handleEchartType(index)"
            >
              <el-option
                v-for="chartType in chartTypeList"
                :key="chartType.value"
                :label="chartType.label"
                :value="chartType.value"
              />
            </el-select>
            <el-select
              v-model="item.formula.filters.count"
              :disabled="!targetCrowdInfo.creator"
              placeholder="请选择"
              class="custom_select"
              style="margin-left: 10px"
              @change="handleFirstFewItems($event, item, index)"
            >
              <el-option
                v-for="fewItem in firstFewItemsList"
                :key="fewItem.value"
                :label="fewItem.label"
                :value="fewItem.value"
              />
            </el-select>
            <el-select
              v-model="item.formula.filters.sort"
              :disabled="!targetCrowdInfo.creator"
              placeholder="请选择"
              class="custom_select"
              style="margin-left: 10px; width: 180px"
              @change="handleDescAsc($event, item, index)"
            >
              <el-option
                v-for="targetItem in targetTypeList"
                :key="targetItem.value"
                :label="targetItem.label"
                :value="targetItem.value"
              />
            </el-select>
          </div>
        </div>
        <div class="header_right">
          <span v-if="targetCrowdInfo.creator" class="btnItem" @click="handleDelete(item, index)"
            >删除</span
          >
        </div>
        <div class="time_stamp">
          最后计算时间：
          {{ item.timestamp || "--" }}
        </div>
      </div>

      <div style="width: 100%; position: relative">
        <!-- 合并后的图表内容 -->
        <div
          v-show="
            item.formula.filters.type == 'bar' ||
            item.formula.filters.type == 'table' ||
            item.formula.filters.type == 'pie'
          "
          :id="'mergeCharts' + index"
          :ref="(el) => setChartRef(el, index)"
          style="width: 100%; height: 300px; margin-top: 15px"
        ></div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.sortable-chosen {
  // background-color: #7aa4e0 !important;
}

// .sortable-drag {
//   background-color: #7aa4e0 !important;
// }
// .sortable-ghost {
//   opacity: 0.4;
//   // background-color: #7aa4e0 !important;
//   box-shadow: 10px 0px 12px 0 rgba(0, 0, 0, 0.7);
// }

.el-icon-close {
  margin-left: 5px;
  cursor: pointer;
}

.el-icon-close:hover {
  color: #2c7be5;
}

// v2 是 ::v-deep { ... } 包一层，Vue3 里逐条改成 :deep(...)。
// .el-input--medium 是 element-ui 2 的尺寸类，Element Plus 对应的是 .el-input--default，
// 两个都写上，保证 30px 高度在 v3 里仍然生效。
:deep(.el-input--medium .el-input__inner),
:deep(.el-input--default .el-input__inner) {
  height: 30px;
  line-height: 30px;
}

:deep(::-webkit-scrollbar) {
  height: 8px;
}

:deep(::-webkit-scrollbar-thumb) {
  background-color: #888;
  border-radius: 10px;
}

:deep(::-webkit-scrollbar-thumb:hover) {
  background-color: #555;
}

.custom_select {
  width: 90px;

  :deep(.el-input--medium .el-input__inner),
  :deep(.el-input--default .el-input__inner) {
    height: 30px;
    line-height: 30px;
    font-size: 12px;
  }

  :deep(.el-input__suffix) {
    display: flex;
    align-items: center;
  }

  :deep(.el-input--medium .el-input__icon),
  :deep(.el-input--default .el-input__icon) {
    line-height: 30px;
  }
}

// .anchorPoint:hover {
//   color: #2c7be5 !important;
// }

.anchorPoint {
  display: flex;
  margin-right: 15px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600px;
}

.container {
  padding: 20px;
  box-sizing: border-box;
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;

  .blockArea {
    height: 450px;
    border-radius: 6px;
    border: 1px solid #eeecec;
    margin-bottom: 20px;

    .header {
      position: relative;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #eeecec;

      .header_left {
        width: calc(100% - 100px);
        padding: 10px;
        box-sizing: border-box;
        line-height: 20px;

        .ectTitle {
          color: #8a8989;
          display: flex;
          flex-wrap: wrap;
          font-size: 12px;

          .ectItem {
            padding: 0 3px;
            color: #0c0b0b;
          }
        }
      }

      .header_right {
        width: 200px;
        text-align: right;
        margin-right: 20px;
        margin-top: 10px;

        span {
          font-size: 13px;
          color: #2c7be5;
          cursor: pointer;
        }
      }

      .time_stamp {
        display: flex;
        color: #8a8989;
        font-size: 12px;
        position: absolute;
        right: 20px;
        top: 20px;
      }
    }

    .selectTabs {
      display: flex;
    }
  }
}
</style>
