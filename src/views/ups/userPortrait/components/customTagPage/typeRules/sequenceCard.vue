<script setup lang="ts">
/**
 * 群画像 - 「行为序列」里单条序列的步骤卡片
 * （对应 v2 `views/ups/userPortrait/components/customTagPage/typeRules/sequenceCard.vue`）。
 *
 * 数据流与 v2 完全一致：直接就地修改父级传进来的 sequenceObject.steps
 * （v2 用的是 props + this.$set / this.$delete），父组件 sequenceRules 拿的是同一个对象引用。
 *
 * 与 v2 一致（v2 此处逻辑存疑：以下都是 v2 里模板从没引用、也没人通过 $refs 调用的死代码，这里不再搬运）：
 *   - editCancle / editCustomName（后者还 focus 了一个根本不存在的 ref="testInput"）；
 *   - updateProtoList（空函数）、formateCascader、filterDataType
 *     （filterDataType 用了 this.$refs["setCascader"]，模板里没有这个 ref，一调就报错）；
 *   - checkTypeArray（函数体里引用了未定义的 second_item，一调就报错）；
 *   - getClasses、filterJudgmentType、handleVisibleChange、checkpointProtoFrom；
 *   - data 里的 oldProperty / default_options / filterBarParams / initSumApi / bookmarkInitObj；
 *   - computed projectName（$store.getters.projectName，模板里没用过）。
 *
 * 注意：`customTagPage/` 在 v2 里 userPortrait / userTag / usergroup 各有一份独立副本，
 * 这一份严格以 userPortrait 的为准。
 */
import { computed, nextTick, onBeforeUpdate } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { Close, Plus } from '@element-plus/icons-vue'
import treeSelect from '@/views/ups/components/tree-select.vue'
import conditionOption from './conditionOption.vue'
import { copyObj } from '@/utils/copy'
import { getOptionsByType } from '@/utils/modelOptions/custom'
import type { OptionDef } from '@/utils/modelOptions/custom'
import { groupValueType } from '../../../options'
import { computedStyle as computedStyleRaw } from '../../../types'
import type {
  ConditionItem,
  EventGroup,
  FilterContainer,
  PortraitRules,
  PropertyListMap,
  PropertyNode,
  RadioOption,
  SequenceItem,
  SequenceStep,
} from '../../../types'

const props = withDefaults(
  defineProps<{
    /** 本条序列在父级里的下标，用来生成 A1 / a1 这种编号 */
    letters?: number
    pointProtoList?: EventGroup[]
    propertyList?: Partial<PropertyListMap>
    sequenceObject: SequenceItem
    /** 用于 computedStyle 取 isValid 做空值校验，同时透传给 conditionOption */
    modelObject?: PortraitRules | null
  }>(),
  {
    letters: 0,
    pointProtoList: () => [],
    propertyList: () => ({
      commonPropertySum: [], // 共用事件属性
      userProperties: [], // 共用用户属性
      userGroupList: [], // 用户分群
    }),
    modelObject: null,
  },
)

const radioOptions: RadioOption[] = [
  { label: '事件属性', value: 'event_property' },
  { label: '用户属性', value: 'user_property' },
  { label: '用户分群', value: 'user_group' },
  { label: '用户标签', value: 'user_tag' },
]

/**
 * v2 的 this.default_prototype，初始值是空字符串 ""。
 * "" 上取 .name / .dataType 都是 undefined，和空对象等价，这里用 {} 便于标注类型。
 */
let default_prototype: PropertyNode = {}

/** v2 的 this.initSelectObj（只有 model == 'gloab' 分支会用到，本组件模板没走过这个分支） */
const initSelectObj: PropertyNode = {
  dataType: '',
  displayName: '',
  name: '',
  propertyId: '',
}

/**
 * v2 的 this.eventType（普通实例变量，不参与渲染）。
 * v2 还有个 this.pointerDefaultMeasureName，赋值后没有任何地方再读，这里不再搬运。
 */
let eventType = ''

/** threeDeleteEvent 收到的就是 filter.filters */
type FilterGroupList = FilterContainer['filters']

/** el-cascader 的字段映射，与 v2 模板里那个行内对象逐字一致 */
const cascaderProps = {
  value: 'name',
  label: 'displayName',
  children: 'events',
  multiple: false,
  emitPath: false,
}

