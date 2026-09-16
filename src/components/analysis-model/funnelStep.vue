<template>
  <div class="box-card">
    <div>
      <el-row>
        <!-- 与 v2 一致：v2 在这里套了一层无指令的 <template>，Vue3 会把它当成真实的
             <template> 元素渲染（子节点不可见），所以这层包裹去掉，结构不变 -->
        <div v-for="(item, index) in modelObject.steps" :key="index" class="childRows">
          <div style="display: flex">
            <div
              v-if="headType == 'number'"
              class="eg_letters"
              style="
                width: 25px;
                height: 25px;
                border-radius: 50%;
                background-color: #2c7be5;
                color: #fff;
                display: flex;
                justify-content: center;
                align-items: center;
                line-height: 30px;
                font-size: 15px;
                font-weight: 400;
                /* border: 1px solid #2c7be5; */
              "
            >
              {{ index + 1 }}
            </div>
            <div v-else class="eg_letters">
              {{ getLetterByIndex(index) }}
            </div>
            <!-- 自定义名称 -->
            <el-input
              v-if="item.editNameFlag"
              :ref="(el: RefEl) => setNameInputRef(el, index)"
              v-model="item.customName"
              :autofocus="true"
              style="width: 200px"
              class="custom_input"
              @blur="editCancle(item)"
            />
            <div
              v-show="!item.editNameFlag"
              class="custom_name"
              style="
                color: #656464;
                font-size: 14px;
                min-width: 40px;
                max-width: 400px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                padding-right: 18px;
                line-height: 25px;
                position: relative;
              "
            >
              {{ item.customName }}
            </div>

            <el-icon
              v-show="!item.editNameFlag"
              class="edit_btn"
              style="color: #2c7be5; cursor: pointer; position: relative; left: 0; line-height: 25px"
              @click="editCustomName(item, index)"
            >
              <Edit />
            </el-icon>
          </div>

          <el-row style="display: flex; flex-direction: column; margin-bottom: 5px" class="child">
            <!-- 一级条件样式 -->
            <div class="pointer_spacing" style="display: flex; align-items: center">
              <el-cascader
                :key="generateRandomKey()"
                :ref="(el: RefEl) => setCascaderRef(el, index)"
                :model-value="item.eventName"
                :options="pointProtoList"
                :show-all-levels="false"
                style="font-size: 13px; margin-left: 40px"
                class="custom_cascader"
                filterable
                :props="cascaderProps"
                @update:model-value="(val: CascaderValue) => setStepEventName(item, val)"
                @change="fileterCascader(item, index)"
              />
              <el-icon
                v-show="modelObject.steps.length > 1"
                class="delete_btn"
                @click="modelObject.steps.splice(index, 1)"
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
                    {{ getLetterLowercase(secondP_index) }}
                  </div>
                  <div
                    style="
                      color: gray;
                      font-size: 10px;
                      position: absolute;
                      left: 90px;
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
                      <el-select
                        v-model="second_item.field"
                        class="custom_select"
                        :class="getClasses(second_index)"
                        filterable
                        :no-data-text="''"
                        style="
                          min-width: 100px;
                          height: 32px;
                          margin-right: 15px;
                          position: relative;
                        "
                        placeholder=""
                        @visible-change="handleVisibleChange($event, secondP_item, second_index)"
                      >
                        <div style="height: 40px; width: 100%">
                          <el-radio-group
                            v-model="second_item.fieldType"
                            class="custom_tabs setRadio"
                            style="
                              position: absolute;
                              width: calc(100% - 15px);
                              background-color: #fff;
                              top: 0;
                              z-index: 600;
                            "
                          >
                            <el-radio-button
                              value="event_property"
                              style="margin: 6px 10px 15px 10px"
                              >事件属性</el-radio-button
                            >
                            <!-- 与 v2 一致：「用户属性」在 v2 里是注释掉的 -->
                          </el-radio-group>
                        </div>
                        <el-option
                          v-for="x in checkbtnPoint(second_item.fieldType, item.eventName)"
                          :key="x.name"
                          style="min-width: 250px"
                          :label="x.displayName"
                          :value="x.name"
                        >
                          <div
                            @click="
                              checkpointProtoFrom(
                                x,
                                second_item.fieldType ?? 'event_property',
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
                              checkbtnPoint(second_item.fieldType, item.eventName).length == 0
                            "
                          >
                            <div class="empty-text" style="min-width: 250px">
                              <el-radio-group
                                v-model="second_item.fieldType"
                                class="custom_tabs"
                                style="display: flex"
                              >
                                <el-radio-button
                                  value="event_property"
                                  style="margin: 0 10px 0 10px"
                                  >事件属性</el-radio-button
                                >
                              </el-radio-group>
                            </div>
                            <div class="select_empty">暂无数据</div>
                          </div>
                        </template>
                      </el-select>
                      <el-select
                        v-model="second_item.function"
                        placeholder=""
                        style="width: 100px"
                        @change="checkRelativeTime(second_item)"
                      >
                        <el-option
                          v-for="x in checkJudgmentType(second_item.field)"
                          :key="x.name"
                          :label="x.displayName"
                          :value="x.name"
                        >
                          {{ x.displayName }}
                        </el-option>
                      </el-select>
                      <div v-if="filterIstrue(second_item.function)">
                        <el-select
                          v-model="second_item.params"
                          style="margin-left: 10px; min-height: 30px; min-width: 350px"
                          :class="'second_select' + second_index"
                          multiple
                          filterable
                          allow-create
                          default-first-option
                          placeholder=""
                        >
                          <el-option
                            v-for="(x, x_index) in testArray(second_item.params)"
                            :key="x_index"
                            :label="x"
                            :value="x"
                          />
                        </el-select>
                      </div>

                      <!-- 封装组件 -->
                      <condition-option :condition="second_item" />

                      <el-icon
                        class="delete_btn"
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
                        @click="equalityEvent(secondP_index, item.filter)"
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
                      <div class="letter_lower" style="margin-right: 7px">
                        {{ getLetterLowercase(secondP_index) }}
                      </div>
                      <el-select
                        v-model="second_item.field"
                        class="custom_select"
                        filterable
                        :no-data-text="''"
                        style="
                          min-width: 100px;
                          height: 32px;
                          margin-right: 15px;
                          position: relative;
                        "
                        placeholder=""
                        @visible-change="handleVisibleChange($event, secondP_item, second_index)"
                      >
                        <div style="height: 40px; width: 100%">
                          <el-radio-group
                            v-model="second_item.fieldType"
                            class="custom_tabs"
                            style="
                              position: absolute;
                              width: calc(100% - 15px);
                              background-color: #fff;
                              top: 0;
                              z-index: 600;
                            "
                          >
                            <el-radio-button
                              value="event_property"
                              style="margin: 6px 10px 15px 10px"
                              >事件属性</el-radio-button
                            >
                          </el-radio-group>
                        </div>
                        <!-- bug属性 1997 -->
                        <el-option
                          v-for="x in checkbtnPoint(second_item.fieldType, item.eventName)"
                          :key="x.propertyId"
                          style="min-width: 250px"
                          :label="x.displayName"
                          :value="x.name"
                        >
                          <div
                            @click="
                              checkpointProtoFrom(
                                x,
                                second_item.fieldType ?? 'event_property',
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
                              checkbtnPoint(second_item.fieldType, item.eventName).length == 0
                            "
                          >
                            <div class="empty-text" style="min-width: 250px">
                              <el-radio-group
                                v-model="second_item.fieldType"
                                class="custom_tabs"
                                style="display: flex"
                              >
                                <el-radio-button
                                  value="event_property"
                                  style="margin: 0 10px 0 10px"
                                  >事件属性</el-radio-button
                                >
                              </el-radio-group>
                            </div>
                            <div class="select_empty">暂无数据</div>
                          </div>
                        </template>
                      </el-select>

                      <el-select
                        v-model="second_item.function"
                        placeholder=""
                        style="width: 140px"
                        @change="checkRelativeTime(second_item)"
                      >
                        <el-option
                          v-for="x in checkJudgmentType(second_item.field)"
                          :key="x.name"
                          :label="x.displayName"
                          :value="x.name"
                        >
                          <div @click="filterPiPei(second_item)">
                            {{ x.displayName }}
                          </div>
                        </el-option>
                      </el-select>

                      <!-- 区间 正则 匹配规则 -->
                      <condition-option :condition="second_item" />
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

                      <el-icon
                        class="delete_btn"
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
                        @click="secondLevelEvent(secondP_index, item.filter)"
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
              v-if="modelObject.isOpenRelation"
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
        <div class="circle add_icon pointer_spacing" @click="circleAddEvent()"></div>
      </el-row>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { Close, Edit, Plus } from '@element-plus/icons-vue'
import type {
  CascaderInstance,
  CascaderProps,
  CascaderValue,
  InputInstance,
} from 'element-plus'
import conditionOption from './conditionOption.vue'
import { copyObj } from '@/utils/copy'
import { getOptionsByType, type OptionDef } from '@/utils/modelOptions/custom'
import type {
  AnalysisStep,
  ConditionItem,
  EventGroup,
  FieldType,
  FilterGroup,
  FilterModel,
  PointTypeList,
  PropertyItem,
  StepsHolder,
} from './types'

/**
 * 漏斗步骤编辑器。
 * 与 v2 的 src/components/analysis-model/funnelStep.vue 一一对应。
 * 与 v2 一致：组件直接就地修改父级传进来的 modelObject.steps（v2 用 $set，v3 直接赋值）。
 *
 * v2 里还有一批完全没有被模板或其它方法引用的死代码
 * （formateCascader / filterDataType / updateProtoList / checkTypeArray / projectName 等），
 * 迁移时不再保留，行为不受影响。
 */
const props = withDefaults(
  defineProps<{
    /** 'number' 时步骤前显示序号，否则显示 A/B/C */
    headType?: string
    pointProtoList?: EventGroup[]
    pointTypeList?: PointTypeList
    modelObject: StepsHolder
  }>(),
  {
    headType: '',
    pointProtoList: () => [],
    pointTypeList: () => ({ userProtoList: [], eventProtoList: [] }),
  },
)

/** 模板 ref 回调参数类型 */
type RefEl = Element | { $el: Element } | null

/** 记录 change 之前的 fieldType，visible-change 关闭时用来回滚（v2 的 oldProperty） */
const oldProperty = ref<FieldType>('event_property')

/**
 * checkbtnPoint 的副作用产物：当前事件下的第一个属性，
 * 新增筛选条件时拿它当默认值。与 v2 一致，不参与渲染，所以用普通变量而不是 ref。
 */
let default_prototype: PropertyItem | null = null

/** 步骤自定义名称输入框 */
const nameInputRefs = ref<Record<number, InputInstance | null>>({})
function setNameInputRef(el: RefEl, index: number) {
  nameInputRefs.value[index] = (el as InputInstance | null) ?? null
}

/** 步骤事件联级选择器 */
const cascaderRefs = ref<Record<number, CascaderInstance | null>>({})
function setCascaderRef(el: RefEl, index: number) {
  cascaderRefs.value[index] = (el as CascaderInstance | null) ?? null
}

/** v2 是把这个对象字面量直接写在模板的 :props 上的，取值一字不差 */
const cascaderProps: CascaderProps = {
  value: 'name',
  label: 'displayName',
  children: 'events',
  multiple: false,
  emitPath: false,
}

const relationProtoList = computed<PropertyItem[]>(() => {
  const relationList = copyObj(props.pointTypeList.eventProtoList)
  relationList.unshift({
    dataType: '',
    displayName: '无',
    name: '',
  })
  return relationList
})

function editCancle(item: AnalysisStep) {
  item.editNameFlag = null
}

function editCustomName(item: AnalysisStep, index: number) {
  item.editNameFlag = true
  void nextTick(() => {
    // v2 取的是 this.$refs.testInput[0]：同一时刻只可能有一个步骤处于编辑态
    // （切到别的步骤会先触发 blur → editCancle），所以 [0] 与 [index] 等价
    nameInputRefs.value[index]?.focus()
  })
}

function checkRelevanceEvent(option: PropertyItem, item: AnalysisStep) {
  item.relevanceFieldType = option.dataType
}

function testArray(val: (string | number)[]) {
  return val
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

/**
 * v2 走的是 this.$options.filters.createUniqueString()（src/filters/index.js）。
 * v3 没有全局 filters，这里内联同样的实现。
 * 与 v2 一致（v2 此处逻辑存疑：把随机数当 el-cascader 的 :key，
 * 每次重新渲染都会重建联级选择器，只是为了强制刷新回显）。
 */
function generateRandomKey() {
  const randomBytes = new Uint8Array(4)
  window.crypto.getRandomValues(randomBytes)
  let randomNumber = 0
  for (let i = 0; i < randomBytes.length; i++) {
    randomNumber += (randomBytes[i] ?? 0) * Math.pow(256, i)
  }
  return randomNumber
}

/**
 * v2 用的是 v-model="item.eventName"。element-plus 的 el-cascader 回传的是 CascaderValue，
 * 直接 v-model 到 string 字段过不了类型检查，这里拆成 :model-value + @update:model-value，
 * 因为配了 emitPath: false，回传的就是单个 name，行为与 v2 一致。
 */
function setStepEventName(item: AnalysisStep, val: unknown) {
  item.eventName = typeof val === 'string' ? val : String(val ?? '')
}

/** 切换事件 name */
function fileterCascader(item: AnalysisStep, index: number) {
  void nextTick(() => {
    const nodes = cascaderRefs.value[index]?.getCheckedNodes(false)
    const labelOne = nodes?.[0]?.pathLabels || []
    if (item.name === item.customName || !item.name) {
      item.customName = labelOne[1] ?? ''
      item.name = labelOne[1] ?? ''
    } else {
      item.name = labelOne[1] ?? ''
    }
  })
}

/** 事件类型初始值，由 circleAddEvent 就地写入（与 v2 的 data.eventType 一致，不参与渲染） */
let eventType = ''
let pointerDefaultMeasureName = ''

function circleAddEvent() {
  // 设置初始值
  props.pointProtoList.forEach((item, index) => {
    item.displayName = item.groupName ?? ''
    item.name = item.groupName ?? ''
    item.events.forEach((sub, sub_index) => {
      if (sub_index == 0 && index == 0) {
        eventType = sub.name
      }
    })
  })
  pointerDefaultMeasureName = props.pointProtoList[0]?.events[0]?.displayName ?? ''

  props.modelObject.steps.push({
    eventName: eventType,
    customName: pointerDefaultMeasureName,
    name: pointerDefaultMeasureName,
    relevanceField: '', // 关联属性
    relevanceFieldType: '', // 关联属性
    type: 'normal',
    filter: {
      relation: 'and',
      filters: [],
    },
  })
}

/** 指标新处理方案 */
function handleVisibleChange(visible: boolean, secondP_item: FilterGroup, second_index: number) {
  const condition = secondP_item.conditions[second_index]
  if (!condition) return
  if (visible) {
    oldProperty.value = condition.fieldType ?? 'event_property'
  } else {
    condition.fieldType = oldProperty.value
  }
}

/**
 * select 数据过滤 1997。
 * 与 v2 一致：这个方法在模板里被调用，同时带有写 default_prototype 的副作用，
 * 新增筛选条件时的默认字段就来自这里，不能改成无副作用的 computed。
 */
function checkbtnPoint(fieldType: FieldType | undefined, eventName: string): PropertyItem[] {
  let position: PropertyItem[] = []
  if (fieldType == 'event_property') {
    props.pointProtoList.forEach((a) => {
      a.events.forEach((b) => {
        if (b.name == eventName) {
          position = b.propertyList
        }
      })
    })
    if (position.length > 0) {
      default_prototype = position[0] ?? null
    }
  } else {
    position = props.pointTypeList.userProtoList
  }
  return position
}

/** 相对时间发生时间 */
function checkRelativeTime(condition: ConditionItem) {
  if (condition.function == 'relative_event_time') {
    condition.params[0] = 'afterDay'
    condition.params[2] = 'day'
  }
}

/** 切换 */
function checkJudgmentType(val: string): OptionDef[] {
  let options: OptionDef[] = []
  if (!val) return options
  props.pointTypeList.eventProtoList.forEach((item) => {
    if (item.name == val) {
      options = getOptionsByType(item.dataType)
    }
  })
  // 用户数据筛选
  if (options.length == 0) {
    options = filterJudgmentType(props.pointTypeList.userProtoList, val)
  }
  return options
}

function filterJudgmentType(list: PropertyItem[], val: string): OptionDef[] {
  let options: OptionDef[] = []
  list.forEach((item) => {
    if (item.name == val) {
      options = getOptionsByType(item.dataType)
    }
  })
  return options
}

function filterPiPei(val: ConditionItem) {
  val.params = []
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

function deleteFirstCondition(filter: FilterModel, secondP_index: number, index: number) {
  filter.filters.splice(secondP_index, index)
  if (filter.filters.length < 2) {
    delete filter.relation
  }
}

/** 增加默认值  一级事件 */
function firstLevelEvent(secondLevel: FilterModel, eventName: string) {
  const list = checkbtnPoint('event_property', eventName)
  // 与 v2 一致：v2 直接取 [0].dataType，列表为空会抛错；模板上有 pointProtoList.length > 0 的前置判断
  const dataType = list[0]?.dataType || ''
  // 没有初始值则设置初始值
  if (!secondLevel.relation) {
    secondLevel.relation = 'and'
  }
  secondLevel.filters.push({
    conditions: [
      {
        field: strictMode(list, 'name'),
        dataType: dataType,
        function: strictMode(filterCommonType(default_prototype?.dataType), 'name'),
        fieldType: 'event_property',
        params: [],
      },
    ],
  })
}

/** 增加默认值  二级事件（v2 的 second_index / model 形参在漏斗页调用时都没传，函数体走 else 分支） */
function secondLevelEvent(secondP_index: number, second_list: FilterModel) {
  const field = default_prototype?.name || ''
  const dataType = default_prototype?.dataType || ''
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
      // 与 v2 一致（v2 此处逻辑存疑：$set(item.conditions, "params", []) 是往数组上挂了一个
      // 名为 params 的属性，既不是条件也不会被读取，属于无效代码，这里不再保留）
    }
  })
}

/** 平级事件 */
function equalityEvent(secondP_index: number, three_list: FilterModel) {
  const field = default_prototype?.name || ''
  const dataType = default_prototype?.dataType || ''
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

function getClasses(second_index: number) {
  return `${second_index}addselect`
}

function threeDeleteEvent(secondP_index: number, second_index: number, three_list: FilterGroup[]) {
  three_list[secondP_index]?.conditions.splice(second_index, 1)
}

/** 严格检验字段模式 */
function strictMode<T extends PropertyItem | OptionDef>(val: T[], label: 'name'): string {
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

/** 指标属性操作事件 */
function checkpointProtoFrom(
  item: PropertyItem,
  type: FieldType,
  secondP_item: FilterGroup,
  second_index: number,
) {
  const condition = secondP_item.conditions[second_index]
  if (!condition) return
  const dataType = item.dataType || ''
  condition.fieldType = type
  condition.dataType = dataType
  condition.function = strictMode(filterCommonType(dataType), 'name')
  // 保存 change 时的位置
  oldProperty.value = type
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
// 单独设置编辑自定义名称事件
.custom_input .el-input--medium .el-input__inner {
  height: 25px;
}

// v2 用的是 .el-icon-edit（element-ui 的字体图标类），
// v3 换成 <el-icon><Edit /></el-icon>，这里同步改成 .edit_btn，显隐规则不变
.edit_btn {
  display: none;
}

.childRows {
  padding: 10px;
}

.childRows:hover {
  background: #f4f4f4;
}

.childRows:hover .edit_btn {
  display: block;
}

// end
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

:deep(.custom_btn .el-radio-button__orig-radio:checked + .el-radio-button__inner) {
  font-size: 10px;
}

:deep(.custom_btn .el-radio-button:last-child .el-radio-button__inner) {
  font-size: 10px;
}

:deep(.el-radio-button:first-child .el-radio-button__inner) {
  font-size: 10px;
}

:deep(.el-radio-button--medium .el-radio-button__inner) {
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

:deep(.el-radio-button--medium .el-radio-button__inner) {
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
  margin-bottom: 10px;
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
