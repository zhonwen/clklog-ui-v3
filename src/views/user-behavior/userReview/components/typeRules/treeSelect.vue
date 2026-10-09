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
  emit('change', props.second_item)
  // ① 此刻 second_item.fieldType 仍是切换前的 tab（没有用 v-model，不会被提前改掉）
  fieldTypeBackup.value = copyObj(String(props.second_item.fieldType ?? ''))
  // ② 写入新 tab
  props.second_item.fieldType = String(value)
  // ③ 按新 tab 刷新下拉数据
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
  // 分支节点（有子节点的分类）不可选，只负责展开/收起
  if (node.children && node.children.length) return
  // 分类（含没有子节点的空分类）不是可选项；用接口的 tag 字段判断。
  // 详见 ups/components/tree-select.vue 的同处注释。
  if (item.fieldType == 'user_tag' && node.tag !== true) return
  emit('change', item)
  // 群画像需要用到 displayName 作为名称
  if (props.typePath) {
    item.displayName = node.displayName
  }
  fieldTypeBackup.value = copyObj(String(item.fieldType ?? ''))
  if (item.fieldType == 'user_tag') {
    // 标签正常都带 tableName；个别数据缺失时回落到 name
    item.field = node.tableName || node.name
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
        :data="treeData"
        :props="treeProps"
        :teleported="!cloleAppendBody"
        filterable
        :render-after-expand="false"
        placeholder="请选择"
        :clearable="false"
        @node-click="handleTreechange"
        @visible-change="handleVisibleChange"
      >
        <template #header>
          <div class="custom-header" @click.stop>
            <el-radio-group
              :model-value="second_item.fieldType"
              class="custom_tabs setRadio"
              style="display: flex; overflow: auto; background-color: #fff"
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

// v2 的 .el-radio-button { height: 20px; font-size: 12px }，迁移时漏了，tab 行高因此偏高
:deep(.el-radio-button) {
  height: 20px;
  font-size: 12px;
}

:deep(.el-radio-button:last-child .el-radio-button__inner) {
  border-radius: 4px;
}

:deep(.el-radio-button:first-child .el-radio-button__inner) {
  border-radius: 4px;
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
