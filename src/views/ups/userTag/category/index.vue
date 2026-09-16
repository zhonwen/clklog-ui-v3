<script setup lang="ts">
/**
 * 标签分类管理（对应 v2 src/views/ups/userTag/category/index.vue）。
 *
 * element-plus 适配要点：
 *   :render-content（JSX + on-click）→ el-tree 的默认作用域插槽 #default="{ node, data }"
 *   el-icon-plus / delete / sort     → @element-plus/icons-vue 组件
 *   type="text"                      → link
 *   :visible.sync                    → v-model
 *   this.$refs.formref.validate(cb)  → formRef.value?.validate((valid) => ...)
 */
import { computed, onMounted, ref, watch } from 'vue'
import { Delete, Plus, Sort } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import type Node from 'element-plus/es/components/tree/src/model/node'
import {
  addCategory,
  deleteCategory,
  dragCategory,
  editCategory,
  getListCategory,
} from '@/api/upsapi/categorymanage'
import { copyObj } from '@/utils/copy'
import { useTrackingStore } from '@/stores/tracking'
import { handleTree } from '../local-utils'
import type { CategoryNode } from '../types'

defineOptions({ name: 'CategoryConfig' })

interface CategoryForm {
  id: string | null
  name: string
  sort: number
  parent: string
  remark: string
  children?: CategoryNode[]
  projectName?: string
}

const trackingStore = useTrackingStore()

const tagTree = ref<CategoryNode[]>([])
const defaultProps = {
  children: 'children',
  label: 'name',
}
/** resdata：只用来触发右侧表单显示（v2 里也只读不显示） */
const formView = ref<CategoryNode | null>(null)
/** 用于编辑保存 */
const editForm = ref<CategoryForm>({
  id: '',
  name: '',
  sort: 0,
  parent: '0',
  remark: '',
})
const form = ref<CategoryForm>({
  id: '',
  name: '',
  sort: 0,
  parent: '0',
  remark: '',
})
const queryParams = ref<{ projectName: string | null }>({ projectName: null })

const rules: FormRules = {
  name: [
    { required: true, message: '分类显示名不能为空', trigger: 'blur' },
    {
      min: 2,
      max: 30,
      message: '显示名长度必须介于 2 和 30 之间',
      trigger: 'blur',
    },
  ],
  sort: [{ required: true, message: '排序值不能为空', trigger: 'blur' }],
  remark: [
    { required: false, message: '分类显示名不能为空', trigger: 'blur' },
    {
      min: 0,
      max: 150,
      message: '显示名长度必须介于 2 和 150 之间',
      trigger: 'blur',
    },
  ],
}

const centerDialogVisible = ref(false)
const submitloading = ref(false)
const title = ref('')
const defaultExpandedKeys = ref<string[]>([])

const formref = ref<FormInstance | null>(null)
const formrefV2 = ref<FormInstance | null>(null)

const projectName = computed(() => trackingStore.projectName)

function handleNodeExpand(_data: CategoryNode, node: Node) {
  defaultExpandedKeys.value.push(String(node.key))
}

function removeNodeAndChildrenIds(node: CategoryNode) {
  defaultExpandedKeys.value = defaultExpandedKeys.value.filter((id) => id !== node.id)
  // 如果节点有子节点，递归删除子节点的 ID
  if (node.children) {
    node.children.forEach((child) => {
      removeNodeAndChildrenIds(child)
    })
  }
}

function handleNodeCollapse(data: CategoryNode) {
  removeNodeAndChildrenIds(data)
}

function getList() {
  queryParams.value.projectName = projectName.value
  void getListCategory(queryParams.value).then((response) => {
    formView.value = null
    const data = response?.data as CategoryNode[] | undefined
    if (data) {
      tagTree.value = handleTree(data, 'id', 'parent')
    }
  })
}

function reset() {
  form.value = {
    id: '',
    name: '',
    parent: '0',
    sort: 0,
    remark: '',
  }
  formref.value?.resetFields()
}

