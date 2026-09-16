<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, ref } from 'vue'
import { Close, DocumentCopy, Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { EChartsOption } from 'echarts'
import eventBar from './eventBar.vue'
import { copyObj } from '@/utils/copy'
import { dateTimeStringToTimestamp, filterTimeFormatUnified } from '@/utils/date'
import { foramtDataValue } from '@/utils/format'
import {
  getEventDetailListApi,
  getEventDetailTrendApi,
  getEventPropertyListApi,
} from '@/api/sysmanage/eventAnalysis'
import { useSettingsStore } from '@/stores/settings'
import { useTrackingStore } from '@/stores/tracking'
import { useChart } from '@/composables/useChart'
import { useLatestOnly } from '@/composables/useLatestOnly'

/** 事件详情弹窗（v2 src/views/analysis-modules/event-analysis/components/event_dialog.vue） */

interface EventRow {
  eventName?: string
  eventDisplayName?: string
}

interface PropertyColumn {
  propertyName?: string
  propertyDisplayName?: string
  propertyDataType?: string
}

interface DetailRow {
  logTime?: string
  userId?: string
  userProp?: Record<string, unknown>
  [key: string]: unknown
}

interface TrendItem {
  pv?: number
  uv?: number
  statTime?: string
}

const proxy = getCurrentInstance()?.proxy
const settingsStore = useSettingsStore()
const trackingStore = useTrackingStore()

const { elRef, init, setOption } = useChart()
const { next: nextList, isLatest: isLatestList } = useLatestOnly()
const { next: nextTrend, isLatest: isLatestTrend } = useLatestOnly()
const { next: nextProp, isLatest: isLatestProp } = useLatestOnly()

const cologStyle = settingsStore.cologStyle
const eventDialogVisible = ref(false)
const rowList = ref<EventRow>({})
const options = [
  { value: '触发次数', label: '触发次数' },
  { value: '用户数', label: '用户数' },
]
const headLege = ref<string[]>(['触发次数', '用户数'])
const searchValue = ref('')
const tableList = ref<DetailRow[]>([])
const pageNum = ref(1)
const pageSize = ref(10)
const total = ref(0)
const tableLabelEvent = ref<PropertyColumn[]>([])
const tableLabelUser = ref<PropertyColumn[]>([])
const commonParams = ref<Record<string, unknown>>({})
const trendChartList = ref<TrendItem[]>([])
const pvList = ref<Array<number | undefined>>([])
const uvList = ref<Array<number | undefined>>([])
// v2 直接 push 了 item.statTime（可能为 undefined），这里补一个 '' 兜底以对上 echarts 的 xAxis.data 类型
const statTime = ref<string[]>([])
const loadingRefresh = ref(false)

const eventBarRef = ref<{ statisticEvent: (params: Record<string, unknown>) => void } | null>(null)

const projectName = computed(() => trackingStore.projectName)

function filterEventProp(prop?: string) {
  return `eventProp.${prop}`
}

function filterUserProp(prop?: string) {
  return `userProp.${prop}`
}

// 模板里逐列调用 filterEventProp / filterUserProp 会反复求值，这里先算好列定义
const eventColumns = computed(() =>
  tableLabelEvent.value.map((item) => ({
    ...item,
    propertyName: item.propertyName ?? '',
    prop: filterEventProp(item.propertyName),
    width: tableLabelEvent.value.length > 5 ? '150px' : '',
  })),
)

const userColumns = computed(() =>
  tableLabelUser.value.map((item) => ({
    ...item,
    propertyName: item.propertyName ?? '',
    prop: filterUserProp(item.propertyName),
    width: tableLabelUser.value.length > 5 ? '150px' : '',
  })),
)

function copyRowId(id: string) {
  const textarea = document.createElement('textarea')
  textarea.value = id
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
  ElMessage.success('复制成功！')
}

function formatTableData(data: unknown, propertyDataType?: string) {
  let value: unknown = ''
  if (propertyDataType == 'DATETIME') {
    value = filterTimeFormatUnified(data)
  } else if (propertyDataType == 'STRING') {
    value = data
  } else if (propertyDataType == 'BOOL') {
    value = foramtDataValue(data)
  } else {
    value = data
  }
  return value
}

function handleClose() {
  eventDialogVisible.value = false
}

function countLineEcharts() {
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
    legend: {
      // v2 用的是 echarts 3 时代的 x / y，echarts 5+ 已改名为 left / top
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
      axisTick: {
        show: false,
      },
      axisLabel: {
        interval: 0,
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
        name: '触发次数',
        type: 'line',
        // echarts 6 已移除 itemStyle.normal 这一层，直接写在 itemStyle 上
        itemStyle: {
          color: cologStyle.$pv,
        },
        lineStyle: {
          width: 3,
        },
        data: pvList.value,
      },
      {
        name: '用户数',
        type: 'line',
        itemStyle: {
          color: cologStyle.$uv,
        },
        lineStyle: {
          width: 3,
        },
        data: uvList.value,
      },
    ],
  }
  // 图表容器在 el-dialog 内，首次打开时 DOM 还没渲染出来，等一拍再 init
  void nextTick(() => {
    init()
    setOption(option, true)
  })
}

