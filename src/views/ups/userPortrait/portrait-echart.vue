<template>
  <div ref="containerRef" class="container">
    <div
      class="blockArea"
      :style="blockAreaStyle"
      v-for="(item, index) in portraitInfoList"
      :key="index"
    >
      <div class="header handle" style="cursor: move">
        <div class="header_left">
          <div v-if="item.type == '标签属性分布'">
            <div class="ectTitle">
              <p style="padding-left: 0" class="ectItem">
                {{ displayNameList[index] }}
              </p>
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;的属性分布
            </div>
            <div class="ectTitle">
              <div style="display: flex">
                画像
                <p class="ectItem">目标人群</p>
                中
              </div>
              <span class="ectItem">{{ item.userRate ? item.userRate + '%' : '--' }}</span>
              <p>拥有</p>

              <span class="ectItem">{{ displayNameList[index] }}</span>
              <p>属性;</p>
            </div>
          </div>
          <div v-else>
            <div class="ectTitle">
              在
              <span style="padding: 0 3px; color: #303133">
                {{ datePickerTextList[index] }}
              </span>
              完成
              <span style="padding: 0 3px; color: #303133">
                {{ displayNameList[index] }}
              </span>
              的行为分布
            </div>
            <div class="ectTitle">
              画像
              <div class="ectItem">目标人群</div>
              <p>中完成</p>
              <span class="ectItem">{{ displayNameList[index] }}</span>
              <p>共计</p>
              <div class="ectItem">
                {{ (item.targerChartList && item.targerChartList[0] && item.targerChartList[0].count) || 0 }}
              </div>
              <p>次</p>
            </div>
          </div>

          <!-- 筛选条件 -->
          <div style="display: flex; padding: 10px 10px 0px 0; position: relative">
            <el-select
              :disabled="!targetCrowdInfo.creator"
              v-model="item.formula.filters.type"
              placeholder="请选择"
              class="custom_select"
              @change="handleEchartType(index, $event, item)"
            >
              <el-option
                v-for="typeItem in chartTypeList"
                :key="typeItem.value"
                :label="typeItem.label"
                :value="typeItem.value"
              />
            </el-select>
            <el-select
              v-model="item.formula.filters.count"
              :disabled="!targetCrowdInfo.creator"
              placeholder="请选择"
              class="custom_select"
              @change="handleFirstFewItems(item, index)"
              style="margin-left: 10px"
            >
              <el-option
                v-for="countItem in firstFewItemsList"
                :key="countItem.value"
                :label="countItem.label"
                :value="countItem.value"
              />
            </el-select>
            <el-select
              :disabled="!targetCrowdInfo.creator"
              v-model="item.formula.filters.sort"
              placeholder="请选择"
              class="custom_select"
              style="margin-left: 10px; width: 180px"
              @change="handleDescAsc(item, index)"
            >
              <el-option
                v-for="sortItem in targetTypeList"
                :key="sortItem.value"
                :label="sortItem.label"
                :value="sortItem.value"
              />
            </el-select>
          </div>
        </div>
        <div>
          <div class="header_right" v-if="targetCrowdInfo.creator">
            <span
              v-if="!targetCrowdInfo.lastExecuteStartTime"
              @click="handleEdite(item)"
              style="margin-right: 15px"
              >编辑</span
            >
            <span class="deleteBtn" @click="handleDelete(item, index)">删除</span>
          </div>
          <div v-if="item.timestamp" class="time_stamp">
            最后计算时间：
            {{ item.timestamp || '--' }}
          </div>
        </div>
      </div>
      <!-- 条件筛选 -->
      <div
        v-if="hasContrast"
        style="height: 50px; position: relative; display: flex; align-items: center"
      >
        <div
          style="
            font-size: 14px;
            color: #2c7be5;
            margin-left: 15px;
            position: absolute;
            width: 45%;
            padding-bottom: 10px;
            box-sizing: border-box;
            border-bottom: 2.4px solid #e9edf3;
          "
        >
          目标人群
        </div>
        <!-- 对比-锚点定位 -->
        <div
          v-if="hasContrast"
          style="
            position: absolute;
            display: flex;
            top: 0px;
            left: 48%;
            width: 50%;
            padding-bottom: 0px;
            z-index: 999;
          "
        >
          <el-tabs
            style="width: 100%"
            v-model="item.lightUpName"
            @tab-click="handleClick($event, item)"
          >
            <el-tab-pane
              v-for="(contrastItem, contrastIdx) in contrastList"
              :key="contrastIdx"
              :name="contrastItem.name"
              :label="contrastItem.name"
            >
            </el-tab-pane>
          </el-tabs>
        </div>
      </div>
      <div v-else style="width: 100%; height: 40px"></div>

      <!-- 图表渲染规则 -->
      <div style="display: flex; overflow: auto; width: 100%; position: relative">
        <div v-if="showStatusInfo" :style="chartAreaStyle" class="distribute_status">
          <div class="info">
            <p>{{ compute_status }}</p>
          </div>
        </div>
        <div v-if="isComputeSuccess" style="display: flex" :style="chartAreaImportantStyle">
          <!-- v2 还写了 element-loading-spinner="el-icon-loading"，element-plus 的
               loading 指令不再认这种字符串图标类名，去掉后走默认转圈 -->
          <div
            v-loading="loadingFlag"
            element-loading-text="加载中"
            v-show="item.formula.filters.type == 'bar'"
            :id="item.id + '_targerChart' + index"
            style="height: 300px; flex: 1; width: 100%"
            :style="chartAreaImportantStyle"
          ></div>
          <!-- 环形图 pie -->
          <div
            v-show="item.formula.filters.type == 'pie'"
            :id="item.id + '_targerChartPie' + index"
            style="height: 300px; flex: 1"
            :style="chartAreaStyle"
          ></div>
          <!-- table -->
          <div v-show="item.formula.filters.type == 'table'" style="width: 100%">
            <el-table
              height="260"
              :header-cell-style="{ textAlign: 'center', background: '#f7fafe  ' }"
              :cell-style="{ textAlign: 'center' }"
              border
              class="public-radius"
              :data="item.targerChartList"
              style="width: 90%; margin-left: 5%; margin-top: 10px"
            >
              <el-table-column prop="name" label="画像人群">
                {{ targetCrowdInfo.displayName }}
              </el-table-column>
              <el-table-column prop="name" :label="displayNameList[index]"> </el-table-column>

              <el-table-column prop="count" label="用户数"> </el-table-column>
              <el-table-column label="用户占比">
                <template #default="{ row }">
                  {{ handleTablePercent(row) }}
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>

        <!-- has contrast event  -->
        <div
          v-if="hasContrast"
          style="display: flex; overflow-x: auto; width: 52%; white-space: nowrap"
        >
          <div
            v-for="(contrastItem, contrastIdx) in contrastList"
            :key="contrastIdx"
            style="min-width: 100%; position: relative"
          >
            <div
              v-if="showStatusInfo"
              style="height: 300px; width: 100%"
              class="distribute_status"
            >
              <div class="info">
                <p>{{ compute_status }}</p>
              </div>
            </div>
            <div v-if="isComputeSuccess">
              <!-- 对比-柱状图 -->
              <div
                v-loading="loadingFlag"
                element-loading-text="加载中"
                v-show="item.formula.filters.type === 'bar'"
                :id="item.id + '_contrastChart' + contrastIdx"
                :ref="(el) => setContrastSectionRef(el, item.id + '_contrastChart' + contrastIdx, 0)"
                style="height: 300px; flex: 1; width: 100%"
              ></div>
              <!-- 对比-饼状图 -->
              <div
                v-show="item.formula.filters.type == 'pie' && isComputeSuccess"
                :id="item.id + '_contrastChartPie' + contrastIdx"
                :ref="(el) => setContrastSectionRef(el, item.id + '_contrastChart' + contrastIdx, 1)"
                style="height: 300px; flex: 1; width: 100%"
              ></div>
              <!-- 切换为table表格 -->
              <div
                v-show="item.formula.filters.type === 'table' && isComputeSuccess"
                style="height: 300px; flex: 1; width: 100%"
                :ref="(el) => setContrastSectionRef(el, item.id + '_contrastChart' + contrastIdx, 2)"
              >
                <el-table
                  height="260"
                  :header-cell-style="{ textAlign: 'center', background: '#f7fafe  ' }"
                  :cell-style="{ textAlign: 'center' }"
                  border
                  class="public-radius"
                  :data="contrastTableData(item, contrastIdx)"
                  style="width: 90%; margin-left: 5%; margin-top: 10px"
                >
                  <el-table-column prop="name" label="画像人群">
                    {{ '画像对比人群' + (contrastIdx + 1) }}
                  </el-table-column>
                  <el-table-column prop="name" :label="displayNameList[index]"> </el-table-column>

                  <el-table-column prop="count" label="用户数"> </el-table-column>
                  <el-table-column label="用户占比">
                    <template #default="{ row }">
                      {{ handleTablePercent(row) }}
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 群画像 - 画像信息图表区（v2 views/ups/userPortrait/portrait-echart.vue）。
 *
 * 图表为什么不用 useChart：
 * 本文件的图表数量完全动态 —— 外层 v-for 画像信息（portraitInfoList），
 * 内层再 v-for 对比人群（contrastList），每一格还分 bar / pie 两个 dom，
 * 数量随接口数据变化。useChart 的单 elRef 只能管一个固定图表，撑不住这种动态列表，
 * 所以这里用 shallowRef 数组 + echarts.init 手动管理，并自己补上
 * useChart 内置的那套 resize 监听与卸载 dispose（见 onMounted / onBeforeUnmount）。
 *
 * v2 里被整段注释掉的「用户行为分析-区间设置」el-popover 未随迁，
 * 它依赖的 handelRandio / closePopover / intervalBlur / addDevideEvent / deleteInterval
 * 等方法也一并省略（v2 中只被注释掉的模板引用，属于死代码），需要时回 v2 源文件取。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { useRoute } from 'vue-router'
