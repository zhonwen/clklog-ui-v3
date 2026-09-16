<script setup lang="ts">
/** 站内搜索词分析（对应 v2 views/access-analysis/searchTerm/siteonSearch.vue） */
import { computed, getCurrentInstance, ref, watch } from 'vue'
import { Search } from '@element-plus/icons-vue'
import flowPoint from '@/components/flowPoint/index.vue'
import { FilterBar } from '@/layout/components'
import { copyObj } from '@/utils/copy'
import { getInternalSearchWordDetailApi } from '@/api/trackingapi/searchword'
import { useTrackingStore } from '@/stores/tracking'
import { useLatestOnly } from '@/composables/useLatestOnly'

const proxy = getCurrentInstance()?.proxy
const trackingStore = useTrackingStore()
const { next, isLatest } = useLatestOnly()

interface SearchWordRow {
  searchword?: string
  pvRate?: number
  visitCountRate?: number
  ipCountRate?: number
  [key: string]: unknown
}
interface SearchWordPageResult {
  rows?: SearchWordRow[]
  total?: number
}

// 与 v2 一致：v2 的初值是空字符串 ""，Object.assign({projectName}, "") 的结果与传 {} 相同
const filterBarParams = ref<Record<string, unknown>>({})
const searchValue = ref('')

const pv = ref(false)
const pvRate = ref(false)
const visitCount = ref(false)
const visitCountRate = ref(false)
const uv = ref(false)
const newUv = ref(false)
const ipCount = ref(false)
const ipCountRate = ref(false)
// 这三个列在 v2 模板里是注释掉的，但 flowPoint 回调仍会给它们置位，保持一致
const bounceRate = ref(false)
const avgVisitTime = ref(false)
const avgPv = ref(false)

const pageNum = ref(1)
const pageSize = ref(10)
const sortName = ref<string | null>(null)
const sortOrder = ref<string | null>(null)
const total = ref(0)
const siteOnTableList = ref<SearchWordRow[]>([])
const loadingRefresh = ref(false)

const projectName = computed(() => trackingStore.projectName)
const commonParams = computed<Record<string, unknown>>(() =>
  Object.assign({ projectName: projectName.value }, filterBarParams.value),
)

/** v2 filters/index.js 的 percenTable：非法/0 值返回数字 0 */
function percenTable(s?: number): string | number {
  if (s == 1) return '100%'
  if (s) return (Number(s) * 100).toFixed(2) + '%'
  return 0
}

function getFlowTrendDetail() {
  const token = next()
  const newvalue = copyObj(commonParams.value)
  newvalue.sortName = sortName.value
  newvalue.sortOrder = sortOrder.value
  newvalue.pageNum = pageNum.value
  newvalue.pageSize = pageSize.value
  newvalue.searchword = searchValue.value
  loadingRefresh.value = true
  getInternalSearchWordDetailApi(newvalue)
    .then((res) => {
      if (!isLatest(token)) return
      if (res?.code == 200) {
        loadingRefresh.value = false
        const data = res.data as SearchWordPageResult | undefined
        siteOnTableList.value = data?.rows || []
        total.value = data?.total || 0
      }
      // 与 v2 一致（v2 此处逻辑存疑：code 非 200 时不关 loading，遮罩会一直转）
    })
    .catch(() => {
      if (!isLatest(token)) return
      loadingRefresh.value = false
    })
}

// 统一的分页更新方法
function updatePagination(num: number, size: number | null = null) {
  pageNum.value = num
  if (size !== null) {
    pageSize.value = size
  }
  getFlowTrendDetail()
}

watch(commonParams, () => {
  updatePagination(1)
})

function handleClick() {
  pageNum.value = 1
  getFlowTrendDetail()
}

function getIndex(index: number) {
  return (pageNum.value - 1) * pageSize.value + index + 1
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

function sortChange(e: { prop?: string | null; order?: string | null }) {
  if (e.order && e.order === 'ascending') {
    sortName.value = e.prop || null
    sortOrder.value = 'asc'
  } else if (e.order && e.order === 'descending') {
    sortName.value = e.prop || null
    sortOrder.value = 'desc'
  } else {
    sortName.value = null
    sortOrder.value = null
  }
  getFlowTrendDetail()
}

function handleSizeChange(val: number) {
  updatePagination(1, val)
}

function handleCurrentChange(val: number) {
  updatePagination(val)
}

function setFilterBarParams(val: Record<string, unknown>) {
  filterBarParams.value = copyObj(val)
}
</script>

<template>
  <div>
    <FilterBar ByArea @set-filter-bar-params="setFilterBarParams" />

    <div v-loading="loadingRefresh" class="userLoyalty public-hoverItem">
      <div class="public-block">
        <div class="chartsIcon" style="padding-top: 25px">
          <span class="public-firstHead" style="margin-bottom: 10px">站内搜索词分析</span>
          <flowPoint ref="flowPointRef" byNoQuality bySite @flow-point="flowPointEvent" />

          <div style="display: flex; justify-content: flex-end; margin: 20px 0; height: 30px">
            <el-input
              v-model="searchValue"
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

          <div>
            <div class="public-Table-minHeight">
              <el-table
                class="public-radius"
                :header-cell-style="{ background: '#f7fafe ' }"
                :cell-style="{ textAlign: 'center' }"
                :data="siteOnTableList"
                border
                style="width: 100%; margin-top: 12px"
                @sort-change="sortChange($event)"
              >
                <el-table-column
                  label="序号"
                  type="index"
                  :width="proxy?.$fixedWidth.FwIndex"
                  align="center"
                >
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
                <el-table-column
                  v-if="pv"
                  prop="pv"
                  align="center"
                  label="搜索次数"
                  sortable="custom"
                />
                <el-table-column
                  v-if="pvRate"
                  align="center"
                  label="搜索次数占比"
                  sortable="custom"
                  prop="pvRate"
                >
                  <template #default="scope">{{ percenTable(scope.row.pvRate) }}</template>
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
                <el-table-column
                  v-if="uv"
                  align="center"
                  prop="uv"
                  label="访客数"
                  sortable="custom"
                />
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
                <!-- v2 里这三列是注释掉的，原样保留：
                <el-table-column v-if="bounceRate" prop="bounceRate" align="center" label="跳出率" sortable="custom" />
                <el-table-column v-if="avgVisitTime" align="center" prop="avgVisitTime" label="平均访问时长" sortable="custom" />
                <el-table-column v-if="avgPv" align="center" prop="avgPv" label="平均访问页数" sortable="custom" />
                -->
              </el-table>
            </div>
            <div class="block">
              <el-pagination
                v-model:current-page="pageNum"
                next-text="下一页"
                :page-sizes="[10, 20, 30, 40]"
                :page-size="pageSize"
                layout=" total,sizes, prev, pager, next, jumper"
                :total="total"
                @size-change="handleSizeChange"
                @current-change="handleCurrentChange"
              />
            </div>
          </div>
        </div>
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

.userLoyalty {
  min-height: 700px;
  margin: 20px;
  background: #fff;
  border-radius: 6px !important;
}
</style>
