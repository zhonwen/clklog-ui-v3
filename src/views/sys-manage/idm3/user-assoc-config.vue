<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { CSSProperties } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { Delete, Edit, Plus, Refresh } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import {
  getProjectConfig,
  saveProjectConfig,
  listIdentityType,
  listIdentityConstraint,
  saveIdentityConstraint,
  deleteIdentityConstraint,
  reloadConfig,
} from '@/api/sysmanage/idm3userassoc'
import type { IdentityConstraintItem, IdentityTypeItem, ProjectConfig } from '@/api/sysmanage/idm3userassoc'
import {
  IDM_VERSION_OPTIONS,
  CONSTRAINT_TYPE_OPTIONS,
  OVERFLOW_STRATEGY_OPTIONS,
  MERGE_STRATEGY_OPTIONS,
  STATUS_OPTIONS,
  BOOLEAN_YES_NO_OPTIONS,
  labelOf,
} from './constants'
import { useTrackingStore } from '@/stores/tracking'

const IDM_VERSION_ENABLED = '3.0'
const IDM_VERSION_DISABLED = '2.0'

function isIdm3Version(version: unknown): boolean {
  return String(version == null ? '' : version) === IDM_VERSION_ENABLED
}

function buildProjectForm(): Required<ProjectConfig> {
  return {
    idmVersion: IDM_VERSION_DISABLED,
    enableIdentityBind: false,
    enableIdentityUnbind: false,
    mergeBackfillWindowDays: 7,
    mergeStrategy: 'ALTER_UPDATE',
    enableCache: true,
    cacheTtlMinutes: 30,
    cacheMaxSize: 100000,
    status: 1,
  }
}

const router = useRouter()
const trackingStore = useTrackingStore()

const activeTab = ref('project')
const loadedProjectForm = ref<Record<string, unknown>>({})
const isDemo = ref(false)
const loading = ref(false)
const saving = ref(false)
const reloading = ref(false)
const enableGlobalAssoc = ref(false)
const prevNonIdm3Version = ref(IDM_VERSION_DISABLED)

const projectForm = ref<ProjectConfig>(buildProjectForm())
const projectRules: FormRules = {
  idmVersion: [{ required: true, message: '请选择 IDM 版本', trigger: 'change' }],
  mergeStrategy: [{ required: true, message: '请选择合并策略', trigger: 'change' }],
}

const identityTypeList = ref<IdentityTypeItem[]>([])
const constraintList = ref<IdentityConstraintItem[]>([])
const constraintDialogVisible = ref(false)
const constraintDialogTitle = ref('新增约束')

const constraintForm = ref({
  id: undefined as string | undefined,
  identityType: '',
  constraintType: 'SINGLE',
  maxCount: 1,
  overflowStrategy: 'BLOCK',
  priority: 99,
  enableBind: true,
  enableUnbind: true,
  status: 1,
})

const constraintRules: FormRules = {
  identityType: [{ required: true, message: '请选择已注册身份类型', trigger: 'change' }],
  constraintType: [{ required: true, message: '请选择约束类型', trigger: 'change' }],
  overflowStrategy: [{ required: true, message: '请选择溢出策略', trigger: 'change' }],
}

const projectFormRef = ref<FormInstance>()
const constraintFormRef = ref<FormInstance>()

const projectName = computed(() => trackingStore.projectName)
const projectEmpty = computed(() => !projectName.value)
const isGlobalAssocEnabled = computed(() =>
  isIdm3Version(loadedProjectForm.value && loadedProjectForm.value.idmVersion),
)

function headerCellStyle(): CSSProperties {
  return { backgroundColor: '#f7fafe', textAlign: 'center' }
}

function tableHeaderColor({ columnIndex }: { columnIndex: number }): CSSProperties {
  if (columnIndex === 1 || columnIndex === 4) {
    return { textAlign: 'left' }
  }
  return { textAlign: 'center' }
}

function loadAll() {
  loadProjectConfig()
  loadIdentityType()
  loadConstraintList()
}

