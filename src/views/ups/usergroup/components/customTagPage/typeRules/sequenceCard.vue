<script setup lang="ts">
/**
 * 行为序列的步骤卡片（对应 v2
 * views/ups/usergroup/components/customTagPage/typeRules/sequenceCard.vue）。
 *
 * 渲染一条序列里的若干 step：事件 + 过滤条件（+ 关联属性）。
 * 与 v2 一致：本组件直接就地修改父级传入的 sequenceObject / modelObject（v2 的固有数据流）。
 */
import { computed, nextTick, ref } from 'vue'
import type { CSSProperties } from 'vue'
import { Close, Plus } from '@element-plus/icons-vue'
import conditionOption from './conditionOption.vue'
import TreeSelect from '@/views/ups/components/tree-select.vue'
import { copyObj } from '@/utils/copy'
import { radioOptions } from '../../../constants'
import {
  computedStyle as computedStyleFn,
  createUniqueString,
  filterCommonType,
  filterIstrue,
  getLetterByIndex,
  getLetterLowercase,
  strictMode,
} from '../../../utils'
import { getOptionsByType } from '@/utils/modelOptions/custom'
import type {
  ConditionItem,
  FilterGroup,
  FilterModel,
  OptionDef,
  PropertyListMap,
  PropertyNode,
  RuleSet,
  SequenceItem,
  SequenceStep,
} from '../../../types'

interface CascaderLike {
  getCheckedNodes: (leafOnly?: boolean) => { pathLabels?: string[] }[] | undefined
}
interface TreeSelectLike {
  refreshTreeList?: () => void
}

const props = withDefaults(
  defineProps<{
    letters?: number
    pointProtoList?: PropertyNode[]
    propertyList?: Partial<PropertyListMap>
    sequenceObject: SequenceItem
    modelObject: RuleSet
  }>(),
  {
    letters: 0,
    pointProtoList: () => [],
    propertyList: () => ({
      commonPropertySum: [], // 共用事件属性
      userProperties: [], // 共用用户属性
      userGroupList: [], // 用户分群
    }),
  },
)

/** v2 的 $refs['cascader_one' + index] */
const cascaderOneRefs = ref<Record<number, unknown>>({})
function setCascaderOne(index: number, el: unknown) {
  cascaderOneRefs.value[index] = el
}
/** v2 的 $refs.customTree（v-for 内同名 ref 会汇成数组） */
const customTree = ref<unknown[]>([])

let eventType = ''
let default_prototype: PropertyNode = {}
const initSelectObj: PropertyNode = {
  dataType: '',
  displayName: '',
  name: '',
  propertyId: '',
}

const relationProtoList = computed<PropertyNode[]>(() => {
  const relationList = copyObj(props.propertyList.commonPropertySum || [])
  relationList.unshift({
    dataType: '',
    displayName: '无',
    name: '',
  })
  return relationList
})

/* -------------------------------- 工具方法 ------------------------------- */

function computedStyle(value: unknown): CSSProperties | undefined {
  return computedStyleFn(value, props.modelObject)
}

/** params 按下标读写（项目开了 noUncheckedIndexedAccess，不能直接 v-model 到下标上） */
function pget(item: ConditionItem, index: number): string | number {
  return item.params[index] ?? ''
}
function pset(item: ConditionItem, index: number, val: unknown) {
  item.params[index] = (val ?? '') as string | number
}

function testArray(val: (string | number)[]) {
  return val
}

/**
 * 与 v2 一致（v2 此处逻辑存疑：把随机数当 :key 用，每次重渲染都会把 el-cascader
 * 整个销毁重建；这里照迁）。
 */
function generateRandomKey() {
  return createUniqueString()
}

// 联级事件进行过滤出-事件属性
function pointProtoFilter(eventName?: string): PropertyNode[] {
  let position: PropertyNode[] = []
  props.pointProtoList.forEach((a) => {
    ;(a.events || []).forEach((b) => {
      if (b.name == eventName) {
        position = b.propertyList || []
      }
    })
  })
  return position
}

