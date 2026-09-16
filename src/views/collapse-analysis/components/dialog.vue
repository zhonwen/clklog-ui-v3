<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, ref } from 'vue'
import { Close, View } from '@element-plus/icons-vue'
import eventBar from './eventBar.vue'
import collapseDetail from './collapseDetail-dialog.vue'
import { copyObj } from '@/utils/copy'
import { percentage } from '@/utils/percent'
import { makeTableCellCenterByIndex } from '@/utils/index'
import { getPageApi, getPagedSummaryApi } from '@/api/trackingapi/collapse'
import { useLatestOnly } from '@/composables/useLatestOnly'

/** 崩溃数据弹窗（v2 src/views/collapse-analysis/components/dialog.vue） */

interface CrashSummaryRow {
  appVersion?: string
  channel?: string
  model?: string
  visitCount?: number
  crashedCount?: number
  pvRate?: number
  uv?: number
  crashedUv?: number
  uvRate?: number
  modelCount?: number
  eventName?: string
  [key: string]: unknown
}

interface CrashLogRow {
  logTime?: string
  appVersion?: string
  os?: string
  osVersion?: string
  model?: string
  appCrashedReason?: string
  eventSessionId?: string
  [key: string]: unknown
}

const proxy = getCurrentInstance()?.proxy

const { next: nextLog, isLatest: isLatestLog } = useLatestOnly()
const { next: nextSum, isLatest: isLatestSum } = useLatestOnly()

const activeTab = ref('崩溃设备数据汇总')
const eventDialogVisible = ref(false)
const loadingRefresh = ref(false)
const rowList = ref<CrashSummaryRow>({})

const pageNum = ref(1)
const pageSize = ref(10)
const total = ref(0)

const dataSumList = ref<CrashSummaryRow[]>([])
const sum_total = ref(0)
const sum_pageSize = ref(10)
const sum_pageNum = ref(1)
const crashLogList = ref<CrashLogRow[]>([])
const commonParams = ref<Record<string, unknown>>({})

const eventBarRef = ref<{
  statisticEvent: (params: Record<string, unknown>, flag: number) => void
} | null>(null)
const collapseDetailRef = ref<{ openErrorLog: (row: CrashLogRow) => void } | null>(null)

// v2 的 tableHeaderColor：第 6 列左对齐，其余居中。
// element-plus 会对 cell-style 的返回值做 Object.assign，返回字符串会被展开成 {0:'t',...}
// 并抛 Failed to set an indexed property，所以统一用返回对象的工具函数。
const tableHeaderColor = makeTableCellCenterByIndex([], [6])

// 模板里每个单元格都要走一次过滤器，这里先一次性算好，避免模板反复调用同一函数
const sumRows = computed(() =>
  dataSumList.value.map((row) => ({
    ...row,
    pvRateText: percentage(row.pvRate),
    uvRateText: percentage(row.uvRate),
  })),
)

function handleDetailDialog(row: CrashLogRow) {
  collapseDetailRef.value?.openErrorLog(row)
}

/** 崩溃日志 */
function getLogList() {
  commonParams.value.pageSize = pageSize.value
  commonParams.value.pageNum = pageNum.value
  loadingRefresh.value = true
  const token = nextLog()
  getPageApi(commonParams.value)
    .then((res) => {
      if (!isLatestLog(token)) return
      if (res?.code == 200) {
        loadingRefresh.value = false
        const data = (res.data ?? {}) as { total?: number; rows?: CrashLogRow[] }
        total.value = data.total ?? 0
        crashLogList.value = data.rows ?? []
      }
    })
    .catch(() => {
      if (!isLatestLog(token)) return
      loadingRefresh.value = false
    })
}

/** 汇总 */
function getPagedSummary() {
  loadingRefresh.value = true
  commonParams.value.pageSize = sum_pageSize.value
  commonParams.value.pageNum = sum_pageNum.value
  const token = nextSum()
  getPagedSummaryApi(commonParams.value)
    .then((res) => {
      if (!isLatestSum(token)) return
      if (res?.code == 200) {
        loadingRefresh.value = false
        const data = (res.data ?? {}) as { total?: number; rows?: CrashSummaryRow[] }
        sum_total.value = data.total ?? 0
        dataSumList.value = data.rows ?? []
      }
    })
    .catch(() => {
      if (!isLatestSum(token)) return
      loadingRefresh.value = false
    })
}

function checkTabLable(tab: string) {
  if (tab == '崩溃设备数据汇总') {
    getPagedSummary()
  } else {
    getLogList()
  }
}

function initPaginaton() {
  pageNum.value = 1
  sum_pageNum.value = 1
  pageSize.value = 10
  sum_pageSize.value = 10
}

