<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Refresh, RefreshRight, Search } from '@element-plus/icons-vue'
import { useTrackingStore } from '@/stores/tracking'
import { ALL_OPTION, allOption, toApiValue } from '@/utils/select-all-option'
import { useLatestOnly } from '@/composables/useLatestOnly'
import { getGroupNameListApi } from '@/api/sysmanage/manageAttribute'
import { getGroupNameListEventApi } from '@/api/sysmanage/manageEvent'

/**
 * 元数据管理模块自带的筛选条（v2 src/views/meteData/components/fiterbar.vue）。
 * 文件名在 v2 里就拼错成 fiterbar，保持不变。
 */

export interface FilterOption {
  label: string
  value: string | boolean
}

/** 与 v2 的 channelArray 完全一致 */
const channelArray: FilterOption[] = [
  {
    value: ALL_OPTION,
    label: '全部',
  },
  {
    value: 'IOS',
    label: 'IOS',
  },
  {
    value: 'ANDROID',
    label: 'Android',
  },
  {
    value: 'WEB',
    label: 'Web',
  },
  {
    value: 'MINI_APP',
    label: '小程序',
  },
  {
    value: 'SERVER',
    label: '服务端',
  },
  {
    value: 'OTHER',
    label: 'Other',
  },
]

const props = withDefaults(
  defineProps<{
    ByEventGrop?: boolean
    ByReceive?: boolean
    ByGrop?: boolean
    ByTag?: boolean
    ByEventTag?: boolean
    ByDataType?: boolean
    BySearchWord?: boolean
    ByPlatform?: boolean
    ByCommon?: boolean
  }>(),
  {
    ByEventGrop: false,
    ByReceive: false,
    ByGrop: false,
    ByTag: false,
    ByEventTag: false,
    ByDataType: false,
    BySearchWord: false,
    ByPlatform: false,
    ByCommon: false,
  },
)

const emit = defineEmits<{
  setFilterBarParams: [
    val: Record<string, unknown> | undefined,
    filerList: [FilterOption[], FilterOption[]],
  ]
}>()

const trackingStore = useTrackingStore()
const { next: nextGroup, isLatest: isLatestGroup } = useLatestOnly()

// 「全部」选项在 element-plus 下的兼容处理，说明见 utils/select-all-option.ts
const all: FilterOption = allOption

const loadingApi = ref(false)
// 「全部」选项在 element-plus 下的兼容处理，说明见 utils/select-all-option.ts
const isAccept = ref<string | boolean>(ALL_OPTION)
const channel = ref<string | boolean>(ALL_OPTION)
const isPreset = ref<string | boolean>(ALL_OPTION)
/** 是否共用 */
const commonOnly = ref<string | boolean>(ALL_OPTION)
const display = ref<string | boolean>(ALL_OPTION)
const status = ref<string | boolean>(ALL_OPTION)
const name = ref('')
const searchWord = ref('')
const groupName = ref<string | boolean>(ALL_OPTION)
const dataType = ref<string | boolean>(ALL_OPTION)

const channelList = ref<FilterOption[]>(channelArray)
const groupTitle = ref('属性分组')
const displayList: FilterOption[] = [
  {
    value: ALL_OPTION,
    label: '全部',
  },
  {
    value: true,
    label: '显示',
  },
  {
    value: false,
    label: '隐藏',
  },
]
const statuList: FilterOption[] = [
  {
    value: ALL_OPTION,
    label: '全部',
  },
  {
    value: '启用',
    label: '启用',
  },
  {
    value: '禁用',
    label: '禁用',
  },
]
const isCommonList: FilterOption[] = [
  {
    value: ALL_OPTION,
    label: '全部',
  },
  {
    value: true,
    label: '是',
  },
]
const isPresetList: FilterOption[] = [
  {
    value: ALL_OPTION,
    label: '全部',
  },
  {
    value: true,
    label: '是',
  },
  {
    value: false,
    label: '否',
  },
]
const dataTypeList: FilterOption[] = [
  {
    value: ALL_OPTION,
    label: '全部',
  },
  {
    value: 'STRING',
    label: '文本',
  },
  {
    value: 'NUMBER',
    label: '数值',
  },
  {
    value: 'DATETIME',
    label: '时间',
  },
  {
    value: 'BOOL',
    label: '是非',
  },
  {
    value: 'LIST',
    label: 'LIST',
  },
]

const groupList = ref<FilterOption[]>([])
// 与 v2 一致（v2 此处逻辑存疑：标签列表的取数在 v2 里被整段注释掉了，tagList 恒为空数组，
// 但父页面仍然按 filerList[1] 取它，所以这里保留这个空数组）
const tagList = ref<FilterOption[]>([])
const tag = ref<string | boolean>(ALL_OPTION)

const commonData = ref<Record<string, unknown> | undefined>(undefined)
let refreshTimer: ReturnType<typeof setTimeout> | null = null

