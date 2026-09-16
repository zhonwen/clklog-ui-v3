<script setup lang="ts">
/**
 * 单个受访页面详情弹窗（对应 v2 views/access-analysis/custom-dialog/visited.vue）。
 *
 * 受访页面 / 入口页 / 退出页三个表格里点「showFlag」小图标时打开，
 * 父组件通过 ref 调 openingEvent(row, commonParams)。
 *
 * v2 的死代码没有迁移：fetchDataVApi / mapContainerEvent（从 regional.vue 复制过来的地图逻辑，
 * 连 provinceCode 都没 import，调用即报错，且从未被调用）、getCityDetail、averageRulesEvent、
 * percentageFun 也都没有任何调用点。
 */
import { computed, nextTick, ref, watch } from 'vue'
import { copyObj } from '@/utils/copy'
import { formatTime } from '@/utils/format'
import { makeTableCellCenterByIndex } from '@/utils/index'
import contrastFlow from '@/components/contrastFlow/index.vue'
import { dialogBar } from '@/layout/components'
import {
  getVisitOneUriTotalApi,
  getVisitOneUriTrendApi,
} from '@/api/trackingapi/visituri'
import { useTrackingStore } from '@/stores/tracking'
import { useSettingsStore } from '@/stores/settings'
import { useChart } from '@/composables/useChart'
import { useLatestOnly } from '@/composables/useLatestOnly'

const trackingStore = useTrackingStore()
const settingsStore = useSettingsStore()
const totalLatest = useLatestOnly()
const trendLatest = useLatestOnly()
const { elRef, init, setOption } = useChart()

interface TrendRow {
  statTime?: string
  pv?: number
  uv?: number
  visitCount?: number
  ipCount?: number
  exitCount?: number
  avgVisitTime?: number
  exitRate?: number
  [key: string]: unknown
}
interface ScopeRow {
  title?: string
  uri?: string
  [key: string]: unknown
}
type CheckboxGroupValue = (string | number)[]

// 与 v2 一致：v2 的 cologStyle 里没有 $exitCount，取到 undefined，echarts 会回落到默认色
const cologStyle = settingsStore.cologStyle as unknown as Record<string, string | undefined>

const loadingSecond = ref(false)
const loadingRefresh = ref(false)
const flagApi = ref<string | null>(null)

// 与 v2 一致：默认值里的 index / uri / title 在模板里没有对应 checkbox，只参与 initShowTable 的合并
const channelList = ref<CheckboxGroupValue>(['index', 'uri', 'uv', 'ipCount', 'pv', 'title'])
const flowQuality = ref<CheckboxGroupValue>(['entryCount', 'avgVisitTime'])

const vistedTableData = ref<TrendRow[]>([])
const mergedArr = ref<string[]>([])

/**
 * 与 v2 一致（v2 此处逻辑存疑）：v2 的 data() 里 pv / uv / visitCount / ipCount / exitCount /
 * exitRate 被声明了两次 —— 先是 `false`（列显隐开关），后面又是 `[]`（折线图的数据数组），
 * 对象字面量后一个键覆盖前一个，所以初值是空数组。
 * 之后 flowPoint() 会把它们写成 boolean，filterEvent() 又会写回数组，
 * 于是「列显隐」和「图表数据」共用同一批变量：取完数后空数组也是真值，
 * 对应的列会被强制显示出来，直到下一次勾选复选框才会变回布尔。
 * 这里用 `boolean | number[]` 原样复刻这个行为。
 */
const pv = ref<boolean | number[]>([])
const uv = ref<boolean | number[]>([])
const visitCount = ref<boolean | number[]>([])
const ipCount = ref<boolean | number[]>([])
const exitCount = ref<boolean | number[]>([])
const exitRate = ref<boolean | number[]>([])
// 这几个在 v2 里只声明过一次，是纯粹的列显隐开关
const uri = ref(false)
const avgVisitTime = ref(false)
const entryCount = ref(false)
const downPvCount = ref(false)

