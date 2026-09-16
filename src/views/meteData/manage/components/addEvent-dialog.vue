<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { copyObj } from '@/utils/copy'
import { useLatestOnly } from '@/composables/useLatestOnly'
import { useTrackingStore } from '@/stores/tracking'
import { bus } from '@/utils/event-bus'
import { addEventApi, editEventApi, getEventApi } from '@/api/sysmanage/manageEvent'
import type {
  EventPropertyRow,
  MetaEventRow,
  PropertyGroup,
} from '@/api/sysmanage/manageEvent'
import type { FilterOption } from '@/views/meteData/components/fiterbar.vue'

/** 新增 / 修改事件弹框（v2 src/views/meteData/manage/components/addEvent-dialog.vue） */

interface EventRuleForm extends MetaEventRow {
  orderNum: number | string
  propertyIds: string[] | string
  groupName: string
  unit: string
  accuracy: string
  /**
   * 与 v2 的差别：v2 在保存前把 ruleForm.channel 原地改成 "WEB/IOS" 这样的字符串再提交，
   * 这里保持 ruleForm.channel 始终是数组（el-checkbox-group 要求数组），
   * 只在组装请求参数时拼成同样的字符串，发出去的报文完全一致。
   */
  channel: string[]
  triggerOpportunity: string
  remark: string
  displayName: string
  name: string
  isPreset: boolean
  display: boolean
  isAccept: boolean
  tag: string[]
  projectName: string
}

const emit = defineEmits<{
  refreshTableList: []
}>()

const trackingStore = useTrackingStore()
const { next: nextDetail, isLatest: isLatestDetail } = useLatestOnly()

const formRef = ref<FormInstance>()

const selectedIds = ref<string[]>([])
const dialogTitle = ref('新增事件')
const tableList = ref<EventPropertyRow[]>([])
const platformList = [
  { label: 'IOS', value: 'IOS' },
  { value: 'ANDROID', label: 'Android' },
  { label: 'Web', value: 'WEB' },
  { label: '小程序', value: 'MINI_APP' },
  { label: '服务端', value: 'SERVER' },
  { label: 'Other', value: 'OTHER' },
]
const DialogVisible = ref(false)
const propertyList = ref<PropertyGroup[]>([])

const projectName = computed(() => trackingStore.projectName)

function createForm(): EventRuleForm {
  return {
    orderNum: 0,
    propertyIds: [],
    // v2 在这里注释掉了 status: "启用"
    groupName: '',
    unit: '',
    accuracy: '',
    channel: ['WEB'],
    triggerOpportunity: '',
    remark: '',
    displayName: '',
    name: '',
    isPreset: false,
    display: true,
    isAccept: true,
    tag: [],
    projectName: trackingStore.projectName,
  }
}

const ruleForm = ref<EventRuleForm>(createForm())

const rules: FormRules = {
  displayName: [{ required: true, message: '属性名称不能为空', trigger: 'blur' }],
  name: [{ required: true, message: '事件英文名不能为空', trigger: 'blur' }],
  channel: [{ required: true, message: '应用平台不能为空', trigger: 'blur' }],
  propertyIds: [
    {
      required: true,
      message: '关联自定义属性不能为空',
      trigger: 'blur',
    },
  ],
  orderNum: [{ required: true, message: '排序号不能为空', trigger: 'blur' }],
}

const groupList = ref<FilterOption[]>([])
// v2 从筛选条拿到的标签列表：本弹框的标签选择框整段被注释掉，这里只做保存不做展示
const tagList = ref<FilterOption[]>([])
/** 记录上一次级联数据 */
const oldCheckIds = ref<string[]>([])

