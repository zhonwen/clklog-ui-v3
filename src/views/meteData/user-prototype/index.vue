<script setup lang="ts">
import { computed, getCurrentInstance, ref, watch } from 'vue'
import type { CSSProperties } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { Delete, Edit, Plus } from '@element-plus/icons-vue'
import fiterbar from '../components/fiterbar.vue'
import type { FilterOption } from '../components/fiterbar.vue'
import uploadDialog from './components/uploadDialog.vue'
import { copyObj } from '@/utils/copy'
import { filterText, isNoFilter } from '@/utils/format'
import { useLatestOnly } from '@/composables/useLatestOnly'
import { useTrackingStore } from '@/stores/tracking'
import { bus } from '@/utils/event-bus'
import { addApi, deleteApi, editApi, getPageListApi } from '@/api/sysmanage/manageAttribute'
import type { NormalPropertyRow } from '@/api/sysmanage/manageAttribute'

interface PropertyRuleForm extends NormalPropertyRow {
  status: string
  groupName: string
  unit: string
  precisions: number | string
  dataType: string
  remark: string
  displayName: string
  name: string
  type: string
  tag: string[]
  orderNum: number | string
  isPreset: boolean
  projectName: string
}

const proxy = getCurrentInstance()?.proxy
const trackingStore = useTrackingStore()
const { next: nextList, isLatest: isLatestList } = useLatestOnly()

const formRef = ref<FormInstance>()
const uploadDialogRef = ref<{ openDialogEvent: () => void } | null>(null)

const loadingRefresh = ref(false)
const normalPropertyIds = ref('')
const inflag = ref(false)
const tableHeader = ref('新增属性')
const filterBarParams = ref<Record<string, unknown>>({})

const projectName = computed(() => trackingStore.projectName)

function createForm(): PropertyRuleForm {
  return {
    status: '启用',
    groupName: '',
    unit: '',
    precisions: 0,
    dataType: 'STRING',
    remark: '',
    displayName: '',
    name: '',
    type: '用户',
    tag: [],
    orderNum: 0,
    isPreset: false,
    projectName: trackingStore.projectName,
  }
}

const ruleForm = ref<PropertyRuleForm>(createForm())

const intList = [
  {
    value: 0,
    label: '整数',
  },
  {
    value: 1,
    label: '小数点后1位',
  },
  {
    value: 2,
    label: '小数点后2位',
  },
  {
    value: 3,
    label: '小数点后3位',
  },
  {
    value: 4,
    label: '小数点后4位',
  },
  {
    value: 5,
    label: '小数点后5位',
  },
  {
    value: 6,
    label: '小数点后6位',
  },
  {
    value: 7,
    label: '小数点后7位',
  },
]

const rules: FormRules = {
  displayName: [{ required: true, message: '属性名称不能为空', trigger: 'blur' }],
  name: [{ required: true, message: '标识符不能为空', trigger: 'blur' }],
  orderNum: [{ required: true, message: '排序号不能为空', trigger: 'blur' }],
}

const tableList = ref<NormalPropertyRow[]>([])
const pageNum = ref(1)
const pageSize = ref(10)
const total = ref(0)
const DialogVisible = ref(false)
const groupList = ref<FilterOption[]>([])
// v2 从筛选条拿到的标签列表：本页的标签选择框整段被注释掉，这里只做保存不做展示
const tagList = ref<FilterOption[]>([])
const current = ref<{ sortName: string | null; sortOrder: string | null }>({
  sortName: null,
  sortOrder: null,
})

const commonParams = computed<Record<string, unknown>>(() => {
  return Object.assign({ projectName: projectName.value }, filterBarParams.value)
})

function protoTypeApiEvent() {
  loadingRefresh.value = true
  const params = copyObj(commonParams.value)
  params.pageNum = pageNum.value
  params.pageSize = pageSize.value
  params.type = ruleForm.value.type
  params.sortName = current.value.sortName
  params.sortOrder = current.value.sortOrder
  const token = nextList()
  getPageListApi(params)
    .then((res) => {
      if (!isLatestList(token)) return
      if (res?.code == 200) {
        loadingRefresh.value = false
        tableList.value = res.data?.rows || []
        total.value = Number(res.data?.total || 0)
      }
    })
    .catch(() => {
      if (!isLatestList(token)) return
      loadingRefresh.value = false
    })
}

function refreshTableList() {
  // v2 这里还留着一段「val == 'deleteProto' 时重新拉取属性原型」的注释代码，保持一致不迁移
  pageNum.value = 1
  protoTypeApiEvent()
}

function openUploadDialog() {
  uploadDialogRef.value?.openDialogEvent()
}