/** 关联属性下拉：共用事件属性前面插一个「无」 */
const relationProtoList = computed<PropertyNode[]>(() => {
  const relationList = copyObj(props.propertyList.commonPropertySum ?? [])
  relationList.unshift({
    dataType: '',
    displayName: '无',
    name: '',
  })
  return relationList
})

// ---------------------------------------------------------------------------
// $refs → ref 数组
// v2: ref="customTree"（treeSelect，v-for 里会拿到实例数组）
//     :ref="'cascader_one' + index"（动态字符串 ref）
// v3: 用函数式 ref 收集，模板里写成内联箭头函数，这样每次更新都会重新收集。
// ---------------------------------------------------------------------------

/** 只用到 tree-select defineExpose 出来的 refreshTreeList */
interface TreeSelectExposed {
  refreshTreeList: () => void
}

/** el-cascader 在 element-plus 里同样暴露 getCheckedNodes()，节点上同样有 pathLabels */
interface CascaderCheckedNode {
  pathLabels?: string[]
}
interface CascaderExposed {
  getCheckedNodes: (leafOnly?: boolean) => CascaderCheckedNode[]
}

const customTreeRefs: TreeSelectExposed[] = []
const cascaderRefs: (CascaderExposed | null)[] = []

function setCustomTreeRef(el: Element | ComponentPublicInstance | null) {
  if (el) customTreeRefs.push(el as unknown as TreeSelectExposed)
}

function setCascaderRef(el: Element | ComponentPublicInstance | null, index: number) {
  cascaderRefs[index] = (el as unknown as CascaderExposed | null) ?? null
}

// treeSelect 是 push 收集的，更新前先清空，避免重复堆积
onBeforeUpdate(() => {
  customTreeRefs.length = 0
})

// ---------------------------------------------------------------------------
// 方法
// ---------------------------------------------------------------------------

// 设置校验样式
function computedStyle(value: unknown) {
  return computedStyleRaw(value, props.modelObject)
}

// 联级事件进行过滤出-事件属性
function pointProtoFilter(eventName?: string): PropertyNode[] {
  let position: PropertyNode[] = []
  props.pointProtoList.map((a) => {
    a.events.map((b) => {
      if (b.name == eventName) {
        return (position = b.propertyList ?? [])
      }
    })
  })
  return position
}

function checkRelevanceEvent(option: PropertyNode, item: SequenceStep) {
  item.relevanceFieldType = option.dataType
}

function testArray(val?: (string | number)[]) {
  return val ?? []
}

function getLetterByIndex(index: number) {
  if (index < 0 || index >= 26) {
    return String.fromCharCode(65 + (index % 26))
  }
  return String.fromCharCode(65 + index) // 65 是大写字母 A 的 ASCII 编码
}

function getLetterLowercase(index: number) {
  if (index < 0 || index >= 26) {
    return String.fromCharCode(97 + (index % 26))
  }
  return String.fromCharCode(97 + index)
}

/** 编号只跟 letters 这个 prop 有关，提成 computed，避免模板里每一行都调一次 */
const letterUpper = computed(() => getLetterByIndex(props.letters))
const letterLower = computed(() => getLetterLowercase(props.letters))

/**
 * v2 走的是 this.$options.filters.createUniqueString()（src/filters/index.js），
 * Vue 3 没有过滤器，这里按同样的实现就地写一份，拿来当 el-cascader 的 :key 强制重建。
 */
function generateRandomKey(): string {
  const randomBytes = new Uint8Array(4)
  window.crypto.getRandomValues(randomBytes)
  let randomNumber = 0
  for (let i = 0; i < randomBytes.length; i++) {
    randomNumber += (randomBytes[i] ?? 0) * Math.pow(256, i)
  }
  return String(randomNumber)
}

/** el-cascader 用 emitPath:false，值就是事件 name；v2 用的 v-model，这里拆成受控写法以对齐类型 */
function setEventName(item: SequenceStep, val: unknown) {
  item.eventName = val == null ? '' : String(val)
}