/* -------------------------------------------------------------------------- */
/* 关联属性表格的拖拽排序                                                       */
/* v2 用的是 sortablejs（Sortable.create(tbody)）；v3 没有这个依赖，             */
/* 这里用等价的原生 HTML5 拖放实现：拖完同样是「重排 tableList + 重算            */
/* selectedIds」，序号列由 Vue 重新渲染（v2 是手动改 DOM 里的 cell.textContent）。*/
/* -------------------------------------------------------------------------- */
let dragTbody: HTMLElement | null = null
let dragFromIndex = -1

function tbodyRows(tbody: HTMLElement) {
  return Array.from(tbody.querySelectorAll<HTMLElement>('tr.el-table__row'))
}

function rowElementOf(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return null
  return target.closest<HTMLElement>('tr.el-table__row')
}

function onDragStart(e: DragEvent) {
  const tbody = dragTbody
  const tr = rowElementOf(e.target)
  if (!tbody || !tr) return
  dragFromIndex = tbodyRows(tbody).indexOf(tr)
  // 与 v2 的 sortablejs 配置同名的样式类
  tr.classList.add('sortable-chosen', 'sortable-drag')
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(dragFromIndex))
  }
}

function onDragOver(e: DragEvent) {
  if (dragFromIndex < 0) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
}

function onDrop(e: DragEvent) {
  const tbody = dragTbody
  if (!tbody || dragFromIndex < 0) return
  e.preventDefault()
  const tr = rowElementOf(e.target)
  if (!tr) return
  const newIndex = tbodyRows(tbody).indexOf(tr)
  const oldIndex = dragFromIndex
  if (newIndex < 0 || newIndex === oldIndex) return
  const list = tableList.value.slice()
  const currRow = list.splice(oldIndex, 1)[0]
  if (!currRow) return
  list.splice(newIndex, 0, currRow)
  tableList.value = list
  const ids: string[] = []
  list.forEach((item) => {
    if (item.propertyId) ids.push(item.propertyId)
  })
  selectedIds.value = ids
}

function onDragEnd() {
  const tbody = dragTbody
  if (tbody) {
    tbodyRows(tbody).forEach((tr) => {
      tr.classList.remove('sortable-chosen', 'sortable-drag')
    })
  }
  dragFromIndex = -1
}

function detachDrag() {
  if (!dragTbody) return
  dragTbody.removeEventListener('dragstart', onDragStart)
  dragTbody.removeEventListener('dragover', onDragOver)
  dragTbody.removeEventListener('drop', onDrop)
  dragTbody.removeEventListener('dragend', onDragEnd)
  dragTbody = null
}

/** 对应 v2 的 initSort()：给表格行挂上拖拽能力（行会被重渲染，所以每次数据变化后重挂一次） */
function initSort() {
  void nextTick(() => {
    const tbody = document.querySelector<HTMLElement>('.zcDrag .el-table__body-wrapper tbody')
    if (!tbody) return
    if (tbody !== dragTbody) {
      detachDrag()
      dragTbody = tbody
      tbody.addEventListener('dragstart', onDragStart)
      tbody.addEventListener('dragover', onDragOver)
      tbody.addEventListener('drop', onDrop)
      tbody.addEventListener('dragend', onDragEnd)
    }
    tbodyRows(tbody).forEach((tr) => {
      tr.draggable = true
    })
  })
}

watch(tableList, () => {
  initSort()
})

function handleCheckboxChange() {}

function protoTypeEvent(list: PropertyGroup[]) {
  propertyList.value = list
}

function subtract(num1: number, num2: number) {
  return Math.abs(num1 - num2) > 1
}

