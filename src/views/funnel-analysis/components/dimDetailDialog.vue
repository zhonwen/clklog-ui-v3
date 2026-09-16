<template>
  <el-dialog
    v-model="visible"
    width="90%"
    append-to-body
    top="1vh"
    class="regional-dialog-custom"
    :show-close="false"
  >
    <div style="min-height: 800px">
      <div
        style="border-radius: 6px 6px 0px 0px; height: 44px; background: #fbfcfe; position: relative"
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
          {{ title }}
        </div>
        <el-icon
          style="
            position: absolute;
            right: 16px;
            top: 14px;
            cursor: pointer;
            font-size: 18px;
            color: #909399;
          "
          @click="visible = false"
        >
          <Close />
        </el-icon>
      </div>

      <div
        v-loading="loading"
        element-loading-text="加载中..."
        style="padding: 16px; box-sizing: border-box"
      >
        <!-- 上部：漏斗 + 图表 -->
        <div
          class="public-hoverItem"
          style="
            background-color: #fbfcfe;
            padding: 20px;
            border-radius: 6px;
            margin-bottom: 16px;
          "
        >
          <div class="chart-header">
            <div style="line-height: 40px; font-size: 15px; color: #4d4d4d; font-weight: bold">
              漏斗转化分析
            </div>
            <div style="display: flex; align-items: center">
              <div class="searchLable">维度值:</div>
              <el-select
                v-model="groupValues"
                style="margin: 0 20px; max-width: 300px"
                multiple
                collapse-tags
                placeholder="请选择"
                filterable
                popper-class="dim-value-select-dropdown"
                @change="handleGroupLimit"
              >
                <el-option
                  v-for="(item, index) in byValuesGroupList"
                  :key="index"
                  :label="item.label"
                  :value="item.id"
                />
              </el-select>

              <!-- 与 v2 一致：「显示设置」的 el-popover 在 v2 里整段被注释掉了 -->
            </div>
          </div>

          <div class="chart_container">
            <!-- 左侧漏斗 -->
            <div class="col_left" style="width: 30%">
              <div class="triangle_container">
                <div class="triangle-rectangle" style="height: 40px"></div>
                <div
                  class="triangle"
                  style="
                    border-bottom: 25px solid #488bff;
                    transform: rotate(-180deg);
                    margin-top: -1px;
                  "
                ></div>
                <div class="remarkCon">
                  <span style="margin-top: 5px"> 总转化率 </span>
                  <span style="margin-top: 5px">{{ totalRate }}</span>
                </div>
              </div>
              <div style="max-height: 400px; overflow: auto; padding: 0 10px">
                <div
                  v-for="(item, index) in customNameList"
                  :key="index"
                  style="display: flex; flex-direction: column; align-items: center"
                >
                  <!-- 第一步不需要显示百分比转换 -->
                  <div v-if="index > 0" class="triangle_container">
                    <div class="triangle-rectangle" style="background: #f2f5fa; color: #475669"></div>
                    <div
                      class="triangle"
                      style="
                        border-bottom: 25px solid #f2f5fa;
                        transform: rotate(-180deg);
                        margin-top: -1px;
                      "
                    ></div>
                    <div class="remarkCon" style="color: #475669">
                      {{ filterAllPercent(index, 'rate') }}
                    </div>
                  </div>
                  <div class="sing_item">
                    <div class="stepIndex">第{{ index + 1 }} 步</div>
                    <div class="name">{{ item }}</div>
                    <div class="num">
                      {{ filterAllPercent(index, 'value') }}{{ measurementType == 'UV' ? '人' : '次' }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <!-- 右侧图表 -->
            <div class="col_right" style="width: 70%">
              <metricLineChart ref="metricLineChartRef" />
            </div>
          </div>
        </div>

        <!-- 下部：详细表格 -->
        <div class="public-hoverItem" style="background-color: #fbfcfe; padding: 20px; border-radius: 6px">
          <div style="display: flex; justify-content: space-between">
            <div class="public-tableHead">漏斗转化明细</div>
          </div>
          <el-table
            border
            :header-cell-style="{ textAlign: 'center', background: '#f7fafe ' }"
            :data="pagedTableData"
            style="width: 100%"
            @sort-change="handleSortChange"
          >
            <el-table-column
              v-for="(item, index) in byFields"
              :key="'by-' + index"
              :prop="'by_' + index"
              :label="item.name"
              width="120"
              show-overflow-tooltip
              sortable="custom"
              align="center"
            >
              <template #default="scope">
                {{ formatDateUnified(scope.row.byValues[index], item) }}
              </template>
            </el-table-column>

            <el-table-column
              v-for="(col, index) in tableColumns"
              :key="'col-' + index"
              :label="col.label"
              align="center"
            >
              <el-table-column
                v-for="(subCol, subIndex) in col.children"
                :key="'sub-' + subIndex"
                :prop="subCol.prop"
                :label="subCol.label"
                :width="subCol.width"
                :sortable="subCol.sortable"
                align="center"
              >
                <template #default="scope">
                  <span>
                    <template v-if="subCol.prop === 'total_converted_user'">{{
                      scope.row.convertedUser
                    }}</template>
                    <template v-else-if="subCol.prop === 'total_conversion_rate'">{{
                      scope.row.conversionRate.toFixed(2)
                    }}</template>
                    <template v-else-if="scope.row.steps && scope.row.steps[index - 1]">
                      <template v-if="subCol.label === '人数' || subCol.label === '次数'">{{
                        scope.row.steps[index - 1].convertedUser
                      }}</template>
                      <template v-else-if="subCol.label === '转化率'">{{
                        scope.row.steps[index - 1].conversionRate.toFixed(2)
                      }}</template>
                    </template>
                    <template v-else>0</template>
                    <span v-if="subCol.isRate">%</span>
                  </span>
                </template>
              </el-table-column>
            </el-table-column>
          </el-table>
          <div class="block" style="margin-top: 20px; text-align: right">
            <el-pagination
              next-text="下一页"
              :current-page="pageNum"
              :page-sizes="[10, 20, 30, 40]"
              :page-size="pageSize"
              layout="total, sizes, prev, pager, next, jumper"
              :total="tableData.length"
              @size-change="handleSizeChange"
              @current-change="handleCurrentChange"
            />
          </div>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Close } from '@element-plus/icons-vue'
