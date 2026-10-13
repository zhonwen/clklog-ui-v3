<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { CSSProperties } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { Plus, View } from '@element-plus/icons-vue'
import {
  pageMerge,
  mergeDetail,
  mergeStats,
  manualMerge,
} from '@/api/sysmanage/idm3userassoc'
import type { MergeRecordItem } from '@/api/sysmanage/idm3userassoc'
import { MERGE_REASON_OPTIONS, MERGE_STATUS_OPTIONS, labelOf } from './constants'
import { formatDateHMS } from '@/utils/date'
import { useTrackingStore } from '@/stores/tracking'

const DETAIL_GROUPS = [
  { key: 'identityDetails', label: '身份迁移(IDENTITY)' },
  { key: 'anoDetails', label: '匿名迁移(ANO)' },
  { key: 'loginDetails', label: '登录迁移(LOGIN)' },
  { key: 'transitiveDetails', label: '传递闭包(TRANSITIVE)' },
]

const trackingStore = useTrackingStore()

const activePane = ref('record')
const isDemo = ref(false)
const loading = ref(false)

const query = ref({
  mergeReason: '',
  status: '',
  userIdSearch: '',
  timeRange: null as [string, string] | null,
  pageNum: 1,
  pageSize: 20,
})

const recordList = ref<MergeRecordItem[]>([])
const total = ref(0)

const detailVisible = ref(false)
const detail = ref<MergeRecordItem>({})

const statsLoading = ref(false)
const statsQuery = ref({ timeRange: null as [string, string] | null })
const stats = ref<{
  failRate: number | null
  statusStatsList: { key: string; value: number }[]
  reasonStatsList: { key: string; value: number }[]
  timeStatsList: { key: string; value: number }[]
}>({
  failRate: null,
  statusStatsList: [],
  reasonStatsList: [],
  timeStatsList: [],
})

const manualVisible = ref(false)
const manualSaving = ref(false)
const manualForm = ref({
  userIdKeep: '',
  userIdMerge: '',
  remark: '',
})
const manualRules: FormRules = {
  userIdKeep: [{ required: true, message: '请输入保留用户ID', trigger: 'blur' }],
  userIdMerge: [{ required: true, message: '请输入合并用户ID', trigger: 'blur' }],
}
const manualResult = ref({ mergeId: '', status: '', costMs: '' })

const manualFormRef = ref<FormInstance>()

const detailRecord = computed(() => detail.value as unknown as Record<string, unknown>)

const projectName = computed(() => trackingStore.projectName)
const projectEmpty = computed(() => !projectName.value)

function headerCellStyle(): CSSProperties {
  return { backgroundColor: '#f7fafe', textAlign: 'center' }
}

function buildPageParams() {
  const params: Record<string, unknown> = {
    projectName: projectName.value || undefined,
    mergeReason: query.value.mergeReason || undefined,
    status: query.value.status || undefined,
    userIdSearch: query.value.userIdSearch || undefined,
    pageNum: query.value.pageNum,
    pageSize: query.value.pageSize,
  }
  if (query.value.timeRange && query.value.timeRange.length === 2) {
    params.startTime = query.value.timeRange[0]
    params.endTime = query.value.timeRange[1]
  }
  return params
}

function handleTabChange() {
  refreshCurrentPane()
}

function refreshCurrentPane() {
  if (activePane.value === 'stats') {
    loadStats()
    return
  }
  loadRecords()
}

function handleQuery() {
  query.value.pageNum = 1
  loadRecords()
}

function handleReset() {
  query.value = {
    mergeReason: '',
    status: '',
    userIdSearch: '',
    timeRange: null,
    pageNum: 1,
    pageSize: 20,
  }
  loadRecords()
}

function handlePageChange(page: number) {
  query.value.pageNum = page
  loadRecords()
}

function loadRecords() {
  if (projectEmpty.value) {
    recordList.value = []
    total.value = 0
    return
  }
  loading.value = true
  pageMerge(buildPageParams())
    .then((res) => {
      const data = res.data || {}
      recordList.value = data.list || []
      total.value = data.total || 0
    })
    .finally(() => {
      loading.value = false
    })
}

