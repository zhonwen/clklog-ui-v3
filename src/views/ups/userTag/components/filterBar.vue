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

const routePath = ref(route.name)
const loadingApi = ref(false)
const tagType = ref<string | null>(null) // 标签分类
const tagTree = ref<CategoryNode[]>([])
const categoryId = ref('')
const valueType = ref('') // 数据类型
const updateType = ref('') // 更新方式
const status = ref('')
const startMatchTime = ref('')
const endMatchTime = ref('')
const createType = ref('')
const search = ref('')

/** el-tree-select 的字段映射（等价 v2 的 normalizer） */
const treeSelectProps = {
  value: 'name',
  label: 'name',
  children: 'children',
  // v2 的 :disable-branch-nodes="true"
  disabled: (data: CategoryNode) => !!(data.children && data.children.length),
}

// v2 里 booktypeList 和 dateTimeList（= latestVersionCountTime(true)）都声明了但模板没用到，
// 是死数据，这里不再搬运。
const tagStatusList = [
  { value: '', label: '全部' },
  { value: '启用', label: '启用' },
  { value: '暂停', label: '暂停' },
]
const updateTypeList = [
  { value: '', label: '全部' },
  { value: '例行', label: '例行' },
  { value: '手动', label: '手动' },
]
const createMethod = [
  { value: '', label: '全部' },
  { value: '自定义标签值', label: '自定义标签值' },
  { value: '基础指标值', label: '基础指标值' },
  { value: '首次末次特征', label: '首次末次特征' },
  { value: '事件偏好属性', label: '事件偏好属性' },
  { value: '行为分布结果', label: '行为分布结果' },
  { value: 'SQL计算结果', label: 'SQL计算结果' },
]

const projectName = computed(() => trackingStore.projectName)

const commonParams = computed<Record<string, string>>(() => ({
  categoryId: categoryId.value,
  valueType: valueType.value,
  updateType: updateType.value,
  status: status.value,
  startMatchTime: startMatchTime.value,
  endMatchTime: endMatchTime.value,
  createType: createType.value,
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
  valueType.value = '' // 数据类型
  updateType.value = '' // 更新方式
  status.value = ''
  startMatchTime.value = ''
  endMatchTime.value = ''
  createType.value = ''
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
              v-model="tagType"
              class="filterbar-tab-right"
              style="font-size: 13px; color: #606266; font-weight: 400px; z-index: 99999"
              :data="tagTree"
              :props="treeSelectProps"
              :render-after-expand="false"
              check-strictly
              filterable
              clearable
              placeholder="请选择"
              @node-click="handleCascader"
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
                  v-for="item in dataTypeList"
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
// v3 换成 el-tree-select，按同样的数值重写
:deep(.el-select__wrapper) {
  min-height: 30px;
  line-height: 30px;
  width: 150px;
}

:deep(.el-select__placeholder) {
  font-size: 14px;
  color: #4d4d4d;
}

:deep(.el-cascader .el-input) {
  width: 150px;
}

:deep(.custom_input .el-input__inner) {
  font-size: 11px;
}

:deep(.el-input__inner) {
  font-size: 13px;
  height: 30px;
  line-height: 30px;
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
