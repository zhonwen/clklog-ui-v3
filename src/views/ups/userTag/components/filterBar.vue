<script setup lang="ts">
/**
 * 标签列表 / 标签创建页顶部的筛选条（对应 v2 src/views/ups/userTag/components/filterBar.vue）。
 *
 * byTagRules=true 时只渲染「标签信息与规则 + 返回标签列表」（创建页用），
 * 否则渲染完整的筛选项（列表页用）。
 *
 * element-plus 适配：
 *   @riophae/vue-treeselect → el-tree-select
 *     :normalizer(id: node.name / label: node.name / children) → :props
 *     :disable-branch-nodes="true"                             → :props.disabled
 *     @select                                                  → @node-click
 *     @input（含清空）                                          → @change
 *   :picker-options=datePickerDay() → :disabled-date + :shortcuts
 *   value-format="yyyy-MM-dd"       → "YYYY-MM-DD"
 *   el-icon-refresh-right / el-icon-refresh → @element-plus/icons-vue 组件
 *   moment().format("YYYY-MM-DD")   → 本模块的 todayYMD()
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { Refresh, RefreshRight } from '@element-plus/icons-vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { bus } from '@/utils/event-bus'
import { useTrackingStore } from '@/stores/tracking'
import { getListCategory } from '@/api/upsapi/categorymanage'
import { dataTypeList } from '@/utils/modelOptions/up-manage'
import { ALL_OPTION, toApiValue, withAllOption } from '@/utils/select-all-option'
import {
  datePickerDayShortcuts,
  disabledFutureDate,
  handleTree,
  todayYMD,
} from '../local-utils'
import { CATEGORY_LIST } from '../bus-events'
import type { CategoryNode } from '../types'

withDefaults(
  defineProps<{
    byTagRules?: boolean
  }>(),
  { byTagRules: false },
)

const emit = defineEmits<{
  setTopFilterParams: [params: Record<string, string>]
  returnTagsPagess: [list: CategoryNode[]]
}>()

const route = useRoute()
const router = useRouter()
const trackingStore = useTrackingStore()

// 「全部」选项在 element-plus 下的兼容处理，说明见 utils/select-all-option.ts

const routePath = ref(route.name)
const loadingApi = ref(false)
const tagType = ref<string | null>(null) // 标签分类
const tagTree = ref<CategoryNode[]>([])
const categoryId = ref('')
const valueType = ref(ALL_OPTION) // 数据类型
const updateType = ref(ALL_OPTION) // 更新方式
const status = ref(ALL_OPTION)
const startMatchTime = ref('')
const endMatchTime = ref('')
const createType = ref(ALL_OPTION)
const search = ref('')

/**
 * el-tree-select 的字段映射（等价 v2 vue-treeselect 的 normalizer）。
 *
 * 这里**不能**照搬 v2 的 `:disable-branch-nodes="true"` 去设 `disabled`：
 * vue-treeselect 的该选项只是「父节点不可选」，点父节点依然会展开/收起；
 * 而 element-plus 的 el-tree 一旦 disabled，节点会被置灰、失去 is-focusable，
 * 点文字也不再展开，只能点那个很小的三角箭头 —— 就是「看起来像禁用、很难用」。
 *
 * 改法见 handleTreeNodeClick / handleTreeValueUpdate：
 * 节点全部保持可用（不置灰），点父节点只做展开/收起，并在赋值阶段拦掉父节点的选中。
 */
const treeSelectProps = {
  value: 'name',
  label: 'name',
  children: 'children',
}

/** 某个值是否对应一棵子树的父节点 */
function isBranchValue(val: string | null, list: CategoryNode[] = tagTree.value): boolean {
  if (val == null) return false
  for (const node of list) {
    if (node.name === val) return !!(node.children && node.children.length)
    if (node.children && node.children.length && isBranchValue(val, node.children)) return true
  }
  return false
}

