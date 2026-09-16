<script setup lang="ts">
/**
 * 地域分析-明细表（v2 views/visitor-analysis/chart-component/regional-analysis-table.vue）。
 * 父组件通过 ref 调 initParamsEvent / initCurrentPage / getDetailList。
 */
import { getCurrentInstance, ref } from 'vue'
import { percentage, averageRules } from '@/utils/percent'
import { formatTime } from '@/utils/format'
import flowPoint from '@/components/flowPoint/index.vue'
import regionalDialog from '../custom-dialog/regional.vue'

interface DetailRow {
  province?: string
  country?: string
  pv?: number
  pvRate?: number | string
  visitCount?: number
  uv?: number
  newUv?: number
  newUvRate?: number | string
  ipCount?: number
  avgPv?: number
  avgVisitTime?: number | string
  bounceRate?: number | string
  [key: string]: unknown
}

interface CompareMetric {
  pv?: number
  pvRate?: number
  visitCount?: number
  uv?: number
  newUv?: number
  newUvRate?: number
  ipCount?: number
  bounceRate?: number
  avgVisitTime?: number
  avgPv?: number
}

interface CompareRow {
  province?: string
  country?: string
  compareTiem?: string
  startTime?: string
  /** 用元组而不是数组：开了 noUncheckedIndexedAccess，数组下标会被收窄成 T | undefined */
  rows: [CompareMetric, CompareMetric]
}

interface DetailListPayload {
  /** 同一个接口字段，不对比时是 DetailRow[]，对比时是 CompareRow[] */
  rows?: unknown[]
  total?: number
}

/**
 * 复刻 v2 src/filters/index.js 的 percenTable 过滤器：
 * 1 → '100%'，其余真值 → 两位小数百分比，falsy → 0（不是 '--'）。
 */
function percenTableFilter(s: unknown): string | number {
  if (s == 1) return '100%'
  if (s) return (Number(s) * 100).toFixed(2) + '%'
  return 0
}

/**
 * 复刻 v2 src/filters/index.js 的 averageRules 过滤器（整数原样 / 非整数 Math.ceil / falsy '--'）。
 * 与 @/utils/percent 的同名函数实现不同，不能混用。
 */
function averageRulesFilter(num: unknown): number | string {
  if (num) {
    const n = Number(num)
    if (Number.isInteger(n)) return n
    return Math.ceil(n)
  }
  return '--'
}

const proxy = getCurrentInstance()?.proxy

const emit = defineEmits<{
  (e: 'currentPage', val?: Record<string, unknown>, compareFlag?: boolean): void
}>()

const regionalDialogRef = ref<{
  openingEvent: (row: DetailRow, commonParams: Record<string, unknown>) => void
} | null>(null)

// 对比分页处理
const commonParams = ref<Record<string, unknown>>({})
const compareCrrentPage = ref(1)
const compareTotal = ref(0)
const comparePageSize = ref(10)

const activeMap = ref('province')
const currentPage = ref(1)
const tableDetailList = ref<DetailRow[]>([])
const total = ref(0)
const pageSize = ref(10)

const pv = ref(false)
const visit = ref(false)
const newUv = ref(false)
const uv = ref(false)
const ipCount = ref(false)
const avgPv = ref(false)
const avgVisitTime = ref(false)
const bounceRate = ref(false)
const pvRate = ref(false)
const newUvRate = ref(false)

const current = ref<{
  size: number
  page: number
  sortName: string | null
  sortOrder: string | null
}>({
  size: 10,
  page: 1,
  sortName: null,
  sortOrder: null,
})

const dateFlag = ref<number | null>(null)
const compareTableList = ref<CompareRow[]>([])

function initParamsEvent(params: Record<string, unknown>) {
  commonParams.value = params
}

function regionalDialogEvent(row: DetailRow) {
  regionalDialogRef.value?.openingEvent(row, commonParams.value)
}

function changeRateEvent(x: unknown, y: unknown) {
  if (x || y) {
    const a = ((Number(y) - Number(x)) / (Number(x) || 1)).toFixed(4)
    return (Number(a) * 100).toFixed(2)
  } else {
    return 0
  }
}

function averageRulesEvent(num: number | undefined) {
  return averageRules(num)
}

function getIndex($index: number) {
  return (currentPage.value - 1) * pageSize.value + $index + 1
}

function getIndexCompare($index: number) {
  return (compareCrrentPage.value - 1) * comparePageSize.value + $index + 1
}