const currentPage = ref(1)
const total = ref(0)
const pageSize = ref(10)

const current = ref<{ sortName: string | null; sortOrder: string | null }>({
  sortName: '',
  sortOrder: '',
})

const centerDialogVisible = ref(false)
const scopeRowData = ref<ScopeRow>({})
const dateFlag = ref<number | null>(null)
const filterBarParams = ref<Record<string, unknown>>({})
const headLege = ref<string[]>(['访问次数', '访客数'])
const options = [
  { value: '浏览量', label: '浏览量', disabled: false },
  { value: '访客数', label: '访客数', disabled: false },
  { value: '访问次数', label: '访问次数', disabled: false },
  { value: 'IP数', label: 'IP数', disabled: false },
  { value: '退出页', label: '退出页', disabled: false },
]
const trenListChart = ref<TrendRow[]>([])
const statTime = ref<string[]>([])

const dialogBarRef = ref<{
  dialogbarEvent: (commonParams: Record<string, unknown>) => void
  clearEvent: () => void
} | null>(null)
const originViewRef = ref<{
  originEvent: (val: unknown, flag?: number | boolean | null) => void
} | null>(null)

// v2 的 tableHeaderColor 两个分支都返回字符串 "text-align:center"，
// element-plus 对返回值做 Object.assign，字符串会被拆成下标属性并报错，这里统一返回对象（全部居中）
const tableHeaderColor = makeTableCellCenterByIndex()

const projectName = computed(() => trackingStore.projectName)
const commonParams = computed<Record<string, unknown>>(() =>
  Object.assign({ projectName: projectName.value }, filterBarParams.value),
)

// 模板里原本写了两次 slice，抽成 computed
const pagedTableData = computed(() =>
  vistedTableData.value.slice(
    (currentPage.value - 1) * pageSize.value,
    currentPage.value * pageSize.value,
  ),
)

/** v2 模板里的 `| formatTime`（filters 版会先 Math.floor） */
function formatTimeFilter(val?: number) {
  return formatTime(Math.floor(Number(val)))
}

/** v2 filters/index.js 的 percenTable：非法/0 值返回数字 0 */
function percenTable(s?: number): string | number {
  if (s == 1) return '100%'
  if (s) return (Number(s) * 100).toFixed(2) + '%'
  return 0
}

/** v2 里 filterUrl 是组件内自己写的正则（不是 filters 里的那个），行为一致 */
function filterUrl(value?: string) {
  const regExp = /^(http:\/\/|https:\/\/|www\.)/
  return regExp.test(value || '')
}

function asArray(v: boolean | number[]): number[] {
  return Array.isArray(v) ? v : []
}

function flowPoint(val: string[]) {
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
  flowPoint(mergedArr.value)
}

function handelChannelList() {
  initShowTable()
}
function handelFlowQuality() {
  initShowTable()
}

function countLineEcharts() {
  init()
  setOption(
    {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          lineStyle: {
            color: '#C0CADB',
            width: 2,
          },
        },
      },
      legend: {
        left: 'center',
        top: 'top',
        data: headLege.value,
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
        data: statTime.value,
        axisTick: { show: false },
        axisLabel: {
          interval: 0,
          rotate: 45,
        },
      },
      yAxis: {
        axisTick: { show: false },
        type: 'value',
      },
      series: [
        {
          name: '浏览量',
          type: 'line',
          itemStyle: { color: cologStyle.$pv },
          lineStyle: { width: 3 },
          data: asArray(pv.value),
        },
        {
          name: '访客数',
          type: 'line',
          itemStyle: { color: cologStyle.$uv },
          lineStyle: { width: 3 },
          data: asArray(uv.value),
        },
        {
          name: '访问次数',
          type: 'line',
          itemStyle: { color: cologStyle.$visitCount },
          lineStyle: { width: 3 },
          data: asArray(visitCount.value),
        },
        {
          name: 'IP数',
          type: 'line',
          itemStyle: { color: cologStyle.$ipCount },
          lineStyle: { width: 3 },
          data: asArray(ipCount.value),
        },
        {
          name: '退出页',
          type: 'line',
          // 与 v2 一致：cologStyle 里没有 $exitCount，这里是 undefined，echarts 用默认色
          itemStyle: { color: cologStyle.$exitCount },
          lineStyle: { width: 3 },
          data: asArray(exitCount.value),
        },
      ],
    },
    true,
  )
}

