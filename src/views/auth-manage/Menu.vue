<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import {
  ElMessage,
  ElMessageBox,
  type FormInstance,
  type FormRules,
  type TreeInstance,
} from 'element-plus'
import {
  addMenu,
  deleteMenu,
  editMenu,
  getMenu as getMenuApi,
  loadMenu,
  type MenuTreeNodeData,
} from '@/api/authmanage/menu'
import { getRoleList, type RoleRow } from '@/api/authmanage/role'
import { getAppListPage, type AppRow } from '@/api/authmanage/application'
import TreeRender from './TreeRender.vue'
import { copyObj } from '@/utils/copy'
import { bus } from '@/utils/event-bus'
import { useLatestOnly } from '@/composables/useLatestOnly'

/**
 * el-tree 的 Node，这里只用到 parent / data，按需最小声明。
 * TreeRender.vue 里有一份结构相同的声明：`<script setup>` 不能 export 类型，两边各留一份。
 */
interface TreeNodeLike {
  data: MenuTreeNodeData | MenuTreeNodeData[]
  parent: TreeNodeLike | null
}

/**
 * el-radio 的 update:modelValue 类型是 string | number | boolean | undefined，
 * 字段类型必须能接住它（运行时这几个字段始终是 boolean）。
 */
type RadioValue = string | number | boolean | undefined

// 用 type 而不是 interface：interface 没有隐式索引签名，
// Object.assign 出来的 para 就传不进 `Record<string, unknown>` 的接口入参
type MenuFormModel = {
  menuId?: string
  name: string
  componentUri: string
  component: string
  icon: string
  path: string
  appId: string
  parentMenuId: string
  /** el-checkbox-group 回填的是 (string | number)[]，运行时是角色 id 字符串数组 */
  roles: (string | number)[]
  hidden: RadioValue
  externalLink: RadioValue
  orderNumber: string | number
  perms: string
  /** 接口权限字符串 */
  methods: string
}

type MenuFormName = 'addMenuForm' | 'editMenuForm'

const { next: nextTree, isLatest: isLatestTree } = useLatestOnly()
const { next: nextRoles, isLatest: isLatestRoles } = useLatestOnly()
const { next: nextApps, isLatest: isLatestApps } = useLatestOnly()
const { next: nextMenu, isLatest: isLatestMenu } = useLatestOnly()
const { next: nextSubmit, isLatest: isLatestSubmit } = useLatestOnly()

const menuCategoryTreeRef = ref<TreeInstance>()
const addMenuFormRef = ref<FormInstance>()
const editMenuFormRef = ref<FormInstance>()

const allRoles = ref<RoleRow[]>([])
const appId = ref('')
const apps = ref<AppRow[]>([])
const menuCategoryTree = ref<MenuTreeNodeData[]>([])
const defaultExpandedKeys = ref<string[]>([''])
const defaultProps = {
  children: 'children',
  label: 'name',
}
/* 触发的当前的节点，放到全局，方便调用 */
const triggerCurrenNodeData = ref<MenuTreeNodeData>({})
/* 触发的当前节点（v2 只存不读，这里同样只做保存） */
const triggerCurrenNode = ref<unknown>({})
/* 新增事件弹窗的输入框数据 */
const addMenudialogVisible = ref(false)
const addMenuForm = ref<MenuFormModel>({
  name: '',
  componentUri: '',
  component: '',
  icon: '',
  path: '',
  appId: '',
  parentMenuId: '',
  roles: [],
  hidden: false,
  externalLink: false,
  orderNumber: 0,
  perms: '',
  methods: '', // 接口权限字符串
})
const editMenuForm = ref<MenuFormModel>({
  menuId: '',
  name: '',
  componentUri: '',
  component: '',
  icon: '',
  path: '',
  appId: '',
  parentMenuId: '',
  roles: [],
  hidden: false,
  orderNumber: 0,
  perms: '',
  externalLink: false,
  methods: '', // 接口权限字符串
})
const addMenuRules: FormRules<MenuFormModel> = {
  name: [{ required: true, message: '请输入菜单', trigger: 'blur' }],
}
const editMenuRules: FormRules<MenuFormModel> = {
  name: [{ required: true, message: '请输入菜单', trigger: 'blur' }],
}
const loading = ref(false)
const treeLoading = ref(false)

function getFormByName(formName: MenuFormName) {
  return formName === 'addMenuForm' ? addMenuForm.value : editMenuForm.value
}