/** 点父节点：只展开/收起，不选中 */
function handleTreeNodeClick(data: CategoryNode, node: { expanded: boolean }) {
  if (data.children && data.children.length) {
    node.expanded = !node.expanded
    return
  }
  handleCascader(data)
}

/** 赋值拦截：父节点不写入 v-model（等价 v2 的「父节点不可选」） */
function handleTreeValueUpdate(val: string | null) {
  if (isBranchValue(val)) return
  tagType.value = val
}

// v2 里 booktypeList 和 dateTimeList（= latestVersionCountTime(true)）都声明了但模板没用到，
// 是死数据，这里不再搬运。
const tagStatusList = [
  { value: ALL_OPTION, label: '全部' },
  { value: '启用', label: '启用' },
  { value: '暂停', label: '暂停' },
]
const updateTypeList = [
  { value: ALL_OPTION, label: '全部' },
  { value: '例行', label: '例行' },
  { value: '手动', label: '手动' },
]
const createMethod = [
  { value: ALL_OPTION, label: '全部' },
  { value: '自定义标签值', label: '自定义标签值' },
  { value: '基础指标值', label: '基础指标值' },
  { value: '首次末次特征', label: '首次末次特征' },
  { value: '事件偏好属性', label: '事件偏好属性' },
  { value: '行为分布结果', label: '行为分布结果' },
  { value: 'SQL计算结果', label: 'SQL计算结果' },
]

/** dataTypeList 是共享常量（utils/modelOptions/up-manage），不改它，只在本页把「全部」换成哨兵值 */
const dataTypeOptions = withAllOption(dataTypeList)

const projectName = computed(() => trackingStore.projectName)

// 「全部」在这里换回空串，接口拿到的参数与 v2 一致
const commonParams = computed<Record<string, string>>(() => ({
  categoryId: categoryId.value,
  valueType: toApiValue(valueType.value),
  updateType: toApiValue(updateType.value),
  status: toApiValue(status.value),
  startMatchTime: startMatchTime.value,
  endMatchTime: endMatchTime.value,
  createType: toApiValue(createType.value),
  search: search.value,
}))

function handlePicker(val: unknown) {
  if (!val) {
    endMatchTime.value = ''
    return
  }
  endMatchTime.value = todayYMD()
}

function refreshApiList() {
  loadingApi.value = true
  emit('setTopFilterParams', commonParams.value)
  setTimeout(() => {
    loadingApi.value = false
  }, 500)
}

function resetApiList() {
  tagType.value = null // 标签分类
  categoryId.value = ''
  valueType.value = ALL_OPTION // 数据类型
  updateType.value = ALL_OPTION // 更新方式
  status.value = ALL_OPTION
  startMatchTime.value = ''
  endMatchTime.value = ''
  createType.value = ALL_OPTION
  search.value = ''
}

function handleCascader(val: CategoryNode) {
  categoryId.value = val.id
}

function handleClear(val: unknown) {
  if (!val) {
    categoryId.value = ''
  }
}

function getList(code: string) {
  void getListCategory({ projectName: code }).then((response) => {
    const data = response?.data as CategoryNode[] | undefined
    if (data) {
      tagTree.value = handleTree(data, 'id', 'parent')
      emit('returnTagsPagess', tagTree.value)
      bus.emit(CATEGORY_LIST, data)
    }
  })
}

function returnTagList() {
  void nextTick(() => {
    ElMessageBox.confirm('离开将丢失已编辑的内容，是否离开？', '确认离开?', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      cancelButtonClass: 'custom-cancel-button',
      type: 'warning',
    })
      .then(() => {
        void router.push({
          name: 'userTag',
        })
      })
      .catch(() => undefined)
  })
}

watch(commonParams, (newVal) => {
  void nextTick(() => {
    emit('setTopFilterParams', newVal)
  })
})

watch(projectName, (newVal) => {
  getList(newVal)
})