function syncEnableFromLoaded() {
  const version = loadedProjectForm.value && loadedProjectForm.value.idmVersion
  enableGlobalAssoc.value = isIdm3Version(version)
  if (version && !isIdm3Version(version)) {
    prevNonIdm3Version.value = version as string
  }
}

function handleEnableGlobalAssocChange() {
  if (isDemo.value) {
    enableGlobalAssoc.value = isGlobalAssocEnabled.value
    return ElMessage.warning('演示环境不可修改')
  }
  if (projectEmpty.value) {
    enableGlobalAssoc.value = false
    return ElMessage.warning('请先选择项目')
  }
}

function handleIdmVersionChange(version: string) {
  if (version && !isIdm3Version(version)) {
    prevNonIdm3Version.value = version
  }
}

function handleSaveGlobalAssoc() {
  if (isDemo.value) {
    return ElMessage.warning('演示环境不可修改')
  }
  if (projectEmpty.value) {
    return ElMessage.warning('请先选择项目')
  }
  const wasEnabled = isGlobalAssocEnabled.value
  const willEnable = enableGlobalAssoc.value
  const doSave = () => {
    projectForm.value.idmVersion = willEnable
      ? IDM_VERSION_ENABLED
      : prevNonIdm3Version.value || IDM_VERSION_DISABLED
    saving.value = true
    const params = { ...projectForm.value, projectName: projectName.value }
    saveProjectConfig(params)
      .then(() => {
        ElMessage.success(willEnable ? '已开启全域用户关联' : '已关闭全域用户关联')
        loadProjectConfig()
      })
      .catch(() => {
        enableGlobalAssoc.value = isGlobalAssocEnabled.value
      })
      .finally(() => {
        saving.value = false
      })
  }
  if (wasEnabled && !willEnable) {
    ElMessageBox.confirm('取消开启后将关闭全域用户关联配置，是否继续？', '提示', {
      type: 'warning',
    })
      .then(doSave)
      .catch(() => {
        enableGlobalAssoc.value = true
      })
    return
  }
  doSave()
}

function loadProjectConfig() {
  if (projectEmpty.value) {
    const form = buildProjectForm()
    projectForm.value = { ...form }
    loadedProjectForm.value = { ...form }
    syncEnableFromLoaded()
    return
  }
  loading.value = true
  getProjectConfig({ projectName: projectName.value })
    .then((res) => {
      const form = res.data ? { ...buildProjectForm(), ...res.data } : buildProjectForm()
      projectForm.value = { ...form }
      loadedProjectForm.value = { ...form }
      syncEnableFromLoaded()
      if (isGlobalAssocEnabled.value) {
        activeTab.value = activeTab.value || 'project'
      }
    })
    .catch(() => {
      const form = buildProjectForm()
      projectForm.value = { ...form }
      loadedProjectForm.value = { ...form }
      syncEnableFromLoaded()
    })
    .finally(() => {
      loading.value = false
    })
}

function loadIdentityType() {
  listIdentityType({}).then((res) => {
    identityTypeList.value = res.data || []
  })
}

function loadConstraintList() {
  if (projectEmpty.value) {
    constraintList.value = []
    return
  }
  listIdentityConstraint({ projectName: projectName.value }).then((res) => {
    constraintList.value = res.data || []
  })
}

function handleSaveProject() {
  if (isDemo.value) {
    return ElMessage.warning('演示环境不可修改')
  }
  if (projectEmpty.value) {
    return ElMessage.warning('请先选择项目')
  }
  projectFormRef.value?.validate((valid) => {
    if (!valid) return
    saving.value = true
    const params = { ...projectForm.value, projectName: projectName.value }
    saveProjectConfig(params)
      .then(() => {
        ElMessage.success('保存成功，配置已即时生效')
        loadProjectConfig()
      })
      .finally(() => {
        saving.value = false
      })
  })
}

function handleCancelProject() {
  projectForm.value = { ...(loadedProjectForm.value as ProjectConfig) }
  syncEnableFromLoaded()
}

