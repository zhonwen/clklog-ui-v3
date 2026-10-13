<script setup lang="ts">
import { getCurrentInstance, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Delete, Edit, Key, Plus, Refresh, Search } from '@element-plus/icons-vue'
import {
  addUser,
  deleteUser,
  editUser,
  getUser,
  getUserListPage,
  modifyPassword,
  type UserProjectRole,
  type UserRow,
} from '@/api/authmanage/user'
import { getRoleList, type RoleRow } from '@/api/authmanage/role'
import { copyObj } from '@/utils/copy'
import { useLatestOnly } from '@/composables/useLatestOnly'
import { useTrackingStore } from '@/stores/tracking'
import { bus } from '@/utils/event-bus'
import { getPasswordError } from '@/utils/validate'
import { encryptPasswordWithCid, fetchEncryptContext } from '@/utils/rsaEncrypt'

/** 项目上挂的角色选项，id = 项目名 + '_' + 角色id */
interface ProjectRoleOption extends RoleRow {
  projectId?: string
  projectName?: string
  id: string
}

/** 项目行：store 里的项目 + 本页临时挂上去的角色选项 */
interface ProjectRow {
  id?: string
  projectName: string
  projectDisplayName: string
  inProjectRoles?: ProjectRoleOption[]
}

// 用 type 而不是 interface：interface 没有隐式索引签名，
// Object.assign 出来的 para 就传不进 `Record<string, unknown>` 的接口入参
type UserForm = {
  userId?: string | null
  userName?: string
  displayName?: string
  password?: string
  password2?: string
  oldpassword?: string
  roles?: UserProjectRole[]
  /** el-checkbox-group 回填的是 (string | number)[]，运行时是角色 id 字符串数组 */
  roleIds: (string | number)[]
}

const proxy = getCurrentInstance()?.proxy
const trackingStore = useTrackingStore()
const { next: nextList, isLatest: isLatestList } = useLatestOnly()
const { next: nextRoles, isLatest: isLatestRoles } = useLatestOnly()
const { next: nextDetail, isLatest: isLatestDetail } = useLatestOnly()
const { next: nextSubmit, isLatest: isLatestSubmit } = useLatestOnly()

// 账号信息表单；v2 三个 el-form 都写 ref="form"，$refs.form 指向最后挂载的那个，
// 这里拆成两个明确的 ref：账号信息用 formRef，修改密码弹窗用 modifyPwdFormRef。
const formRef = ref<FormInstance>()
const modifyPwdFormRef = ref<FormInstance>()

const is_clklog_demo_environment = window.globalConfig.is_clklog_demo_environment || false
const allRoles = ref<RoleRow[]>([])
const rows = ref<UserRow[]>([])
const total = ref(0)
const pageSize = ref(20)
const pageNum = ref(1)
const loading = ref(false)
const queryParams = ref({
  userName: '',
  displayName: '',
})
const open = ref(false)
const addFormReadonly = ref(true)
const title = ref('')
const addPasswordRef = ref()
const addPassword2Ref = ref()
const modifyPasswordRef = ref()
const modifyPassword2Ref = ref()
const form = ref<UserForm>({
  userId: null,
  userName: '',
  displayName: '',
  password: undefined,
  password2: undefined,
  oldpassword: undefined,
  roles: [],
  roleIds: [], // 是否项目相关角色-否的情况下角色id列表
})
// el-tabs 的 update:modelValue 类型是 string | number
const activeName = ref<string | number>('first')

const passwordType = reactive({
  password: 'password' as 'password' | 'text',
  password2: 'password' as 'password' | 'text',
})
const modifyPwdType = reactive({
  password: 'password' as 'password' | 'text',
  password2: 'password' as 'password' | 'text',
})

const validatePassword = (_rule: unknown, value: string, callback: (error?: Error) => void) => {
  const error = getPasswordError(value, '请输入密码')
  if (error) {
    callback(new Error(error))
  } else {
    callback()
  }
}

const validatePassword2 = (_rule: unknown, value: string, callback: (error?: Error) => void) => {
  if (!value) {
    callback(new Error('请再次输入新密码'))
  } else if (value !== form.value.password) {
    callback(new Error('两次密码不一致'))
  } else {
    callback()
  }
}