onMounted(() => {
  // 初次调用列表接口
  emit('setTopFilterParams', commonParams.value)
  getList(projectName.value)
})

// v2 还有一个 rulesDialogEvent()，里面调 this.$refs.rulesDialog —— filterBar 自己并没有
// 这个 ref（rulesDialog 挂在 tag-list / tag-creator 上），是一段死代码，这里不再搬运。
</script>

<template>
  <div>
    <div class="headerFilter" :style="byTagRules ? 'min-height: 45px' : ' min-height: 100px;'">
      <div class="tabBar" :style="byTagRules ? 'min-height: 45px' : ' min-height: 100px;'">
        <div v-if="byTagRules" class="tagRules">
          <div class="title">标签信息与规则</div>
          <el-button class="zc_btn_default" @click="returnTagList">返回标签列表</el-button>
        </div>
        <div v-else>
          <div class="first_line" style="display: flex; position: relative">
            <div class="title filterbar-tab-right" style="line-height: 30px">标签分类:</div>
            <el-tree-select
              :model-value="tagType"
              class="filterbar-tab-right tag-tree-select"
              style="font-size: 13px; color: #606266; font-weight: 400px; z-index: 99999"
              :data="tagTree"
              :props="treeSelectProps"
              :render-after-expand="false"
              check-strictly
              expand-on-click-node
              filterable
              clearable
              placeholder="请选择"
              @update:model-value="handleTreeValueUpdate"
              @node-click="handleTreeNodeClick"
              @change="handleClear"
            />
            <div class="warry_select filterbar-tab-right">
              <div class="title">数据类型:</div>
              <el-select
                v-model="valueType"
                class="single_select"
                placeholder="请选择状态"
                style="width: 150px"
              >
                <el-option
                  v-for="item in dataTypeOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                >
                </el-option>
              </el-select>
            </div>
            <div class="warry_select filterbar-tab-right">
              <div class="title">更新方式:</div>
              <el-select
                v-model="updateType"
                class="single_select"
                placeholder="请选择状态"
                style="width: 150px"
              >
                <el-option
                  v-for="item in updateTypeList"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                >
                </el-option>
              </el-select>
            </div>
            <div class="warry_select filterbar-tab-right">
              <div class="title">标签状态:</div>
              <el-select
                v-model="status"
                class="single_select"
                placeholder="请选择状态"
                style="width: 150px"
              >
                <el-option
                  v-for="item in tagStatusList"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                >
                </el-option>
              </el-select>
            </div>

            <div class="warry_select filterbar-tab-right">
              <div class="title">创建方式:</div>
              <el-select
                v-model="createType"
                class="single_select"
                placeholder="请选择创建方式"
                style="width: 150px"
              >
                <el-option
                  v-for="item in createMethod"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                >
                </el-option>
              </el-select>
            </div>
          </div>
          <div class="second_line" style="margin-top: 10px; display: flex">
            <el-input
              v-model="search"
              style="width: 230px"
              class="filterbar-tab-right"
              placeholder="请输入标签名称、标签标识搜索"
            ></el-input>
            <div style="display: flex; align-items: center">
              <div class="title filterbar-tab-right">最新版本计算时间:</div>
              <el-date-picker
                v-model="startMatchTime"
                type="date"
                style="width: 200px; margin-left: 10px"
                placeholder="选择日期"
                :disabled-date="disabledFutureDate"
                :shortcuts="datePickerDayShortcuts"
                value-format="YYYY-MM-DD"
                @change="handlePicker"
              >
              </el-date-picker>
            </div>
          </div>
        </div>
        <div style="position: absolute; right: 0; top: 15px">
          <div v-if="routePath != 'create'" style="display: flex">
            <div class="tabBarBtn">
              <!-- v2 还写了 element-loading-spinner="el-icon-loading"，element-plus 的
                   element-loading-spinner 要的是一段 SVG 字符串，这里用默认转圈 -->
              <el-button
                v-loading="loadingApi"
                :icon="RefreshRight"
                class="zc_btn refresh"
                element-loading-background="#fff"
                @click="refreshApiList"
                >刷新</el-button
              >
              <el-button :icon="Refresh" class="zc_btn_default reset" @click="resetApiList"
                >重置</el-button
              >
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
// v2 这里是 vue-treeselect 的一整套 .vue-treeselect__* 覆盖样式，
// v3 换成 el-tree-select，按同样的数值重写。
//
// 宽度必须写在**根元素**上，不能只写在 .el-select__wrapper 上：
// v2 的 `.vue-treeselect__control { width: 150px }`，其根元素 .vue-treeselect 没有宽度、
// 作为 flex item 收缩到内容宽，整体就是 150px；
// 而 element-plus 的 el-tree-select 底层是 el-select，根元素是 `width: var(--el-select-width)` = **100%**。
// 只把 150px 写在 wrapper 上，外层依旧撑满，在 .first_line 这个 flex 行里会吃掉全部剩余宽度 ——
// 可见的框只有 150px，右边留一大片空白（「标签分类」和「数据类型」之间那个大空档就是这么来的）。
.tag-tree-select {
  width: 150px;
}