/* 格式化接口权限用于回显展示，将逗号替换为换行符 */
function formatMethodsForDisplay(methods: string) {
  if (!methods) return ''
  methods = methods.replace(/\r\n/g, '\n')
  methods = methods.replace(/,+\s*/g, '\n')
  methods = methods
    .split('\n')
    .map((item) => item.trim().replace(/,+\s*$/g, ''))
    .filter((item) => item)
    .join('\n')
  return methods
}

/* 清理接口权限文本，去除空格和换行符 */
function cleanMethodsText(methods: string) {
  if (!methods) return ''
  methods = methods.replace(/\r?\n+/g, ',')
  methods = methods.replace(/\s+/g, '')
  methods = methods.replace(/,+/g, ',')
  methods = methods.replace(/^,|,$/g, '')
  return methods
}

function setAppId(id: string) {
  appId.value = id
  addMenuForm.value.appId = id
  editMenuForm.value.appId = id
}

function getMenu(s: unknown, d: MenuTreeNodeData, n: unknown) {
  if (d.menuId != '') {
    loading.value = true
    const para = { menuId: d.menuId }
    const token = nextMenu()

    getMenuApi(para)
      .then((res) => {
        if (!isLatestMenu(token)) return
        loading.value = false

        if (res?.code == 200 && res.data) {
          // v2 只判了 code == 200，data 的存在性由 TS 这里额外兜一层
          editMenuForm.value = res.data
          // 回显时将逗号替换为换行符，便于查看
          editMenuForm.value.methods = formatMethodsForDisplay(editMenuForm.value.methods)
          triggerCurrenNodeData.value = d
          triggerCurrenNode.value = n
        } else {
          const msg = res?.code == 200 ? '成功' : res?.msg
          const type = res?.code == 200 ? 'success' : 'warning'
          ElMessage({
            message: msg,
            type: type,
          })
        }
      })
      .catch(() => {
        // v2 无 catch，报错时 loading 会一直转，这里补上（报错提示由请求层统一给）
        if (!isLatestMenu(token)) return
        loading.value = false
      })
  } else {
    editMenuFormRef.value?.resetFields()
  }
}

function selectFirstMenuNode() {
  const tree = menuCategoryTreeRef.value
  const data = menuCategoryTree.value
  if (!tree || !Array.isArray(data) || data.length === 0) return

  const findFirstSelectable = (list?: MenuTreeNodeData[]): MenuTreeNodeData | null => {
    if (!Array.isArray(list) || list.length === 0) return null
    for (const item of list) {
      if (item && item.menuId && item.menuId !== '') return item
      const child = findFirstSelectable(item && item.children)
      if (child) return child
    }
    return null
  }

  const first = findFirstSelectable(data)
  if (!first || !first.menuId) return

  tree.setCurrentKey(first.menuId)
  const node = tree.getNode(first.menuId)
  getMenu(null, first, node)
}

function loadRoles() {
  const token = nextRoles()
  getRoleList({ includeSysAdmin: true })
    .then((res) => {
      if (!isLatestRoles(token)) return
      if (res?.code != 200) return
      allRoles.value = res.data ?? []
    })
    .catch(() => {
      /* 报错提示由请求层统一给 */
    })
}

function loadTreeData() {
  const para = {
    appId: appId.value,
  }
  const token = nextTree()
  treeLoading.value = true
  loadMenu(para)
    .then((res) => {
      if (!isLatestTree(token)) return
      if (res?.code != 200) return
      menuCategoryTree.value = res.data ?? []
      void nextTick(() => {
        selectFirstMenuNode()
      })
    })
    .catch(() => {
      if (!isLatestTree(token)) return
      treeLoading.value = false
    })
    .finally(() => {
      if (!isLatestTree(token)) return
      treeLoading.value = false
    })
  loadRoles()
}

function appSelectChange(item: string) {
  setAppId(item)
  loadTreeData()
}

function loadApp() {
  const para = {
    pageSize: 100,
    pageIndex: 1,
  }
  const token = nextApps()
  getAppListPage(para)
    .then((res) => {
      if (!isLatestApps(token)) return
      if (res?.code != 200) return
      apps.value = res.data?.rows ?? []
      const firstApp = apps.value[0]
      if (apps.value.length > 0 && firstApp?.appId) {
        setAppId(firstApp.appId)
        loadTreeData()
      }
    })
    .catch(() => {
      /* 报错提示由请求层统一给 */
    })
}