function sortChange(e: { prop: string; order: string | null }) {
  if (e.order && e.order == 'ascending') {
    current.value.sortName = e.prop
    current.value.sortOrder = 'asc'
  } else if (e.order && e.order == 'descending') {
    current.value.sortName = e.prop
    current.value.sortOrder = 'desc'
  } else {
    current.value.sortName = null
    current.value.sortOrder = null
  }
  protoTypeApiEvent()
}

function handleSelectionChange(val: NormalPropertyRow[]) {
  const metaEventIdArray: (string | undefined)[] = []
  val.forEach((item) => {
    metaEventIdArray.push(item.normalPropertyId)
  })
  normalPropertyIds.value = metaEventIdArray.toString()
}

function handleDemoEvent() {
  // v2 的 $bus.$emit('$demo_event')：演示环境弹提示框，不执行真实操作
  bus.emit('$demo_event')
}

function deleteTableApi() {
  void ElMessageBox.confirm('是否确认删除？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    cancelButtonClass: 'custom-cancel-button',
    type: 'warning',
  })
    .then(function () {
      return deleteApi({
        normalPropertyIds: normalPropertyIds.value,
        projectName: commonParams.value.projectName,
      })
    })
    .then(() => {
      pageNum.value = 1
      protoTypeApiEvent()
      normalPropertyIds.value = ''
      ElMessage({ message: '删除成功', type: 'success' })
    })
    .catch(() => {})
}

function batchDelete() {
  if (window.globalConfig.is_clklog_demo_environment) {
    return handleDemoEvent()
  }
  if (!normalPropertyIds.value) {
    ElMessage({ message: '请选择需要删除的内容', type: 'error' })
    return
  }
  deleteTableApi()
}

function handleDelete(val: NormalPropertyRow) {
  if (window.globalConfig.is_clklog_demo_environment) {
    return handleDemoEvent()
  }
  normalPropertyIds.value = val.normalPropertyId || ''
  deleteTableApi()
}