// 切换事件name（v2 形参里还有一个没用到的 $event，这里不再接收）
function fileterCascader(item: SequenceStep, index: number) {
  void nextTick(() => {
    const cascaderInst = cascaderRefs[index]
    if (!cascaderInst) return
    const cascader_one = cascaderInst.getCheckedNodes()
    const labelOne = cascader_one[0]?.pathLabels || []
    // v2 直接取 labelOne[1]，noUncheckedIndexedAccess 下用空串兜底
    const label = labelOne[1] ?? ''
    const customName = typeof item.customName === 'string' ? item.customName : undefined
    if (item.name === customName) {
      item.customName = label
      item.name = label
    } else {
      item.name = label
    }
    // *** 切换cascader更改默认值 ***
    const filtered = pointProtoFilter(item.eventName)
    const options = filtered.length > 0 ? filtered[0] : undefined
    const steps = item.filter.filters
    steps.map((group) => {
      group.conditions.map((subItem) => {
        if (subItem.fieldType == 'event_property') {
          subItem.field = options?.name
        }
      })
    })
    // 更新组件中的源数据-回显操作（tree-select 在 v3 里确实 defineExpose 了 refreshTreeList）
    customTreeRefs.map((inst) => {
      inst.refreshTreeList()
    })
    // *** end ***
  })
}

function circleAddEvent() {
  // 设置初始值
  props.pointProtoList.map((item, index) => {
    item.displayName = item.groupName
    item.name = item.groupName
    item.events.map((sub, sub_index) => {
      if (sub_index == 0 && index == 0) {
        eventType = sub.name ?? ''
      }
    })
  })
  // v2 这里还有一句 this.pointerDefaultMeasureName = this.pointProtoList[0].events[0].displayName，
  // 赋完值没人读，且 pointProtoList 为空时会直接报错，迁移时去掉

  props.sequenceObject.steps.push({
    eventName: eventType,
    // 与 v2 一致（v2 此处逻辑存疑：这里 push 的步骤不带 name，
    // 而 sequenceRules.circleAddEvent 里 push 的步骤是带 name 的）：
    // customName / name / relevanceField / relevanceFieldType / timeScope / echoObj
    // 在 v2 里就全是注释掉的
    filter: {
      relation: 'and',
      filters: [],
    },
  } as SequenceStep)
}