const projectName = computed(() => trackingStore.projectName)

const defaultParams = computed(() => ({
  display: toApiValue(display.value),
  isPreset: toApiValue(isPreset.value),
  commonOnly: toApiValue(commonOnly.value),
  status: toApiValue(status.value),
}))

const commonParams = computed<Record<string, unknown>>(() => {
  let obj: Record<string, unknown> = {}
  obj = Object.assign(obj, defaultParams.value)
  if (props.ByGrop || props.ByEventGrop) {
    obj = Object.assign(obj, { groupName: toApiValue(groupName.value) })
  }
  if (props.ByDataType) {
    obj = Object.assign(obj, { dataType: toApiValue(dataType.value) })
  }
  if (props.ByTag || props.ByEventTag) {
    obj = Object.assign(obj, { tag: toApiValue(tag.value) })
  }
  if (props.BySearchWord) {
    obj = Object.assign(obj, { name: name.value })
  }
  if (props.ByPlatform) {
    obj = Object.assign(obj, { channel: toApiValue(channel.value) })
  }
  if (props.ByReceive) {
    obj = Object.assign(obj, { isAccept: toApiValue(isAccept.value) })
  }
  return obj
})

function setTopFilterParams(val: Record<string, unknown> | undefined) {
  emit('setFilterBarParams', val, [groupList.value, tagList.value])
}

watch(commonParams, (newVal, oldVal) => {
  if (JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
    commonData.value = newVal
    void nextTick(() => {
      setTopFilterParams(newVal)
    })
  }
})

function resetApiList() {
  isAccept.value = ALL_OPTION
  channel.value = ALL_OPTION
  isPreset.value = ALL_OPTION
  // 是否共用
  commonOnly.value = ALL_OPTION
  display.value = ALL_OPTION
  status.value = ALL_OPTION
  name.value = ''
  searchWord.value = ''
  groupName.value = ALL_OPTION
  dataType.value = ALL_OPTION
}

function refreshApiList() {
  if (name.value != searchWord.value) {
    // 与 v2 一致：搜索词变了就只同步 name，由 watch 去触发一次取数
    name.value = searchWord.value
    return
  }
  name.value = searchWord.value
  loadingApi.value = true

  // 与 v2 一致（v2 此处逻辑存疑：首次进入页面时 commonData 还没被 watch 赋过值，
  // 这里会把 undefined 发给父组件，父组件本轮拿到的筛选参数只剩 projectName）
  setTopFilterParams(commonData.value)
  refreshTimer = setTimeout(() => {
    loadingApi.value = false
  }, 500)
}

function channelEvent() {}

function searchEvent() {
  name.value = searchWord.value
}

function getTagList() {
  // v2 这里原本还要取标签列表（getTagListEventApi / getTagListApi），整段被注释掉了，
  // 只剩下这一次把当前筛选条件抛给父组件
  setTopFilterParams(commonParams.value)
}

function normalizeGroupList(data: string[] | undefined) {
  const list = (data || []).filter((item) => {
    if (typeof item === 'string') {
      return item.trim() !== ''
    }
    return true
  })
  const options: FilterOption[] = list.map((item) => {
    return { label: item, value: item }
  })
  options.unshift(all)
  return options
}

function getPageList() {
  const params = {
    projectName: projectName.value,
  }
  if (props.ByEventGrop) {
    const token = nextGroup()
    getGroupNameListEventApi(params)
      .then((res) => {
        if (!isLatestGroup(token)) return
        if (res?.code == 200) {
          // getGroupNameListEventApi 由其它模块先落地，返回值未带泛型，这里收一次类型
          groupList.value = normalizeGroupList(res.data as string[] | undefined)
        }
        getTagList()
      })
      .catch(() => {
        if (!isLatestGroup(token)) return
        /* 报错已由请求层统一提示 */
      })
  } else if (props.ByGrop) {
    const token = nextGroup()
    getGroupNameListApi(params)
      .then((res) => {
        if (!isLatestGroup(token)) return
        if (res?.code == 200) {
          groupList.value = normalizeGroupList(res.data)
        }
        getTagList()
      })
      .catch(() => {
        if (!isLatestGroup(token)) return
        /* 报错已由请求层统一提示 */
      })
  }
}

onMounted(() => {
  getPageList()
  if (props.ByGrop) {
    groupTitle.value = '属性分组'
  } else {
    groupTitle.value = '事件分组'
  }
})

onBeforeUnmount(() => {
  if (refreshTimer) clearTimeout(refreshTimer)
})
</script>

