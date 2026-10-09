<script setup lang="ts">
/**
 * 「用户行为满足」规则
 * （对应 v2 src/views/ups/userTag/components/customTagPage/typeRules/behaviorRules.vue）。
 *
 * 数据结构：modelObject = 当前分层的 rules，本组件只动 modelObject.behavior
 *   behavior: { relation: 'and'|'or', measures: MeasureItem[] }
 * measure 的形状见 circleAddEvent()，字段名与 v2 一一对应。
 *
 * element-plus / Vue3 适配：
 *   $refs.customPover[i].showPopper = true → v-model:visible + timePoverVisible[i]
 *   $refs.customPover[i].doClose()         → timePoverVisible[i] = false
 *   $refs.datePickerShow[i].focus()        → datePickerRefs[i]?.focus()
 *   $refs['cascader_one'+i][0] / $refs.setCascader[i] → 函数 ref 收进数组
 *   $refs.customTree（treeSelect 数组）     → 函数 ref 收进 Record，逐个调 refreshTreeList()
 *   :picker-options                        → :shortcuts
 *   value-format="yyyy-MM-dd"              → "YYYY-MM-DD"
 *   :active-item-change                    → element-plus 没有这个属性，去掉
 *   el-icon-xxx                            → <el-icon> + icons-vue（类名沿用 v2，样式不动）
 *
 * v2 里未搬运的死代码：generateRandomKey（本文件的 :key 用的是稳定字符串）、testArray、
 * handleVisibleChange、checkpointProtoFrom、filterJudgmentType、getClasses、oldProperty、
 * showFlagPage / commonParams / second_option、handleVisible（空实现）、
 * attr_string / attr_number / attr_boolean / attr_dateTime（import 了但没用）。
 */