function sortChange(e: { prop?: string | null; order?: string | null }) {
  if (e.order && e.order == 'ascending') {
    // 降序
    current.value.sortName = e.prop ?? null
    current.value.sortOrder = 'asc'
    emit('currentPage', { ...current.value })
  } else if (e.order && e.order == 'descending') {
    // 升序
    current.value.sortName = e.prop ?? null
    current.value.sortOrder = 'desc'
    emit('currentPage', { ...current.value })
  } else {
    current.value.sortName = null
    current.value.sortOrder = null
    emit('currentPage', { ...current.value })
  }
}

function initCurrentPage() {
  currentPage.value = 1
  comparePageSize.value = 10
  compareCrrentPage.value = 1
  pageSize.value = 10
}

function handleSizeChange(val: number) {
  current.value.size = val
  emit('currentPage', { ...current.value })
}

function handleCurrentChange(val: number) {
  current.value.page = val
  emit('currentPage', { ...current.value })
}

// 对比分页
function handleSizeChangePare(val: number) {
  comparePageSize.value = val
  const cur = {
    pageSize: comparePageSize.value,
    pageNum: compareCrrentPage.value,
  }
  emit('currentPage', cur, true)
}

function handleCurrentChangePare(val: number) {
  compareCrrentPage.value = val
  const cur = {
    pageSize: comparePageSize.value,
    pageNum: compareCrrentPage.value,
  }
  emit('currentPage', cur, true)
}

function getDetailList(res: DetailListPayload, flag: number | null, map: string) {
  activeMap.value = map // 按类型对比事件
  dateFlag.value = flag
  if (dateFlag.value) {
    // 对比事件
    compareTableList.value = (res.rows as CompareRow[]) || []
    compareTotal.value = res.total ?? 0
  } else {
    // 没有对比
    tableDetailList.value = (res.rows as DetailRow[]) || []
    total.value = res.total ?? 0
    tableDetailList.value.forEach((item) => {
      if (item.bounceRate) {
        item.bounceRate = percentage(item.bounceRate as number)
      }
      if (item.newUvRate) {
        item.newUvRate = percentage(item.newUvRate as number)
      }
      if (item.pvRate) {
        item.pvRate = percentage(item.pvRate as number)
      }
      if (item.country && !item.province) {
        item.province = item.country
      }
      if (item.province == '未知省份' && item.country && item.country != '中国') {
        item.province = item.country + '-' + item.province
      }

      if (item.avgVisitTime || item.avgVisitTime == 0) {
        item.avgVisitTime = formatTime(Math.floor(Number(item.avgVisitTime)))
      }
    })
  }
}

function flowPointEvent(val: string[]) {
  if (val.length > 0) {
    pv.value = val.includes('pv')
    visit.value = val.includes('visitCount')
    newUv.value = val.includes('newUv')
    uv.value = val.includes('uv')
    ipCount.value = val.includes('ipCount')
    avgPv.value = val.includes('avgPv')
    avgVisitTime.value = val.includes('avgVisitTime')
    bounceRate.value = val.includes('bounceRate')
    pvRate.value = val.includes('pvRate')
    newUvRate.value = val.includes('newUvRate')
  }
}

defineExpose({ initParamsEvent, initCurrentPage, getDetailList })
</script>

