<script setup lang="ts">
import { getCurrentInstance, nextTick, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Delete, Edit, Plus, Refresh, Search } from '@element-plus/icons-vue'
import {
  addRole,
  deleteRole,
  editRole,
  getRoleListPage,
  type RoleRow,
} from '@/api/authmanage/role'
import { copyObj } from '@/utils/copy'
import { useLatestOnly } from '@/composables/useLatestOnly'
import { bus } from '@/utils/event-bus'

// 用 type 而不是 interface：interface 没有隐式索引签名，
// Object.assign 出来的 para 就传不进 `Record<string, unknown>` 的接口入参
type RoleForm = {
  roleId?: string | null
  roleName?: string | null
  displayName?: string | null
  orderNumber?: number | null
  forProject?: boolean
  roleType?: string
}

const proxy = getCurrentInstance()?.proxy
const { next, isLatest } = useLatestOnly()

// 与 v2 一致（v2 此处逻辑存疑：lastRoleType 只在 handleEdit 里赋值，之后没有任何地方读取）
const lastRoleType = ref<string | null>(null)
const rows = ref<RoleRow[]>([])
const total = ref(0)
const pageSize = ref(10)
const pageNum = ref(1)
const loading = ref(false)
const queryParams = ref({
  roleName: '',
  displayName: '',
})
// 弹出层标题
const title = ref('')
// 是否显示弹出层
const open = ref(false)
const formRef = ref<FormInstance>()
// 表单参数
const form = ref<RoleForm>({
  roleId: null,
  roleName: null,
  displayName: null,
  orderNumber: null,
  forProject: false,
  roleType: 'user',
})
// 表单校验
const rules: FormRules<RoleForm> = {
  roleName: [{ required: true, message: '请输入应用名', trigger: 'blur' }],
  displayName: [{ required: true, message: '请输入现实名', trigger: 'blur' }],
  orderNumber: [{ required: true, message: '请输入排序号', trigger: 'blur' }],
}

/** v2 用的是 moment 过滤器 formatDate（YYYY-MM-DD HH:mm:ss），v3 无 moment，等价本地实现 */
function formatDateTime(time?: string | number) {
  if (!time) {
    return ''
  }
  const date = new Date(time)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  )
}

function getIndex(index: number) {
  return (pageNum.value - 1) * pageSize.value + index + 1
}

function getRoles() {
  const para = {
    pageSize: pageSize.value,
    pageIndex: pageNum.value,
    roleName: queryParams.value.roleName,
    displayName: queryParams.value.displayName,
  }
  const token = next()
  loading.value = true
  getRoleListPage(para)
    .then((res) => {
      if (!isLatest(token)) return
      loading.value = false
      // v2 没有判 code，403/423 通道会返回没有 data 的结果
      if (res?.code != 200) return
      total.value = res.data?.total ?? 0
      rows.value = res.data?.rows ?? []
    })
    .catch(() => {
      // v2 无 catch，报错时 loading 会一直转，这里补上（报错提示由请求层统一给）
      if (!isLatest(token)) return
      loading.value = false
    })
}

function handleRolesSearch() {
  pageNum.value = 1
  getRoles()
}

function resetQuery() {
  pageNum.value = 1
  pageSize.value = 10
  queryParams.value = {
    roleName: '',
    displayName: '',
  }
  getRoles()
}

function handleSizeChange(val: number) {
  pageSize.value = val
  getRoles()
}

function handleCurrentChange(val: number) {
  pageNum.value = val
  getRoles()
}

function handleDel(row: RoleRow) {
  ElMessageBox.confirm('确认删除' + row.roleName + '吗?', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    cancelButtonClass: 'custom-cancel-button',
    type: 'warning',
  })
    .then(() => {
      if (window.globalConfig.is_clklog_demo_environment) {
        // v2 的 $bus.$emit('$demo_event')：演示环境弹提示框，不执行真实操作
        bus.emit('$demo_event')
        return
      }
      loading.value = true
      const para = { roleId: row.roleId }
      const token = next()
      deleteRole(para)
        .then((res) => {
          if (!isLatest(token)) return
          loading.value = false
          const msg = res?.data ? '删除成功' : '删除失败'
          const type = res?.data ? 'success' : 'warning'
          ElMessage({
            message: msg,
            type: type,
          })
          getRoles()
        })
        .catch(() => {
          if (!isLatest(token)) return
          loading.value = false
        })
    })
    .catch(() => {})
    .finally(() => {
      // 与 v2 一致（v2 此处逻辑存疑：finally 在删除请求发出前就把 loading 置回 false，
      // 删除过程中并不会显示 loading）
      loading.value = false
    })
}

