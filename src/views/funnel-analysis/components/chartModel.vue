<template>
  <div class="model-page">
    <div
      style="
        height: 40px;
        border-bottom: 1px solid #f2f5fa;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        position: relative;
        font-size: 13px;
      "
    >
      <div style="line-height: 40px">
        {{ modelObject?.name ? '“ ' + modelObject.name + ' ”' + '漏斗转化分析' : '漏斗转化分析' }}
      </div>

      <div style="position: absolute; right: 50px; display: flex">
        <div style="display: flex; align-items: center">
          <div class="searchLable">时间:</div>
          <el-select
            v-model="groupValues"
            style="margin: 0 20px; width: 300px"
            multiple
            collapse-tags
            placeholder="请选择"
            filterable
            @change="handleGroupLimt"
          >
            <el-option
              v-for="(item, index) in byValuesGroupList"
              :key="index"
              :label="item.label"
              :value="item.id"
            />
          </el-select>
        </div>

        <el-popover
          popper-class="zc_popover"
          placement="bottom"
          :width="300"
          trigger="click"
          style="background: #fff !important"
        >
          <div>
            <el-tabs v-model="tabValue" @tab-click="handleClick">
              <el-tab-pane label="显示指标" name="point">
                <el-radio-group
                  v-model="pointItem"
                  style="
                    display: flex;
                    flex-direction: column;
                    line-height: 50px;
                    max-height: 200px;
                    overflow: auto;
                  "
                  @change="checkPointStep"
                >
                  <el-radio v-for="item in tabOptions" :key="item.value" :value="item.value">
                    {{ item.label }}
                  </el-radio>
                </el-radio-group>
              </el-tab-pane>
              <el-tab-pane label="显示辅助线" name="guide">
                <el-checkbox-group v-model="guideLine" @change="checkGuide">
                  <el-checkbox value="line">均值辅助线</el-checkbox>
                </el-checkbox-group>
              </el-tab-pane>
            </el-tabs>
          </div>
          <!-- 与 v2 一致：「显示设置」这个 reference 按钮在 v2 里是注释掉的，
               所以这个 popover 实际上永远不会被触发 -->
        </el-popover>
      </div>
    </div>
    <div id="screenshot-box" class="chart_container">
      <div class="col_left">
        <div class="triangle_container">
          <div class="triangle-rectangle" style="height: 40px"></div>
          <div
            class="triangle"
            style="border-bottom: 25px solid #488bff; transform: rotate(-180deg); margin-top: -1px"
          ></div>
          <div class="remarkCon">
            <span style="margin-top: 5px"> 总转化率 </span>
            <span style="margin-top: 5px">{{ totalRate }}</span>
          </div>
        </div>
        <div style="height: 400px; overflow: auto">
          <div
            v-for="(item, index) in customNameList"
            :key="index"
            style="display: flex; flex-direction: column; align-items: center"
          >
            <div v-if="index != 0" class="triangle_container">
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
      <!-- echarts图表展示内容 -->
      <div class="col_right">
        <metricLineChart ref="metricLineChartRef" />
      </div>
    </div>
    <el-table
      border
      :header-cell-style="{ textAlign: 'center', background: '#f7fafe ' }"
      :cell-style="tableCellStyle"
      class="public-radius"
      :data="pagedTableData"
      style="width: 100%; margin-top: 30px"
      @sort-change="handleSortChange"
    >
      <el-table-column
        fixed="left"
        prop="dimDate"
        label="时间"
        width="150"
        align="left"
        sortable="custom"
      >
        <template #default="scope">
          <div
            style="display: flex; align-items: center; width: 100%"
            :style="
              byFieldsNames && byFieldsNames.length > 0
                ? 'justify-content: space-between;'
                : 'justify-content: center'
            "
          >
            <span>{{ scope.row.dimDate }}</span>
            <img
              v-if="byFieldsNames && byFieldsNames.length > 0"
              src="@/assets/images/showFlag.png"
              style="width: 14px; height: 14px; cursor: pointer; margin-left: 5px"
              alt="查看详情"
              @click.stop="handleTimeClick(scope.row)"
            />
          </div>
        </template>
      </el-table-column>

      <el-table-column
        v-for="(col, index) in tableColumns"
        :key="index"
        :label="col.label"
        align="center"
      >
        <el-table-column
          v-for="(subCol, subIndex) in col.children"
          :key="subIndex"
          :prop="subCol.prop"
          :label="subCol.label"
          :width="subCol.width"
          :sortable="subCol.sortable"
          align="center"
        >
          <template #default="scope">
            <span>
              <template v-if="subCol.prop === 'total_converted_user'">
                {{ scope.row.convertedUser }}
              </template>
              <template v-else-if="subCol.prop === 'total_conversion_rate'">
                {{ scope.row.conversionRate.toFixed(2) }}
              </template>
              <template v-else-if="scope.row.steps && scope.row.steps[index - 1]">
                <template v-if="subCol.label === '人数' || subCol.label === '次数'">
                  {{ scope.row.steps[index - 1].convertedUser }}
                </template>
                <template v-else-if="subCol.label === '转化率'">
                  {{ scope.row.steps[index - 1].conversionRate.toFixed(2) }}
                </template>
              </template>
              <template v-else>0</template>
              <span v-if="subCol.isRate">%</span>
            </span>
          </template>
        </el-table-column>
      </el-table-column>
    </el-table>
    <div class="block">
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

    <dimDetailDialog ref="dimDetailDialogRef" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import funnelEchart from './funnelEchart.vue'
