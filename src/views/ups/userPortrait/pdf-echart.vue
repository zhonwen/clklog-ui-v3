<template>
  <div class="block_online block-main public-hoverItem" style="min-height: 300px; margin: 20px">
    <!-- 列表头部 -->
    <div style="margin: 35px; margin-bottom: 20px">
      <div
        style="
          display: flex;
          justify-content: space-between;
          margin-bottom: 20px;
        "
      >
        <p class="public-firstHead">用户群画像分析</p>
      </div>
      <p class="public-secondHead" style="margin-top: 35px; width: 100px">画像人群</p>
      <!-- 目标对象 -->
      <div class="portrait_block">
        <div class="portrait_block">
          <div class="targer_corwd">
            <div class="inner">
              <div class="targetPerson">目标人群</div>
              <div class="portraitName">目标人群</div>
              <div style="display: flex">
                <p class="portraitNum">{{ targetCountText }}</p>
              </div>
              <div style="display: flex; margin-left: 30px">
                <p>占用全部用户：</p>
                {{ targetRate }}%
              </div>
            </div>
          </div>
        </div>
      </div>
      <!--  对比人群-->
      <div class="portrait_block" v-for="(row, index) in contrastRows" :key="index">
        <div class="targer_corwd">
          <div class="inner">
            <div class="contrastPerson">对比人群</div>
            <div class="portraitName">{{ row.name }}</div>
            <div style="display: flex">
              <p class="portraitNum">{{ row.countText }}</p>
            </div>
            <div style="display: flex; margin-left: 30px">
              <p>占用全部用户：</p>
              {{ row.rate }}%
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 图表 -->
    <div class="block_online block-main public-hoverItem" style="min-height: 400px; margin: 20px">
      <p class="public-firstHead">画像信息</p>
      <div
        style="
          width: 100%;
          display: flex;
          justify-content: right;
          align-items: center;
        "
      ></div>
      <!-- v2 这里还有 ref="example" / ref="scrollContainer" 两个模板 ref，脚本里从未使用，
           且 v-for 上的字符串 ref 在 Vue3 里不再收集成数组，故一并去掉 -->
      <div class="container">
        <!-- v2 的 header 上有 cursor: move 与 sortablejs 的 handle 类名，但 v2 的 initSort() 从未被调用，
             这里按「不可拖拽」降级，仅保留类名与样式 -->
        <div
          class="blockArea"
          :style="contrastCrowdList.length > 0 ? 'width: 100%;' : ' width : 100%'"
          v-for="(row, index) in portraitRows"
          :key="index"
          :id="String(index)"
        >
          <div class="header handle" style="cursor: move">
            <div class="header_left">
              <div v-if="row.item.type == '标签属性分布'">
                <div class="ectTitle">
                  <p style="padding-left: 0" class="ectItem">{{ row.display }}</p>
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;的属性分布
                </div>
                <div class="ectTitle">
                  <div style="display: flex">
                    画像
                    <p class="ectItem">目标人群</p>
                    中
                  </div>
                  <span class="ectItem">{{ row.item.userRate }} %</span>
                  <p>拥有</p>

                  <span class="ectItem">{{ row.display }}</span>
                  <p>属性;</p>
                </div>
              </div>
              <div v-else>
                <div class="ectTitle">
                  在
                  <span style="padding: 0 3px; color: #303133">
                    {{ row.datePicker }}
                  </span>
                  完成
                  <span style="padding: 0 3px; color: #303133">
                    {{ row.display }}
                  </span>
                  的行为分布
                </div>
                <div class="ectTitle">
                  画像
                  <div class="ectItem">目标人群</div>
                  <p>中完成</p>
                  <span class="ectItem">{{ row.display }}</span>
                  <p>共计</p>
                  <div class="ectItem">{{ row.targetCount }}</div>
                  <p>次</p>
                </div>
              </div>

              <!-- 筛选条件 -->
              <div
                style="
                  display: flex;
                  padding: 10px 10px 0px 0;
                  position: relative;
                "
              >
                <el-select
                  :disabled="!targetCrowdInfo.creator"
                  v-model="defaultType"
                  placeholder="请选择"
                  class="custom_select"
                  @change="handleEchartType(index)"
                >
                  <el-option
                    v-for="type in chartTypeList"
                    :key="type.value"
                    :label="type.label"
                    :value="type.value"
                  />
                </el-select>
                <el-select
                  v-model="row.item.formula.filters.count"
                  :disabled="!targetCrowdInfo.creator"
                  placeholder="请选择"
                  class="custom_select"
                  @change="handleFirstFewItems()"
                  style="margin-left: 10px"
                >
                  <el-option
                    v-for="few in firstFewItemsList"
                    :key="few.value"
                    :label="few.label"
                    :value="few.value"
                  />
                </el-select>
                <el-select
                  :disabled="!targetCrowdInfo.creator"
                  v-model="row.item.formula.filters.sort"
                  placeholder="请选择"
                  class="custom_select"
                  style="margin-left: 10px; width: 180px"
                  @change="handleDescAsc()"
                >
                  <el-option
                    v-for="target in targetTypeList"
                    :key="target.value"
                    :label="target.label"
                    :value="target.value"
                  />
                </el-select>
              </div>
            </div>
            <div class="time_stamp">最后计算时间： {{ row.item.timestamp || '--' }}</div>
          </div>
          <!-- 筛选条件 -->
          <div style="width: 100%; position: relative">
            <!-- 合并后的图表内容 -->
            <div
              v-show="defaultType == 'bar'"
              :id="'pdfCharts' + index"
              :ref="(el) => setChartRef(el, index)"
              style="width: 100%; height: 300px; margin-top: 15px"
            ></div>

            <!-- v2 此处还有一段被注释掉的 el-table（切换成表格），迁移时一并保留为注释：
              <div v-show="item.formula.filters.type == 'table'" ...>
                <el-table height="260" ... :data="tableData">...</el-table>
              </div>
            -->
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 用户群画像分析 —— PDF 导出用的离屏渲染页。
 *
 * 父组件 portrait-analyze.vue 把本组件放进 `#contentToConvert`（absolute; top:100%）里，
 * 调 initApiList(...) 灌数据；本组件把图表画完后 emit('allowDownPdf')，
 * 由父组件调 $htmlToPdf('contentToConvert', title) 截图。
 * 本文件不直接调用 html2canvas / jsPDF（v2 亦然）。
 */