// select 数据过滤
function checkbtnPoint(fieldType: string, eventName?: string): PropertyNode[] {
  let position: PropertyNode[] = []
  if (fieldType == 'event_property') {
    props.pointProtoList.map((a) => {
      a.events.map((b) => {
        if (b.name == eventName) {
          return (position = b.propertyList ?? [])
        }
      })
    })
    if (fieldType == 'event_property' && position.length > 0) {
      default_prototype = position[0] ?? {}
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
    if (!condition.params) condition.params = []
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

function deleteFirstCondition(filter: FilterContainer, secondP_index: number, index: number) {
  filter.filters.splice(secondP_index, index)
  if (filter.filters.length < 2) {
    delete filter.relation
  }
}

// 增加默认值  一级事件
function firstLevelEvent(secondLevel: FilterContainer, eventName?: string) {
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
function secondLevelEvent(
  secondP_index: number,
  second_index: number,
  second_list: FilterContainer,
  model?: string,
) {
  void second_index // 与 v2 一致：形参保留，函数体里没用到
  let field = '',
    dataType = ''
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
  second_list.filters.map((item, index) => {
    if (secondP_index == index) {
      item.relation = 'and'
      item.conditions.push(addObj)
      // 与 v2 一致（v2 此处逻辑存疑：$set(item.conditions, "params", []) 是往 conditions 数组对象上
      // 挂了个 params 属性，没有任何实际作用）
      ;(item.conditions as unknown as Record<string, unknown>).params = []
    }
  })
}

// 平级事件
function equalityEvent(
  secondP_index: number,
  second_index: number,
  three_list: FilterContainer,
  model?: string,
) {
  void second_index // 与 v2 一致：形参保留，函数体里没用到
  let field = '',
    dataType = ''
  if (model == 'gloab') {
    field = initSelectObj.name ?? ''
    dataType = initSelectObj.dataType ?? ''
  } else {
    field = default_prototype.name || ''
    dataType = default_prototype.dataType || ''
  }
  three_list.filters.map((item, index) => {
    if (index == secondP_index) {
      const threeObj: ConditionItem = {
        field: field,
        dataType: dataType,
        function: strictMode(filterCommonType(dataType), 'name'),
        fieldType: 'event_property',
        params: [],
      }
      // v2: this.$set(item.conditions, item.conditions.length, threeObj)
      item.conditions[item.conditions.length] = threeObj
    }
  })
}

function threeDeleteEvent(secondP_index: number, second_index: number, three_list: FilterGroupList) {
  three_list[secondP_index]?.conditions.splice(second_index, 1)
}

// 严格检验字段模式
function strictMode(
  val: { name?: string; displayName?: string }[] | '',
  label: 'name' | 'displayName',
): string {
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

/**
 * params 按下标读写。项目开了 noUncheckedIndexedAccess，模板里直接 v-model="second_item.params[0]"
 * 拿到的是 string | number | undefined，接不进 el-input，所以统一走 get / set 两个方法，
 * 读写的仍然是同一个 params 数组，行为与 v2 一致。
 */
function paramAt(item: ConditionItem, index: number): string | number {
  return item.params?.[index] ?? ''
}

function setParamAt(item: ConditionItem, index: number, val: unknown) {
  if (!item.params) item.params = []
  item.params[index] = val as string | number
}

/**
 * 且 / 或：element-plus 的 el-radio-group 在 update:modelValue 里给的是
 * string | number | boolean | undefined，写不回 relation?: string，所以拆成受控写法收窄一下。
 */
function setRelation(target: { relation?: string }, val: string | number | boolean | undefined) {
  target.relation = val == null ? undefined : String(val)
}

/** el-select multiple 的整个 params 数组（params 可能是 undefined，接不进 v-model） */
function setParams(item: ConditionItem, val: unknown) {
  item.params = Array.isArray(val) ? (val as (string | number)[]) : []
}

/** 关联属性：SequenceStep 上 relevanceField 落在索引签名里（unknown），读写各包一层 */
function stepRelevanceField(item: SequenceStep): string {
  return typeof item.relevanceField === 'string' ? item.relevanceField : ''
}

function setStepRelevanceField(item: SequenceStep, val: unknown) {
  item.relevanceField = val == null ? '' : String(val)
}

// v2 里父组件 sequenceRules 用 ref="sequenceCardRef" 引用本组件，但没有调用过任何方法
defineExpose({})
</script>

<template>
  <div class="box-card">
    <div>
      <el-row>
        <!-- v2 这里外层套了一个不带任何指令的 <template>，Vue 3 不允许，去掉后渲染结果一致 -->
        <div v-for="(item, index) in sequenceObject.steps" :key="index" class="childRows">
          <div style="display: flex; position: absolute; z-index: 99">
            <div class="eg_letters" style="margin-top: 5px">
              {{ letterUpper + (index + 1) }}
            </div>
          </div>

          <el-row style="display: flex; flex-direction: column; margin-bottom: 5px" class="child">
            <!-- 一级条件样式 -->
            <div class="pointer_spacing" style="display: flex; align-items: center">
              <el-cascader
                :key="generateRandomKey()"
                :ref="(el: Element | ComponentPublicInstance | null) => setCascaderRef(el, index)"
                :model-value="item.eventName"
                :options="pointProtoList"
                :show-all-levels="false"
                style="font-size: 13px; margin-left: 40px"
                class="custom_cascader"
                filterable
                :props="cascaderProps"
                @update:model-value="setEventName(item, $event)"
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
                <el-radio-group
                  :model-value="item.filter.relation"
                  size="small"
                  class="custom_btn"
                  @update:model-value="setRelation(item.filter, $event)"
                >
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
                      {{ letterLower + (secondP_index + 1) }}
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
                      :model-value="secondP_item.relation"
                      size="small"
                      class="custom_btn"
                      @update:model-value="setRelation(secondP_item, $event)"
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
                        :ref="(el) => setCustomTreeRef(el)"
                        :radioOptions="radioOptions"
                        :second_item="second_item"
                        :propertyList="propertyList"
                        :second_index="second_index"
                        :pointProtoList="pointProtoFilter(item.eventName)"
                        :cloleAppendBody="true"
                        @change="handelJudge(second_item)"
                      />
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
                      <div v-if="filterIstrue(second_item.function)">
                        <div v-if="second_item.dataType == 'NUMBER'">
                          <el-input
                            type="number"
                            class="input_number_width"
                            style="margin-left: 15px"
                            :model-value="paramAt(second_item, 0)"
                            :style="computedStyle(second_item.params)"
                            @update:model-value="setParamAt(second_item, 0, $event)"
                          />
                        </div>
                        <div v-else>
                          <el-select
                            style="margin-left: 10px; min-height: 30px; min-width: 350px"
                            :class="'second_select' + second_index"
                            :model-value="second_item.params ?? []"
                            multiple
                            filterable
                            allow-create
                            default-first-option
                            :style="computedStyle(second_item.params)"
                            @update:model-value="setParams(second_item, $event)"
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
                      <condition-option :condition="second_item" :modelObject="modelObject" />

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
                        {{ letterLower + (secondP_index + 1) }}
                      </div>
                      <!-- *** 一级 *** -->
                      <treeSelect
                        :ref="(el) => setCustomTreeRef(el)"
                        :radioOptions="radioOptions"
                        :second_item="second_item"
                        :propertyList="propertyList"
                        :second_index="second_index"
                        :pointProtoList="pointProtoFilter(item.eventName)"
                        :cloleAppendBody="true"
                        @change="handelJudge(second_item)"
                      />

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
                      <condition-option :condition="second_item" :modelObject="modelObject" />
                      <div v-if="filterIstrue(second_item.function)">
                        <div v-if="second_item.dataType == 'NUMBER'">
                          <el-input
                            type="number"
                            class="input_number_width"
                            style="margin-left: 15px"
                            :model-value="paramAt(second_item, 0)"
                            :style="computedStyle(second_item.params)"
                            @update:model-value="setParamAt(second_item, 0, $event)"
                          />
                        </div>
                        <div v-else>
                          <el-select
                            style="margin-left: 15px; min-width: 350px"
                            :model-value="second_item.params ?? []"
                            multiple
                            filterable
                            allow-create
                            default-first-option
                            :style="computedStyle(second_item.params)"
                            @update:model-value="setParams(second_item, $event)"
                          >
                            <el-option
                              v-for="(x, x_index) in testArray(second_item.params)"
                              :key="x_index"
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
                :model-value="stepRelevanceField(item)"
                style="margin-left: 10px; width: 130px"
                filterable
                placeholder="请选择"
                @update:model-value="setStepRelevanceField(item, $event)"
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
// 单独设置编辑自定义名称事件
// v2 是 .custom_input .el-input--medium .el-input__inner，element-plus 没有 medium 尺寸类；
// 模板里本来也没有 .custom_input，与 v2 一样是条不生效的规则
.custom_input .el-input__inner {
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

:deep(.el-input-number.is-controls-right[class*='medium'] [class*='increase']),
:deep(.el-input-number.is-controls-right[class*='medium'] [class*='decrease']) {
  line-height: 12px;
  margin-top: 3px;
}

// v2 的 .el-radio-button__orig-radio 在 element-plus 里叫 .el-radio-button__original-radio
:deep(.custom_btn .el-radio-button__original-radio:checked + .el-radio-button__inner) {
  font-size: 10px;
}

:deep(.custom_btn .el-radio-button:last-child .el-radio-button__inner) {
  font-size: 10px;
}

:deep(.el-radio-button:first-child .el-radio-button__inner) {
  font-size: 10px;
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

// v2 的 .el-radio-button--medium .el-radio-button__inner（padding/font-size）
// 在 element-plus 里没有 medium 尺寸类，直接并到基础选择器上
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

// v2 的 .el-input--medium .el-input__inner 同理
:deep(.el-input__inner) {
  height: 30px;
  line-height: 30px;
  font-size: 12px;
}

:deep(.el-cascader .el-input .el-input__inner) {
  font-size: 12px;
}

.custom_btn {
  padding: 1px 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;

  :deep(.el-radio-button:first-child .el-radio-button__inner) {
    border-radius: 4px 4px 0 0;
  }

  :deep(.el-radio-button:last-child .el-radio-button__inner) {
    border-radius: 0 0 4px 4px;
  }

  :deep(.el-radio-button--small .el-radio-button__inner) {
    padding: 5px;
  }

  :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
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
  white-space: nowrap;
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

  // v2 是 <i class="el-icon-plus">添加过滤条件</i>（字体图标带文字）；
  // v3 改成 <span class="el-icon-plus"><el-icon><Plus /></el-icon>文字</span>，
  // 类名保留在外层，这段样式照旧生效
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
