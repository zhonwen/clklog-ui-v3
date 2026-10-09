<template>
  <div class="box-card">
    <div>
      <!-- 全局筛选 -->
      <el-row>
        <div
          v-if="modelObject.filter.filters.length > 1"
          style="
            color: gray;
            font-size: 13px;
            position: absolute;
            left: 0px;
            height: calc(100% - 15px);
            display: flex;
            top: 0px;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 666;
          "
        >
          <div class="btn_line"></div>
          <el-radio-group v-model="modelObject.filter.relation" size="small" class="custom_btn">
            <el-radio-button value="and">且</el-radio-button>
            <!-- 与 v2 一致：「或」在 v2 里是注释掉的 -->
          </el-radio-group>
          <div class="btn_line"></div>
        </div>

        <div v-if="modelObject.filter.filters.length > 0">
          <div
            v-for="(secondP_item, secondP_index) in modelObject.filter.filters"
            :key="secondP_index"
            style="position: relative"
          >
            <div v-if="secondP_item.conditions.length > 1">
              <div
                class="letter_lower"
                style="
                  position: absolute;
                  left: 40px;
                  display: flex;
                  align-items: center;
                  height: calc(100% - 15px);
                "
              >
                {{ getLetterByIndex(secondP_index) }}
              </div>
              <div
                style="
                  color: gray;
                  font-size: 13px;
                  position: absolute;
                  left: 50px;
                  display: flex;
                  height: calc(100% - 15px);
                  top: 0px;
                  flex-direction: column;
                  justify-content: center;
                  align-items: center;
                  z-index: 666;
                "
              >
                <div class="btn_line" />
                <el-radio-group v-model="secondP_item.relation" size="small" class="custom_btn">
                  <el-radio-button value="and">且</el-radio-button>
                  <el-radio-button value="or">或</el-radio-button>
                </el-radio-group>
                <div class="btn_line" />
              </div>
            </div>
            <div
              v-for="(second_item, second_index) in secondP_item.conditions"
              :key="second_index"
              style="margin-left: 0px; display: flex; margin-bottom: 10px"
              :style="
                modelObject.filter.filters.length == 1 &&
                (modelObject.filter.filters[0]?.conditions.length ?? 0) < 2
                  ? 'margin-left: 0px;'
                  : 'margin-left: 40px;'
              "
            >
              <div v-if="secondP_item.conditions.length > 1">
                <div
                  style="display: flex; padding-top: 0px; align-items: flex-start; margin-left: 45px"
                >
                  <el-select
                    v-model="second_item.fieldFlag"
                    class="custom_select"
                    filterable
                    :no-data-text="''"
                    style="min-width: 100px; height: 32px; position: relative"
                    placeholder="请选择"
                    @visible-change="handleVisibleChangeNew($event, secondP_item, second_index)"
                  >
                    <div style="height: 40px; width: 100%">
                      <el-radio-group
                        v-model="second_item.propertyName"
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
                        <el-radio-button
                          v-for="(item, idx) in repeatEventList"
                          :key="item.eventName + '_' + idx"
                          :value="item.eventName"
                          style="margin-right: 10px"
                          >{{ item.customName }}</el-radio-button
                        >
                        <el-radio-button
                          v-show="propertyList.userProperties.length > 0"
                          value="user_property"
                          >用户属性</el-radio-button
                        >
                      </el-radio-group>
                    </div>
                    <el-option
                      v-for="(x, xIdx) in dimensionOptionsList[secondP_index]?.[second_index] ?? []"
                      :key="x.name + '_' + xIdx"
                      :label="x.displayName"
                      :value="x.name"
                    >
                      <!-- 用户属性绑定问题解决方案 -->
                      <div
                        @click="
                          checkprototypeFromNew(
                            x,
                            second_item.propertyName ?? '',
                            secondP_item,
                            second_index,
                          )
                        "
                      >
                        {{ x.displayName }}
                      </div>
                    </el-option>
                    <template #empty>
                      <div
                        v-if="
                          (dimensionOptionsList[secondP_index]?.[second_index] ?? []).length == 0
                        "
                      >
                        <div class="empty-text" style="width: 300px; overflow: auto">
                          <el-radio-group
                            v-model="second_item.propertyName"
                            class="custom_tabs"
                            style="display: flex"
                          >
                            <el-radio-button
                              v-for="(item, idx) in repeatEventList"
                              :key="item.eventName + '_' + idx"
                              :value="item.eventName"
                              style="margin-right: 10px"
                              >{{ item.customName }}</el-radio-button
                            >
                            <!-- 与 v2 一致：v2 这里的文案就是「用户属性1」（另一处是「用户属性」） -->
                            <el-radio-button
                              v-show="propertyList.userProperties.length > 0"
                              value="user_property"
                              >用户属性1</el-radio-button
                            >
                          </el-radio-group>
                        </div>
                        <div class="select_empty">暂无数据</div>
                      </div>
                    </template>
                  </el-select>
                  <el-select
                    v-model="second_item.function"
                    placeholder="请选择"
                    style="width: 100px; margin-left: 15px"
                    @change="handleFunctionChange(second_item)"
                  >
                    <el-option
                      v-for="x in filterGlobalSelect(second_item)"
                      :key="x.name"
                      :label="x.displayName"
                      :value="x.name"
                    >
                      <div>
                        {{ x.displayName }}
                      </div>
                    </el-option>
                  </el-select>
                  <div v-if="filterIstrue(second_item.function)">
                    <el-select
                      v-model="second_item.params"
                      style="margin-left: 10px; min-height: 30px; min-width: 350px"
                      class="second_select"
                      multiple
                      filterable
                      allow-create
                      default-first-option
                      placeholder=""
                    >
                      <el-option v-for="x in second_item.params" :key="x" :label="x" :value="x" />
                    </el-select>
                  </div>
                  <condition-option :condition="second_item" />
                  <el-icon
                    class="delete_btn"
                    style="line-height: 30px; margin-top: 5px"
                    @click="threeDeleteEvent(secondP_index, second_index, modelObject.filter.filters)"
                  >
                    <Close />
                  </el-icon>
                </div>
                <div
                  v-if="secondP_item.conditions.length == second_index + 1"
                  style="display: flex; margin-left: 45px"
                >
                  <span
                    class="el-icon-plus"
                    style="padding: 0px 0 0 0"
                    @click="equalityEvent(secondP_index, modelObject.filter)"
                  >
                    <el-icon><Plus /></el-icon>添加过滤条件
                  </span>
                </div>
              </div>
              <div v-else>
                <div style="display: flex; padding-top: 0px; align-items: flex-start">
                  <div class="letter_lower" style="margin-right: 7px">
                    {{ getLetterByIndex(secondP_index) }}
                  </div>
                  <el-select
                    v-model="second_item.fieldFlag"
                    class="custom_select"
                    filterable
                    :no-data-text="''"
                    style="min-width: 100px; height: 32px; position: relative"
                    placeholder="请选择"
                    @visible-change="handleVisibleChangeNew($event, secondP_item, second_index)"
                  >
                    <div style="height: 40px; width: 100%">
                      <!-- 全局筛选 用户回显 -->
                      <el-radio-group
                        v-model="second_item.propertyName"
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
                        <el-radio-button
                          v-for="(item, idx) in repeatEventList"
                          :key="item.eventName + '_' + idx"
                          :value="item.eventName"
                          style="margin-right: 10px"
                          >{{ item.customName }}</el-radio-button
                        >
                        <el-radio-button
                          v-show="propertyList.userProperties.length > 0"
                          value="user_property"
                          >用户属性</el-radio-button
                        >
                      </el-radio-group>
                    </div>
                    <el-option
                      v-for="(x, xIdx) in dimensionOptionsList[secondP_index]?.[second_index] ?? []"
                      :key="x.name + '_' + xIdx"
                      :label="x.displayName"
                      :value="x.name"
                    >
                      <div
                        @click="
                          checkprototypeFromNewTest(
                            x,
                            second_item.propertyName ?? '',
                            secondP_item,
                            second_index,
                          )
                        "
                      >
                        {{ x.displayName }}
                      </div>
                    </el-option>
                    <template #empty>
                      <div
                        v-if="
                          (dimensionOptionsList[secondP_index]?.[second_index] ?? []).length == 0
                        "
                      >
                        <div class="empty-text" style="width: 300px; overflow: auto">
                          <el-radio-group
                            v-model="second_item.propertyName"
                            class="custom_tabs"
                            style="display: flex"
                          >
                            <el-radio-button
                              v-for="(item, idx) in repeatEventList"
                              :key="item.eventName + '_' + idx"
                              :value="item.eventName"
                              style="margin-right: 10px"
                              >{{ item.customName }}</el-radio-button
                            >
                            <el-radio-button
                              v-show="propertyList.userProperties.length > 0"
                              value="user_property"
                              >用户属性</el-radio-button
                            >
                          </el-radio-group>
                        </div>
                        <div class="select_empty">暂无数据</div>
                      </div>
                    </template>
                  </el-select>

                  <el-select
                    v-model="second_item.function"
                    placeholder="请选择"
                    style="width: 100px; margin-left: 15px"
                    @change="handleFunctionChange(second_item)"
                  >
                    <el-option
                      v-for="x in filterGlobalSelect(second_item)"
                      :key="x.name"
                      :label="x.displayName"
                      :value="x.name"
                    >
                      <div>
                        {{ x.displayName }}
                      </div>
                    </el-option>
                  </el-select>
                  <div v-if="filterIstrue(second_item.function)">
                    <el-select
                      v-model="second_item.params"
                      style="margin-left: 15px; min-width: 350px"
                      multiple
                      filterable
                      allow-create
                      default-first-option
                      placeholder=""
                    >
                      <el-option v-for="x in second_item.params" :key="x" :label="x" :value="x">
                        {{ x }}
                      </el-option>
                    </el-select>
                  </div>
                  <!-- 封装组件 -->
                  <condition-option :condition="second_item" />
                  <el-icon
                    class="delete_btn"
                    style="margin-top: 5px"
                    @click="gloabDeleteEvent(secondP_index)"
                  >
                    <Close />
                  </el-icon>
                </div>
                <div v-if="modelObject.filter.filters.length > 1" style="display: flex">
                  <span
                    class="el-icon-plus"
                    style="padding: 0px 0 0 13px"
                    @click="secondLevelEvent(secondP_index, modelObject.filter)"
                  >
                    <el-icon><Plus /></el-icon>添加过滤条件
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <!-- 初始为空 -->
        <div
          v-if="modelObject.filter.filters.length == 0"
          class="circle"
          @click="gloabAddEvent()"
        ></div>
        <div v-else style="display: flex">
          <div
            class="el-icon-plus"
            :style="
              modelObject.filter.filters.length == 1 &&
              (modelObject.filter.filters[0]?.conditions.length ?? 0) < 2
                ? 'padding-left:0'
                : ' '
            "
            @click="gloabAddEvent()"
          >
            <el-icon><Plus /></el-icon>添加过滤条件
          </div>
        </div>
      </el-row>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Close, Plus } from '@element-plus/icons-vue'