function submitSaveFormOne() {
  form.value.projectName = projectName.value
  void formrefV2.value?.validate((valid) => {
    if (valid) {
      submitloading.value = true
      if (editForm.value.children) {
        delete editForm.value.children
      }

      if (editForm.value.id) {
        editCategory(editForm.value as unknown as Record<string, unknown>)
          .then(() => {
            ElMessage({
              message: '保存成功',
              type: 'success',
              duration: 2000,
            })
            getList()
            reset()
            centerDialogVisible.value = false
            submitloading.value = false
          })
          .catch(() => {
            submitloading.value = false
          })
      } else {
        const params = copyObj(editForm.value)
        delete (params as Partial<CategoryForm>).id
        params.projectName = projectName.value
        addCategory(params as unknown as Record<string, unknown>)
          .then(() => {
            ElMessage({
              message: '保存成功',
              type: 'success',
              duration: 2000,
            })

            getList()
            centerDialogVisible.value = false
            submitloading.value = false
          })
          .catch(() => {
            submitloading.value = false
          })
      }
    }
  })
}

function submitSaveForm() {
  form.value.projectName = projectName.value
  void formref.value?.validate((valid) => {
    if (valid) {
      submitloading.value = true
      if (form.value.id) {
        editCategory(form.value as unknown as Record<string, unknown>)
          .then(() => {
            ElMessage({
              message: '保存成功',
              type: 'success',
              duration: 2000,
            })
            editForm.value = copyObj(form.value)
            getList()
            reset()
            centerDialogVisible.value = false
            submitloading.value = false
          })
          .catch(() => {
            submitloading.value = false
          })
      } else {
        // return;
        const params = copyObj(form.value)
        delete (params as Partial<CategoryForm>).id
        addCategory(params as unknown as Record<string, unknown>)
          .then(() => {
            ElMessage({
              message: '保存成功',
              type: 'success',
              duration: 2000,
            })

            getList()
            reset()
            centerDialogVisible.value = false
            submitloading.value = false
          })
          .catch(() => {
            submitloading.value = false
          })
      }
    }
  })
}

// v2 的 handleDragStart / handleDragEnter / handleDragLeave / handleDragOver / handleDragEnd
// 五个回调体内全是注释掉的 console.log，是空实现；模板上也不再绑定，减少噪音。
function handleDrop(draggingNode: Node, dropNode: Node, dropType: string) {
  const draggingData = draggingNode.data as CategoryNode
  const dropData = dropNode.data as CategoryNode
  const dragForm: Record<string, unknown> = {
    id: draggingData.id,
    parent: dropData.parent,
    dropType: dropType,
    dropId: dropData.id,
    projectName: projectName.value,
  }
  if (dropType === 'inner') {
    dragForm.parent = dropData.id
  }
  dragCategory(dragForm)
    .then(() => {
      getList()
    })
    .catch(() => {
      getList()
    })
}

function allowDrop() {
  return true
}

function allowDrag() {
  return true
}

function addRootCategory() {
  title.value = '新建分类'
  form.value = {
    id: '',
    name: '',
    parent: '0',
    sort: 0,
    remark: '',
  }
  form.value.id = null
  form.value.parent = '0'
  centerDialogVisible.value = true
}

function append(data: CategoryNode) {
  title.value = '新建分类'
  form.value = {
    id: '',
    name: '',
    parent: '0',
    sort: 0,
    remark: '',
  }
  form.value.id = null
  form.value.parent = data.id
  centerDialogVisible.value = true
}

// v2 还有一个 update(data)（调 getCategory 回填表单），但它唯一的入口「编辑此分类」按钮
// 在 v2 模板里就是注释掉的，是死代码，这里不再搬运（连带不再 import getCategory）。

function getChildId(data: CategoryNode, ids: string[]) {
  ids.push(data.id)
  if (data.children) {
    for (let i = 0; i < data.children.length; i++) {
      const child = data.children[i]
      if (child) getChildId(child, ids)
    }
  }
}