function openDetail(row: MergeRecordItem) {
  mergeDetail({ mergeId: row.mergeId }).then((res) => {
    detail.value = res.data || {}
    detailVisible.value = true
  })
}

function loadStats() {
  if (projectEmpty.value) {
    stats.value = {
      failRate: null,
      statusStatsList: [],
      reasonStatsList: [],
      timeStatsList: [],
    }
    return
  }
  statsLoading.value = true
  const params: Record<string, unknown> = {
    projectName: projectName.value || undefined,
  }
  if (statsQuery.value.timeRange && statsQuery.value.timeRange.length === 2) {
    params.startTime = statsQuery.value.timeRange[0]
    params.endTime = statsQuery.value.timeRange[1]
  }
  mergeStats(params)
    .then((res) => {
      const data = res.data || {}
      stats.value = {
        failRate: data.failRate ?? null,
        statusStatsList: mapToList(data.statusStats),
        reasonStatsList: mapToList(data.reasonStats),
        timeStatsList: mapToList(data.timeStats),
      }
    })
    .finally(() => {
      statsLoading.value = false
    })
}

function mapToList(map: Record<string, number> | undefined): { key: string; value: number }[] {
  if (!map) return []
  return Object.keys(map).map((key) => ({ key, value: map[key] ?? 0 }))
}

function openManualDialog() {
  if (projectEmpty.value) {
    ElMessage.warning('请先选择项目')
    return
  }
  manualResult.value = { mergeId: '', status: '', costMs: '' }
  manualForm.value = {
    userIdKeep: '',
    userIdMerge: '',
    remark: '',
  }
  manualVisible.value = true
}

function handleManualMerge() {
  if (isDemo.value) {
    return ElMessage.warning('演示环境不可操作')
  }
  manualFormRef.value?.validate((valid) => {
    if (!valid) return
    if (manualForm.value.userIdKeep === manualForm.value.userIdMerge) {
      ElMessage.error('保留用户与合并用户不能相同')
      return
    }
    manualSaving.value = true
    manualMerge({
      ...manualForm.value,
      projectName: projectName.value,
    })
      .then((res) => {
        const data = res.data || {}
        manualResult.value = {
          mergeId: data.mergeId || '',
          status: data.status || '',
          costMs: data.costMs != null ? String(data.costMs) : '',
        }
        ElMessage.success('已提交人工合并')
        loadRecords()
      })
      .finally(() => {
        manualSaving.value = false
      })
  })
}

watch(projectName, () => {
  refreshCurrentPane()
})

onMounted(() => {
  isDemo.value = !!(window.globalConfig && window.globalConfig.is_clklog_demo_environment)
  handleQuery()
})
</script>