function filterEvent() {
  const pvList: number[] = []
  const uvList: number[] = []
  const visitCountList: number[] = []
  const ipCountList: number[] = []
  const exitCountList: number[] = []
  const statTimeList: string[] = []
  for (let i = 0; i < trenListChart.value.length; i++) {
    const item = trenListChart.value[i]
    for (let j = 0; j < headLege.value.length; j++) {
      if (headLege.value[j] == '访问次数') visitCountList.push(Number(item?.visitCount))
      if (headLege.value[j] == '浏览量') pvList.push(Number(item?.pv))
      if (headLege.value[j] == '访客数') uvList.push(Number(item?.uv))
      if (headLege.value[j] == 'IP数') ipCountList.push(Number(item?.ipCount))
      if (headLege.value[j] == '退出页') exitCountList.push(Number(item?.exitCount))
    }
    statTimeList.push(String(item?.statTime ?? ''))
  }
  pv.value = pvList
  uv.value = uvList
  visitCount.value = visitCountList
  ipCount.value = ipCountList
  exitCount.value = exitCountList
  statTime.value = statTimeList

  if (vistedTableData.value.length > 1) {
    void nextTick(() => {
      countLineEcharts()
    })
  }
}

// 趋势接口
function getCityTrend() {
  const params = copyObj(commonParams.value)
  params.uri = scopeRowData.value.uri
  params.title = scopeRowData.value.title
  loadingSecond.value = true
  const token = trendLatest.next()
  getVisitOneUriTrendApi(params)
    .then((res) => {
      if (!trendLatest.isLatest(token)) return
      if (res?.code == 200) {
        loadingSecond.value = false
        trenListChart.value = (res.data as TrendRow[]) || []
        // 表格数据
        vistedTableData.value = copyObj((res.data as TrendRow[]) || [])
        total.value = vistedTableData.value.length || 0
        filterEvent()
      } else {
        loadingSecond.value = false
      }
    })
    .catch(() => {
      if (!trendLatest.isLatest(token)) return
      loadingSecond.value = false
    })
}

function totalApiEvent() {
  loadingRefresh.value = true
  const params = copyObj(commonParams.value)
  params.uri = scopeRowData.value.uri
  params.title = scopeRowData.value.title
  const token = totalLatest.next()
  getVisitOneUriTotalApi(params)
    .then((res) => {
      if (!totalLatest.isLatest(token)) return
      if (res?.code == 200) {
        loadingRefresh.value = false
        originViewRef.value?.originEvent(res.data, dateFlag.value)
        getCityTrend()
      } else {
        loadingRefresh.value = false
      }
    })
    .catch(() => {
      if (!totalLatest.isLatest(token)) return
      loadingRefresh.value = false
    })
}

/** 父组件通过 ref 调用 */
function openingEvent(rows: ScopeRow, params: Record<string, unknown>) {
  centerDialogVisible.value = true
  scopeRowData.value = rows
  initShowTable()
  if (flagApi.value == localStorage.getItem('timeFlag')) {
    totalApiEvent()
  }
  void nextTick(() => {
    dialogBarRef.value?.dialogbarEvent(params)
  })
}

// 多选事件
function handleCheckPointer() {
  filterEvent()
}

function ascDscEvent() {
  const nameAttr = current.value.sortName
  if (nameAttr && current.value.sortOrder === 'ascending') {
    vistedTableData.value = vistedTableData.value.sort(
      (a, b) => Number(a[nameAttr]) - Number(b[nameAttr]),
    )
  } else if (nameAttr && current.value.sortOrder === 'descending') {
    vistedTableData.value = vistedTableData.value.sort(
      (a, b) => Number(b[nameAttr]) - Number(a[nameAttr]),
    )
  }
}

