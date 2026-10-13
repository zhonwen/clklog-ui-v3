<script setup lang="ts">
import { getCurrentInstance, ref } from 'vue'
import type { CSSProperties } from 'vue'
import { getAppList } from '@/api/sysmanage/appmanage'
import type { AppRow } from '@/api/sysmanage/appmanage'
import { getStat } from '@/api/sysmanage/globalsetting'
import type { LogStat } from '@/api/sysmanage/globalsetting'
import { conver, formatNumber } from '@/utils/format'
import { useLatestOnly } from '@/composables/useLatestOnly'
import { useTrackingStore } from '@/stores/tracking'
import FilterBar from './component/filterBar.vue'

type QueryParams = {
  pageNum: number
  pageSize: number
  startDate?: string
  endDate?: string
}

const proxy = getCurrentInstance()?.proxy
const trackingStore = useTrackingStore()
const { next: nextStat, isLatest: isLatestStat } = useLatestOnly()
const { next: nextList, isLatest: isLatestList } = useLatestOnly()

const loadingRefresh = ref(false)
const loadingSecond = ref(false)
const queryParams = ref<QueryParams>({
  pageNum: 1,
  pageSize: 10,
})
const appList = ref<AppRow[]>([])
const total = ref(0)
const statList = ref<LogStat[]>([])
const commonParams = ref<{ startTime?: string; endTime?: string }>({})

function getIndex($index: number) {
  return (queryParams.value.pageNum - 1) * queryParams.value.pageSize + $index + 1
}

// 必须返回对象：element-plus 会对返回值做 Object.assign，
// v2 这里返回的是 'text-align:left' 字符串，在 Vue3 下会被拆成 {0:'t',1:'e'...} 并抛
// Failed to set an indexed property [0] on CSSStyleDeclaration
function tableHeaderColor({ columnIndex }: { columnIndex: number }): CSSProperties {
  if (columnIndex == 0 || columnIndex == 1) {
    return { textAlign: 'center' }
  } else {
    return { textAlign: 'left' }
  }
}

function headerCellStyle({ columnIndex }: { columnIndex: number }): CSSProperties {
  // 判断是否是第一个表头单元格
  if (columnIndex == 0 || columnIndex == 1) {
    return {
      backgroundColor: '#f7fafe',
      textAlign: 'center',
    }
  } else {
    return {
      backgroundColor: '#f7fafe',
      textAlign: 'left',
    }
  }
}

function loadStat() {
  loadingRefresh.value = true
  const token = nextStat()
  const params = {
    endDate: commonParams.value.endTime,
    startDate: commonParams.value.startTime,
  }
  getStat(params)
    .then((response) => {
      if (!isLatestStat(token)) return
      loadingRefresh.value = false
      statList.value = [response?.data || {}]
    })
    .catch(() => {
      if (!isLatestStat(token)) return
      loadingRefresh.value = false
    })
}

function getList(flag?: boolean) {
  loadingSecond.value = true
  queryParams.value.endDate = commonParams.value.endTime
  queryParams.value.startDate = commonParams.value.startTime

  const token = nextList()
  getAppList({ ...queryParams.value })
    .then((response) => {
      if (!isLatestList(token)) return
      loadingSecond.value = false
      if (response?.data) {
        appList.value = response.data.rows || []
        total.value = Number(response.data.total || 0)
        if (flag) {
          // 与 v2 一致（v2 此处逻辑存疑：getList 从未被传过 flag，这一支实际上永远不会走；
          // 而且这里写进 projectArray 的是带 stat 的日志行，并不是项目下拉用的项目列表）
          trackingStore.setProjectArray(
            (response.data.rows || []).map((item) => ({
              projectName: item.projectName || '',
              projectDisplayName: item.projectDisplayName || '',
            })),
          )
        }
      }
    })
    .catch(() => {
      if (!isLatestList(token)) return
      // 与 v2 一致（v2 此处逻辑存疑：getList 的 catch 关的是 loadingRefresh，应该是 loadingSecond）
      loadingRefresh.value = false
    })
}