<template>
  <div class="public-block">
    <div class="record-body public-hoverItem">
      <el-alert
        v-if="projectEmpty"
        title="未获取到当前项目，请先选择项目后再查询"
        type="warning"
        :closable="false"
        style="margin: 16px 22px 0"
      />
      <el-tabs v-model="activePane" class="custom-tabs" @tab-change="handleTabChange">
        <el-tab-pane label="合并记录" name="record">
          <div class="tab-content">
            <div class="filter-bar">
              <el-form :inline="true" class="filter-form">
                <el-form-item label="合并原因">
                  <el-select
                    v-model="query.mergeReason"
                    placeholder="全部"
                    clearable
                    style="width: 160px"
                  >
                    <el-option
                      v-for="o in MERGE_REASON_OPTIONS"
                      :key="o.value"
                      :label="o.label"
                      :value="o.value"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item label="状态">
                  <el-select
                    v-model="query.status"
                    placeholder="全部"
                    clearable
                    style="width: 140px"
                  >
                    <el-option
                      v-for="o in MERGE_STATUS_OPTIONS"
                      :key="o.value"
                      :label="o.label"
                      :value="o.value"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item label="时间范围">
                  <el-date-picker
                    v-model="query.timeRange"
                    type="daterange"
                    value-format="YYYY-MM-DD HH:mm:ss"
                    :default-time="['00:00:00', '23:59:59']"
                    range-separator="至"
                    start-placeholder="开始"
                    end-placeholder="结束"
                    style="width: 320px"
                  />
                </el-form-item>
                <el-form-item label="用户ID">
                  <el-input
                    v-model="query.userIdSearch"
                    placeholder="保留/合并用户ID"
                    clearable
                    style="width: 180px"
                  />
                </el-form-item>
                <el-form-item style="margin-left: 10px">
                  <div style="display: flex; align-items: center">
                    <el-button class="zc_btn" :loading="loading" @click="handleQuery">
                      查询
                    </el-button>
                    <el-button class="zc_btn_default" @click="handleReset">
                      重置
                    </el-button>
                  </div>
                </el-form-item>
              </el-form>
            </div>
            <el-button
              class="zc_btn_default"
              :disabled="isDemo || projectEmpty"
              @click="openManualDialog"
              style="margin-bottom: 15px"
            >
              <el-icon><Plus /></el-icon>
              人工合并
            </el-button>

            <el-table
              border
              :data="recordList"
              :header-cell-style="headerCellStyle"
              :cell-style="{ textAlign: 'center' }"
              class="public-radius"
            >
              <el-table-column
                fixed="left"
                type="index"
                width="50"
                align="center"
                label="序号"
              />
              <el-table-column
                fixed="left"
                label="合并ID"
                prop="mergeId"
                min-width="260px"
                align="center"
              />
              <el-table-column
                label="项目"
                prop="projectName"
                min-width="120px"
                align="center"
              />
              <el-table-column
                label="保留用户"
                prop="userIdKeep"
                min-width="160px"
                align="center"
              />
              <el-table-column
                label="合并用户"
                prop="userIdMerge"
                min-width="160px"
                align="center"
              />
              <el-table-column label="原因" min-width="140px" align="center">
                <template #default="scope">
                  <el-tag>{{ labelOf(MERGE_REASON_OPTIONS, scope.row.mergeReason) }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column
                label="计划合并时间"
                prop="plannedMergeTime"
                min-width="180px"
                align="center"
              >
                <template #default="scope">
                  {{ formatDateHMS(scope.row.plannedMergeTime) }}
                </template>
              </el-table-column>
              <el-table-column
                label="操作人"
                prop="operator"
                min-width="120px"
                align="center"
              />
              <el-table-column
                label="创建时间"
                prop="createTime"
                min-width="180px"
                align="center"
              >
                <template #default="scope">
                  {{ formatDateHMS(scope.row.createTime) }}
                </template>
              </el-table-column>
              <el-table-column
                label="操作"
                min-width="100px"
                align="center"
                fixed="right"
              >
                <template #default="scope">
                  <el-icon class="edit_btn" @click="openDetail(scope.row)">
                    <View />
                  </el-icon>
                </template>
              </el-table-column>
            </el-table>

            <div style="text-align: right; margin-top: 15px">
              <el-pagination
                background
                layout="total, prev, pager, next"
                :total="total"
                :page-size="query.pageSize"
                :current-page="query.pageNum"
                @current-change="handlePageChange"
              />
            </div>
          </div>
        </el-tab-pane>

        <el-tab-pane label="合并统计" name="stats">
          <div class="tab-content">
            <div class="filter-bar">
              <el-form :inline="true" class="filter-form">
                <el-form-item label="时间范围">
                  <el-date-picker
                    v-model="statsQuery.timeRange"
                    type="daterange"
                    value-format="YYYY-MM-DD HH:mm:ss"                
                    range-separator="至"
                    start-placeholder="开始"
                    end-placeholder="结束"
                    style="width: 320px"
                  />
                </el-form-item>
                <el-form-item>
                  <el-button
                    class="zc_btn"
                    :loading="statsLoading"
                    @click="loadStats"
                    style="margin: 4px 0 0 10px"
                  >
                    查询
                  </el-button>
                </el-form-item>
              </el-form>
            </div>

            <div v-loading="statsLoading" class="stats-section">
              <div class="fail-rate-row">
                <span class="public-firstHead">失败率</span>
                <span
                  v-if="stats.failRate != null"
                  class="fail-rate"
                  :class="{ 'is-zero': Number(stats.failRate) === 0 }"
                >
                  {{ stats.failRate }}%
                </span>
                <span v-else class="no-fail-rate">暂无数据</span>
              </div>

              <el-row :gutter="24">
                <el-col :span="8">
                  <div class="public-tableHead">按状态</div>
                  <el-table
                    border
                    :data="stats.statusStatsList"
                    :header-cell-style="headerCellStyle"
                    :cell-style="{ textAlign: 'center' }"
                    class="public-radius"
                    empty-text="暂无数据"
                  >
                    <el-table-column label="状态" align="center">
                      <template #default="s">
                        {{ labelOf(MERGE_STATUS_OPTIONS, s.row.key) }}
                      </template>
                    </el-table-column>
                    <el-table-column label="数量" prop="value" align="center" />
                  </el-table>
                </el-col>
                <el-col :span="8">
                  <div class="public-tableHead">按原因</div>
                  <el-table
                    border
                    :data="stats.reasonStatsList"
                    :header-cell-style="headerCellStyle"
                    :cell-style="{ textAlign: 'center' }"
                    class="public-radius"
                    empty-text="暂无数据"
                  >
                    <el-table-column label="原因" align="center">
                      <template #default="s">
                        {{ labelOf(MERGE_REASON_OPTIONS, s.row.key) }}
                      </template>
                    </el-table-column>
                    <el-table-column label="数量" prop="value" align="center" />
                  </el-table>
                </el-col>
                <el-col :span="8">
                  <div class="public-tableHead">按天</div>
                  <el-table
                    border
                    :data="stats.timeStatsList"
                    :header-cell-style="headerCellStyle"
                    :cell-style="{ textAlign: 'center' }"
                    class="public-radius"
                    empty-text="暂无数据"
                  >
                    <el-table-column label="日期" prop="key" align="center" />
                    <el-table-column label="数量" prop="value" align="center" />
                  </el-table>
                </el-col>
              </el-row>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <el-dialog
      v-model="detailVisible"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      width="900px"
      top="6vh"
      class="add_prototype"
      :title="'合并详情 ' + (detail.mergeId || '')"
    >
      <div style="background: #fff; padding: 20px; border-radius: 4px">
        <el-descriptions border size="small" :column="2">
          <el-descriptions-item label="合并ID">{{ detail.mergeId }}</el-descriptions-item>
          <el-descriptions-item label="项目">{{ detail.projectName }}</el-descriptions-item>
          <el-descriptions-item label="保留用户">{{ detail.userIdKeep }}</el-descriptions-item>
          <el-descriptions-item label="合并用户">{{ detail.userIdMerge }}</el-descriptions-item>
          <el-descriptions-item label="原因">
            {{ labelOf(MERGE_REASON_OPTIONS, detail.mergeReason) }}
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            {{ labelOf(MERGE_STATUS_OPTIONS, detail.status) }}
          </el-descriptions-item>
          <el-descriptions-item label="耗时(ms)">{{ detail.costMs }}</el-descriptions-item>
          <el-descriptions-item label="操作人">{{ detail.operator }}</el-descriptions-item>
          <el-descriptions-item label="错误信息">{{ detail.errorMsg || '-' }}</el-descriptions-item>
          <el-descriptions-item label="备注">{{ detail.remark || '-' }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">
            {{ formatDateHMS(detail.createTime) }}
          </el-descriptions-item>
        </el-descriptions>

        <div v-for="g in DETAIL_GROUPS" :key="g.key" style="margin-top: 18px">
          <div class="group-title">
            {{ g.label }}（{{ ((detailRecord[g.key] as unknown[]) || []).length }}）
          </div>
          <el-table
            border
            :data="(detailRecord[g.key] as unknown[]) || []"
            size="small"
            :header-cell-style="headerCellStyle"
            :cell-style="{ textAlign: 'center' }"
          >
            <el-table-column label="身份类型" prop="identityType" align="center" />
            <el-table-column label="原用户" prop="oldUserId" align="center" />
            <el-table-column label="新用户" prop="newUserId" align="center" />
            <el-table-column label="动作" prop="action" align="center" />
            <el-table-column label="跳过原因" prop="skipReason" align="center" />
          </el-table>
        </div>
      </div>
    </el-dialog>

    <el-dialog
      v-model="manualVisible"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      width="800px"
      top="12vh"
      class="add_prototype"
      title="人工手动合并"
    >
      <div style="background: #fff; padding: 20px; border-radius: 4px">
        <el-form
          ref="manualFormRef"
          :model="manualForm"
          :rules="manualRules"
          label-width="100px"
          class="demo-ruleForm"
        >
          <el-form-item label="项目">
            <el-input :model-value="projectName" disabled style="font-size: 12px; width: 400px" />
          </el-form-item>
          <el-form-item label="保留用户" prop="userIdKeep">
            <el-input
              v-model="manualForm.userIdKeep"
              placeholder="请输入保留用户ID"
              style="font-size: 12px; width: 400px"
            />
          </el-form-item>
          <el-form-item label="合并用户" prop="userIdMerge">
            <el-input
              v-model="manualForm.userIdMerge"
              placeholder="请输入合并用户ID"
              style="font-size: 12px; width: 400px"
            />
          </el-form-item>
          <el-form-item label="备注" prop="remark">
            <el-input
              v-model="manualForm.remark"
              type="textarea"
              :rows="3"
              placeholder="可选"
              style="font-size: 12px; width: 400px"
            />
          </el-form-item>
          <div v-if="manualResult.mergeId" class="manual-result">
            合并ID：<b>{{ manualResult.mergeId }}</b> ｜ 状态：<b>{{ manualResult.status }}</b>
            ｜ 耗时：<b>{{ manualResult.costMs }}ms</b>
          </div>
          <el-form-item>
            <div class="dialog-footer-actions">
              <el-button
                class="zc_btn"
                style="margin-left: 20px"
                :disabled="isDemo || projectEmpty"
                :loading="manualSaving"
                @click="handleManualMerge"
              >
                提交
              </el-button>
            </div>
          </el-form-item>
        </el-form>
      </div>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
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
:deep(.el-form-item__label) {
  font-size: 14px;
  font-weight: 500;
  color: #4d4d4d;
}
:deep(.custom-tabs) {
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
    height: 50px;
    line-height: 50px;
    text-align: center;
    font-size: 14px;
    font-weight: bold;
    color: #4d4d4d;
  }
}
:deep(.add_prototype .el-dialog__footer) {
  padding: 0;
  display: none;
}

.stats-section {
  margin-top: 8px;
  :deep(.el-table) {
    min-height: 320px;
  }
  :deep(.el-table__empty-block) {
    min-height: 280px;
  }
}

.fail-rate-row {
  display: flex;
  align-items: baseline;
  gap: 16px;
  padding: 14px 18px;
  margin-bottom: 28px;
  line-height: 35px;
  background: #f7fafe;
  border-radius: 6px;
}

.fail-rate {
  font-size: 18px;
  color: #f46666;
  font-weight: 600;
  &.is-zero {
    color: #67c23a;
  }
}

.no-fail-rate {
  font-size: 13px;
  color: #909399;
}

.record-body {
  background: #fff;
  .tab-content {
    padding: 22px;
    min-height: 300px;
  }
}

.filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  .filter-form {
    flex: 1;
    margin-bottom: 0;
  }
  :deep(.el-form-item) {
    margin-bottom: 12px;
    margin-right: 20px;
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

.group-title {
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}

.dialog-footer-actions {
  display: flex;
  margin-left: -70px;
  margin-top: 40px;
}

.manual-result {
  background: #f7f9fe;
  border: 1px solid #dde4ed;
  border-radius: 4px;
  padding: 10px 14px;
  margin: 0 0 12px 100px;
  color: #303133;
  width: 400px;
  box-sizing: border-box;
}
</style>