<template>
  <div class="chartsIcon public-hoverItem">
    <div class="public-firstHead">地域分析</div>
    <flowPoint @flow-point="flowPointEvent" />
    <div v-show="!dateFlag">
      <div class="public-Table-minHeight">
        <el-table
          class="public-radius"
          :data="tableDetailList"
          border
          :header-cell-style="{ textAlign: 'center', background: '#f7fafe ' }"
          :cell-style="{ textAlign: 'center' }"
          @sort-change="sortChange($event)"
        >
          <el-table-column
            label="序号"
            type="index"
            :width="proxy?.$fixedWidth.FwIndex"
            align="center"
          >
            <template #default="scope">
              <span v-text="getIndex(scope.$index)"> </span>
            </template>
          </el-table-column>
          <el-table-column prop="province" label="地域" width="200">
            <template #default="{ row }">
              <div
                style="
                  display: flex;
                  justify-content: center;
                  position: relative;
                "
              >
                <div style="text-align: center">{{ row.province }}</div>

                <img
                  v-if="activeMap == 'province'"
                  src="@/assets/images/showFlag.png"
                  style="
                    width: 13px;
                    height: 13px;
                    position: absolute;
                    right: 0;
                    cursor: pointer;
                  "
                  @click="regionalDialogEvent(row)"
                />
              </div>
            </template>
          </el-table-column>

          <el-table-column prop="date" label="流量基础指标" width="150">
            <el-table-column v-if="pv" prop="pv" label="浏览量" sortable="custom" />
            <el-table-column v-if="pvRate" prop="pvRate" label="浏览量占比" sortable="custom" />
            <el-table-column
              v-if="visit"
              prop="visitCount"
              label="访问次数"
              sortable="custom"
            />
            <el-table-column v-if="uv" prop="uv" label="访客数" sortable="custom" />
            <el-table-column v-if="newUv" prop="newUv" label="新访客数" sortable="custom" />

            <el-table-column
              v-if="newUvRate"
              prop="newUvRate"
              label="新访客数占比"
              sortable="custom"
            />
            <el-table-column v-if="ipCount" prop="ipCount" label="IP数" sortable="custom" />
          </el-table-column>
          <el-table-column prop="date" label="流量质量指标" width="150">
            <el-table-column
              v-if="bounceRate"
              prop="bounceRate"
              label="跳出率"
              sortable="custom"
            />
            <el-table-column
              v-if="avgVisitTime"
              prop="avgVisitTime"
              label="平均访问时长"
              sortable="custom"
            />
            <el-table-column v-if="avgPv" prop="avgPv" label="平均访问页数" sortable="custom">
              <template #default="scope">
                {{ averageRulesEvent(scope.row.avgPv) }}
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

    <!-- 有对比 -->
    <div v-show="dateFlag">
      <div class="public-Table-minHeight">
        <el-table
          class="public-radius"
          :data="compareTableList"
          border
          :header-cell-style="{ textAlign: 'center', background: '#f7fafe ' }"
          :cell-style="{ textAlign: 'center' }"
        >
          <el-table-column
            label="序号"
            type="index"
            :width="proxy?.$fixedWidth.FwIndex"
            align="center"
          >
            <template #default="scope">
              <span v-text="getIndexCompare(scope.$index)"> </span>
            </template>
          </el-table-column>
          <el-table-column show-overflow-tooltip label="地域" width="200">
            <template #default="{ row }">
              <div v-if="activeMap == 'province'" class="setBody">
                {{ row.province }}
                <img
                  src="@/assets/images/showFlag.png"
                  style="
                    width: 13px;
                    height: 13px;
                    position: absolute;
                    right: 0;
                    cursor: pointer;
                    margin-right: 15px;
                  "
                  @click="regionalDialogEvent(row)"
                />
              </div>
              <div v-else class="setBody">{{ row.country }}</div>
              <div class="setBody">{{ row.compareTiem }}</div>
              <div class="setBody">{{ row.startTime }}</div>
              <div class="setBody">变化率</div>
            </template>
          </el-table-column>

          <el-table-column prop="date" label="流量基础指标" width="150">
            <el-table-column v-if="pv" label="浏览量">
              <template #default="{ row }">
                <div class="setBody setTr">{{ row.rows[0].pv }}</div>
                <div class="setBody">{{ row.rows[1].pv }}</div>
                <div class="setBody">
                  {{ changeRateEvent(row.rows[0].pv, row.rows[1].pv) }}%
                </div>
              </template>
            </el-table-column>
            <el-table-column v-if="pvRate" prop="pvRate" label="浏览量占比">
              <template #default="{ row }">
                <div class="setBody setTr">
                  {{ percenTableFilter(row.rows[0].pvRate) }}
                </div>
                <div class="setBody">
                  {{ percenTableFilter(row.rows[1].pvRate) }}
                </div>
                <div class="setBody">
                  {{ changeRateEvent(row.rows[0].pvRate, row.rows[1].pvRate) }}%
                </div>
              </template>
            </el-table-column>
            <el-table-column v-if="visit" prop="visitCount" label="访问次数">
              <template #default="{ row }">
                <div class="setBody setTr">
                  {{ row.rows[0].visitCount }}
                </div>
                <div class="setBody">
                  {{ row.rows[1].visitCount }}
                </div>
                <div class="setBody">
                  {{ changeRateEvent(row.rows[0].visitCount, row.rows[1].visitCount) }}%
                </div>
              </template>
            </el-table-column>
            <el-table-column v-if="uv" prop="uv" label="访客数">
              <template #default="{ row }">
                <div class="setBody setTr">
                  {{ row.rows[0].uv }}
                </div>
                <div class="setBody">
                  {{ row.rows[1].uv }}
                </div>
                <div class="setBody">
                  {{ changeRateEvent(row.rows[0].uv, row.rows[1].uv) }}%
                </div>
              </template>
            </el-table-column>
            <el-table-column v-if="newUv" prop="newUv" label="新访客数">
              <template #default="{ row }">
                <div class="setBody setTr">
                  {{ row.rows[0].newUv }}
                </div>
                <div class="setBody">
                  {{ row.rows[1].newUv }}
                </div>
                <div class="setBody">
                  {{ changeRateEvent(row.rows[0].newUv, row.rows[1].newUv) }}%
                </div>
              </template>
            </el-table-column>

            <el-table-column v-if="newUvRate" prop="newUvRate" label="新访客数占比">
              <template #default="{ row }">
                <div class="setBody setTr">
                  {{ percenTableFilter(row.rows[0].newUvRate) }}
                </div>
                <div class="setBody">
                  {{ percenTableFilter(row.rows[1].newUvRate) }}
                </div>
                <div class="setBody">
                  {{ changeRateEvent(row.rows[0].newUvRate, row.rows[1].newUvRate) }}%
                </div>
              </template>
            </el-table-column>
            <el-table-column v-if="ipCount" prop="ipCount" label="IP数">
              <template #default="{ row }">
                <div class="setBody setTr">
                  {{ row.rows[0].ipCount }}
                </div>
                <div class="setBody">
                  {{ row.rows[1].ipCount }}
                </div>
                <div class="setBody">
                  {{ changeRateEvent(row.rows[0].ipCount, row.rows[1].ipCount) }}%
                </div>
              </template>
            </el-table-column>
          </el-table-column>
          <el-table-column prop="date" label="流量质量指标" width="150">
            <el-table-column v-if="bounceRate" prop="bounceRate" label="跳出率">
              <template #default="{ row }">
                <div class="setBody setTr">
                  {{ row.rows[0].bounceRate }}
                </div>
                <div class="setBody">
                  {{ row.rows[1].bounceRate }}
                </div>
                <div class="setBody">
                  {{ changeRateEvent(row.rows[0].bounceRate, row.rows[1].bounceRate) }}%
                </div>
              </template>
            </el-table-column>
            <el-table-column v-if="avgVisitTime" prop="avgVisitTime" label="平均访问时长">
              <template #default="{ row }">
                <div class="setBody setTr">
                  {{ row.rows[0].avgVisitTime }}
                </div>
                <div class="setBody">
                  {{ row.rows[1].avgVisitTime }}
                </div>
                <div class="setBody">
                  {{ changeRateEvent(row.rows[0].avgVisitTime, row.rows[1].avgVisitTime) }}%
                </div>
              </template>
            </el-table-column>
            <el-table-column v-if="avgPv" prop="avgPv" label="平均访问页数">
              <template #default="{ row }">
                <div class="setBody setTr">
                  {{ averageRulesFilter(row.rows[0].avgPv) }}
                </div>
                <div class="setBody">
                  {{ averageRulesFilter(row.rows[1].avgPv) }}
                </div>
                <div class="setBody">
                  {{ changeRateEvent(row.rows[0].avgPv, row.rows[1].avgPv) }}%
                </div>
              </template>
            </el-table-column>
          </el-table-column>
        </el-table>
      </div>
      <div class="block">
        <el-pagination
          v-model:current-page="compareCrrentPage"
          next-text="下一页"
          :page-sizes="[10, 20, 30, 40]"
          :page-size="comparePageSize"
          layout="total, sizes, prev, pager, next, jumper"
          :total="compareTotal"
          @size-change="handleSizeChangePare"
          @current-change="handleCurrentChangePare"
        />
      </div>
    </div>
    <regionalDialog ref="regionalDialogRef" />
  </div>
</template>

<style lang="scss" scoped>
// v2 这里是 ::v-deep { @import "~@/styles/components/el-checkbox.scss"; @import el-pagination.scss }
// el-checkbox.scss 在 v3 里每条规则已写成 :deep(...)，只能在 scoped 块顶部 @use；
// el-pagination.scss 已全局引入，不再重复
@use '@/styles/components/el-checkbox.scss';

.setTr {
  margin-top: 25px;
}

.setSpace {
  margin-bottom: 8px;
  margin-left: 25px;
}

.setBody {
  margin-bottom: 8px;
}

.chartsIcon {
  box-sizing: border-box;
  padding-top: 1px;
  min-height: 461px;
  background: #fff;
  border-radius: 6px;
  padding: 22px;
}
</style>