const validateModifyPassword = (_rule: unknown, value: string, callback: (error?: Error) => void) => {
  const error = getPasswordError(value, '请输入新密码')
  if (error) {
    callback(new Error(error))
  } else {
    if (formModifyPwd.value.password2) {
      void modifyPwdFormRef.value?.validateField('password2')
    }
    callback()
  }
}

const validateModifyPassword2 = (_rule: unknown, value: string, callback: (error?: Error) => void) => {
  if (!value) {
    callback(new Error('请再次输入新密码'))
  } else if (value !== formModifyPwd.value.password) {
    callback(new Error('两次密码不一致'))
  } else {
    callback()
  }
}

const rules: FormRules<UserForm> = {
  userName: [{ required: true, message: '请输入账号', trigger: 'blur' }],
  displayName: [{ required: true, message: '请输入显示名', trigger: 'blur' }],
  password: [{ required: true, trigger: 'blur', validator: validatePassword }],
  password2: [{ required: true, trigger: 'blur', validator: validatePassword2 }],
}
const modifyPwdRules: FormRules<{ password?: string; password2?: string }> = {
  password: [{ required: true, trigger: 'blur', validator: validateModifyPassword }],
  password2: [{ required: true, trigger: 'blur', validator: validateModifyPassword2 }],
}
// v2 直接把 vuex 里的 projectArray 拿来用，并给每个项目对象挂 inProjectRoles（写脏了 store 里的数据）。
// v3 用一份快照副本，页面行为一致，但不写 store。
const projectArray = ref<ProjectRow[]>(copyObj(trackingStore.projectArray) as ProjectRow[])
const selectedProjectRoles = ref<(string | number)[]>([])
const nonProjectRoles = ref<RoleRow[]>([]) // 非项目相关角色列表
const inProjectRoles = ref<RoleRow[]>([]) // 项目相关角色列表
// v2 的 defaultRoleId 没有写进 data（不是响应式），这里按普通 ref 处理，读写时机一致
const defaultRoleId = ref<string | null>(null)
const openModifyPwd = ref(false)
const formModifyPwd = ref<{
  userId?: string | null
  password?: string
  password2?: string
}>({
  userId: null,
  password: undefined,
  password2: undefined,
})

// v2 data 里还有一个与 form.roleIds 同名的顶层 roleIds，只在被注释掉的 watch 里出现过，未迁移。

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

// v2 是对数组 data 的 watch，Vue2 里 push / 整体赋值都会触发，Vue3 需要 deep 才等价
watch(
  selectedProjectRoles,
  (newVal) => {
    // if (Array.isArray(newVal) && newVal.length > 0 && this.defaultRoleId) {
    //   if (!this.form.roleIds.includes(this.defaultRoleId)) {
    //     this.form.roleIds = this.form.roleIds.concat([this.defaultRoleId]);
    //   }
    // }
    if (Array.isArray(newVal)) {
      const roleId = defaultRoleId.value
      if (newVal.length > 0) {
        if (roleId && !form.value.roleIds.includes(roleId)) {
          form.value.roleIds = form.value.roleIds.concat([roleId])
        }
      } else {
        if (roleId && form.value.roleIds.includes(roleId)) {
          form.value.roleIds = form.value.roleIds.filter((x) => x !== roleId)
        }
      }
    }
  },
  { deep: true },
)

function handleProjectRoleChange() {
  const roleId = defaultRoleId.value
  if (selectedProjectRoles.value.length > 0 && roleId) {
    if (!form.value.roleIds.includes(roleId)) {
      form.value.roleIds = form.value.roleIds.concat([roleId])
    }
  }
}

// 加载角色列表
function loadRoles() {
  const token = nextRoles()
  getRoleList({ includeSysAdmin: true })
    .then((res) => {
      if (!isLatestRoles(token)) return
      if (res?.code != 200) return
      allRoles.value = res.data ?? []
      // 过滤出非项目相关角色 (forProject !== true)
      nonProjectRoles.value = allRoles.value.filter((role) => role.forProject != true)
      inProjectRoles.value = allRoles.value.filter((role) => role.forProject == true)
      defaultRoleId.value =
        nonProjectRoles.value.find((x) => x.roleName === 'default')?.roleId || null
    })
    .catch(() => {
      /* 报错提示由请求层统一给 */
    })
}

function getIndex(index: number) {
  return (pageNum.value - 1) * pageSize.value + index + 1
}