function fileterCascader(val: unknown) {
  if (!val) return
  const values = (Array.isArray(val) ? val : []) as string[]
  if (subtract(values.length, oldCheckIds.value.length)) {
    oldCheckIds.value = values
  } else {
    if (oldCheckIds.value.length > 0 && oldCheckIds.value.length < values.length) {
      values.forEach((item) => {
        if (oldCheckIds.value.indexOf(item) == -1) {
          oldCheckIds.value.push(item)
        }
      })
    } else if (0 < values.length && oldCheckIds.value.length > values.length) {
      oldCheckIds.value.forEach((item, index) => {
        if (values.indexOf(item) == -1) {
          oldCheckIds.value.splice(index, 1)
        }
      })
    } else {
      oldCheckIds.value = JSON.parse(JSON.stringify(values)) as string[]
    }
  }
  const mergeIds = copyObj(oldCheckIds.value)
  const newArray: EventPropertyRow[] = []
  if (mergeIds && mergeIds.length > 0) {
    selectedIds.value = mergeIds
    mergeIds.forEach((item) => {
      propertyList.value.forEach((child) => {
        child.propertyList.forEach((subChild) => {
          if (item == subChild.normalPropertyId) {
            subChild.propertyId = subChild.normalPropertyId
            newArray.push(subChild)
          }
        })
      })
    })
  }
  tableList.value = newArray
}

function deletePrototype(row: EventPropertyRow) {
  const propertyId = row.propertyId
  // 与 v2 一致（v2 此处逻辑存疑：reset() 把 propertyIds 置成了空字符串，
  // 此时 v2 直接调 .filter 会抛异常，这里先兜住非数组的情况）
  const ids = Array.isArray(ruleForm.value.propertyIds) ? ruleForm.value.propertyIds : []
  ruleForm.value.propertyIds = ids.filter((item) => item !== propertyId)
  fileterCascader(ruleForm.value.propertyIds)
}

function showShipTemplate() {
  void ElMessageBox.prompt(`请输入新的类型`, '提示', {
    cancelButtonText: '取消',
    confirmButtonText: '确定',
    customClass: 'reset-message-box',
    inputValidator: (value: string) => {
      //非空验证
      if (!value) {
        return '请输入内容'
      }
      return true
    },
  })
    .then(({ value }) => {
      ruleForm.value.groupName = value
      groupList.value.push({
        value: value,
        label: value,
      })
    })
    .catch(() => {
      ElMessage({
        type: 'info',
        message: '取消输入',
      })
    })
}

function openDialog(title: string, filerList: [FilterOption[], FilterOption[]], data?: MetaEventRow) {
  DialogVisible.value = true
  formRef.value?.resetFields()
  groupList.value = copyObj(filerList[0] || []).filter((item) => item.label != '全部')
  tagList.value = copyObj(filerList[1] || []).filter((item) => item.label != '全部')
  dialogTitle.value = title

  if (title == '修改事件' && data) {
    ruleForm.value = copyObj(data) as EventRuleForm
    if (data.channel) {
      if (typeof data.channel === 'string') {
        if (data.channel.indexOf('/') !== -1) {
          ruleForm.value.channel = data.channel.split('/')
        } else {
          ruleForm.value.channel = data.channel.split(',')
        }
      }
    } else {
      ruleForm.value.channel = []
    }
    const channelArr = Array.isArray(ruleForm.value.channel) ? ruleForm.value.channel : []
    ruleForm.value.channel = channelArr.filter((item) => item != 'Web')
    detaiApiEvent(data.metaEventId)
  } else {
    // 新增事件
    reset()
  }

  tableList.value = []
  initSort()
}

async function saveForm() {
  if (window.globalConfig.is_clklog_demo_environment) {
    // v2 的 $bus.$emit('$demo_event')：演示环境弹提示框，不执行真实操作
    bus.emit('$demo_event')
    return
  }
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  ruleForm.value.propertyIds = selectedIds.value
  if (!ruleForm.value.tag) {
    ruleForm.value.tag = []
  }
  // v2：this.ruleForm.channel.toString().replace(/,/g, "/")
  const params = {
    ...ruleForm.value,
    channel: ruleForm.value.channel.toString().replace(/,/g, '/'),
  }
  if (dialogTitle.value == '修改事件') {
    //编辑事件
    void editEventApi(params).then(() => {
      ElMessage({
        message: '修改成功',
        type: 'success',
      })
      DialogVisible.value = false
      emit('refreshTableList')
    })
  } else {
    // 新增事件
    void addEventApi(params).then((res) => {
      if (res?.code == 200) {
        ElMessage({
          message: '保存成功',
          type: 'success',
          duration: 1000,
        })
        DialogVisible.value = false
        emit('refreshTableList')
      } else {
        ElMessage({
          message: '保存失败',
          type: 'error',
          duration: 1000,
        })
      }
    })
  }
}