function filterEvent() {
  uvList.value = []
  pvList.value = []
  statTime.value = []
  for (let i = 0; i < trendChartList.value.length; i++) {
    const item = trendChartList.value[i]
    if (!item) continue
    for (let j = 0; j < headLege.value.length; j++) {
      if (headLege.value[j] == '触发次数') {
        pvList.value.push(item.pv)
      }
      if (headLege.value[j] == '用户数') {
        uvList.value.push(item.uv)
      }
    }
    statTime.value.push(item.statTime ?? '')
  }
  countLineEcharts()
}

function handleCheckPointer() {
  filterEvent()
}

function dateSearchRules(dateString: string) {
  const regex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/
  return regex.test(dateString)
}

function getProcessedSearchValue() {
  if (!searchValue.value) return ''

  let processedValue: string | number = copyObj(searchValue.value)
  const isDateFormat = dateSearchRules(searchValue.value)
  if (isDateFormat) {
    processedValue = dateTimeStringToTimestamp(String(processedValue))
  }
  return processedValue
}

function flattenObject(obj: Record<string, unknown>) {
  const flattenedObject = { ...(obj.eventProp as Record<string, unknown>), ...obj }
  delete flattenedObject.eventProp
  return flattenedObject as DetailRow
}

/** 请求接口事件 */
function protoTypeApiEvent() {
  const token = nextList()
  loadingRefresh.value = true
  const params = {
    pageNum: pageNum.value,
    pageSize: pageSize.value,
    projectName: projectName.value,
    eventName: rowList.value.eventName,
    // v2 这里注释掉了 propertyValue，实际传的是 userId
    userId: getProcessedSearchValue(),
    startTime: commonParams.value.startTime,
    endTime: commonParams.value.endTime,
    timeType: commonParams.value.timeType,
  }
  getEventDetailListApi(params)
    .then((res) => {
      if (!isLatestList(token)) return
      if (res?.code == 200) {
        loadingRefresh.value = false
        const data = res.data as { rows?: Record<string, unknown>[]; total?: number }
        const newArray: DetailRow[] = []
        if (data) {
          ;(data.rows || []).forEach((item) => {
            newArray.push(copyObj(flattenObject(item)))
          })
        }

        tableList.value = newArray
        total.value = Number(data?.total || 0)
      }
    })
    .catch(() => {
      if (!isLatestList(token)) return
      loadingRefresh.value = false
    })
}

function getEventPropertyListEvent() {
  const token = nextProp()
  const params = {
    projectName: projectName.value,
    eventName: rowList.value.eventName,
  }
  getEventPropertyListApi(params)
    .then((res) => {
      if (!isLatestProp(token)) return
      if (res?.code == 200) {
        const data = res.data as { event?: PropertyColumn[]; user?: PropertyColumn[] }
        tableLabelEvent.value = data?.event || []
        tableLabelUser.value = data?.user || []
      }
    })
    .catch(() => {
      if (!isLatestProp(token)) return
    })
}

