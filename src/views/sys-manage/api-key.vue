<script setup lang="ts">
import { getCurrentInstance, onMounted, ref } from 'vue'
import type { CSSProperties } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import {
  Delete,
  DocumentCopy,
  Edit,
  Plus,
  SuccessFilled,
  WarningFilled,
} from '@element-plus/icons-vue'
import {
  addApiKey,
  deleteApiKey,
  editApiKey,
  getApiKey,
  listApiKey,
} from '@/api/sysmanage/apikey'
import type { ApiKeyRow } from '@/api/sysmanage/apikey'
import { useLatestOnly } from '@/composables/useLatestOnly'
import DialogPage from './component/dialog.vue'

/** 表单用 type：需要能直接当 Record<string, unknown> 传给请求层 */
type ApiKeyForm = {
  id?: string
  displayName?: string
  expiresAt?: string | Date
  status?: string
}

const proxy = getCurrentInstance()?.proxy
const { next: nextList, isLatest: isLatestList } = useLatestOnly()
const { next: nextDetail, isLatest: isLatestDetail } = useLatestOnly()

const formRef = ref<FormInstance>()
const dialogPageRef = ref<{ dialogEvent: () => void } | null>(null)

const form = ref<ApiKeyForm>({
  id: '',
  displayName: '',
  expiresAt: '',
  status: '启用',
})
const rules: FormRules = {
  displayName: [{ required: true, message: '显示名称不能为空', trigger: 'blur' }],
}
const centerDialogVisible = ref(false)
const apiKeyList = ref<ApiKeyRow[]>([])
const title = ref('')
// v2 的 pickerOptions.shortcuts，onClick(picker){picker.$emit('pick', date)} → value: () => date
const pickerShortcuts = [
  {
    text: '一周后',
    value: () => {
      const date = new Date()
      date.setDate(date.getDate() + 7)
      return date
    },
  },
  {
    text: '一个月后',
    value: () => {
      const date = new Date()
      date.setMonth(date.getMonth() + 1)
      return date
    },
  },
  {
    text: '三个月后',
    value: () => {
      const date = new Date()
      date.setMonth(date.getMonth() + 3)
      return date
    },
  },
]
/** 生成密钥弹窗 */
const showKeyDialogVisible = ref(false)
const newApiKey = ref('')
// 与 v2 一致（v2 此处逻辑存疑：newApiSecret 只写不读，弹窗里并没有展示 apiSecret）
const newApiSecret = ref('')

function openDialogEvent() {
  dialogPageRef.value?.dialogEvent()
}

function headerCellStyle({ columnIndex }: { columnIndex: number }): CSSProperties {
  // 必须返回对象：element-plus 会对返回值做 Object.assign，返回字符串会被拆成 {0:'t',1:'e'...}
  if (columnIndex === 1) {
    return {
      backgroundColor: '#f7fafe',
      paddingLeft: '20px',
      textAlign: 'left',
    }
  } else {
    return {
      backgroundColor: '#f7fafe',
      textAlign: 'center',
    }
  }
}

function getIndex($index: number) {
  return $index + 1
}

function getList() {
  const token = nextList()
  listApiKey({})
    .then((response) => {
      if (!isLatestList(token)) return
      if (response?.data) {
        apiKeyList.value = response.data
      }
    })
    .catch(() => {
      if (!isLatestList(token)) return
      /* 报错已由请求层统一提示 */
    })
}

function formatExpireTime(expiresAt?: string) {
  if (!expiresAt) {
    return '永不过期'
  }
  return expiresAt
}

function maskKey(key?: string) {
  if (!key) return ''
  if (key.length <= 10) return '**********'
  return key.substring(0, 6) + '************************' + key.substring(key.length - 4)
}

function copyToClipboard(text: string) {
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  try {
    document.execCommand('copy')
    ElMessage({ message: '复制成功', type: 'success', duration: 1500 })
  } catch {
    ElMessage({ message: '复制失败，请手动复制', type: 'error', duration: 2000 })
  }
  document.body.removeChild(textarea)
}

function closeShowKeyDialog() {
  showKeyDialogVisible.value = false
  newApiKey.value = ''
  newApiSecret.value = ''
}

async function submitSaveForm() {
  if (window.globalConfig.is_clklog_demo_environment) {
    return openDialogEvent()
  }
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  const params = { ...form.value }
  if (form.value.id) {
    void editApiKey(params).then(() => {
      ElMessage({ message: '保存成功', type: 'success', duration: 2000 })
      getList()
      centerDialogVisible.value = false
    })
  } else {
    void addApiKey(params).then((response) => {
      if (response?.data) {
        newApiKey.value = response.data.apiKey || ''
        newApiSecret.value = response.data.apiSecret || ''
        showKeyDialogVisible.value = true
      }
      getList()
      centerDialogVisible.value = false
    })
  }
}

function reset() {
  form.value = {
    id: undefined,
    displayName: undefined,
    expiresAt: '',
    status: '启用',
  }
}

function addApiKeyEvent() {
  reset()
  centerDialogVisible.value = true
  title.value = '新建API密钥'
}