import type { ComponentPublicInstance } from 'vue'
import { computed, nextTick, onBeforeUnmount, ref, shallowRef } from 'vue'
import * as echarts from 'echarts'
import type { ECharts, EChartsOption } from 'echarts'
import { copyObj } from '@/utils/copy'
import { chartColorList } from '@/utils/chart-constants'
import { formatDateYMD } from '@/utils/date'

/** 分布里的一项（目标人群 / 对比人群） */
interface DistributionItem {
  name: string
  count: number
  /** v2 在 processData 里把 count 抄一份给 value 供 echarts 用 */
  value?: number
}

/** 一个对比人群的分布 */
interface ContrastChartItem {
  name: string
  distributions?: DistributionItem[]
}

/** 画像信息的指标（formula.measures[0]） */
interface PdfMeasure {
  name?: string
  displayName?: string
  earlistTime?: unknown
  latestTime?: unknown
}

/** 画像信息的筛选条件（三个下拉直接 v-model 到这里） */
interface PdfFilters {
  count?: number
  sort?: string
  type?: string
}

/** 画像信息的规则体 */
interface PdfFormula {
  measures?: PdfMeasure[]
  filters: PdfFilters
}

/** initApiList 收到的原始画像信息（formula 可能是 JSON 字符串） */
interface PdfPortraitInput {
  type?: unknown
  userRate?: unknown
  timestamp?: unknown
  formula?: unknown
  targerChartList?: unknown
  contrastChartlist?: unknown
  [key: string]: unknown
}

