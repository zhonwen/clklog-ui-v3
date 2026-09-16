<template>
  <div class="logCon">
    <div v-if="tableData.length > 0">
      <el-radio-group v-model="tabPosition" class="customTab" @change="checkTableEvent">
        <el-radio-button value="stratification">
          <el-icon><Fold /></el-icon>分层
        </el-radio-button>
        <el-radio-button value="Tile">
          <el-icon><Fold /></el-icon>平铺
        </el-radio-button>
      </el-radio-group>

      <!-- 平铺表格 -->
      <div v-if="tabPosition == 'Tile'">
        <el-table
          class="public-radius"
          border
          :header-cell-style="{ textAlign: 'center', background: '#f7fafe ' }"
          :cell-style="{ textAlign: 'center' }"
          :data="pagedData"
          :span-method="objectSpanMethod"
          style="width: 100%"
        >
          <el-table-column
            fixed
            label="序号"
            type="index"
            :width="proxy?.$fixedWidth.FwIndex"
            align="center"
          >
            <template #default="scope">
              <span v-text="getIndex(scope.$index)" />
            </template>
          </el-table-column>
          <el-table-column
            v-for="(item, index) in TileLabel"
            :key="index"
            :label="item"
            :prop="item"
            align="left"
            :show-overflow-tooltip="false"
            :fixed="index > fixedBoundary ? false : true"
            :width="item == '指标' || index < demisionLabel.length ? '190px' : ''"
          >
            <!-- 与 v2 一致（v2 写的是 :show-overflow-tooltip="item == '指标' ? false : false"，恒为 false） -->
            <!-- 维度大于零时展示 -->
            <template #default="{ row }">
              <div v-if="demisionLabel.length > 0 && index < demisionLabel.length">
                <div v-if="row.byFields[index] == 'DATETIME'">
                  {{ processTimestampsAsync(row.byValues[index]) }}
                </div>
                <div v-else>{{ row.byValues[index] }}</div>
              </div>
              <div v-if="item == '指标'" style="text-align: left">
                <div
                  v-for="(pointer, pointerIndex) in row.pointList"
                  :key="pointerIndex"
                  style="text-align: left"
                >
                  <div :style="rowBorderStyle(pointerIndex + 1 == row.pointList.length)">
                    <el-popover placement="top" trigger="hover">
                      <div>
                        {{ pointer }}
                      </div>
                      <template #reference>
                        <div
                          class="customItem"
                          style="overflow: hidden; white-space: nowrap; text-overflow: ellipsis"
                        >
                          {{ pointer }}
                        </div>
                      </template>
                    </el-popover>
                  </div>
                </div>
              </div>
              <!-- 计算合计值 -->
              <div v-if="item == '总计'" style="text-align: left">
                <div
                  v-for="(pointer, pointerIndex) in row.pointList"
                  :key="pointerIndex"
                  style="text-align: center"
                >
                  <div :style="rowBorderStyle(pointerIndex + 1 == row.pointList.length)">
                    <div class="customItem">
                      {{ summaryList(row.values, pointerIndex) }}
                    </div>
                  </div>
                </div>
              </div>
              <div v-if="index > demisionLabel.length">
                <!-- +2的情况是存在于固定了两个label -->
                <div
                  v-for="(value, valueIndex) in row.values[index - (demisionLabel.length + 2)] || []"
                  :key="valueIndex"
                  :style="rowBorderStyle(valueIndex + 1 == row.pointList.length)"
                >
                  <div v-if="filterRows(value) || filterRows(value) == 0">
                    <div class="customItem">{{ filterRows(value) }}</div>
                  </div>
                  <div v-else style="height: 25px" />
                </div>
              </div>
            </template>
          </el-table-column>
        </el-table>
        <div class="block">
          <el-pagination
            v-model:current-page="pageNum"
            v-model:page-size="pageSize"
            next-text="下一页"
            :page-sizes="[10, 20, 30, 40]"
            layout="total, sizes, prev, pager, next, jumper"
            :total="total"
            @size-change="handleSizeChange"
            @current-change="handleCurrentChange"
          />
        </div>
      </div>
      <!-- 分层表格 -->
      <div v-if="tabPosition == 'stratification'">
        <el-table
          class="public-radius"
          border
          :header-cell-style="{ textAlign: 'center', background: '#f7fafe ' }"
          :cell-style="{ textAlign: 'center' }"
          :data="pagedData"
          :span-method="objectSpanMethod"
          style="width: 100%"
        >
          <el-table-column
            fixed
            label="序号"
            type="index"
            :width="proxy?.$fixedWidth.FwIndex"
            align="center"
          >
            <template #default="scope">
              <span v-text="getIndex(scope.$index)" />
            </template>
          </el-table-column>
          <el-table-column
            v-for="(item, index) in stratificaLabel"
            :key="index"
            :label="item"
            :prop="item"
            :fixed="index > fixedBoundary ? false : true"
            :width="item == '日期' || index < demisionLabel.length ? '190px' : ''"
          >
            <template #default="{ row }">
              <!-- 分层 维度 -->
              <div v-if="demisionLabel.length > 0 && index < demisionLabel.length">
                {{ row.byValues[index] }}
              </div>
              <!-- 日期 -->
              <div v-if="item == '日期'">
                <div style="border-bottom: 1px solid rgb(215 225 229); padding: 5px 0">
                  <div class="customItem">总计</div>
                </div>
                <div
                  v-for="(date, dateIndex) in row.series || []"
                  :key="dateIndex"
                  style="text-align: center"
                >
                  <div :style="rowBorderStyle(dateIndex + 1 == (row.series || []).length)">
                    <div class="customItem">{{ date }}</div>
                  </div>
                </div>
              </div>
              <!-- 汇总 -->
              <div v-if="index > demisionLabel.length">
                <div style="border-bottom: 1px solid rgb(215 225 229); padding: 5px 0">
                  <div class="customItem">
                    {{ summaryList(row.values, index - demisionLabel.length - 1) }}
                  </div>
                </div>
                <div
                  v-for="(value, valueIndex) in row.values"
                  :key="valueIndex"
                  :style="rowBorderStyle(valueIndex + 1 == row.values.length)"
                >
                  <div v-if="filterRows(value[index - demisionLabel.length - 1])">
                    <div class="customItem">
                      {{ filterRows(value[index - demisionLabel.length - 1]) }}
                    </div>
                  </div>
                  <div v-else style="height: 25px" />
                </div>
              </div>
            </template>
          </el-table-column>
        </el-table>
        <div class="block">
          <el-pagination
            v-model:current-page="pageNum"
            v-model:page-size="pageSize"
            next-text="下一页"
            :page-sizes="[10, 20, 30, 40]"
            layout="total, sizes, prev, pager, next, jumper"
            :total="total"
            @size-change="handleSizeChange"
            @current-change="handleCurrentChange"
          />
        </div>
      </div>
    </div>
    <div v-else style="font-size: 18px; line-height: 438px; text-align: center">暂无数据</div>
  </div>
