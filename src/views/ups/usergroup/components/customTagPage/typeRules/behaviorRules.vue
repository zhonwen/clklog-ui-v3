<script setup lang="ts">
/**
 * 用户行为满足（对应 v2
 * views/ups/usergroup/components/customTagPage/typeRules/behaviorRules.vue）。
 *
 * 数据落在 modelObject.behavior 上：{ relation, measures: [...] }。
 * 每条 measure = 时间范围（日历级联 / 日期区间 / 相对天数 popover）+ 事件 + 聚合方式 + 判断 + 过滤条件。
 * 与 v2 一致：本组件直接就地修改父级传入的 rules 对象（v2 的固有数据流）。
 */
import { computed, nextTick, ref } from 'vue'
import type { CSSProperties } from 'vue'
import { ElMessage } from 'element-plus'
import { Close, Plus } from '@element-plus/icons-vue'
import conditionOption from './conditionOption.vue'
import TreeSelect from '@/views/ups/components/tree-select.vue'
import {
  NumberAgg,
  defaultUserType,
  groupValueType,
  intervalList,
  noNumber,
  radioOptions,
} from '../../../constants'
import {
  computedStyle as computedStyleFn,
  filterCommonType,
  filterIstrue,
  getLetterByIndex,
  getLetterLowercase,
  rangeShortcuts,
  strictMode,
} from '../../../utils'
import { getOptionsByType } from '@/utils/modelOptions/custom'
import type {
  BehaviorMeasure,
  CascaderNode,
  ConditionItem,
  FilterGroup,
  FilterModel,
  OptionDef,
  PropertyListMap,
  PropertyNode,
  RuleSet,
} from '../../../types'

/** el-cascader / el-date-picker 实例上我们真正用到的那部分 */
interface CascaderLike {
  getCheckedNodes: (leafOnly?: boolean) => { pathLabels?: string[] }[] | undefined
}
interface DatePickerLike {
  handleOpen: () => void
}
interface TreeSelectLike {
  refreshTreeList?: () => void
}

const props = withDefaults(
  defineProps<{
    pointProtoList?: PropertyNode[]
    propertyList?: Partial<PropertyListMap>
    modelObject: RuleSet
    cascaderList?: CascaderNode[]
  }>(),
  {
    pointProtoList: () => [],
    propertyList: () => ({
      commonPropertySum: [], // 共用事件属性
      userProperties: [], // 共用用户属性
      userGroupList: [], // 用户分群
    }),
    cascaderList: () => [],
  },
)

/* ------------------------------- 模板 ref ------------------------------- */

/** v2 的 $refs['cascader_one' + index]（v-for 内的动态 ref 名） */
const cascaderOneRefs = ref<Record<number, unknown>>({})
function setCascaderOne(index: number, el: unknown) {
  cascaderOneRefs.value[index] = el
}
/** v2 的 $refs.datePickerShow[index] */
const datePickerRefs = ref<Record<number, unknown>>({})
function setDatePicker(index: number, el: unknown) {
  datePickerRefs.value[index] = el
}
/** v2 的 $refs.customPover[index].showPopper / doClose()，element-plus 改成受控 visible */
const poverVisible = ref<Record<number, boolean>>({})
/** v2 的 $refs.customTree（v-for 内同名 ref 会汇成数组） */
const customTree = ref<unknown[]>([])

/* --------------------------------- 状态 --------------------------------- */

const showCascadwe = ref(true)
const default_options = defaultUserType
const pointerDefaultOne = defaultUserType[0]?.name ?? ''
let pointerDefaultMeasureName = ''
let default_prototype: PropertyNode = {}
const initSelectObj: PropertyNode = {
  dataType: '',
  displayName: '',
  name: '',
  propertyId: '',
}
let eventType = ''

const pickerShortcuts = rangeShortcuts

/* -------------------------------- 工具方法 ------------------------------- */

function computedStyle(value: unknown): CSSProperties | undefined {
  return computedStyleFn(value, props.modelObject)
}

/** params 按下标读写（项目开了 noUncheckedIndexedAccess，不能直接 v-model 到下标上） */
function pget(item: { params: (string | number)[] }, index: number): string | number {
  return item.params[index] ?? ''
}
function pset(item: { params: (string | number)[] }, index: number, val: unknown) {
  item.params[index] = (val ?? '') as string | number
}