// select 数据过滤
function checkbtnPoint(fieldType: string, eventName?: string): PropertyNode[] {
  let position: PropertyNode[] = []
  if (fieldType == 'event_property') {
    props.pointProtoList.forEach((a) => {
      ;(a.events || []).forEach((b) => {
        if (b.name == eventName) {
          position = b.propertyList || []
        }
      })
    })
    if (fieldType == 'event_property' && position.length > 0) {
      default_prototype = position[0] ?? {}
    }
  } else if (fieldType == 'user_group') {
    position = props.propertyList.userGroupList || []
  } else {
    position = props.propertyList.userProperties || []
  }
  return position
}

function checkRelevanceEvent(option: PropertyNode, item: SequenceStep) {
  item.relevanceFieldType = option.dataType
}

/* ------------------------------- 事件 / 步骤 ----------------------------- */

// 切换事件name
function fileterCascader(item: SequenceStep, index: number) {
  void nextTick(() => {
    const cascaderOne = cascaderOneRefs.value[index] as CascaderLike | null
    if (!cascaderOne) return
    const checked = cascaderOne.getCheckedNodes(false) || []
    const labelOne = checked[0]?.pathLabels || []
    if (item.name === item.customName) {
      item.customName = labelOne[1]
      item.name = labelOne[1]
    } else {
      item.name = labelOne[1]
    }
    // *** 切换cascader更改默认值 ***
    const list = pointProtoFilter(item.eventName)
    const options: PropertyNode = list.length > 0 ? (list[0] ?? {}) : {}
    const steps = item.filter.filters
    steps.forEach((stepItem) => {
      stepItem.conditions.forEach((subItem) => {
        if (subItem.fieldType == 'event_property') {
          subItem.field = options.name
        }
      })
    })
    // 更新组件中的源数据-回显操作
    customTree.value.forEach((treeItem) => {
      ;(treeItem as TreeSelectLike | null)?.refreshTreeList?.()
    })
    // *** end ***
  })
}

function circleAddEvent() {
  // 设置初始值
  props.pointProtoList.forEach((item, index) => {
    item.displayName = item.groupName
    item.name = item.groupName
    ;(item.events || []).forEach((sub, sub_index) => {
      if (sub_index == 0 && index == 0) {
        eventType = sub.name ?? ''
      }
    })
  })
  // 与 v2 一致：v2 这里把 pointProtoList[0].events[0].displayName 存进 pointerDefaultMeasureName，
  // 但新增 step 时的 name / customName 都被注释掉了，这个值实际没人读，所以这里不再保留该变量

  props.sequenceObject.steps.push({
    eventName: eventType,
    // customName / name / relevanceField / relevanceFieldType / timeScope / echoObj
    // 在 v2 里都被注释掉了，保持原样
    filter: {
      relation: 'and',
      filters: [],
    },
  })
}

/* -------------------------------- 过滤条件 ------------------------------- */

// 相对时间发生时间
function checkRelativeTime(condition: ConditionItem) {
  if (condition.function == 'relative_event_time') {
    condition.params[0] = 'afterDay'
    condition.params[2] = 'day'
  }
}

// optionsList  判等符号
function checkJudgmentType(val: string | undefined, second_item: ConditionItem): OptionDef[] {
  let options: OptionDef[] = []
  if (!val) return options
  if (second_item.fieldType == 'user_group') {
    // 与 v2 一致（v2 此处逻辑存疑：序列卡片里用户分群返回的是空数组，
    // 而 behaviorRules / attributeRules 返回的是 groupValueType）
    options = []
  } else {
    options = getOptionsByType(second_item.dataType)
  }
  return options
}

function handelJudge(second_item: ConditionItem) {
  if (Array.isArray(second_item.params) && second_item.params.length > 0) {
    second_item.params = []
  }
}