function cancleForm() {
  DialogVisible.value = false
  reset()
}

function detaiApiEvent(id?: string) {
  const token = nextDetail()
  getEventApi({ metaEventId: id, projectName: projectName.value })
    .then((res) => {
      if (!isLatestDetail(token)) return
      if (res?.code == 200) {
        tableList.value = []
        void nextTick(() => {
          if (res.data && res.data.eventPropertyExtendList && res.data.eventPropertyExtendList.length > 0) {
            tableList.value = res.data.eventPropertyExtendList || []
            const newArray: string[] = []
            tableList.value.forEach((item) => {
              if (item.propertyId) newArray.push(item.propertyId)
            })
            selectedIds.value = newArray
            oldCheckIds.value = copyObj(newArray)
            ruleForm.value.propertyIds = newArray
          } else {
            ruleForm.value.propertyIds = []
          }
        })
      }
    })
    .catch(() => {
      if (!isLatestDetail(token)) return
      /* 报错已由请求层统一提示 */
    })
}

function reset() {
  ruleForm.value = createForm()
  // 与 v2 一致：reset() 里 propertyIds 被置成空字符串（data() 初值是空数组）
  ruleForm.value.propertyIds = ''
}

onBeforeUnmount(() => {
  detachDrag()
})

// <script setup> 默认对外封闭，父组件通过 ref 调 openDialog() / protoTypeEvent() 必须先 expose
defineExpose({ openDialog, protoTypeEvent })
</script>

