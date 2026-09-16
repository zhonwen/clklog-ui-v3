<script setup lang="ts">
/**
 * 受访页面下钻弹窗（v2 views/visitor-analysis/custom-dialog/visited.vue）。
 *
 * 弹窗内的筛选条用 @/layout/components 的 dialogBar（对应 v2 filterBar/dialogBar.vue）。
 *
 * ⚠️ v2 变量名冲突（原样保留）：
 * v2 的 data 里 pv / uv / ipCount / exitCount / exitRate 被声明了两次 ——
 * 前一半当「表格列是否显示」的布尔开关，后一半当「折线图的数据数组」，
 * 对象字面量后者覆盖前者，所以初值是 []（真值）。
 * 运行时 flowPoint() 会把它们写成布尔，filterEvent() 又会写回数组，
 * 结果是：每次刷新图表之后，这几列会重新变成「一定显示」。
 * v3 原样复刻这个行为（类型写成 boolean | number[]），没有顺手修。
 *
 * v2 里还有一段 fetchDataVApi / mapContainerEvent（城市地图），但本组件既没 import provinceCode，
 * 模板里也没有 #areaCityMap 容器，任何调用都会直接抛错 —— 是从 regional.vue 复制过来的死代码，v3 未迁。
 */
import { computed, nextTick, ref, watch } from 'vue'
import type { CSSProperties } from 'vue'
import type { EChartsOption } from 'echarts'
import contrastFlow from '@/components/contrastFlow/index.vue'
import { dialogBar } from '@/layout/components'
import { copyObj } from '@/utils/copy'
import { useChart } from '@/composables/useChart'
import { useLatestOnly } from '@/composables/useLatestOnly'
import { useSettingsStore } from '@/stores/settings'
import { useTrackingStore } from '@/stores/tracking'
import { getVisitOneUriTotalApi, getVisitOneUriTrendApi } from '@/api/trackingapi/visituri'

interface TrendRow {
  statTime?: string
  pv?: number
  uv?: number
  visitCount?: number
  ipCount?: number
  entryCount?: number
  downPvCount?: number
  exitCount?: number
  avgVisitTime?: number
  exitRate?: number
  [key: string]: unknown
}

/**
 * 复刻 v2 src/filters/index.js 的 formatTime 过滤器
 * （比 @/utils/format 的同名函数多一步 Math.floor，falsy 返回 '--'）。
 */
function formatTimeFilter(seconds: unknown): string {
  if (seconds) {
    const total = Math.floor(Number(seconds))
    const hours = Math.floor(total / 3600)
    const minutes = Math.floor((total - hours * 3600) / 60)
    const rest = total - hours * 3600 - minutes * 60
    const pad = (n: number) => (n < 10 ? `0${n}` : String(n))
    return `${pad(hours)}:${pad(minutes)}:${pad(rest)}`
  }
  return '--'
}

/** 复刻 v2 src/filters/index.js 的 percenTable 过滤器（falsy 返回 0，不是 '--'） */
function percenTableFilter(s: unknown): string | number {
  if (s == 1) return '100%'
  if (s) return (Number(s) * 100).toFixed(2) + '%'
  return 0
}

type CheckboxGroupValue = (string | number)[]

const trackingStore = useTrackingStore()
const settingsStore = useSettingsStore()

const { elRef: countLineRef, init: initCountLine, setOption: setCountLineOption } = useChart()
const { next: nextTotal, isLatest: isLatestTotal } = useLatestOnly()
const { next: nextTrend, isLatest: isLatestTrend } = useLatestOnly()

const originViewRef = ref<{
  originEvent: (val: unknown, flag?: number | boolean | null) => void
} | null>(null)
const dialogBarRef = ref<{
  dialogbarEvent: (commonParams: Record<string, unknown>) => void
  clearEvent: () => void
} | null>(null)

// 与 v2 一致：v2 在 watch 里写了 flagApi，但整个组件都没有读过它
const flagApi = ref<string | null>(null)
const channelList = ref<CheckboxGroupValue>(['index', 'uri', 'uv', 'ipCount', 'pv', 'title'])
const flowQuality = ref<CheckboxGroupValue>(['entryCount', 'avgVisitTime'])
const vistedTableData = ref<TrendRow[]>([])