function deleteFirstCondition(filter: FilterModel, secondP_index: number, index: number) {
  filter.filters.splice(secondP_index, index)
  if (filter.filters.length < 2) {
    delete filter.relation
  }
}

// 增加默认值  一级事件
function firstLevelEvent(secondLevel: FilterModel, eventName?: string) {
  const dataType = checkbtnPoint('event_property', eventName)[0]?.dataType || ''
  // 没有初始值则设置初始值
  if (!secondLevel.relation) {
    secondLevel.relation = 'and'
  }
  secondLevel.filters.push({
    conditions: [
      {
        field: strictMode(checkbtnPoint('event_property', eventName), 'name'),
        dataType: dataType,
        function: strictMode(filterCommonType(default_prototype.dataType), 'name'),
        fieldType: 'event_property',
        params: [],
      },
    ],
  })
}

// 增加默认值  二级事件
function secondLevelEvent(secondP_index: number, second_list: FilterModel, model?: string) {
  let field = ''
  let dataType = ''
  if (model == 'gloab') {
    field = initSelectObj.name ?? ''
    dataType = initSelectObj.dataType ?? ''
  } else {
    field = default_prototype.name || ''
    dataType = default_prototype.dataType || ''
  }
  const addObj: ConditionItem = {
    field: field,
    dataType: dataType,
    function: strictMode(filterCommonType(dataType), 'name'),
    fieldType: 'event_property',
    params: [],
  }
  second_list.filters.forEach((item, index) => {
    if (secondP_index == index) {
      item.relation = 'and'
      item.conditions.push(addObj)
      // 与 v2 一致（v2 此处逻辑存疑：$set(item.conditions, "params", []) 往数组上挂了个
      // 名为 params 的属性，既不是下标也没人读，等于空操作，这里不再复刻）
    }
  })
}

// 平级事件
function equalityEvent(secondP_index: number, three_list: FilterModel, model?: string) {
  let field = ''
  let dataType = ''
  if (model == 'gloab') {
    field = initSelectObj.name ?? ''
    dataType = initSelectObj.dataType ?? ''
  } else {
    field = default_prototype.name || ''
    dataType = default_prototype.dataType || ''
  }
  three_list.filters.forEach((item, index) => {
    if (index == secondP_index) {
      const threeObj: ConditionItem = {
        field: field,
        dataType: dataType,
        function: strictMode(filterCommonType(dataType), 'name'),
        fieldType: 'event_property',
        params: [],
      }
      item.conditions[item.conditions.length] = threeObj
    }
  })
}

function threeDeleteEvent(secondP_index: number, second_index: number, three_list: FilterGroup[]) {
  three_list[secondP_index]?.conditions.splice(second_index, 1)
}
</script>