import dimDetailDialog from './dimDetailDialog.vue'
import metricLineChart from './metricLineChart.vue'
import { makeTableCellCenterByIndex } from '@/utils/index'
import type { ByFieldItem } from '@/components/analysis-model/types'
import type {
  FunnelModelObject,
  FunnelResult,
  FunnelRow,
  GroupOption,
  StepTabOption,
  TableColumn,
} from '../types'

/**
 * 漏斗分析结果区（左侧漏斗 + 右侧折线图 + 明细表）。
 * 与 v2 的 src/views/funnel-analysis/components/chartModel.vue 一一对应。
 *
 * v2 里还有一批完全没有被模板或其它方法引用的死代码
 * （onSaveCanvas / convertBase64ToBlob / downFileToLocal / handleSize / filtersAllSum /
 *  filterTetsEvent / openTableEvent / filterTableLable / formatDateUnified，以及
 *  moment、funnelAnalysisAllDimsApi 等只 import 没使用的依赖），迁移时不再保留。
 */
const measurementType = ref('UV')
const pointItem = ref(0)
const tabOptions = ref<StepTabOption[]>([])
const guideLine = ref<string[]>([])
// 翻页功能
const pageSize = ref(10)
const pageNum = ref(1)
const fetchData = ref<FunnelResult | null>(null)
/** 分组值 */
const groupValues = ref<string[]>([])
/** 分组事件 */
const byValuesGroupList = ref<GroupOption[]>([])
/** 模型构造 */
const modelObject = ref<FunnelModelObject | null>(null)
/** 总体事件 */
const allStepsSum = ref<Partial<FunnelRow>>({})
const customNameList = ref<string[]>([])
const tableData = ref<FunnelRow[]>([])
/** 平铺维度展示 */
const byFieldsNames = ref<ByFieldItem[]>([])
const tableColumns = ref<TableColumn[]>([])
const tabValue = ref('point')

const metricLineChartRef = ref<InstanceType<typeof metricLineChart> | null>(null)
const dimDetailDialogRef = ref<InstanceType<typeof dimDetailDialog> | null>(null)
/**
 * 与 v2 一致（v2 此处逻辑存疑：checkGuide 里用的 this.$refs.funnelEchartRef 在模板里
 * 并不存在 —— funnelEchart 组件虽然注册了却没有被渲染 —— 所以这个 ref 恒为 null，
 * v2 点开辅助线会直接报错，这里退化成静默无操作）。
 */
const funnelEchartRef = ref<InstanceType<typeof funnelEchart> | null>(null)