import conditionOption from './conditionOption.vue'
import { getOptionsByType, type OptionDef } from '@/utils/modelOptions/custom'
import type {
  ConditionItem,
  EventGroup,
  FieldTypeItem,
  FilterGroup,
  FilterModel,
  GlobalFilterHolder,
  PropertyItem,
  PropertyListMap,
} from './types'

/**
 * 「全局筛选条件」。
 * 与 v2 的 src/components/analysis-model/globalFilter.vue 一一对应。
 * 与 v2 一致：组件直接就地修改父级传进来的 modelObject.filter（v2 用 $set，v3 直接赋值）。
 */
const props = withDefaults(
  defineProps<{
    fieldTypeList?: FieldTypeItem[]
    propertyList?: PropertyListMap
    pointProtoList?: EventGroup[]
    modelObject: GlobalFilterHolder
  }>(),
  {
    fieldTypeList: () => [],
    propertyList: () => ({ commonPropertySum: [], userProperties: [] }),
    pointProtoList: () => [],
  },
)

/** 记录 change 之前的 tab，visible-change 关闭时用来回滚（v2 的 oldProperty） */
const oldProperty = ref('')

/** 去除重复事件（v2 的 repeatEvent + filterObjects；v2 里那句 copyObj 的结果没被用到，省略） */
const repeatEventList = computed<FieldTypeItem[]>(() => {
  const seenEventNames = new Set<string>()
  const filteredArr: FieldTypeItem[] = []
  ;(props.fieldTypeList || []).forEach((obj) => {
    if (!seenEventNames.has(obj.eventName)) {
      seenEventNames.add(obj.eventName)
      filteredArr.push(obj)
    }
  })
  return filteredArr
})