</template>

<script setup lang="ts">
import { computed, getCurrentInstance, ref } from 'vue'
import { Fold } from '@element-plus/icons-vue'
import { copyObj } from '@/utils/copy'
import { filterTimeFormatUnified } from '@/utils/date'
import type { ModelObject, ResultDetail, ResultRow } from '../types'

const proxy = getCurrentInstance()?.proxy

/** 平铺 / 分层。类型放宽到 string 是为了接住 el-radio-group 的 update:modelValue */
const tabPosition = ref<string>('Tile')
const tableData = ref<ResultRow[]>([])
const pageNum = ref(1)
const pageSize = ref(10)
const total = ref(0)
const demisionLabel = ref<string[]>([])
/** 平铺表头 */
const TileLabel = ref<string[]>([])
/** 分层表头 */
const stratificaLabel = ref<string[]>([])

const pagedData = computed(() =>
  tableData.value.slice((pageNum.value - 1) * pageSize.value, pageNum.value * pageSize.value),
)

/** 固定列的边界：最多固定到第 4 列（v2 的 filterLength(demisionLabel.length + 1)） */
const fixedBoundary = computed(() => filterLength(demisionLabel.value.length + 1))

function processTimestampsAsync(val: unknown) {
  return filterTimeFormatUnified(val)
}

