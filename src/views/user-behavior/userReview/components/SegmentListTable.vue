<script setup lang="ts">
/**
 * 用户复查 - 按分群筛选的用户列表（对应 v2 .../userReview/components/SegmentListTable.vue）。
 * 分页、排序全在前端做，数据由父组件一次性传进来。
 */
import { computed, getCurrentInstance, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { View, DocumentCopy } from '@element-plus/icons-vue'
import { openNewTab } from '@/utils/index'
import { useTrackingStore } from '@/stores/tracking'

/** 用户列表的一行 */
interface UserRow {
  userId?: string
  loginId?: string
  anonymousId?: string
  createTime?: string
}

const props = withDefaults(
  defineProps<{
    sumTotal?: number
    loading?: boolean
    allTableData?: UserRow[]
  }>(),
  {
    sumTotal: 0,
    loading: false,
    allTableData: () => [],
  },
)

const proxy = getCurrentInstance()?.proxy
const trackingStore = useTrackingStore()

const pageNum = ref(1)
const pageSize = ref(10)
const sortName = ref<string | null>(null)
const sortOrder = ref<string | null>(null)

const projectName = computed(() => trackingStore.projectName)
const total = computed(() => props.allTableData.length)

const currentTableList = computed(() => {
  let data = [...props.allTableData]
  const name = sortName.value
  if (name && sortOrder.value) {
    data = data.sort((a, b) => {
      const valA = (a as unknown as Record<string, unknown>)[name] as string | number | undefined
      const valB = (b as unknown as Record<string, unknown>)[name] as string | number | undefined
      // Simple comparison, can be enhanced for numbers/dates
      if (valA !== undefined && valB !== undefined && valA < valB)
        return sortOrder.value === 'asc' ? -1 : 1
      if (valA !== undefined && valB !== undefined && valA > valB)
        return sortOrder.value === 'asc' ? 1 : -1
      return 0
    })
  }
  const start = (pageNum.value - 1) * pageSize.value
  const end = pageNum.value * pageSize.value
  return data.slice(start, end)
})

function getIndex($index: number) {
  return (pageNum.value - 1) * pageSize.value + $index + 1
}

function copyRowId(id: string) {
  const textarea = document.createElement('textarea')
  textarea.value = id
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
  ElMessage.success('复制成功！')
}

function viewPortrait(row: UserRow) {
  openNewTab({
    name: 'userInfo',
    query: { projectName: projectName.value, userId: row.userId },
  })
}

function sortChange({ prop, order }: { prop: string; order: string | null }) {
  sortName.value = prop
  sortOrder.value = order === 'ascending' ? 'asc' : order === 'descending' ? 'desc' : null
}

function handleSizeChange(val: number) {
  pageSize.value = val
  pageNum.value = 1
}

function handleCurrentChange(val: number) {
  pageNum.value = val
}

watch(
  () => props.allTableData,
  () => {
    pageNum.value = 1
    // 与 v2 一致（v2 此处逻辑存疑：上一行刚把 pageNum 置为 1，紧接着又拿它跟 maxPage 比，
    // 这个 if 永远不成立，等同于没写）
    const maxPage = Math.ceil(total.value / pageSize.value) || 1
    if (pageNum.value > maxPage) {
      pageNum.value = maxPage
    }
  },
)
</script>

<template>
  <el-card v-loading="loading" class="public-hoverItem public-radius table-card public-card-block">
    <div class="public-firstHead setHeadMargin">用户列表</div>
    <el-table
      :data="currentTableList"
      :header-cell-style="{ background: '#f7fafe', textAlign: 'center' }"
      :cell-style="{ textAlign: 'center' }"
      border
      class="public-radius"
      max-height="500px"
      @sort-change="sortChange"
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
      <el-table-column prop="userId" label="用户ID（user_id）" show-overflow-tooltip>
        <template #default="scope">
          <div
            style="
              position: relative;
              width: 100%;
              display: flex;
              align-items: center;
              justify-content: flex-start;
              padding: 0 20px;
              box-sizing: border-box;
            "
          >
            <span
              style="
                cursor: pointer;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              "
              @click="viewPortrait(scope.row)"
              >{{ scope.row.userId }}</span
            >
            <el-icon
              v-if="scope.row.userId"
              style="color: #2c7be5; cursor: pointer; position: absolute; right: 0"
              @click.stop="copyRowId(scope.row.userId)"
            >
              <DocumentCopy />
            </el-icon>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="loginId" label="业务ID（login_id）" show-overflow-tooltip>
        <template #default="scope">
          <div
            style="
              position: relative;
              width: 100%;
              display: flex;
              align-items: center;
              justify-content: flex-start;
              padding: 0 20px;
              box-sizing: border-box;
            "
          >
            <span
              style="
                cursor: pointer;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              "
              @click="viewPortrait(scope.row)"
              >{{ scope.row.loginId }}</span
            >
            <el-icon
              v-if="scope.row.loginId"
              style="color: #2c7be5; cursor: pointer; position: absolute; right: 0"
              @click.stop="copyRowId(scope.row.loginId)"
            >
              <DocumentCopy />
            </el-icon>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="anonymousId" label="匿名ID（anonymous_id）" show-overflow-tooltip>
        <template #default="scope">
          <div
            style="
              position: relative;
              width: 100%;
              display: flex;
              align-items: center;
              justify-content: flex-start;
              padding: 0 20px;
              box-sizing: border-box;
            "
          >
            <span
              style="
                cursor: pointer;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              "
              @click="viewPortrait(scope.row)"
              >{{ scope.row.anonymousId }}</span
            >
            <el-icon
              v-if="scope.row.anonymousId"
              style="color: #2c7be5; cursor: pointer; position: absolute; right: 0"
              @click.stop="copyRowId(scope.row.anonymousId)"
            >
              <DocumentCopy />
            </el-icon>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="createTime" label="入库时间" width="180">
        <template #default="scope">
          <span style="cursor: pointer" @click="viewPortrait(scope.row)">{{
            scope.row.createTime
          }}</span>
        </template>
      </el-table-column>
      <el-table-column label="详情" align="center" width="120">
        <template #default="{ row }">
          <el-link type="primary" :icon="View" @click="viewPortrait(row)">查看</el-link>
        </template>
      </el-table-column>
    </el-table>
    <div style="position: relative">
      <el-pagination
        v-model:current-page="pageNum"
        class="setPagination"
        next-text="下一页"
        :page-sizes="[10, 20, 30]"
        :page-size="pageSize"
        layout="sizes, prev, pager, next, jumper"
        :total="total"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
      <div v-if="sumTotal > total" class="total-count">
        共{{ sumTotal }}条（当前数据仅显示前1万行）
      </div>
      <div v-else class="total-count">共 {{ sumTotal }} 条</div>
    </div>
  </el-card>
</template>

<style lang="scss" scoped>
// v2 这里是 ::v-deep { @import "~@/styles/components/el-pagination.scss"; }，
// v3 已在 styles/index.scss 全局 @use，组件内不再重复引入

.total-count {
  position: absolute;
  left: 0;
  top: 0;
  font-size: 14px;
  color: #606266;
}
</style>