/** 规整之后、模板直接用的画像信息 */
interface PdfPortraitItem {
  type: string
  userRate: string
  timestamp: string
  formula: PdfFormula
  /** 字段名沿用 v2 的拼写（targer / chartlist） */
  targerChartList: DistributionItem[]
  contrastChartlist: ContrastChartItem[]
}

/** 对比人群列表项 */
interface ContrastCrowd {
  name?: string
  displayName?: string
  [key: string]: unknown
}

/** 目标人群信息 */
interface TargetCrowdInfo {
  creator?: boolean
  displayName?: string
  [key: string]: unknown
}

/** 人数对比 */
interface ComparisonUser {
  count?: number
  totalUser?: number
  [key: string]: unknown
}

interface ComparisonList {
  targetUser: ComparisonUser
  contrastUser: ComparisonUser[]
}

/** 一条柱状图 series */
interface BarSeries {
  name: string
  type: 'bar'
  data: (DistributionItem | undefined)[]
  barMaxWidth: number
  label: { show: boolean; position: string }
}

const emit = defineEmits<{
  (e: 'allowDownPdf'): void
}>()

const defaultType = ref('bar')
const targetCrowdInfo = ref<TargetCrowdInfo>({})
const chartTypeList = [
  {
    value: 'bar',
    label: '柱状图',
  },
  {
    value: 'table',
    label: '表格',
  },
]
const firstFewItemsList = [
  {
    value: 5,
    label: '前5项',
  },
  {
    value: 10,
    label: '前10项',
  },
  {
    value: 15,
    label: '前15项',
  },
  {
    value: 20,
    label: '前20项',
  },
  {
    value: 30,
    label: '前30项',
  },
  {
    value: 50,
    label: '前50项',
  },
]
const targetTypeList = [
  {
    value: 'count_desc',
    label: '按目标人群的覆盖人数降序',
  },
  {
    value: 'count_asc',
    label: '按目标人群的覆盖人数升序',
  },
  {
    value: 'dimension_asc',
    label: '按纬度值升序',
  },
  {
    value: 'dimension_desc',
    label: '按纬度值降序',
  },
]
const portraitInfoList = ref<PdfPortraitItem[]>([])
/** 对比人群列表 */
const contrastCrowdList = ref<ContrastCrowd[]>([])
const colorList = chartColorList
/** 与 v2 一致：只写不读（v2 里赋值后没有再用） */
const mergeXAxis = ref<string[]>([])
/** 与 v2 一致：只写不读（v2 里赋值后没有再用） */
const portraitOrigin = ref<PdfPortraitInput[]>([])
const comparisonList = ref<ComparisonList>({
  targetUser: {},
  contrastUser: [],
})

// 画像信息是 v-for 出来的「动态数量」图表，useChart 的单 elRef 撑不住，
// 因此这里用 shallowRef 数组 + echarts.init 手动管理，并自行补 resize 监听与 onBeforeUnmount 的 dispose。
const echartsInstances = shallowRef<(ECharts | null)[]>([])
const chartEls = shallowRef<(HTMLDivElement | null)[]>([])

/** v2 用 document.getElementById('pdfCharts' + index) 取容器；v3 改成 ref 数组，id 保持不变 */
function setChartRef(el: Element | ComponentPublicInstance | null, index: number) {
  chartEls.value[index] = el instanceof HTMLDivElement ? el : null
}

/** emit('allowDownPdf') 的延时器，卸载时清理 */
let allowDownPdfTimer: ReturnType<typeof setTimeout> | null = null

/* ---------- 模板用的派生数据（避免模板里重复调用同一个函数） ---------- */

const targetCountText = computed(() => (comparisonList.value.targetUser.count || 0) + '人')
const targetRate = computed(() => allRateFormate(comparisonList.value.targetUser))

const contrastRows = computed(() =>
  contrastCrowdList.value.map((item, index) => {
    const user = comparisonList.value.contrastUser[index]
    return {
      name: item.name ?? '',
      countText: (user?.count || 0) + '人',
      rate: allRateFormate(user),
    }
  }),
)