function getUsers() {
  const para = {
    pageSize: pageSize.value,
    pageIndex: pageNum.value,
    userName: queryParams.value.userName,
    displayName: queryParams.value.displayName,
  }
  const token = nextList()
  loading.value = true
  getUserListPage(para)
    .then((res) => {
      if (!isLatestList(token)) return
      loading.value = false
      // v2 没有判 code，403/423 通道会返回没有 data 的结果
      if (res?.code != 200) return
      total.value = res.data?.total ?? 0
      rows.value = res.data?.rows ?? []
    })
    .catch(() => {
      // v2 无 catch，报错时 loading 会一直转，这里补上（报错提示由请求层统一给）
      if (!isLatestList(token)) return
      loading.value = false
    })
}

function handleRoleSearch() {
  pageNum.value = 1
  getUsers()
}

function closeDialog() {
  open.value = false
  loading.value = false
}

function resetQuery() {
  queryParams.value.userName = ''
  queryParams.value.displayName = ''
  pageNum.value = 1
  pageSize.value = 20
  getUsers()
}

function handleSizeChange(val: number) {
  pageSize.value = val
  getUsers()
}

function handleCurrentChange(val: number) {
  pageNum.value = val
  getUsers()
}

/** 循环项目，每个项目加上角色 */
function fillProjectRoles() {
  projectArray.value.forEach((project) => {
    const t_allroles: ProjectRoleOption[] = []
    inProjectRoles.value.forEach((role) => {
      const t_role: ProjectRoleOption = {
        ...role,
        projectId: project.id,
        projectName: project.projectName,
        id: project.projectName + '_' + role.roleId,
      }
      t_allroles.push(t_role)
    })
    project.inProjectRoles = t_allroles
  })
}

function handleDel(row: UserRow) {
  ElMessageBox.confirm('确认删除' + row.userName + '吗?', '提示', {
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
      const para = { userId: row.userId }
      const token = nextSubmit()
      deleteUser(para)
        .then((res) => {
          if (!isLatestSubmit(token)) return
          loading.value = false
          const msg = res?.data ? '删除成功' : '删除失败'
          const type = res?.data ? 'success' : 'warning'
          ElMessage({
            message: msg,
            type: type,
          })
          getUsers()
        })
        .catch(() => {
          if (!isLatestSubmit(token)) return
          loading.value = false
        })
    })
    .catch(() => {})
    .finally(() => {
      // 与 v2 一致（v2 此处逻辑存疑：finally 在删除请求发出前就把 loading 置回 false）
      loading.value = false
    })
}

function handleEdit(row: UserRow) {
  title.value = '编辑账号'
  addFormReadonly.value = false
  open.value = true
  activeName.value = 'first'
  fillProjectRoles()
  selectedProjectRoles.value = []
  const para = { userId: row.userId }
  const token = nextDetail()
  getUser(para)
    .then((res) => {
      if (!isLatestDetail(token)) return
      loading.value = false
      if (res?.code == 200) {
        // 仅保留属于项目角色(inProjectRoles)且项目名存在的角色
        const projectRoleIds = new Set(inProjectRoles.value.map((r) => r.roleId))
        const projectNames = new Set((projectArray.value || []).map((p) => p.projectName))
        const roles = (res.data?.roles || []).filter(
          (r) => projectRoleIds.has(r.roleId) && projectNames.has(r.projectName),
        )

        roles.forEach((r) => {
          const id = r.projectName + '_' + r.roleId
          selectedProjectRoles.value.push(id)
        })
        // 仅保留属于系统角色（非项目角色）的 roleId
        const systemRoleIds = new Set(nonProjectRoles.value.map((r) => r.roleId))
        const roleIds = (res.data?.roleIds || []).filter((id) => systemRoleIds.has(id))
        const detail: UserRow = res.data ?? {}
        form.value = Object.assign({}, detail, { roles, roleIds })
      } else {
        const msg = res?.msg
        const type = 'warning'
        ElMessage({
          message: msg,
          type: type,
        })
        formRef.value?.resetFields()
      }
    })
    .catch(() => {
      if (!isLatestDetail(token)) return
      loading.value = false
    })
}