function handleUpdate(row: ApiKeyRow) {
  reset()
  const apiKeyId = row.id
  const token = nextDetail()
  void getApiKey({ id: apiKeyId })
    .then((response) => {
      if (!isLatestDetail(token)) return
      form.value = response?.data || {}
      centerDialogVisible.value = true
      title.value = '修改API密钥'
    })
    .catch(() => {
      if (!isLatestDetail(token)) return
      /* 报错已由请求层统一提示 */
    })
}

function handleDelete(row: ApiKeyRow) {
  if (window.globalConfig.is_clklog_demo_environment) {
    return openDialogEvent()
  }
  const apiKeyId = row.id
  void ElMessageBox.confirm('是否确认删除该API密钥？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    cancelButtonClass: 'custom-cancel-button',
    type: 'warning',
  })
    .then(function () {
      return deleteApiKey({ id: apiKeyId })
    })
    .then(() => {
      getList()
      ElMessage({ message: '删除成功', type: 'success' })
    })
    .catch(() => {})
}

onMounted(() => {
  getList()
})
</script>

<template>
  <div class="public-block">
    <div class="Overview public-hoverItem" style="padding: 25px">
      <div class="public-firstHead">API密钥管理</div>
      <br />
      <el-button class="addApiKey" @click="addApiKeyEvent">
        <el-icon><Plus /></el-icon>新建API密钥
      </el-button>
      <br />
      <el-table
        border
        :data="apiKeyList"
        :header-cell-style="headerCellStyle"
        class="public-radius"
        :cell-style="{ textAlign: 'center' }"
        style="width: 100%; min-height: 500px"
      >
        <el-table-column
          label="序号"
          type="index"
          :width="proxy?.$fixedWidth.FwIndex"
          align="center"
        >
          <template #default="scope">
            <span v-text="getIndex(scope.$index)" />
          </template>
        </el-table-column>
        <el-table-column label="密钥信息" min-width="300px">
          <template #default="scope">
            <div class="app-table-info">
              <div class="info-left">
                <div class="info-item">
                  <label class="info-label">显示名称：</label>
                  <span class="info-value">{{ scope.row.displayName }}</span>
                </div>
                <div class="info-item">
                  <label class="info-label">API密钥：</label>
                  <div class="key-wrapper">
                    <span :id="'hideKey' + scope.row.id" class="key-text">
                      {{ scope.row.showKey ? scope.row.apiKey : maskKey(scope.row.apiKey) }}
                    </span>
                    <!-- v2 这里的「显示/隐藏密钥」图标已被注释掉，保持一致不迁移 -->
                  </div>
                </div>
              </div>
              <!-- v2 这里的「创建时间 / 过期时间」右栏已被注释掉，保持一致不迁移 -->
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="150">
          <template #default="scope">
            <el-tag :type="scope.row.status === '启用' ? 'success' : 'warning'">
              {{ scope.row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" min-width="200px">
          <template #default="scope">
            {{ scope.row.createdAt }}
          </template>
        </el-table-column>
        <el-table-column label="过期时间" min-width="200px">
          <template #default="scope">
            {{ formatExpireTime(scope.row.expiresAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" align="left" min-width="200px">
          <template #default="scope">
            <div style="display: flex; justify-content: center">
              <el-icon class="edit_btn" @click="handleUpdate(scope.row)"><Edit /></el-icon>
              <el-icon class="delete_btn" @click="handleDelete(scope.row)"><Delete /></el-icon>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog
      v-model="centerDialogVisible"
      :modal-append-to-body="false"
      :close-on-click-modal="true"
      :close-on-press-escape="false"
      width="600px"
      top="10vh"
      :title="title"
    >
      <el-form ref="formRef" :model="form" size="small" :rules="rules" label-width="100px">
        <el-form-item label="显示名称" prop="displayName" size="default">
          <el-input v-model="form.displayName" placeholder="请输入密钥显示名称" style="width: 100%" />
        </el-form-item>
        <el-form-item label="过期时间" prop="expiresAt" size="default">
          <div style="display: flex; align-items: center">
            <el-date-picker
              v-model="form.expiresAt"
              type="datetime"
              placeholder="选择过期时间"
              :shortcuts="pickerShortcuts"
              style="flex: 1"
            />
            <span style="margin-left: 15px; color: #909399; font-size: 13px; white-space: nowrap">
              留空则永久有效
            </span>
          </div>
        </el-form-item>
        <el-form-item v-if="form.id" label="状态" prop="status" size="default">
          <!-- v2 这里的 el-select 版本已被注释掉，保持一致不迁移 -->
          <el-radio-group v-model="form.status" style="width: 100%">
            <el-radio value="启用">启用</el-radio>
            <el-radio value="禁用">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <div
          class="dialog-footer"
          style="text-align: right; display: flex; justify-content: center"
        >
          <el-button class="zc_btn" @click="submitSaveForm">保存</el-button>
          <el-button class="zc_btn_default" @click="centerDialogVisible = false">取消</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog
      v-model="showKeyDialogVisible"
      :modal-append-to-body="false"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      width="600px"
      top="15vh"
      class="success-key-dialog"
    >
      <template #header>
        <div class="success-dialog-title">
          <el-icon style="color: #67c23a; font-size: 24px; margin-right: 10px; vertical-align: middle">
            <SuccessFilled />
          </el-icon>
          <span style="font-weight: bold; font-size: 18px; vertical-align: middle">
            API密钥创建成功
          </span>
        </div>
      </template>
      <div class="show-key-content">
        <div class="warning-banner">
          <el-icon><WarningFilled /></el-icon>
          <span>请立即复制并妥善保存以下密钥信息，关闭后将无法再次查看完整的密钥！</span>
        </div>
        <div class="key-display-card">
          <div class="key-label">API Key</div>
          <div class="key-value-box">
            <code class="key-code">{{ newApiKey }}</code>
            <el-tooltip content="复制密钥" placement="top">
              <el-button link class="copy-btn" @click="copyToClipboard(newApiKey)">
                <el-icon><DocumentCopy /></el-icon>复制
              </el-button>
            </el-tooltip>
          </div>
        </div>
      </div>
      <template #footer>
        <div
          class="dialog-footer"
          style="display: flex; justify-content: center; align-items: center"
        >
          <el-button class="zc_btn" @click="closeShowKeyDialog">确定</el-button>
          <el-button class="zc_btn_default" @click="closeShowKeyDialog">取消</el-button>
        </div>
      </template>
    </el-dialog>

    <DialogPage ref="dialogPageRef" />
  </div>
</template>

<style lang="scss" scoped>
:deep() {
  .el-dialog__body {
    padding: 24px 50px 0 24px;
  }

  .el-form-item {
    margin-bottom: 15px;
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

.addApiKey.el-button {
  color: #2c7be5;
  border: 1px solid #2c7be5;
  margin-bottom: 25px;
}

// 分页样式 el-pagination 已在 src/styles/index.scss 全局引入（sass 不允许 @use 出现在嵌套块里）
:deep() {
  .el-form-item.is-error .el-input__inner,
  .el-form-item.is-error .el-input__inner:focus,
  .el-form-item.is-error .el-textarea__inner,
  .el-form-item.is-error .el-textarea__inner:focus {
    border-color: #fff;
    border: 1px solid #ff4949;
  }

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
    border: 1px solid #dcdfe6;
  }

  .el-input__inner {
    border: 1px solid #dcdfe6;
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
  width: 100%;
}

.gp-item-01 {
  font-weight: 400px !important;
  width: 100%;
}

.gp-item-01 .el-form-item__content {
  width: 100%;
}

.gm-input-01 textarea {
  border: 1px solid #dcdfe6;
}

.el-form-item__label {
  font-size: 14px;
}

.app-table-info {
  display: flex;
  justify-content: space-between;
  padding: 0px 10px;
  color: #606266;
  width: 100%;

  .info-left,
  .info-right {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .info-left {
    padding-right: 0px;
  }

  .info-item {
    display: flex;
    align-items: center;
    line-height: 1.4;
  }

  .info-label {
    width: 85px;
    color: #909399;
    font-weight: 400;
    flex-shrink: 0;
    text-align: left;
  }

  .info-value {
    color: #303133;
    word-break: break-all;
  }

  .key-wrapper {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;

    .key-text {
      font-family: monospace;
      background: #f5f7fa;
      padding: 2px 6px;
      border-radius: 4px;
      text-align: left;
      color: #303133;
    }

    .icon-style {
      cursor: pointer;
      color: #409eff;
      font-size: 16px;

      &:hover {
        color: #66b1ff;
      }
    }
  }
}

.show-key-content {
  padding: 10px 0;
}

.warning-banner {
  background-color: #fff7e8;
  border: 1px solid #ffd591;
  border-radius: 4px;
  padding: 10px;
  margin-bottom: 12px;
  display: flex;
  align-items: flex-start;
  color: #fa8c16;
  font-size: 13px;
  line-height: 1.5;

  i {
    margin-right: 8px;
    margin-top: 2px;
    font-size: 16px;
  }
}

.key-display-card {
  background: #f9fbff;
  border-radius: 8px;
  padding: 15px;
  border: 1px dashed #adc6ff;
}

.key-label {
  font-size: 12px;
  color: #8c8c8c;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.key-value-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #ffffff;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  padding: 8px 12px;
}

.key-code {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 15px;
  color: #262626;
  word-break: break-all;
  user-select: all;
}

.copy-btn {
  padding: 0;
  margin-left: 15px;
  font-size: 14px;
  font-weight: 500;

  &:hover {
    color: #40a9ff;
  }
}

// 与 v2 一致：这组规则写在 scoped 里但没有加深度选择器，
// .success-key-dialog 是 el-dialog 内部节点，选不中，实际不生效（v2 同样不生效）
.success-key-dialog {
  .el-dialog__header {
    border-bottom: 1px solid #f0f0f0;
    padding: 20px 24px;
  }

  .el-dialog__footer {
    padding: 24px;
    border-top: none;
  }
}
</style>
