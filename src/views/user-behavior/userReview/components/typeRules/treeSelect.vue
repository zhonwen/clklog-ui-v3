<script setup lang="ts">
/**
 * 属性 / 分群 / 标签的树选择（对应 v2 src/views/ups/components/tree-select.vue）。
 *
 * v2 用的是 @riophae/vue-treeselect —— 那是只支持 Vue 2 的库，v3 没有也装不上，
 * 这里改用 element-plus 自带的 el-tree-select，行为逐条对齐 v2：
 *   normalizer(id/label/children)  → :props（value: name / label: displayName / children）
 *   disable-branch-nodes           → :props.disabled，有 children 的节点置灰
 *   before-list 插槽（类型单选）    → el-select 的 #header 插槽
 *   @select                        → @node-click（回调拿到的同样是节点原始数据）
 *   @open / @close                 → @visible-change
 * 与 v2 一致（v2 此处逻辑存疑：handleRandioType 里还调了 $refs.treeselect.openMenu()
 * 来手动把下拉重新打开，element-plus 点 header 不会关闭下拉，因此不需要这一步）。
 *
 * 放在 userReview 模块内而不是 views/ups：v3 还没有 views/ups 目录，
 * 且 ups 模块由其它任务负责，这里先自带一份，等 ups 迁好后可以合并。
 */
import { computed, onMounted, ref, watch, nextTick } from 'vue'
import { copyObj } from '@/utils/copy'
import { useTrackingStore } from '@/stores/tracking'
import { getOptionsByType } from '@/utils/modelOptions/custom'
import type { OptionDef } from '@/utils/modelOptions/custom'
import type { ConditionItem, PropertyListMap, PropertyNode, RadioOption } from '../../types'

const props = withDefaults(
  defineProps<{
    typePath?: string
    second_index?: number
    second_item: ConditionItem
    radioOptions?: RadioOption[]
    /** 联级事件进行过滤出-事件属性 */
    pointProtoList?: PropertyNode[]
    propertyList?: Partial<PropertyListMap>
    cloleAppendBody?: boolean
  }>(),
  {
    typePath: undefined,
    second_index: undefined,
    radioOptions: () => [],
    pointProtoList: () => [],
    propertyList: () => ({
      commonPropertySum: [], // 共用事件属性
      userProperties: [], // 共用用户属性
      userGroupList: [], // 用户分群
    }),
    cloleAppendBody: false,
  },
)

const emit = defineEmits<{ change: [item: ConditionItem] }>()

const trackingStore = useTrackingStore()

const setDataList = ref<PropertyNode[]>([])
/** v2 的 this.fieldType：切换类型前的旧值，关闭下拉时用来还原 */
const fieldTypeBackup = ref('')

/** el-tree-select 的字段映射，等价于 v2 的 normalizer */
const treeProps = {
  value: 'name',
  label: 'displayName',
  children: 'children',
  // v2 的 :disable-branch-nodes="true"：有子节点的分支不可选
  disabled: (data: PropertyNode) => !!(data.children && data.children.length),
}

const propertyFeedBack = computed(
  () => (trackingStore.propertyList || {}) as Partial<PropertyListMap>,
)

function timeRefreshStep() {
  switch (props.second_item.fieldType) {
    case 'event_property':
      setDataList.value = propertyFeedBack.value.commonPropertySum || []
      break
    case 'user_property':
      setDataList.value = propertyFeedBack.value.userProperties || []
      break
    case 'user_group':
      setDataList.value = propertyFeedBack.value.userGroupList || []
      break
    case 'user_tag':
      setDataList.value = propertyFeedBack.value.userTagList || []
      break
  }
}

function handleOpen(item: ConditionItem) {
  // 关闭所有的弹框
  if (item.fieldType == 'event_property') {
    setDataList.value = props.pointProtoList || []
  } else if (item.fieldType == 'user_property') {
    setDataList.value = props.propertyList.userProperties || []
  } else if (item.fieldType == 'user_group') {
    setDataList.value = props.propertyList.userGroupList || []
  } else {
    setDataList.value = props.propertyList.userTagList || []
  }
}

function handleClose(item: ConditionItem) {
  if (fieldTypeBackup.value && fieldTypeBackup.value != item.fieldType) {
    item.fieldType = fieldTypeBackup.value
  }
  fieldTypeBackup.value = ''
}

function handleVisibleChange(visible: boolean) {
  if (visible) {
    handleOpen(props.second_item)
  } else {
    handleClose(props.second_item)
  }
}

