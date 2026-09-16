<script setup lang="ts">
/**
 * 站外搜索词分析表格（对应 v2 views/access-analysis/searchTerm/components/siteout.vue）。
 * 父组件 siteoutSearch.vue 通过 ref 调 updatePagination() / initTableList()。
 */
import { getCurrentInstance, reactive, ref } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { getSearchWordDetailApi } from '@/api/trackingapi/searchword'
import flowPoint from '@/components/flowPoint/index.vue'
import { copyObj } from '@/utils/copy'
import { formatTime } from '@/utils/format'
import { averageRulesTable } from '@/utils/percent'
import { useLatestOnly } from '@/composables/useLatestOnly'

const proxy = getCurrentInstance()?.proxy
const { next, isLatest } = useLatestOnly()

interface SearchWordRow {
  searchword?: string
  pvRate?: number
  visitCountRate?: number
  ipCountRate?: number
  bounceRate?: number
  avgVisitTime?: number
  avgPv?: number
  [key: string]: unknown
}
interface SearchWordPageResult {
  rows?: SearchWordRow[]
  total?: number
}
interface CurrentParams {
  pageSize: number
  pageNum: number
  sortName: string | null
  sortOrder: string | null
  searchword: string
  [key: string]: unknown
}

const commonParams = ref<Record<string, unknown>>({})
const loadingRefresh = ref(false)
const searchTableList = ref<SearchWordRow[]>([])
const total = ref(0)
const current = reactive<CurrentParams>({
  pageSize: 10,
  pageNum: 1,
  sortName: null,
  sortOrder: null,
  searchword: '',
})

const pv = ref(false)
const pvRate = ref(false)
const visitCount = ref(false)
const visitCountRate = ref(false)
const uv = ref(false)
const newUv = ref(false)
const ipCount = ref(false)
const ipCountRate = ref(false)
const bounceRate = ref(false)
const avgVisitTime = ref(false)
const avgPv = ref(false)

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

function initTableList(row: Record<string, unknown>) {
  const token = next()
  commonParams.value = copyObj(row)
  loadingRefresh.value = true
  // 与 v2 一致：Object.assign 的目标就是 current 本身，筛选条件会被写进 current 并保留
  const params = Object.assign(current, row)
  getSearchWordDetailApi(params)
    .then((res) => {
      if (!isLatest(token)) return
      loadingRefresh.value = false
      if (res?.code == 200) {
        const data = res.data as SearchWordPageResult | undefined
        searchTableList.value = data?.rows || []
        total.value = data?.total || 0
      }
    })
    .catch(() => {
      if (!isLatest(token)) return
      loadingRefresh.value = false
    })
}

function handleClick() {
  current.pageNum = 1
  initTableList(commonParams.value)
}

function getIndex(index: number) {
  return (current.pageNum - 1) * current.pageSize + index + 1
}

function sortChange(e: { prop?: string | null; order?: string | null }) {
  if (e.order && e.order === 'ascending') {
    current.sortName = e.prop || null
    current.sortOrder = 'asc'
  } else if (e.order && e.order === 'descending') {
    current.sortName = e.prop || null
    current.sortOrder = 'desc'
  } else {
    current.sortName = null
    current.sortOrder = null
  }
  initTableList(commonParams.value)
}

function flowPointEvent(val: string[]) {
  if (val.length > 0) {
    // 与 v2 一致：字段名与勾选项同名，批量按 includes 置位
    pv.value = val.includes('pv')
    pvRate.value = val.includes('pvRate')
    visitCount.value = val.includes('visitCount')
    visitCountRate.value = val.includes('visitCountRate')
    newUv.value = val.includes('newUv')
    uv.value = val.includes('uv')
    ipCount.value = val.includes('ipCount')
    ipCountRate.value = val.includes('ipCountRate')
    avgPv.value = val.includes('avgPv')
    avgVisitTime.value = val.includes('avgVisitTime')
    bounceRate.value = val.includes('bounceRate')
  }
}

// 统一的分页更新方法
function updatePagination(pageNum: number, pageSize: number | null = null) {
  current.pageNum = pageNum
  if (pageSize !== null) {
    current.pageSize = pageSize
  }
  initTableList(commonParams.value)
}

function handleSizeChange(val: number) {
  updatePagination(1, val)
}

function handleCurrentChange(val: number) {
  updatePagination(val)
}