function handleEdit(row: RoleRow) {
  lastRoleType.value = copyObj(row.roleType) ?? null
  title.value = '编辑角色'
  form.value = Object.assign({}, row)
  form.value.forProject = form.value.forProject === true
  open.value = true
  void nextTick(() => {
    formRef.value?.clearValidate()
  })
}

function handleAdd() {
  title.value = '添加角色'
  form.value = {
    roleId: null,
    roleName: null,
    displayName: null,
    orderNumber: null,
    forProject: false,
  }
  open.value = true
  void nextTick(() => {
    formRef.value?.clearValidate()
  })
}

async function editSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  if (window.globalConfig.is_clklog_demo_environment) {
    bus.emit('$demo_event')
    return
  }
  loading.value = true
  const para = Object.assign({}, form.value)
  const token = next()
  editRole(para)
    .then((res) => {
      if (!isLatest(token)) return
      loading.value = false
      const msg = res?.data ? '编辑成功' : res?.msg
      const type = res?.data ? 'success' : 'warning'
      ElMessage({
        message: msg,
        type: type,
      })
      formRef.value?.resetFields()
      open.value = false
      getRoles()
    })
    .catch(() => {
      if (!isLatest(token)) return
      loading.value = false
    })
}

async function addSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  if (window.globalConfig.is_clklog_demo_environment) {
    bus.emit('$demo_event')
    return
  }
  loading.value = true
  const para = Object.assign({}, form.value)
  const token = next()
  addRole(para)
    .then((res) => {
      if (!isLatest(token)) return
      loading.value = false
      const msg = res?.data ? '添加成功' : res?.msg
      const type = res?.data ? 'success' : 'warning'
      ElMessage({
        message: msg,
        type: type,
      })
      formRef.value?.resetFields()
      open.value = false
      getRoles()
    })
    .catch(() => {
      if (!isLatest(token)) return
      loading.value = false
    })
}

function submit() {
  if (form.value.roleId) {
    void editSubmit()
  } else {
    void addSubmit()
  }
}

onMounted(() => {
  getRoles()
})
</script>