/* 树形控件添加节点，添加弹窗出现 */
function appendMenu(s: unknown, d: MenuTreeNodeData, n: unknown) {
  addMenudialogVisible.value = true
  triggerCurrenNodeData.value = d
  triggerCurrenNode.value = n
  addMenuForm.value.roles = []
  addMenuForm.value.parentMenuId = d.menuId ?? ''
}

/* 树形控件删除节点 */
function removeMenu(s: unknown, d: MenuTreeNodeData, n: TreeNodeLike) {
  const parent = n.parent
  if (!parent) return
  // 与 v2 一致：v2 写的是 parent.data.children || parent.data，根节点的 parent.data 本身就是数组
  const parentData = parent.data
  const children: MenuTreeNodeData[] = Array.isArray(parentData)
    ? parentData
    : (parentData.children ?? [])
  const index = children.findIndex((data) => data.menuId === d.menuId)
  ElMessageBox.confirm('确认删除' + ` "` + (d.name || '该节点') + `" ` + '吗?', '温馨提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    cancelButtonClass: 'custom-cancel-button',
    type: 'warning',
  })
    .then(() => {
      const token = nextSubmit()
      deleteMenu({ menuId: d.menuId })
        .then((res) => {
          if (!isLatestSubmit(token)) return
          if (res?.data) {
            children.splice(index, 1)
            bus.emit('$updateMenu')
            ElMessage({
              message: '删除成功',
              type: 'success',
            })
          } else {
            ElMessage({
              type: 'info',
              message: '删除失败',
            })
          }
        })
        .catch(() => {
          /* 报错提示由请求层统一给 */
        })
    })
    // v2 没接 catch，点「取消」会产生一次未捕获的 reject
    .catch(() => {})
}

/* 节点新增，新增树形菜单事件分类弹窗，提交按钮 */
async function addMenuFormSubmitBtn() {
  const valid = await addMenuFormRef.value?.validate().catch(() => false)
  if (!valid) return
  const confirmed = await ElMessageBox.confirm('确认提交吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    cancelButtonClass: 'custom-cancel-button',
  }).catch(() => false)
  if (!confirmed) return
  if (window.globalConfig.is_clklog_demo_environment) {
    // v2 的 $bus.$emit('$demo_event')：演示环境弹提示框，不执行真实操作
    bus.emit('$demo_event')
    return
  }
  loading.value = true
  const para: Record<string, unknown> = Object.assign({}, addMenuForm.value)
  // 清理接口权限文本，去除空格和换行符
  para.methods = cleanMethodsText(addMenuForm.value.methods)
  const token = nextSubmit()
  addMenu(para)
    .then((res) => {
      if (!isLatestSubmit(token)) return
      loading.value = false
      const msg = res?.data ? '添加成功' : res?.msg
      const type = res?.data ? 'success' : 'warning'
      ElMessage({
        message: msg,
        type: type,
      })
      if (res?.code == 200) {
        const result: MenuTreeNodeData = {
          menuId: res.data?.id,
          name: addMenuForm.value.name,
          children: [],
          parentMenuId: addMenuForm.value.parentMenuId,
        }
        /* 点击弹窗的确定按钮可以得到输入的数据，作为新的节点名称插入 */
        /* 如果没有子节点，就创建一个子节点插入（v2 用的是 this.$set，Vue3 直接赋值即可） */
        const nodeData = triggerCurrenNodeData.value
        if (!nodeData.children) {
          nodeData.children = []
        }
        // 注意要重新读一次 children：赋值表达式拿到的是原始数组，
        // 只有经过响应式代理读出来的那个才会在 push 时触发树更新
        const children = nodeData.children
        // 如果已有子节点，就把返回的数据 push 进去，插入到树形数据中
        children.push(result)
      }
      /* 关闭弹窗，重置输入框 */
      addMenudialogVisible.value = false
      addMenuFormRef.value?.resetFields()

      bus.emit('$updateMenu')
    })
    .catch(() => {
      if (!isLatestSubmit(token)) return
      loading.value = false
    })
}