function handleAdd() {
  title.value = '新增账号'
  addFormReadonly.value = true
  form.value = {
    userId: null,
    userName: '',
    displayName: '',
    password: undefined,
    password2: undefined,
    roles: [],
    roleIds: [],
  }
  activeName.value = 'first'
  open.value = true
  fillProjectRoles()
  selectedProjectRoles.value = []
  void nextTick(() => {
    formRef.value?.clearValidate()
    setTimeout(() => {
      form.value.userName = ''
      form.value.displayName = ''
      form.value.password = undefined
      form.value.password2 = undefined
      passwordType.password = 'password'
      passwordType.password2 = 'password'
      formRef.value?.clearValidate()
    }, 120)
  })
}

async function editSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) {
    loading.value = false
    return
  }
  if (window.globalConfig.is_clklog_demo_environment) {
    loading.value = false
    bus.emit('$demo_event')
    return
  }
  const para = Object.assign({}, form.value)
  const token = nextSubmit()
  editUser(para)
    .then((res) => {
      if (!isLatestSubmit(token)) return
      loading.value = false
      const msg = res?.data ? '编辑成功' : res?.msg
      const type = res?.data ? 'success' : 'warning'
      ElMessage({
        message: msg,
        type: type,
      })
      formRef.value?.resetFields()
      open.value = false
      getUsers()
    })
    .catch(() => {
      if (!isLatestSubmit(token)) return
      loading.value = false
    })
}

async function addSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) {
    loading.value = false
    return
  }
  if (window.globalConfig.is_clklog_demo_environment) {
    loading.value = false
    bus.emit('$demo_event')
    return
  }
  const token = nextSubmit()
  fetchEncryptContext()
    .then(({ cid, publicKey }) => {
      const para = Object.assign({}, form.value)
      para.password = encryptPasswordWithCid(form.value.password || '', cid, publicKey)
      delete para.password2
      delete para.oldpassword
      para.cid = cid
      return addUser(para)
    })
    .then((res) => {
      if (!isLatestSubmit(token)) return
      loading.value = false
      const msg = res?.data ? '添加成功' : res?.msg
      const type = res?.data ? 'success' : 'warning'
      ElMessage({
        message: msg,
        type: type,
      })
      formRef.value?.resetFields()
      open.value = false
      getUsers()
    })
    .catch((e) => {
      if (!isLatestSubmit(token)) return
      loading.value = false
      const msg = e instanceof Error ? e.message : ''
      if (msg && /公钥|加密|验证码标识/.test(msg)) {
        ElMessage.error(msg)
      }
    })
}

function submit() {
  loading.value = true
  if (!form.value.userName) {
    ElMessage({
      message: '请输入账号',
      type: 'warning',
    })
    loading.value = false
    return
  }
  if (!form.value.displayName) {
    ElMessage({
      message: '请输入显示名',
      type: 'warning',
    })
    loading.value = false
    return
  }
  // 将选中的角色转换为角色对象
  const roles: UserProjectRole[] = []
  selectedProjectRoles.value.forEach((rawId) => {
    // 项目名可能含有_,id字符串按照最后一个_分割，前面的为项目名，后面的为角色id
    const id = String(rawId)
    const lastUnderscoreIndex = id.lastIndexOf('_')
    const projectName = id.substring(0, lastUnderscoreIndex)
    const roleId = id.substring(lastUnderscoreIndex + 1)
    const roleadd = {
      projectName: projectName,
      roleId: roleId,
    }
    roles.push(roleadd)
  })
  form.value.roles = roles
  if (!form.value.userId) {
    const passwordError = getPasswordError(form.value.password, '请输入密码')
    if (passwordError) {
      ElMessage({
        message: passwordError,
        type: 'warning',
      })
      loading.value = false
      return
    }
    if (!form.value.password2) {
      ElMessage({
        message: '请再次输入密码',
        type: 'warning',
      })
      loading.value = false
      return
    }
  }
  if (
    form.value.password &&
    form.value.password2 &&
    form.value.password != form.value.password2
  ) {
    ElMessage({
      message: '两次密码不一致',
      type: 'warning',
    })
    loading.value = false
    return
  }
  if (form.value.userId) {
    void editSubmit()
  } else {
    void addSubmit()
  }
}

function handleEditModifyPwd(row: UserRow) {
  title.value = '修改密码'
  openModifyPwd.value = true
  formModifyPwd.value = {
    userId: row.userId,
    password: undefined,
    password2: undefined,
  }
  modifyPwdType.password = 'password'
  modifyPwdType.password2 = 'password'
  void nextTick(() => {
    modifyPwdFormRef.value?.clearValidate()
  })
}

