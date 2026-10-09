<template>
  <div class="box-card">
    <div
      class="titleHead"
      style="
        margin-top: 15px;
        display: flex;
        align-items: flex-start;
        line-height: 30px;
        box-sizing: content-box;
        width: 100%;
      "
    >
      <div class="headTitle" style="width: 100px; box-sizing: border-box; white-space: nowrap">
        查看维度
      </div>
      <div
        v-if="modelObject.byFields.length >= 0"
        style="display: flex; flex-wrap: wrap; box-sizing: border-box"
      >
        <div
          v-for="(dimenItem, index) in modelObject.byFields"
          :key="index"
          style="box-sizing: border-box"
        >
          <div style="display: flex; justify-content: flex-start">
            <el-select
              :ref="(el: RefEl) => setDimensionSelectRef(el, index)"
              v-model="dimenItem.fieldFlag"
              class="custom_select"
              filterable
              :no-data-text="''"
              style="height: 32px; position: relative; margin-bottom: 10px"
              placeholder="请选择"
              @visible-change="handleVisibleDimension($event, index)"
              @change="handleDimensionFieldTypeChange(index)"
            >
              <div style="height: 40px; width: 300px; overflow: auto">
                <el-radio-group
                  v-model="dimenItem.propertyName"
                  class="custom_tabs"
                  style="
                    position: absolute;
                    width: calc(100% - 15px);
                    white-space: nowrap;
                    overflow: auto;
                    overflow-y: hidden;
                    height: 44.5px;
                    line-height: 44.5px;
                    background-color: #fff;
                    top: 0;
                    z-index: 600;
                  "
                >
                  <!-- 事件选项 -->
                  <template v-if="eventRadioButtons.length > 0">
                    <el-radio-button
                      v-for="option in eventRadioButtons"
                      :key="option.key"
                      :value="option.label"
                      style="margin-right: 10px"
                    >
                      {{ option.text }}
                    </el-radio-button>
                  </template>
                  <!-- 用户属性选项 -->
                  <el-radio-button :key="userPropertyOption.key" :value="userPropertyOption.label">
                    {{ userPropertyOption.text }}
                  </el-radio-button>
                </el-radio-group>
              </div>
              <!-- 维度list -->
              <el-option
                v-for="(x, xIdx) in dimensionOptionsList[index] ?? []"
                :key="x.name && x.name !== 'NaN' ? x.name + '_' + xIdx : xIdx"
                style="min-width: 250px"
                :label="x.displayName"
                :value="x.name"
              >
                <div @click="checkDimensioFrom(index, x)">
                  {{ x.displayName }}
                </div>
              </el-option>
              <template #empty>
                <div v-if="(dimensionOptionsList[index] ?? []).length == 0">
                  <div class="empty-text" style="width: 300px; overflow: auto">
                    <el-radio-group
                      v-model="dimenItem.propertyName"
                      class="custom_tabs"
                      style="display: flex"
                    >
                      <!-- 事件选项 -->
                      <template v-if="eventRadioButtons.length > 0">
                        <el-radio-button
                          v-for="option in eventRadioButtons"
                          :key="option.key"
                          :value="option.label"
                          style="margin-right: 10px"
                        >
                          {{ option.text }}
                        </el-radio-button>
                      </template>
                      <!-- 用户属性选项 -->
                      <el-radio-button
                        :key="userPropertyOption.key"
                        :value="userPropertyOption.label"
                      >
                        {{ userPropertyOption.text }}
                      </el-radio-button>
                    </el-radio-group>
                  </div>
                  <div class="select_empty">暂无数据</div>
                </div>
              </template>
            </el-select>
            <el-icon class="delete_btn" @click="modelObject.byFields.splice(index, 1)">
              <Close />
            </el-icon>
          </div>
        </div>
        <div
          class="circle"
          :style="modelObject.byFields.length == 1 ? 'margin-left:20px;' : ''"
          @click="addDemisionObj()"
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { Close } from '@element-plus/icons-vue'
import type { SelectInstance } from 'element-plus'
import type {
  ByFieldItem,
  ByFieldsHolder,
  EventGroup,
  FieldTypeItem,
  PropertyItem,
  PropertyListMap,
} from './types'

/**
 * 「查看维度」选择器。
 * 与 v2 的 src/components/analysis-model/fields.vue 一一对应。
 * 与 v2 一致：组件直接就地修改父级传进来的 modelObject.byFields（v2 用 $set，v3 直接赋值）。
 */
const props = withDefaults(
  defineProps<{
    /** 指标类型（漏斗页传的是当前漏斗的 steps） */
    fieldTypeList?: FieldTypeItem[]
    propertyList?: PropertyListMap
    pointProtoList?: EventGroup[]
    modelObject: ByFieldsHolder
  }>(),
  {
    fieldTypeList: () => [],
    propertyList: () => ({ commonPropertySum: [], userProperties: [] }),
    pointProtoList: () => [],
  },
)

/** el-select 的模板 ref 回调参数类型 */
type RefEl = Element | { $el: Element } | null