async function editMenuFormSubmitBtn() {
  const valid = await editMenuFormRef.value?.validate().catch(() => false)
  if (!valid) return
  const confirmed = await ElMessageBox.confirm('确认提交吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    cancelButtonClass: 'custom-cancel-button',
    type: 'warning',
  }).catch(() => false)
  if (!confirmed) return
  if (window.globalConfig.is_clklog_demo_environment) {
    bus.emit('$demo_event')
    return
  }
  loading.value = true
  const para: Record<string, unknown> = Object.assign({}, editMenuForm.value)
  // 清理接口权限文本，去除空格和换行符
  para.methods = cleanMethodsText(editMenuForm.value.methods)
  const token = nextSubmit()
  editMenu(para)
    .then((res) => {
      if (!isLatestSubmit(token)) return
      loading.value = false
      const msg = res?.data ? '编辑成功' : res?.msg
      const type = res?.data ? 'success' : 'warning'
      // 保存后通知顶栏刷新侧栏菜单（Navbar 里 bus.on('$updateMenu')）
      bus.emit('$updateMenu')
      ElMessage({
        message: msg,
        type: type,
      })
      if (res?.data) {
        triggerCurrenNodeData.value.name = editMenuForm.value.name
      }
    })
    .catch(() => {
      if (!isLatestSubmit(token)) return
      loading.value = false
    })
    .finally(() => {
      if (!isLatestSubmit(token)) return
      loading.value = false
    })
}

/* 处理接口权限失去焦点事件 */
function handleMethodsBlur(formName: MenuFormName) {
  const target = getFormByName(formName)
  if (!target) return
  let methods = copyObj(target.methods || '')
  methods = methods.replace(/\r\n/g, '\n')
  // 开启空格
  // methods = methods.replace(/([^\s\n])\s+([^\s\n])/g, "$1\n$2");
  const lines = methods.split('\n').map((l) => {
    return l.replace(/\s+$/g, '').replace(/,+\s*$/g, '')
  })
  target.methods = lines.join('\n')
}

/* 处理接口权限回车事件（el-input 的 keydown 声明成 KeyboardEvent | Event，这里按 Event 收） */
function handleMethodsEnter(event: Event, formName: MenuFormName) {
  const input = event.target
  const target = getFormByName(formName)
  if (!(input instanceof HTMLTextAreaElement) || !target) return
  const pos = input.selectionStart
  if (pos === undefined || pos === null) return
  const methods = target.methods || ''

  const insertText = '\n'

  const before = methods.substring(0, pos)
  const after = methods.substring(pos)
  let updated = before + insertText + after
  updated = updated.replace(/\r\n/g, '\n')
  // 开启空格
  // updated = updated.replace(/([^\s\n])\s+([^\s\n])/g, "$1\n$2");
  target.methods = updated

  void nextTick(() => {
    const newPos = pos + insertText.length
    try {
      input.selectionStart = input.selectionEnd = newPos
    } catch {
      /* 与 v2 一致：忽略设置光标失败 */
    }
  })
  event.preventDefault()
}

/* 处理接口权限输入事件（v2 函数体就是空的） */
function handleMethodsInput(_value: string, _formName: MenuFormName) {}

// v2 还有一个 handleMethodsFocus（光标前后无空白时插入一个空格），模板里没有任何地方绑定，
// 属于死代码，未迁移。

onMounted(() => {
  loadApp()
})

// v2 的 beforeDestroy 里是 this.$bus.$off(["$updateMenu"])，
// 那是把「所有」$updateMenu 监听都摘掉（包括 Navbar 自己注册的那个），离开菜单页后侧栏就再也刷新不了。
// 本组件并没有注册 $updateMenu 监听，这里没有需要清理的东西，故不做 off。
</script>

