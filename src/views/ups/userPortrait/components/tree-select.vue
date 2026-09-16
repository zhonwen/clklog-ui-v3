<script setup lang="ts">
/**
 * 群画像「画像信息」的属性选择列表（对应 v2 `views/ups/userPortrait/components/tree-select.vue`）。
 *
 * 它本身不是树控件，而是一个 measures 列表的包装：每一项渲染一个公共树选择
 * `@/views/ups/components/tree-select.vue`（v2 基于 @riophae/vue-treeselect，v3 已改写成 el-tree-select），
 * 右上角一个删除按钮，末尾一个圆形「+」新增按钮。
 *
 * v2 该文件里还留着一整套 vue-treeselect 时代的遗留方法
 * （normalizer / handleOpen / handleClose / handleRandioType / handleTreechange /
 *  getCategoryApi / handleHeaderClick），模板里没有任何地方绑定它们，也没有别的文件调用，
 * 这些能力现在都在公共 tree-select 内部完成，因此不再搬运；真正被调用的
 * editPortraitEvent / refreshRadioList / handleClear / circleAddEvent / pointProtoFilter 全部照迁。
 * 同理，v2 的 `<style>` 里大段 `.vue-treeselect__*` 覆盖样式在 v3 已无对应 DOM，不再搬运。
 */
import { computed, onMounted, ref } from 'vue'
import { Close } from '@element-plus/icons-vue'
import treeSelect from '@/views/ups/components/tree-select.vue'
import type { ConditionItem, PropertyListMap, PropertyNode, RadioOption } from '../types'

defineOptions({ name: 'selectTree' })

const props = withDefaults(
  defineProps<{
    pointProtoList?: PropertyNode[]
    propertyList?: Partial<PropertyListMap>
    pointTypeList?: {
      userProtoList?: PropertyNode[]
      eventProtoList?: PropertyNode[]
      userGroupList?: PropertyNode[]
    }
  }>(),
  {
    pointProtoList: () => [],
    propertyList: () => ({
      commonPropertySum: [], // 共用事件属性
      userProperties: [], // 共用用户属性
      userGroupList: [], // 用户分群
    }),
    pointTypeList: () => ({ userProtoList: [], eventProtoList: [] }),
  },
)

/** 画像信息的模型规则。字段名与 v2 完全一致，会被 JSON 序列化后提交 */
interface PortraitMeasureModel {
  measures: ConditionItem[]
  filters: {
    type: string
    count: number
    sort: string
  }
}

const radioOptions: RadioOption[] = [
  // { label: "事件属性", value: "event_property" },
  { label: '用户属性', value: 'user_property' },
  // { label: "用户分群", value: "user_group" },
  { label: '用户标签', value: 'user_tag' },
]

// 标签属性模型规则
const modelObject = ref<PortraitMeasureModel>({
  measures: [],
  filters: {
    type: 'bar',
    // count: 10,
    count: 10,
    sort: 'count_desc',
  },
})

const tagTreeList = ref<PropertyNode[]>([])
const setDataList = ref<PropertyNode[]>([])
const addBtn = ref(true)

const isDisabled = computed(() => modelObject.value.measures.length > 11)

/** 模板里 v2 是 `:pointProtoList="pointProtoFilter()"`，这里提成 computed 避免重复求值 */
const pointProtoFilter = computed<PropertyNode[]>(() => props.propertyList.commonPropertySum || [])

/**
 * 数组合并 - 解决删除类型别的参数无法识别的 bug。
 * 与 v2 一致（v2 此处逻辑存疑：setDataList 算完之后模板里并没有任何地方用到它，
 * 属性数据源实际由公共 tree-select 自己按 fieldType 取；这里照搬以免漏掉将来可能的依赖）。
 */
function refreshRadioList() {
  const mergedArray = tagTreeList.value.concat(props.pointTypeList.userGroupList || [])
  setDataList.value = mergedArray.concat(props.pointTypeList.userProtoList || [])
}

function editPortraitEvent(updateItem?: { formula?: unknown } | '' | null) {
  if (updateItem) {
    // 画像信息的 formula 在父组件里已经是解析好的对象，这里按 v2 直接整体赋值
    const formula = updateItem.formula as PortraitMeasureModel | undefined
    if (formula) {
      modelObject.value = formula
    }
    addBtn.value = false
    refreshRadioList()
  } else {
    addBtn.value = true
    modelObject.value.measures = []
  }
}

function handleClear(index: number) {
  // 处理清除逻辑
  modelObject.value.measures.splice(index, 1)
  // 数组合并 - 解决删除类型别的参数无法识别的bug
  refreshRadioList()
}

function circleAddEvent() {
  if (modelObject.value.measures && modelObject.value.measures.length > 11) return
  // 设置默认值
  const optionZero = props.propertyList.userProperties?.[0]
  // 与 v2 一致（v2 此处逻辑存疑：直接读 userProperties[0] 的属性，属性列表为空时会抛
  // "Cannot read properties of undefined"；v3 开了 noUncheckedIndexedAccess，这里兜成空字符串）
  modelObject.value.measures.push({
    fieldType: 'user_property',
    dataType: optionZero?.dataType,
    field: optionZero?.name,
    displayName: optionZero?.displayName,
  })
}

onMounted(() => {
  modelObject.value.measures = []
})

defineExpose({ editPortraitEvent, refreshRadioList, modelObject })
</script>

<template>
  <div
    style="
      display: flex;
      align-items: center;
      width: 100%;
      flex-wrap: wrap;
      box-sizing: border-box;
    "
  >
    <div v-for="(item, index) of modelObject.measures" :key="index">
      <div style="position: relative; margin-left: 20px; margin-bottom: 15px">
        <treeSelect
          type-path="groupPortrait"
          :clole-append-body="true"
          :radio-options="radioOptions"
          :second_item="item"
          :property-list="propertyList"
          :second_index="index"
          :point-proto-list="pointProtoFilter"
        />
        <el-icon
          class="el-icon-close"
          style="position: absolute; right: 25px; top: 10px; cursor: pointer"
          @click="handleClear(index)"
        >
          <Close />
        </el-icon>
      </div>
    </div>
    <!-- 按钮 -->
    <div
      v-if="addBtn"
      class="circle"
      :style="isDisabled ? 'cursor:not-allowed;opacity: 0.5;' : 'cursor:pointer;'"
      @click="circleAddEvent()"
    ></div>
  </div>
</template>

<style scoped lang="scss">
:deep(.custom-select-width .el-select-dropdown) {
  width: 500px; /* 设置你想要的宽度 */
}

:deep(.el-loading-spinner .circular) {
  height: 38px !important;
}

:deep(.el-input__inner::placeholder) {
  font-size: 11px;
}

:deep(.el-select .el-input .el-select__caret) {
  line-height: 30px;
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

:deep(.el-cascader .el-input .el-input__inner) {
  font-size: 12px;
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
  margin-bottom: 15px;
  // margin-top: 5px;
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

.el-select-dropdown__item {
  padding: 0;
  height: auto;
}

.el-tree {
  height: 190px;
  overflow: scroll;
}
</style>
