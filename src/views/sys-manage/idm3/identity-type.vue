<script setup lang="ts">
import { getCurrentInstance, nextTick, onMounted, ref } from 'vue'
import type { CSSProperties } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules, TableInstance } from 'element-plus'
import { Delete, Edit, Plus, Refresh } from '@element-plus/icons-vue'
import { useRoute } from 'vue-router'
import { listIdentityType, saveIdentityType, deleteIdentityType } from '@/api/sysmanage/idm3userassoc'
import type { IdentityTypeItem } from '@/api/sysmanage/idm3userassoc'
import { IDENTITY_CATEGORY_OPTIONS, labelOf } from './constants'

const proxy = getCurrentInstance()?.proxy
const route = useRoute()

const isDemo = ref(false)
const loading = ref(false)
const saving = ref(false)
const identityTypeList = ref<IdentityTypeItem[]>([])
const typeDialogVisible = ref(false)
const typeDialogTitle = ref('新增身份类型')
const isTypeEdit = ref(false)

const typeForm = ref({
  identityType: '',
  typeName: '',
  category: 'BUSINESS',
  description: '',
  isSystem: false,
})

const typeRules: FormRules = {
  identityType: [
    { required: true, message: '请输入类型标识', trigger: 'blur' },
    {
      pattern: /^[\$_a-zA-Z0-9]{1,50}$/,
      message: '类型标识仅允许 $ _ 英文字母 数字 组合，且长度不超过 50 个字符',
      trigger: 'blur',
    },
  ],
  typeName: [{ required: true, message: '请输入显示名', trigger: 'blur' }],
  category: [{ required: true, message: '请选择分类', trigger: 'change' }],
}

const typeFormRef = ref<FormInstance>()
const identityTypeTableRef = ref<TableInstance>()

function headerCellStyle(): CSSProperties {
  return { backgroundColor: '#f7fafe', textAlign: 'center' }
}

function loadIdentityType() {
  loading.value = true
  listIdentityType({})
    .then((res) => {
      identityTypeList.value = res.data || []
      nextTick(() => {
        identityTypeTableRef.value?.doLayout()
      })
    })
    .finally(() => {
      loading.value = false
    })
}

function openTypeDialog() {
  typeDialogTitle.value = '新增身份类型'
  isTypeEdit.value = false
  typeForm.value = {
    identityType: '',
    typeName: '',
    category: 'BUSINESS',
    description: '',
    isSystem: false,
  }
  typeDialogVisible.value = true
}

function handleEditType(row: IdentityTypeItem) {
  if (isDemo.value) {
    return ElMessage.warning('演示环境不可操作')
  }
  if (row.isSystem) {
    return ElMessage.warning('系统内置类型不可编辑')
  }
  typeDialogTitle.value = '编辑身份类型'
  isTypeEdit.value = true
  typeForm.value = {
    identityType: row.identityType || '',
    typeName: row.typeName || '',
    category: row.category || 'BUSINESS',
    description: row.description || '',
    isSystem: false,
  }
  typeDialogVisible.value = true
}

function handleSaveType() {
  if (isDemo.value) {
    return ElMessage.warning('演示环境不可修改')
  }
  typeFormRef.value?.validate((valid) => {
    if (!valid) return
    saving.value = true
    const payload = {
      identityType: typeForm.value.identityType,
      typeName: typeForm.value.typeName,
      category: typeForm.value.category,
      description: typeForm.value.description,
    }
    saveIdentityType(payload)
      .then(() => {
        ElMessage.success('保存成功')
        typeDialogVisible.value = false
        loadIdentityType()
      })
      .finally(() => {
        saving.value = false
      })
  })
}

function handleDeleteType(row: IdentityTypeItem) {
  if (isDemo.value) {
    return ElMessage.warning('演示环境不可操作')
  }
  if (row.isSystem) {
    return ElMessage.warning('系统内置类型不可删除')
  }
  ElMessageBox.confirm(
    `确认删除身份类型「${row.identityType}」？若已有项目约束引用该类型，则无法删除。`,
    '删除确认',
    { type: 'warning' },
  )
    .then(() => {
      saving.value = true
      deleteIdentityType({ identityType: row.identityType })
        .then(() => {
          ElMessage.success('删除成功')
          loadIdentityType()
        })
        .finally(() => {
          saving.value = false
        })
    })
    .catch(() => {})
}

onMounted(() => {
  isDemo.value = !!(window.globalConfig && window.globalConfig.is_clklog_demo_environment)
  loadIdentityType()
  if (route.query.openAdd === '1') {
    setTimeout(() => {
      nextTick(() => openTypeDialog())
    }, 500)
  }
})
</script>