// 见文件顶部注释：这几个既是列开关又是图表数据
const uri = ref(false)
const uv = ref<boolean | number[]>([])
const pv = ref<boolean | number[]>([])
const ipCount = ref<boolean | number[]>([])
const exitCount = ref<boolean | number[]>([])
const exitRate = ref<boolean | number[]>([])
const avgVisitTime = ref(false)
const entryCount = ref(false)
const downPvCount = ref(false)
const visitCount = ref<number[]>([])

const mergedArr = ref<string[]>([])

const currentPage = ref(1)
const total = ref(0)
const pageSize = ref(10)

const current = ref<{ sortName: string | null; sortOrder: string | null }>({
  sortName: '',
  sortOrder: '',
})

const centerDialogVisible = ref(false)
const scopeRowData = ref<{ uri?: string; title?: string }>({})
const dateFlag = ref<number | null>(null)
const filterBarParams = ref<Record<string, unknown>>({})
const headLege = ref<CheckboxGroupValue>(['访问次数', '访客数'])
const options = [
  { value: '浏览量', label: '浏览量', disabled: false },
  { value: '访客数', label: '访客数', disabled: false },
  { value: '访问次数', label: '访问次数', disabled: false },
  { value: 'IP数', label: 'IP数', disabled: false },
  { value: '退出页', label: '退出页', disabled: false },
]
const trenListChart = ref<TrendRow[]>([])
const statTime = ref<(string | undefined)[]>([])

const commonParams = computed(() => ({
  projectName: trackingStore.projectName,
  ...filterBarParams.value,
}))

// 模板里不重复调用 slice，预算成 computed
const pagedVistedTableData = computed(() =>
  vistedTableData.value.slice(
    (currentPage.value - 1) * pageSize.value,
    currentPage.value * pageSize.value,
  ),
)

function flowPointEvent(val: string[]) {
  if (val.length > 0) {
    pv.value = val.includes('pv')
    uri.value = val.includes('uri')
    uv.value = val.includes('uv')
    ipCount.value = val.includes('ipCount')
    exitCount.value = val.includes('exitCount')
    avgVisitTime.value = val.includes('avgVisitTime')
    exitRate.value = val.includes('exitRate')
    downPvCount.value = val.includes('downPvCount')
    entryCount.value = val.includes('entryCount')
  }
}

function initShowTable() {
  mergedArr.value = []
  mergedArr.value = [...channelList.value, ...flowQuality.value].map(String)
  flowPointEvent(mergedArr.value)
}

function handelChannelList() {
  initShowTable()
}

function handelFlowQuality() {
  initShowTable()
}

function initCurrentPage() {
  currentPage.value = 1
}

function countLineEcharts() {
  const colors = settingsStore.cologStyle
  const option: EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        lineStyle: {
          color: '#C0CADB',
          width: 2,
        },
      },
    },
    // v2 是 legend: { x: 'center', y: 'top' }，echarts 5+ 换成 left/top
    legend: {
      left: 'center',
      top: 'top',
      data: headLege.value.map(String),
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
        endValue: 24,
        minValueSpan: 10,
        zoomOnMouseWheel: false,
        moveOnMouseWheel: true,
        moveOnMouseMove: true,
      },
    ],

    xAxis: {
      type: 'category',
      // 接口可能给出缺失项，echarts 6 的类型不接受 undefined，空值按空串渲染（与 v2 表现一致）
      data: statTime.value.map((v) => v ?? ''),
      axisTick: {
        show: false,
      },
      axisLabel: {
        interval: 0,
        // v2 写的是字符串 '45'，echarts 5+ 要求数字
        rotate: 45,
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
        name: '浏览量',
        type: 'line',
        // v2 是 itemStyle.normal.color，echarts 5+ 去掉了 normal 这层
        itemStyle: { color: colors.$pv },
        lineStyle: { width: 3 },
        data: Array.isArray(pv.value) ? pv.value : [],
      },
      {
        name: '访客数',
        type: 'line',
        itemStyle: { color: colors.$uv },
        lineStyle: { width: 3 },
        data: Array.isArray(uv.value) ? uv.value : [],
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
        data: Array.isArray(ipCount.value) ? ipCount.value : [],
      },
      {
        name: '退出页',
        type: 'line',
        // 与 v2 一致（v2 此处逻辑存疑：store 的 cologStyle 里根本没有 $exitCount 这个键，
        // v2 取到的也是 undefined，退出页这条线走 echarts 默认配色）
        itemStyle: { color: undefined },
        lineStyle: { width: 3 },
        data: Array.isArray(exitCount.value) ? exitCount.value : [],
      },
    ],
  }
  setCountLineOption(option, true)
}