<template>
  <div>
    <div class="documentation-container">
      <div class="search-area">
        <el-form size="small" :inline="true" label-width="68px">
          <el-select
            v-model="appId"
            placeholder="请选择应用"
            size="small"
            @change="appSelectChange"
          >
            <!-- value 是必填 prop，appId 类型上可空，这里兜一个空串 -->
            <el-option
              v-for="item in apps"
              :key="item.appId"
              :label="item.appName"
              :value="item.appId ?? ''"
              size="small"
            >
            </el-option>
          </el-select>
        </el-form>
      </div>
    </div>
    <div class="public-block">
      <div class="block-main public-hoverItem logCon" style="min-height: 200px">
        <div class="public-tableHead">菜单权限管理</div>
        <el-row class="menu-row">
          <div class="menu-tree">
            <div
              v-loading="treeLoading"
              style="max-height: 800px; width: 310px; overflow-y: auto"
            >
              <el-tree
                ref="menuCategoryTreeRef"
                :data="menuCategoryTree"
                :props="defaultProps"
                node-key="menuId"
                highlight-current
                :expand-on-click-node="false"
                :default-expanded-keys="defaultExpandedKeys"
              >
                <!-- v2 用的是 :render-content="renderContent" + h(TreeRender)，v3 换成官方推荐的 #default 插槽 -->
                <template #default="{ node, data }">
                  <TreeRender
                    :NODE="node"
                    :DATA="data"
                    :STORE="null"
                    @append="appendMenu"
                    @delete="removeMenu"
                    @watch-info="getMenu"
                  />
                </template>
              </el-tree>
            </div>
          </div>
          <div
            v-if="menuCategoryTree && menuCategoryTree.length > 0"
            v-loading="loading"
            class="menu-form"
            style="max-height: 800px; overflow-y: auto"
          >
            <el-form
              ref="editMenuFormRef"
              class="dialog-form"
              label-width="110px"
              :model="editMenuForm"
              :rules="editMenuRules"
            >
              <el-form-item label="菜单名称" prop="name">
                <el-input v-model="editMenuForm.name" size="small"></el-input>
              </el-form-item>
              <el-form-item label="路由地址" prop="path">
                <el-input v-model="editMenuForm.path" size="small"></el-input>
              </el-form-item>
              <el-form-item label="组件地址" prop="componentUri">
                <el-input v-model="editMenuForm.componentUri" size="small"></el-input>
              </el-form-item>
              <el-form-item label="组件名称" prop="component">
                <el-input v-model="editMenuForm.component" size="small"></el-input>
              </el-form-item>
              <el-form-item label="接口权限" prop="methods">
                <div class="methods-header">
                  <el-input
                    v-model="editMenuForm.methods"
                    type="textarea"
                    :rows="7"
                    class="gm-input-01"
                    placeholder="请填写接口权限，多个接口请用回车换行分隔，支持通配符
示例：/user/add"
                    @input="handleMethodsInput($event, 'editMenuForm')"
                    @blur="handleMethodsBlur('editMenuForm')"
                    @keydown.enter="handleMethodsEnter($event, 'editMenuForm')"
                  />
                  <span
                    v-if="
                      (editMenuForm.methods || '').split('\n').filter((line) => line.trim())
                        .length > 0
                    "
                    class="methods-count"
                    >共
                    {{
                      (editMenuForm.methods || '').split('\n').filter((line) => line.trim())
                        .length
                    }}
                    行</span
                  >
                </div>
              </el-form-item>
              <!-- <el-form-item label="权限标识" prop="perms">
                <el-input size="small" v-model="editMenuForm.perms"></el-input>
              </el-form-item> -->
              <el-form-item label="svg图标名" prop="icon">
                <el-input v-model="editMenuForm.icon" size="small"></el-input>
              </el-form-item>
              <el-form-item label="是否隐藏">
                <el-radio v-model="editMenuForm.hidden" size="small" :value="true">是</el-radio>
                <el-radio v-model="editMenuForm.hidden" size="small" :value="false">否</el-radio>
              </el-form-item>
              <el-form-item label="是否打开新窗口">
                <el-radio v-model="editMenuForm.externalLink" size="small" :value="true"
                  >是</el-radio
                >
                <el-radio v-model="editMenuForm.externalLink" size="small" :value="false"
                  >否</el-radio
                >
              </el-form-item>
              <el-form-item label="顺序号" prop="path">
                <el-input v-model="editMenuForm.orderNumber" size="small"></el-input>
              </el-form-item>
              <el-form-item label="访问角色">
                <el-checkbox-group v-model="editMenuForm.roles" size="small">
                  <el-checkbox v-for="role in allRoles" :key="role.roleId" :value="role.roleId">{{
                    role.displayName
                  }}</el-checkbox>
                </el-checkbox-group>
              </el-form-item>
            </el-form>
            <div style="float: right">
              <el-button class="zc_btn" @click="editMenuFormSubmitBtn()">保存</el-button>
            </div>
          </div>
        </el-row>
      </div>
    </div>
    <!--新增事件节点分类弹窗-->
    <el-dialog v-model="addMenudialogVisible" title="新增菜单" class="add-menu-dialog">
      <div style="background: #fff; padding: 20px 20px; border-radius: 4px">
        <el-form
          ref="addMenuFormRef"
          class="dialog-form"
          label-width="110px"
          :model="addMenuForm"
          :rules="addMenuRules"
        >
          <el-form-item label="菜单名称" prop="name">
            <el-input v-model="addMenuForm.name" size="small"></el-input>
          </el-form-item>
          <el-form-item label="路由地址" prop="path">
            <el-input v-model="addMenuForm.path" size="small"></el-input>
          </el-form-item>
          <el-form-item label="组件路径" prop="componentUri">
            <el-input v-model="addMenuForm.componentUri" size="small"></el-input>
          </el-form-item>
          <el-form-item label="组件名称" prop="component">
            <el-input v-model="addMenuForm.component" size="small"></el-input>
          </el-form-item>
          <el-form-item label="接口权限" prop="methods">
            <div class="methods-header">
              <el-input
                v-model="addMenuForm.methods"
                type="textarea"
                :rows="7"
                class="gm-input-01"
                placeholder="请填写接口权限，多个接口请用回车换行分隔，支持通配符
