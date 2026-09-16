<script setup lang="ts">
/**
 * customTagPage 自带的一份属性树选择
 * （对应 v2 src/views/ups/userTag/components/customTagPage/typeRules/tree-select.vue）。
 *
 * ⚠️ 与 v2 一致：**这个文件在 v2 里没有任何 import 它的地方**。
 * attributeRules / behaviorRules / sequenceCard 用的都是
 * `@/views/ups/components/tree-select.vue` 那一份。这里保留是为了不丢文件，
 * 并且它和公共那份确实是两份不同的实现（见下方差异说明），所以没有直接 import 公共件。
 *
 * 与 `@/views/ups/components/tree-select.vue` 的差异（全部按本文件的 v2 原件保留）：
 *   1. 没有 typePath / optionsList / cloleAppendBody 三个 prop，下拉恒定 teleport 到 body
 *   2. onMounted 里直接 `setDataList = propertyFeedBack`（公共那份走 timeRefreshStep 按类型分流）
 *   3. handleTreechange 里 user_group 分支把 `function` 置成布尔 **true**
 *      （公共那份置成 'isSet'）——「与 v2 一致（v2 此处逻辑存疑：function 应该是判断方式的
 *      name 字符串，写 true 后下拉框匹配不到任何选项）」
 *   4. 外层 div 的 margin-left 是 20px（公共那份是 0px），且没有 .tree_custom 包裹
 *   5. 没有 refreshTreeList()，只有一个从 localStorage 取 propertyList 的 refreshRadioList()
 *
 * vue-treeselect → el-tree-select 的映射与公共那份一致：
 *   :normalizer(id/label/children) → :props（value: name / label: displayName / children）
 *   :disable-branch-nodes="true"   → :props.disabled
 *   slot="before-list"             → el-select 的 #header 插槽
 *   @select / @open / @close       → @node-click / @visible-change
 *   :append-to-body="true"         → :teleported="true"
 *   $refs.treeselect.openMenu()    → 不需要（点 header 不会关闭下拉）
 */
import { computed, nextTick, onMounted, ref } from 'vue'
import { copyObj } from '@/utils/copy'
import { getLocalStorage } from '@/utils/localStorage'
import { useTrackingStore } from '@/stores/tracking'
import { getOptionsByType } from '@/utils/modelOptions/custom'
import type { OptionDef } from '@/utils/modelOptions/custom'
import { strictMode } from '../../../local-utils'
import type { ConditionItem, PropertyListMap, PropertyNode, RadioOption } from '../../../types'

defineOptions({ name: 'selectTree' })