function filterEvent() {
  const pvList: number[] = []
  const uvList: number[] = []
  const visitCountList: number[] = []
  const ipCountList: number[] = []
  const exitCountList: number[] = []
  const statTimeList: (string | undefined)[] = []
  for (let i = 0; i < trenListChart.value.length; i++) {
    const row = trenListChart.value[i]
    if (!row) continue
    for (let j = 0; j < headLege.value.length; j++) {
      const key = headLege.value[j]
      if (key == '访问次数') {
        visitCountList.push(row.visitCount as number)
      }
      if (key == '浏览量') {
        pvList.push(row.pv as number)
      }
      if (key == '访客数') {
        uvList.push(row.uv as number)
      }
      if (key == 'IP数') {
        ipCountList.push(row.ipCount as number)
      }
      if (key == '退出页') {
        exitCountList.push(row.exitCount as number)
      }
    }
    statTimeList.push(row.statTime)
  }
  pv.value = pvList
  uv.value = uvList
  visitCount.value = visitCountList
  ipCount.value = ipCountList
  exitCount.value = exitCountList
  statTime.value = statTimeList
  if (vistedTableData.value.length > 1) {
    void nextTick(() => {
      // el-dialog 内容懒渲染，容器出现之后再 init
      initCountLine()
      countLineEcharts()
    })
  }
}

// 趋势接口
function getCityTrend() {
  const params = copyObj(commonParams.value) as Record<string, unknown>
  params.uri = scopeRowData.value.uri
  params.title = scopeRowData.value.title
  const token = nextTrend()
  getVisitOneUriTrendApi(params)
    .then((res) => {
      if (!isLatestTrend(token)) return
      if (res?.code != 200) return
      trenListChart.value = (res.data as TrendRow[]) || []
      // 表格数据
      vistedTableData.value = copyObj((res.data as TrendRow[]) || [])

      total.value = vistedTableData.value.length || 0
      filterEvent()
    })
    .catch(() => {
      /* 报错已由请求层统一提示 */
    })
}

function totalApiEvent() {
  const params = copyObj(commonParams.value) as Record<string, unknown>
  params.uri = scopeRowData.value.uri
  params.title = scopeRowData.value.title
  const token = nextTotal()
  getVisitOneUriTotalApi(params)
    .then((res) => {
      if (!isLatestTotal(token)) return
      if (res?.code != 200) return
      void nextTick(() => {
        originViewRef.value?.originEvent(res.data, dateFlag.value)
      })
      getCityTrend()
    })
    .catch(() => {
      /* 报错已由请求层统一提示 */
    })
}

// 多选事件
function handleCheckPointer() {
  filterEvent()
}

// v2: columnIndex === 1 与 else 分支返回的都是居中，等价于全部居中
function tableHeaderColor(): CSSProperties {
  // 回调必须返回对象，element-plus 会对返回值做 Object.assign，返回字符串会炸
  return { textAlign: 'center' }
}

function ascDscEvent() {
  const nameAttr = current.value.sortName
  if (nameAttr && current.value.sortOrder === 'ascending') {
    vistedTableData.value = vistedTableData.value.sort(function (a, b) {
      return Number(a[nameAttr]) - Number(b[nameAttr])
    })
  } else if (nameAttr && current.value.sortOrder === 'descending') {
    vistedTableData.value = vistedTableData.value.sort(function (a, b) {
      return Number(b[nameAttr]) - Number(a[nameAttr])
    })
  }
}