import Sortable from 'sortablejs'
import { ElMessage } from 'element-plus'
import type { TabsPaneContext } from 'element-plus'
import * as echarts from 'echarts'
import type { BarSeriesOption, ECharts, EChartsOption } from 'echarts'
import { deleteportrait, getDistribution } from '@/api/upsapi/groupportrait'
import { chartColorList } from '@/utils/chart-constants'
import { copyObj } from '@/utils/copy'
import { formatDateHMS, formatDateYMD } from '@/utils/date'
import { queryToString } from '@/utils/index'
import { useLatestOnly } from '@/composables/useLatestOnly'
import { useTrackingStore } from '@/stores/tracking'
import type { GropPortraitInfo, PortraitInfoItem, PortraitRow, PortraitRuleItem } from './types'

/** 分布里的一项（图表的一根柱 / 一块扇形） */
interface DistributionItem {
  name: string
  count: number
  totalUser?: number | null
  totalTagged?: number | null
  /** 环形图用：v2 直接把 count 挂到 value 上 */
  value?: number
  [key: string]: unknown
}

/** getDistribution 返回的一组人群分布 */
interface DistributionGroup {
  name: string
  count: number
  timestamp?: string | number
  totalUser?: number | null
  totalTagged?: number | null
  distributions: DistributionItem[]
}

/** 图表筛选条（图表类型 / 前几项 / 排序） */
interface ChartFilters {
  type: string
  count: number | string
  sort: string
}

/** 画像信息里的一条指标 */
interface ChartMeasure {
  name?: string
  displayName?: string
  earlistTime?: string | number
  latestTime?: string | number
  [key: string]: unknown
}

/** 画像信息的公式体（入参时可能是 JSON 字符串，解析后是对象） */
interface ChartFormula {
  filters: ChartFilters
  measures?: ChartMeasure[]
  [key: string]: unknown
}

/** 本组件渲染的一块「画像信息」 */
interface EchartPortraitItem {
  id: string
  /** 标签属性分布 / 用户行为分布 */
  type?: string
  formula: ChartFormula
  /** 目标人群的分布数据 */
  targerChartList: DistributionItem[]
  /** 对比人群的分布数据（v2 拼写 contrastChartlist，照迁） */
  contrastChartlist: DistributionGroup[]
  lightUpName?: string
  timestamp?: string | number
  rate?: string
  userRate?: string
  [key: string]: unknown
}

/** 对比人群 */
interface ContrastCrowdItem {
  name: string
  [key: string]: unknown
}

/** 目标人群（群画像本体），比列表行多一个计算状态 */
interface TargetCrowdInfo extends PortraitRow {
  lastExecuteStatus?: string
}

/** update_portrait_list 的第一个入参：id 是新增/编辑的画像信息 id 列表 */
interface UpdatePortraitObject {
  id?: string[]
  type?: string
}

/** 排序参数 */
interface SortParam {
  property: string
  direction: string
}

type ChartSeries = EChartsOption['series']

const emit = defineEmits<{
  editPortraitInfo: [item: EchartPortraitItem, status?: string]
  handleComputeStatus: [status: string]
  clearPortraitInfo: []
  openMergeEcharts: [val?: unknown]
}>()

const route = useRoute()
const trackingStore = useTrackingStore()

const openDistribution = ref(false)
const loadingFlag = ref(true)
const compute_status = ref('待计算')
const targetCrowdInfo = ref<TargetCrowdInfo>({})
const tableDataList = ref<DistributionItem[]>([])
const portraitInfoList = ref<EchartPortraitItem[]>([])
const contrastList = ref<ContrastCrowdItem[]>([])
const colorList = chartColorList