function remove(node: Node, data: CategoryNode, e: Event) {
  e.stopPropagation() // 阻止冒泡
  const parent = node.parent
  // el-tree 的根节点没有 parent，v2 直接取 parent.data 会抛，这里兜住
  if (!parent) return
  const parentData = parent.data as CategoryNode | CategoryNode[]
  const children = (Array.isArray(parentData) ? parentData : parentData.children) as CategoryNode[]
  const index = children.findIndex((d) => d.id === data.id)

  const ids: string[] = []
  getChildId(data, ids)

  void deleteCategory({ ids: ids, projectName: projectName.value }).then(
    () => {
      children.splice(index, 1)
      getList()
      ElMessage({ message: '删除成功', type: 'success' })
    },
    (err) => {
      console.log(err)
    },
  )
}

function isRemove(node: Node, data: CategoryNode, e: Event) {
  ElMessageBox.confirm('确认删除?,若当前节点存在子节点将会一并删除', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    cancelButtonClass: 'custom-cancel-button',
    type: 'warning',
  })
    .then(() => {
      remove(node, data, e)
    })
    .catch(() => {})
}

function nodeClick(val: CategoryNode) {
  formView.value = copyObj(val) // 触发显示
  const source = val as unknown as Record<string, unknown>
  const target = editForm.value as unknown as Record<string, unknown>
  Object.keys(source).forEach((key) => {
    target[key] = source[key]
  })
}

function beforeClose(done: () => void) {
  reset()
  done()
}

watch(
  projectName,
  () => {
    editForm.value = {
      //用于编辑保存
      id: '',
      name: '',
      sort: 0,
      parent: '0',
      remark: '',
    }
    getList()
  },
  { deep: true },
)

onMounted(() => {
  getList()
})
</script>

<template>
  <div class="public-block">
    <div class="Overview public-hoverItem" style="padding: 25px">
      <div style="display: flex; justify-content: space-between">
        <div class="public-tableHead">标签分类</div>
        <el-button class="addProject" :icon="Plus" @click="addRootCategory">新建分类</el-button>
      </div>
      <div class="pageContent">
        <div class="page-left">
          <el-row>
            <el-tree
              :data="tagTree"
              :props="defaultProps"
              highlight-current
              node-key="id"
              :expand-on-click-node="false"
              :default-expanded-keys="defaultExpandedKeys"
              draggable
              :allow-drop="allowDrop"
              :allow-drag="allowDrag"
              @node-expand="handleNodeExpand"
              @node-collapse="handleNodeCollapse"
              @node-click="nodeClick"
              @node-drop="handleDrop"
            >
              <template #default="{ node, data }">
                <span class="custom-tree-node">
                  <span class="custom-content">{{ node.label }}</span>
                  <span class="extra-content" style="width: 60px; margin-left: 0px">
                    <el-tooltip v-if="node.level < 2" content="添加子分类" placement="top">
                      <el-button size="small" style="font-size: 15px" link @click="append(data)">
                        <el-icon><Plus /></el-icon>
                      </el-button>
                    </el-tooltip>

                    <el-tooltip content="删除此分类" placement="top">
                      <el-button
                        size="small"
                        style="font-size: 15px; color: #f56c6c"
                        link
                        @click="(e: MouseEvent) => isRemove(node, data, e)"
                      >
                        <el-icon><Delete /></el-icon>
                      </el-button>
                    </el-tooltip>
                    <el-tooltip content="可拖拽排序" placement="top">
                      <el-button
                        style="font-size: 15px; color: #2c7be5; cursor: move !important"
                        link
                        size="small"
                      >
                        <el-icon><Sort /></el-icon>
                      </el-button>
                    </el-tooltip>
                    <!-- v2 这里还有一个「编辑此分类」按钮，整段是注释掉的，保持注释状态 -->
                  </span>
                </span>
              </template>
            </el-tree>
          </el-row>
        </div>
        <div class="page-right" style="height: 100%">
          <div class="node-info">
            <el-form ref="formrefV2" :model="editForm" :rules="rules">
              <el-form-item label="分类显示名" prop="name">
                <el-input v-model="editForm.name" placeholder="请输入分类显示名" :readonly="false" />
              </el-form-item>
              <el-form-item label="顺序号" style="font-weight: 400" prop="sort">
                <el-input v-model="editForm.sort" placeholder="请输入排序值" :readonly="false" />
              </el-form-item>
              <el-form-item label="描述" style="font-weight: 400" prop="remark">
                <el-input
                  v-model="editForm.remark"
                  type="textarea"
                  placeholder="请输入描述"
                  :readonly="false"
                />
              </el-form-item>
            </el-form>
            <el-button
              type="primary"
              style="float: right; margin-top: 20px"
              :loading="submitloading"
              @click="submitSaveFormOne"
              >保存</el-button
            >
          </div>
        </div>
      </div>
    </div>
    <el-dialog
      v-model="centerDialogVisible"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :before-close="beforeClose"
      width="50%"
      top="5vh"
      :title="title"
    >
      <div class="dialog-container">
        <el-form ref="formref" :model="form" size="small" :rules="rules" label-width="100px">
          <el-form-item label="分类显示名" prop="name">
            <el-input v-model="form.name" placeholder="请输入分类显示名" />
          </el-form-item>
          <el-form-item label="排序" style="font-weight: 400" prop="sort">
            <el-input-number v-model="form.sort" placeholder="请输入排序值" />
          </el-form-item>
          <el-form-item label="描述" style="font-weight: 400" prop="remark">
            <el-input v-model="form.remark" type="textarea" placeholder="请输入描述" />
          </el-form-item>
        </el-form>
        <el-button type="primary" :loading="submitloading" @click="submitSaveForm">保存</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