function sortChange(e: { prop?: string | null; order?: string | null }) {
  if (e.order && e.order == 'ascending') {
    // 降序
    current.value.sortName = e.prop ?? null
    current.value.sortOrder = 'ascending'
  } else if (e.order && e.order == 'descending') {
    // 升序
    current.value.sortName = e.prop ?? null
    current.value.sortOrder = 'descending'
  } else {
    current.value.sortName = null
    current.value.sortOrder = null
    getCityTrend()
  }
  // 与 v2 一致（v2 此处逻辑存疑：有一句空的 if (this.current.sortName == "statTime") {}）
  ascDscEvent()
}

function handleSizeChange(val: number) {
  currentPage.value = 1
  pageSize.value = val
}

function handleCurrentChange(val: number) {
  currentPage.value = val
}

function setFilterBarParams(val: Record<string, unknown>, flag: number | null) {
  filterBarParams.value = copyObj(val)
  dateFlag.value = flag
}

function openingEvent(rows: { uri?: string; title?: string }, parentParams: Record<string, unknown>) {
  centerDialogVisible.value = true
  scopeRowData.value = rows
  initShowTable()
  void nextTick(() => {
    dialogBarRef.value?.dialogbarEvent(parentParams)
  })
}

watch(commonParams, () => {
  currentPage.value = 1
  pageSize.value = 10
  totalApiEvent()
  flagApi.value = localStorage.getItem('timeFlag')
})

defineExpose({ openingEvent, initCurrentPage })
</script>