const chartTypeList = [
  { value: 'bar', label: '柱状图' },
  { value: 'table', label: '表格' },
  { value: 'pie', label: '环形图' },
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

// **** echarts 实例：动态数量，手动管理（对应 v2 的四个 *_reset 数组）****
const targer_chart_reset = shallowRef<(ECharts | null)[]>([]) // 目标图表重置
const contrast_chart_reset = shallowRef<(ECharts | null)[]>([]) // 对比下-resize bar
const targer_pieChart_reset = shallowRef<(ECharts | null)[]>([]) // 目标图表重置
const contrastInstances_pie = shallowRef<(ECharts | null)[]>([]) // 对比下-resize pie

/** 组件内起的定时器，卸载时统一清掉 */
const timers = new Set<number>()
function addTimer(handler: () => void, delay: number) {
  const id = window.setTimeout(() => {
    timers.delete(id)
    handler()
  }, delay)
  timers.add(id)
}

// **** 取数：每个取数函数一套 useLatestOnly ****
const latestSort = useLatestOnly()
const latestUpdateList = useLatestOnly()
const latestStatement = useLatestOnly()
const latestDelete = useLatestOnly()

const projectName = computed(
  () => queryToString(route.query.projectName) || trackingStore.projectName,
)

const hasContrast = computed(() => contrastList.value.length > 0)
const showStatusInfo = computed(
  () =>
    compute_status.value == '待计算' ||
    compute_status.value == '计算失败' ||
    compute_status.value == '计算中',
)
const isComputeSuccess = computed(() => compute_status.value == '计算成功')

// v2 是字符串 :style，这里换成对象（值完全一致）
const blockAreaStyle = computed(() =>
  hasContrast.value ? { width: '100%' } : { width: 'calc(50% - 10px)' },
)
const chartAreaStyle = computed(() =>
  hasContrast.value ? { width: 'calc(50% - 10px)' } : { width: '100%' },
)
const chartAreaImportantStyle = computed(() =>
  hasContrast.value ? { width: 'calc(50% - 10px)!important' } : { width: '100%!important' },
)

// 模板里同一个函数会被调多次，提成 computed（对应 v2 的 filterDisplay / filterDatePicker）
const displayNameList = computed(() => portraitInfoList.value.map((item) => filterDisplay(item)))
// 与 v2 一致：filterDatePicker 只在「非标签属性分布」那一支才会被调用
const datePickerTextList = computed(() =>
  portraitInfoList.value.map((item) => (item.type == '标签属性分布' ? '' : filterDatePicker(item))),
)

watch(targetCrowdInfo, (newValue) => {
  if (!newValue.lastExecuteEndTime && !newValue.lastExecuteStatus) {
    compute_status.value = '待计算'
  } else if (newValue.lastExecuteStartTime && !newValue.lastExecuteStatus) {
    compute_status.value = '计算中'
  } else if (newValue.lastExecuteStatus == '计算成功') {
    compute_status.value = '计算成功'
    openDistribution.value = true
    void nextTick(() => {
      addTimer(() => {
        void statementStart('bar')
      }, 800)
    })
  } else if (newValue.lastExecuteStatus == '计算失败') {
    compute_status.value = '计算失败'
  }
  emit('handleComputeStatus', compute_status.value)
})

function loadingEvent(result: boolean) {
  if (result) disposeEcharts()
  loadingFlag.value = result
}

/**
 * 时间戳 / ISO 字符串归一成 'YYYY-MM-DD HH:mm:ss'，其余原样返回。
 * v2 用 moment（v3 无此依赖）：
 *   moment(parseInt(item)).format('YYYY-MM-DD HH:mm:ss')  → formatDateHMS(毫秒时间戳)
 *   moment(item, 'YYYY-MM-DD HH:mm:ss', true).isValid() || moment(item, moment.ISO_8601, true).isValid()
 *     → 下面两个正则严格匹配后再交给 Date 校验
 */
const DATE_TIME_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/
const ISO_8601_RE = /^\d{4}(-\d{2}(-\d{2})?)?([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/

/** 13 位纯数字 = 毫秒时间戳（与 v2 的判断条件逐条一致） */
function isMsTimestamp(value: unknown): boolean {
  return (
    value != null &&
    value !== '' &&
    !isNaN(Number(value)) &&
    String(value).length === 13 &&
    /^\d+$/.test(String(value))
  )
}

/** 严格解析成日期字符串（等价 moment 的 strict isValid） */
function isDateLikeString(value: unknown): boolean {
  if (typeof value !== 'string') return false
  if (!DATE_TIME_RE.test(value) && !ISO_8601_RE.test(value)) return false
  return !isNaN(new Date(value.replace(' ', 'T')).getTime())
}

function normalizeTimeLabel(value: string): string {
  if (isMsTimestamp(value)) {
    return formatDateHMS(parseInt(value))
  } else if (isDateLikeString(value)) {
    return formatDateHMS(new Date(value.replace(' ', 'T')).getTime())
  }
  return value
}

function filterDatePicker(item: EchartPortraitItem): string {
  const measures = item.formula.measures?.[0]

  const pdValue = typeof measures?.latestTime === 'number' && typeof measures?.earlistTime === 'number'
  if (pdValue && measures) {
    const earlistTime = formatDateYMD(new Date(Number(measures.earlistTime) * 1000))
    const latestTime = formatDateYMD(new Date(Number(measures.latestTime) * 1000))

    return earlistTime + '至' + latestTime
  } else {
    if (measures?.latestTime == 'now') {
      // v2 是 moment().format('YYYY-MM-DD')
      const endDate = formatDateYMD(new Date())
      const startDate = getDateRange(extractDays(measures?.earlistTime))
      return `${startDate}至${endDate}`
    } else {
      const startDate = getDateRange(extractDays(measures?.earlistTime))
      const endDate = getDateRange(extractDays(measures?.latestTime))
      return `${startDate}至${endDate}`
    }
  }
}

/** v2 是 moment().subtract(day,'days').format('YYYY-MM-DD')；day 为 null 时 moment 当 0 天处理 */
function getDateRange(day: number | null): string {
  const date = new Date()
  date.setDate(date.getDate() - (day || 0))
  return formatDateYMD(date)
}

/**
 * 提取相对天数，如果是 '7day' 或 '-7day' 返回数字天数；
 * 如果是纯数字（如时间戳），直接返回 null 或 0（视业务需求）。
 */
function extractDays(relativeDateString: string | number | undefined): number | null {
  // 先判断是否为纯数字（时间戳），如果是则直接返回 null
  if (/^\d+$/.test(String(relativeDateString))) {
    return null
  }
  // 匹配 '7day' 或 '-7day' 这种格式
  const match = String(relativeDateString).match(/-?(\d+)day/)
  if (match && match[1]) {
    return parseInt(match[1], 10)
  }
  return null
}

function handleTablePercent(row: DistributionItem): string {
  if (!row.totalTagged) return '0.00%'
  const userRate = (((row.count || 0) / (row.totalTagged || 0)) * 100).toFixed(2)
  return userRate + '%'
}

/** 对比人群表格的数据（v2 是模板里的三元表达式） */
function contrastTableData(item: EchartPortraitItem, contrastIdx: number): DistributionItem[] {
  if (item.contrastChartlist && item.contrastChartlist.length > 0) {
    return item.contrastChartlist[contrastIdx]?.distributions || tableDataList.value
  }
  return tableDataList.value
}

function copyPortraitList() {
  disposeEcharts()
  compute_status.value = '待计算'
  openDistribution.value = false
}

function disposeEcharts() {
  targer_chart_reset.value.map((item) => {
    if (item) item.dispose()
  })
  contrast_chart_reset.value.map((item) => {
    if (item) item.dispose()
  })
  targer_pieChart_reset.value.map((item) => {
    if (item) item.dispose()
  })
  contrastInstances_pie.value.map((item) => {
    if (item) item.dispose()
  })
}

// 前几项
function handleFirstFewItems(item: EchartPortraitItem, index: number) {
  commonSortItem(item, index)
}
// 升降序
function handleDescAsc(item: EchartPortraitItem, index: number) {
  commonSortItem(item, index)
}

function commonSortItem(item: EchartPortraitItem, index: number) {
  const type = item.formula.filters.type
  const sortItem = item.formula.filters.sort
  const sort: SortParam[] = [
    {
      property: sortItem.split('_')[0] || 'count',
      direction: sortItem.split('_')[1] || 'desc',
    },
  ]
  const takes = item.formula.filters.count || '10'
  const token = latestSort.next()
  void getDistribution({
    id: item.id,
    takes: takes,
    sort: sort,
    projectName: projectName.value,
  }).then((res) => {
    if (!latestSort.isLatest(token)) return
    item.contrastChartlist = []
    const originList = getOriginList()
    // ******** 参数1：原始数据，参数2：对比数据 *******
    const dataList = processList(originList, res?.data as DistributionGroup[] | undefined)
    dataList.forEach((subItem) => {
      if (subItem.name == getTargetName()) {
        item.targerChartList = subItem.distributions
        const userRate = subItem.totalUser
          ? ((subItem.count / subItem.totalUser) * 100).toFixed(2)
          : '0.00'

        item.rate = userRate
      } else {
        item.contrastChartlist.push(subItem)
      }
    })

    const xAxisList: string[] = []
    const dailyData: number[] = [] // value
    item.targerChartList.forEach((chartItem) => {
      xAxisList.push(chartItem['name'])
      dailyData.push(chartItem.count)
    })
    if (type == 'bar') {
      const series = echartsTypeOptions(xAxisList, dailyData, 'bar')
      void nextTick(() => {
        drawDevice_bar(index, series, xAxisList, item)
        if (hasContrast.value) {
          void contrastGroupInit('bar', item.contrastChartlist, index, item)
        }
      })
    } else if (type == 'table') {
      portraitInfoList.value = portraitInfoList.value.map((subItem) => {
        subItem.userRate = subItem.rate
        return subItem
      })
    } else {
      void statementStart(type, index, item)
      if (hasContrast.value) {
        // v2 这里第二个参数传的是空字符串，pie 分支不读它
        void contrastGroupInit(type, undefined, index, item)
      }
    }
  })
}

function updateComputeStatus(
  targetCrowd: TargetCrowdInfo | '',
  status: string,
  // v2 第三个参数（portraitInfoList）传进来但没用到，保留形参以对齐调用方
  _portraitInfoList?: PortraitInfoItem[],
) {
  if (targetCrowd) {
    addTimer(() => {
      void nextTick(() => {
        targetCrowdInfo.value = targetCrowd
      })
    }, 700)
  }
  compute_status.value = status
}

function getTargetName(index?: number): string {
  try {
    const raw = localStorage.getItem('gropPortraitInfo')
    const portraitInfo = raw ? (JSON.parse(raw) as Partial<GropPortraitInfo>) : {}
    if (portraitInfo.formula && portraitInfo.formula.length > 0) {
      return portraitInfo.formula[index ? index : 0]?.name || ''
    }
  } catch {
    /* ignore */
  }
  return ''
}

function handleDelete(item: EchartPortraitItem, index: number) {
  const token = latestDelete.next()
  void deleteportrait({ id: item.id, projectName: projectName.value }).then((res) => {
    if (!latestDelete.isLatest(token)) return
    if (res?.code != 200) return
    ElMessage.success('删除成功')
    portraitInfoList.value.splice(index, 1)
    if (portraitInfoList.value.length == 0) {
      emit('clearPortraitInfo')
    }
    if (openDistribution.value) {
      for (const [idx, subItem] of portraitInfoList.value.entries()) {
        const dailyData: number[] = []
        const xAxisList: string[] = []
        subItem.targerChartList.forEach((chartItem) => {
          xAxisList.push(chartItem['name'])
          dailyData.push(chartItem.count)
        })

        const series = echartsTypeOptions(xAxisList, dailyData, 'bar')
        void nextTick(() => {
          drawDevice_bar(idx, series, xAxisList, subItem)
          if (hasContrast.value) {
            void contrastGroupInit('bar', subItem.contrastChartlist, idx, subItem)
          }
        })
      }
    }
  })
}

async function update_portrait_list(
  object: UpdatePortraitObject,
  portraitList: PortraitInfoItem[],
  contrastCrowdList: ContrastCrowdItem[],
  targetCrowd: TargetCrowdInfo,
) {
  contrastList.value = contrastCrowdList || []
  targetCrowdInfo.value = targetCrowd || {}
  const addPortraitList = (object && object.id) || []
  // 与 v2 一致：直接在父组件传进来的对象上改（不复制）
  const matchedItems = ((portraitList || []) as unknown as EchartPortraitItem[]).filter((item) =>
    addPortraitList.includes(item.id),
  )
  const updatedPortraitInfoList: EchartPortraitItem[] = []

  const token = latestUpdateList.next()
  for (const item of matchedItems) {
    item.contrastChartlist = []
    item.targerChartList = []
    item.lightUpName = getTargetName(1)
    try {
      const rawFormula = item.formula as unknown
      item.formula =
        typeof rawFormula === 'string' ? (JSON.parse(rawFormula) as ChartFormula) : item.formula
    } catch {
      item.formula = item.formula || ({} as ChartFormula)
    }
    updatedPortraitInfoList.push(item)
    // 如果计算完成 在调用信息分布接口
    if (openDistribution.value) {
      // Adding timeout
      try {
        const response = await fetchWithTimeout(
          getDistribution({
            id: item.id,
            takes: 10,
            sort: [
              {
                property: 'count',
                direction: 'desc',
              },
            ],
            projectName: projectName.value,
          }),
        )
        if (!latestUpdateList.isLatest(token)) return
        if (response) {
          const originList = getOriginList()
          // ******** 参数1：原始数据，参数2：对比数据 *******
          const dataList = processList(originList, response.data as DistributionGroup[] | undefined)
          for (const subItem of dataList) {
            if (subItem.name === getTargetName()) {
              item.targerChartList = subItem.distributions
              item.timestamp = dataList[0]?.timestamp
              const userRate = subItem.totalUser
                ? ((subItem.count / subItem.totalUser) * 100).toFixed(2)
                : '0.00'
              item.userRate = userRate
            } else {
              item.contrastChartlist.push(subItem)
            }
          }
        }
      } catch {
        /* 与 v2 一致：超时 / 异常都吞掉，继续下一个 */
      }
    }
  }
  if (!latestUpdateList.isLatest(token)) return

  // distinguish edit or add status
  if (object.type == 'edit') {
    const edited = updatedPortraitInfoList[0]
    if (edited) {
      const editId = edited.id
      portraitInfoList.value = portraitInfoList.value.map((item) => {
        if (item.id == editId) {
          return edited
        }
        return item
      })
    }
    ElMessage.success('修改成功')
  } else {
    updatedPortraitInfoList.map((item) => {
      portraitInfoList.value.push(item)
    })
    ElMessage.success('添加成功')
  }
  if (openDistribution.value) {
    for (const [index, item] of portraitInfoList.value.entries()) {
      const dailyData: number[] = []
      const xAxisList: string[] = []
      item.targerChartList.forEach((chartItem) => {
        xAxisList.push(chartItem['name'])
        dailyData.push(chartItem.count)
      })

      const series = echartsTypeOptions(xAxisList, dailyData, 'bar')
      void nextTick(() => {
        drawDevice_bar(index, series, xAxisList, item)

        if (hasContrast.value) {
          void contrastGroupInit('bar', item.contrastChartlist, index, item)
        }
      })
    }
  }
}

async function contrastGroupInit(
  chartType: string,
  contrastChartlist: DistributionGroup[] | undefined,
  index: number,
  item: EchartPortraitItem,
) {
  if (chartType == 'bar') {
    ;(contrastChartlist || []).forEach((contrastItem, contrastIdx) => {
      const { distributions } = contrastItem
      const { valueList, xaxisList } = distributions.reduce<{
        valueList: number[]
        xaxisList: string[]
      }>(
        (acc, abc) => {
          acc.valueList.push(abc.count)
          acc.xaxisList.push(abc.name)
          return acc
        },
        { valueList: [], xaxisList: [] },
      )
      const series = echartsTypeOptions(xaxisList, valueList, chartType)
      contrastDrawDevice_bar(contrastIdx, series, xaxisList, item)
    })
  } else if (chartType == 'pie') {
    portraitInfoList.value[index]?.contrastChartlist.forEach((contrastItem, contrastIdx) => {
      const series = echartsTypeOptions([], contrastItem, chartType, true)
      contrastDrawDevice_pie(contrastIdx, series, item)
    })
  }
}

function getOriginList(): PortraitRuleItem[] {
  try {
    const raw = localStorage.getItem('gropPortraitInfo')
    const portraitInfo = raw ? (JSON.parse(raw) as Partial<GropPortraitInfo>) : null
    return (portraitInfo && portraitInfo.formula) || []
  } catch {
    return []
  }
}

function initApiList(
  data: PortraitInfoItem[],
  contrastCrowdList: ContrastCrowdItem[],
  targetCrowd: TargetCrowdInfo,
) {
  contrastList.value = contrastCrowdList || []
  targetCrowdInfo.value = targetCrowd || {}
  portraitInfoList.value = (copyObj(data) as unknown as EchartPortraitItem[]) || []
  portraitInfoList.value.map((item) => {
    item.lightUpName = (contrastList.value.length > 0 && contrastList.value[0]?.name) || ''
    const rawFormula = item.formula as unknown
    if (rawFormula && typeof rawFormula === 'string' && isJsonString(rawFormula)) {
      item.formula = JSON.parse(rawFormula) as ChartFormula
    }
    // 与 v2 一致：不是 JSON 字符串时原样保留
  })
  // **** 新增 目标人群-画像信息事件
  targer_chart_reset.value = []
  contrast_chart_reset.value = []
  targer_pieChart_reset.value = []
  contrastInstances_pie.value = []
}

/**
 * 对比图表区的 dom 收集。
 * v2 是动态字符串 ref（:ref="item.id + '_contrastChart' + contrastIdx"），Vue3 不支持，
 * 改成回调 ref 收进 Map：同一个 refName 下依次是 [bar, pie, table] 三个容器，
 * 下标含义与 v2 的 this.$refs[refName][0/1/2] 完全一致。
 */
const contrastSectionRefs = new Map<string, (Element | null)[]>()
function setContrastSectionRef(
  el: Element | ComponentPublicInstance | null,
  refName: string,
  slot: number,
) {
  const list = contrastSectionRefs.get(refName) ?? [null, null, null]
  list[slot] = el as Element | null
  contrastSectionRefs.set(refName, list)
}

function handleClick(pane: TabsPaneContext, item: EchartPortraitItem) {
  const refName = item.id + '_contrastChart' + pane.index
  const contrastItem = {
    displayName: pane.props.label || '',
  }
  scrollToSection(refName, item.formula.filters.type, contrastItem, item)
}

function scrollToSection(
  refName: string,
  type: string,
  contrastItem: { displayName: string },
  item: EchartPortraitItem,
) {
  item.lightUpName = contrastItem.displayName
  const element = contrastSectionRefs.get(refName)
  if (!element) return
  const target = type === 'bar' ? element[0] : type === 'pie' ? element[1] : element[2]
  target?.scrollIntoView({
    behavior: 'auto', // auto smooth
    block: 'nearest',
    inline: 'start',
  })
}

// 切换图表
function handleEchartType(index: number, event: string, item: EchartPortraitItem) {
  void nextTick(() => {
    if (event == 'bar') {
      updateEcharts()
    } else if (event == 'pie') {
      void statementStart(event, index, item)
      if (hasContrast.value) {
        // v2 这里第二个参数传的是空字符串，pie 分支不读它
        void contrastGroupInit(event, undefined, index, item)
      }
    }
  })
}

function updateEcharts() {
  addTimer(() => {
    handleResize()
  }, 1000)
}

function withTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out')), timeout),
    ),
  ])
}