const portraitRows = computed(() =>
  portraitInfoList.value.map((item) => ({
    item,
    display: filterDisplay(item),
    datePicker: filterDatePicker(item),
    // 与 v2 一致：(item.targerChartList && item.targerChartList[0].count) || 0
    targetCount: item.targerChartList[0]?.count || 0,
  })),
)

/* ---------- 方法 ---------- */

/**
 * 提取相对天数，如果是 '7day' 或 '-7day' 返回数字天数；
 * 如果是纯数字（如时间戳），直接返回 null 或 0（视业务需求）。
 */
function extractDays(relativeDateString: unknown): number | null {
  // 先判断是否为纯数字（时间戳），如果是则直接返回 null
  if (/^\d+$/.test(String(relativeDateString))) {
    return null
  }
  // 匹配 '7day' 或 '-7day' 这种格式
  const match = String(relativeDateString).match(/-?(\d+)day/)
  if (match) {
    return parseInt(match[1] ?? '', 10)
  }
  return null
}

/**
 * moment().subtract(day, 'days').format('YYYY-MM-DD') 的原生等价实现。
 * day 为 null 时 moment 按 0 天处理（Number(null) === 0），这里用 ?? 0 保持一致。
 */
function getDateRange(day: number | null): string {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - (day ?? 0))
  return formatDateYMD(startDate)
}

function filterDatePicker(item: PdfPortraitItem): string {
  // 与 v2 一致：v2 取不到时兜底成 []（在空数组上取属性同样是 undefined）
  const measures = item.formula.measures?.[0]
  const earlistTimeRaw = measures?.earlistTime
  const latestTimeRaw = measures?.latestTime
  if (typeof latestTimeRaw === 'number' && typeof earlistTimeRaw === 'number') {
    // moment(ts * 1000).format('YYYY-MM-DD') 的原生等价实现
    const earlistTime = formatDateYMD(new Date(earlistTimeRaw * 1000))
    const latestTime = formatDateYMD(new Date(latestTimeRaw * 1000))
    // 与 v2 一致（v2 此处逻辑存疑：变量名与拼接顺序是 earlist 在前、latest 在后）
    return earlistTime + '至' + latestTime
  } else {
    if (latestTimeRaw == 'now') {
      const endDate = formatDateYMD(new Date())
      const startDate = getDateRange(extractDays(earlistTimeRaw))
      return `${startDate}至${endDate}`
    } else {
      const startDate = getDateRange(extractDays(earlistTimeRaw))
      const endDate = getDateRange(extractDays(latestTimeRaw))
      return `${startDate}至${endDate}`
    }
  }
}

function allRateFormate(item?: ComparisonUser): string | number {
  if (item && item.count) {
    // 与 v2 一致：totalUser 缺失时结果为 NaN（Number(undefined) === NaN）
    return ((item.count / Number(item.totalUser)) * 100).toFixed(2)
  } else {
    return 0
  }
}

function isJsonString(str: unknown): boolean {
  try {
    JSON.parse(str as string)
    return true // 如果没有抛出异常，说明是有效的 JSON 字符串
  } catch {
    return false // 如果抛出异常，说明不是有效的 JSON 字符串
  }
}

/** 文本字段规整：v2 直接把后端值丢进模板，这里统一成字符串，取不到时为空串 */
function toText(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : ''
}

/** formula 规整：v2 是 `if (item.formula && isJsonString(item.formula)) item.formula = JSON.parse(...)` */
function toFormula(value: unknown): PdfFormula {
  const parsed: unknown =
    value && typeof value === 'string' && isJsonString(value) ? JSON.parse(value) : value
  if (parsed && typeof parsed === 'object') {
    const formula = parsed as PdfFormula
    // 与 v2 一致（v2 此处逻辑存疑：v2 模板直接取 formula.filters.count，filters 缺失会整页报错，
    // 这里补一个空对象兜底，保证三个下拉的 v-model 绑得住）
    return { ...formula, filters: formula.filters ?? {} }
  }
  return { filters: {} }
}