/**
 * v2 的 tableHeaderColor：第 0 列左对齐，其余居中。
 * v2 返回的是 "text-align:left" 字符串，element-plus 会对返回值做 Object.assign，
 * 字符串会被展开成 {0:'t',...} 并报 Failed to set an indexed property，必须返回对象。
 */
const tableCellStyle = makeTableCellCenterByIndex([], [0])

const pagedTableData = computed(() =>
  tableData.value.slice((pageNum.value - 1) * pageSize.value, pageNum.value * pageSize.value),
)

const totalRate = computed(() => {
  if (allStepsSum.value && allStepsSum.value.conversionRate) {
    return allStepsSum.value.conversionRate.toFixed(2) + '%'
  }
  // 与 v2 一致：这里返回的是数字 0 而不是字符串 '0%'
  return 0
})

/** 次数 / 人数 */
function filterAllPercent(index: number, type: string) {
  const steps = allStepsSum.value.steps
  if (type == 'rate') {
    if (steps && steps.length > 0) {
      const rate = steps[index]?.conversionRate
      return rate ? rate.toFixed(2) + '%' : '0'
    }
    return '0%'
  }
  if (steps && steps.length > 0) {
    return steps[index]?.convertedUser || 0
  }
  return 0
}

/** 接收接口参数 */
function modelListEvent(res: FunnelResult, modelObj: FunnelModelObject) {
  modelObject.value = modelObj
  measurementType.value = modelObj.measurement || 'UV'
  fetchData.value = res
  // 生成分组事件列表 - 外部页面改为放时间
  byValuesGroupList.value = (res.dateList || [])
    .filter((date) => date !== '$ALL')
    .map((date) => ({ id: date, label: date }))

  // 取前6项作为默认值
  groupValues.value = byValuesGroupList.value.slice(0, 6).map((item) => item.id)
  // 处理 byFields 维度，提取 name 字段
  byFieldsNames.value = []

  if (modelObj && Array.isArray(modelObj.byFields)) {
    // 与 v2 一致：v2 注释掉了只取 name 的写法，直接把整个 byFields 放进来
    byFieldsNames.value = modelObj.byFields
  }
  // 一. table 平铺渲染格式，总转换率步骤展示
  if (res.rows) {
    // 拆分 $ALL 和其它数据
    const allData = res.rows.find((row) => row.dimDate === '$ALL')
    const otherData = res.rows.filter((row) => row.dimDate !== '$ALL')
    allStepsSum.value = allData || {}
    tableData.value = otherData
  }
  // 维度展示名称过滤

  customNameList.value = modelObj.steps.map((item) => item.customName)
  const columns: TableColumn[] = []
  const stepsCount = customNameList.value.length
  if (stepsCount > 1) {
    columns.push({
      label: `第 1 步 → 第 ${stepsCount} 步 总值`,
      children: [
        {
          prop: 'total_converted_user',
          label: modelObj.measurement == 'UV' ? '总转化人数' : '总转化次数',
          width: 120,
          sortable: 'custom',
        },
        {
          prop: 'total_conversion_rate',
          label: '总转化率',
          isRate: true,
          width: 120,
        },
      ],
    })
  }

  customNameList.value.forEach((name, i) => {
    if (i === 0) {
      columns.push({
        label: `第 1 步: ${name}`,
        children: [
          {
            prop: `step_0_users`,
            label: modelObj.measurement == 'UV' ? '人数' : '次数',
            sortable: 'custom',
          },
        ],
      })
    } else {
      columns.push({
        label: `第 ${i} 步 → 第 ${i + 1} 步`,
        children: [
          {
            prop: `step_${i}_conv_rate`,
            label: '转化率',
            isRate: true,
          },
          {
            prop: `step_${i}_users`,
            label: modelObj.measurement == 'UV' ? '人数' : '次数',
            sortable: 'custom',
          },
        ],
      })
    }
  })
  tabOptions.value = []
  tabOptions.value = customNameList.value.slice(0).map((name, index) => ({
    value: index,
    label: index == 0 ? '第1步' : '第' + index + '步转化',
  }))
  // 与 v2 一致：v2 注释掉了 unshift({ value: 'all', label: "总体转换" })
  tableColumns.value = columns
  echartsInit(res)
}