/** v2 update_portrait_list 里内联的同名函数（默认 5 秒超时） */
function fetchWithTimeout<T>(promise: Promise<T>, timeout = 5000): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Request timed out')), timeout),
  )
  return Promise.race([promise, timeoutPromise])
}

function processList(
  originList: PortraitRuleItem[],
  compareList: DistributionGroup[] | undefined,
): DistributionGroup[] {
  let handledCompareList = compareList || []
  let templateDistributions: DistributionItem[] = []
  if (
    contrastList.value &&
    contrastList.value.length > 0 &&
    handledCompareList &&
    handledCompareList.length > 0
  ) {
    const targetName = getTargetName()
    const targetItem = handledCompareList.find((item) => item.name === targetName)
    // 如果能找到目标人群数据，就以目标人群的分布顺序为基准
    // 否则（异常情况）退化到以第一个数据的分布顺序为基准
    const baseItem = targetItem || handledCompareList[0]
    const baseDistributions = baseItem?.distributions || []

    // 构建空对象模板
    if (baseDistributions.length > 0) {
      templateDistributions = baseDistributions.map((item) => {
        return {
          name: item.name,
          count: 0,
          totalUser: null,
          totalTagged: 0,
        }
      })
    }

    const orderMap: Record<string, number> = {}
    baseDistributions.forEach((item, index) => {
      orderMap[item.name] = index
    })
    handledCompareList = handledCompareList.map((groupItem) => {
      if (!Array.isArray(groupItem.distributions)) {
        return groupItem
      }
      const inOrder: DistributionItem[] = []
      const others: DistributionItem[] = []
      groupItem.distributions.forEach((dist) => {
        const orderIndex = Object.prototype.hasOwnProperty.call(orderMap, dist.name)
          ? orderMap[dist.name]
          : null
        if (orderIndex !== null && orderIndex !== undefined) {
          inOrder[orderIndex] = dist
        } else {
          others.push(dist)
        }
      })
      const orderedDistributions = inOrder.filter(Boolean).concat(others)
      return {
        ...groupItem,
        distributions: orderedDistributions,
      }
    })
  }
  const result: DistributionGroup[] = []
  originList.forEach((compareItem) => {
    const originItem = handledCompareList.find((item) => item.name === compareItem.name)
    if (originItem) {
      result.push(originItem)
    } else {
      result.push({
        name: compareItem.name,
        count: 0,
        timestamp: '',
        totalUser: 0,
        totalTagged: 0,
        // v2 是 _.cloneDeep，v3 无 lodash，用 @/utils/copy 的 copyObj
        distributions: copyObj(templateDistributions),
      })
    }
  })
  return result
}

