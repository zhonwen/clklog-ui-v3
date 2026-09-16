<script setup lang="ts">
import { computed, getCurrentInstance, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Delete, Edit } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import filterBar from './components/filterBar.vue'
import bookmarkDialog from '../custom-analysis/components/bookmarkDialog.vue'
import type { BookmarkTag } from '../custom-analysis/types'
import { copyObj } from '@/utils/copy'
import { deleteApi, getApi, getPageListApi } from '@/api/sysmanage/bookMark'
import { CUSTOM_ANALYSIS_PATH, FUNNEL_ANALYSIS_PATH } from '@/router/paths'
import { useTrackingStore } from '@/stores/tracking'
import { useLatestOnly } from '@/composables/useLatestOnly'

/** 我的书签列表页（v2 src/views/analysis-modules/bookMark/index.vue） */

interface BookmarkRow {
  bookmarkId?: string
  name?: string
  category?: string
  timeSection?: string
  remark?: string
  createTime?: string
  updateTime?: string
  creator?: string
  queryParams?: string
}

const proxy = getCurrentInstance()?.proxy
const router = useRouter()
const trackingStore = useTrackingStore()
const { next, isLatest } = useLatestOnly()
const { next: nextDetail, isLatest: isLatestDetail } = useLatestOnly()

const loadingRefresh = ref(false)
const filterBarParams = ref<Record<string, unknown>>({})
const pageNum = ref(1)
const pageSize = ref(10)
const total = ref(0)
const bookmarkIds = ref('')
const tableData = ref<BookmarkRow[]>([])

const bookmarkDialogRef = ref<InstanceType<typeof bookmarkDialog> | null>(null)

const projectName = computed(() => trackingStore.projectName)

const commonParams = computed<Record<string, unknown>>(() =>
  Object.assign({ projectName: projectName.value }, filterBarParams.value),
)

function initLoadApi(val: Record<string, unknown>) {
  const token = next()
  loadingRefresh.value = true
  const params = {
    pageNum: pageNum.value,
    pageSize: pageSize.value,
    sortName: 'createTime',
    sortOrder: 'desc',
    projectName: val.projectName,
    catetory: val.catetory,
    name: val.name,
  }
  getPageListApi(params)
    .then((res) => {
      if (!isLatest(token)) return
      if (res?.code == 200) {
        loadingRefresh.value = false
        const data = res.data as { rows?: BookmarkRow[]; total?: number }
        tableData.value = data?.rows || []
        total.value = Number(data?.total || 0)
      }
    })
    .catch(() => {
      if (!isLatest(token)) return
      loadingRefresh.value = false
    })
}

function deleteTableApi() {
  ElMessageBox.confirm('是否确认删除？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    cancelButtonClass: 'custom-cancel-button',
    type: 'warning',
  })
    .then(function () {
      return deleteApi({ bookmarkIds: bookmarkIds.value, projectName: projectName.value })
    })
    .then(() => {
      pageNum.value = 1
      initLoadApi(commonParams.value)
      ElMessage({ message: '删除成功', type: 'success' })
    })
    .catch(() => {})
}

function batchDelete() {
  if (!bookmarkIds.value) {
    ElMessage({ message: '请选择需要删除的内容', type: 'error' })
    return
  }
  deleteTableApi()
}

function handleSelectionChange(val: BookmarkRow[]) {
  const metaEventIdArray: (string | undefined)[] = []
  val.forEach((item) => {
    metaEventIdArray.push(item.bookmarkId)
  })
  bookmarkIds.value = metaEventIdArray.toString()
}

function toCustomModel(row: BookmarkRow) {
  const params = {
    bookmarkId: row.bookmarkId,
    name: row.name,
    remark: row.remark,
    timeSection: row.timeSection,
  }
  // v2 push 的是相对路径 'funnelAnalysis' / 'customAnalysis'，v3 统一走 router/paths.ts 的常量
  if (row.category == '漏斗分析') {
    void router.push({
      path: FUNNEL_ANALYSIS_PATH,
      query: { query: row.queryParams, tagObj: JSON.stringify(params), isBookMark: String(true) },
    })
  } else {
    void router.push({
      path: CUSTOM_ANALYSIS_PATH,
      query: { query: row.queryParams, tagObj: JSON.stringify(params), isBookMark: String(true) },
    })
  }
}