/** 记录 change 之前的 tab，visible-change 关闭时用来回滚（v2 的 oldProperty） */
const oldProperty = ref('')

/** 每个维度下拉对应的 el-select 实例，用来在切换后把下拉滚动条复位 */
const dimensionSelectRefs = ref<Record<number, SelectInstance | null>>({})
function setDimensionSelectRef(el: RefEl, index: number) {
  dimensionSelectRefs.value[index] = (el as SelectInstance | null) ?? null
}

/** 去除重复事件 */
function filterObjects(arr: FieldTypeItem[]): FieldTypeItem[] {
  if (!Array.isArray(arr)) return []
  const seenEventNames = new Set<string>()
  return arr.filter((obj) => {
    if (!seenEventNames.has(obj.eventName)) {
      seenEventNames.add(obj.eventName)
      return true
    }
    return false
  })
}

const repeatEventList = computed(() => filterObjects(props.fieldTypeList) || [])

/** 生成事件选项的 radio-button */
const eventRadioButtons = computed(() =>
  repeatEventList.value.map((item) => ({
    label: item.eventName,
    key: item.eventName,
    text: item.customName,
  })),
)

/** 用户属性选项 */
const userPropertyOption = computed(() => ({
  label: 'user_property',
  key: 'user_property',
  text: '用户属性',
}))

/** 测试维度 用户回显 */
function checkDimensionTest(dimenItem: ByFieldItem): PropertyItem[] {
  if (dimenItem.propertyName === 'user_property') {
    // 用户属性
    return props.propertyList.userProperties || []
  }
  // 事件下的一些列子数据
  const newProtoList: PropertyItem[] = []
  props.pointProtoList.forEach((item) => {
    item.events.forEach((subItem) => {
      if (subItem.name === dimenItem.propertyName) {
        newProtoList.push(...(subItem.propertyList || []))
      }
    })
  })
  return newProtoList
}

/**
 * 每个维度下拉的可选项。
 * v2 在模板里对同一个 checkDimensionTest(dimenItem) 调用了两次（list + empty 插槽），
 * 这里改成按 byFields 下标对齐的 computed，结果与 v2 完全一致。
 */
const dimensionOptionsList = computed(() => props.modelObject.byFields.map(checkDimensionTest))

/** 添加维度 */
function addDemisionObj() {
  // 与 v2 一致（v2 此处逻辑存疑：先从 propertyList.commonPropertySum 算了一个 initSelectObj，
  // 但下面 push 的对象根本没用它，属于无效代码，这里不再保留）
  const demisionSing: ByFieldItem = {
    propertyName: repeatEventList.value.length > 0 ? (repeatEventList.value[0]?.eventName ?? '') : '',
    field: '',
    fieldFlag: '',
    dataType: '',
    fieldType: 'event_property',
  }
  props.modelObject.byFields.push(demisionSing)
}

/** 维度-select 展开 / 关闭 */
function handleVisibleDimension(visible: boolean, index: number) {
  const current = props.modelObject.byFields[index]
  if (!current) return
  if (visible) {
    oldProperty.value = current.propertyName
  } else {
    current.propertyName = oldProperty.value
    // 关闭时未选中 list 恢复 fieldType
    if (oldProperty.value === 'user_property') {
      current.fieldType = 'user_property'
    } else {
      current.fieldType = 'event_property'
    }
  }
}

function handleDimensionFieldTypeChange(index: number) {
  resetSelectDropdownScroll(index)
}

/**
 * 把下拉的滚动条复位。
 * v2 走的是 selectRef.$refs.scrollbar.$refs.wrap，element-plus 里换成了组件实例上暴露的
 * scrollbarRef.wrapRef，语义（scrollTop = 0）完全一致。
 */
function resetSelectDropdownScroll(index: number) {
  void nextTick(() => {
    const wrap = dimensionSelectRefs.value[index]?.scrollbarRef?.wrapRef
    if (wrap) wrap.scrollTop = 0
  })
}

/** 维度列表 options 选择事件 */
function checkDimensioFrom(index: number, x: PropertyItem) {
  const current = props.modelObject.byFields[index]
  if (!current) return
  // 根据 propertyName 判断并设置 fieldType
  if (current.propertyName === 'user_property') {
    current.fieldType = 'user_property'
  } else {
    current.fieldType = 'event_property'
  }
  current.name = x.displayName
  current.dataType = x.dataType ?? ''

  let fieldCon = ''
  if (x.name) {
    if (current.propertyName === 'user_property') {
      fieldCon = x.name
    } else {
      fieldCon = `${current.propertyName}.${x.name}`
    }
  }

  current.field = fieldCon
  // 用于赋值 tab 项
  oldProperty.value = current.propertyName
}
</script>

<style lang="scss" scoped>
// 基础样式
p {
  white-space: nowrap;
  padding: 0;
  margin: 0;
}

.titleHead {
  color: #6d6e70;
  font-size: 13px;
}

.headTitle {
  width: 80px;
  height: auto;
}

// 空状态样式
.empty-text {
  display: flex;
  text-align: center;
  color: #909399;
  padding: 10px 0;
  margin-bottom: 10px;
}