/** 测试维度 用户回显 */
function checkDimensionTest(dimenItem: ConditionItem, propertyName: string): PropertyItem[] {
  if (dimenItem.propertyName == 'user_property') {
    return props.propertyList.userProperties
  }
  let newProtoList: PropertyItem[] = []
  props.pointProtoList.forEach((item) => {
    item.events.forEach((subItem) => {
      if (subItem.name == propertyName) {
        newProtoList = subItem.propertyList || []
      }
    })
  })
  return newProtoList
}

/**
 * 每个条件下拉的可选项，按 [分组下标][条件下标] 对齐。
 * v2 在模板里对同一个 checkDimensionTest(...) 调用了两次（list + empty 插槽），
 * 这里改成 computed，结果与 v2 完全一致。
 */
const dimensionOptionsList = computed(() =>
  props.modelObject.filter.filters.map((group) =>
    group.conditions.map((c) => checkDimensionTest(c, c.propertyName ?? '')),
  ),
)

/** 处理函数切换时清空 second_item */
function handleFunctionChange(second_item: ConditionItem) {
  // 清空 second_item 的相关字段（与 v2 一致：v2 把 field / fieldFlag 的清空注释掉了）
  second_item.params = []
}

function gloabDeleteEvent(secondP_index: number) {
  props.modelObject.filter.filters.splice(secondP_index, 1)
  if (props.modelObject.filter.filters.length < 2) {
    delete props.modelObject.filter.relation
  }
}