<template>
  <div class="box-card">
    <div>
      <el-row>
        <div v-for="(item, index) in sequenceObject.steps" :key="index" class="childRows">
          <div style="display: flex; position: absolute; z-index: 99">
            <div class="eg_letters" style="margin-top: 5px">
              {{ getLetterByIndex(letters) + (index + 1) }}
            </div>
          </div>

          <el-row
            style="display: flex; flex-direction: column; margin-bottom: 5px"
            class="child"
          >
            <!-- 一级条件样式 -->
            <div class="pointer_spacing" style="display: flex; align-items: center">
              <el-cascader
                :key="generateRandomKey()"
                :ref="(el: unknown) => setCascaderOne(index, el)"
                v-model="item.eventName"
                :options="pointProtoList"
                :show-all-levels="false"
                style="font-size: 13px; margin-left: 40px"
                class="custom_cascader"
                filterable
                :props="{
                  value: 'name',
                  label: 'displayName',
                  children: 'events',
                  multiple: false,
                  emitPath: false,
                }"
                @change="fileterCascader(item, index)"
              />
              <el-icon
                class="el-icon-close delete_btn"
                @click="sequenceObject.steps.splice(index, 1)"
              >
                <Close />
              </el-icon>
            </div>
            <div
              v-if="item.filter.filters.length > 0"
              style="
                position: relative;
                display: flex;
                flex-direction: column;
                justify-content: center;
                height: 100%;
              "
            >
              <div
                v-if="item.filter.filters.length > 1"
                style="
                  color: gray;
                  font-size: 13px;
                  position: absolute;
                  height: calc(100% - 15px);
                  display: flex;
                  top: 15px;
                  left: 40px;
                  flex-direction: column;
                  justify-content: center;
                  align-items: center;
                  z-index: 666;
                "
              >
                <div class="btn_line" />
                <el-radio-group v-model="item.filter.relation" size="small" class="custom_btn">
                  <el-radio-button value="and">且</el-radio-button>
                  <el-radio-button value="or">或</el-radio-button>
                </el-radio-group>
                <div class="btn_line" />
              </div>

              <div
                v-for="(secondP_item, secondP_index) in item.filter.filters"
                :key="secondP_index"
                style="position: relative"
              >
                <div v-if="secondP_item.conditions.length > 1">
                  <div
                    class="letter_lower"
                    style="
                      position: absolute;
                      left: 80px;
                      display: flex;
                      align-items: center;
                      height: calc(100% + 15px);
                    "
                  >
                    <div style="margin-left: -5px">
                      {{ getLetterLowercase(letters) + (secondP_index + 1) }}
                    </div>
                  </div>
                  <div
                    style="
                      color: gray;
                      font-size: 10px;
                      position: absolute;
                      left: 95px;
                      display: flex;
                      height: calc(100% - 15px);
                      top: 15px;
                      flex-direction: column;
                      justify-content: center;
                      align-items: center;
                      z-index: 666;
                    "
                  >
                    <div class="btn_line" />
                    <el-radio-group
                      v-model="secondP_item.relation"
                      size="small"
                      class="custom_btn"
                    >
                      <el-radio-button value="and">且</el-radio-button>
                      <el-radio-button value="or">或</el-radio-button>
                    </el-radio-group>
                    <div class="btn_line" />
                  </div>
                </div>
                <div
                  v-for="(second_item, second_index) in secondP_item.conditions"
                  :key="second_index"
                  class="pointer_spacing"
                  style="margin-left: 43px; position: relative"
                >
                  <!-- 指标二级筛选事件 -->
                  <div v-if="secondP_item.conditions.length > 1">
                    <div
                      style="
                        display: flex;
                        padding-top: 10px;
                        align-items: flex-start;
                        margin-left: 85px;
                      "
                    >
                      <!-- *** 二级 *** -->
                      <TreeSelect
                        ref="customTree"
                        :radio-options="radioOptions"
                        :second_item="second_item"
                        :property-list="propertyList"
                        :second_index="second_index"
                        :point-proto-list="pointProtoFilter(item.eventName)"
                        @change="handelJudge(second_item)"
                      />

                      <el-select
                        v-if="second_item.fieldType != 'user_group'"
                        v-model="second_item.function"
                        style="width: 100px; margin-left: 15px"
                        @change="checkRelativeTime(second_item)"
                      >
                        <el-option
                          v-for="x in checkJudgmentType(second_item.field, second_item)"
                          :key="x.name"
                          :label="x.displayName"
                          :value="x.name"
                        >
                          <div @click="handelJudge(second_item)">
                            {{ x.displayName }}
                          </div>
                        </el-option>
                      </el-select>
                      <div v-if="filterIstrue(second_item.function)">
                        <div v-if="second_item.dataType == 'NUMBER'">
                          <el-input
                            type="number"
                            class="input_number_width"
                            style="margin-left: 15px"
                            :model-value="pget(second_item, 0)"
                            :style="computedStyle(second_item.params)"
                            @update:model-value="pset(second_item, 0, $event)"
                          />
                        </div>
                        <div v-else>
                          <el-select
                            v-model="second_item.params"
                            style="margin-left: 10px; min-height: 30px; min-width: 350px"
                            :class="'second_select' + second_index"
                            multiple
                            filterable
                            allow-create
                            default-first-option
                            :style="computedStyle(second_item.params)"
                          >
                            <el-option
                              v-for="(x, x_index) in testArray(second_item.params)"
                              :key="x_index"
                              :label="x"
                              :value="x"
                            />
                          </el-select>
                        </div>
                      </div>

                      <!-- 封装组件 -->
                      <conditionOption :condition="second_item" :model-object="modelObject" />

                      <el-icon
                        class="el-icon-close delete_btn"
                        style="line-height: 30px"
                        @click="threeDeleteEvent(secondP_index, second_index, item.filter.filters)"
                      >
                        <Close />
                      </el-icon>
                    </div>
                    <div
                      v-if="secondP_item.conditions.length == second_index + 1"
                      style="display: flex; margin-left: 85px"
                    >
                      <i
                        class="el-icon-plus"
                        style="padding: 0px 0 0 0"
                        @click="equalityEvent(secondP_index, item.filter)"
                      >
                        <el-icon><Plus /></el-icon>添加过滤条件
                      </i>
                    </div>
                  </div>
                  <!-- 事件指标  一级筛选层条件 -->
                  <div v-else>
                    <div
                      style="
                        display: flex;
                        padding-top: 10px;
                        padding-left: 40px;
                        align-items: flex-start;
                      "
                    >
                      <div class="letter_lower" style="margin-left: -5px; margin-right: 10px">
                        {{ getLetterLowercase(letters) + (secondP_index + 1) }}
                      </div>
                      <!-- *** 一级 *** -->
                      <TreeSelect
                        ref="customTree"
                        :radio-options="radioOptions"
                        :second_item="second_item"
                        :property-list="propertyList"
                        :second_index="second_index"
                        :point-proto-list="pointProtoFilter(item.eventName)"
                        @change="handelJudge(second_item)"
                      />

                      <el-select
                        v-if="second_item.fieldType != 'user_group'"
                        v-model="second_item.function"
                        style="width: 100px; margin-left: 15px"
                        @change="checkRelativeTime(second_item)"
                      >
                        <el-option
                          v-for="x in checkJudgmentType(second_item.field, second_item)"
                          :key="x.name"
                          :label="x.displayName"
                          :value="x.name"
                        >
                          <div @click="handelJudge(second_item)">
                            {{ x.displayName }}
                          </div>
                        </el-option>
                      </el-select>

                      <!-- 区间 正则 匹配规则 -->
                      <conditionOption :condition="second_item" :model-object="modelObject" />

                      <div v-if="filterIstrue(second_item.function)">
                        <div v-if="second_item.dataType == 'NUMBER'">
                          <el-input
                            type="number"
                            class="input_number_width"
                            style="margin-left: 15px"
                            :model-value="pget(second_item, 0)"
                            :style="computedStyle(second_item.params)"
                            @update:model-value="pset(second_item, 0, $event)"
                          />
                        </div>
                        <div v-else>
                          <el-select
                            v-model="second_item.params"
                            style="margin-left: 15px; min-width: 350px"
                            multiple
                            filterable
                            allow-create
                            default-first-option
                            :style="computedStyle(second_item.params)"
                          >
                            <el-option
                              v-for="x in second_item.params"
                              :key="x"
                              :label="x"
                              :value="x"
                            >
                              {{ x }}
                            </el-option>
                          </el-select>
                        </div>
                      </div>

                      <el-icon
                        class="el-icon-close delete_btn"
                        @click="deleteFirstCondition(item.filter, secondP_index, 1)"
                      >
                        <Close />
                      </el-icon>
                    </div>
                    <div v-if="item.filter.filters.length > 1" style="display: flex">
                      <!-- 增加默认值 -->
                      <i
                        class="el-icon-plus"
                        style="padding: 0px 0 0 55px"
                        @click="secondLevelEvent(secondP_index, item.filter)"
                      >
                        <el-icon><Plus /></el-icon>添加过滤条件
                      </i>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <!-- 一级 增加默认值 -->
            <div
              v-if="pointProtoList.length > 0"
              style="display: flex; margin-top: 5px; margin-bottom: 8px"
            >
              <i
                class="el-icon-plus pointer_spacing"
                @click="firstLevelEvent(item.filter, item.eventName)"
              >
                <el-icon><Plus /></el-icon>添加过滤条件
              </i>
            </div>
            <div
              v-if="sequenceObject.isOpenRelation"
              style="display: flex; align-items: center; margin-left: 40px"
            >
              关联属性
              <el-select
                v-model="item.relevanceField"
                style="margin-left: 10px; width: 130px"
                filterable
                placeholder="请选择"
              >
                <el-option
                  v-for="option in relationProtoList"
                  :key="option.name"
                  :label="option.displayName"
                  :value="option.name"
                >
                  <div @click="checkRelevanceEvent(option, item)">
                    {{ option.displayName }}
                  </div>
                </el-option>
              </el-select>
            </div>
          </el-row>
        </div>
        <div
          v-if="sequenceObject.steps"
          class="circle add_icon pointer_spacing"
          style="margin-bottom: 15px"
          @click="circleAddEvent()"
        ></div>
      </el-row>
    </div>
  </div>
