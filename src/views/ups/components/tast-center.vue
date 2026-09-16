<script setup lang="ts">
/**
 * 下载任务中心（对应 v2 `src/views/ups/components/tast-center.vue`，文件名的拼写沿用 v2）。
 *
 * 父组件（标签详情弹窗 / 分群详情弹窗）通过 ref 调 openDialogTask 打开，所以必须 defineExpose。
 * 接口在 v2 里散落在 api/upsapi/tagmanage.js 和 api/trackingapi/download.js，
 * v3 统一从 api/upsapi/taskcenter.ts 取。
 */
import { computed, onBeforeUnmount, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Delete, Download, RefreshRight } from '@element-plus/icons-vue'
import { exportJobDelete, exportJobDownload, exportJobGetList } from '@/api/upsapi/taskcenter'
import { blobDownloads } from '@/utils/localDownloadUtil'
import { fixedWidth } from '@/components/el-table-width'
import { formatDateHMS } from '@/utils/date'
import { useTrackingStore } from '@/stores/tracking'
import { useLatestOnly } from '@/composables/useLatestOnly'

/** 导出任务的一行 */
interface TaskRow {
  id?: string | number
  fileName?: string
  taskStatus?: string
  downloadNum?: number
  startTime?: number | string
  updateTime?: number | string
}

type DownloadResponse = { data: BlobPart; headers?: unknown }

const trackingStore = useTrackingStore()
const { next, isLatest } = useLatestOnly()

const dialogVisibleTask = ref(false)
const tableData = ref<TaskRow[]>([])
const taskListLoading = ref(false)
/** v2 的 exportGetListInit 里用 setTimeout 延迟拉列表，卸载时要清掉 */
let refreshTimer: ReturnType<typeof setTimeout> | null = null

const projectName = computed(() => trackingStore.projectName)

/** 模板里两列时间都要格式化，这里一次算好（避免模板重复调函数） */
const tableRows = computed(() =>
  tableData.value.map((row) => ({
    ...row,
    startTimeText: formatDateHMS(row.startTime),
    updateTimeText: formatDateHMS(row.updateTime),
  })),
)

function exportGetListInit(time = 0) {
  taskListLoading.value = true
  const token = next()
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => {
    exportJobGetList({ projectName: projectName.value })
      .then((res) => {
        if (!isLatest(token)) return
        if (res?.data) {
          taskListLoading.value = false
          tableData.value = (res.data as TaskRow[]) || []
        }
      })
      .catch(() => {
        if (!isLatest(token)) return
        taskListLoading.value = false
      })
  }, time)
}

function deleteJob(row: TaskRow) {
  void exportJobDelete({ id: row.id, projectName: projectName.value }).then((res) => {
    if (res?.code == 200) {
      ElMessage.success('删除成功')
      exportGetListInit()
    }
  })
}

/** 与 v2 一致：从 content-disposition 的 `filename*=utf-8''` 里取文件名，取不到返回 null */
function sliceTypeFile(res: DownloadResponse) {
  // axios 1.x 的 headers 是 AxiosHeaders 实例，下标能取到，这里补一个 .get() 兜底
  const headers = res.headers as
    | ({ get?: (k: string) => unknown } & Record<string, unknown>)
    | undefined
  const fileName = String(
    headers?.['content-disposition'] || headers?.get?.('content-disposition') || '',
  )
  const regex = /filename\*=utf-8''(.*)/
  const match = fileName.match(regex)
  const encodedFileName = match?.[1]
  if (encodedFileName) {
    // URL解码匹配到的编码字符串
    return decodeURIComponent(encodedFileName)
  }
  return null
}

function downLoadJob(row: TaskRow) {
  void (exportJobDownload({ id: row.id, projectName: projectName.value }) as unknown as Promise<
    DownloadResponse
  >)
    .then((res) => {
      const name = sliceTypeFile(res)
      // 与 v2 一致（v2 此处逻辑存疑：sliceTypeFile 取不到时返回 null，
      // 会被 setAttribute('download', null) 变成字符串 "null" 当文件名）
      blobDownloads(res.data, name as string)
    })
    .catch(() => {})
}

function openDialogTask() {
  dialogVisibleTask.value = true
  exportGetListInit(0)
}

function handleClose() {
  dialogVisibleTask.value = false
}

onBeforeUnmount(() => {
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = null
})