function sortChange(e: { prop?: string | null; order?: string | null }) {
  if (e.order && e.order == 'ascending') {
    // 降序
    current.value.sortName = e.prop || null
    current.value.sortOrder = 'ascending'
  } else if (e.order && e.order == 'descending') {
    // 升序
    current.value.sortName = e.prop || null
    current.value.sortOrder = 'descending'
  } else {
    current.value.sortName = null
    current.value.sortOrder = null
    getCityTrend()
  }
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

watch(commonParams, () => {
  currentPage.value = 1
  pageSize.value = 10
  totalApiEvent()
  flagApi.value = localStorage.getItem('timeFlag')
})

defineExpose({ openingEvent })
</script>

<template>
  <div>
    <el-dialog v-model="centerDialogVisible" width="70%" top="5vh">
      <div style="min-height: 900px">
        <div style="border-radius: 6px 6px 0px 0px; height: 44px; background: #fbfcfe">
          <div
            style="
              font-size: 16px;
              font-weight: bold;
              line-height: 44px;
              margin-left: 16px;
              margin-right: 50px;
              overflow: hidden;
              white-space: nowrap;
              text-overflow: ellipsis;
              color: #4d4d4d;
            "
          >
            <div style="overflow: hidden; white-space: nowrap; text-overflow: ellipsis">
              {{ scopeRowData.title }} /
              <a
                v-if="filterUrl(scopeRowData.uri)"
                :href="scopeRowData.uri"
                style="color: #2c7be5"
                target="_blank"
                >{{ scopeRowData.uri }}</a
              >
              <a v-else>{{ scopeRowData.uri }}</a>
            </div>
          </div>
        </div>

        <!-- body -->
        <div style="padding: 16px; box-sizing: border-box">
          <div
            class="public-hoverItem"
            style="height: 100px; width: 100%; background-color: #fbfcfe; border-radius: 6px"
          >
            <dialogBar
              ref="dialogBarRef"
              ByArea
              :ByDownLoad="false"
              :Byhour="false"
              ByData
              @set-filter-bar-params="setFilterBarParams"
            />
          </div>
          <!-- 流量概览 -->
          <div
            v-loading="loadingRefresh"
            class="public-hoverItem"
            style="
              height: 151px;
              background-color: #fbfcfe;
              margin-top: 16px;
              border-radius: 6px;
            "
          >
            <div class="public-firstHead" style="padding: 15px">流量概览</div>
            <contrastFlow ref="originViewRef" by-visited-page is-update-duration />
          </div>
          <!--  echarts-->
          <div
            v-if="vistedTableData.length > 1"
            v-loading="loadingSecond"
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
                    <span class="checkbox__inner"><div class="inner-box" /></span>
                    <span>{{ item.label }}</span>
                  </div>
                </el-option>
              </el-select>
            </div>

            <div ref="elRef" style="width: 90%; height: 400px" />
          </div>

          <!-- table -->
          <div
            v-loading="loadingSecond"
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
                  <el-checkbox value="avgVisitTime">页面平均浏览时长</el-checkbox>
                  <el-checkbox value="exitRate">退出率</el-checkbox>
                </el-checkbox-group>
              </div>
            </div>
            <div>
              <div class="public-Table-minHeight">
                <el-table
                  :data="pagedTableData"
                  border
                  class="public-radius"
                  style="width: 100%"
                  :header-cell-style="{ textAlign: 'center', background: '#f7fafe ' }"
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
                    <el-table-column v-if="ipCount" prop="ipCount" label="IP数" sortable="custom" />
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
                      label="页面平均浏览时长"
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
                        {{ percenTable(row.exitRate) }}
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
// v2 这里 @import 了 custom-select.scss 与 el-pagination.scss，
// 二者在 v3 都已由 styles/index.scss 全局引入，不再重复引；
// v2 的 el-checkbox.scss 那一行本来就是注释掉的，同样不引。

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