function closeDialogModifyPwd() {
  openModifyPwd.value = false
  loading.value = false
}

function submitModifyPwd() {
  if (window.globalConfig.is_clklog_demo_environment) {
    bus.emit('$demo_event')
    return
  }
  loading.value = true
  const passwordError = getPasswordError(formModifyPwd.value.password, '请输入新密码')
  if (passwordError) {
    ElMessage({
      message: passwordError,
      type: 'warning',
    })
    loading.value = false
    return
  }
  if (!formModifyPwd.value.password2) {
    ElMessage({
      message: '请再次输入新密码',
      type: 'warning',
    })
    loading.value = false
    return
  }
  if (formModifyPwd.value.password != formModifyPwd.value.password2) {
    ElMessage({
      message: '两次密码不一致',
      type: 'warning',
    })
    loading.value = false
    return
  }
  const token = nextSubmit()
  fetchEncryptContext()
    .then(({ cid, publicKey }) => {
      return modifyPassword({
        userId: formModifyPwd.value.userId,
        newPassword: encryptPasswordWithCid(formModifyPwd.value.password || '', cid, publicKey),
        cid,
      })
    })
    .then((res) => {
      if (!isLatestSubmit(token)) return
      loading.value = false
      if (res?.code === 200) {
        ElMessage({
          message: '修改成功',
          type: 'success',
        })
        modifyPwdFormRef.value?.resetFields()
        openModifyPwd.value = false
      } else {
        ElMessage({
          message: res?.msg || '修改失败',
          type: 'warning',
        })
      }
    })
    .catch((e) => {
      if (!isLatestSubmit(token)) return
      loading.value = false
      const msg = e instanceof Error ? e.message : ''
      if (msg && /公钥|加密|验证码标识/.test(msg)) {
        ElMessage.error(msg)
      }
    })
}

// v2 还有一个 UserSelectChange（写 this.editForm / this.addForm，这两个 data 根本不存在），
// 模板里没有任何地方绑定，属于死代码，未迁移。

function showPwd(
  field: 'password' | 'password2',
  inputRef: typeof addPasswordRef,
  typeKey?: 'modifyPwdType',
) {
  const typeMap = typeKey ? modifyPwdType : passwordType
  typeMap[field] = typeMap[field] === 'password' ? 'text' : 'password'
  nextTick(() => inputRef.value?.focus())
}

onMounted(() => {
  getUsers()
  loadRoles()
})
</script>

