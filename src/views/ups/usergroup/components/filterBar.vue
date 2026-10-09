<script setup lang="ts">
/**
 * 分群模块的筛选条（对应 v2 views/ups/usergroup/components/filterBar.vue）。
 *
 * 两种形态：
 *   byTagRules = true  → 创建 / 编辑页的「分群信息与规则」标题条 + 返回列表按钮
 *   byTagRules = false → 列表页的筛选条件
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { Refresh, RefreshRight } from '@element-plus/icons-vue'
import { useTrackingStore } from '@/stores/tracking'
import { useLatestOnly } from '@/composables/useLatestOnly'
import { getListCategory } from '@/api/upsapi/categorymanage'
import { createMethod, tagStatusList, updateTypeList } from '../constants'
import { ALL_OPTION, toApiValue, withAllOption } from '@/utils/select-all-option'
import {
  datePickerDayDisabled,
  datePickerDayShortcuts,
  handleTree,
  siblingPath,
  todayYMD,
} from '../utils'
import type { LabelValue, PropertyNode } from '../types'

const props = withDefaults(
  defineProps<{
    byTagRules?: boolean
  }>(),
  {
    byTagRules: false,
  },
)

const emit = defineEmits<{
  setTopFilterParams: [val: Record<string, unknown>]
  returnTagsPagess: [list: PropertyNode[]]
}>()

const route = useRoute()
const router = useRouter()
const trackingStore = useTrackingStore()
const { next: nextCategory, isLatest: isLatestCategory } = useLatestOnly()

const loadingApi = ref(false)
/** v2 取的是 this.$route.name，只在 mounted 时读一次 */
const routePath = ref(String(route.name ?? ''))
const tagTree = ref<PropertyNode[]>([])
const updateType = ref(ALL_OPTION) // 更新方式
const status = ref(ALL_OPTION)
const startMatchTime = ref('')
const endMatchTime = ref('')
const createType = ref(ALL_OPTION)
const search = ref('')

const projectName = computed(() => trackingStore.projectName)

const defaultParams = computed(() => ({
  updateType: toApiValue(updateType.value),
  status: toApiValue(status.value),
  startMatchTime: startMatchTime.value,
  endMatchTime: endMatchTime.value,
  createType: toApiValue(createType.value),
  search: search.value,
}))

const commonParams = computed<Record<string, unknown>>(() => ({ ...defaultParams.value }))

/** 「最新版本计算时间」的日期选择器：v2 的 picker-options = datePickerDay() */
const pickerShortcuts = datePickerDayShortcuts
const pickerDisabled = datePickerDayDisabled

// 「全部」选项在 element-plus 下的兼容处理，说明见 utils/select-all-option.ts
const updateTypeOptions: LabelValue[] = withAllOption(updateTypeList)
const statusOptions: LabelValue[] = withAllOption(tagStatusList)
const createMethodOptions: LabelValue[] = withAllOption(createMethod)

function handlePicker(val: unknown) {
  // v2：清空日期时把 endMatchTime 也清掉，否则保留「今天」作为区间右端
  if (!val) {
    endMatchTime.value = ''
    return
  }
  endMatchTime.value = todayYMD()
}

function resetApiList() {
  updateType.value = ALL_OPTION // 更新方式
  status.value = ALL_OPTION
  endMatchTime.value = ''
  startMatchTime.value = ''
  createType.value = ALL_OPTION
  search.value = ''
}

function refreshApiList() {
  loadingApi.value = true
  emit('setTopFilterParams', commonParams.value)
  setTimeout(() => {
    loadingApi.value = false
  }, 500)
}

function getList(code: string) {
  const token = nextCategory()
  void getListCategory({ projectName: code }).then((response) => {
    if (!isLatestCategory(token)) return
    if (response?.data) {
      tagTree.value = handleTree(
        response.data as PropertyNode[] & { [k: string]: unknown }[],
        'id',
        'parent',
      ) as PropertyNode[]
      emit('returnTagsPagess', tagTree.value)
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
        void router.push({ path: siblingPath(route.path, 'list') })
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
  if (props.byTagRules) {
    getList(newVal)
  }
})

onMounted(() => {
  // 初次调用列表接口
  emit('setTopFilterParams', commonParams.value)
  if (props.byTagRules) {
    getList(projectName.value)
  }
})
</script>

<template>
  <div>
    <div class="headerFilter" :style="byTagRules ? 'min-height: 60px' : ' min-height: 60px;'">
      <div class="tabBar" :style="byTagRules ? 'min-height: 60px' : ' min-height: 60px;'">
        <div v-if="byTagRules" class="tagRules">
          <div class="title">分群信息与规则</div>
          <el-button class="zc_btn_default" @click="returnTagList">返回分群列表</el-button>
        </div>
        <!-- 表格列表查询条件-->
        <div v-else>
          <div class="first_line" style="display: flex">
            <div class="warry_select filterbar-tab-right">
              <div class="title">更新方式:</div>
              <el-select
                v-model="updateType"
                class="single_select"
                placeholder="请选择状态"
                style="width: 150px"
              >
                <el-option
                  v-for="item in updateTypeOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </div>
            <div class="warry_select filterbar-tab-right">
              <div class="title">分群状态:</div>
              <el-select
                v-model="status"
                class="single_select"
                placeholder="请选择状态"
                style="width: 150px"
              >
                <el-option
                  v-for="item in statusOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </div>
            <div class="filterbar-tab-right" style="display: flex; align-items: center">
              <div class="title">最新版本计算时间:</div>
              <el-date-picker
                v-model="startMatchTime"
                type="date"
                style="width: 200px; margin-left: 10px"
                placeholder="选择日期"
                :disabled-date="pickerDisabled"
                :shortcuts="pickerShortcuts"
                value-format="YYYY-MM-DD"
                @change="handlePicker"
              />
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
                  v-for="item in createMethodOptions"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </div>
            <el-input
              v-model="search"
              style="width: 230px"
              class="filterbar-tab-right"
              placeholder="请输入分群名称、分群标识搜索"
            />
          </div>
        </div>
        <div style="position: absolute; right: 0; top: 15px">
          <div v-if="routePath != 'create' && routePath != 'creator'" style="display: flex">
            <div class="tabBarBtn">
              <el-button
                v-loading="loadingApi"
                :icon="RefreshRight"
                class="zc_btn refresh"
                element-loading-background="#fff"
                @click="refreshApiList"
              >
                刷新
              </el-button>
              <el-button :icon="Refresh" class="zc_btn_default reset" @click="resetApiList">
                重置
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep() {
  .el-cascader .el-input {
    width: 150px;
  }

  .custom_input {
    .el-input__inner {
      font-size: 11px;
    }
  }

  .el-input__inner {
    font-size: 13px;
  }

  .single_select .el-select__wrapper {
    border-radius: 0px;
    box-shadow: none;
    border-bottom: 0;
    background-color: transparent;
    font-size: 12px;
    min-height: 30px;
    line-height: 30px;
    padding-left: 10px;
    width: 100px;
  }
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
    width: 100%;
    padding: 15px 20px;
    position: fixed;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    flex-wrap: nowrap !important;
    justify-content: center;
    overflow-x: auto;
    overflow-y: hidden;

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