/*
 * v2 是 `.el-input--medium .el-input__inner { height: 28px; line-height: 28px }`。
 * element-ui 的 .el-input__inner 本身就是那个带边框的盒子，改它的 height 就等于改整个输入框；
 * element-plus 拆成了 .el-input（外层，高度取 --el-input-height）+ .el-input__inner（里面的裸 input，
 * 高度是 --el-input-inner-height），所以照搬 .el-input__inner 的 height 撑不动外层，
 * 输入框仍是 EP 默认的 32px —— 这就是「分类显示名」输入框和 v2 对不上的原因。
 * EP 的正确写法是改变量。
 */
:deep(.el-input) {
  --el-input-height: 28px;
}

/*
 * v2 是 `.el-form-item--medium .el-form-item__label { line-height: 30px }`，没有设 height，
 * 所以标签高度就等于 30px 的行高；element-plus 额外给了 `height: 32px`，只改 line-height 会留下 32px 的盒子。
 */
:deep(.el-form-item__label) {
  height: auto;
  line-height: 30px;
  font-size: 13px;
}

:deep(.el-form-item) {
  margin-bottom: 22px;
}

:deep(.custom-tree-node) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

:deep(.custom-content) {
  flex: 1 1 auto;
  cursor: pointer;
}

:deep(.extra-content) {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  margin-left: 10px;
}

:deep(.el-tree-node__content) {
  font-size: 14px;
}

:deep(.el-dialog) {
  border-radius: 6px;
}

.pageContent {
  overflow: hidden;
  height: calc(100vh - 50px);
  padding: 8px;

  .page-left {
    float: left;
    width: 300px;
    height: 100%;
    border-radius: 6px;
    background: #fff;
  }

  .page-right {
    border-radius: 6px;
    float: left;
    height: 100%;
    width: calc(100% - 300px - 10px);
    margin-left: 10px;
    left: 231px;
    background-color: #fff;
    box-sizing: border-box;

    .node-info {
      height: 100%;
      width: 100%;
      padding: 0px 25px 0 25px;
    }
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
  margin-bottom: 15px;
  // v2 全局注册的是 element-ui 的 medium 尺寸（main.js: Vue.use(Element, { size: "medium" })），
  // 按钮是 padding: 10px 20px + line-height: 1 → 36px 高；
  // element-plus 没有 medium，v3 注册的是 default —— height: 32px / padding: 8px 15px，明显小一圈。
  // 这里先按 v2 的数值还原本页的「新建分类」按钮；全局尺寸的统一见《05 文档》第 11 节的待拍板项。
  height: 36px;
  padding: 10px 20px;
}
</style>
