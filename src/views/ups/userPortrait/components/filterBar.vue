<script setup lang="ts">
/**
 * 群画像列表页的筛选条（对应 v2 `views/ups/userPortrait/components/filterBar.vue`）。
 *
 * v2 里还留着一批没有任何模板绑定、也没有外部调用的遗留成员
 * （dataTypeList / tagType / valueType / status / createType / booktypeList / tagStatusList /
 *  createMethod / dateTimeList / handleCascader / generateRandomKey / rulesDialogEvent / returnTagList），
 * 它们既不影响 emit 出去的筛选参数，也不影响渲染，因此不再搬运；其余逻辑逐条照迁。
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { Refresh, RefreshRight } from '@element-plus/icons-vue'
import { getListCategory } from '@/api/upsapi/categorymanage'
import { formatDateYMD } from '@/utils/date'
import { useTrackingStore } from '@/stores/tracking'
import { useLatestOnly } from '@/composables/useLatestOnly'
import { datePickerDayShortcuts, datePickerDisabledDate } from '../options'
import { handleTree } from '../types'
import type { TreeSourceNode } from '../types'

const props = withDefaults(defineProps<{ byTagRules?: boolean }>(), { byTagRules: false })

const emit = defineEmits<{
  setTopFilterParams: [params: Record<string, string>]
  returnTagsPagess: [list: TreeSourceNode[]]
}>()

const trackingStore = useTrackingStore()
const { next, isLatest } = useLatestOnly()

const loadingApi = ref(false)
const tagTree = ref<TreeSourceNode[]>([])
/** 更新方式 */
const updateType = ref('')
const startMatchTime = ref('')
const endMatchTime = ref('')
const search = ref('')

const updateTypeList = [
  { value: '', label: '全部' },
  { value: '例行', label: '例行' },
  { value: '手动', label: '手动' },
]

const projectName = computed(() => trackingStore.projectName)

const defaultParams = computed(() => ({
  updateType: updateType.value,
  startMatchTime: startMatchTime.value,
  endMatchTime: endMatchTime.value,
  search: search.value,
}))

const commonParams = computed<Record<string, string>>(() => Object.assign({}, defaultParams.value))

function getList(code: string) {
  const token = next()
  getListCategory({ projectName: code }).then((response) => {
    if (!isLatest(token)) return
    if (response?.data) {
      tagTree.value = handleTree(response.data as TreeSourceNode[], 'id', 'parent')
      emit('returnTagsPagess', tagTree.value)
    }
  })
}

watch(commonParams, (newVal) => {
  nextTick(() => {
    emit('setTopFilterParams', newVal)
  })
})

watch(projectName, (newVal) => {
  if (props.byTagRules) {
    getList(newVal)
  }
})

function refreshApiList() {
  loadingApi.value = true
  emit('setTopFilterParams', commonParams.value)
  setTimeout(() => {
    loadingApi.value = false
  }, 500)
}

function resetApiList() {
  updateType.value = '' // 更新方式
  startMatchTime.value = ''
  endMatchTime.value = ''
  search.value = ''
}

/** 选了「最新版本计算时间」的起始日，结束日固定为今天（v2 用的是 moment().format('YYYY-MM-DD')） */
function handlePicker(val: unknown) {
  if (!val) {
    endMatchTime.value = ''
    return
  }
  endMatchTime.value = formatDateYMD(new Date())
}

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
        <div>
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
                  v-for="item in updateTypeList"
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
                :disabled-date="datePickerDisabledDate"
                :shortcuts="datePickerDayShortcuts"
                value-format="YYYY-MM-DD"
                @change="handlePicker"
              />
            </div>

            <el-input
              v-model="search"
              style="width: 230px"
              placeholder="请输入群画像名称搜索"
              class="filterbar-tab-right"
            />
          </div>
        </div>
        <div style="position: absolute; right: 0; top: 15px">
          <div style="display: flex">
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
:deep(.custom_input .el-input__inner) {
  font-size: 11px;
}

:deep(.el-input__inner) {
  font-size: 13px;
}

/*
 * 下面四条是补 v2 同一个 ::v-deep 块里被漏掉 / 迁成死规则的部分
 * （v2 src/views/ups/userPortrait/components/filterBar.vue，与 userTag 的 filterBar 是同一串）。
 * element-plus 没有 --medium 后缀，且输入框高度移到了外层 .el-input 的 --el-input-height 上，
 * 照搬 `.el-input--medium .el-input__inner { height: 30px }` 撑不动外层，输入框会停在 EP 默认的 32px。
 */
:deep(.el-cascader) {
  line-height: 30px;
  margin-right: 20px;

  .el-input {
    width: 150px;
  }
}

:deep(.custom_input .el-input) {
  width: 250px !important;
}

:deep(.el-input) {
  --el-input-height: 30px;
}

:deep(.el-button) {
  padding: 0 20px;
}

:deep(.single_select .el-input__inner) {
  border-radius: 0px;
  border-top-width: 0px;
  border-left-width: 0px;
  border-right-width: 0px;
  border-bottom-width: 1px;
  border-bottom: 1px solid #acb2ba;
  background-color: transparent;
  font-size: 12px;
  height: 30px;
  line-height: 30px;
  border-bottom-width: 0;
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
    width: 100%;
    position: fixed;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    flex-wrap: nowrap !important;
    justify-content: center;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 15px 20px;

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
    margin-right: 20px;
  }
}
</style>