async function statementStart(type: string, idx_ls?: number, item?: EchartPortraitItem) {
  if (type == 'bar') {
    if (openDistribution.value) {
      const token = latestStatement.next()
      for (const [index, subItem] of portraitInfoList.value.entries()) {
        // 与 v2 一致（v2 此处是 item.targerChartList = ""，未匹配到目标人群时
        // 后面的 .forEach 会抛错、被 catch 吞掉并 continue；这里用 matched 标记等价实现）
        subItem.targerChartList = []
        subItem.contrastChartlist = []
        let matched = false
        try {
          const res = await withTimeout(
            getDistribution({
              id: subItem.id,
              takes: 10,
              sort: [
                {
                  property: 'count',
                  direction: 'desc',
                },
              ],
              projectName: projectName.value,
            }),
            5000,
          )
          if (!latestStatement.isLatest(token)) return
          if (res?.data) {
            const originList = getOriginList()
            // ******** 参数1：原始数据，参数2：对比数据 *******
            const dataList = processList(originList, res.data as DistributionGroup[] | undefined)
            dataList.forEach((groupItem) => {
              if (groupItem.name == getTargetName()) {
                matched = true
                subItem.targerChartList = groupItem.distributions
                subItem.timestamp = dataList[0]?.timestamp
                const userRate = groupItem.totalUser
                  ? ((groupItem.count / groupItem.totalUser) * 100).toFixed(2)
                  : '0.00'
                subItem.rate = userRate
              } else {
                subItem.contrastChartlist.push(groupItem)
              }
            })
            if (!matched) continue

            const xAxisList: string[] = []
            const dailyData: number[] = []
            subItem.targerChartList.forEach((chartItem) => {
              xAxisList.push(chartItem['name'])
              dailyData.push(chartItem.count)
            })

            const series = echartsTypeOptions(xAxisList, dailyData, type)
            void nextTick(() => {
              drawDevice_bar(index, series, xAxisList, subItem)
              if (hasContrast.value) {
                void contrastGroupInit('bar', subItem.contrastChartlist, index, subItem)
              }
            })
          }
        } catch {
          // 可以选择跳过当前项或记录错误日志
          continue // 跳过当前循环迭代
        }
      }

      portraitInfoList.value = portraitInfoList.value.map((subItem) => {
        subItem.userRate = subItem.rate
        return subItem
      })
      loadingFlag.value = false
    }
  } else if (type == 'pie') {
    if (idx_ls !== undefined && item) {
      const target = portraitInfoList.value[idx_ls]
      if (target) {
        const series = echartsTypeOptions([], target, type)
        drawDevice_pie(idx_ls, series, item)
      }
    }
  }
  emit('openMergeEcharts')
}