<template>
  <div>
    <el-dialog
      v-model="DialogVisible"
      :modal-append-to-body="false"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      top="2vh"
      width="1000px"
      style="height: 100vh; overflow: auto"
      :title="dialogTitle"
      class="add_prototype"
    >
      <div
        style="
          min-height: 76vh;
          overflow: auto;
          background: #fff;
          padding: 20px 20px;
          border-radius: 6px;
        "
      >
        <el-form
          ref="formRef"
          :model="ruleForm"
          :rules="rules"
          label-width="150px"
          class="demo-ruleForm"
        >
          <div v-if="dialogTitle == '新增事件'">
            <el-form-item label="事件显示名" prop="displayName">
              <el-input
                v-model="ruleForm.displayName"
                placeholder="请输入属性名称"
                style="font-size: 12px"
              />
            </el-form-item>
            <el-form-item label="事件英文名" prop="name">
              <el-input
                v-model="ruleForm.name"
                :disabled="dialogTitle != '新增事件'"
                style="font-size: 12px"
                placeholder="只支持英文、数字、下划线且必须以英文字母开头，不可以_结尾"
              />
            </el-form-item>
          </div>
          <div v-else>
            <el-form-item label="事件英文名" prop="name">
              <el-input
                v-model="ruleForm.name"
                :disabled="dialogTitle != '新增事件'"
                style="font-size: 12px"
                placeholder="只支持英文、数字、下划线且必须以英文字母开头，不可以_结尾"
              />
            </el-form-item>
            <el-form-item label="事件显示名" prop="displayName">
              <el-input
                v-model="ruleForm.displayName"
                placeholder="请输入属性名称"
                style="font-size: 12px"
              />
            </el-form-item>
          </div>

          <el-form-item label="应埋点平台" prop="channel">
            <div style="display: flex; justify-content: space-between">
              <!-- v2 这里注释掉了「多选的情况下进行禁用操作」的 :disabled / :class，保持一致不迁移 -->
              <el-checkbox-group v-model="ruleForm.channel" @change="handleCheckboxChange">
                <el-checkbox-button
                  v-for="(item, index) in platformList"
                  :key="index"
                  :value="item.value"
                >
                  {{ item.label }}
                </el-checkbox-button>
              </el-checkbox-group>
            </div>
          </el-form-item>
          <el-form-item label="触发时机">
            <el-input
              v-model="ruleForm.triggerOpportunity"
              style="font-size: 12px"
              placeholder="属性事例或说明"
            />
          </el-form-item>
          <el-form-item label="备注">
            <el-input v-model="ruleForm.remark" style="font-size: 12px" placeholder="属性事例或说明" />
          </el-form-item>
          <el-form-item label="排序号" prop="orderNum">
            <el-input v-model="ruleForm.orderNum" style="font-size: 12px" placeholder="必填" />
          </el-form-item>

          <el-form-item label="事件分组">
            <el-select v-model="ruleForm.groupName" placeholder="请选择" style="width: 100%" clearable>
              <el-option
                v-for="item in groupList"
                :key="String(item.value)"
                :label="item.label"
                :value="item.value"
              />
              <!-- v2 是在下拉面板打开时往 popper 里手动 appendChild 一个「新增类型」的 ul，
                   element-plus 直接提供了 footer 插槽，效果一致 -->
              <template #footer>
                <ul
                  class="el-template-menu__list"
                  style="
                    border-bottom: 2px solid rgb(219 225 241);
                    padding: 0;
                    color: rgb(64 158 255);
                    font-size: 13px;
                    margin: 0px;
                    text-align: center;
                  "
                  @click="showShipTemplate"
                >
                  <li class="el-cascader-node text-center" style="height: 36px; line-height: 36px">
                    <span class="el-cascader-node__label">
                      <el-icon class="font-blue"><Plus /></el-icon>新增类型
                    </span>
                  </li>
                </ul>
              </template>
            </el-select>
          </el-form-item>
          <!-- v2 这里注释掉了「是否预置」一栏，保持一致不迁移 -->
          <el-form-item label="状态">
            <el-radio-group v-model="ruleForm.status">
              <el-radio value="启用">启用</el-radio>
              <el-radio value="禁用">禁用</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="显示状态">
            <el-radio v-model="ruleForm.display" :value="true">显示</el-radio>
            <el-radio v-model="ruleForm.display" :value="false">隐藏</el-radio>
          </el-form-item>

          <!-- v2 这里注释掉了「是否接收」一栏，保持一致不迁移 -->
          <el-form-item label="关联自定义属性" prop="propertyIds">
            <el-cascader
              :key="propertyList.length"
              v-model="ruleForm.propertyIds"
              style="width: 100%"
              placeholder="条件搜索"
              :options="propertyList"
              :show-all-levels="false"
              :props="{
                value: 'normalPropertyId',
                label: 'displayName',
                children: 'propertyList',
                multiple: true,
                emitPath: false,
              }"
              filterable
              collapse-tags
              @change="fileterCascader"
            />
          </el-form-item>
          <div class="">
            <el-table
              row-key="propertyId"
              :data="tableList"
              class="zcDrag public-radius"
              :header-cell-style="{
                textAlign: 'center',
                background: '#f7fafe ',
              }"
              max-height="405px"
              :cell-style="{ textAlign: 'center' }"
              style="width: 100%"
              border
            >
              <el-table-column label="序号" width="80">
                <template #default="scope">
                  {{ scope.$index + 1 }}
                </template>
              </el-table-column>
              <el-table-column label="分组" show-overflow-tooltip>
                <template #default="{ row }">
                  {{ row.groupName }}
                </template>
              </el-table-column>
              <el-table-column show-overflow-tooltip label="属性名" width="190">
                <template #default="{ row }">
                  {{ row.displayName }}
                </template>
              </el-table-column>
              <el-table-column label="事件英文名" show-overflow-tooltip>
                <template #default="{ row }">
                  {{ row.name }}
                </template>
              </el-table-column>
              <el-table-column label="类型" show-overflow-tooltip>
                <template #default="{ row }">
                  {{ row.dataType }}
                </template>
              </el-table-column>
              <el-table-column label="属性类型" show-overflow-tooltip>
                <template #default="{ row }">
                  {{ row.type }}
                </template>
              </el-table-column>
              <el-table-column label="说明" show-overflow-tooltip>
                <template #default="{ row }">
                  {{ row.remark }}
                </template>
              </el-table-column>

              <el-table-column prop="pv" label="操作" align="left" width="130">
                <template #default="{ row }">
                  <div class="zc_delete" @click="deletePrototype(row)">删除</div>
                </template>
              </el-table-column>
            </el-table>
          </div>

          <!-- v2 这里注释掉了「网页代码示例」整块，保持一致不迁移 -->
        </el-form>
      </div>
      <div
        style="
          display: flex;
          justify-content: center;
          padding: 0 20px;
          height: 50px;
          background: #fff;
          box-sizing: border-box;
          border-radius: 0 0 6px 6px;
        "
      >
        <el-button class="custom_button" @click="saveForm">保存</el-button>
        <el-button class="zc_btn_default" style="margin-left: 20px" @click="cancleForm">
          取消
        </el-button>
      </div>
    </el-dialog>
  </div>