function toDistributions(value: unknown): DistributionItem[] {
  return Array.isArray(value) ? (value as DistributionItem[]) : []
}

function toContrastChartList(value: unknown): ContrastChartItem[] {
  return Array.isArray(value) ? (value as ContrastChartItem[]) : []
}

/** 对外契约：父组件 portrait-analyze.vue 通过 ref 调用 */
function initApiList(
  data: PdfPortraitInput[],
  contrastList: ContrastCrowd[],
  targetCrowd: TargetCrowdInfo,
  comparison: ComparisonList,
) {
  comparisonList.value = comparison
  contrastCrowdList.value = contrastList
  targetCrowdInfo.value = targetCrowd
  // 合并图表名称
  mergeXAxis.value = [
    toText(targetCrowd.displayName),
    ...contrastList.map((item) => toText(item.displayName)),
  ]
  portraitOrigin.value = data
  portraitInfoList.value = copyObj(data).map((item) => ({
    type: toText(item.type),
    userRate: toText(item.userRate),
    timestamp: toText(item.timestamp),
    formula: toFormula(item.formula),
    targerChartList: toDistributions(item.targerChartList),
    contrastChartlist: toContrastChartList(item.contrastChartlist),
  }))
  // v2 用 map 做纯遍历，这里换成 forEach，行为一致
  portraitInfoList.value.forEach((item, index) => {
    const series_list = processData(item.targerChartList, item.contrastChartlist)
    const xAxisList = item.targerChartList.map((chart) => chart.name)
    const unit = series_list.map((serie) => serie.name)
    drawDevice(index, series_list, xAxisList, unit)
  })
  // 与 v2 完全一致：数据灌完 3.5s 后通知父组件可以截图导出 PDF
  if (allowDownPdfTimer) clearTimeout(allowDownPdfTimer)
  allowDownPdfTimer = setTimeout(() => {
    emit('allowDownPdf')
  }, 3500)
}

