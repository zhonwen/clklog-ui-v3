<script setup lang="ts">
import { getCurrentInstance, ref } from 'vue'
import { Tickets, View } from '@element-plus/icons-vue'
import { getLogByEventSessionIdApi } from '@/api/trackingapi/visitor'
import { copyObj } from '@/utils/copy'
import { useLatestOnly } from '@/composables/useLatestOnly'
import Dialogs from '@/layout/components/dialog/index.vue'

interface ClientIpItem {
  ip?: string
  city?: string
}

interface VisitLogRow {
  distinctId?: string
  logTime?: string
  clientIp?: ClientIpItem[]
  referrerHost?: string
  manufacturer?: string
  uriCount?: number
  latestReferrer?: string
}

const proxy = getCurrentInstance()?.proxy

const total = ref(0)
const pageSize = ref(40)
const pageNum = ref(1)
const currentPage = ref(1)
const tableData = ref<VisitLogRow[]>([])
const commonParams = ref<Record<string, unknown>>({})
const tableLoading = ref(false)
const { next, isLatest } = useLatestOnly()
const child = ref<{ callMethod: (val?: string) => void } | null>(null)

function getIndex(index: number) {
  return (currentPage.value - 1) * pageSize.value + index + 1
}

function handleCellClick(val?: string) {
  child.value?.callMethod(val)
}

/**
 * 接口返回的 clientIp 是 "[ip1, city1, ip2, city2]" 这样的字符串，
 * 去掉首尾方括号后按逗号切开、两两配对（与 v2 visitLog.vue 的处理一致）。
 */
function parseClientIp(raw: unknown): ClientIpItem[] {
  if (typeof raw !== 'string') return []
  const parts = raw
    .slice(1, -1)
    .split(',')
    .map((item) => item.trim())
  const result: ClientIpItem[] = []
  for (let i = 0; i < parts.length; i += 2) {
    result.push({ ip: parts[i], city: parts[i + 1] })
  }
  return result
}

/** 由父组件调用；flag 为 true 表示筛选条变化，需要回到第一页 */
function visitLogEvent(params: Record<string, unknown>, flag?: boolean) {
  if (flag) {
    pageNum.value = 1
    currentPage.value = 1
  }
  const token = next()
  commonParams.value = copyObj(params)
  const payload = {
    ...commonParams.value,
    pageSize: pageSize.value,
    pageNum: pageNum.value,
    previousHour: 6,
  }
  tableLoading.value = true
  getLogByEventSessionIdApi(payload)
    .then((res) => {
      if (!isLatest(token)) return
      tableLoading.value = false
      if (res?.code == 200) {
        const data = res.data as { rows?: Record<string, unknown>[]; total?: number }
        tableData.value = (data?.rows || []).map((item) => ({
          ...(item as VisitLogRow),
          clientIp: parseClientIp(item.clientIp),
        }))
        total.value = Number(data?.total || 0)
      }
    })
    .catch(() => {
      if (!isLatest(token)) return
      tableLoading.value = false
    })
}

function handleSizeChange(val: number) {
  pageSize.value = val
  currentPage.value = 1
  pageNum.value = 1
  visitLogEvent(commonParams.value)
}

function handleCurrentChange(val: number) {
  pageNum.value = val
  visitLogEvent(commonParams.value)
}

function tableHeaderColor({ columnIndex }: { columnIndex: number }) {
  // 必须返回对象，element-plus 会对返回值做 Object.assign，返回字符串会炸（见规范 6.5）
  return columnIndex === 1 ? { textAlign: 'left' } : { textAlign: 'center' }
}

defineExpose({ visitLogEvent })
</script>

<template>
  <div v-loading="tableLoading" class="visitLog public-hoverItem block-main">
    <div class="block-head">
      <div class="block-title" style="cursor: auto">
        实时访问
        <div class="innerFont">(近6小时)</div>
      </div>
      <div class="block-head-icon" />
    </div>
    <div style="width: 100%; min-height: 400px">
      <el-table
        style="width: 100%; min-height: 400px"
        :data="tableData"
        class="public-radius"
        :header-cell-style="{ textAlign: 'center', background: '#f7fafe' }"
        :cell-style="tableHeaderColor"
        border
      >
        <el-table-column type="index" label="序号" :width="proxy?.$fixedWidth.FwIndex">
          <template #default="scope">
            <div style="cursor: pointer" @click="handleCellClick(scope.row.distinctId)">
              <span>{{ getIndex(scope.$index) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="province" min-width="28%" show-overflow-tooltip label="访问信息">
          <template #default="{ row }">
            <div style="cursor: pointer" @click="handleCellClick(row.distinctId)">
              {{ row.logTime }}
              <div v-for="(item, index) in row.clientIp" :key="index" style="margin-top: 12px">
                <div style="display: flex">IP:{{ item.ip || '--' }} {{ item.city }}</div>
              </div>
              <div style="margin-top: 12px">{{ row.referrerHost }}</div>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="manufacturer" label="访问设备" min-width="25%" show-overflow-tooltip>
          <template #default="{ row }">
            <div style="cursor: pointer" @click="handleCellClick(row.distinctId)">
              {{ row.manufacturer || '--' }}
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="uriCount" label="访问页面" width="300" align="center">
          <template #default="{ row }">
            <div style="cursor: pointer" @click="handleCellClick(row.distinctId)">
              <div style="display: flex; justify-content: flex-start; flex-wrap: wrap">
                <div
                  v-for="index in (row.uriCount || 1) > 40 ? 40 : row.uriCount"
                  :key="index"
                >
                  <el-icon style="padding: 2px 1px 2px 4px; color: #2c7be5"><Tickets /></el-icon>
                </div>
                <div v-if="row.uriCount > 40">...</div>
              </div>
              <div style="margin: 5px 0 0 5px; font-size: 12px; text-align: left">
                共{{ row.uriCount }}页
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          prop="latestReferrer"
          label="访问来源"
          show-overflow-tooltip
          min-width="20%"
        >
          <template #default="{ row }">
            <div style="cursor: pointer" @click="handleCellClick(row.distinctId)">
              {{ row.latestReferrer || '--' }}
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="pvRate" label="访问详情" min-width="23%" align="center">
          <template #default="{ row }">
            <div
              style="display: flex; justify-content: center; cursor: pointer"
              @click="handleCellClick(row.distinctId)"
            >
              <el-icon style="margin-right: 8px; color: #2c7be5"><View /></el-icon>
              查看
            </div>
          </template>
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
    <Dialogs ref="child" />
  </div>
</template>

<style lang="scss" scoped>
// 分页样式在 src/styles/index.scss 全局引入一次（sass 不允许 @use 出现在嵌套块里）
.visitLog {
  min-height: 585px;
  background-color: #fff;
  border-radius: 6px;
}

.innerFont {
  font-size: 13px;
  font-weight: 400;
  color: #4d4d4d;
  margin-left: 8px;
}
</style>