function trendApiEvent() {
  const token = nextTrend()
  const params = {
    projectName: projectName.value,
    startTime: commonParams.value.startTime,
    endTime: commonParams.value.endTime,
    timeType: commonParams.value.timeType,
    eventName: rowList.value.eventName,
  }
  getEventDetailTrendApi(params)
    .then((res) => {
      if (!isLatestTrend(token)) return
      if (res?.code == 200) {
        if (res.data) {
          trendChartList.value = res.data as TrendItem[]
        } else {
          trendChartList.value = []
        }
        filterEvent()
      }
    })
    .catch(() => {
      if (!isLatestTrend(token)) return
    })
}

function setFilterBarParams(val: Record<string, unknown>) {
  pageNum.value = 1
  // v2 这里注释掉了 clearSearchValues()（清空用户ID搜索框），保持一致不清
  commonParams.value = copyObj(val)
  protoTypeApiEvent()
  trendApiEvent()
  getEventPropertyListEvent()
}

function getIndex(index: number) {
  return (pageNum.value - 1) * pageSize.value + index + 1
}

function openDialogEvent(row: EventRow, params: Record<string, unknown>) {
  commonParams.value = copyObj(params)
  commonParams.value.eventName = row.eventName
  rowList.value = row
  eventDialogVisible.value = true
  void nextTick(() => {
    eventBarRef.value?.statisticEvent(commonParams.value)
  })
}

function handleClick() {
  pageNum.value = 1
  protoTypeApiEvent()
}

function handleSizeChange(val: number) {
  pageSize.value = val
  protoTypeApiEvent()
}

function handleCurrentChange(val: number) {
  pageNum.value = val
  protoTypeApiEvent()
}

// v2 里父组件用 this.$refs.eventDialog.openDialogEvent(...) 调用，<script setup> 默认对外封闭
defineExpose({ openDialogEvent })
</script>