<template>
  <div>
    <el-dialog v-model="centerDialogVisible" width="70%" top="5vh">
      <div style="min-height: 900px">
        <div
          style="
            border-radius: 6px 6px 0px 0px;
            height: 44px;
            background: #fbfcfe;
          "
        >
          <div
            style="
              font-size: 16px;
              font-weight: bold;
              line-height: 44px;
              margin-left: 16px;
              color: #4d4d4d;
            "
          >
            {{ scopeRowData.title }} / {{ scopeRowData.uri }}
          </div>
        </div>

        <!-- body -->
        <div style="padding: 16px; box-sizing: border-box">
          <!-- 筛选头部 -->
          <div
            class="public-hoverItem"
            style="
              height: 100px;
              width: 100%;
              background-color: #fbfcfe;
              border-radius: 6px;
            "
          >
            <dialogBar
              ref="dialogBarRef"
              ByArea
              :Byhour="false"
              ByData
              @set-filter-bar-params="setFilterBarParams"
            />
          </div>
          <!-- 流量概览 -->
          <div
            class="public-hoverItem"
            style="
              height: 151px;
              background-color: #fbfcfe;
              margin-top: 16px;
              border-radius: 6px;
            "
          >
            <div class="public-firstHead" style="padding: 15px">流量概览</div>
            <contrastFlow ref="originViewRef" byVisitedPage />
          </div>
          <!--  echarts-->
          <div
            v-if="vistedTableData.length > 1"
            class="public-hoverItem"
            style="
              width: 100%;
              min-height: 450px;
              background-color: #fbfcfe;
              margin-top: 16px;
              padding: 16px;
              box-sizing: border-box;
            "
          >
            <div style="display: flex">
              <div class="public-firstHead" style="line-height: 35px">访问趋势</div>
              <el-select
                v-model="headLege"
                class="custom_select"
                multiple
                placeholder="请选择"
                style="margin-left: 20px; min-width: 280px"
                @change="handleCheckPointer"
              >
                <el-option
                  v-for="item in options"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                >
                  <div style="display: flex; align-items: center">
                    <span class="checkbox__inner"><div class="inner-box"></div></span>
                    <span style="">{{ item.label }}</span>
                  </div>
                </el-option>
              </el-select>
            </div>

            <div ref="countLineRef" style="width: 90%; height: 400px"></div>
          </div>

          <!-- table -->
          <div
            class="public-hoverItem"
            style="
              margin-top: 16px;
              min-height: 488px;
              background-color: #fbfcfe;
              padding: 25px 16px;
              box-sizing: border-box;
            "
          >
            <div class="public-firstHead">数据统计</div>
            <div
              class="flow-indicator public_indicator"
              style="padding-bottom: 12px; margin-top: 15px"
            >
              <div class="flow-item">
                <div class="flow-title">流量基础指标</div>
                <el-checkbox-group
                  v-model="channelList"
                  class="checkBoxStyle"
                  @change="handelChannelList"
                >
                  <el-checkbox value="pv">浏览量</el-checkbox>
                  <el-checkbox value="uv">访客数</el-checkbox>
                  <el-checkbox value="ipCount" style="margin-right: 0">IP数</el-checkbox>
                </el-checkbox-group>
              </div>
              <div class="flow-item">
                <div class="flow-title">流量质量指标</div>
                <el-checkbox-group
                  v-model="flowQuality"
                  class="checkBoxStyle"
                  @change="handelFlowQuality"
                >
                  <el-checkbox value="entryCount">入口页次数</el-checkbox>
                  <el-checkbox value="downPvCount">贡献下游浏览量</el-checkbox>
                  <el-checkbox value="exitCount">退出页次数</el-checkbox>
                  <el-checkbox value="avgVisitTime">平均访问时长</el-checkbox>
                  <el-checkbox value="exitRate">退出率</el-checkbox>
                </el-checkbox-group>
              </div>
            </div>
            <div>
              <div class="public-Table-minHeight">
                <el-table
                  :data="pagedVistedTableData"
                  border
                  class="public-radius"
                  style="width: 100%"
                  :header-cell-style="{
                    textAlign: 'center',
                    background: '#f7fafe ',
                  }"
                  :cell-style="tableHeaderColor"
                  @sort-change="sortChange($event)"
                >
                  <el-table-column label="日期" width="200" show-overflow-tooltip>
                    <template #default="{ row }">
                      {{ row.statTime }}
                    </template>
                  </el-table-column>

                  <el-table-column label="流量基础指标">
                    <el-table-column v-if="pv" prop="pv" label="浏览量" sortable="custom" />
                    <el-table-column v-if="uv" prop="uv" label="访客数" sortable="custom" />
                    <el-table-column
                      v-if="ipCount"
                      prop="ipCount"
                      label="IP数"
                      sortable="custom"
                    />
                  </el-table-column>
                  <el-table-column prop="date" label="流量质量指标">
                    <el-table-column
                      v-if="entryCount"
                      prop="entryCount"
                      label="入口页次数"
                      sortable="custom"
                    />
                    <el-table-column
                      v-if="downPvCount"
                      prop="downPvCount"
                      label="贡献下游浏览量"
                      sortable="custom"
                    />
                    <el-table-column
                      v-if="exitCount"
                      prop="exitCount"
                      label="退出页次数"
                      sortable="custom"
                    />
                    <el-table-column
                      v-if="avgVisitTime"
                      prop="avgVisitTime"
                      label="平均访问时长"
                      sortable="custom"
                    >
                      <template #default="{ row }">
                        {{ formatTimeFilter(row.avgVisitTime) }}
                      </template>
                    </el-table-column>
                    <el-table-column
                      v-if="exitRate"
                      prop="exitRate"
                      label="退出率"
                      sortable="custom"
                    >
                      <template #default="{ row }">
                        {{ percenTableFilter(row.exitRate) }}
                      </template>
                    </el-table-column>
                  </el-table-column>
                </el-table>
              </div>
              <div class="block">
                <el-pagination
                  v-model:current-page="currentPage"
                  next-text="下一页"
                  :page-sizes="[10, 20, 30, 40]"
                  :page-size="pageSize"
                  layout="total, sizes, prev, pager, next, jumper"
                  :total="total"
                  @size-change="handleSizeChange"
                  @current-change="handleCurrentChange"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
// v2 这里是 @import custom-select.scss（已在 v3 全局引入）+ ::v-deep { @import el-pagination.scss }（也已全局引入）
// v2 的 el-checkbox.scss 在本文件是注释掉的，这里同样不引

// v2 是 .el-radio-button--mini，element-plus 的 size="small" 对应 --small
:deep(.el-radio-button--small .el-radio-button__inner) {
  height: 30px;
}

:deep(.el-dialog) {
  border-radius: 6px;
}

:deep(.el-dialog__headerbtn) {
  top: 15px;
}

:deep(.el-dialog__header) {
  padding: 0 !important;
  border-radius: 6px;
}

:deep(.el-dialog__body) {
  padding: 0;
  background-color: #eef4fd;
  border-radius: 6px;
}

.setSpace {
  margin-bottom: 8px;
  margin-left: 25px;
}

.setBody {
  margin-bottom: 8px;
}

.mapTable {
  width: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
