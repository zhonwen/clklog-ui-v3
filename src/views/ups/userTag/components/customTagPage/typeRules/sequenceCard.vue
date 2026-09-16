<script setup lang="ts">
/**
 * 行为序列里的一条序列（steps 列表）
 * （对应 v2 src/views/ups/userTag/components/customTagPage/typeRules/sequenceCard.vue）。
 *
 * sequenceObject = 一条 sequence（含 steps），modelObject = 当前分层的 rules（只用来取 isValid 做校验标红）。
 *
 * element-plus / Vue3 适配：
 *   $refs['cascader_one'+i][0]  → 函数 ref 收进数组，getCheckedNodes() 必须显式传 false
 *   $refs.customTree（treeSelect 数组） → 函数 ref 收进 Record，逐个调 refreshTreeList()
 *   el-icon-xxx                 → <el-icon> + icons-vue（类名沿用 v2，样式不动）
 *   this.$set(o, k, v)          → o[k] = v
 *
 * v2 里未搬运的死代码：editCancle / editCustomName（连同 $refs.testInput，模板里对应的
 * 自定义名称编辑区整块不存在）、updateProtoList（空实现）、testArray、filterDataType
 * （模板里没有第二个 cascader，$refs.setCascader 根本不存在）、handleVisibleChange、
 * checkTypeArray、filterJudgmentType、checkpointProtoFrom、getClasses、
 * bookmarkInitObj / filterBarParams / initSumApi / oldProperty、
 * attr_string / attr_number / attr_boolean / attr_dateTime（import 了但没用）。
 */
import { computed, nextTick, ref } from 'vue'
import { Close, Plus } from '@element-plus/icons-vue'
import type { CascaderInstance } from 'element-plus'
import conditionOption from './conditionOption.vue'
import treeSelect from '@/views/ups/components/tree-select.vue'
import { copyObj } from '@/utils/copy'
import { NumberType, defaultType, getOptionsByType, noNumber } from '@/utils/modelOptions/custom'
import type { OptionDef } from '@/utils/modelOptions/custom'
import { groupValueType } from '@/utils/modelOptions/up-manage'
import {
  computedStyle as computedStyleFn,
  createUniqueString,
  filterIstrue,
  getLetterByIndex,
  getLetterLowercase,
  strictMode,
} from '../../../local-utils'
import type {
  ConditionItem,
  FilterBlock,
  PropertyListMap,
  PropertyNode,
  RadioOption,
  SequenceItem,
  SequenceStep,
  TagRuleSet,
} from '../../../types'

/** treeSelect 暴露出来的刷新方法 */
interface TreeSelectExposed {
  refreshTreeList: () => void
}