<template>
  <div class="documentation-container">
    <div class="headerFilter">
      <div class="tabBar">
        <div v-if="ByGrop || ByEventGrop" class="warry_select filterbar-tab-right">
          <div class="title">{{ groupTitle }}:</div>
          <el-select v-model="groupName" class="single_select" placeholder="请选择状态">
            <el-option
              v-for="item in groupList"
              :key="String(item.value)"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </div>

        <!-- v2 此处「是否接收」筛选项整段被注释掉，保持一致不迁移 -->
        <div class="warry_select filterbar-tab-right">
          <div class="title">状态:</div>
          <el-select v-model="status" class="single_select" placeholder="请选择状态">
            <el-option
              v-for="item in statuList"
              :key="String(item.value)"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </div>
        <div class="warry_select filterbar-tab-right">
          <div class="title">显示状态:</div>
          <el-select v-model="display" class="single_select" placeholder="请选择显示状态">
            <el-option
              v-for="item in displayList"
              :key="String(item.value)"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </div>

        <div v-if="ByDataType" class="warry_select filterbar-tab-right">
          <div class="title">数据类型:</div>
          <el-select v-model="dataType" class="single_select" placeholder="请选择状态">
            <el-option
              v-for="item in dataTypeList"
              :key="String(item.value)"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </div>
        <div class="warry_select filterbar-tab-right">
          <div class="title">是否预置:</div>
          <el-select v-model="isPreset" class="single_select" placeholder="请选择状态">
            <el-option
              v-for="item in isPresetList"
              :key="String(item.value)"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </div>
        <div v-if="ByCommon" class="warry_select filterbar-tab-right">
          <div class="title">是否公共:</div>
          <el-select v-model="commonOnly" class="single_select" placeholder="请选择状态">
            <el-option
              v-for="item in isCommonList"
              :key="String(item.value)"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </div>

        <div v-if="ByPlatform" class="warry_select filterbar-tab-right">
          <div class="title">应埋点平台:</div>
          <el-select
            v-model="channel"
            class="single_select platform_select"
            collapse-tags
            style="width: 100px"
            placeholder="请选择状态"
            @change="channelEvent"
          >
            <el-option
              v-for="item in channelList"
              :key="String(item.value)"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </div>

        <el-input
          v-if="BySearchWord"
          v-model="searchWord"
          class="custom_input filterbar-tab-right"
          style="width: 250px; border-radius: 4px; height: 30px"
          :placeholder="
            groupTitle == '事件分组' ? '请输入事件名称、事件标识符搜索' : '请输入属性名称、属性标识符搜索'
          "
          clearable
          @keyup.enter="searchEvent()"
        >
          <template #prefix>
            <el-icon class="el-input__icon" style="cursor: pointer" @click="searchEvent">
              <Search />
            </el-icon>
          </template>
        </el-input>
        <div class="tabBarBtn">
          <el-button
            v-loading="loadingApi"
            class="zc_btn refresh"
            element-loading-background="#fff"
            @click="refreshApiList"
          >
            <el-icon><RefreshRight /></el-icon>刷新
          </el-button>
          <el-button class="zc_btn_default reset" @click="resetApiList">
            <el-icon><Refresh /></el-icon>重置
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
// v2 这里 @import 了 TopFilter.scss，其中的 .TopFilter 本组件并未使用；
// sass 也不允许 @use 出现在嵌套块内，这里不再引入。
:deep() {
  .el-select .el-tag {
    margin: 0 !important;
    margin-left: 2px !important;
  }

  .el-loading-spinner {
    margin-top: -6px;
  }

  .custom_input {
    .el-input__inner {
      font-size: 11px;
    }
  }

  .custom_input .el-input--medium .el-input__inner {
    width: 250px !important;
  }

  .el-button--medium {
    padding: 0 20px;
  }

  .el-input--medium .el-input__inner {
    height: 30px;
    line-height: 30px;
  }

  .el-input--medium .el-input__icon {
    line-height: 30px;
    cursor: pointer;
  }

  .el-input__inner {
    font-size: 13px;
  }

  .single_select .el-input__inner {
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
}

.headerFilter {
  height: 60px;
  color: #194580;
  font-size: 13px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: nowrap !important;
  overflow-x: auto;

  .tabBar {
    padding: 15px 20px;
    background: #fff;
    position: fixed;
    z-index: 999;
    height: 60px;
    display: flex;
    align-items: center;
    flex-wrap: nowrap !important;
    overflow-x: auto;
    overflow-y: hidden;
    width: 100%;
  }

  .singleItem {
    display: flex;
    margin-right: 30px;
  }

  .setTitle {
    height: 30px;
    line-height: 30px;
  }

  .custom_select {
    width: 100px;
    margin-left: 10px;
    height: 30px;
    line-height: 30px;
  }

  .warry_select {
    display: flex;
    border: 1px solid #d5dfed;
    border-radius: 4px;
    align-items: center;
    min-height: 30px;

    .title {
      font-size: 12px;
      color: #4d4d4d;
      padding-left: 6px;
      white-space: nowrap;
    }
  }
}
</style>