<template>
  <div>
    <el-dialog
      v-model="eventDialogVisible"
      :show-close="false"
      :close-on-press-escape="false"
      width="80vw"
      top="2vh"
      style="overflow-y: hidden"
    >
      <!-- v2 还写了 :modal-append-to-body="false"，element-plus 已移除该属性 -->
      <div class="custom-header">
        <div>
          <div
            style="
              height: 44px;
              background: #fbfcfe;
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-radius: 6px 6px 0 0;
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
              事件名称：{{ rowList.eventDisplayName || "--" }}
            </div>
            <div class="closeIcon" @click="handleClose">
              <el-icon><Close /></el-icon>
            </div>
          </div>
        </div>
        <div class="public-hoverItem" style="margin: 20px; box-sizing: border-box">
          <eventBar
            ref="eventBarRef"
            ByDayOrHour
            class="event_x"
            @set-filter-bar-params="setFilterBarParams"
          />
        </div>
      </div>

      <div style="height: 80vh; width: 80vw; overflow: auto; position: relative">
        <div style="margin: 16px; margin-top: 0; box-sizing: border-box; position: relative">
          <div v-loading="loadingRefresh" class="trendDiv public-hoverItem block-main">
            <div class="block-head">
              <div class="block-title">趋势图</div>
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
                    <span class="checkbox__inner">
                      <div class="inner-box"></div>
                    </span>
                    <span>{{ item.label }}</span>
                  </div>
                </el-option>
              </el-select>
            </div>
            <div ref="elRef" style="width: 95%; height: 400px"></div>
          </div>
          <!-- 趋势图 -->
          <div class="public-hoverItem block-main" style="min-height: 500px; margin-top: 20px">
            <div class="block-head">
              <div class="block-title">事件触发日志</div>
            </div>
            <div style="display: flex; justify-content: flex-end; margin: 20px 0; height: 30px">
              <el-input
                v-model="searchValue"
                placeholder="请输入用户ID"
                style="width: 300px"
                @keyup.enter="handleClick()"
              >
                <template #suffix>
                  <el-icon class="el-input__icon" style="cursor: pointer" @click="handleClick()">
                    <Search />
                  </el-icon>
                </template>
              </el-input>
            </div>

            <el-table
              v-loading="loadingRefresh"
              :data="tableList"
              class="public-radius"
              :header-cell-style="{ textAlign: 'center', background: '#f7fafe ' }"
              :cell-style="{ textAlign: 'center' }"
              style="width: 100%; min-height: 300px"
              border
            >
              <el-table-column
                fixed="left"
                type="index"
                label="序号"
                :width="proxy?.$fixedWidth.FwIndex"
              >
                <template #default="scope">
                  <div>
                    <span>{{ getIndex(scope.$index) }}</span>
                  </div>
                </template>
              </el-table-column>
              <el-table-column
                fixed="left"
                :width="proxy?.$fixedWidth.FwTime"
                prop="logTime"
                label="时间"
                show-overflow-tooltip
              />
              <el-table-column
                fixed="left"
                prop="userId"
                label="用户ID"
                width="200px"
                show-overflow-tooltip
              >
                <template #default="scope">
                  <div
                    style="
                      display: flex;
                      align-items: center;
                      justify-content: space-between;
                      cursor: pointer;
                    "
                  >
                    <div style="overflow: hidden; text-overflow: ellipsis">
                      {{ scope.row.userId }}
                    </div>
                    <el-icon
                      v-if="scope.row.userId"
                      style="color: #2c7be5; margin-left: 5px; cursor: pointer"
                      @click="copyRowId(scope.row.userId)"
                    >
                      <DocumentCopy />
                    </el-icon>
                  </div>
                </template>
              </el-table-column>
              <!-- v2 在这两组动态列上还写了 @click="conSelected(scope, item.prop)"：
                   el-table-column 不派发 click，scope / conSelected 也都不存在，是死代码，迁移时删除 -->
              <el-table-column
                v-for="(item, index) in eventColumns"
                :key="index"
                :label="item.propertyDisplayName"
                :prop="item.prop"
                style="cursor: pointer"
                :width="item.width"
                show-overflow-tooltip
              >
                <template #default="scope">
                  {{ formatTableData(scope.row[item.propertyName], item.propertyDataType) }}
                </template>
              </el-table-column>
              <el-table-column
                v-for="sub in userColumns"
                :key="sub.propertyName"
                :label="sub.propertyDisplayName"
                :prop="sub.prop"
                style="cursor: pointer"
                :width="sub.width"
                show-overflow-tooltip
              >
                <template #default="scope">
                  {{
                    formatTableData(scope.row.userProp[sub.propertyName], sub.propertyDataType)
                  }}
                </template>
              </el-table-column>
            </el-table>
            <div class="block" style="height: 70px">
              <el-pagination
                v-model:current-page="pageNum"
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
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
// v2 这里在 ::v-deep 块内 @import 了 el-checkbox.scss / el-pagination.scss。
// v3 的 sass 不允许 @use 出现在嵌套块内（会整页编译失败）：
//   - el-pagination.scss 已在 src/styles/index.scss 全局引入；
//   - el-checkbox.scss 本身已是 :deep(...) 写法，可以在顶层 @use。
@use '@/styles/components/el-checkbox.scss';

.con_tip {
  width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 20px;
}

:deep() {
  .el-dialog {
    border-radius: 6px;
  }

  .el-dialog__headerbtn {
    top: 15px;
  }

  .el-dialog__header {
    padding: 0 !important;
    border-radius: 6px;
  }

  .el-dialog__body {
    padding: 0;
    background-color: #eef4fd;
    border-radius: 6px;
  }
}

.closeIcon {
  margin-right: 30px;
  cursor: pointer;
  font-size: 20px;
}

.closeIcon:hover {
  color: #2c7be5;
}

.trendDiv {
  min-height: 462px;
  background-color: #fff;
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