function updatePageList() {
  initLoadApi(commonParams.value)
}

// v2 里这个方法被重复定义了两次（内容完全相同），这里只保留一份
function setFilterBarParams(val: Record<string, unknown>) {
  filterBarParams.value = copyObj(val)
}

function handleUpdate(row: BookmarkRow) {
  const token = nextDetail()
  getApi({ bookmarkId: row.bookmarkId, projectName: projectName.value })
    .then((res) => {
      if (!isLatestDetail(token)) return
      if (res?.code == 200) {
        bookmarkDialogRef.value?.openDialog('更新书签', res.data as BookmarkTag)
      }
    })
    .catch(() => {
      if (!isLatestDetail(token)) return
    })
}

function handleDelete(row: BookmarkRow) {
  bookmarkIds.value = row.bookmarkId ?? ''
  deleteTableApi()
}

function getIndex(index: number) {
  return (pageNum.value - 1) * pageSize.value + index + 1
}

function handleSizeChange(val: number) {
  pageSize.value = val
  initLoadApi(commonParams.value)
}

function handleCurrentChange(val: number) {
  pageNum.value = val
  initLoadApi(commonParams.value)
}

watch(commonParams, (val) => {
  pageNum.value = 1
  initLoadApi(val)
})
</script>

<template>
  <div>
    <filterBar @set-filter-bar-params="setFilterBarParams" />
    <div class="public-block">
      <div
        class="block_online block-main public-hoverItem"
        style="margin-top: 20px; min-height: 600px"
      >
        <div style="display: flex; justify-content: space-between">
          <div class="public-tableHead">我的书签</div>
        </div>
        <el-button class="zc_btn_default" style="margin-bottom: 20px" @click="batchDelete()">
          批量删除
        </el-button>
        <!-- table -->
        <el-table
          v-loading="loadingRefresh"
          :header-cell-style="{ textAlign: 'center', background: '#f7fafe ' }"
          border
          :cell-style="{ textAlign: 'center' }"
          class="public-radius"
          :data="tableData"
          style="width: 100%; min-height: 300px"
          @selection-change="handleSelectionChange"
        >
          <el-table-column type="selection" fixed width="40" />
          <el-table-column type="index" label="序号" :width="proxy?.$fixedWidth.FwIndex">
            <template #default="scope">
              <div>
                <span>{{ getIndex(scope.$index) }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="name" label="书签名称" width="180">
            <template #default="{ row }">
              <div style="cursor: pointer; color: #2c7be5" @click="toCustomModel(row)">
                {{ row.name }}
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="category" label="类型" width="180" />
          <el-table-column prop="timeSection" label="统计时间段" />
          <el-table-column prop="remark" label="备注" />
          <el-table-column prop="createTime" label="创建时间" />
          <el-table-column prop="updateTime" label="修改时间" />
          <el-table-column prop="creator" label="创建人" />
          <el-table-column fixed="right" label="操作" align="left" width="130">
            <template #default="scope">
              <div style="display: flex; justify-content: center">
                <el-icon class="edit_btn" @click="handleUpdate(scope.row)"><Edit /></el-icon>
                <el-icon class="delete_btn" @click="handleDelete(scope.row)"><Delete /></el-icon>
              </div>
            </template>
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
      </div>
    </div>
    <bookmarkDialog ref="bookmarkDialogRef" @update-page-list="updatePageList" />
  </div>
</template>

<style lang="scss" scoped>
// 分页样式 el-pagination 已在 src/styles/index.scss 全局引入（sass 不允许 @use 出现在嵌套块里）

.edit_btn {
  width: 20px;
  height: 20px;
  line-height: 20px;
  border-radius: 2px;
  background: #dde4ed;
  color: #2c7be5;
  cursor: pointer;
}

.delete_btn {
  width: 20px;
  height: 20px;
  line-height: 20px;
  border-radius: 2px;
  background: #f3e2d0;
  color: #de6210;
  margin-left: 20px;
  cursor: pointer;
}
</style>