function setFilterBarParams(val: Record<string, unknown>) {
  queryParams.value.pageNum = 1
  commonParams.value = val as { startTime?: string; endTime?: string }
  getList()
  loadStat()
}

function handleSizeChange(val: number) {
  queryParams.value.pageSize = val
  getList()
}

function handleCurrentChange(val: number) {
  queryParams.value.pageNum = val
  getList()
}
</script>

<template>
  <div>
    <FilterBar @set-filter-bar-params="setFilterBarParams" />
    <div class="public-block">
      <div v-loading="loadingRefresh" class="Overview public-hoverItem" style="padding: 25px">
        <div class="public-firstHead">全部日志汇总</div>
        <div style="width: 100%; margin-top: 15px">
          <el-table
            border
            :data="statList"
            :header-cell-style="{ textAlign: 'left', background: '#f7fafe ' }"
            class="public-radius"
            :cell-style="{ textAlign: 'left' }"
          >
            <el-table-column label="receiver日志" align="left">
              <template #default="scope">
                <div style="flex-direction: column; align-items: flex-start">
                  <div style="width: 180px">
                    <el-tooltip placement="top">
                      <template #content>
                        {{ scope.row.logRecordCount || '--' }}
                      </template>
                      <div class="sumTip">记录总数：{{ formatNumber(scope.row.logRecordCount) }}</div>
                    </el-tooltip>
                  </div>
                  <p>占用空间量：&nbsp;{{ conver(scope.row.logSpaceSize) }}</p>
                  <p>最后更新时间：&nbsp;{{ scope.row.logLatestTime || '--' }}</p>
                  <!-- v2 这里的「采集天数」已被注释掉，保持一致不迁移 -->
                </div>
              </template>
            </el-table-column>
            <el-table-column label="clickhouse原始日志" align="left">
              <template #default="scope">
                <div style="flex-direction: column; align-items: flex-start">
                  <div style="width: 180px">
                    <el-tooltip placement="top">
                      <template #content>
                        {{ scope.row.dbRecordCount }}
                      </template>
                      <div class="sumTip">
                        记录总数：&nbsp;{{ formatNumber(scope.row.dbRecordCount) }}
                      </div>
                    </el-tooltip>
                  </div>
                  <p>占用空间量：&nbsp;{{ conver(scope.row.dbSpaceSize) }}</p>
                  <p>首次入库时间：&nbsp;{{ scope.row.dbFirstTime || '--' }}</p>
                  <p>最后更新时间：&nbsp;{{ scope.row.dbLatestTime || '--' }}</p>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>

      <div
        v-loading="loadingSecond"
        class="Overview public-hoverItem"
        style="padding: 25px; margin-top: 20px"
      >
        <div class="public-firstHead">各应用日志汇总</div>
        <br />
        <el-table
          border
          :data="appList"
          :header-cell-style="headerCellStyle"
          class="public-radius"
          :cell-style="tableHeaderColor"
          style="min-height: 500px"
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
          <el-table-column label="应用名称" align="left" prop="projectDisplayName" />
          <el-table-column label="receiver日志" align="left">
            <template #default="scope">
              <div class="app-table" style="flex-direction: column; align-items: flex-start">
                <div style="width: 180px">
                  <el-tooltip placement="top">
                    <template #content>
                      {{ scope.row.stat.logRecordCount || '--' }}
                    </template>
                    <div class="sumTip">
                      记录总数：&nbsp;{{ formatNumber(scope.row.stat.logRecordCount) }}
                    </div>
                  </el-tooltip>
                </div>

                <p>占用空间量：&nbsp;{{ conver(scope.row.stat.logSpaceSize) }}</p>
                <p>最后更新时间：&nbsp;{{ scope.row.stat.logLatestTime || '--' }}</p>
                <p>采集天数：&nbsp;{{ scope.row.stat.logDays || '--' }}</p>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="clickhouse原始日志" align="left">
            <template #default="scope">
              <div class="app-table" style="flex-direction: column; align-items: flex-start">
                <div style="width: 180px">
                  <el-tooltip placement="top">
                    <template #content>
                      {{ scope.row.stat.dbRecordCount || '--' }}
                    </template>
                    <div class="sumTip">
                      记录总数：&nbsp;{{ formatNumber(scope.row.stat.dbRecordCount) }}
                    </div>
                  </el-tooltip>
                </div>
                <p>首次入库时间：&nbsp;{{ scope.row.stat.dbFirstTime || '--' }}</p>
                <p>最后更新时间：&nbsp;{{ scope.row.stat.dbLatestTime || '--' }}</p>
                <!-- v2 这里的「占用空间量」已被注释掉，保持一致不迁移 -->
              </div>
            </template>
          </el-table-column>
        </el-table>
        <div class="block">
          <el-pagination
            v-model:current-page="queryParams.pageNum"
            :page-sizes="[10, 20, 30, 40]"
            :page-size="queryParams.pageSize"
            layout="total,sizes, prev, pager, next, jumper"
            :total="total"
            @size-change="handleSizeChange"
            @current-change="handleCurrentChange"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.sumTip {
  cursor: pointer;
}