function openDialogEvent(row: CrashSummaryRow, params: Record<string, unknown>) {
  initPaginaton()
  activeTab.value = '崩溃设备数据汇总'
  commonParams.value = copyObj(params)
  rowList.value = copyObj(row)
  // 与 v2 一致（v2 此处逻辑存疑：列表里的 channel 本身就是「安卓 / 苹果」，
  // 只有等于 "Android" 才会被改写成「安卓」，其余任何取值（含「安卓」本身）都会被强制改成「苹果」）
  if (rowList.value.channel == 'Android') {
    rowList.value.channel = '安卓'
  } else {
    rowList.value.channel = '苹果'
  }
  commonParams.value.model = ''
  commonParams.value.channel = rowList.value.channel ? [rowList.value.channel] : []
  commonParams.value.version = row.appVersion
  commonParams.value.eventName = rowList.value.eventName

  eventDialogVisible.value = true
  void nextTick(() => {
    eventBarRef.value?.statisticEvent(commonParams.value, 1)
  })
  checkTabLable(activeTab.value)
}

function handleClick() {
  pageNum.value = 1
  sum_pageNum.value = 1
  checkTabLable(activeTab.value)
}

function handleClose() {
  eventDialogVisible.value = false
}

/** 切换参数 */
function setFilterBarParams(val: Record<string, unknown>) {
  pageNum.value = 1
  sum_pageNum.value = 1
  const params = copyObj(val)
  commonParams.value.endTime = params.endTime
  commonParams.value.startTime = params.startTime
  commonParams.value.channel = params.channel ? [params.channel] : []
  commonParams.value.version = params.version
  commonParams.value.model = params.model
  checkTabLable(activeTab.value)
}

function getSumIndex($index: number) {
  return (sum_pageNum.value - 1) * sum_pageSize.value + $index + 1
}

function getIndex($index: number) {
  return (pageNum.value - 1) * pageSize.value + $index + 1
}

function handleSizeChange(val: number) {
  pageNum.value = 1
  pageSize.value = val
  getLogList()
}

function handleCurrentChange(val: number) {
  pageNum.value = val
  getLogList()
}

function handleSizeChangeSum(val: number) {
  sum_pageNum.value = 1
  sum_pageSize.value = val
  getPagedSummary()
}

function handleCurrentChangeSum(val: number) {
  sum_pageNum.value = val
  getPagedSummary()
}

// v2 里父组件用 this.$refs.dialogCollapase.openDialogEvent(row, params) 调用，<script setup> 默认对外封闭
defineExpose({ openDialogEvent })
</script>

<template>
  <div>
    <el-dialog
      v-model="eventDialogVisible"
      :show-close="false"
      :close-on-press-escape="false"
      width="80vw"
      top="2vh"
      style="overflow-y: auto; box-sizing: border-box"
    >
      <!-- v2 还写了 :modal-append-to-body="false"，element-plus 已移除该属性 -->
      <div>
        <div class="custom-header">
          <div>
            <div
              style="
                height: 44px;
                background: #fbfcfe;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-radius: 6px 6px 0 0;
              "
            >
              <div
                style="
                  font-size: 16px;
                  font-weight: bold;
                  line-height: 44px;
                  margin-left: 16px;
                  color: #4d4d4d;
                "
              >
                崩溃数据
              </div>
              <div class="closeIcon" @click="handleClose">
                <el-icon><Close /></el-icon>
              </div>
            </div>
          </div>
          <div class="public-hoverItem" style="margin: 20px; box-sizing: border-box">
            <eventBar
              ref="eventBarRef"
              class="event_x"
              @set-filter-bar-params="setFilterBarParams"
            />
          </div>
        </div>

        <div
          style="
            min-height: 400px;
            max-height: 1000px;
            width: 80vw;
            overflow: auto;
            position: relative;
          "
        >
          <div v-loading="loadingRefresh" class="userLoyalty public-hoverItem">
            <el-tabs v-model="activeTab" class="custom_tab" @tab-click="handleClick">
              <el-tab-pane label="崩溃设备数据汇总" name="崩溃设备数据汇总">
                <div class="tab-warry block-main">
                  <div class="table-block">
                    <el-table
                      :header-cell-style="{
                        textAlign: 'center',
                        background: '#f7fafe ',
                      }"
                      :cell-style="{ textAlign: 'center' }"
                      class="public-radius"
                      border
                      :data="sumRows"
                      style="width: 100%"
                    >
                      <el-table-column
                        label="序号"
                        type="index"
                        :width="proxy?.$fixedWidth.FwIndex"
                        align="center"
                      >
                        <template #default="scope">
                          <span v-text="getSumIndex(scope.$index)"> </span>
                        </template>
                      </el-table-column>
                      <el-table-column prop="appVersion" label="应用版本" width="180" />

                      <el-table-column prop="channel" label="操作系统" width="180" />
                      <el-table-column prop="model" label="设备型号" width="180" />

                      <el-table-column prop="visitCount" label="访问次数" />
                      <el-table-column prop="crashedCount" label="崩溃次数" />
                      <el-table-column prop="pvRate" label="崩溃率">
                        <template #default="{ row }">
                          {{ row.pvRateText }}
                        </template>
                      </el-table-column>
                      <el-table-column prop="uv" label="访问用户数" />
                      <el-table-column prop="crashedUv" label="崩溃触发用户数" />
                      <el-table-column prop="uvRate" label="崩溃触发用户占比">
                        <template #default="{ row }">
                          {{ row.uvRateText }}
                        </template>
                      </el-table-column>
                      <el-table-column prop="pvRate" label="崩溃数占比">
                        <template #default="{ row }">
                          {{ row.pvRateText }}
                        </template>
                      </el-table-column>
                    </el-table>
                  </div>
                  <div class="block">
                    <el-pagination
                      v-model:current-page="sum_pageNum"
                      next-text="下一页"
                      :page-sizes="[10, 20, 30, 40]"
                      :page-size="sum_pageSize"
                      layout="total, sizes, prev, pager, next, jumper"
                      :total="sum_total"
                      @size-change="handleSizeChangeSum"
                      @current-change="handleCurrentChangeSum"
                    />
                  </div>
                </div>
              </el-tab-pane>
              <el-tab-pane label="崩溃日志" name="崩溃日志">
                <div class="tab-warry block-main">
                  <div class="table-block">
                    <el-table
                      :header-cell-style="{
                        textAlign: 'center',
                        background: '#f7fafe ',
                      }"
                      :cell-style="tableHeaderColor"
                      class="public-radius"
                      border
                      :data="crashLogList"
                      style="width: 100%"
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
                      <el-table-column prop="logTime" label="崩溃时间" width="170" />
                      <el-table-column prop="appVersion" label="应用版本" />
                      <el-table-column prop="os" label="操作系统" width="180" />
                      <el-table-column prop="osVersion" label="操作系统版本" />
                      <el-table-column prop="model" label="设备型号" />
                      <el-table-column
                        prop="appCrashedReason"
                        width="200"
                        :show-overflow-tooltip="false"
                        label="崩溃详情信息"
                      >
                        <template #default="{ row }">
                          <div
                            style="
                              display: flex;
                              justify-content: center;
                              align-items: center;
                              position: relative;
                            "
                            @click="handleDetailDialog(row)"
                          >
                            <div
                              style="
                                text-align: center;
                                width: 200px;
                                overflow: hidden;
                                text-overflow: ellipsis;
                                white-space: nowrap;
                                margin-right: 15px;
                                cursor: pointer;
                              "
                            >
                              {{ row.appCrashedReason }}
                            </div>

                            <el-icon
                              v-if="row.appCrashedReason"
                              style="color: #2c7be5; cursor: pointer"
                            >
                              <View />
                            </el-icon>
                          </div>
                        </template>
                      </el-table-column>
                      <el-table-column prop="eventSessionId" min-width="320" label="会话ID" />
                    </el-table>
                  </div>
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
              </el-tab-pane>
            </el-tabs>
          </div>
        </div>
      </div>
    </el-dialog>
    <collapseDetail ref="collapseDetailRef" />
  </div>