function checkPointStep() {
  // 在新的图表逻辑中，X轴是固定的指标，点击"显示指标"单选框可能需要高亮对应点或者重绘
  // 这里暂时保持 initChart，或者如果只是简单的 X 轴指标图，单选框可能不再适用
  if (fetchData.value) {
    metricLineChartRef.value?.initChart(fetchData.value, groupValues.value, 'date')
  }
}

function handleGroupLimt(val: string[]) {
  if (val.length > 10) {
    ElMessage.warning('单次选择数量请勿超过10个，请分批操作')
    groupValues.value = val.slice(0, 10)
    return
  }
  if (fetchData.value) {
    metricLineChartRef.value?.initChart(fetchData.value, groupValues.value, 'date')
  }
}

/** 辅助线 */
function checkGuide() {
  funnelEchartRef.value?.guideLineEvent(guideLine.value, pointItem.value)
}

function echartsInit(res: FunnelResult) {
  metricLineChartRef.value?.initChart(res, groupValues.value, 'date')
}

function handleSortChange({ prop, order }: { prop: string; order: string | null }) {
  if (!order) return
  tableData.value.sort((a, b) => {
    let valA: string | number
    let valB: string | number
    if (prop === 'dimDate') {
      valA = a.dimDate
      valB = b.dimDate
    } else if (prop === 'total_converted_user') {
      valA = a.convertedUser || 0
      valB = b.convertedUser || 0
    } else if (prop && prop.startsWith('step_') && prop.endsWith('_users')) {
      const index = parseInt(prop.split('_')[1] ?? '')
      valA = a.steps && a.steps[index] ? (a.steps[index]?.convertedUser ?? 0) : 0
      valB = b.steps && b.steps[index] ? (b.steps[index]?.convertedUser ?? 0) : 0
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

function handleClick() {}

function handleSizeChange(val: number) {
  pageNum.value = 1
  pageSize.value = val
}

function handleCurrentChange(val: number) {
  pageNum.value = val
}

function handleTimeClick(row: FunnelRow) {
  if (!modelObject.value) return
  dimDetailDialogRef.value?.open(row, modelObject.value, tableColumns.value)
}

defineExpose({ modelListEvent })
</script>

<style lang="scss" scoped>
// v2 这里在 ::v-deep 块内 @import 了 el-pagination.scss，v3 已经全局引入，不再重复引入
:deep(.regional-dialog-custom) {
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

.click-text {
  color: #2c7bed;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}

:deep(.el-dialog__headerbtn) {
  top: 15px;
}

:deep(.el-dialog__header) {
  padding: 0 !important;
  border-radius: 6px 6px 0px 0px;
}

:deep(.el-dialog__body) {
  padding: 0;
  background-color: #eef4fd;
  border-radius: 6px;
}

:deep(.el-radio) {
  line-height: 25px;
}

.demo-table-expand {
  font-size: 0;
}

.demo-table-expand label {
  width: 90px;
  color: #99a9bf;
}

.demo-table-expand .el-form-item {
  margin-right: 0;
  margin-bottom: 0;
  width: 50%;
}

.el-loading-spinner .circular {
  width: 30px;
  height: 30px;
}

// 与 v2 一致（v2 此处逻辑存疑：模板里用了 .searchLable，但 v2 的 chartModel.vue 并没有定义它，
// 该类只在 dimDetailDialog.vue 的 scoped 样式里存在，所以这里的「时间:」在 v2 里就是没样式的）

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
  }
}

.model-page {
  width: 100%;
  min-height: 500px;
  background-color: #fff;

  .customEchart {
    width: 100%;
    height: 500px;
  }

  .chart_container {
    display: flex;

    .col_left {
      width: 30%;
      height: 500px;
      overflow: auto;
      padding: 0 20px;

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
    }

    .col_right {
      width: 70%;
      padding: 0 20px;
    }
  }
}
</style>