<template>
  <div>
    <div class="documentation-container">
      <div class="search-area">
        <el-form :model="queryParams" size="small" :inline="true" label-width="60px">
          <el-form-item label="角色名" prop="roleName">
            <el-input
              v-model="queryParams.roleName"
              placeholder="请输入角色名"
              clearable
              size="small"
              @keyup.enter="getRoles"
            />
          </el-form-item>
          <el-form-item class="filterbar-tab-right" label="显示名" prop="displayName">
            <el-input
              v-model="queryParams.displayName"
              placeholder="请输入显示名"
              clearable
              size="small"
              @keyup.enter="getRoles"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :icon="Search" size="small" @click="handleRolesSearch"
              >搜索</el-button
            >
            <el-button :icon="Refresh" size="small" @click="resetQuery">重置</el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>
    <div class="public-block">
      <div class="block-main public-hoverItem logCon" style="min-height: 200px">
        <div style="display: flex; justify-content: space-between">
          <div class="public-tableHead">角色管理</div>
          <div style="display: flex">
            <el-button class="custom_button zc_btn_default" :icon="Plus" @click="handleAdd"
              >新增角色</el-button
            >
          </div>
        </div>
        <el-table
          v-loading="loading"
          class="public-radius"
          :header-cell-style="{ textAlign: 'center', background: '#f7fafe ' }"
          :cell-style="{ textAlign: 'center' }"
          :data="rows"
          border
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
          <el-table-column prop="roleName" label="角色名"> </el-table-column>
          <el-table-column prop="displayName" label="显示名"> </el-table-column>
          <el-table-column prop="orderNumber" :width="proxy?.$fixedWidth.FwIndex" label="排序号">
          </el-table-column>
          <!-- <el-table-column prop="forProject" label="是否项目相关角色">
            <template #default="{ row }">
              {{ row.forProject ? '是' : '否' }}
            </template>
          </el-table-column> -->
          <el-table-column prop="roleType" label="角色类型">
            <template #default="{ row }">
              {{ row.roleType === 'system' ? '系统' : '用户' }}
            </template>
          </el-table-column>
          <el-table-column prop="createtime" :width="proxy?.$fixedWidth.FwTime" label="创建日期">
            <template #default="{ row }">
              {{ formatDateTime(row.createtime) }}
            </template>
          </el-table-column>
          <el-table-column prop="modifytime" :width="proxy?.$fixedWidth.FwTime" label="修改日期">
            <template #default="{ row }">
              {{ formatDateTime(row.modifytime) }}
            </template>
          </el-table-column>
          <el-table-column label="操作">
            <template #default="{ row }">
              <div style="display: flex; justify-content: center">
                <el-icon class="edit_btn" @click="handleEdit(row)"><Edit /></el-icon>
                <!-- v-if="row.roleType != 'system'" -->
                <el-icon class="delete_btn" @click="handleDel(row)"><Delete /></el-icon>
              </div>
            </template>
          </el-table-column>
        </el-table>
        <div class="block">
          <el-pagination
            next-text="下一页"
            :current-page="pageNum"
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

    <el-dialog
      v-model="open"
      :title="title"
      width="900px"
      top="20vh"
      :close-on-click-modal="false"
    >
      <div
        class="public-hoverItem"
        style="
          min-height: 80px;
          background-color: #fbfcfe;
          padding: 16px;
          box-sizing: border-box;
          font-size: 20px;
        "
      >
        <el-form
          ref="formRef"
          class="dialog-form"
          :model="form"
          :rules="rules"
          label-width="130px"
        >
          <el-form-item label="角色名" prop="roleName">
            <el-input
              v-model="form.roleName"
              size="small"
              placeholder="请输入角色名"
              clearable
            ></el-input>
          </el-form-item>
          <el-form-item label="显示名" prop="displayName">
            <el-input
              v-model="form.displayName"
              size="small"
              placeholder="请输入显示名"
              clearable
            ></el-input>
          </el-form-item>
          <!-- <el-form-item label="是否项目相关角色" prop="forProject">
            <el-radio-group v-model="form.forProject">
              <el-radio :value="true">是</el-radio>
              <el-radio :value="false">否</el-radio>
            </el-radio-group>
          </el-form-item> -->
          <el-form-item label="排序号" prop="orderNumber">
            <el-input-number
              v-model="form.orderNumber"
              size="small"
              placeholder="请输入排序号"
              clearable
            ></el-input-number>
          </el-form-item>
        </el-form>
        <div style="display: flex; justify-content: end">
          <!-- v2 这里写的是 slot="footer"，但它不是 el-dialog 的直接子节点，插槽不生效，按钮就渲染在内容里 -->
          <span class="dialog-footer">
            <el-button size="small" type="primary" @click="submit">确 定</el-button>
            <el-button size="small" @click="open = false">取 消</el-button>
          </span>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
// 分页样式在 src/styles/index.scss 全局引入一次（sass 不允许 @use 出现在嵌套块里）
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
  padding: 16px;
  background-color: #eef4fd;
  border-radius: 6px;
}

.documentation-container {
  box-sizing: border-box;
  min-height: 66px;
  padding-bottom: 20px;
  width: 100%;

  .search-area {
    position: fixed;
    padding: 15px 15px;
    display: flex;
    border-bottom: 1px solid #eee;
    width: 100%;
    z-index: 200;
    background: #fff;
    overflow: auto;
    white-space: nowrap;
    min-height: 66px;

    :deep(.el-form-item) {
      margin-bottom: 0px;
      margin-right: 0px;
    }

    :deep(.el-form-item__label) {
      font-size: 13px;
      padding-right: 10px;
    }
  }
}

.dialog-form {
  :deep(.el-form-item__label) {
    font-size: 13px;
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
</style>