import metricLineChart from './metricLineChart.vue'
import {
  funnelAnalysisAllDimsApi,
  taskFetchApi,
  taskRueryApi,
} from '@/api/sysmanage/customAnalysis'
import { copyObj } from '@/utils/copy'
import { filterTimeFormatUnified } from '@/utils/date'
import { useLatestOnly } from '@/composables/useLatestOnly'
import type { ByFieldItem } from '@/components/analysis-model/types'
import type {
  FunnelModelObject,
  FunnelResult,
  FunnelRow,
  GroupOption,
  StepTabOption,
  TableColumn,
  TaskFetchData,
  TaskInstanceData,
  TaskQueryData,
} from '../types'

/**
 * 某个时间点下的「全维度」漏斗明细弹窗。
 * 与 v2 的 src/views/funnel-analysis/components/dimDetailDialog.vue 一一对应。
 */
defineOptions({ name: 'DimDetailDialog' })

const { next, isLatest } = useLatestOnly()

const visible = ref(false)
const loading = ref(false)
const title = ref('')
const measurementType = ref('UV')
/** 与 v2 一致：pointItem / tabValue / guideLine 只服务于被注释掉的「显示设置」，保留但不渲染 */
const tabOptions = ref<StepTabOption[]>([])
const groupValues = ref<string[]>([])
const byValuesGroupList = ref<GroupOption[]>([])
const tableData = ref<FunnelRow[]>([])
const tableColumns = ref<TableColumn[]>([])
const byFields = ref<ByFieldItem[]>([])
const customNameList = ref<string[]>([])
const allStepsSum = ref<Partial<FunnelRow>>({})
const pageNum = ref(1)
const pageSize = ref(10)
const modelObject = ref<FunnelModelObject | null>(null)
const fetchData = ref<FunnelResult | null>(null)

const metricLineChartRef = ref<InstanceType<typeof metricLineChart> | null>(null)

/** 轮询定时器。必须在 onBeforeUnmount 清理，否则弹窗销毁后还会继续打接口（资源泄漏） */
let polling: ReturnType<typeof setInterval> | null = null

function clearPolling() {
  if (polling) {
    clearInterval(polling)
    polling = null
  }
}

const pagedTableData = computed(() =>
  tableData.value.slice((pageNum.value - 1) * pageSize.value, pageNum.value * pageSize.value),
)