function handleManualReload() {
  if (isDemo.value) {
    return ElMessage.warning('演示环境不可操作')
  }
  reloading.value = true
  reloadConfig({})
    .then(() => {
      ElMessage.success('刷新成功')
      loadAll()
    })
    .finally(() => {
      reloading.value = false
    })
}

function openConstraintDialog(row?: IdentityConstraintItem) {
  if (projectEmpty.value) {
    return ElMessage.warning('请先选择项目')
  }
  if (row) {
    constraintDialogTitle.value = '编辑约束'
    constraintForm.value = {
      id: row.id || undefined,
      identityType: row.identityType || '',
      constraintType: row.constraintType || 'SINGLE',
      maxCount: row.maxCount || 1,
      overflowStrategy: row.overflowStrategy || 'BLOCK',
      priority: row.priority || 99,
      enableBind: row.enableBind ?? true,
      enableUnbind: row.enableUnbind ?? true,
      status: row.status ?? 1,
    }
  } else {
    constraintDialogTitle.value = '新增约束'
    constraintForm.value = {
      id: undefined,
      identityType: identityTypeList.value.length ? identityTypeList.value[0]?.identityType || '' : '',
      constraintType: 'SINGLE',
      maxCount: 1,
      overflowStrategy: 'BLOCK',
      priority: 99,
      enableBind: true,
      enableUnbind: true,
      status: 1,
    }
  }
  constraintDialogVisible.value = true
}

function goIdentityTypePage() {
  constraintDialogVisible.value = false
  router.push({ path: '/idm3/identity-type', query: { openAdd: '1' } })
}

function handleConstraintTypeChange(val: string) {
  if (val === 'SINGLE') {
    constraintForm.value.maxCount = 1
  }
}

function handleSaveConstraint() {
  if (isDemo.value) {
    return ElMessage.warning('演示环境不可修改')
  }
  constraintFormRef.value?.validate((valid) => {
    if (!valid) return
    if (
      constraintForm.value.constraintType === 'SINGLE' &&
      constraintForm.value.maxCount !== 1
    ) {
      ElMessage.error('约束类型为 SINGLE 时，上限必须为 1')
      return
    }
    const registered = identityTypeList.value.some(
      (t) => t.identityType === constraintForm.value.identityType,
    )
    if (!registered) {
      ElMessage.error('身份类型未注册，请先在「身份类型」中新增')
      return
    }
    saving.value = true
    const payload = {
      identityType: constraintForm.value.identityType,
      constraintType: constraintForm.value.constraintType,
      maxCount: constraintForm.value.maxCount,
      overflowStrategy: constraintForm.value.overflowStrategy,
      priority: constraintForm.value.priority,
      enableBind: constraintForm.value.enableBind,
      enableUnbind: constraintForm.value.enableUnbind,
      status: constraintForm.value.status,
    }
    const params = { projectName: projectName.value, ...payload }
    saveIdentityConstraint(params)
      .then(() => {
        ElMessage.success('保存成功，配置已即时生效')
        constraintDialogVisible.value = false
        loadConstraintList()
      })
      .finally(() => {
        saving.value = false
      })
  })
}

function handleDeleteConstraint(row: IdentityConstraintItem) {
  if (isDemo.value) {
    return ElMessage.warning('演示环境不可操作')
  }
  if (projectEmpty.value) {
    return ElMessage.warning('请先选择项目')
  }
  ElMessageBox.confirm(
    `确认删除项目「${projectName.value}」的身份约束「${row.identityType}」？删除后配置即时生效。`,
    '删除确认',
    { type: 'warning' },
  )
    .then(() => {
      saving.value = true
      deleteIdentityConstraint({
        projectName: projectName.value,
        identityType: row.identityType,
      })
        .then(() => {
          ElMessage.success('删除成功，配置已即时生效')
          loadConstraintList()
        })
        .finally(() => {
          saving.value = false
        })
    })
    .catch(() => {})
}

watch(projectName, () => {
  loadAll()
})