function echartsTypeOptions(
  xAxisList: string[],
  dailyData: number[] | EchartPortraitItem | DistributionGroup,
  type: string,
  isCompare?: boolean,
): ChartSeries {
  if (type == 'bar') {
    const values = Array.isArray(dailyData) ? dailyData : []
    const series: BarSeriesOption[] = values.map((data, index) => {
      return {
        name: xAxisList[index], // 对应图例项
        type: 'bar',
        barMaxWidth: 60,
        data: Array(xAxisList.length)
          .fill(0)
          .map((_, i) => (i === index ? data : null)), // 只展示对应日期的柱状图
        stack: 'total',
        label: {
          show: true,
          position: 'top',
        },
        // v2 是 itemStyle.normal.color，echarts 5+ 去掉了 normal 这层
        itemStyle: {
          color: index < 14 ? colorList[index] : colorList[index % 14],
        },
      }
    })
    return series
  } else if (type == 'pie') {
    let dataList: DistributionItem[] = []
    if (isCompare) {
      const group = dailyData as DistributionGroup
      dataList = group.distributions.map((item) => {
        item.value = item.count
        return item
      })
    } else {
      const info = dailyData as EchartPortraitItem
      dataList = info.targerChartList.map((item) => {
        item.value = item.count
        return item
      })
    }

    const series = [
      {
        type: 'pie',
        radius: ['40%', '60%'],
        avoidLabelOverlap: true,
        label: {
          show: true,
          position: 'outside',
          fontSize: 12,
          color: '#3E3F40',
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
          },
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)',
          },
        },
        labelLine: {
          show: true,
          length: 15,
        },
        data: dataList,
        color: colorList,
      },
    ]
    // echarts 的 PieSeriesOption 里既没有 color（调色板）也不认 data 上的业务字段，
    // 但 v2 的图表配置一个字都不能改，这里显式断言一次把类型对上（不是 any）
    return series as unknown as ChartSeries
  }
  return undefined
}