function handleRandioType(value: string | number | boolean | undefined) {
  emit('change', props.second_item)
  fieldTypeBackup.value = copyObj(String(props.second_item.fieldType ?? '')) // 用于类型切换
  props.second_item.fieldType = String(value) // 属性类型切换
  handleOpen(props.second_item)
}

// 严格检验字段模式
function strictMode(val: OptionDef[] | '', label: 'name' | 'displayName') {
  if (val && val.length > 0) {
    return val[0]?.[label] ?? ''
  } else {
    return ''
  }
}

function filterCommonType(type?: string): OptionDef[] | '' {
  if (!type) return ''
  let options: OptionDef[] = []
  options = getOptionsByType(type)
  return options
}

function handleTreechange(node: PropertyNode) {
  const item = props.second_item
  // v2 的 :disable-branch-nodes 由 treeProps.disabled 实现，这里再兜一层
  if (node.children && node.children.length) return
  emit('change', item)
  // 群画像需要用到 displayName 作为名称
  if (props.typePath) {
    item.displayName = node.displayName
  }
  fieldTypeBackup.value = copyObj(String(item.fieldType ?? ''))
  if (item.fieldType == 'user_tag') {
    item.field = node.tableName
  } else {
    item.field = node.name
  }
  if (item.fieldType == 'user_group') {
    item.dataType = 'STRING'
    item.function = 'isSet'
  } else {
    item.dataType = node.dataType
    item.function = strictMode(filterCommonType(item.dataType), 'name')
  }
}

watch(propertyFeedBack, () => {
  nextTick(() => {
    timeRefreshStep()
  })
})

onMounted(() => {
  nextTick(() => {
    timeRefreshStep()
  })
})
</script>

<template>
  <div
    style="
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      box-sizing: border-box;
      overflow: unset;
    "
  >
    <div class="tree_custom" style="position: relative; margin-left: 0px; overflow: visible">
      <el-tree-select
        :model-value="second_item.field"
        style="width: 250px; margin-bottom: 0px"
        :data="setDataList"
        :props="treeProps"
        :teleported="!cloleAppendBody"
        filterable
        check-strictly
        :render-after-expand="false"
        placeholder="请选择"
        :clearable="false"
        @node-click="handleTreechange"
        @visible-change="handleVisibleChange"
      >
        <template #header>
          <div class="custom-header" @click.stop>
            <el-radio-group
              v-model="second_item.fieldType"
              class="custom_tabs setRadio"
              style="display: flex; overflow: auto; background-color: #fff"
              @change="handleRandioType"
            >
              <el-radio-button
                v-for="(option, index) in radioOptions"
                :key="index"
                :value="option.value"
                style="margin: 6px"
              >
                {{ option.label }}
              </el-radio-button>
            </el-radio-group>
          </div>
        </template>
      </el-tree-select>
    </div>
  </div>
</template>

<style lang="scss" scoped>
// v2 这里是 vue-treeselect 的一整套 .vue-treeselect__* 覆盖样式；
// v3 换成了 el-tree-select，对应的尺寸/字号在下面按同样的数值重写

:deep(.el-select__wrapper) {
  min-height: 30px;
  line-height: 30px;
}

:deep(.el-select__placeholder) {
  font-size: 12px;
}

:deep(.el-select__selected-item) {
  font-size: 12px;
}

:deep(.el-input__inner::placeholder) {
  font-size: 11px;
}

.tree_custom {
  .custom-header {
    width: 100%;
  }
}

:deep(.el-radio-group) {
  margin: 0 5px;
}

:deep(.el-radio-button__inner) {
  border-left: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 6px;
  font-size: 13px;
}

:deep(.el-radio-button:last-child .el-radio-button__inner) {
  border-radius: 4px;
}

:deep(.el-radio-button:first-child .el-radio-button__inner) {
  border-radius: 4px;
  font-size: 10px;
}

:deep(.el-loading-spinner .circular) {
  height: 38px !important;
}
</style>

<style lang="scss">
/* 树面板的高度限制，对齐 v2 的 .vue-treeselect__menu / __list 规则 */
.el-tree-select__popper .el-tree {
  max-height: 250px;
  overflow-y: auto;
}

.el-tree-select__popper .el-tree-node.is-current > .el-tree-node__content {
  background: #dcebfd !important;
  color: #2c7be5 !important;
}

.el-tree-select__popper .el-tree-node__label {
  font-size: 12px;
  font-weight: 400 !important;
  color: #4d4d4d;
}
</style>