<template>
  <div>
    <div class="documentation-container">
      <div class="search-area">
        <el-form :model="queryParams" size="small" :inline="true" label-width="50px">
          <el-form-item label="账号" prop="userName">
            <el-input
              v-model="queryParams.userName"
              placeholder="请输入账号"
              clearable
              size="small"
              @keyup.enter="getUsers"
            />
          </el-form-item>
          <el-form-item label="显示名" prop="显示名">
            <el-input
              v-model="queryParams.displayName"
              placeholder="请输入显示名"
              clearable
              size="small"
              @keyup.enter="getUsers"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :icon="Search" size="small" @click="handleRoleSearch"
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
          <div class="public-tableHead">账号管理</div>
          <div style="display: flex">
            <el-button class="custom_button zc_btn_default" :icon="Plus" @click="handleAdd"
              >新增账号</el-button
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
          <el-table-column prop="userName" label="账号"> </el-table-column>
          <el-table-column prop="displayName" label="显示名"> </el-table-column>
          <el-table-column prop="createtime" label="创建日期">
            <template #default="{ row }">
              {{ formatDateTime(row.createtime) }}
            </template>
          </el-table-column>
          <el-table-column prop="latesttime" label="上次登录日期">
            <template #default="{ row }">
              {{ formatDateTime(row.latesttime) }}
            </template>
          </el-table-column>
          <el-table-column prop="createuser" label="创建人"> </el-table-column>
          <el-table-column label="操作">
            <template #default="{ row }">
              <div style="display: flex; justify-content: center">
                <el-icon
                  v-if="!['clklog', 'admin'].includes(row.userName)"
                  class="edit_btn"
                  @click="handleEdit(row)"
                  ><Edit
                /></el-icon>
                <el-icon
                  v-if="!is_clklog_demo_environment"
                  class="modifypwd_btn"
                  @click="handleEditModifyPwd(row)"
                  ><Key
                /></el-icon>
                <el-icon
                  v-if="!['clklog', 'admin'].includes(row.userName)"
                  class="delete_btn"
                  @click="handleDel(row)"
                  ><Delete
                /></el-icon>
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
      width="850px"
      top="5vh"
      :close-on-click-modal="false"
    >
      <div
        class="public-hoverItem"
        style="min-height: 80px; padding: 2px; font-size: 20px; background-color: #fff"
      >
        <el-tabs v-model="activeName" style="background-color: #fff; padding: 20px">
          <el-tab-pane style="padding-top: 16px" label="账号信息" name="first">
            <el-form
              ref="formRef"
              class="dialog-form"
              :model="form"
              :rules="rules"
              label-width="80px"
            >
              <el-form-item label="账号" prop="userName">
                <el-input
                  v-model="form.userName"
                  size="small"
                  placeholder="请输入账号"
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
              <div class="autofill-trap">
                <input type="text" />
                <input type="password" />
              </div>
              <el-form-item v-if="!form.userId" label="密码" prop="password">
                <el-input
                  v-model="form.password"
                  size="small"
                  placeholder="12-18位，包含大小写字母、数字、数字、特殊字符"
                  :type="passwordType.password"
                  maxlength="18"
                  show-word-limit
                  name="newpassword"
                  :ref="addPasswordRef"
                  autocomplete="off"
                >
                  <template #suffix>
                    <i
                      class="pwd-toggle"
                      :class="passwordType.password === 'password' ? 'iconfont icon-biyan' : 'iconfont icon-yanjing'"
                      @click="showPwd('password', addPasswordRef)"
                    ></i>
                  </template>
                </el-input>
              </el-form-item>
              <el-form-item v-if="!form.userId" label="确认密码" prop="password2">
                <el-input
                  v-model="form.password2"
                  size="small"
                  placeholder="请再次输入新密码"
                  :type="passwordType.password2"
                  maxlength="18"
                  show-word-limit
                  name="password2"
                  :ref="addPassword2Ref"
                  autocomplete="off"
                >
                  <template #suffix>
                    <i
                      class="pwd-toggle"
                      :class="passwordType.password2 === 'password' ? 'iconfont icon-biyan' : 'iconfont icon-yanjing'"
                      @click="showPwd('password2', addPassword2Ref)"
                    ></i>
                  </template>
                </el-input>
              </el-form-item>
            </el-form>
          </el-tab-pane>
          <!-- 账号权限-项目相关角色 -->
          <el-tab-pane style="padding-top: 16px" label="账号权限" name="second">
            <!-- v2 这个表单也写了 ref="form"（与账号信息表单重名），v3 不再给它挂 ref -->
            <el-form class="dialog-form" :model="form" :rules="rules" label-width="80px">
              <!-- 项目相关角色展示逻辑 -->
              <div style="display: flex; align-items: flex-start; margin-bottom: 15px">
                <span class="public-firstHead filterbar-tab-right" style="line-height: 30px"
                  >系统权限：</span
                >
                <el-checkbox-group v-model="form.roleIds">
                  <el-checkbox
                    v-for="role in nonProjectRoles"
                    :key="role.roleId"
                    :disabled="role.roleName === 'default'"
                    :value="role.roleId"
                    >{{ role.displayName }}</el-checkbox
                  >
                </el-checkbox-group>
              </div>

              <span class="public-firstHead">项目权限</span>
              <el-table :data="projectArray" border height="450px" style="margin-top: 15px">
                <el-table-column prop="projectDisplayName" label="项目名称" width="150">
                </el-table-column>
                <el-table-column label="角色选择">
                  <template #default="scope">
                    <el-checkbox-group
                      v-model="selectedProjectRoles"
                      @change="handleProjectRoleChange"
                    >
                      <el-checkbox
                        v-for="role in scope.row.inProjectRoles"
                        :key="role.id"
                        :value="role.id"
                        >{{ role.displayName }}</el-checkbox
                      >
                    </el-checkbox-group>
                  </template>
                </el-table-column>
              </el-table>
            </el-form>
          </el-tab-pane>
        </el-tabs>
        <div style="margin: 20px; display: flex; justify-content: end">
          <!-- v2 这里写的是 slot="footer"，但它不是 el-dialog 的直接子节点，插槽不生效，按钮就渲染在内容里 -->
          <span class="dialog-footer">
            <el-button size="small" type="primary" @click="submit">确 定</el-button>
            <el-button size="small" @click="closeDialog()">取 消</el-button>
          </span>
        </div>
      </div>
    </el-dialog>

    <el-dialog
      v-model="openModifyPwd"
      title="修改密码"
      width="30%"
      top="20vh"
      :close-on-click-modal="false"
    >
      <div
        class="public-hoverItem"
        style="
          min-height: 80px;
          /* background-color: #fbfcfe;
          padding: 16px; */
          padding: 2px;
          /* box-sizing: border-box; */
          font-size: 20px;
          background-color: #fff;
        "
      >
        <el-form
          ref="modifyPwdFormRef"
          class="dialog-form"
          :model="formModifyPwd"
          :rules="modifyPwdRules"
          label-width="80px"
        >
          <div class="autofill-trap">
            <input type="text" />
            <input type="password" />
          </div>
          <el-form-item label="新密码" prop="password">
            <el-input
              v-model="formModifyPwd.password"
              size="small"
              placeholder="12-18位，包含大小写字母、数字、数字、特殊字符"
              :type="modifyPwdType.password"
              maxlength="18"
              show-word-limit
              name="newpassword"
              :ref="modifyPasswordRef"
              autocomplete="off"
            >
              <template #suffix>
                <i
                  class="pwd-toggle"
                  :class="modifyPwdType.password === 'password' ? 'iconfont icon-biyan' : 'iconfont icon-yanjing'"
                  @click="showPwd('password', modifyPasswordRef, 'modifyPwdType')"
                ></i>
              </template>
            </el-input>
          </el-form-item>
          <el-form-item label="确认密码" prop="password2">
            <el-input
              v-model="formModifyPwd.password2"
              size="small"
              placeholder="请再次输入新密码"
              :type="modifyPwdType.password2"
              maxlength="18"
              show-word-limit
              name="password2"
              :ref="modifyPassword2Ref"
              autocomplete="off"
            >
              <template #suffix>
                <i
                  class="pwd-toggle"
                  :class="modifyPwdType.password2 === 'password' ? 'iconfont icon-biyan' : 'iconfont icon-yanjing'"
                  @click="showPwd('password2', modifyPassword2Ref, 'modifyPwdType')"
                ></i>
              </template>
            </el-input>
          </el-form-item>
        </el-form>
        <div style="margin-top: 20px; display: flex; justify-content: end">
          <span class="dialog-footer">
            <el-button size="small" type="primary" @click="submitModifyPwd">确 定</el-button>
            <el-button size="small" @click="closeDialogModifyPwd()">取 消</el-button>
          </span>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