const props = withDefaults(
  defineProps<{
    second_index?: number
    second_item: ConditionItem
    radioOptions?: RadioOption[]
    /** 联级事件进行过滤出-事件属性 */
    pointProtoList?: PropertyNode[]
    propertyList?: Partial<PropertyListMap>
  }>(),
  {
    second_index: undefined,
    radioOptions: () => [],
    pointProtoList: () => [],
    propertyList: () => ({
      commonPropertySum: [], // 共用事件属性
      userProperties: [], // 共用用户属性
      userGroupList: [], // 用户分群
    }),
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

function refreshRadioList() {
  void nextTick(() => {
    const propertyList = getLocalStorage<PropertyNode[]>('propertyList')
    setDataList.value = Array.isArray(propertyList) ? propertyList : []
  })
}

function handleOpen(item: ConditionItem) {
  // 关闭所有的弹框
  // 因为fieldType切换 ，需要改变 单选和树形结构 唯一标识 符号
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
  fieldTypeBackup.value = copyObj(String(props.second_item.fieldType ?? '')) //用于类型切换
  props.second_item.fieldType = String(value) //属性类型切换
  handleOpen(props.second_item)
  emit('change', props.second_item)
}

function filterCommonType(type?: string): OptionDef[] | '' {
  if (!type) return ''
  let options: OptionDef[] = []
  // v2 是一串只有 STRING / NUMBER / DATETIME / BOOL 四个 case 的 switch，
  // 每个分支都调同一个 getOptionsByType(type)，等价于直接调用
  options = getOptionsByType(type)
  return options
}

function handleTreechange(node: PropertyNode) {
  const item = props.second_item
  // v2 的 :disable-branch-nodes 由 treeProps.disabled 实现，这里再兜一层
  if (node.children && node.children.length) return
  fieldTypeBackup.value = copyObj(String(item.fieldType ?? ''))
  item.dataType = node.dataType
  item.field = node.name
  if (item.fieldType == 'user_group') {
    item.dataType = 'STRING'
    // 与 v2 一致（v2 此处逻辑存疑：这里写的是布尔 true，而 function 本该是判断方式的 name 字符串；
    // 公共的 views/ups/components/tree-select.vue 里同一分支写的是 'isSet'）
    item.function = true as unknown as string
  } else {
    item.dataType = node.dataType
    item.function = strictMode(filterCommonType(item.dataType), 'name')
  }
  emit('change', item)
}

onMounted(() => {
  void nextTick(() => {
    // 与 v2 一致（v2 此处逻辑存疑：直接把 propertyFeedBack 这个**对象**赋给了要当数组用的 setDataList）
    setDataList.value = (propertyFeedBack.value || []) as unknown as PropertyNode[]
  })
})

defineExpose({ setDataList, refreshRadioList })
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
    <div style="position: relative; margin-left: 20px; overflow: visible">
      <el-tree-select
        :model-value="second_item.field"
        style="width: 250px; margin-bottom: 0px"
        :data="setDataList"
        :props="treeProps"
        :teleported="true"
        filterable
        check-strictly
        :render-after-expand="false"
        placeholder="请选择"
        :clearable="false"
        @node-click="handleTreechange"
        @visible-change="handleVisibleChange"
      >
        <template #header>
          <div class="custom-header" style="z-index: 9000" @click.stop>
            <div style="height: 40px; width: 100%; z-index: 9000">
              <el-radio-group
                v-model="second_item.fieldType"
                class="custom_tabs setRadio"
                style="
                  position: absolute;
                  width: calc(100% - 15px);
                  display: flex;
                  overflow: auto;
                  background-color: #fff;
                  top: 0px;
                  z-index: 6000;
                "
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
          </div>
        </template>
      </el-tree-select>
    </div>
  </div>
</template>

<style lang="scss" scoped>
// v2 这里是 vue-treeselect 的一整套 .vue-treeselect__* 覆盖样式，
// v3 换成 el-tree-select，按同样的数值重写
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

:deep(.el-loading-spinner .circular) {
  height: 38px !important;
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
  font-size: 10px;
}

:deep(.el-radio-button:first-child .el-radio-button__inner) {
  border-radius: 4px;
  font-size: 10px;
}

:deep(.el-radio-button) {
  height: 20px;
  font-size: 12px;
}

:deep(.custom_btn .el-radio-button__original-radio:checked + .el-radio-button__inner) {
  font-size: 10px;
}

:deep(.el-input__wrapper) {
  height: 30px;
  line-height: 30px;
  font-size: 12px;
}

:deep(.el-cascader .el-input__inner) {
  font-size: 12px;
}

:deep(.search_btn .el-input__wrapper) {
  border: 0px;
  border-radius: 0px;
  border-bottom: 1px solid #2c7be5;
}

.el-icon-close:hover {
  color: #2c7be5;
}

.disabled {
  // opacity: 0.5; /* 可以通过修改样式让禁用状态显得更直观 */
  cursor: not-allowed;
}

.circle {
  margin-left: 21px;
  margin-bottom: 20px;
  margin-top: 5px;
  width: 25px;
  height: 25px;
  border-radius: 50%;
  background-color: #fff;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 20px;
  font-weight: 400;
  border: 1px solid #2c7be5;
  color: #2c7be5;
  cursor: pointer;
}

.circle::after {
  content: '+';
}

.use-select-tree {
  width: 300px;
  margin: 100px auto;
}
</style>

<style lang="scss">
/* 树面板的高度限制与选中态，对齐 v2 的 .vue-treeselect__menu / __list / __option--selected */
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
