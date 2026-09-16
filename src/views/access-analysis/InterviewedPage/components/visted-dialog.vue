<script setup lang="ts">
/**
 * 结构化页面分析里「更多受访页面...」的弹窗（对应 v2 .../components/visted-dialog.vue）。
 * 父组件 treepage-analysis.vue 通过 ref 调 vistedApiEvent()。
 */
import { getCurrentInstance, onBeforeUnmount, ref } from 'vue'
import { getVisitUriDetailApi } from '@/api/trackingapi/visituri'
import { formatTime } from '@/utils/format'
import { useLatestOnly } from '@/composables/useLatestOnly'

const proxy = getCurrentInstance()?.proxy
const { next, isLatest } = useLatestOnly()

interface UriRow {
  title?: string
  uri?: string
  avgVisitTime?: number
  exitRate?: number
  [key: string]: unknown
}
interface UriPageResult {
  rows?: UriRow[]
  total?: number
}

const gridData = ref<UriRow[]>([])
const dialogTableVisible = ref(false)
const total = ref(0)
const pageSize = ref(10)
const pageNum = ref(1)
const sortName = ref<string | null>(null)
const sortOrder = ref<string | null>(null)
const commonParams = ref<Record<string, unknown>>({})

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

function initApiEvent(params: Record<string, unknown>) {
  // 与 v2 一致：直接在传入的 params 上写分页/排序字段（没有拷贝）
  params.pageSize = pageSize.value
  params.pageNum = pageNum.value
  params.sortName = sortName.value
  params.sortOrder = sortOrder.value
  dialogTableVisible.value = true
  const token = next()
  getVisitUriDetailApi(params).then((res) => {
    if (!isLatest(token)) return
    if (res?.code == 200) {
      const data = res.data as UriPageResult | undefined
      gridData.value = data?.rows || []
      total.value = data?.total || 0
    }
  })
}

function sortChange(e: { prop?: string | null; order?: string | null }) {
  if (e.order && e.order == 'ascending') {
    // 降序
    sortName.value = e.prop || null
    sortOrder.value = 'asc'
    initApiEvent(commonParams.value)
  } else if (e.order && e.order == 'descending') {
    // 升序
    sortName.value = e.prop || null
    sortOrder.value = 'desc'
    initApiEvent(commonParams.value)
  } else {
    sortName.value = null
    sortOrder.value = null
    initApiEvent(commonParams.value)
  }
}

function getIndex(index: number) {
  return (pageNum.value - 1) * pageSize.value + index + 1
}

function handleSizeChange(val: number) {
  pageNum.value = 1
  pageSize.value = val
  initApiEvent(commonParams.value)
}

function handleCurrentChange(val: number) {
  pageNum.value = val
  initApiEvent(commonParams.value)
}

function vistedApiEvent(params: Record<string, unknown>) {
  pageSize.value = 10
  pageNum.value = 1
  commonParams.value = params
  initApiEvent(params)
}

onBeforeUnmount(() => {
  gridData.value = []
})

defineExpose({ vistedApiEvent })
</script>

<template>
  <div>
    <el-dialog v-model="dialogTableVisible" title="访问页面分析" width="80%">
      <el-table :data="gridData" border class="public-radius" @sort-change="sortChange($event)">
        <el-table-column label="序号" type="index" :width="proxy?.$fixedWidth.FwIndex" align="center">
          <template #default="scope">
            <span>{{ getIndex(scope.$index) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="页面URL" width="400" show-overflow-tooltip>
          <template #default="scope">
            {{ scope.row.title }}<br />
            {{ scope.row.uri }}
          </template>
        </el-table-column>
        <el-table-column label="流量基础指标">
          <el-table-column prop="pv" label="浏览量" sortable="custom" />
          <el-table-column prop="uv" label="访客数" sortable="custom" />
          <el-table-column prop="ipCount" label="IP数" sortable="custom" />
        </el-table-column>
        <el-table-column prop="date" label="流量质量指标">
          <el-table-column prop="entryCount" label="入口页次数" sortable="custom" />
          <el-table-column prop="downPvCount" label="贡献下游浏览量" sortable="custom" />
          <el-table-column prop="exitCount" label="退出页次数" sortable="custom" />
          <el-table-column prop="avgVisitTime" label="平均访问时长" sortable="custom">
            <template #default="scope">
              {{ formatTimeFilter(scope.row.avgVisitTime) }}
            </template>
          </el-table-column>
          <el-table-column prop="exitRate" label="退出率" sortable="custom">
            <template #default="scope">
              {{ percenTable(scope.row.exitRate) }}
            </template>
          </el-table-column>
        </el-table-column>
      </el-table>
      <div class="block">
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
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped></style>