</template>

<style>
.el-cascader-node__label {
  margin-left: 10px;
}

/* 这个样式针对IE有用，不考虑IE的可以不用管*/
.el-cascader-panel .el-cascader-node__postfix {
  top: 10px;
}

.el-scrollbar__wrap {
  overflow: initial !important;
  overflow-y: auto !important;
}

.el-cascader-menu {
  min-width: 300px !important;
}
</style>

<style lang="scss" scoped>
/* 被选中项的css 类名 */
.sortable-chosen {
  background-color: #7aa4e0 !important;
}

.sortable-drag {
  background-color: #7aa4e0 !important;
}

.sortable-ghost {
  opacity: 0.4;
  box-shadow: 10px 0px 12px 0 rgba(0, 0, 0, 0.7);
}

:deep() {
  .el-table--enable-row-transition .el-table__body td {
    cursor: move;
  }

  .el-cascader-panel {
    height: 315px;
    border-radius: 4px;
  }

  .el-scrollbar__wrap {
    overflow: initial !important;
  }

  .el-dialog {
    border-radius: 6px;
  }

  .el-dialog__body {
    padding: 30px 50px;
  }

  .el-dialog__title {
    font-size: 15px;
    font-weight: 600;
    line-height: 25px;
    color: #4d4d4d;
  }

  .el-form-item__label {
    font-size: 15px;
    font-weight: 500;
    color: #4d4d4d;
  }

  // 禁用状态下的选中项样式
  .custom-checkbox-group {
    .el-checkbox-button.is-checked .el-checkbox-button__inner {
      background-color: #f2f6fc;
      color: #c0c4cc;
    }
  }

}

.zc_delete:hover {
  color: #6ba3ed;
}

.zc_delete {
  display: flex;
  justify-content: center;
  cursor: pointer;
  color: #2c7be5;
}

.ad-h1 {
  margin: 50px 0 30px 0;
  font-size: 15px;
  font-weight: 500;
  color: #4d4d4d;
}

.copy_button {
  height: 30px;
  color: #194580;
  font-size: 13px;
  background-color: #fff;
  margin-top: 20px;
  margin-bottom: 20px;
}

.add_prototype {
  .custom_button {
    height: 30px;
    color: #fff;
    font-size: 13px;
    background-color: #2c7be5;
  }

  .gp-item-title {
    font-size: 15px;
    font-weight: 500;
    color: #4d4d4d;
  }
}
</style>
