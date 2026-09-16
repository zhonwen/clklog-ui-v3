<script setup lang="ts">
/**
 * 来源网站明细表（v2 views/visitor-analysis/chart-component/sourceWeb-analysis-table.vue）。
 * 父组件通过 ref 调 getSourceSite(res) / initCurrentPage()。
 */
import { getCurrentInstance, ref } from 'vue'
import flowPoint from '@/components/flowPoint/index.vue'
import { percentage, averageRules } from '@/utils/percent'
import { formatTime } from '@/utils/format'
import { makeTableCellCenterByIndex } from '@/utils/index'

interface SourceSiteRow {
  sourcesite?: string
  latestReferrer?: string
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

interface SourceSitePayload {
  rows?: SourceSiteRow[]
  total?: number
}

const proxy = getCurrentInstance()?.proxy

const emit = defineEmits<{
  (e: 'currentPage', val: Record<string, unknown>): void
}>()

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

const total = ref(0)
const pageSize = ref(10)
const currentPage = ref(1)

const pv = ref(false)
const visitCount = ref(false)
const newUv = ref(false)
const uv = ref(false)
const ipCount = ref(false)
const avgPv = ref(false)
const avgVisitTime = ref(false)
const bounceRate = ref(false)
const pvRate = ref(false)
const newUvRate = ref(false)
const getSourceSiteList = ref<SourceSiteRow[]>([])

// v2: columnIndex 1、2 左对齐，其余居中
const tableHeaderColor = makeTableCellCenterByIndex([], [1, 2])

function averageRulesEvent(num: number | undefined) {
  return averageRules(num)
}

function getIndex($index: number) {
  return (currentPage.value - 1) * pageSize.value + $index + 1
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

function getSourceSite(val: SourceSitePayload) {
  const rows = val.rows || []
  rows.forEach((item) => {
    if (item.bounceRate) {
      item.bounceRate = percentage(item.bounceRate as number)
    }
    if (item.newUvRate) {
      item.newUvRate = percentage(item.newUvRate as number)
    }
    if (item.pvRate) {
      item.pvRate = percentage(item.pvRate as number)
    }
    if (item.avgVisitTime || item.avgVisitTime == 0) {
      item.avgVisitTime = formatTime(Math.floor(Number(item.avgVisitTime)))
    }
  })
  getSourceSiteList.value = rows
  total.value = val.total ?? 0
}

function initCurrentPage() {
  currentPage.value = 1
}

function handleSizeChange(val: number) {
  current.value.size = val
  emit('currentPage', { ...current.value })
}

function handleCurrentChange(val: number) {
  current.value.page = val
  emit('currentPage', { ...current.value })
}

function flowPointEvent(val: string[]) {
  if (val.length > 0) {
    pv.value = val.includes('pv')
    visitCount.value = val.includes('visitCount')
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

defineExpose({ getSourceSite, initCurrentPage })
</script>

<template>
  <div class="chartsIcon public-hoverItem">
    <div class="public-firstHead">来源网站分析</div>
    <flowPoint @flow-point="flowPointEvent" />
    <div>
      <div class="public-Table-minHeight">
        <el-table
          class="public-radius"
          :header-cell-style="{ textAlign: 'center', background: '#f7fafe ' }"
          :cell-style="tableHeaderColor"
          :data="getSourceSiteList"
          border
          style="width: 100%"
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
          <el-table-column
            prop="sourcesite"
            width="250"
            show-overflow-tooltip
            label="来源网站"
          />
          <el-table-column
            prop="latestReferrer"
            width="350"
            show-overflow-tooltip
            label="来源地址"
          />
          <el-table-column label="流量基础指标">
            <el-table-column v-if="pv" prop="pv" label="浏览量" sortable="custom" />
            <el-table-column v-if="pvRate" prop="pvRate" label="浏览量占比" sortable="custom" />
            <el-table-column
              v-if="visitCount"
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
          <el-table-column prop="date" label="流量质量指标">
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
          v-model:page-size="pageSize"
          next-text="下一页"
          :page-sizes="[10, 20, 30, 40]"
          layout=" total,sizes, prev, pager, next, jumper"
          :total="total"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
// v2 这里是 ::v-deep { @import "~@/styles/components/el-pagination.scss"; }
// v3 已在 styles/index.scss 全局引入，不再重复

.chartsIcon {
  box-sizing: border-box;
  margin: 20px;
  padding-top: 1px;
  min-height: 461px;
  background: #fff;
  border-radius: 6px;
  padding: 22px;

  .flow-indicator {
    margin-top: 10px;
    min-height: 58px;
    background: rgba(252, 252, 252, 0.39);
    border: 1px solid #f0f0f5;
    border-radius: 6px;
    box-sizing: border-box;
    // margin: 12px;

    .setSpace {
      margin-bottom: 12px;
    }

    .flow-item {
      display: flex;
      // align-items: center;
      margin-top: 12px;
      margin-left: 10px;

      .flow-title {
        margin-right: 21px;
        font-size: 13px;
        font-weight: 400;
        line-height: 32px;
        color: #4d4d4d;
      }
    }

    .check_item {
      background-color: #ffffff;
      margin-left: 20px;
      height: 40px;
      border-radius: 4px;
      border: 1px solid #eee;
      display: flex;
      align-items: center;

      span {
        font-size: 14px;
        padding: 0 10px;
      }

      .checkBoxStyle {
        padding-right: 10px;
      }
    }
  }
}
</style>