.select_empty {
  text-align: center;
  margin-bottom: 10px;
  font-size: 12px;
  color: #909399;
}

// 字母样式
.letter_lower {
  font-size: 14px;
  line-height: 30px;
}

.btn_line {
  width: 1px;
  height: 100%;
  border-right: 1px solid rgb(218, 217, 217);
}

// 深度选择器样式（v2 是 ::v-deep { ... } 包一层，v3 逐条 :deep()）
:deep(.el-loading-spinner .circular) {
  height: 38px !important;
}

:deep(.el-input__inner::placeholder) {
  font-size: 11px;
}

:deep(.el-input-number.is-controls-right[class*='medium'] [class*='increase']),
:deep(.el-input-number.is-controls-right[class*='medium'] [class*='decrease']) {
  line-height: 12px;
  margin-top: 3px;
}

:deep(.custom_btn .el-radio-button__orig-radio:checked + .el-radio-button__inner) {
  font-size: 10px;
}

:deep(.custom_btn .el-radio-button:last-child .el-radio-button__inner) {
  font-size: 10px;
}

:deep(.el-radio-button:first-child .el-radio-button__inner) {
  font-size: 10px;
}

// v2 是 .el-radio-button--medium .el-radio-button__inner { font-size: 10px !important }，
// element-plus 没有 --medium 后缀，原样照搬是条死规则 —— 它的作用是把**所有** tab 压到 10px
//（后面那条 13px 正是被它盖掉的），这里换成 EP 能命中的选择器。
:deep(.el-radio-button__inner) {
  font-size: 10px !important;
}

:deep(.el-select .el-input .el-select__caret) {
  line-height: 30px;
}

:deep(.el-select-dropdown__list) {
  padding: 0 0 6px;
}

:deep(.el-radio-group) {
  margin: 0 5px;
}

:deep(.el-radio-button__inner) {
  border-left: 1px solid #dcdfe6;
  border-radius: 4px;
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

// 同上：--medium 在 element-plus 不存在，这条照搬过来也是死的，
// 导致 tab 丢了 padding: 6px（退回 EP 默认的 8px 15px，按钮比 v2 大一圈）。
// 换成能命中的选择器；font-size 仍保留 13px —— 它在 v2 里本就被上面那条 10px !important 盖掉，
// 这里保持同样的层叠关系，最终生效的还是 10px。
:deep(.el-radio-button__inner) {
  padding: 6px;
  font-size: 13px;
}

:deep(.el-input--medium .el-input__inner) {
  height: 30px;
  line-height: 30px;
  font-size: 12px;
}

:deep(.el-cascader .el-input .el-input__inner) {
  font-size: 12px;
}

// 匹配不到样式隐藏
:deep(.el-select-dropdown__empty) {
  display: none !important;
}

:deep(.custom_btn) {
  padding: 1px 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;

  .el-radio-button:first-child .el-radio-button__inner {
    border-radius: 4px 4px 0 0;
  }

  .el-radio-button:last-child .el-radio-button__inner {
    border-radius: 0 0 4px 4px;
  }

  .el-radio-button--small .el-radio-button__inner {
    padding: 5px;
  }

  .el-radio-button__orig-radio:checked + .el-radio-button__inner {
    color: #ffffff;
    background-color: #619ff3;
    border-color: #619ff3;
    -webkit-box-shadow: -1px 0 0 0 #619ff3;
    box-shadow: -1px 0 0 0 #619ff3;
  }
}

// 卡片容器样式
.box-card {
  // 指标间距
  .pointer_spacing {
    margin-left: 80px;
  }

  .el-icon-plus {
    color: #2c7be5;
    font-size: 13px;
    margin-top: 3px;
    padding-left: 37px;
    box-sizing: border-box;
    cursor: pointer;
  }

  .eg_letters {
    color: rgb(101, 100, 100);
    width: 30px;
    height: 30px;
    font-size: 14px;
    display: flex;
    justify-content: center;
    align-items: center;
    font-weight: 400;
    margin-right: 10px;
  }

  .default_font {
    color: #fff;
    font-size: 14px;
  }

  .delete_btn:hover {
    color: #2c7be5;
  }

  .add_icon {
    cursor: pointer;
    font-size: 30px;
    font-weight: 400;
    margin-top: 15px;
    color: rgb(225, 225, 225);
  }

  .delete_btn {
    cursor: pointer;
    font-size: 16px;
    margin: 0 8px;
    line-height: 30px;
    // v3 的 <el-icon> 是 inline-flex + height:1em，line-height 撑不开盒子；
    // 用同值 height 还原 v2 字体图标的垂直居中（el-icon 自带 align-items:center）
    height: 30px;
    margin-top: 5px;
    color: rgb(188, 188, 188);
  }

  .circle {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background-color: #fff;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 20px;
    font-weight: 400;
    border: 1px solid #2c7be5;
    margin-top: 5px;
    color: #2c7be5;
    cursor: pointer;

    &::after {
      content: '+';
    }
  }
}
</style>
