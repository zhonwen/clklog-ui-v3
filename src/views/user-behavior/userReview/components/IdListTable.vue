<script setup lang="ts">
/** 用户复查 - 按ID筛选的用户列表（对应 v2 .../userReview/components/IdListTable.vue） */
import { computed, getCurrentInstance } from 'vue'
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
  updateTime?: string
}

const props = withDefaults(
  defineProps<{
    loading?: boolean
    tableList?: UserRow[]
    total?: number
    pageNum?: number
    pageSize?: number
  }>(),
  {
    loading: false,
    tableList: () => [],
    total: 0,
    pageNum: 1,
    pageSize: 10,
  },
)

const emit = defineEmits<{
  'sort-change': [payload: { prop: string; order: string | null }]
  'update:pageNum': [val: number]
  'update:pageSize': [val: number]
  change: []
}>()

const proxy = getCurrentInstance()?.proxy
const trackingStore = useTrackingStore()
const projectName = computed(() => trackingStore.projectName)

function getIndex($index: number) {
  return (props.pageNum - 1) * props.pageSize + $index + 1
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
  emit('sort-change', { prop, order })
}

function handleSizeChange(val: number) {
  emit('update:pageSize', val)
  emit('change')
}

function handleCurrentChange(val: number) {
  emit('update:pageNum', val)
  emit('change')
}
</script>

<template>
  <el-card v-loading="loading" class="public-hoverItem public-radius table-card public-card-block">
    <div class="public-firstHead setHeadMargin">用户列表</div>
    <el-table
      :data="tableList"
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
      <el-table-column prop="userId" label="用户ID（user_Id）" :show-overflow-tooltip="false">
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
      <el-table-column prop="loginId" label="业务ID（login_id）" :show-overflow-tooltip="false">
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
      <el-table-column
        prop="anonymousId"
        label="匿名ID（anonymous_id）"
        :show-overflow-tooltip="false"
      >
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
      <!-- 与 v2 一致：这两列的 prop 都写的 createTime，模板里一个渲染 updateTime、一个渲染 createTime -->
      <el-table-column prop="createTime" label="更新时间" width="160">
        <template #default="scope">
          <span style="cursor: pointer" @click="viewPortrait(scope.row)">{{
            scope.row.updateTime
          }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="createTime" label="入库时间" width="160">
        <template #default="scope">
          <span style="cursor: pointer" @click="viewPortrait(scope.row)">{{
            scope.row.createTime
          }}</span>
        </template>
      </el-table-column>

      <el-table-column label="详情" width="120" align="center">
        <template #default="{ row }">
          <el-link type="primary" :icon="View" @click="viewPortrait(row)">查看</el-link>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination
      class="setPagination"
      next-text="下一页"
      :current-page="pageNum"
      :page-sizes="[10, 20, 30]"
      :page-size="pageSize"
      layout="total, sizes, prev, pager, next, jumper"
      :total="total"
      @size-change="handleSizeChange"
      @current-change="handleCurrentChange"
    />
  </el-card>
</template>

<style lang="scss" scoped>
// v2 这里是 ::v-deep { @import "~@/styles/components/el-pagination.scss"; }，
// v3 已在 styles/index.scss 全局 @use，组件内不再重复引入
</style>