</template>

<style lang="scss" scoped>
// v2 这里在 ::v-deep 块内 @import 了 el-checkbox.scss / el-pagination.scss。
// v3 的 sass 不允许 @use 出现在嵌套块内（会整页编译失败）：
//   - el-pagination.scss 已在 src/styles/index.scss 全局引入；
//   - el-checkbox.scss 本身已是 :deep(...) 写法，可以在顶层 @use。
@use '@/styles/components/el-checkbox.scss';

:deep() {
  .custom_tab {
    .el-tabs__item {
      // padding: 0 10px;
      width: 150px;
    }
  }

  // v2 原样保留的空规则
  .event_x .headerFilter .tabBar {
    // position: relative !important;
  }

  .el-tabs__header {
    background-color: #f9fafd;
    margin: 0 0;
    border-radius: 6px 6px 0 0;
  }

  .el-tabs__item.is-active {
    background-color: #fff;
    border-radius: 6px 0 0 0;
  }

  .el-tabs__nav-wrap::after {
    background-color: #fff;
  }

  .el-tabs__item {
    padding: 0 0;
    width: 130px;
    height: 65px;
    line-height: 65px;
    text-align: center;
    font-size: 15px;
    font-weight: bold;
    color: #4d4d4d;
  }
}

.tab-warry {
  min-height: 500px;
  border-radius: 6px;
}

.userLoyalty {
  margin: 20px;
  margin-top: 0;
  box-sizing: border-box;
  background: #fff;
  position: relative;
  border-radius: 6px !important;
}

.con_tip {
  width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 20px;
}

:deep() {
  .el-dialog {
    border-radius: 6px;
  }

  .el-dialog__headerbtn {
    top: 15px;
  }

  .el-dialog__header {
    padding: 0 !important;
    border-radius: 6px;
  }

  .el-dialog__body {
    padding: 0;
    background-color: #eef4fd;
    border-radius: 6px;
  }
}

.closeIcon {
  margin-right: 30px;
  cursor: pointer;
  font-size: 20px;
}

.closeIcon:hover {
  color: #2c7be5;
}

.trendDiv {
  min-height: 462px;
  background-color: #fff;
  border-radius: 6px;
}

.setSpace {
  margin-bottom: 8px;
  margin-left: 25px;
}

.setBody {
  margin-bottom: 8px;
}

.mapTable {
  width: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