import { computed, nextTick, ref, watch } from 'vue'
import { Close, Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { CascaderInstance } from 'element-plus'
import conditionOption from './conditionOption.vue'
import treeSelect from '@/views/ups/components/tree-select.vue'
import { NumberType, getOptionsByType, noNumber } from '@/utils/modelOptions/custom'
import type { OptionDef } from '@/utils/modelOptions/custom'
import {
  defaultUserType,
  groupValueType,
  intervalList,
} from '@/utils/modelOptions/up-manage'
import type { CascaderOption } from '@/utils/modelOptions/up-manage'
import {
  computedStyle as computedStyleFn,
  filterIstrue,
  getLetterByIndex,
  getLetterLowercase,
  isValidDateStr,
  rangeShortcuts,
  splitDateRange,
  strictMode,
} from '../../../local-utils'
import type {
  ConditionItem,
  ConditionParam,
  FilterBlock,
  MeasureItem,
  PointTypeList,
  PropertyListMap,
  PropertyNode,
  RadioOption,
  TagRuleSet,
} from '../../../types'

/** el-date-picker 实例上用得到的方法 */
interface DatePickerExposed {
  focus: () => void
}
/** treeSelect 暴露出来的刷新方法 */
interface TreeSelectExposed {
  refreshTreeList: () => void
}

const props = withDefaults(
  defineProps<{
    pointProtoList?: PropertyNode[]
    pointTypeList?: PointTypeList
    propertyList?: Partial<PropertyListMap>
    modelObject: TagRuleSet
    cascaderList?: CascaderOption[]
  }>(),
  {
    pointProtoList: () => [],
    pointTypeList: () => ({ userProtoList: [], eventProtoList: [] }),
    propertyList: () => ({
      commonPropertySum: [], // 共用事件属性
      userProperties: [], // 共用用户属性
      userGroupList: [], // 用户分群
    }),
    cascaderList: () => [],
  },
)

const radioOptions: RadioOption[] = [
  { label: '事件属性', value: 'event_property' },
  { label: '用户属性', value: 'user_property' },
  // { label: "用户分群", value: "user_group" },
  { label: '用户标签', value: 'user_tag' },
]

const showCascadwe = ref(true)
const eventType = ref('')
const default_options = defaultUserType
const pointerDefaultOne = defaultUserType[0]?.name ?? ''
const pointerDefaultMeasureName = ref('')
const default_prototype = ref<PropertyNode | ''>('')
const initSelectObj = {
  dataType: '',
  displayName: '',
  name: '',
  propertyId: '',
}

/** 「相对时间/时间范围」弹窗的显隐，下标与 measures 对齐 */
const timePoverVisible = ref<boolean[]>([])
const datePickerRefs = ref<(DatePickerExposed | null)[]>([])
const cascaderOneRefs = ref<(CascaderInstance | null)[]>([])
const setCascaderRefs = ref<(CascaderInstance | null)[]>([])
/** 所有 treeSelect 实例，key 只是为了去重，调用时统一遍历 */
const customTreeRefs = ref<Record<string, TreeSelectExposed>>({})

function setDatePickerRef(el: unknown, index: number) {
  if (el) datePickerRefs.value[index] = el as DatePickerExposed
}
function setCascaderOneRef(el: unknown, index: number) {
  if (el) cascaderOneRefs.value[index] = el as CascaderInstance
}
function setSetCascaderRef(el: unknown, index: number) {
  if (el) setCascaderRefs.value[index] = el as CascaderInstance
}
function setCustomTreeRef(el: unknown, key: string) {
  if (el) {
    customTreeRefs.value[key] = el as TreeSelectExposed
  } else {
    delete customTreeRefs.value[key]
  }
}

/**
 * 「用户行为满足」的 measure 一定带 function / params（circleAddEvent 里就建好了），
 * 公共 MeasureItem 上这两个字段是可选的（基础指标值那几种没有），模板里统一按这个形状读。
 */
type BehaviorMeasure = MeasureItem & { params: ConditionParam[] }

const measures = computed(() => props.modelObject.behavior.measures as BehaviorMeasure[])

// el-popover 的 visible 必须是明确的布尔值才算「受控」，这里跟着 measures 长度补齐
watch(
  () => props.modelObject.behavior.measures.length,
  (len) => {
    for (let i = 0; i < len; i++) {
      if (timePoverVisible.value[i] === undefined) timePoverVisible.value[i] = false
    }
  },
  { immediate: true },
)

function computedStyle(value: unknown) {
  return computedStyleFn(value, props.modelObject)
}

function circleAddEvent() {
  props.pointProtoList.map((item, index) => {
    item.displayName = item.groupName ?? ''
    item.name = item.groupName ?? ''
    item.events?.map((sub, sub_index) => {
      if (sub_index == 0 && index == 0) {
        eventType.value = sub.name
      }
    })
  })
  const object: MeasureItem = {
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
    target.eventName = eventType.value
    target.casList = [pointerDefaultOne]
    target.aggregator = pointerDefaultOne
    // 设置name 名称拼接
    pointerDefaultMeasureName.value =
      (props.pointProtoList[0]?.events?.[0]?.displayName ?? '') +
      '的' +
      (defaultUserType[0]?.displayName ?? '')
    target.name = pointerDefaultMeasureName.value
  })

  // end
}