function testArray(val: (string | number)[]) {
  return val
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

function formateCascader(val?: string): PropertyNode[] {
  let options: PropertyNode[] = []
  props.pointProtoList.forEach((a) => {
    ;(a.events || []).forEach((b) => {
      if (b.name == val) {
        options = b.propertyList || []
      }
    })
  })
  const mergedArray: PropertyNode[] = [...default_options, ...options]
  mergedArray.forEach((item) => {
    if (item.dataType) {
      switch (item.dataType) {
        case 'STRING':
          item.events = noNumber
          break
        case 'NUMBER':
          item.events = NumberAgg
          break
        default:
          item.events = noNumber
          break
      }
    }
  })
  return mergedArray
}

function isCasPathValid(options: PropertyNode[], path?: string[]) {
  if (!Array.isArray(path) || !path.length) return false
  let current: PropertyNode[] = options || []
  for (let i = 0; i < path.length; i++) {
    const node = current.find((opt) => opt.name === path[i])
    if (!node) return false
    current = node.events || []
  }
  return true
}

function resolveCasPathLabels(options: PropertyNode[], path: string[]) {
  const labels: string[] = []
  let current: PropertyNode[] = options || []
  for (let i = 0; i < path.length; i++) {
    const node = current.find((opt) => opt.name === path[i])
    if (!node) return labels
    labels.push(node.displayName ?? '')
    current = node.events || []
  }
  return labels
}

/* ------------------------------- 时间范围 -------------------------------- */

function datePickerOptions(item: BehaviorMeasure) {
  const obj: CascaderNode = {
    label: '前' + item.echoObj.startNum + '天' + '到前' + item.echoObj.endNum + '天',
    value:
      `${'-'}${item.echoObj.startNum}${'day'}` + '~' + `${'-'}${item.echoObj.endNum}${'day'}`,
    custom: true,
  }

  // 方式二   去重
  const relative = props.cascaderList[1]
  if (relative) {
    relative.children = (relative.children || []).concat([obj])
    relative.children = relative.children.filter(
      (object, index, self) => index === self.findIndex((t) => t.label === object.label),
    )
  }

  // 进行赋值
  const newlevel = item.echoObj.timeScope
  // 步骤二
  newlevel[1] =
    `${'-'}${item.echoObj.startNum}${'day'}` + '~' + `${'-'}${item.echoObj.endNum}${'day'}`
  item.echoObj.timeScope = newlevel

  // 后端字段进行赋值 earlist和latest字段
  item.earlistTime = `${'-'}${item.echoObj.startNum}${'day'}`
  item.latestTime = `${'-'}${item.echoObj.endNum}${'day'}`

  //缓存相对时间非自定义上次数据
  item.echoObj.lastRelativeTime = newlevel
}

// 日期事件
function checkDateEvent(val: unknown, item: BehaviorMeasure) {
  const range = (val || []) as string[]
  const obj: CascaderNode = {
    label: range[0] + '~' + range[1],
    value: range[0] + '~' + range[1],
  }
  const absolute = props.cascaderList[0]
  if (absolute) {
    absolute.children = (absolute.children || []).concat([obj])
    absolute.children = absolute.children.filter(
      (object, index, self) => index === self.findIndex((t) => t.label === object.label),
    )
  }

  // 进行赋值
  const newlevel = item.echoObj.timeScope
  newlevel[1] = range[0] + '~' + range[1]
  item.echoObj.timeScope = newlevel

  // 后端字段进行赋值 earlist和latest字段
  item.earlistTime = Math.floor(new Date(String(range[0])).getTime() / 1000)
  item.latestTime = Math.floor(new Date(String(range[1])).getTime() / 1000)
  //缓存绝对时间 非自定义上次数据
  item.echoObj.lastAbsoluteTime = newlevel
}

//日历控件关闭后的操作
function dateBlur(item: BehaviorMeasure) {
  if (item.echoObj.lastAbsoluteTime.length > 0) {
    item.echoObj.timeScope = item.echoObj.lastAbsoluteTime
  } else {
    item.echoObj.timeScope = item.echoObj.lastRelativeTime
  }
}

function isValidDateStr(str: string) {
  // 允许YYYY-M-D或YYYY-MM-DD，分隔符为-或/
  const reg = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/
  if (!reg.test(str)) return false
  const d = new Date(str.replace(/-/g, '/')) // 兼容Safari
  return !isNaN(d.getTime())
}

function splitDateRange(dateRange: string) {
  if (dateRange.includes('~')) {
    return dateRange.split('~')
  }
  return null // 如果没有 '~'，返回 null 或其他你想返回的值
}

function clickCascader(val: unknown, index: number, item: BehaviorMeasure) {
  const path = (val || []) as string[]
  // 自定义事件
  if (path.length > 1) {
    if (path[1] == 'custom') {
      // pover 自定义天数
      poverVisible.value[index] = true
    } else if (path[1] == 'time_scope') {
      // 自定义日期范围
      // v2 调的是 element-ui 的 focus()（会打开面板），element-plus 对应 handleOpen()
      ;(datePickerRefs.value[index] as DatePickerLike | null)?.handleOpen()
    } else {
      // 设置后端字段进行赋值 earlist和latest字段
      const dateTime = splitDateRange(String(path[1]))
      if (dateTime) {
        if (
          dateTime[0] &&
          dateTime[1] &&
          isValidDateStr(dateTime[0]) &&
          isValidDateStr(dateTime[1])
        ) {
          item.earlistTime = Math.floor(new Date(dateTime[0]).getTime() / 1000)
          item.latestTime = Math.floor(new Date(dateTime[1]).getTime() / 1000)
        }
      } else {
        item.earlistTime = String(path[1])
        item.latestTime = 'now'
      }
    }
  }
}

function closePover(index: number, isTrue?: boolean, item?: BehaviorMeasure) {
  // 相对时间自定义天数   新增类
  if (isTrue && item) {
    item.echoObj.lastAbsoluteTime = []
    if (Number(item.echoObj.startNum) < Number(item.echoObj.endNum)) {
      ElMessage.error('开始时间必须早于结束时间')
      return
    }
    datePickerOptions(item)
  }
  poverVisible.value[index] = false
}

function handleHide(item: BehaviorMeasure) {
  if (item.echoObj.lastAbsoluteTime.length > 0) {
    item.echoObj.timeScope = item.echoObj.lastAbsoluteTime
  } else {
    item.echoObj.timeScope = item.echoObj.lastRelativeTime
  }
}

function handleVisible() {
  // v2 里是空实现
}

/* ------------------------------ 指标 / 事件 ------------------------------ */

function circleAddEvent() {
  props.pointProtoList.forEach((item, index) => {
    item.displayName = item.groupName
    item.name = item.groupName
    ;(item.events || []).forEach((sub, sub_index) => {
      if (sub_index == 0 && index == 0) {
        eventType = sub.name ?? ''
      }
    })
  })
  const object: BehaviorMeasure = {
    eventName: '',
    casList: [],
    aggregator: '',
    name: '',
    // 用于自定义回显数据存放
    echoObj: {
      lastRelativeTime: ['relative_time', '-1day'],
      // 步骤一
      timeScope: ['relative_time', '-1day'],
      lastAbsoluteTime: [],
      datePicker: [], //日期
      startNum: null,
      endNum: null,
    },
    function: 'equal',
    params: [1],
    earlistTime: '-1day',
    latestTime: 'now',
    filter: {
      relation: 'and',
      filters: [],
    },
  }
  props.modelObject.behavior.measures.push(object)

  void nextTick(() => {
    const indexNum = props.modelObject.behavior.measures.length - 1
    const target = props.modelObject.behavior.measures[indexNum]
    if (!target) return
    target.eventName = eventType
    target.casList = [pointerDefaultOne]
    target.aggregator = pointerDefaultOne
    // 设置name 名称拼接
    pointerDefaultMeasureName =
      (props.pointProtoList[0]?.events?.[0]?.displayName ?? '') +
      '的' +
      (defaultUserType[0]?.displayName ?? '')
    target.name = pointerDefaultMeasureName
  })
}

// 切换事件name
function fileterCascader(item: BehaviorMeasure, index: number) {
  const options = formateCascader(item.eventName)
  // 新事件下若无旧联级选中值：重置为默认，避免 getCheckedNodes 为空报错
  if (!isCasPathValid(options, item.casList)) {
    item.casList = [pointerDefaultOne]
    item.aggregator = pointerDefaultOne
    delete item.field
    delete item.fieldType
  }

  void nextTick(() => {
    const cascaderOne = cascaderOneRefs.value[index] as CascaderLike | null
    if (!cascaderOne) return
    const checked = cascaderOne.getCheckedNodes(false) || []
    const labelOne = checked[0]?.pathLabels || []
    const eventLabel = labelOne[1]
    if (!eventLabel) return

    const pathLabels = resolveCasPathLabels(formateCascader(item.eventName), item.casList)
    if (!pathLabels.length) {
      item.casList = []
      delete item.aggregator
      delete item.field
      delete item.fieldType
      item.name = ''
    } else if (pathLabels.length > 1) {
      item.name = (eventLabel + '的' + pathLabels[0] + '的' + pathLabels[1]).trim()
    } else {
      item.name = (eventLabel + '的' + pathLabels[0]).trim()
    }

    // *** 切换cascader更改默认值 ***
    const list = pointProtoFilter(item.eventName)
    const protoOptions: PropertyNode = list.length > 0 ? (list[0] ?? {}) : {}
    const measures = item.filter.filters
    measures.forEach((measureItem) => {
      measureItem.conditions.forEach((subItem) => {
        if (subItem.fieldType == 'event_property') {
          subItem.field = protoOptions.name
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

function filterDataType(item: BehaviorMeasure, index: number, $event: unknown) {
  const casList = Array.isArray($event)
    ? ($event as string[]).slice()
    : (item.casList || []).slice()
  item.casList = casList

  if (casList.length > 1) {
    item.aggregator = casList[1]
    item.field = casList[0]
    item.fieldType = 'event_property'
  } else if (casList.length === 1) {
    item.aggregator = casList[0]
    delete item.field
    delete item.fieldType
  }

  void nextTick(() => {
    const cascaderOne = cascaderOneRefs.value[index] as CascaderLike | null
    let labelOne: string[] = []
    if (cascaderOne) {
      const checked = cascaderOne.getCheckedNodes(false) || []
      labelOne = checked[0]?.pathLabels || []
    }
    const eventLabel = labelOne[1]
    if (!eventLabel) return

    const pathLabels = resolveCasPathLabels(formateCascader(item.eventName), casList)
    if (!pathLabels.length) return

    if (pathLabels.length > 1) {
      item.name = (eventLabel + '的' + pathLabels[0] + '的' + pathLabels[1]).trim()
    } else {
      item.name = (eventLabel + '的' + pathLabels[0]).trim()
    }
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

// 切换
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
        field: strictMode(
          checkbtnPoint('event_property', eventName) as unknown as OptionDef[],
          'name',
        ),
        dataType: dataType,
        function: strictMode(filterCommonType(default_prototype.dataType), 'name'),
        fieldType: 'event_property',
        params: [],
      },
    ],
  })
}

// 编辑时默认值未显示的重新调用方法
function refreshDefault() {
  if (!default_prototype.name) {
    const eventName = props.modelObject.behavior.measures[0]?.eventName
    let position: PropertyNode[] = []
    props.pointProtoList.forEach((a) => {
      ;(a.events || []).forEach((b) => {
        if (b.name == eventName) {
          position = b.propertyList || []
        }
      })
    })
    if (position.length > 0) {
      default_prototype = position[0] ?? {}
    }
  }
}

// 增加默认值  二级事件
function secondLevelEvent(secondP_index: number, second_list: FilterModel, model?: string) {
  let field = ''
  let dataType = ''
  refreshDefault()
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
      // 与 v2 一致（v2 此处逻辑存疑：$set(item.conditions, "params", []) 是往数组上挂了个
      // 名为 params 的属性，既不是下标也没人读，等于一句空操作，这里不再复刻）
    }
  })
}

// 平级事件
function equalityEvent(secondP_index: number, three_list: FilterModel, model?: string) {
  let field = ''
  let dataType = ''
  refreshDefault()
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

/** 指标判断方式 */
const intervalOptions = computed(() => intervalList)
</script>

<template>
  <div class="box-card">
    <div>
      <el-row>
        <div style="display: flex">
          <!-- 一级且或 -->
          <div v-show="modelObject.behavior.measures.length > 1" class="andOrNot">
            <div class="btn_line"></div>
            <el-radio-group v-model="modelObject.behavior.relation" size="small" class="custom_btn">
              <el-radio-button value="and">且</el-radio-button>
              <el-radio-button value="or">或</el-radio-button>
            </el-radio-group>
            <div class="btn_line"></div>
          </div>
          <div :style="modelObject.behavior.measures.length > 1 ? 'margin-left: 40px' : ''">
            <div v-for="(item, index) in modelObject.behavior.measures" :key="index">
              <el-row
                style="display: flex; flex-direction: column; margin-bottom: 5px"
                class="child"
              >
                <!-- 一级条件样式 -->
                <div class="pointer_spacing" style="display: flex; align-items: center">
                  <div class="eg_letters">
                    {{ getLetterByIndex(index) }}
                  </div>
                  <!-- 绝对时间/相对时间 --》选择 -->
                  <div style="position: relative">
                    <el-cascader
                      v-if="showCascadwe"
                      v-model="item.echoObj.timeScope"
                      :show-all-levels="true"
                      style="width: 250px; z-index: 100"
                      :options="cascaderList"
                      filterable
                      @visible-change="handleVisible"
                      @change="clickCascader($event, index, item)"
                    />
                    <div style="position: absolute; top: 3px; height: 30px">
                      <el-date-picker
                        :ref="(el: unknown) => setDatePicker(index, el)"
                        v-model="item.echoObj.datePicker"
                        type="daterange"
                        range-separator="至"
                        start-placeholder="开始日期"
                        end-placeholder="结束日期"
                        value-format="YYYY-MM-DD"
                        :shortcuts="pickerShortcuts"
                        @change="checkDateEvent($event, item)"
                        @blur="dateBlur(item)"
                      />
                    </div>
                    <!-- popver 自定义逻辑 -->
                    <div style="position: absolute; top: 3px; height: 30px">
                      <el-popover
                        placement="bottom"
                        title="相对时间/时间范围"
                        :width="300"
                        style="background: #fff !important"
                        trigger="click"
                        :visible="!!poverVisible[index]"
                        @update:visible="(v: boolean) => (poverVisible[index] = v)"
                        @before-leave="handleHide(item)"
                      >
                        <template #reference>
                          <div style="height: 30px; width: 250px; background: #fff"></div>
                        </template>
                        <div>
                          <div class="pover_inner">请输入1-365范围内的整数</div>
                          <div class="pover_inner" style="display: flex; margin-top: 5px">
                            开始时间: 前
                            <el-input-number
                              v-model="item.echoObj.startNum"
                              class="customNum"
                              :min="1"
                              :max="365"
                            />
                          </div>
                          <div class="pover_inner" style="margin: 15px 0">
                            结束时间: 前
                            <el-input-number
                              v-model="item.echoObj.endNum"
                              class="customNum"
                              :min="1"
                              :max="365"
                            />
                          </div>
                          <div class="pover_inner">
                            <el-button class="zc_btn_default" @click="closePover(index)">
                              取消
                            </el-button>
                            <el-button class="zc_btn" @click="closePover(index, true, item)">
                              确定
                            </el-button>
                          </div>
                        </div>
                      </el-popover>
                    </div>
                  </div>
                  <div class="customSpace">做过</div>
                  <!-- end -->

                  <el-cascader
                    :key="'cascader_one-' + index"
                    :ref="(el: unknown) => setCascaderOne(index, el)"
                    v-model="item.eventName"
                    :options="pointProtoList"
                    :show-all-levels="false"
                    style="font-size: 13px"
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
                  <div class="default_font customSpace">的</div>
                  <div style="position: relative">
                    <el-cascader
                      :key="'setCascader-' + index + '-' + item.eventName"
                      v-model="item.casList"
                      :options="formateCascader(item.eventName)"
                      :props="{
                        value: 'name',
                        label: 'displayName',
                        children: 'events',
                        multiple: false,
                      }"
                      separator="的"
                      style="font-size: 13px"
                      filterable
                      class="cascader_border"
                      @change="filterDataType(item, index, $event)"
                    />
                  </div>
                  <!-- 判断 -->
                  <el-select
                    v-model="item.function"
                    style="width: 130px; margin-left: 15px"
                    @change="item.params = []"
                  >
                    <el-option
                      v-for="sub in intervalOptions"
                      :key="sub.name"
                      :label="sub.displayName"
                      :value="sub.name"
                    />
                  </el-select>
                  <!-- 校验次数 / 条数 -->
                  <div v-if="item.function == 'between'" style="white-space: nowrap">
                    <el-input
                      type="number"
                      :min="1"
                      style="width: 100px; margin-left: 15px"
                      :model-value="pget(item, 0)"
                      :style="computedStyle(item.params[0])"
                      @update:model-value="pset(item, 0, $event)"
                    />
                    <span class="tipSpan">到</span>
                    <el-input
                      type="number"
                      :min="1"
                      style="width: 100px"
                      :model-value="pget(item, 1)"
                      :style="computedStyle(item.params[1])"
                      @update:model-value="pset(item, 1, $event)"
                    />
                  </div>
                  <el-input
                    v-else
                    type="number"
                    :min="1"
                    style="width: 125px; margin-left: 15px"
                    :model-value="pget(item, 0)"
                    :style="computedStyle(item.params[0])"
                    placeholder=""
                    @update:model-value="pset(item, 0, $event)"
                  />
                  <!-- 单位 -->
                  <div v-if="item.aggregator == 'general'" class="customSpace">次</div>
                  <div v-if="item.aggregator == 'distribution'" class="customSpace">天</div>

                  <!-- end -->

                  <el-icon
                    class="el-icon-close delete_btn"
                    @click="modelObject.behavior.measures.splice(index, 1)"
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
                          left: 40px;
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
                          left: 50px;
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
                            margin-left: 45px;
                          "
                        >
                          <!-- *** 一级select *** -->
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
                            @click="
                              threeDeleteEvent(secondP_index, second_index, item.filter.filters)
                            "
                          >
                            <Close />
                          </el-icon>
                        </div>
                        <div
                          v-if="secondP_item.conditions.length == second_index + 1"
                          style="display: flex; margin-left: 45px"
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
                        <div style="display: flex; padding-top: 10px; align-items: flex-start">
                          <div class="letter_lower" style="margin-right: 7px">
                            {{ getLetterLowercase(secondP_index) }}
                          </div>
                          <!-- *** 一级select *** -->
                          <TreeSelect
                            ref="customTree"
                            :radio-options="radioOptions"
                            :second_item="second_item"
                            :property-list="propertyList"
                            :second_index="second_index"
                            :point-proto-list="pointProtoFilter(item.eventName)"
                            @change="handelJudge(second_item)"
                          />
                          <!-- *** end *** -->
                          <el-select
                            v-if="second_item.fieldType != 'user_group'"
                            v-model="second_item.function"
                            style="width: 140px; margin-left: 15px"
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

                          <!-- 根据NUMBER类型展示文本 -->
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
                            style="padding: 0px 0 0 13px"
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
              </el-row>
            </div>
          </div>
        </div>
        <!-- 增加按钮 -->
        <div
          :style="modelObject.behavior.measures.length > 1 ? 'margin-left: 40px' : ''"
          class="circle add_icon pointer_spacing"
          @click="circleAddEvent()"
        ></div>
      </el-row>
    </div>
  </div>
</template>

<style lang="scss">
.customSpace {
  font-size: 13px;
  color: #514f4f !important;
  padding: 0 10px;
  white-space: nowrap;
}

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

// 且或
.andOrNot {
  color: gray;
  font-size: 13px;
  position: absolute;
  left: 0px;
  height: calc(100% - 0px);
  display: flex;
  top: 0px;
  flex-direction: column;
  justify-content: center;
  align-items: center;

  .btn_line {
    width: 1px;
    height: 100%;
    border-right: 1px solid rgb(218, 217, 217);
  }
}

p {
  white-space: nowrap;
  padding: 0;
  margin: 0;
}

//pover
.pover_inner {
  display: flex;
  font-size: 14px;
  line-height: 35px;
  background: #fff;
}

.titleHead {
  color: #6d6e70;
  font-size: 13px;
}

:deep() {
  // 天数el-input-number 自定义
  .el-input-number {
    width: 160px !important;
  }

  .customNum {
    margin-left: 5px;

    .el-input__wrapper {
      height: 36px;
    }
  }

  //日期
  .el-range-editor.el-input__wrapper {
    height: 30px;
    width: 250px;
  }

  .el-popover {
    background: #fff;
  }

  // end
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
  // 指标间距
  margin: 15px 48px;

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

  .el-icon-close:hover {
    color: #2c7be5;
  }

  .add_icon {
    cursor: pointer;
    font-size: 30px;
    font-weight: 400;
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

  .tipSpan {
    margin: 0 15px;
    font-size: 13px;
    color: #606266;
    line-height: 30px;
  }
}
</style>