const props = withDefaults(
  defineProps<{
    letters?: number
    pointProtoList?: PropertyNode[]
    propertyList?: Partial<PropertyListMap>
    sequenceObject: SequenceItem
    modelObject: TagRuleSet
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

const radioOptions: RadioOption[] = [
  { label: '事件属性', value: 'event_property' },
  { label: '用户属性', value: 'user_property' },
  // { label: "用户分群", value: "user_group" },
  { label: '用户标签', value: 'user_tag' },
]

const eventType = ref('')
const default_options = defaultType
const pointerDefaultMeasureName = ref('')
const default_prototype = ref<PropertyNode | ''>('')
const initSelectObj = {
  dataType: '',
  displayName: '',
  name: '',
  propertyId: '',
}

const cascaderOneRefs = ref<(CascaderInstance | null)[]>([])
const customTreeRefs = ref<Record<string, TreeSelectExposed>>({})

function setCascaderOneRef(el: unknown, index: number) {
  if (el) cascaderOneRefs.value[index] = el as CascaderInstance
}
function setCustomTreeRef(el: unknown, key: string) {
  if (el) {
    customTreeRefs.value[key] = el as TreeSelectExposed
  } else {
    delete customTreeRefs.value[key]
  }
}

/** 关联属性下拉：公共事件属性最前面补一个「无」 */
const relationProtoList = computed<PropertyNode[]>(() => {
  const relationList = copyObj(props.propertyList.commonPropertySum ?? [])
  relationList.unshift({
    dataType: '',
    displayName: '无',
    name: '',
  })
  return relationList
})

function computedStyle(value: unknown) {
  return computedStyleFn(value, props.modelObject)
}

// 联级事件进行过滤出-事件属性
function pointProtoFilter(eventName: string): PropertyNode[] {
  let position: PropertyNode[] = []
  props.pointProtoList.map((a) => {
    a.events?.map((b) => {
      if (b.name == eventName) {
        return (position = b.propertyList ?? [])
      }
      return undefined
    })
  })
  return position
}

function checkRelevanceEvent(option: PropertyNode, item: SequenceStep) {
  item.relevanceFieldType = option.dataType
}


/** 与 v2 一致：每次渲染都会生成新 key，强制 el-cascader 重建 */
function generateRandomKey() {
  return createUniqueString()
}

// 切换事件name
function fileterCascader(item: SequenceStep, index: number) {
  void nextTick(() => {
    const cascader_one = cascaderOneRefs.value[index]?.getCheckedNodes(false) || []
    const labelOne = cascader_one[0]?.pathLabels || []
    if (item.name === item.customName) {
      item.customName = labelOne[1]
      item.name = labelOne[1]
    } else {
      item.name = labelOne[1]
    }
    // *** 切换cascader更改默认值 ***
    const filtered = pointProtoFilter(item.eventName)
    const options = filtered.length > 0 ? filtered[0] : undefined
    const steps = item.filter.filters
    steps.map((filterItem) => {
      filterItem.conditions.map((subItem) => {
        if (subItem.fieldType == 'event_property') {
          subItem.field = options?.name
        }
      })
    })
    // 更新组件中的源数据-回显操作
    Object.values(customTreeRefs.value).map((treeItem) => {
      treeItem.refreshTreeList()
    })
    // *** end ***
  })
}

function circleAddEvent() {
  // 设置初始值
  props.pointProtoList.map((item, index) => {
    item.displayName = item.groupName ?? ''
    item.name = item.groupName ?? ''
    item.events?.map((sub, sub_index) => {
      if (sub_index == 0 && index == 0) {
        eventType.value = sub.name
      }
    })
  })
  pointerDefaultMeasureName.value = props.pointProtoList[0]?.events?.[0]?.displayName ?? ''

  // 与 v2 一致：这里**不写** name / customName / relevanceField / relevanceFieldType /
  // timeScope / echoObj，v2 里那几行全是注释。fileterCascader 的
  // `item.name === item.customName` 分支正好依赖两者都是 undefined。
  props.sequenceObject.steps.push({
    eventName: eventType.value,
    filter: {
      relation: 'and',
      filters: [],
    },
  })
}

// select 数据过滤 1997
function checkbtnPoint(fieldType: string, eventName: string): PropertyNode[] {
  let position: PropertyNode[] = []
  if (fieldType == 'event_property') {
    props.pointProtoList.map((a) => {
      a.events?.map((b) => {
        if (b.name == eventName) {
          return (position = b.propertyList ?? [])
        }
        return undefined
      })
    })
    if (fieldType == 'event_property' && position.length > 0) {
      default_prototype.value = position[0] ?? ''
    }
  } else if (fieldType == 'user_group') {
    position = props.propertyList.userGroupList ?? []
  } else {
    position = props.propertyList.userProperties ?? []
  }
  return position
}

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
    options = groupValueType
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

function deleteFirstCondition(filter: FilterBlock, secondP_index: number, index: number) {
  filter.filters.splice(secondP_index, index)
  if (filter.filters.length < 2) {
    delete filter.relation
  }
}

function filterCommonType(type?: string): OptionDef[] | '' {
  if (!type) return ''
  let options: OptionDef[] = []
  options = getOptionsByType(type)
  return options
}

// 增加默认值  一级事件
function firstLevelEvent(secondLevel: FilterBlock, eventName: string) {
  const list = checkbtnPoint('event_property', eventName)
  const dataType = list[0]?.dataType || ''
  // 没有初始值则设置初始值
  if (!secondLevel.relation) {
    secondLevel.relation = 'and'
  }
  const proto = default_prototype.value
  secondLevel.filters.push({
    conditions: [
      {
        field: strictMode(list, 'name'),
        dataType: dataType,
        function: strictMode(filterCommonType(proto ? proto.dataType : undefined), 'name'),
        fieldType: 'event_property',
        params: [],
      },
    ],
  })
}

// 增加默认值  二级事件
function secondLevelEvent(
  secondP_index: number,
  second_index: number,
  second_list: FilterBlock,
  model?: string,
) {
  let field = '',
    dataType = ''
  const proto = default_prototype.value
  if (model == 'gloab') {
    field = initSelectObj.name
    dataType = initSelectObj.dataType
  } else {
    field = (proto ? proto.name : '') || ''
    dataType = (proto ? proto.dataType : '') || ''
  }
  const addObj: ConditionItem = {
    field: field,
    // fieldFlag: field,
    dataType: dataType,
    function: strictMode(filterCommonType(dataType), 'name'),
    fieldType: 'event_property',
    params: [],
  }
  second_list.filters.map((item, index) => {
    if (secondP_index == index) {
      item.relation = 'and'
      item.conditions.push(addObj)
      // v2 这里还有 this.$set(item.conditions, "params", [])：无效写入，不再搬运
    }
  })
}

// 平级事件
function equalityEvent(
  secondP_index: number,
  second_index: number,
  three_list: FilterBlock,
  model?: string,
) {
  let field = '',
    dataType = ''
  const proto = default_prototype.value
  if (model == 'gloab') {
    field = initSelectObj.name
    dataType = initSelectObj.dataType
  } else {
    field = (proto ? proto.name : '') || ''
    dataType = (proto ? proto.dataType : '') || ''
  }
  three_list.filters.map((item, index) => {
    if (index == secondP_index) {
      // "event_property" + '.' +
      const threeObj: ConditionItem = {
        field: field,
        // fieldFlag: field,
        dataType: dataType,
        function: strictMode(filterCommonType(dataType), 'name'),
        fieldType: 'event_property',
        params: [],
      }
      item.conditions[item.conditions.length] = threeObj
    }
  })
}

function threeDeleteEvent(
  secondP_index: number,
  second_index: number,
  three_list: FilterBlock['filters'],
) {
  three_list[secondP_index]?.conditions.splice(second_index, 1)
}
</script>

<template>
  <div class="box-card">
    <div>
      <el-row>
        <template v-for="(item, index) in sequenceObject.steps" :key="index">
          <div class="childRows">
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
                  :ref="(el: unknown) => setCascaderOneRef(el, index)"
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
                ></el-cascader>
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
                    left: 0px;
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
                      <!-- {{ getLetterLowercase(secondP_index) }} -->
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
                        <treeSelect
                          :ref="
                            (el: unknown) =>
                              setCustomTreeRef(el, `${index}-${secondP_index}-${second_index}`)
                          "
                          :radio-options="radioOptions"
                          :second_item="second_item"
                          :property-list="propertyList"
                          :second_index="second_index"
                          :point-proto-list="pointProtoFilter(item.eventName)"
                          @change="handelJudge(second_item)"
                        >
                        </treeSelect>
                        <!-- end -->
                        <el-select
                          v-model="second_item.function"
                          placeholder=""
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
                        <!-- 根据NUMBER类型展示文本 -->
                        <div v-if="filterIstrue(second_item.function)">
                          <div v-if="second_item.dataType == 'NUMBER'">
                            <el-input
                              v-model="second_item.params[0]"
                              type="number"
                              class="input_number_width"
                              style="margin-left: 15px"
                              :style="computedStyle(second_item.params)"
                            ></el-input>
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
                                :key="String(x)"
                                :label="String(x)"
                                :value="x"
                              >
                                {{ x }}
                              </el-option>
                            </el-select>
                          </div>
                        </div>

                        <!-- 封装组件 -->
                        <conditionOption
                          :condition="second_item"
                          :model-object="modelObject"
                        ></conditionOption>

                        <el-icon
                          class="el-icon-close delete_btn"
                          style="line-height: 30px"
                          @click="
                            threeDeleteEvent(secondP_index, second_index, item.filter.filters)
                          "
                        >
                          <Close />
                        </el-icon>
                      </div>
                      <div
                        v-if="secondP_item.conditions.length == second_index + 1"
                        style="display: flex; margin-left: 85px"
                      >
                        <span
                          class="el-icon-plus"
                          style="padding: 0px 0 0 0"
                          @click="equalityEvent(secondP_index, second_index, item.filter)"
                        >
                          <el-icon><Plus /></el-icon>添加过滤条件
                        </span>
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
                        <treeSelect
                          :ref="
                            (el: unknown) =>
                              setCustomTreeRef(el, `${index}-${secondP_index}-${second_index}`)
                          "
                          :radio-options="radioOptions"
                          :second_item="second_item"
                          :property-list="propertyList"
                          :second_index="second_index"
                          :point-proto-list="pointProtoFilter(item.eventName)"
                          @change="handelJudge(second_item)"
                        >
                        </treeSelect>

                        <el-select
                          v-model="second_item.function"
                          placeholder=""
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
                        <conditionOption
                          :condition="second_item"
                          :model-object="modelObject"
                        ></conditionOption>
                        <!-- 根据NUMBER类型展示文本 -->
                        <div v-if="filterIstrue(second_item.function)">
                          <div v-if="second_item.dataType == 'NUMBER'">
                            <el-input
                              v-model="second_item.params[0]"
                              type="number"
                              class="input_number_width"
                              style="margin-left: 15px"
                              :style="computedStyle(second_item.params)"
                            ></el-input>
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
                                :key="String(x)"
                                :label="String(x)"
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
                        <span
                          class="el-icon-plus"
                          style="padding: 0px 0 0 55px"
                          @click="secondLevelEvent(secondP_index, second_index, item.filter)"
                        >
                          <el-icon><Plus /></el-icon>添加过滤条件
                        </span>
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
                <span
                  class="el-icon-plus pointer_spacing"
                  @click="firstLevelEvent(item.filter, item.eventName)"
                >
                  <el-icon><Plus /></el-icon>添加过滤条件
                </span>
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
        </template>
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
// 单独设置编辑自定义名称事件
.custom_input :deep(.el-input__wrapper) {
  height: 25px;
}

.el-icon-edit {
  display: none;
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

:deep(.el-loading-spinner .circular) {
  height: 38px !important;
}

:deep(.el-input__inner::placeholder) {
  font-size: 11px;
}

:deep(.custom_btn .el-radio-button__original-radio:checked + .el-radio-button__inner) {
  font-size: 10px;
}

:deep(.custom_btn .el-radio-button:last-child .el-radio-button__inner) {
  font-size: 10px;
}

:deep(.el-radio-button:first-child .el-radio-button__inner) {
  font-size: 10px;
}

:deep(.el-select__wrapper) {
  min-height: 30px;
  line-height: 30px;
  font-size: 12px;
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
  padding: 6px;
  font-size: 13px;
}

:deep(.el-radio-button:last-child .el-radio-button__inner) {
  border-radius: 4px;
}

:deep(.el-radio-button) {
  height: 20px;
  font-size: 12px;
}

:deep(.el-input__wrapper) {
  height: 30px;
  line-height: 30px;
  font-size: 12px;
}

:deep(.el-cascader .el-input__inner) {
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

  .el-radio-button__original-radio:checked + .el-radio-button__inner {
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
  margin-bottom: 10px;
  font-size: 12px;
  color: #909399;
}

.box-card {
  // margin-left: 45px;
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