function showShipTemplate() {
  void ElMessageBox.prompt(`请输入新的类型`, '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
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

function intRefresh() {
  if (ruleForm.value.dataType == 'NUMBER') {
    inflag.value = true
    if (!ruleForm.value.precisions) {
      ruleForm.value.precisions = 0
    }
  } else {
    inflag.value = false
    ruleForm.value.precisions = ''
  }
}

function dataTypeEvent() {
  intRefresh()
}

function setFilterBarParams(
  val: Record<string, unknown> | undefined,
  list: [FilterOption[], FilterOption[]],
) {
  groupList.value = copyObj(list[0] || []).filter((item) => item.label != '全部')
  tagList.value = copyObj(list[1] || []).filter((item) => item.label != '全部')
  // v2 是 copyObj(val)，val 为 undefined 时与 {} 的最终效果一致
  filterBarParams.value = copyObj(val || {})
}

async function saveForm() {
  if (window.globalConfig.is_clklog_demo_environment) {
    return handleDemoEvent()
  }
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  if (ruleForm.value.orderNum) {
    ruleForm.value.orderNum = Number(ruleForm.value.orderNum)
  }
  if (!ruleForm.value.tag) {
    ruleForm.value.tag = []
  }
  if (tableHeader.value == '新建属性') {
    void addApi({ ...ruleForm.value }).then((res) => {
      if (res?.code == 200) {
        ElMessage({
          message: '保存成功',
          type: 'success',
          duration: 1000,
        })
        DialogVisible.value = false
        pageNum.value = 1
        protoTypeApiEvent()
      } else {
        ElMessage({
          message: '保存失败',
          type: 'error',
          duration: 1000,
        })
      }
    })
  } else {
    void editApi({ ...ruleForm.value }).then(() => {
      ElMessage({
        message: '修改成功',
        type: 'success',
      })
      pageNum.value = 1
      DialogVisible.value = false
      protoTypeApiEvent()
    })
  }
}

function cancleForm() {
  DialogVisible.value = false
}

function reset() {
  ruleForm.value = createForm()
}

function handleAddPrototype() {
  tableHeader.value = '新建属性'
  reset()
  intRefresh()
  formRef.value?.resetFields()
  DialogVisible.value = true
}

function handleUpdate(val: NormalPropertyRow) {
  tableHeader.value = '修改属性'
  formRef.value?.resetFields()
  DialogVisible.value = true
  ruleForm.value = copyObj(val) as PropertyRuleForm
  ruleForm.value.type = '用户'
  intRefresh()
}

function getIndex($index: number) {
  return (pageNum.value - 1) * pageSize.value + $index + 1
}

// cell-style 必须返回对象：element-plus 会对返回值做 Object.assign，
// 返回字符串会被拆成 {0:'t',1:'e'...} 并报 Failed to set an indexed property
function tableHeaderColor(): CSSProperties {
  return { textAlign: 'center' }
}

function handleSizeChange(val: number) {
  pageSize.value = val
  protoTypeApiEvent()
}

function handleCurrentChange(val: number) {
  pageNum.value = val
  protoTypeApiEvent()
}

watch(commonParams, () => {
  pageNum.value = 1
  protoTypeApiEvent()
})
</script>

<template>
  <div>
    <fiterbar
      ByGrop
      ByTag
      ByDataType
      BySearchWord
      @set-filter-bar-params="setFilterBarParams"
    />
    <div class="public-block">
      <div v-loading="loadingRefresh" class="block_online block-main public-hoverItem">
        <div class="public-tableHead">用户属性</div>
        <div
          style="
            display: flex;
            margin-bottom: 20px;
            justify-content: space-between;
          "
        >
          <el-button class="zc_btn_default" @click="batchDelete()">批量删除</el-button>
          <div style="display: flex">
            <el-button class="zc_btn_default" @click="handleAddPrototype">
              <el-icon><Plus /></el-icon>新建属性
            </el-button>
            <el-button class="zc_btn_default" @click="openUploadDialog">
              <el-icon><Plus /></el-icon>用户属性批量上传
            </el-button>
          </div>
        </div>
        <el-table
          :data="tableList"
          class="public-radius"
          :header-cell-style="{
            textAlign: 'center',
            background: '#f7fafe ',
          }"
          :cell-style="tableHeaderColor"
          style="width: 100%; min-height: 400px"
          border
          @selection-change="handleSelectionChange"
          @sort-change="sortChange($event)"
        >
          <el-table-column type="selection" fixed width="40" />
          <el-table-column type="index" fixed label="序号" :width="proxy?.$fixedWidth.FwIndex">
            <template #default="scope">
              <div>
                <span v-text="getIndex(scope.$index)"></span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="displayName" label="属性显示名" fixed width="200">
            <template #default="{ row }">
              {{ row.displayName }}
            </template>
          </el-table-column>
          <el-table-column sortable="custom" prop="name" label="属性英文名" fixed width="200" />
          <el-table-column sortable="custom" prop="groupName" label="属性分组" show-overflow-tooltip />
          <el-table-column sortable="custom" prop="status" label="状态" show-overflow-tooltip />
          <el-table-column sortable="custom" prop="display" label="显示状态" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.display ? '显示' : '隐藏' }}
            </template>
          </el-table-column>

          <el-table-column sortable="custom" prop="dataType" label="数据类型" show-overflow-tooltip>
            <template #default="{ row }">
              {{ filterText(row.dataType) }}
            </template>
          </el-table-column>
          <el-table-column sortable="custom" prop="unit" label="单位/格式" show-overflow-tooltip />
          <el-table-column prop="isPreset" sortable="custom" label="预置属性">
            <template #default="{ row }">
              {{ isNoFilter(row.isPreset) }}
            </template>
          </el-table-column>
          <!-- v2 这里注释掉了「标签」一列，保持一致不迁移 -->
          <el-table-column
            sortable="custom"
            prop="remark"
            label="属性值或示例说明"
            show-overflow-tooltip
          />
          <el-table-column sortable="custom" prop="orderNum" label="排序号" width="100px">
            <template #default="{ row }">
              {{ row.orderNum || '0' }}
            </template>
          </el-table-column>
          <el-table-column
            sortable="custom"
            show-overflow-tooltip
            prop="createTime"
            label="创建时间"
          />
          <el-table-column prop="updateTime" sortable="custom" label="修改时间" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.updateTime || '--' }}
            </template>
          </el-table-column>

          <el-table-column prop="creator" sortable="custom" label="创建人" show-overflow-tooltip />
          <el-table-column prop="pv" fixed="right" label="操作" align="left" width="130">
            <template #default="scope">
              <div style="display: flex; justify-content: center">
                <el-icon class="edit_btn" @click="handleUpdate(scope.row)"><Edit /></el-icon>
                <el-icon class="delete_btn" @click="handleDelete(scope.row)"><Delete /></el-icon>
              </div>
            </template>
          </el-table-column>
        </el-table>
        <div class="block">
          <el-pagination
            v-model:current-page="pageNum"
            next-text="下一页"
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
    <uploadDialog ref="uploadDialogRef" @refresh-table-list="refreshTableList" />
    <el-dialog
      v-model="DialogVisible"
      :modal-append-to-body="false"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      width="800px"
      :title="tableHeader"
      class="add_prototype"
    >
      <div style="background: #fff; padding: 20px 20px; border-radius: 4px">
        <el-form
          ref="formRef"
          :model="ruleForm"
          :rules="rules"
          label-width="120px"
          class="demo-ruleForm"
        >
          <div v-if="tableHeader == '新建属性'">
            <el-form-item label="属性显示名" prop="displayName">
              <el-input
                v-model="ruleForm.displayName"
                placeholder="请输入属性名称"
                style="font-size: 12px"
              />
            </el-form-item>
            <el-form-item label="属性英文名" prop="name">
              <el-input
                v-model="ruleForm.name"
                :disabled="tableHeader != '新建属性'"
                style="font-size: 12px"
                placeholder="只支持英文、数字、下划线且必须以英文字母开头，不可以_结尾"
              />
            </el-form-item>
          </div>
          <div v-else>
            <el-form-item label="属性英文名" prop="name">
              <el-input
                v-model="ruleForm.name"
                :disabled="tableHeader != '新建属性'"
                style="font-size: 12px"
                placeholder="只支持英文、数字、下划线且必须以英文字母开头，不可以_结尾"
              />
            </el-form-item>
            <el-form-item label="属性显示名" prop="displayName">
              <el-input
                v-model="ruleForm.displayName"
                placeholder="请输入属性名称"
                style="font-size: 12px"
              />
            </el-form-item>
          </div>

          <el-form-item label="属性事例或说明">
            <el-input v-model="ruleForm.remark" style="font-size: 12px" placeholder="属性事例或说明" />
          </el-form-item>
          <el-form-item label="属性值类型">
            <div style="display: flex; justify-content: space-between">
              <el-radio-group
                v-model="ruleForm.dataType"
                :disabled="tableHeader != '新建属性'"
                @change="dataTypeEvent"
              >
                <el-radio-button value="STRING">文本</el-radio-button>
                <el-radio-button value="NUMBER">数值</el-radio-button>
                <el-radio-button value="DATETIME">时间</el-radio-button>
                <el-radio-button value="BOOL">是非</el-radio-button>
                <el-radio-button value="LIST">LIST</el-radio-button>
              </el-radio-group>
            </div>
          </el-form-item>
          <el-form-item v-if="inflag" label="单位">
            <div style="display: flex">
              <el-input
                v-model="ruleForm.unit"
                style="font-size: 12px; width: 100px"
                placeholder="请填写单位"
              />
              <div v-if="inflag" style="display: flex">
                <div class="gp-item-title" style="margin: 0 15px">精度</div>
                <el-select v-model="ruleForm.precisions" placeholder="请选择" style="width: 90px">
                  <el-option
                    v-for="item in intList"
                    :key="item.value"
                    :label="item.label"
                    :value="item.value"
                  />
                </el-select>
              </div>
            </div>
          </el-form-item>
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

          <el-form-item label="属性分组">
            <el-select v-model="ruleForm.groupName" placeholder="请选择" style="width: 100%" clearable>
              <el-option
                v-for="item in groupList"
                :key="String(item.value)"
                :label="item.label"
                :value="item.value"
              />
              <!-- v2 是在下拉面板打开时往 popper 里手动 appendChild 一个「新增分组」的 ul，
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
                      <el-icon class="font-blue"><Plus /></el-icon>新增分组
                    </span>
                  </li>
                </ul>
              </template>
            </el-select>
          </el-form-item>
          <el-form-item label="排序号" prop="orderNum">
            <el-input v-model="ruleForm.orderNum" style="font-size: 12px" placeholder="必填" />
          </el-form-item>

          <div style="display: flex; justify-content: center; margin: 30px 0">
            <el-button class="custom_button" @click="saveForm">保存</el-button>
            <el-button class="zc_btn_default" style="margin-left: 20px" @click="cancleForm">
              取消
            </el-button>
          </div>
        </el-form>
      </div>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
// 分页样式 el-pagination 已在 src/styles/index.scss 全局引入（sass 不允许 @use 出现在嵌套块里）
:deep() {
  .reset-message-box .el-message-box__btns button:nth-child(2) {
    margin-left: 50px !important;
  }

  .custom_button.el-button--medium {
    padding: 0 20px;
  }

  .el-dialog {
    border-radius: 6px;
  }

  .el-dialog__header {
    padding: 0 !important;
    border-radius: 6px;
    height: 44px;
    line-height: 44px;
    background: #fbfcfe;
  }

  .el-dialog__title {
    margin-left: 16px;
    font-size: 15px;
    color: #4d4d4d;
    font-weight: bold;
  }

  .el-dialog__body {
    padding: 20px;
    background-color: #eef4fd;
    border-radius: 6px;
  }

  .el-form-item__label {
    font-size: 15px;
    font-weight: 500;
    color: #4d4d4d;
  }

}

//dialog
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

.public-block {
  .block_online {
    width: 100%;
    justify-content: space-between;
    min-height: 700px;
  }
}
</style>