function processData(targetList: DistributionItem[], contrastList: ContrastChartItem[]): BarSeries[] {
  const targetNames: string[] = []
  const mappedTargetList = targetList.map((item) => {
    item.value = item.count
    targetNames.push(item.name)
    return item
  })
  // 创建目标人群数据
  const newArray: BarSeries[] = [
    {
      name: '目标人群',
      type: 'bar',
      data: mappedTargetList,
      barMaxWidth: 100,
      label: {
        show: true,
        position: 'top',
      },
    },
  ]

  // 创建对比视图数据
  contrastList.forEach((contrast) => {
    const filteredData = targetNames.map((name) => {
      // 与 v2 一致（v2 此处逻辑存疑：find 的回调里顺带给扫描到的项赋 value，
      // 排在命中项之后的分布项拿不到 value）
      const item = (contrast.distributions ?? []).find((distribution) => {
        distribution.value = distribution.count
        return distribution.name === name
      })
      return item
    })

    newArray.push({
      name: contrast.name,
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
function drawDevice(index: number, series: BarSeries[], xAxisList: string[], unit: string[]) {
  const setEndValue = 30
  nextTick(() => {
    const el = chartEls.value[index]
    if (!el) return
    const myChart = echarts.init(el)
    // 与 v2 一致：series[0].data 超过 30 项才给 dataZoom 加 show
    const showDataZoom = (series[0]?.data.length ?? 0) > setEndValue
    const option = {
      legend: {
        show: true,
        data: unit,
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow', // 确保 tooltip 显示的是柱状图
        },
      },
      xAxis: {
        type: 'category',
        data: xAxisList,
        axisLabel: {
          interval: 0,
        },
      },
      yAxis: {
        type: 'value',
      },
      dataZoom: [
        {
          type: 'inside',
          startValue: 0,
          endValue: 20,
          minValueSpan: 10,
          zoomOnMouseWheel: false,
          moveOnMouseWheel: true,
          moveOnMouseMove: true,
          ...(showDataZoom ? { show: true } : {}),
        },
      ],

      series: series,
      color: colorList,
    }
    // series 的 data 上带 count 等业务字段、inside 型 dataZoom 上的 show 都不在 echarts 的类型定义里，
    // 配置本身与 v2 逐字一致，这里只做一次类型断言
    myChart.setOption(option as unknown as EChartsOption)
    echartsInstances.value[index] = myChart
    // 同一个函数引用重复 addEventListener 不会重复注册，与 v2 行为一致
    window.addEventListener('resize', handleResize)
  })
}

function filterDisplay(item: PdfPortraitItem): string {
  const measure = item.formula.measures?.[0]
  if (item.type == '标签属性分布') {
    return toText(measure?.displayName)
  } else {
    return toText(measure?.name)
  }
}

// 与 v2 一致（v2 此处逻辑存疑：模板传的是 (index, $event, item)，而 v2 方法签名写的是
// (index, item, $event)，形参对不上，方法体里也只用到 index，这里只保留 index）
function handleEchartType(index: number) {
  nextTick(() => {
    const instance = echartsInstances.value[index]
    if (instance && instance.resize) {
      instance.resize()
    }
    // v2 这里还会 resize contrastInstances，但该数组在 v2 中从未被写入，迁移时略去
  })
}

// 与 v2 一致（v2 此处逻辑存疑：模板上绑了 handleFirstFewItems / handleDescAsc，
// 但 v2 的 methods 里并没有定义这两个方法，触发 change 会直接报错。
// PDF 页的下拉在非 creator 时是禁用的，这里按空实现迁移，保持「点了不出错」）
function handleFirstFewItems() {}
function handleDescAsc() {}

// ****** end ******
function handleResize() {
  echartsInstances.value.forEach((item) => {
    if (item) {
      item.resize()
    }
  })
}
// ***** end  *****

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  if (allowDownPdfTimer) {
    clearTimeout(allowDownPdfTimer)
    allowDownPdfTimer = null
  }
  // 手动 init 的图表，自己负责销毁
  echartsInstances.value.forEach((item) => {
    item?.dispose()
  })
  echartsInstances.value = []
  chartEls.value = []
})

defineExpose({
  initApiList,
})
</script>

<style lang="scss" scoped>
// .sortable-chosen {
//   background-color: #7aa4e0 !important;
// }
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

:deep(.el-input--medium .el-input__inner) {
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

  :deep(.el-input--medium .el-input__inner) {
    height: 30px;
    line-height: 30px;
    font-size: 12px;
  }

  :deep(.el-input__suffix) {
    display: flex;
    align-items: center;
  }

  :deep(.el-input--medium .el-input__icon) {
    line-height: 30px;
  }
}

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

.portrait_block {
  display: flex;
  align-items: center;
  margin-top: 20px;
  width: 100%;

  .targer_corwd {
    width: 80%;
    min-height: 40px;
    border: 1px solid #e8e8e9;

    border-radius: 2px;
    box-sizing: border-box;
    display: flex;
    align-items: center;

    .inner {
      position: relative;
      display: flex;
      padding: 0 10px;
      height: 25px;
      line-height: 25px;
      color: #4d4d4d;
      font-size: 12px;
      width: 100%;

      .targetPerson {
        height: 25px;
        padding: 0 3px;
        color: #2c7be5;
        border-radius: 2px;
        background: #a6c9f7;
      }

      .contrastPerson {
        height: 25px;
        padding: 0 3px;
        color: #168126;
        border-radius: 2px;
        background: #d2f8d8;
      }

      .portraitName {
        margin: 0 10px;
        width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        font-size: 14px;
        white-space: nowrap;
      }

      .portraitNum {
        padding: 0 2px;
        border-bottom: 1px solid #2c7be5;
        cursor: pointer;
      }

      .portraitNum:hover {
        color: #2c7be5;
      }
    }
  }

  .zc_btn {
    margin-left: 20px;
  }
}
</style>