function getLetterByIndex(index: number) {
  if (index < 0 || index >= 26) {
    return String.fromCharCode(65 + (index % 26))
  }
  return String.fromCharCode(65 + index) // 65 是大写字母 A 的 ASCII 编码
}

function handleVisibleChangeNew(visible: boolean, secondP_item: FilterGroup, second_index: number) {
  const condition = secondP_item.conditions[second_index]
  if (!condition) return
  if (visible) {
    oldProperty.value = condition.propertyName ?? ''
  } else {
    condition.propertyName = oldProperty.value
  }
  condition.fieldType = showGloabTabType(condition.propertyName ?? '')
}

/** 与 v2 一致：user_property 与事件属性走的是同一个分支 */
function filterGlobalSelect(item: ConditionItem): OptionDef[] {
  return checkTypeArray(item)
}

function checkTypeArray(item: ConditionItem): OptionDef[] {
  return getOptionsByType(item.dataType)
}

/** 时间区间等条件不需要额外的多选取值框 */
function filterIstrue(item?: string) {
  let flag = true
  if (
    item == 'isTrue' ||
    item == 'isFalse' ||
    item == 'isSet' ||
    item == 'notSet' ||
    item == 'isEmpty' ||
    item == 'isNotEmpty' ||
    // 正则匹配
    item == 'between' ||
    item == 'queal' ||
    item == 'notQueal' ||
    // 相对时间
    item == 'absolute_between' ||
    item == 'extract_between' ||
    item == 'relative_within' ||
    item == 'relative_between' ||
    item == 'relative_event_time'
  ) {
    flag = false
  }
  return flag
}

function threeDeleteEvent(secondP_index: number, second_index: number, three_list: FilterGroup[]) {
  three_list[secondP_index]?.conditions.splice(second_index, 1)
}

/** 全局过滤属性展开与显示 */
function checkprototypeFromNew(
  item: PropertyItem,
  type: string,
  secondP_item: FilterGroup,
  second_index: number,
) {
  const condition = secondP_item.conditions[second_index]
  if (!condition) return
  condition.propertyName = type
  condition.dataType = item.dataType
  const dataType = item.dataType || ''
  condition.function = strictMode(filterCommonType(dataType), 'name')
  // 设置 steps.prototype 拼接后端用于筛选
  if (type != 'user_property') {
    condition.field = condition.propertyName + '.' + item.name
  } else {
    condition.field = item.name
  }
  // 保存 change 时的位置
  oldProperty.value = type
}

/**
 * 与 checkprototypeFromNew 的差别只在于多写了一次 fieldFlag（单条件那一栏在用）。
 * v2 的第 5 个实参 value 在函数体里没有被使用，这里不再传。
 */