/**
 * 两个柱状图的 yAxis 配置在 v2 里是两份一模一样的字面量，这里提成工厂函数（每次返回新对象）。
 * 配置逐字照迁：nameTextStyle.italic 并不是 echarts 的字段（而且 yAxis 没设 name，
 * 这段本身就不渲染），类型上用一次断言对齐（不是 any）。
 */
function buildBarYAxis(): EChartsOption['yAxis'] {
  return [
    {
      type: 'value',
      axisTick: {
        show: false,
        alignWithLabel: true,
      },
      nameTextStyle: {
        color: '#2c7be5',
        fontSize: 13,
        fontWeight: 'bold',
        italic: true,
      },
      position: 'left',
      axisLabel: {
        formatter: '{value}',
      },
    },
  ] as unknown as EChartsOption['yAxis']
}

/**
 * 取（或新建）dom 上的 echarts 实例。
 * v2 是每次都 echarts.init（echarts 检测到已有实例会打告警并返回原实例），
 * 这里显式 getInstanceByDom，行为一致但不打告警。
 */
function initChartOn(el: HTMLElement | null): ECharts | null {
  if (!el) return null
  return echarts.getInstanceByDom(el) || echarts.init(el)
}

/** x 轴（指标）名称：行为分布取 name，属性分布取 displayName */
function measureAxisName(item: EchartPortraitItem): string {
  if (item && item.type == '用户行为分布') {
    return item.formula.measures?.[0]?.name || ''
  }
  return item.formula.measures?.[0]?.displayName || ''
}

/** tooltip 里的 seriesName 归一（v2 的 moment 判断） */
function tooltipSeriesName(rawName: unknown): string {
  let seriesName = (rawName as string) || '--'
  if (isMsTimestamp(seriesName)) {
    seriesName = formatDateHMS(parseInt(String(seriesName)))
  }
  return seriesName
}

