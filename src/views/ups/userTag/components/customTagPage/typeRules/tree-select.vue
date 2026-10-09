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

/**
 * 「空分类」的占位子节点标记。
 *
 * 后端 UserCategoryServiceImpl.listTreeOperation 的建树规则：
 *   - 分类用 3 参构造器（tag=false），且 DTO 里 children 初始化成 new ArrayList<>()
 *     —— 所以**每个分类都会序列化出 children 数组**，没有子分类时就是 []
 *   - 标签用 6 参构造器（tag=true，带 tableName），且只挂在「没有子分类」的分类下
 * 因此「children 为空数组」= 一个标签都没有的空分类。
 *
 * v2 的 vue-treeselect 对这种节点的处理是：**仍然渲染成可展开节点**，
 * 展开后显示它内置的 "No sub-options." 提示（见线上 pro.clklog.com 的表现）。
 * 这样用户点得动、也能看懂「这个分类是空的」，比直接置灰友好。
 * el-tree-select 没有这个内置提示，这里用一条禁用的占位子节点还原同样的交互。
 */
const NO_SUB_FLAG = '__noSubOptions__'
/** 与 v2 的 vue-treeselect 一致，保持原文案 */
const NO_SUB_TEXT = 'No sub-options.'

/**
 * 给空分类补一条占位子节点。
 * 判据是「有没有 children 这个字段」而不是长度：
 * transform 里标签走 `if (!item.tag && item.children)` 分支，压根不会被赋 children，
 * 所以 children === undefined 是标签（真叶子），children.length === 0 才是空分类。
 */
function withNoSubPlaceholder(list: PropertyNode[]): PropertyNode[] {
  return list.map((node) => {
    const children = node.children
    if (!children) return node
    if (children.length === 0) {
      return {
        ...node,
        children: [
          {
            name: `${node.name ?? ''}${NO_SUB_FLAG}`,
            displayName: NO_SUB_TEXT,
            [NO_SUB_FLAG]: true,
          } as PropertyNode,
        ],
      }
    }
    return { ...node, children: withNoSubPlaceholder(children) }
  })
}

/** 真正喂给 el-tree-select 的数据：空分类补上占位子节点 */
const treeData = computed(() => withNoSubPlaceholder(setDataList.value))

/**
 * el-tree-select 的字段映射，等价于 v2 的 normalizer。
 * 只禁用占位节点本身（它不是可选项）；分类不再置灰 —— 空分类靠展开后的提示来表达。
 */
const treeProps = {
  value: 'name',
  label: 'displayName',
  children: 'children',
  disabled: (data: PropertyNode) =>
    (data as Record<string, unknown>)[NO_SUB_FLAG] === true,
}

/*
 * 这里**不能**把 v2 的 :disable-branch-nodes="true" 直译成 props.disabled。
 *
 * vue-treeselect 的该选项只是「父节点不可选」，点父节点依然展开/收起；
 * element-plus 的 el-tree-select 里，分支一旦 disabled，点击就彻底没反应 ——
 * 见 element-plus/es/components/tree-select/src/tree.mjs 的 onNodeClick：
 *     if (!showCheckbox && (checkStrictly || node.isLeaf)) {
 *       if (!disabled) { 选中 }            // ← 禁用：不选中
 *     } else if (expandOnClickNode) { 展开 } // ← 也走不到这里
 * 而且 expandOnClickNode 还被 computed(() => !checkStrictly && expandOnClickNode) 强制关掉，
 * 所以「check-strictly + disabled 分支」这对组合 = 父节点置灰且完全点不动，只能点那个很小的三角。
 *
 * 正确做法是**同时去掉 check-strictly 和 disabled**：
 * 此时 onNodeClick 的判断变成 (false || node.isLeaf) ——
 *   叶子 → 选中；分支 → 落到 else 分支展开/收起。
 * 这恰好就是 v2 vue-treeselect 的语义，且不需要任何额外代码。
 * 本组件没有用 checkbox（showCheckbox 为假），check-strictly 对其它行为无影响。
 */

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

/**
 * 切换「用户属性 / 用户标签」这类 tab。对齐 v2 的时序：
 *     this.fieldType = copyObj(item.fieldType);   // ① 先备份切换前的 tab
 *     item.fieldType = event.target.value;        // ② 再写入新 tab
 *     this.handleOpen(...)                        // ③ 按新 tab 刷新数据源
 * 备份值由 handleClose 使用：下拉关闭时若 tab 变了却没真正选过节点，就还原回上一次的 tab。
 *
 * 这里**不能**用 `v-model` + `@change`：
 * element-plus 的 el-radio-group 是先同步 emit update:modelValue、再在 nextTick emit change，
 * 所以 change 回调里 second_item.fieldType 已经是新值了，①备份到的是新值 ——
 * handleClose 的 `backup != fieldType` 永远不成立，还原逻辑等于废掉
 *（实测：v-model+@change 回调里拿到的 item.fieldType 就是新值；
 *   :model-value + @update:model-value 回调里仍是旧值）。
 * 因此改成单向绑定 + @update:model-value，由本函数自己写入新值，时序才和 v2 一致。
 */
function handleRandioType(value: string | number | boolean | undefined) {
  // ① 此刻 second_item.fieldType 仍是切换前的 tab（没有用 v-model，不会被提前改掉）
  fieldTypeBackup.value = copyObj(String(props.second_item.fieldType ?? ''))
  // ② 写入新 tab
  props.second_item.fieldType = String(value)
  // ③ 按新 tab 刷新下拉数据
  handleOpen(props.second_item)
  // 本文件 v2 原件就是把 change 放在最后，与公共那份的顺序不同，保持原样
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
  // 分支节点（有子节点的分类）不可选，只负责展开/收起
  if (node.children && node.children.length) return
  // 分类（含没有子节点的空分类）不是可选项；用接口的 tag 字段判断。
  // 本文件存的是 node.name（= tableName || 分类 id），不拦的话会把分类 id 当标签存进去。
  // 详见 ups/components/tree-select.vue 的同处注释。
  if (item.fieldType == 'user_tag' && node.tag !== true) return
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
        :data="treeData"
        :props="treeProps"
        :teleported="true"
        filterable
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
                :model-value="second_item.fieldType"
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
                @update:model-value="handleRandioType"
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

/*
 * tab 按钮字号。v2 这一块的净效果是**所有**按钮 10px：
 *     .el-radio-button--medium .el-radio-button__inner { font-size: 10px !important; }   ← 带 !important
 *     .el-radio-button--medium .el-radio-button__inner { padding: 6px; font-size: 13px; } ← 13px 被上面盖掉
 * （v2 产物里共 26 个组件带这条 !important 规则，逐个核对过）
 * 迁移时按「first/last 10px、其余 13px」拆开写了，三个及以上 tab 时字号就不一致。
 * element-plus 没有 --medium 后缀，这里直接把净效果写在基础规则上。
 */
:deep(.el-radio-button__inner) {
  border-left: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 6px;
  font-size: 10px;
}

:deep(.el-radio-button:last-child .el-radio-button__inner) {
  border-radius: 4px;
}

:deep(.el-radio-button:first-child .el-radio-button__inner) {
  border-radius: 4px;
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