/** 每行内部的分隔线，最后一行不画下边框 */
function rowBorderStyle(isLast: boolean) {
  return isLast
    ? { padding: '5px 0' }
    : { borderBottom: '1px solid rgb(215 225 229)', padding: '5px 0' }
}

function initTableEvent(val: ResultDetail, modelObject: ModelObject) {
  if (val.rows.length > 0) {
    // 表格 data
    const series = val.series
    tableData.value = copyObj(val.rows)
    tableData.value.map((item) => (item.series = series))
    // 平铺 label
    const tile = copyObj(val.series)
    tile.unshift('总计')
    tile.unshift('指标')
    // v2 是 modelObject.byFields.map((item) => item.name)；维度没选中属性时 name 是 undefined，
    // 这里兜成空串，渲染结果一致（Vue 对 undefined 与 '' 都渲染成空）
    demisionLabel.value = modelObject.byFields.map((item) => item.name ?? '') || []
    TileLabel.value = [...demisionLabel.value, ...tile]
    // 分层 label
    const first = tableData.value[0]
    const labelList = copyObj(first?.pointList) || []
    labelList.unshift('日期')
    stratificaLabel.value = [...demisionLabel.value, ...labelList]
  } else {
    TileLabel.value = []
    tableData.value = []
  }
  pageNum.value = 1
  total.value = tableData.value.length
}

function filterLength(length: number) {
  if (length > 4) {
    return 4
  }
  return length
}

/** 某一指标在所有时间点上的合计 */
function summaryList(data: (number | string)[][], index: number) {
  let sum: number | string = 0
  for (let i = 0; i < data.length; i++) {
    let num: number | string = 0
    const row = data[i]
    const cell = row ? row[index] : undefined
    if (cell) {
      if (cell != 'NAN') {
        if (Number.isInteger(cell)) {
          num = cell
        } else {
          if (cell == 'NaN') {
            num = 0
          } else {
            num = Number(cell).toFixed(2)
          }
        }
      } else {
        num = 0
      }
    }
    sum = parseFloat(String(sum)) + parseFloat(String(num))
  }
  return sum
}

function filterRows(value: number | string | null | undefined): number | string {
  if (value == 'NaN') {
    return 0
  }
  if (value) {
    if (Number.isInteger(value)) {
      return value
    }
    // v2 这里直接 value.toFixed(2)，值若是字符串会抛错；这里统一转成数值再格式化，展示结果一致
    return Number(value).toFixed(2)
  } else if (value == 0) {
    return 0
  } else {
    return ''
  }
}

function getIndex($index: number) {
  return (pageNum.value - 1) * pageSize.value + $index + 1
}

/** 与 v2 一致：v2 的 objectSpanMethod 是空实现，返回 undefined 即走默认不合并 */
function objectSpanMethod() {
  return undefined
}

function handleSizeChange(val: number) {
  pageNum.value = 1
  pageSize.value = val
}

function handleCurrentChange(val: number) {
  pageNum.value = val
}

function checkTableEvent() {
  pageSize.value = 10
  pageNum.value = 1
}

defineExpose({ initTableEvent })
</script>

<style lang="scss" scoped>
:deep(.el-table__body-wrapper) {
  z-index: 2;
}

:deep(.el-table__fixed-footer-wrapper tbody td.custom-cell) {
  border-right: 1px solid #dbdfe5 !important;
}

// el-pagination 的样式已在 src/styles/index.scss 全局引入，组件内不再重复 @use

:deep(.customTab) {
  margin-bottom: 20px;

  .el-radio-button__inner {
    height: 30px;
    line-height: 12px;
    font-size: 12px;
    padding: 10px 7px;
  }
}

// 自定义table样式
:deep(.el-table td) {
  padding: 0 0;
}

:deep(.el-table .cell) {
  padding-left: 0;
  padding-right: 0;
}

.customItem {
  padding: 0 10px;
  height: 25px;
  line-height: 25px;
}

.logCon {
  width: 100%;
  min-height: 438px;
  background-color: #fff;
}
</style>