:deep(.el-form-item__error) {
  white-space: normal;
}
.autofill-trap {
  position: absolute;
  left: -9999px;
  top: -9999px;
}
.pwd-toggle {
  cursor: pointer;
  font-size: 16px;
  color: #909399;
  margin-right: 4px;
  &:hover {
    color: #409eff;
  }
}
// 分页样式在 src/styles/index.scss 全局引入一次（sass 不允许 @use 出现在嵌套块里）
// 复选框样式来自 v2 styles/components/el-checkbox.scss，只搬本页用到的部分
:deep(.el-checkbox) {
  width: 100px;
  margin-right: 20px;
  font-size: 13px;
  font-weight: 400;
  line-height: 25px;
  color: #194580;
}

:deep(.el-checkbox__label) {
  font-size: 13px;
  font-weight: 400;
  line-height: 30px;
}

:deep(.el-checkbox__input.is-checked + .el-checkbox__label) {
  color: #194580;
}

:deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3e%3cpath fill='none' stroke='%23fff' stroke-linecap='round' stroke-linejoin='round' stroke-width='3' d='m6 10 3 3 6-6'/%3e%3c/svg%3e");
}

// 隐藏原生勾选样式，使用背景图SVG
:deep(.el-checkbox__inner::after) {
  display: none !important;
}

:deep(.el-checkbox__input.is-disabled.is-checked .el-checkbox__inner) {
  background-color: #2c7be5;
  border-color: #2c7be5;
}

:deep(.el-checkbox__input.is-disabled.is-checked .el-checkbox__inner::after) {
  background-color: none;
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

.modifypwd_btn {
  margin-left: 20px;
  width: 20px;
  height: 20px;
  line-height: 20px;
  border-radius: 2px;
  background: #dde4ed;
  color: #b95593;
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