.customTable table td {
  text-align: left;
  padding-left: 15px;
}

.sumItem {
  width: 50%;
  padding-left: 20px;
  box-sizing: border-box;

  .summary-title {
    letter-spacing: 1px;
    margin-bottom: 5px;
  }

  .summary {
    display: flex;
    font-size: 14px;
    color: #606266;
    line-height: 25px;
    padding: 3px 0;
  }
}

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

.addProject.el-button {
  color: #2c7be5;
  border: 1px solid #2c7be5;
  margin-bottom: 25px;
}

// 分页样式 el-pagination 已在 src/styles/index.scss 全局引入（sass 不允许 @use 出现在嵌套块里）
// v2 这里还有一条 .el-form-item.is-error ... 规则，规则体整体被注释掉了，等同于空规则，不迁移
:deep() {
  .el-form-item__label {
    font-weight: 400;
  }

  .el-dialog {
    border-radius: 6px;
  }

  .el-dialog__footer {
    text-align: left;
    margin-left: 30px;
  }

  .el-textarea__inner {
    border: 1px solid #fff;
    border-bottom: 1px solid #dcdfe6;
  }

  .el-textarea__inner {
    resize: none;
  }

  .el-input__inner {
    border-bottom: 1px solid #dcdfe6;
  }
}

.gm {
  width: 100%;
}

.gm li {
  float: left;
  width: 100%;
}

.gm-left-header {
  width: 100%;
  padding-left: 20px;
  font-weight: 400px !important;
}

.gm-right {
  width: 100%;
  margin-left: 20px;
}

.gm-h1 {
  font-size: 14px;
  color: #606266;
}

.gm-h2 {
  font-size: 13px;
  color: #888;
  padding-left: 5px;
}

.gm-right-prompt {
  font-size: 13px;
  background-color: #f7f9fe;
  padding: 10px;
  color: #808080;
  margin-right: 20px;
  position: absolute;
  bottom: 10px;
  line-height: 28px;
}

.gm-input-01 {
  border: none !important;
  border-bottom: 1px solid #aaa;
}

.gp-item-01 {
  font-weight: 400px !important;
  width: 100%;
}

.gp-item-01 .el-form-item__content {
  width: 100%;
}

.el-form-item__label {
  font-size: 20px;
}

.app-table {
  display: flex;
  justify-content: space-between;
  align-items: center;
  // padding: 0 50px;
  width: 100%;
  border: none;
  color: #888;

  p {
    padding: 3px 0;
    margin: 0;
  }
}

.app-table tr td {
  border: none;
  padding: 5px 5px;
}

.app-table .app-table-left {
  width: 45%;
}

.app-table-left span {
  display: inline-block;
}

.app-table-left label {
  color: #888;
  width: 70px !important;
  display: inline-block;
}
</style>