:deep(.el-select__wrapper) {
  min-height: 30px;
  line-height: 30px;
}

:deep(.el-select__placeholder) {
  font-size: 14px;
  color: #4d4d4d;
}

// v2 是 `.el-cascader--medium { line-height: 30px; margin-right: 20px }` +
// `.el-cascader .el-input { width: 150px }`。element-plus 没有 --medium 后缀，
// v3 之前只迁了宽度，级联框和后面的控件就贴在一起了
:deep(.el-cascader) {
  line-height: 30px;
  margin-right: 20px;

  .el-input {
    width: 150px;
  }
}

:deep(.custom_input .el-input__inner) {
  font-size: 11px;
}

// v2 是 `.custom_input .el-input--medium .el-input__inner { width: 250px !important }`，
// v3 之前只迁了 font-size，搜索框宽度没跟上
:deep(.custom_input .el-input) {
  width: 250px !important;
}

:deep(.el-input__inner) {
  font-size: 13px;
}

// v2 是 `.el-input--medium .el-input__inner { height: 30px; line-height: 30px }`。
// element-plus 的输入框高度在外层 .el-input（--el-input-height），
// 写在 .el-input__inner 上撑不动外层，输入框会停在 EP 默认的 32px
:deep(.el-input) {
  --el-input-height: 30px;
}

:deep(.el-button) {
  padding: 0 20px;
}

:deep(.single_select .el-select__wrapper) {
  border-radius: 0px;
  box-shadow: none;
  background-color: transparent;
  font-size: 12px;
  height: 30px;
  line-height: 30px;
  padding-left: 10px;
  width: 100px;
}

.headerFilter {
  font-size: 13px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: nowrap !important;
  overflow-x: auto;

  .tabBar {
    background: #fff;
    position: relative;
    width: 100%;
    padding: 15px 20px;
    position: fixed;
    z-index: 999;
    display: flex;
    flex-direction: column;
    flex-wrap: nowrap !important;
    justify-content: center;

    .tagRules {
      display: flex;
      justify-content: space-between;
      position: relative;

      .title {
        margin-left: 50px;
        font-size: 16px;
        font-weight: 600;
        line-height: 30px;
      }

      .zc_btn_default {
        position: fixed;
        right: 40px;
        height: 30px;
        font-size: 13px;

        .el-button {
          padding: 10px;
        }
      }
    }
  }

  // 过滤条件
  .title {
    font-size: 12px;
    color: #4d4d4d;
    padding-left: 6px;
    white-space: nowrap;
  }

  .warry_select {
    display: flex;
    width: 160px;
    border: 1px solid #dde8f4;
    border-radius: 4px;
    align-items: center;
    height: 30px;
  }
}
</style>