</template>

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
// v2 是全局类（src/styles/index.scss 的 .input_number_width），v3 尚未合并，先本地定义
.input_number_width {
  width: 100px;
}

// 单独设置编辑自定义名称事件
.custom_input .el-input__wrapper {
  height: 25px;
}

p {
  white-space: nowrap;
  padding: 0;
  margin: 0;
}

.titleHead {
  color: #6d6e70;
  font-size: 13px;
}

:deep() {
  .el-loading-spinner .circular {
    height: 38px !important;
  }

  .el-input__inner::placeholder {
    font-size: 11px;
  }

  .custom_btn .el-radio-button__original-radio:checked + .el-radio-button__inner {
    font-size: 10px;
  }

  .custom_btn .el-radio-button:last-child .el-radio-button__inner {
    font-size: 10px;
  }

  .el-radio-button:first-child .el-radio-button__inner {
    font-size: 10px;
  }

  .el-select .el-select__caret {
    line-height: 30px;
  }

  .el-select-dropdown__list {
    padding: 0 0 6px;
  }

  .el-radio-group {
    margin: 0 5px;
  }

  .el-radio-button__inner {
    border-left: 1px solid #dcdfe6;
    border-radius: 4px;
  }

  .el-radio-button:last-child .el-radio-button__inner {
    border-radius: 4px;
  }

  .el-radio-button:first-child .el-radio-button__inner {
    border-radius: 4px;
  }

  .el-radio-button {
    height: 20px;
    font-size: 12px;
  }

  .el-cascader .el-input .el-input__inner {
    font-size: 12px;
  }

  .custom_btn {
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

    .el-radio-button__original-radio:checked + .el-radio-button__inner {
      color: #ffffff;
      background-color: #619ff3;
      border-color: #619ff3;
      -webkit-box-shadow: -1px 0 0 0 #619ff3;
      box-shadow: -1px 0 0 0 #619ff3;
    }
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
  margin-bottom: 10px;
  font-size: 12px;
  color: #909399;
}

.box-card {
  margin: 0 40px;

  .el-icon-plus {
    color: #2c7be5;
    font-size: 13px;
    margin-top: 3px;
    padding-left: 37px;
    box-sizing: border-box;
    cursor: pointer;
  }

  .number_letters {
    width: 25px;
    height: 25px;
    border-radius: 50%;
    background-color: #2c7be5;
    color: #fff !important;
    display: flex;
    justify-content: center;
    align-items: center;
    line-height: 30px;
    font-size: 15px;
    font-weight: 400;
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

  .el-icon-close:hover {
    color: #2c7be5;
  }

  .add_icon {
    cursor: pointer;
    font-size: 30px;
    font-weight: 400;
    margin-top: 0px;
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
}
</style>