<template>
  <div class="public-block">
    <div class="Overview public-hoverItem" style="padding: 25px">
      <div class="head-line">
        <div class="public-firstHead">身份类型标识（全局）</div>
        <el-button class="zc_btn" :loading="loading" :disabled="isDemo" style="margin-left: 12px" @click="loadIdentityType">
          <el-icon><Refresh /></el-icon>
          刷新
        </el-button>
      </div>
      <el-button
        style="margin: 15px 0"
        class="custom_button zc_btn_default"
        @click="openTypeDialog"
      >
        <el-icon><Plus /></el-icon>
        新增身份类型
      </el-button>
      <el-table
        ref="identityTypeTableRef"
        v-loading="loading"
        border
        :data="identityTypeList"
        :header-cell-style="headerCellStyle"
        class="public-radius"
        :cell-style="{ textAlign: 'center' }"
        style="width: 100%; min-height: 300px"
      >
        <el-table-column
          label="序号"
          type="index"
          :width="proxy?.$fixedWidth.FwIndex"
          align="center"
          fixed="left"
        />
        <el-table-column
          label="显示名"
          fixed="left"
          prop="typeName"
          :width="proxy?.$fixedWidth.FwDisplayName"
          align="center"
          show-overflow-tooltip
        />
        <el-table-column
          label="类型标识"
          prop="identityType"
          min-width="200px"
          align="center"
          show-overflow-tooltip
        />
        <el-table-column label="分类" min-width="160px" align="center">
          <template #default="scope">
            <el-tag>{{ labelOf(IDENTITY_CATEGORY_OPTIONS, scope.row.category) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column
          label="描述"
          prop="description"
          min-width="200px"
          align="center"
        />
        <el-table-column label="是否系统内置" min-width="120px" align="center">
          <template #default="scope">
            <el-tag :type="scope.row.isSystem ? 'warning' : 'success'">
              {{ scope.row.isSystem ? '系统内置' : '自定义' }}
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
        <el-table-column
          fixed="right"
          label="操作"
          :width="proxy?.$fixedWidth.FwOperation"
          align="center"
        >
          <template #default="scope">
            <el-icon
              class="edit_btn"
              :class="{ disabled: isDemo || scope.row.isSystem }"
              :title="scope.row.isSystem ? '系统内置类型不可编辑' : '编辑'"
              @click="handleEditType(scope.row)"
            >
              <Edit />
            </el-icon>
            <el-icon
              class="delete_btn"
              :class="{ disabled: isDemo || scope.row.isSystem }"
              @click="handleDeleteType(scope.row)"
            >
              <Delete />
            </el-icon>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog
      v-model="typeDialogVisible"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      width="800px"
      class="add_prototype"
      :title="typeDialogTitle"
    >
      <div style="background: #fff; padding: 20px; border-radius: 4px">
        <el-form
          ref="typeFormRef"
          :model="typeForm"
          :rules="typeRules"
          label-width="100px"
          class="demo-ruleForm"
        >
          <el-form-item label="类型标识" prop="identityType">
            <el-input
              v-model="typeForm.identityType"
              :disabled="typeForm.isSystem || isTypeEdit"
              placeholder="如 $identity_mobile"
              style="font-size: 12px; width: 400px"
            />
          </el-form-item>
          <el-form-item label="显示名" prop="typeName">
            <el-input
              v-model="typeForm.typeName"
              placeholder="请输入显示名"
              style="font-size: 12px; width: 400px"
            />
          </el-form-item>
          <el-form-item label="分类" prop="category">
            <el-select
              v-model="typeForm.category"
              :disabled="typeForm.isSystem"
              placeholder="请选择"
              style="font-size: 12px; width: 400px"
            >
              <el-option
                v-for="o in IDENTITY_CATEGORY_OPTIONS"
                :key="o.value"
                :label="o.label"
                :value="o.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="描述" prop="description">
            <el-input
              v-model="typeForm.description"
              type="textarea"
              :rows="3"
              placeholder="请输入描述"
              style="font-size: 12px; width: 400px"
            />
          </el-form-item>
          <el-form-item>
            <div class="dialog-footer-actions">
              <el-button
                class="zc_btn"
                style="margin-left: 20px"
                :disabled="isDemo"
                :loading="saving"
                @click="handleSaveType"
              >
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
:deep(.add_prototype .el-dialog__footer) {
  padding: 0;
  display: none;
}

.head-line {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.dialog-footer-actions {
  display: flex;
  margin-left: -70px;
  margin-top: 40px;
}

.delete_btn {
  width: 20px;
  height: 20px;
  line-height: 20px;
  border-radius: 2px;
  background: #fde2e2;
  color: #f56c6c;
  cursor: pointer;
}

.edit_btn {
  width: 20px;
  height: 20px;
  line-height: 20px;
  border-radius: 2px;
  background: #dde4ed;
  color: #2c7be5;
  cursor: pointer;
  margin-right: 8px;
}

.delete_btn.disabled,
.edit_btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