/** v2 用的是 moment().startOf('isoWeek')，这里按同样的语义（周一为一周第一天）手写 */
function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function formatYMD(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function formatYM(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`
}

function startOfIsoWeek(dateStr: string) {
  const date = new Date(dateStr)
  const day = date.getDay() // 0 = 周日
  const diff = day === 0 ? 6 : day - 1
  date.setDate(date.getDate() - diff)
  return date
}

function endOfIsoWeek(dateStr: string) {
  const date = startOfIsoWeek(dateStr)
  date.setDate(date.getDate() + 6)
  return date
}

function startOfMonth(dateStr: string) {
  const date = new Date(dateStr)
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function endOfMonth(dateStr: string) {
  const date = new Date(dateStr)
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

function open(row: FunnelRow, model: FunnelModelObject, columns: TableColumn[]) {
  modelObject.value = copyObj(model)
  tableColumns.value = columns
  byFields.value = model.byFields || []
  customNameList.value = model.steps.map((s) => s.customName)
  measurementType.value = model.measurement || 'UV'
  visible.value = true
  loading.value = true
  tableData.value = []
  pageNum.value = 1

  // 重要：直接使用主表格传入的 row 作为左侧漏斗的数据，确保数据完全一致
  allStepsSum.value = copyObj(row)

  // 处理时间解析和标题显示
  const dataType = modelObject.value?.dataType
  let startDate = row.dimDate
  let endDate = row.dimDate
  let displayTitle = row.dimDate

  if (dataType === 'week') {
    if (row.dimDate && row.dimDate.includes('~')) {
      const dates = row.dimDate.split('~')
      startDate = dates[0] ?? ''
      endDate = dates[1] ?? ''
      displayTitle = row.dimDate
    } else {
      startDate = formatYMD(startOfIsoWeek(row.dimDate))
      endDate = formatYMD(endOfIsoWeek(row.dimDate))
      displayTitle = `${startDate} ~ ${endDate}`
    }
  } else if (dataType === 'month') {
    startDate = formatYMD(startOfMonth(row.dimDate))
    endDate = formatYMD(endOfMonth(row.dimDate))
    displayTitle = `${formatYM(new Date(row.dimDate))} (${startDate} ~ ${endDate})`
  }

  title.value = displayTitle
  handleAnalysis(startDate, endDate)
}

function handleAnalysis(startDate: string, endDate: string) {
  const params = copyObj(modelObject.value) as unknown as Record<string, unknown>
  params.startDate = startDate
  params.endDate = endDate
  // 这里可以根据主页面的逻辑进一步细化周/月的时间处理，如果需要的话

  const token = next()
  funnelAnalysisAllDimsApi<TaskInstanceData>(params)
    .then((res) => {
      if (!isLatest(token)) return
      if (res?.code === 200 && res.data) {
        startPolling(res.data.instanceId, token)
      } else {
        ElMessage.error(res?.msg ?? '')
        loading.value = false
      }
    })
    .catch(() => {
      if (!isLatest(token)) return
      loading.value = false
    })
}

function startPolling(instanceId: string, token: number) {
  clearPolling()
  polling = setInterval(() => {
    taskRueryApi<TaskQueryData>({ instanceId, projectName: modelObject.value?.projectName })
      .then((res) => {
        if (!isLatest(token)) return clearPolling()
        if (res?.code === 200) {
          if (res.data?.code === 200) {
            clearPolling()
            fetchResult(instanceId, token)
          } else if (res.data?.code !== 102) {
            clearPolling()
            ElMessage.error(res.msg || '查询失败')
            loading.value = false
          }
        } else {
          clearPolling()
          loading.value = false
        }
      })
      .catch(() => {
        clearPolling()
        if (!isLatest(token)) return
        loading.value = false
      })
  }, 2000)
}

function fetchResult(instanceId: string, token: number) {
  taskFetchApi<TaskFetchData>({ instanceId, projectName: modelObject.value?.projectName })
    .then((res) => {
      if (!isLatest(token)) return
      loading.value = false
      if (res?.code === 200 && res.data?.result) {
        initData(res.data.result)
      }
    })
    .catch(() => {
      if (!isLatest(token)) return
      loading.value = false
    })
}

function initData(res: FunnelResult) {
  fetchData.value = res
  // 分组列表 - 弹窗内保留维度分组
  byValuesGroupList.value = (res.byValuesList || []).map((item) => {
    const label = item[0] === '$ALL' ? '总体' : item.flat().join(',')
    return { id: label == '总体' ? '$ALL' : label, label }
  })
  // 限制最多6个
  groupValues.value = byValuesGroupList.value.slice(0, 6).map((item) => item.id)

  // 拆分数据
  // 弹窗内的表格展示详细维度数据，过滤掉 $ALL
  const otherData = res.rows.filter((row) => row.dimDate !== '$ALL')
  tableData.value = otherData

  // 选项
  tabOptions.value = customNameList.value.map((name, index) => ({
    value: index,
    label: index == 0 ? '第1步' : '第' + index + '步转化',
  }))
  // 与 v2 一致：v2 注释掉了 unshift({ value: 'all', label: "总体转换" })

  void nextTick(() => {
    echartsInit()
  })
}

function echartsInit() {
  if (metricLineChartRef.value && fetchData.value) {
    metricLineChartRef.value.initChart(fetchData.value, groupValues.value, 'dim')
  }
}

function handleGroupLimit(val: string[]) {
  if (val.length > 6) {
    ElMessage.warning('一次最多只能选择6个，需取消再勾选')
    groupValues.value = val.slice(0, 6)
    return
  }
  echartsInit()
}

function handleSortChange({ prop, order }: { prop: string; order: string | null }) {
  if (!order) return
  tableData.value.sort((a, b) => {
    let valA: string | number
    let valB: string | number
    if (prop === 'total_converted_user') {
      valA = a.convertedUser || 0
      valB = b.convertedUser || 0
    } else if (prop && prop.startsWith('step_') && prop.endsWith('_users')) {
      const index = parseInt(prop.split('_')[1] ?? '')
      valA = a.steps && a.steps[index] ? (a.steps[index]?.convertedUser ?? 0) : 0
      valB = b.steps && b.steps[index] ? (b.steps[index]?.convertedUser ?? 0) : 0
    } else if (prop && prop.startsWith('by_')) {
      const index = parseInt(prop.split('_')[1] ?? '')
      valA = a.byValues[index] ?? ''
      valB = b.byValues[index] ?? ''
    } else {
      return 0
    }

    if (order === 'ascending') {
      return valA > valB ? 1 : -1
    } else {
      return valA < valB ? 1 : -1
    }
  })
  pageNum.value = 1
}

const totalRate = computed(() =>
  allStepsSum.value.conversionRate ? allStepsSum.value.conversionRate.toFixed(2) + '%' : '0%',
)

function filterAllPercent(index: number, type: string) {
  const steps = allStepsSum.value.steps
  if (!steps) return type === 'rate' ? '0%' : 0
  const step = steps[index]
  if (type === 'rate')
    return step ? (step.conversionRate ? step.conversionRate.toFixed(2) + '%' : '0%') : '0%'
  return step ? step.convertedUser || 0 : 0
}

function formatDateUnified(val: unknown, item: ByFieldItem) {
  if (item.dataType === 'DATETIME') return filterTimeFormatUnified(val)
  return val
}

function handleSizeChange(val: number) {
  pageNum.value = 1
  pageSize.value = val
}

function handleCurrentChange(val: number) {
  pageNum.value = val
}

onBeforeUnmount(() => {
  // v2 的 beforeDestroy 里也清了 polling，这里保持一致并统一走 clearPolling
  clearPolling()
})

defineExpose({ open })
</script>

<style lang="scss" scoped>
.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.chart_container {
  display: flex;
  min-height: 500px;
}

.triangle_container {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 55px;
  justify-content: center;

  .triangle-rectangle {
    position: relative;
    width: 100px;
    height: 30px;
    background-color: #488bff;
    color: #fff;
  }

  .triangle {
    width: 0;
    height: 0;
    border-left: 50px solid transparent;
    border-right: 50px solid transparent;
    border-bottom: 25px solid #488bff;
    transform: rotate(-180deg);
    margin-bottom: 10px;
    color: #fff;
    margin-top: -1px;
  }

  .remarkCon {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    position: absolute;
    top: 25px;
    color: #fff;
    transform: translate(0, -50%);
    font-size: 12px;
  }
}

.sing_item {
  width: 100%;
  height: 50px;
  display: flex;
  align-items: center;
  background-color: #f2f5fa;
  margin-bottom: 10px;
  font-size: 13px;
  padding: 0 10px;
  border-radius: 6px;

  .stepIndex {
    width: 70px;
    height: 30px;
    background-color: #e5ebf2;
    margin-right: 10px;
    border-radius: 4px;
    line-height: 30px;
    text-align: center;
  }

  .name {
    width: calc(100% - 80px - 20%);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .num {
    display: flex;
    width: 20%;
    align-items: center;

    p {
      border-bottom: 1px solid #b5b5b6;
    }
  }
}

.searchLable {
  font-size: 13px;
  color: #606266;
}

.col_left {
  width: 30%;
  height: 500px;
  overflow: auto;
  padding: 0 20px;
}

.col_right {
  width: 70%;
  padding: 0 20px;
}
</style>

<!-- 弹窗与 popper 都挂到 body，需非 scoped 才能生效 -->
<style lang="scss">
/**
 * v2 写在 scoped 的 ::v-deep { .regional-dialog-custom { ... } } 里，取值一字不差搬过来。
 * v3 里 append-to-body 的 el-dialog 会被 teleport 到 body，scoped 的 :deep() 选不中它，
 * 所以改成按自定义类名限定的全局规则（作用范围仍然只有这个弹窗）。
 */
.regional-dialog-custom {
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

.dim-value-select-dropdown {
  max-width: 300px !important;

  .el-select-dropdown__item {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