// 柱状图
function drawDevice_bar(
  index: number,
  series: ChartSeries,
  xAxisList: string[],
  item: EchartPortraitItem,
) {
  const xAxis_name = measureAxisName(item)
  const formattedData = xAxisList.map((value) => normalizeTimeLabel(value))
  // 基于准备好的dom，初始化echarts实例
  void nextTick(() => {
    const myChart = initChartOn(document.getElementById(item.id + '_targerChart' + index))
    if (!myChart) return
    const option: EChartsOption = {
      legend: {
        type: 'scroll',
        pageButtonItemGap: 20,
        pageButtonPosition: 'end',
        scrollDataIndex: 0,
        padding: [0, 35],
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
          const params = (Array.isArray(rawParams) ? rawParams : [rawParams]) as Array<{
            seriesName?: string
            color?: string
            value?: number | string | null
          }>
          let res = ''

          for (let i = 0; i < params.length; i++) {
            const param = params[i]
            const seriesName = tooltipSeriesName(param?.seriesName)

            if (i == 0) {
              res += '<div>目标人群</div>'
            }
            if (param?.value) {
              res +=
                "<div style='display:flex;align-items:center;'>" +
                ` <div style=' width: 10px; height: 10px; border-radius: 50%;background-color: ${param.color};'>
                  </div>` +
                "<div style='margin-left:3px;'>" +
                formatSeriesTooltipLabel(xAxis_name, seriesName, param.value) +
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
          axisLabel: {
            interval: 0, // 强制文字产生间隔
            rotate: 25, // 旋转角度
            overflow: 'truncate', // 超出显示省略号
            formatter: function (value: string) {
              if (value) {
                return value.length > 10 ? value.substring(0, 10) + '...' : value
              }
              // v2 这里没有 return（等价于空标签）
              return ''
            },
          },
          axisLine: {
            onZero: false,
          },
          axisTick: {
            show: false,
            alignWithLabel: false,
          },
        },
      ],
      yAxis: buildBarYAxis(),
      dataZoom: [
        {
          type: 'inside',
          startValue: 0,
          endValue: 25,
          minValueSpan: 10,
          zoomOnMouseWheel: false,
          moveOnMouseWheel: true,
          moveOnMouseMove: true,
        },
      ],
      series: series,
    }
    myChart.setOption(option, true)
    targer_chart_reset.value[index] = myChart
  })
}

function contrastDrawDevice_bar(
  contrastIdx: number,
  series: ChartSeries,
  xAxisList: string[],
  item: EchartPortraitItem,
) {
  const xAxis_name = measureAxisName(item)
  const formattedData = xAxisList.map((value) => normalizeTimeLabel(value))
  const contrast_bar_chart = initChartOn(
    document.getElementById(item.id + '_contrastChart' + contrastIdx),
  )
  if (!contrast_bar_chart) return
  const option: EChartsOption = {
    legend: {
      type: 'scroll',
      pageButtonItemGap: 20,
      pageButtonPosition: 'end',
      scrollDataIndex: 0,
      padding: [0, 35],
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
        const params = (Array.isArray(rawParams) ? rawParams : [rawParams]) as Array<{
          seriesName?: string
          color?: string
          value?: number | string | null
        }>
        let res = ''
        for (let i = 0; i < params.length; i++) {
          const param = params[i]
          const seriesName = tooltipSeriesName(param?.seriesName)
          if (i == 0) {
            res += '<div>' + (item.lightUpName || '--') + '</div>'
          }
          if (param?.value) {
            res +=
              "<div style='display:flex;align-items:center;'>" +
              ` <div style=' width: 10px; height: 10px; border-radius: 50%;background-color: ${param.color};'>
                  </div>` +
              "<div style='margin-left:3px;'>" +
              formatSeriesTooltipLabel(xAxis_name, seriesName, param.value) +
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
        boundaryGap: true,
        axisLine: {
          onZero: false,
        },
        axisTick: {
          show: false,
          alignWithLabel: true,
        },
        // 与 v2 一致：v2 这里写了两个 axisLabel，后一个覆盖前一个（生效的是 interval 0 + rotate 25），
        // rotate 的字符串 '25' 在 echarts 5+ 要用数字
        axisLabel: {
          interval: 0,
          rotate: 25,
        },
      },
    ],
    yAxis: buildBarYAxis(),
    dataZoom: [
      {
        type: 'inside',
        startValue: 0,
        endValue: 15,
        minValueSpan: 10,
        zoomOnMouseWheel: false,
        moveOnMouseWheel: true,
        moveOnMouseMove: true,
      },
    ],
    series: series,
  }
  contrast_bar_chart.setOption(option, true)
  contrast_chart_reset.value.push(contrast_bar_chart)
}

// 环形图
function drawDevice_pie(index: number, series: ChartSeries, item: EchartPortraitItem) {
  const xAxis_name = measureAxisName(item)
  const pie_chart = initChartOn(document.getElementById(item.id + '_targerChartPie' + index))
  if (!pie_chart) return
  const option: EChartsOption = {
    tooltip: {
      trigger: 'item',
      axisPointer: {
        type: 'cross',
        lineStyle: {
          color: '#C0CADB',
          width: 1,
        },
      },
      formatter: function (rawParams: unknown) {
        const param = rawParams as {
          data?: { name?: string }
          color?: string
          value?: number | string | null
        }
        let res = ''
        const seriesName = tooltipSeriesName(param.data?.name)
        res += `<div>目标人群</div>`
        res += `
          <div style='display:flex;align-items:center;'>
            <div style='width: 10px; height: 10px; border-radius: 50%; background-color: ${param.color};'></div>
            <div style='margin-left:3px;'>
              ${formatSeriesTooltipLabel(xAxis_name, seriesName, param.value)}
            </div>
          </div>
        `
        return res
      },
    },
    legend: {
      orient: 'vertical',
      right: '5%',
      type: 'scroll',
      height: '94%',
      itemHeight: 14,
    },
    series: series,
  }
  pie_chart.setOption(option, true)
  targer_pieChart_reset.value[index] = pie_chart
}

function contrastDrawDevice_pie(index: number, series: ChartSeries, item: EchartPortraitItem) {
  const xAxis_name = measureAxisName(item)
  const contrast_pie_chart = initChartOn(
    document.getElementById(item.id + '_contrastChartPie' + index),
  )
  if (!contrast_pie_chart) return
  const option: EChartsOption = {
    tooltip: {
      trigger: 'item',
      axisPointer: {
        type: 'cross',
        lineStyle: {
          color: '#C0CADB',
          width: 1,
        },
      },
      formatter: function (rawParams: unknown) {
        const param = rawParams as {
          data?: { name?: string }
          color?: string
          value?: number | string | null
        }
        let res = ''
        const seriesName = tooltipSeriesName(param.data?.name)
        res += `<div>${item.lightUpName || '--'}</div>`
        res += `
          <div style='display:flex;align-items:center;'>
            <div style='width: 10px; height: 10px; border-radius: 50%; background-color: ${param.color};'></div>
            <div style='margin-left:3px;'>
              ${formatSeriesTooltipLabel(xAxis_name, seriesName, param.value)}
            </div>
          </div>
        `
        return res
      },
    },
    legend: {
      orient: 'vertical',
      right: '5%',
      type: 'scroll',
      height: '94%',
      itemHeight: 14,
    },
    series: series, // 确保 series 变量在此上下文中已定义
  }
  contrast_pie_chart.setOption(option, true)
  contrastInstances_pie.value.push(contrast_pie_chart)
}

function isJsonString(str: string): boolean {
  try {
    JSON.parse(str)
    return true // 如果没有抛出异常，说明是有效的 JSON 字符串
  } catch {
    return false // 如果抛出异常，说明不是有效的 JSON 字符串
  }
}

function formatSeriesTooltipLabel(
  measureName: string,
  categoryName: string,
  value: number | string | null | undefined,
): string {
  const safeMeasureName = measureName || '--'
  const safeCategoryName = categoryName || '--'
  const safeValue = value === undefined || value === null ? '--' : value
  return `${safeMeasureName}为【${safeCategoryName || ''}】的总人数：${safeValue}`
}

// 是否拥有对比事件
function filterDisplay(item: EchartPortraitItem): string {
  const measures = item && item.formula && item.formula.measures
  if (!measures || !measures.length || !measures[0]) {
    return ''
  }
  if (item.type == '标签属性分布') {
    return measures[0].displayName || ''
  } else {
    return measures[0].name || ''
  }
}

function handleResize() {
  targer_chart_reset.value.map((item) => {
    if (item) item.resize()
  })
  contrast_chart_reset.value.map((item) => {
    if (item) item.resize()
  })
  targer_pieChart_reset.value.map((item) => {
    if (item) item.resize()
  })
  contrastInstances_pie.value.map((item) => {
    if (item) item.resize()
  })
}

function handleEdite(item: EchartPortraitItem) {
  const newItem = copyObj(item)
  emit('editPortraitInfo', newItem)
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

onMounted(() => {
  // v2 在每个 drawDevice_* 里都挂一次 resize（同一个 handler 会被去重），这里统一挂一次
  window.addEventListener('resize', handleResize)
  if (containerRef.value) {
    sortable = new Sortable(containerRef.value, {
      handle: '.handle',
      onStart() {},
      onEnd() {},
    })
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  sortable?.destroy()
  sortable = null
  timers.forEach((id) => window.clearTimeout(id))
  timers.clear()
  // useChart 内置的卸载 dispose，这里手动补上
  disposeEcharts()
})

defineExpose({
  copyPortraitList,
  loadingEvent,
  updateComputeStatus,
  update_portrait_list,
  initApiList,
  updateEcharts,
  // v2 父组件是 this.$refs.portraitEchartRef._data.portraitInfoList 直接读的，必须暴露
  portraitInfoList,
})
</script>

<style lang="scss" scoped>
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
  }

  :deep(.el-input__suffix) {
    display: flex;
    align-items: center;
  }

  :deep(.el-input--medium .el-input__icon) {
    line-height: 30px;
  }

  :deep(.el-input--medium .el-input__inner) {
    font-size: 12px;
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

  .distribute_status {
    display: flex;
    justify-content: center;
    height: 300px;
    align-items: center;
    font-size: 15px;

    .info {
      height: 230px;
      width: 500px;

      border-radius: 6px;
      display: flex;
      justify-content: center;
      align-items: center;
      background: #eaf2fc;

      p {
        font-size: 20px;
        color: #4d4d4d;
        font-weight: 600;
        line-height: 40px;
      }
    }
  }

  .blockArea {
    height: 450px;
    border-radius: 6px;
    border: 1px solid #eeecec;
    margin-bottom: 20px;

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: relative;
      border-bottom: 1px solid #eeecec;

      .header_left {
        width: calc(100% - 200px);
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
        color: #8a8989;
        display: flex;
        font-size: 12px;
        position: absolute;
        right: 20px;
        top: 20px;
      }
    }
  }
}
</style>