示例：/user/add"
                @blur="handleMethodsBlur('addMenuForm')"
                @keydown.enter="handleMethodsEnter($event, 'addMenuForm')"
              />
              <span
                v-if="
                  (addMenuForm.methods || '').split('\n').filter((line) => line.trim()).length > 0
                "
                class="methods-count"
                >共
                {{
                  (addMenuForm.methods || '').split('\n').filter((line) => line.trim()).length
                }}
                行</span
              >
            </div>
          </el-form-item>
          <!-- <el-form-item label="权限标识" prop="perms">
            <el-input size="small" v-model="addMenuForm.perms"></el-input>
          </el-form-item> -->
          <el-form-item label="svg图标名" prop="icon">
            <el-input v-model="addMenuForm.icon" size="small"></el-input>
          </el-form-item>
          <el-form-item label="是否隐藏">
            <el-radio v-model="addMenuForm.hidden" size="small" :value="true">是</el-radio>
            <el-radio v-model="addMenuForm.hidden" size="small" :value="false">否</el-radio>
          </el-form-item>
          <!-- 与 v2 一致（v2 此处逻辑存疑：新增弹窗里的「是否打开新窗口」绑的是 editMenuForm.externalLink，
               不是 addMenuForm.externalLink，新增时这个开关不会写进新增表单） -->
          <el-form-item label="是否打开新窗口">
            <el-radio v-model="editMenuForm.externalLink" size="small" :value="true">是</el-radio>
            <el-radio v-model="editMenuForm.externalLink" size="small" :value="false">否</el-radio>
          </el-form-item>
          <!-- 与 v2 一致（v2 此处逻辑存疑：顺序号的 prop 写的是 path） -->
          <el-form-item label="顺序号" prop="path">
            <el-input v-model="addMenuForm.orderNumber" size="small"></el-input>
          </el-form-item>
          <el-form-item label="访问角色">
            <el-checkbox-group v-model="addMenuForm.roles">
              <el-checkbox
                v-for="role in allRoles"
                :key="role.roleId"
                size="small"
                :value="role.roleId"
                >{{ role.displayName }}</el-checkbox
              >
            </el-checkbox-group>
          </el-form-item>
        </el-form>
        <!-- v2 这里写的是 slot="footer"，但它不是 el-dialog 的直接子节点，插槽不生效，按钮就渲染在内容里 -->
        <span class="dialog-footer" style="display: flex; justify-content: flex-end">
          <el-button class="zc_btn" @click="addMenuFormSubmitBtn()">确 定</el-button>
          <el-button
            class="zc_btn_default filterbar-tab-right"
            @click="addMenudialogVisible = false"
            >取 消</el-button
          >
        </span>
      </div>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
// 分页样式在 src/styles/index.scss 全局引入一次（sass 不允许 @use 出现在嵌套块里）
// 复选框样式来自 v2 styles/components/el-checkbox.scss，只搬本页用到的部分
:deep(.el-checkbox) {
  width: 100px;
  margin-right: 80px;
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

:deep(.el-tree) {
  font-size: 14px;
  color: #4d4d4d;
}

:deep(.el-tree-node__content) {
  position: relative;
}

:deep(.el-textarea__inner) {
  font-size: 12px;
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
  padding: 20px;
  background-color: #eef4fd;
  border-radius: 6px;
}

:deep(.el-input--small .el-input__inner) {
  font-size: 12px;
}

.menu-row {
  display: flex !important;

  .menu-tree {
    height: 800px;
    width: 300px;
  }

  .menu-form {
    width: calc(100% - 300px);
    height: 800px;
    margin-left: 50px;
  }
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

/* 接口权限区域样式 */
.methods-header {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.methods-count {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
  text-align: right;
}
</style>