function datePickerOptions(item: MeasureItem) {
  const obj: CascaderOption = {
    label: '前' + item.echoObj.startNum + '天' + '到前' + item.echoObj.endNum + '天',
    // value: item.echoObj.startNum + "-" + item.echoObj.endNum,
    value: `${'-'}${item.echoObj.startNum}${'day'}` + '~' + `${'-'}${item.echoObj.endNum}${'day'}`,
    custom: true,
  }

  // 方式一 覆盖上次自定义数据（v2 里这段是注释）
  // 方式二   去重
  const relative = props.cascaderList[1]
  if (relative && relative.children) {
    relative.children.push(obj)
    relative.children = relative.children.filter(
      (object, index, self) => index === self.findIndex((t) => t.label === object.label),
    )
  }

  // 进行赋值
  const newlevel = item.echoObj.timeScope
  // newlevel[1] = item.echoObj.startNum + "-" + item.echoObj.endNum;
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
function checkDateEvent(val: [string, string] | null, item: MeasureItem) {
  // 与 v2 一致（v2 此处逻辑存疑：清空日期时 val 为 null，v2 直接读 val[0] 会抛异常）
  if (!val) return
  const obj: CascaderOption = {
    label: val[0] + '~' + val[1],
    value: val[0] + '~' + val[1],
  }
  const absolute = props.cascaderList[0]
  if (absolute && absolute.children) {
    absolute.children.push(obj)
    absolute.children = absolute.children.filter(
      (object, index, self) => index === self.findIndex((t) => t.label === object.label),
    )
  }

  // 进行赋值
  const newlevel = item.echoObj.timeScope
  newlevel[1] = val[0] + '~' + val[1]
  item.echoObj.timeScope = newlevel

  // 后端字段进行赋值 earlist和latest字段
  item.earlistTime = Math.floor(new Date(val[0]).getTime() / 1000)
  item.latestTime = Math.floor(new Date(val[1]).getTime() / 1000)
  //缓存绝对时间 非自定义上次数据
  item.echoObj.lastAbsoluteTime = newlevel
}

//日历控件关闭后的操作
function dateBlur(item: MeasureItem) {
  if (item.echoObj.lastAbsoluteTime.length > 0) {
    item.echoObj.timeScope = item.echoObj.lastAbsoluteTime
  } else {
    item.echoObj.timeScope = item.echoObj.lastRelativeTime
  }
}

function clickCascader(val: unknown, index: number, item: MeasureItem) {
  const path = (val as string[] | null) || []
  // 自定义事件
  if (path.length > 1) {
    const second = path[1] ?? ''
    if (second == 'custom') {
      // pover 自定义天数
      timePoverVisible.value[index] = true
    } else if (second == 'time_scope') {
      // 自定义日期范围
      datePickerRefs.value[index]?.focus()
    } else {
      // 设置后端字段进行赋值 earlist和latest字段
      const dateTime = splitDateRange(second)
      if (dateTime) {
        const start = dateTime[0]
        const end = dateTime[1]
        if (start && end && isValidDateStr(start) && isValidDateStr(end)) {
          // 转换为时间戳（秒）
          item.earlistTime = Math.floor(new Date(start).getTime() / 1000)
          item.latestTime = Math.floor(new Date(end).getTime() / 1000)
        }
      } else {
        // 直接选择联级相对时间段
        item.earlistTime = second
        item.latestTime = 'now'
      }
    }
  }
}

function closePover(index: number, isTrue?: boolean, item?: MeasureItem) {
  // 相对时间自定义天数   新增类
  if (isTrue && item) {
    item.echoObj.lastAbsoluteTime = []
    if (Number(item.echoObj.startNum) < Number(item.echoObj.endNum)) {
      ElMessage.error('开始时间必须早于结束时间')
      return
    }
    datePickerOptions(item)
  }
  timePoverVisible.value[index] = false
}

function handleHide(item: MeasureItem) {
  if (item.echoObj.lastAbsoluteTime.length > 0) {
    item.echoObj.timeScope = item.echoObj.lastAbsoluteTime
  } else {
    item.echoObj.timeScope = item.echoObj.lastRelativeTime
  }
}

function formateCascader(val: string): PropertyNode[] {
  let options: PropertyNode[] = []
  props.pointProtoList.map((a) => {
    a.events?.map((b) => {
      if (b.name == val) {
        options = b.propertyList ?? []
      }
      return undefined
    })
  })
  const mergedArray: PropertyNode[] = [
    ...(default_options as unknown as PropertyNode[]),
    ...options,
  ]
  mergedArray.map((item) => {
    if (item.dataType) {
      switch (item.dataType) {
        case 'STRING':
          item.events = noNumber as unknown as PropertyNode[]
          break
        case 'NUMBER':
          item.events = NumberType as unknown as PropertyNode[]
          break
        default:
          item.events = noNumber as unknown as PropertyNode[]
          break
      }
    }
  })
  return mergedArray
}

// 判断联级路径是否存在于当前 options（需选到叶子）
function isCasPathValid(options: PropertyNode[], path: string[]) {
  if (!Array.isArray(path) || !path.length) return false
  let current: PropertyNode[] = options || []
  let node: PropertyNode | undefined
  for (let i = 0; i < path.length; i++) {
    node = current.find((opt) => opt && opt.name === path[i])
    if (!node) return false
    current = node.events || []
  }
  return !node?.events || !node.events.length
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

// 切换事件name
function fileterCascader(item: MeasureItem, index: number) {
  // 切换事件后，旧 casList 可能不在新 options 中 → getCheckedNodes 为空会报 pathLabels
  const cascaderOptions = formateCascader(item.eventName)
  if (!isCasPathValid(cascaderOptions, item.casList)) {
    item.casList = [pointerDefaultOne]
    item.aggregator = pointerDefaultOne
    delete item.field
    delete item.fieldType
  }

  void nextTick(() => {
    const cascaderOneRef = cascaderOneRefs.value[index]
    const setCascaderRef = setCascaderRefs.value[index]
    if (!cascaderOneRef || !setCascaderRef) {
      return
    }
    const cascader_one = cascaderOneRef.getCheckedNodes(false) || []
    const nodesInfo = setCascaderRef.getCheckedNodes(false) || []
    if (!cascader_one[0] || !nodesInfo[0]) {
      return
    }
    const labelOne = cascader_one[0].pathLabels || []
    const pathLabels = nodesInfo[0].pathLabels || []
    if (!labelOne[1]) {
      return
    }
    if (pathLabels.length > 1) {
      item.name = (labelOne[1] + '的' + pathLabels[0] + '的' + pathLabels[1]).trim()
    } else {
      item.name = (labelOne[1] + '的' + pathLabels[0]).trim()
    }

    // *** 切换cascader更改默认值 ***
    const filtered = pointProtoFilter(item.eventName)
    const options = filtered.length > 0 ? filtered[0] : undefined
    const measureFilters = item.filter.filters
    measureFilters.map((measureItem) => {
      measureItem.conditions.map((subItem) => {
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

function filterDataType(item: MeasureItem, index: number) {
  const cascaderOneRef = cascaderOneRefs.value[index]
  const setCascaderRef = setCascaderRefs.value[index]
  if (!cascaderOneRef || !setCascaderRef) {
    return
  }
  const cascader_one = cascaderOneRef.getCheckedNodes(false) || []
  const nodesInfo = setCascaderRef.getCheckedNodes(false) || []
  if (!cascader_one[0] || !nodesInfo[0]) {
    return
  }
  const labelOne = cascader_one[0].pathLabels || []
  const pathLabels = nodesInfo[0].pathLabels || []
  if (pathLabels.length > 1) {
    item.name = (labelOne[1] + '的' + pathLabels[0] + '的' + pathLabels[1]).trim()
  } else {
    item.name = (labelOne[1] + '的' + pathLabels[0]).trim()
  }
  if (item.casList.length > 1) {
    item.aggregator = item.casList[1]
    item.field = item.casList[0]
    item.fieldType = 'event_property'
  } else {
    item.aggregator = item.casList[0]
    delete item.field
    delete item.fieldType
  }
}

// select 数据过滤
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

// 编辑时默认值未显示的重新调用方法
function refreshDefault() {
  if (!default_prototype.value) {
    const eventName = props.modelObject.behavior.measures[0]?.eventName
    let position: PropertyNode[] = []
    props.pointProtoList.map((a) => {
      a.events?.map((b) => {
        if (b.name == eventName) {
          return (position = b.propertyList ?? [])
        }
        return undefined
      })
    })
    if (position.length > 0) {
      default_prototype.value = position[0] ?? ''
    }
  }
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
  refreshDefault()
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
    dataType: dataType,
    function: strictMode(filterCommonType(dataType), 'name'),
    fieldType: 'event_property',
    params: [],
  }
  // second_list.measures.map((item, index) => {
  second_list.filters.map((item, index) => {
    if (secondP_index == index) {
      item.relation = 'and'
      item.conditions.push(addObj)
      // v2 这里还有 this.$set(item.conditions, "params", [])：往数组对象上挂了个
      // 名为 params 的属性，没有任何读取方，是无效写入，不再搬运。
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
  refreshDefault()
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

defineExpose({ circleAddEvent })
</script>

<template>
  <div class="box-card">
    <div>
      <el-row>
        <div style="display: flex">
          <!-- 一级且或 -->
          <div v-show="measures.length > 1" class="andOrNot">
            <div class="btn_line"></div>
            <el-radio-group
              v-model="modelObject.behavior.relation"
              size="small"
              class="custom_btn"
            >
              <el-radio-button value="and">且</el-radio-button>
              <el-radio-button value="or">或</el-radio-button>
            </el-radio-group>
            <div class="btn_line"></div>
          </div>
          <div :style="measures.length > 1 ? 'margin-left: 40px' : ''">
            <div v-for="(item, index) in measures" :key="index">
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
                      @change="clickCascader($event, index, item)"
                    ></el-cascader>
                    <div style="position: absolute; top: 3px; height: 30px">
                      <el-date-picker
                        :ref="(el: unknown) => setDatePickerRef(el, index)"
                        v-model="item.echoObj.datePicker"
                        type="daterange"
                        range-separator="至"
                        start-placeholder="开始日期"
                        end-placeholder="结束日期"
                        value-format="YYYY-MM-DD"
                        :shortcuts="rangeShortcuts"
                        class="rules_date_picker_boder"
                        @change="checkDateEvent($event, item)"
                        @blur="dateBlur(item)"
                      >
                      </el-date-picker>
                    </div>
                    <!-- popver 自定义逻辑 -->
                    <div style="position: absolute; top: 3px; height: 30px">
                      <el-popover
                        v-model:visible="timePoverVisible[index]"
                        placement="bottom"
                        title="相对时间/时间范围"
                        :width="300"
                        style="background: #fff !important"
                        trigger="click"
                        @hide="handleHide(item)"
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
                            ></el-input-number>
                          </div>
                          <div class="pover_inner" style="margin: 15px 0">
                            结束时间: 前
                            <el-input-number
                              v-model="item.echoObj.endNum"
                              class="customNum"
                              :min="1"
                              :max="365"
                            ></el-input-number>
                          </div>
                          <div class="pover_inner">
                            <el-button class="zc_btn_default" @click="closePover(index)"
                              >取消</el-button
                            >
                            <el-button class="zc_btn" @click="closePover(index, true, item)"
                              >确定</el-button
                            >
                          </div>
                        </div>
                      </el-popover>
                    </div>
                  </div>
                  <div class="customSpace">做过</div>
                  <!-- end -->

                  <el-cascader
                    :key="'cascader_one-' + index"
                    :ref="(el: unknown) => setCascaderOneRef(el, index)"
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
                  ></el-cascader>
                  <div class="default_font customSpace">的</div>
                  <div style="position: relative">
                    <el-cascader
                      :key="'setCascader-' + index + '-' + item.eventName"
                      :ref="(el: unknown) => setSetCascaderRef(el, index)"
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
                      @change="filterDataType(item, index)"
                    ></el-cascader>
                  </div>
                  <!-- 判断 -->
                  <el-select
                    v-model="item.function"
                    style="width: 130px; margin-left: 15px"
                    @change="item.params = []"
                  >
                    <el-option
                      v-for="sub in intervalList"
                      :key="sub.name"
                      :label="sub.displayName"
                      :value="sub.name"
                    >
                    </el-option>
                  </el-select>
                  <!-- 校验次数 / 条数 -->
                  <div v-if="item.function == 'between'" style="white-space: nowrap">
                    <el-input
                      v-model="item.params[0]"
                      type="number"
                      :min="1"
                      class="input_number_width"
                      style="margin-left: 15px"
                      :style="computedStyle(item.params[0])"
                    ></el-input>
                    <span class="tipSpan">到</span>
                    <el-input
                      v-model="item.params[1]"
                      type="number"
                      :min="1"
                      class="input_number_width"
                      :style="computedStyle(item.params[1])"
                    ></el-input>
                  </div>
                  <el-input
                    v-else
                    v-model="item.params[0]"
                    type="number"
                    :min="1"
                    class="input_number_width"
                    style="margin-left: 15px"
                    :style="computedStyle(item.params[0])"
                    placeholder=""
                  ></el-input>
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
                          style="display: flex; margin-left: 45px"
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
                        <div style="display: flex; padding-top: 10px; align-items: flex-start">
                          <div class="letter_lower" style="margin-right: 7px">
                            {{ getLetterLowercase(secondP_index) }}
                          </div>
                          <!-- *** 一级select *** -->
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
                            style="padding: 0px 0 0 13px"
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
              </el-row>
            </div>
          </div>
        </div>
        <!-- 增加按钮 -->
        <div
          :style="measures.length > 1 ? 'margin-left: 40px' : ''"
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
// 且或
.andOrNot {
  // min-height: 200px;
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

// 天数el-input-number 自定义
:deep(.el-input-number) {
  width: 160px !important;
}

:deep(.customNum) {
  margin-left: 5px;

  .el-input__wrapper {
    height: 30px;
  }
}

:deep(.el-button) {
  height: 30px;
}

//日期
:deep(.el-range-editor) {
  height: 30px;
  width: 250px;
}

:deep(.el-popover) {
  background: #fff;
}

// end
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

  .tipSpan {
    margin: 0 15px;
    font-size: 13px;
    color: #606266;
    line-height: 30px;
  }
}
</style>