onMounted(() => {
  isDemo.value = !!(window.globalConfig && window.globalConfig.is_clklog_demo_environment)
  loadAll()
})
</script>

<template>
  <div class="public-block">
    <div class="assoc-body public-hoverItem" v-loading="loading">
      <div class="head-card">
        <div class="headLine">
          <div class="public-firstHead">{{ isGlobalAssocEnabled ? '全域用户关联配置' : '用户关联配置' }}</div>
          <el-button class="zc_btn" :loading="reloading" style="margin-left: auto" :disabled="isDemo" @click="handleManualReload">
            <el-icon><Refresh /></el-icon>
            刷新
          </el-button>
        </div>
      </div>
      <el-alert
        v-if="projectEmpty"
        title="未获取到当前项目，请先选择项目后再进行配置"
        type="warning"
        :closable="false"
        style="margin-bottom: 20px"
      />

      <div v-if="!isGlobalAssocEnabled" class="assoc-switch-panel">
        <div class="assoc-switch-row">
          <el-checkbox
            v-model="enableGlobalAssoc"
            :disabled="isDemo || projectEmpty || saving"
            @change="handleEnableGlobalAssocChange"
          >
            开启全域用户关联
          </el-checkbox>
        </div>
        <el-button
          class="zc_btn"
          size="small"
          :disabled="isDemo || projectEmpty"
          :loading="saving"
          style="margin-top: 20px"
          @click="handleSaveGlobalAssoc"
        >
          保存
        </el-button>
      </div>

      <el-tabs v-if="isGlobalAssocEnabled" v-model="activeTab" class="custom-tabs">
        <el-tab-pane label="项目配置" name="project">
          <div class="tab-content">
            <el-form
              ref="projectFormRef"
              :model="projectForm"
              :rules="projectRules"
              label-width="140px"
              class="demo-ruleForm"
            >
              <el-form-item label="IDM 版本" prop="idmVersion">
                <el-select
                  v-model="projectForm.idmVersion"
                  placeholder="请选择"
                  style="font-size: 12px; width: 400px"
                  @change="handleIdmVersionChange"
                  disabled
                >
                  <el-option
                    v-for="o in IDM_VERSION_OPTIONS"
                    :key="o.value"
                    :label="o.label"
                    :value="o.value"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="启用身份绑定">
                <el-radio-group v-model="projectForm.enableIdentityBind">
                  <el-radio v-for="o in BOOLEAN_YES_NO_OPTIONS" :key="String(o.value)" :value="o.value">
                    {{ o.label }}
                  </el-radio>
                </el-radio-group>
              </el-form-item>
              <el-form-item label="启用身份解绑">
                <el-radio-group v-model="projectForm.enableIdentityUnbind">
                  <el-radio v-for="o in BOOLEAN_YES_NO_OPTIONS" :key="String(o.value)" :value="o.value">
                    {{ o.label }}
                  </el-radio>
                </el-radio-group>
              </el-form-item>
              <el-form-item label="合并回溯窗口(天)" prop="mergeBackfillWindowDays">
                <el-input-number
                  v-model="projectForm.mergeBackfillWindowDays"
                  :min="1"
                  :max="3650"
                  style="font-size: 12px; width: 400px"
                />
              </el-form-item>
              <el-form-item label="合并策略" prop="mergeStrategy">
                <el-select
                  v-model="projectForm.mergeStrategy"
                  placeholder="请选择"
                  style="font-size: 12px; width: 400px"
                  disabled
                >
                  <el-option
                    v-for="o in MERGE_STRATEGY_OPTIONS"
                    :key="o.value"
                    :label="o.label"
                    :value="o.value"
                  />
                </el-select>
              </el-form-item>
              <el-form-item label="状态" prop="status">
                <el-radio-group v-model="projectForm.status">
                  <el-radio v-for="o in STATUS_OPTIONS" :key="o.value" :value="o.value">
                    {{ o.label }}
                  </el-radio>
                </el-radio-group>
              </el-form-item>
              <el-form-item>
                <div class="dialog-footer-actions">
                  <el-button
                    class="zc_btn"
                    :disabled="isDemo || projectEmpty"
                    :loading="saving"
                    @click="handleSaveProject"
                  >
                    保存配置
                  </el-button>
                  <el-button
                    class="zc_btn_default"
                    style="margin-left: 20px"
                    :disabled="isDemo || projectEmpty"
                    @click="handleCancelProject"
                  >
                    取消
                  </el-button>
                </div>
              </el-form-item>
            </el-form>
          </div>
        </el-tab-pane>

        <el-tab-pane label="身份约束" name="constraint">
          <div class="tab-content">
            <el-button
              class="add_btn"
              :disabled="isDemo || projectEmpty"
              style="margin-bottom: 15px"
              @click="openConstraintDialog()"
            >
              <el-icon><Plus /></el-icon>
              新增约束
            </el-button>
            <el-table
              class="public-radius"
              border
              :data="constraintList"
              :header-cell-style="headerCellStyle"
              :cell-style="tableHeaderColor"
              style="width: 100%"
            >
              <el-table-column fixed="left" label="序号" type="index" width="50" align="center" />
              <el-table-column
                fixed="left"
                label="身份类型"
                prop="identityType"
                min-width="200px"
                align="left"
              />
              <el-table-column label="约束类型" min-width="140px" align="center">
                <template #default="scope">
                  <el-tag>{{ labelOf(CONSTRAINT_TYPE_OPTIONS, scope.row.constraintType) }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="上限" prop="maxCount" min-width="100px" align="center" />
              <el-table-column label="溢出策略" min-width="200px" align="center">
                <template #default="scope">
                  {{ labelOf(OVERFLOW_STRATEGY_OPTIONS, scope.row.overflowStrategy) }}
                </template>
              </el-table-column>
              <el-table-column label="优先级" prop="priority" min-width="100px" align="center" />
              <el-table-column label="允许绑定" min-width="100px" align="center">
                <template #default="scope">
                  <el-tag :type="scope.row.enableBind ? 'success' : 'info'">
                    {{ scope.row.enableBind ? '是' : '否' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="允许解绑" min-width="100px" align="center">
                <template #default="scope">
                  <el-tag :type="scope.row.enableUnbind ? 'success' : 'info'">
                    {{ scope.row.enableUnbind ? '是' : '否' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="状态" min-width="100px" align="center">
                <template #default="scope">
                  <el-tag :type="scope.row.status === 1 ? 'success' : 'info'">
                    {{ labelOf(STATUS_OPTIONS, scope.row.status) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="创建时间" min-width="170px" align="center">
                <template #default="scope">
                  {{ scope.row.createTime }}
                </template>
              </el-table-column>
              <el-table-column label="修改时间" min-width="170px" align="center">
                <template #default="scope">
                  {{ scope.row.updateTime }}
                </template>
              </el-table-column>
              <el-table-column fixed="right" label="操作" min-width="120px" align="center">
                <template #default="scope">
                  <el-icon
                    class="edit_btn"
                    :class="{ disabled: isDemo || projectEmpty }"
                    @click="openConstraintDialog(scope.row)"
                  >
                    <Edit />
                  </el-icon>
                  <el-icon
                    class="delete_btn"
                    :class="{ disabled: isDemo || projectEmpty }"
                    @click="handleDeleteConstraint(scope.row)"
                  >
                    <Delete />
                  </el-icon>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <el-dialog
      v-model="constraintDialogVisible"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      width="800px"
      class="add_prototype"
      :title="constraintDialogTitle"
    >
      <div style="background: #fff; padding: 20px; border-radius: 4px">
        <el-form
          ref="constraintFormRef"
          :model="constraintForm"
          :rules="constraintRules"
          label-width="100px"
          class="demo-ruleForm"
        >
          <el-form-item label="项目">
            <el-input :model-value="projectName" disabled style="font-size: 12px; width: 400px" />
          </el-form-item>
          <el-form-item label="身份类型" prop="identityType">
            <el-select
              v-model="constraintForm.identityType"
              placeholder="请选择已注册类型"
              style="font-size: 12px; width: 400px"
              :disabled="!!constraintForm.id"
            >
              <el-option
                v-for="t in identityTypeList"
                :key="t.identityType"
                :label="t.identityType"
                :value="t.identityType"
              />
            </el-select>
            <div class="add-identity-type">
              <span>添加身份类型标识</span>
              <el-icon class="add-identity-plus" title="前往身份类型标识" @click="goIdentityTypePage">
                <Plus />
              </el-icon>
            </div>
          </el-form-item>
          <el-form-item label="约束类型" prop="constraintType">
            <el-select
              v-model="constraintForm.constraintType"
              placeholder="请选择"
              style="font-size: 12px; width: 400px"
              @change="handleConstraintTypeChange"
            >
              <el-option
                v-for="o in CONSTRAINT_TYPE_OPTIONS"
                :key="o.value"
                :label="o.label"
                :value="o.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="上限" prop="maxCount">
            <el-input-number
              v-model="constraintForm.maxCount"
              :min="1"
              :max="500"
              style="font-size: 12px; width: 400px"
            />
          </el-form-item>
          <el-form-item label="溢出策略" prop="overflowStrategy">
            <el-select
              v-model="constraintForm.overflowStrategy"
              placeholder="请选择"
              style="font-size: 12px; width: 400px"
            >
              <el-option
                v-for="o in OVERFLOW_STRATEGY_OPTIONS"
                :key="o.value"
                :label="o.label"
                :value="o.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="优先级" prop="priority">
            <el-input-number
              v-model="constraintForm.priority"
              :min="1"
              :max="999"
              style="font-size: 12px; width: 400px"
            />
          </el-form-item>
          <el-form-item label="允许绑定">
            <el-radio-group v-model="constraintForm.enableBind">
              <el-radio v-for="o in BOOLEAN_YES_NO_OPTIONS" :key="String(o.value)" :value="o.value">
                {{ o.label }}
              </el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="允许解绑">
            <el-radio-group v-model="constraintForm.enableUnbind">
              <el-radio v-for="o in BOOLEAN_YES_NO_OPTIONS" :key="String(o.value)" :value="o.value">
                {{ o.label }}
              </el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="状态" prop="status">
            <el-radio-group v-model="constraintForm.status">
              <el-radio v-for="o in STATUS_OPTIONS" :key="o.value" :value="o.value">
                {{ o.label }}
              </el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item>
            <div class="dialog-footer-actions">
              <el-button class="zc_btn" :disabled="isDemo" :loading="saving" @click="handleSaveConstraint">
                保存
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
:deep(.el-input-number) {
  width: 160px !important;
}

.head-card {
  padding: 20px 20px;
  .headLine {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
}

.assoc-body {
  background: #fff;
  .tab-content {
    padding: 22px;
    min-height: 300px;
  }
}

.assoc-switch-panel {
  padding: 0 22px 22px 22px;
  .assoc-switch-row {
    display: flex;
    align-items: center;
  }
  :deep(.el-checkbox__label) {
    font-size: 14px;
    color: #4d4d4d;
  }
}

.dialog-footer-actions {
  display: flex;
  margin-left: -70px;
  margin-top: 40px;
}

.add_btn.el-button {
  color: #2c7be5;
  border: 1px solid #2c7be5;
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
  background: #fde2e2;
  color: #f56c6c;
  cursor: pointer;
  margin-left: 8px;
}

.delete_btn.disabled,
.edit_btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.add-identity-type {
  display: flex;
  align-items: center;
  margin-top: 8px;
  width: 400px;
  font-size: 12px;
  color: #2c7be5;
}

.add-identity-plus {
  margin-left: 8px;
  width: 20px;
  height: 20px;
  line-height: 20px;
  text-align: center;
  border-radius: 2px;
  background: #dde4ed;
  color: #2c7be5;
  cursor: pointer;
}
</style>