defineExpose({ openDialogTask, exportGetListInit, dialogVisibleTask })
</script>

<template>
  <div>
    <el-dialog
      v-model="dialogVisibleTask"
      :show-close="true"
      :modal-append-to-body="false"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      width="1000px"
      top="7vh"
      title="下载任务"
      :before-close="handleClose"
    >
      <div
        class="public-hoverItem"
        style="padding: 25px; font-size: 20px; background-color: #fff; position: relative"
      >
        <div style="position: absolute; top: -56px; right: 25px">
          <el-button
            :icon="RefreshRight"
            style="margin-right: 20px; width: 72px"
            class="zc_btn"
            @click="exportGetListInit(500)"
            >刷新</el-button
          >
        </div>
        <!-- v2 上有个 ref="singleTable"，没有任何地方用到，迁移时去掉 -->
        <el-table
          v-loading="taskListLoading"
          :data="tableRows"
          border
          height="600px"
          style="width: 100%"
          class="public-radius"
          highlight-current-row
          :header-cell-style="{
            textAlign: 'center',
            background: '#f7fafe  ',
          }"
          :cell-style="{ textAlign: 'center' }"
        >
          <el-table-column type="index" label="序号" :width="fixedWidth.FwIndex" />
          <el-table-column prop="fileName" label="报表名称" width="180" />
          <el-table-column prop="taskStatus" label="状态" />
          <el-table-column prop="downloadNum" label="下载次数" width="80" />
          <el-table-column prop="startTime" label="提交时间">
            <template #default="{ row }">
              <div>{{ row.startTimeText }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="updateTime" label="更新时间">
            <template #default="{ row }">
              <div>{{ row.updateTimeText }}</div>
            </template>
          </el-table-column>

          <el-table-column prop="" label="操作" align="center" width="150">
            <template #default="{ row }">
              <div style="display: flex">
                <div
                  v-if="row.taskStatus == '已完成'"
                  class="btnEvent"
                  style="margin-right: 10px"
                  @click="downLoadJob(row)"
                >
                  <el-icon style="padding-right: 3px; font-size: 14px"><Download /></el-icon>下载
                </div>
                <div class="btnEvent" @click="deleteJob(row)">
                  <el-icon style="padding-right: 3px; font-size: 14px"><Delete /></el-icon>删除
                </div>
              </div>
            </template>
          </el-table-column>
        </el-table>

        <!--
          与 v2 一致：v2 这里写的是 slot="footer"，但它挂在 el-dialog 默认插槽内部的一个
          普通 div 上（不是 el-dialog 的直接子节点），所以从来没有生效为弹窗 footer，
          就是跟在表格后面的一行按钮。这里保持同样的渲染位置。
        -->
        <div
          class="dialog-footer"
          style="margin-top: 20px; display: flex; justify-content: flex-end"
        >
          <el-button class="zc_btn_default" @click="dialogVisibleTask = false">取 消</el-button>
          <el-button class="zc_btn" @click="dialogVisibleTask = false">确 定</el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
// v2 这里在 ::v-deep 里 @import 了 el-checkbox.scss / el-pagination.scss：
// 本组件既没有 checkbox 也没有分页，且 el-pagination 样式 v3 已全局引入，都不再引

:deep(.el-form-item__label) {
  text-align: left;
}

:deep(.el-dialog) {
  border-radius: 6px;
}

:deep(.el-dialog__headerbtn) {
  top: 15px;
}

:deep(.el-dialog__header) {
  padding: 0 !important;
  border-radius: 6px;
  height: 44px;
  line-height: 44px;
  background: #fbfcfe;
}

:deep(.el-dialog__title) {
  margin-left: 16px;
  font-size: 15px;
  color: #4d4d4d;
  font-weight: bold;
}

:deep(.el-dialog__body) {
  padding: 20px !important;
  background-color: #eef4fd;
  border-radius: 6px;
}

.btnEvent {
  cursor: pointer;
  width: 65px;
  height: 28px;
  color: #194580;
  font-weight: 600px;
  border: 1px solid #d8e2ef;
  border-radius: 4px;
  font-size: 12px;
  line-height: 28px;
  text-align: center;
}

.closeIcon {
  cursor: pointer;
  font-size: 20px;
}

.closeIcon:hover {
  color: #2c7be5;
}
</style>