function checkprototypeFromNewTest(
  item: PropertyItem,
  type: string,
  secondP_item: FilterGroup,
  second_index: number,
) {
  const condition = secondP_item.conditions[second_index]
  if (!condition) return
  condition.propertyName = type
  condition.dataType = item.dataType
  const dataType = item.dataType || ''
  if (type != 'user_property') {
    condition.field = condition.propertyName + '.' + item.name
  } else {
    condition.field = item.name
  }

  condition.function = strictMode(filterCommonType(dataType), 'name')
  condition.fieldFlag = item.name

  // 保存 change 时的位置
  oldProperty.value = type
}

/** 新增条件时的初始事件名（v2 里同时算了一份 newProtoList，但没有被使用，省略） */
function initEventNameForNew(): string {
  return repeatEventList.value.length > 0 ? (repeatEventList.value[0]?.eventName ?? '') : ''
}

/** 新增条件的默认对象（v2 的 equalityEvent / secondLevelEvent / gloabAddEvent 用的是同一份字面量） */
function makeDefaultCondition(): ConditionItem {
  const initEventName = initEventNameForNew()
  return {
    field: ' ',
    dataType: '', // 类型
    propertyName: initEventName, // 设置类型标识
    fieldType: showGloabTabType(initEventName),
    fieldFlag: '', // 回显 option
    function: strictMode(filterCommonType(''), 'name'),
    params: [],
  }
}

/** 平级事件（v2 的 second_index / model 两个形参在函数体里没有被使用，这里不再传） */
function equalityEvent(secondP_index: number, three_list: FilterModel) {
  three_list.filters.forEach((item, index) => {
    if (index == secondP_index) {
      item.conditions[item.conditions.length] = makeDefaultCondition()
    }
  })
}

/** 增加默认值 */
function secondLevelEvent(secondP_index: number, second_list: FilterModel) {
  const addObj = makeDefaultCondition()
  second_list.filters.forEach((item, index) => {
    if (secondP_index == index) {
      item.relation = 'and'
      item.conditions.push(addObj)
    }
  })
}

function gloabAddEvent() {
  // 设置初始默认值
  props.modelObject.filter.filters.push({
    conditions: [makeDefaultCondition()],
  })
  if (props.modelObject.filter.filters.length > 1) {
    props.modelObject.filter.relation = 'and'
  }
}

function showGloabTabType(tabFrom: string): 'event_property' | 'user_property' {
  // 判断 fieldTypeList 数组对象中是否有对象的 eventName 等于 tabFrom
  if (Array.isArray(props.fieldTypeList)) {
    const found = props.fieldTypeList.some((item) => item.eventName === tabFrom)
    return found ? 'event_property' : 'user_property'
  }
  return 'user_property'
}

/** 严格检验字段模式 */
function strictMode(val: OptionDef[], label: keyof OptionDef): string {
  if (val && val.length > 0) {
    return val[0]?.[label] ?? ''
  }
  return ''
}

/**
 * 与 v2 一致：type 为空时 v2 返回的是 ""，调用方只用 strictMode 判 length，
 * 返回 [] 与返回 "" 行为完全相同，这里统一成数组以便定型。
 */
function filterCommonType(type?: string): OptionDef[] {
  if (!type) return []
  return getOptionsByType(type)
}
</script>

<style lang="scss">
.headTitle {
  width: 80px;
  line-height: 30px;
}

// 匹配不到样式隐藏
.el-select-dropdown__empty {
  display: none !important;
}
</style>

<style lang="scss" scoped>
p {
  white-space: nowrap;
  padding: 0;
  margin: 0;
}

.titleHead {
  color: #6d6e70;
  font-size: 13px;
}

// v2 是 ::v-deep { ... } 包一层，v3 逐条 :deep()
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
  margin-top: 0 !important;
}

:deep(.el-cascader .el-input .el-input__inner) {
  font-size: 12px;
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

.letter_lower {
  font-size: 14px;
  line-height: 30px;
}

.btn_line {
  width: 1px;
  height: 100%;
  border-right: 1px solid rgb(218, 217, 217);
}

.empty-text {
  display: flex;
  text-align: center;
  color: #909399;
  padding: 10px 0;
  margin-bottom: 10px;
}

.select_empty {
  text-align: center;
  margin-bottom: 60px;
  margin-top: 40px;
  font-size: 12px;
  color: #909399;
}

.box-card {
  // 指标间距（与 v2 一致：.pointer_spacing 的 margin-left 在 v2 里是注释掉的）

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
    color: #2c7be5;
    cursor: pointer;
  }

  .circle::after {
    content: '+';
  }
}
</style>