defineExpose({ updatePagination, initTableList, current })
</script>

<template>
  <div v-loading="loadingRefresh">
    <div class="search_wrappy public-table-block public-hoverItem">
      <span class="public-firstHead">站外搜索词分析</span>
      <flowPoint ref="flowPointRef" bySite style="margin-top: 20px" @flow-point="flowPointEvent" />
      <div style="display: flex; justify-content: flex-end; margin: 20px 0; height: 30px">
        <el-input
          v-model="current.searchword"
          placeholder="请输入搜索词"
          style="width: 250px"
          @keyup.enter="handleClick()"
        >
          <template #suffix>
            <el-icon class="el-input__icon el-icon-search" @click="handleClick()">
              <Search />
            </el-icon>
          </template>
        </el-input>
      </div>
      <div class="public-Table-minHeight">
        <el-table
          class="public-radius"
          :data="searchTableList"
          :header-cell-style="{ background: '#f7fafe ' }"
          :cell-style="{ textAlign: 'center' }"
          border
          style="width: 100%; margin-top: 12px"
          @sort-change="sortChange($event)"
        >
          <el-table-column label="序号" type="index" :width="proxy?.$fixedWidth.FwIndex" align="center">
            <template #default="scope">
              <span>{{ getIndex(scope.$index) }}</span>
            </template>
          </el-table-column>

          <el-table-column
            prop="searchword"
            align="center"
            show-overflow-tooltip
            label="搜索词"
            width="250"
          />
          <el-table-column v-if="pv" prop="pv" align="center" label="搜索次数" sortable="custom" />
          <el-table-column
            v-if="pvRate"
            align="center"
            label="搜索次数占比"
            sortable="custom"
            prop="pvRate"
          >
            <template #default="{ row }">{{ percenTable(row.pvRate) }}</template>
          </el-table-column>
          <el-table-column
            v-if="visitCount"
            align="center"
            prop="visitCount"
            label="访问次数"
            sortable="custom"
          />
          <el-table-column
            v-if="visitCountRate"
            align="center"
            prop="visitCountRate"
            label="访问次数占比"
            sortable="custom"
          >
            <template #default="scope">
              {{ percenTable(scope.row.visitCountRate) }}
            </template>
          </el-table-column>
          <el-table-column v-if="uv" align="center" prop="uv" label="访客数" sortable="custom" />
          <el-table-column
            v-if="newUv"
            align="center"
            prop="newUv"
            label="新访客数"
            sortable="custom"
          />
          <el-table-column
            v-if="ipCount"
            align="center"
            prop="ipCount"
            label="IP数"
            sortable="custom"
          />
          <el-table-column
            v-if="ipCountRate"
            align="center"
            prop="ipCountRate"
            label="IP数占比"
            sortable="custom"
          >
            <template #default="scope">
              {{ percenTable(scope.row.ipCountRate) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="bounceRate"
            prop="bounceRate"
            align="center"
            label="跳出率"
            sortable="custom"
          >
            <template #default="scope">
              {{ percenTable(scope.row.bounceRate) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="avgVisitTime"
            align="center"
            prop="avgVisitTime"
            label="平均访问时长"
            sortable="custom"
          >
            <template #default="{ row }">
              {{ formatTimeFilter(row.avgVisitTime) }}
            </template>
          </el-table-column>
          <el-table-column
            v-if="avgPv"
            align="center"
            prop="avgPv"
            label="平均访问页数"
            sortable="custom"
          >
            <template #default="scope">
              {{ averageRulesTable(scope.row.avgPv) }}
            </template>
          </el-table-column>
        </el-table>
      </div>
      <div class="block">
        <el-pagination
          :pager-count="5"
          prev-text
          next-text="下一页"
          :current-page="current.pageNum"
          :page-sizes="[10, 20, 30, 40]"
          :page-size="current.pageSize"
          layout="total, sizes, prev, pager, next, jumper"
          :total="total"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
// v2 在 ::v-deep 里 @import 了 el-pagination.scss，v3 已在 styles/index.scss 全局引入，不再重复引
:deep(.el-input--medium .el-input__inner) {
  height: 30px;
  line-height: 30px;
}

:deep(.el-icon-search) {
  cursor: pointer;
}

.search_wrappy {
  position: relative;
}

.setTable {
  min-height: 410px;
}
</style>
