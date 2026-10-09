<script setup lang="ts">
/**
 * 基础指标值的规则编辑器
 * （对应 v2 src/views/ups/userTag/components/basicpointer/basicRules.vue）。
 *
 * 数据结构（modelObject = 外层 modelObject.rules）：
 *   { relation?: 'and'|'or', measures: MeasureItem[] }
 * measure 的形状见 circleAddEvent()，字段名与 v2 一一对应，没有做任何归并。
 *
 * element-plus / Vue3 适配：
 *   $refs.customPover[i].showPopper = true → v-model:visible + timePoverVisible[i]
 *   $refs.customPover[i].doClose()         → timePoverVisible[i] = false
 *   $refs.datePickerShow[i].focus()        → datePickerRefs[i]?.focus()
 *   $refs['cascader_one'+i][0] / $refs.setCascader[i] → 函数 ref 收进数组
 *   :picker-options                        → :shortcuts
 *   value-format="yyyy-MM-dd"              → "YYYY-MM-DD"
 *   :active-item-change                    → element-plus 没有这个属性，去掉
 *   :append-to-body="false"                → :teleported="false"
 *   slot="reference" / slot="append"       → <template #reference> / #append
 *   @keyup.up.native                       → @keyup.up
 *   this.$set(a, k, v)                     → a[k] = v
 *   el-icon-xxx                            → <el-icon> + icons-vue（类名沿用 v2，样式不动）
 *   this.$message.error                    → ElMessage.error
 *
 * 与 v2 一致（v2 此处逻辑存疑）：v2 把「相对时间自定义」弹窗和「区间设置」弹窗都写成了
 * ref="customPover"，在 Vue2 里它们会挤进同一个 $refs 数组，索引是错位的；
 * 因为本组件只会有一条 measure（circleAddEvent 只在 index.vue 里调一次、新增按钮是注释掉的），
 * index=0 恰好命中时间弹窗，所以没暴露出来。v3 给时间弹窗单独一套 visible 数组，避免错位。
 *
 * v2 里未搬运的死代码：handleSelecttest（整体被注释）、saveHistoryData、initSumApi、
 * clearVal2、getClasses、checkTypeArray、handleVisibleChange、checkpointProtoFrom、
 * oldProperty、handleVisible（空实现）—— 模板和逻辑里都没有调用点。
 */
import { computed, nextTick, ref, watch } from 'vue'
import { Close, Operation, Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { CascaderInstance } from 'element-plus'
import treeSelect from '@/views/ups/components/tree-select.vue'
import conditionOption from '../conditionOption.vue'
import { defaultUserType, divideList, groupValueType } from '@/utils/modelOptions/up-manage'
import type { CascaderOption, OptionDef } from '@/utils/modelOptions/up-manage'
import { NumberType, getOptionsByType, noNumber } from '@/utils/modelOptions/custom'
import {
  createUniqueString,
  filterIstrue,
  getLetterByIndex,
  getLetterLowercase,
  isValidDateStr,
  rangeShortcuts,
  splitDateRange,
  strictMode,
} from '../../local-utils'
import type {
  ConditionItem,
  DevideItem,
  FilterBlock,
  MeasureItem,
  PointTypeList,
  PropertyListMap,
  PropertyNode,
  RadioOption,
  SetInterval,
} from '../../types'

/** 本组件里的 measure 一定带区间设置 */
type IntervalMeasure = MeasureItem & { setInterval: SetInterval }

interface BasicRulesModel {
  relation?: 'and' | 'or'
  measures: MeasureItem[]
}

/** el-date-picker 实例上用得到的方法 */
interface DatePickerExposed {
  focus: () => void
}

const props = withDefaults(
  defineProps<{
    pointProtoList?: PropertyNode[]
    propertyList?: Partial<PropertyListMap>
    pointTypeList?: PointTypeList
    modelObject: BasicRulesModel
    cascaderList?: CascaderOption[]
  }>(),
  {
    pointProtoList: () => [],
    propertyList: () => ({
      commonPropertySum: [], // 共用事件属性
      userProperties: [], // 共用用户属性
      userGroupList: [], // 用户分群
    }),
    pointTypeList: () => ({ userProtoList: [], eventProtoList: [] }),
    cascaderList: () => [],
  },
)

const radioOptions: RadioOption[] = [
  { label: '事件属性', value: 'event_property' },
  // { label: "用户属性", value: "user_property" },
  // { label: "用户分群", value: "user_group" },
  // { label: "用户标签", value: "user_tag" },
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

function setDatePickerRef(el: unknown, index: number) {
  if (el) datePickerRefs.value[index] = el as DatePickerExposed
}
function setCascaderOneRef(el: unknown, index: number) {
  if (el) cascaderOneRefs.value[index] = el as CascaderInstance
}
function setSetCascaderRef(el: unknown, index: number) {
  if (el) setCascaderRefs.value[index] = el as CascaderInstance
}

/** 模板里统一按「一定有 setInterval」的形状读，避免满屏的可选链 */
const measureList = computed(() => (props.modelObject.measures || []) as IntervalMeasure[])

// el-popover 的 visible 必须是明确的布尔值才算「受控」，这里跟着 measures 长度补齐
watch(
  () => props.modelObject.measures.length,
  (len) => {
    for (let i = 0; i < len; i++) {
      if (timePoverVisible.value[i] === undefined) timePoverVisible.value[i] = false
    }
  },
  { immediate: true },
)

function refreshEvent(indexNum: number) {
  props.pointProtoList.map((item, index) => {
    item.displayName = item.groupName ?? ''
    item.name = item.groupName ?? ''
    item.events?.map((sub, sub_index) => {
      if (sub_index == 0 && index == 0) {
        eventType.value = sub.name
      }
    })
  })
  const target = props.modelObject.measures[indexNum]
  if (!target) return
  target.eventName = eventType.value
  // 设置name 名称拼接
  pointerDefaultMeasureName.value =
    (props.pointProtoList[0]?.events?.[0]?.displayName ?? '') +
    '的' +
    (defaultUserType[0]?.displayName ?? '')
  target.name = pointerDefaultMeasureName.value
}

function circleAddEvent() {
  const object: IntervalMeasure = {
    eventName: '',
    casList: [],
    setInterval: {
      divideName: '百分比区间划分',
      devideList: [
        {
          name: '分层1',
          params: [0, 5],
        },
        {
          name: '分层2',
          params: [5, 20],
        },
        {
          name: '分层3',
          params: [20, 100],
        },
      ],
    },
    name: '',
    // 用于自定义回显数据存放
    echoObj: {
      lastRelativeTime: ['relative_time', '-1day'],
      timeScope: ['relative_time', '-1day'],
      lastAbsoluteTime: [],
      datePicker: [], //日期
      startNum: null,
      endNum: null,
    },
    // 与 v2 一致：基础指标值的 measure 对象里没有 function / params 两个字段
    earlistTime: '-1day',
    latestTime: 'now',
    filter: {
      relation: 'and',
      filters: [],
    },
  }
  props.modelObject.measures.push(object)
  const indexNum = props.modelObject.measures.length - 1
  const target = props.modelObject.measures[indexNum]
  if (!target) return

  target.casList = [pointerDefaultOne]
  target.aggregator = pointerDefaultOne
  if (props.pointProtoList.length < 1) {
    setTimeout(() => {
      refreshEvent(indexNum)
    }, 500)
    return
  }
  refreshEvent(indexNum)
}

function handleSelect(item: SetInterval) {
  let params: DevideItem[]
  if (item.divideName == '离散数值') {
    params = []
  } else if (item.divideName == '百分比区间划分') {
    params = [
      {
        name: '分层1',
        params: [0, 5],
      },
      {
        name: '分层2',
        params: [5, 20],
      },
      {
        name: '分层3',
        params: [20, 100],
      },
    ]
  } else {
    params = [
      {
        params: ['最大值', null],
        name: '分层1',
      },
      {
        params: [null, '最小值'],
        name: '分层2',
      },
    ]
  }
  item.devideList = params
}

function increaseValue(event: DevideItem) {
  if (event.params[0]) {
    const newVal = parseFloat(String(event.params[0])) + 1
    event.params[0] = newVal
  } else {
    event.params[0] = 1
  }
}

function decreaseValue(event: DevideItem) {
  if (Number(event.params[0]) > 0) {
    const newVal = parseFloat(String(event.params[0])) - 1
    event.params[0] = newVal
  } else {
    event.params[0] = 0
  }
}

function inputEvent(scope: { row: DevideItem; $index: number }, item: IntervalMeasure) {
  const value = scope.row.params[1]
  const next = item.setInterval.devideList[scope.$index + 1]
  if (next) next.params[0] = value ?? null
}

function inputBlurEvent(scope: { row: DevideItem; $index: number }, item: IntervalMeasure) {
  const value = scope.row.params[1]
  if (item.setInterval.divideName == '百分比区间划分') {
    const current = item.setInterval.devideList[scope.$index]
    const next = item.setInterval.devideList[scope.$index + 1]
    if (Number(value) > 100) {
      if (current) current.params[1] = 100
      if (next) next.params[0] = 100
    } else if (Number(value) < 0) {
      if (current) current.params[1] = 0
      if (next) next.params[0] = 0
    }
  }
}

function deleteInterverNumber(scope: { $index: number }, item: IntervalMeasure) {
  item.setInterval.devideList.splice(scope.$index, 1)
  const itemObj = item.setInterval.devideList
  let lastValue: string | number | null
  if (item.setInterval.devideList.length > 1) {
    lastValue = itemObj[itemObj.length - 2]?.params[1] ?? null
  } else {
    lastValue = '最大值'
  }
  const last = itemObj[itemObj.length - 1]
  if (last) last.params = [lastValue, '最小值']
}

function deleteInterver(scope: { $index: number }, item: IntervalMeasure) {
  item.setInterval.devideList.splice(scope.$index, 1)
  const itemObj = item.setInterval.devideList
  let lastValue: string | number | null
  if (item.setInterval.devideList.length > 1) {
    lastValue = itemObj[itemObj.length - 2]?.params[1] ?? null
  } else {
    lastValue = 0
  }
  const last = itemObj[itemObj.length - 1]
  if (last) last.params = [lastValue, 100]
}

function addDevideEvent(item: IntervalMeasure) {
  const list = item.setInterval.devideList
  const tail = list[list.length - 1]
  // 与 v2 一致：分层名用的是 measures[0] 的长度，而不是当前 item 的长度
  const firstMeasure = props.modelObject.measures[0] as IntervalMeasure | undefined
  const nameIndex = (firstMeasure?.setInterval.devideList.length ?? 0) + 1
  if (item.setInterval.divideName == '数值区间划分') {
    if (tail) tail.params[1] = ''
    list.push({
      params: ['', '最小值'],
      name: '分层' + nameIndex,
    })
  } else {
    if (tail) tail.params[1] = ''
    list.push({
      params: ['', 100],
      name: '分层' + nameIndex,
    })
  }
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

function datePickerOptions(item: MeasureItem) {
  const obj: CascaderOption = {
    label: '前' + item.echoObj.startNum + '天' + '到前' + item.echoObj.endNum + '天',
    value:
      `${'-'}${item.echoObj.startNum}${'day'}` + '~' + `${'-'}${item.echoObj.endNum}${'day'}`,
    custom: true,
  }
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
  // 与 v2 一致（v2 此处逻辑存疑：清空日期时 val 为 null，v2 直接读 val[0] 会抛异常；
  // v3 的类型里 val 可能为 null，必须先挡一下）
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

function testArray(val: unknown[]) {
  return val
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

/** 与 v2 一致：每次渲染都会生成新 key，强制 el-cascader 重建 */
function generateRandomKey() {
  return createUniqueString()
}

function pickPathLabels(index: number) {
  const one = cascaderOneRefs.value[index]?.getCheckedNodes(false) || []
  const two = setCascaderRefs.value[index]?.getCheckedNodes(false) || []
  return {
    labelOne: one[0]?.pathLabels || [],
    pathLabels: two[0]?.pathLabels || [],
  }
}

// 切换事件name
function fileterCascader(item: MeasureItem, index: number) {
  void nextTick(() => {
    const { labelOne, pathLabels } = pickPathLabels(index)
    if (pathLabels.length > 1) {
      item.name = (labelOne[1] + '的' + pathLabels[0] + '的' + pathLabels[1]).trim()
    } else {
      item.name = labelOne[1] + '的' + pathLabels[0]
    }
  })
}

function filterDataType(item: MeasureItem, index: number) {
  const { labelOne, pathLabels } = pickPathLabels(index)
  if (pathLabels.length > 1) {
    item.name = (labelOne[1] + '的' + pathLabels[0] + '的' + pathLabels[1]).trim()
  } else {
    item.name = (labelOne[1] + '的' + pathLabels[0]).trim()
  }
  if (item.casList.length > 1) {
    item.aggregator = item.casList[1]
  } else {
    item.aggregator = item.casList[0]
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
  } else {
    // position = this.userProtoList;
    position = props.pointTypeList.userProtoList
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

function filterJudgmentType(list: PropertyNode[], val?: string): OptionDef[] {
  let options: OptionDef[] = []
  list.map((item) => {
    if (item.name == val) {
      options = getOptionsByType(item.dataType)
    }
  })
  return options
}

// 切换
function checkJudgmentType(val: string | undefined, second_item: ConditionItem): OptionDef[] {
  let options: OptionDef[] = []
  if (!val) return options
  if (second_item.fieldType == 'user_group') {
    options = groupValueType
  } else {
    props.pointTypeList.eventProtoList.map((item) => {
      if (item.name == val) {
        options = getOptionsByType(item.dataType)
      }
    })
    // 用户数据筛选
    if (options.length == 0) {
      // 与 v2 一致（v2 此处逻辑存疑：filterJudgmentType 的第二个参数没传，
      // 内部 item.name == undefined 永远不成立，返回的始终是空数组）
      options = filterJudgmentType(props.pointTypeList.userProtoList)
    }
  }

  return options
}

function filterPiPei(val: ConditionItem) {
  val.params = []
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
    dataType: dataType,
    function: strictMode(filterCommonType(dataType), 'name'),
    fieldType: 'event_property',
    params: [],
  }
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
        <div v-if="modelObject.measures" style="display: flex">
          <!-- 一级且或 -->
          <div v-show="modelObject.measures.length > 1" class="andOrNot">
            <div class="btn_line"></div>
            <el-radio-group v-model="modelObject.relation" size="small" class="custom_btn">
              <el-radio-button value="and">且</el-radio-button>
              <el-radio-button value="or">或</el-radio-button>
            </el-radio-group>
            <div class="btn_line"></div>
          </div>
          <div :style="modelObject.measures.length > 1 ? 'margin-left: 40px' : ''">
            <div v-for="(item, index) in measureList" :key="index">
              <el-row
                style="display: flex; flex-direction: column; margin-bottom: 5px"
                class="child"
              >
                <!-- 一级条件样式 -->
                <div class="pointer_spacing" style="display: flex; align-items: center">
                  <div class="eg_letters">
                    {{ getLetterByIndex(index) }}
                  </div>
                  <!-- 增加绝对日期选择 -->
                  <div style="position: relative">
                    <el-cascader
                      v-if="showCascadwe"
                      v-model="item.echoObj.timeScope"
                      :show-all-levels="true"
                      style="width: 250px; z-index: 100"
                      :options="cascaderList"
                      clearable
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
                    :key="generateRandomKey()"
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
                      :key="generateRandomKey()"
                      :ref="(el: unknown) => setSetCascaderRef(el, index)"
                      v-model="item.casList"
                      :teleported="false"
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
                  <!-- 增加备注 -->
                  <div class="customSpace">按</div>
                  <el-select
                    v-model="item.setInterval.divideName"
                    style="width: 130px; margin-left: 0px"
                    @change="handleSelect(item.setInterval)"
                  >
                    <el-option
                      v-for="sub in divideList"
                      :key="sub.name"
                      :label="sub.displayName"
                      :value="sub.name"
                    >
                    </el-option>
                  </el-select>
                  <!-- 增加区间设置 -->
                  <div v-if="item.setInterval.divideName != '离散数值'" class="customSpace">
                    区间设置
                    <el-popover
                      placement="bottom"
                      :offset="30"
                      :width="410"
                      style="background: #fff !important"
                      trigger="click"
                    >
                      <template #reference>
                        <el-icon
                          class="el-icon-s-operation"
                          style="font-size: 16px; cursor: pointer; color: #4d4d4d"
                        >
                          <Operation />
                        </el-icon>
                      </template>

                      <div class="interval_ls">
                        <div class="public-secondHead">区间设置</div>
                        <div style="min-height: 200px; overflow: hidden; margin: 20px 0">
                          <el-table
                            :header-cell-style="{
                              textAlign: 'center',
                              background: '#f7fafe  ',
                            }"
                            width="370px"
                            max-height="300px"
                            :cell-style="{ textAlign: 'center' }"
                            class="public-radius"
                            :data="item.setInterval.devideList"
                            :border="true"
                          >
                            <el-table-column prop="date" label="分层名称" type="index" width="130">
                              <template #default="{ row }">
                                <div>
                                  <el-input v-model="row.name"></el-input>
                                </div>
                              </template>
                            </el-table-column>

                            <el-table-column prop="date" label="区间值(按数据值由大到小)">
                              <template #default="scope">
                                <div
                                  v-if="item.setInterval.divideName == '百分比区间划分'"
                                  style="display: flex; align-items: center"
                                >
                                  <p
                                    v-if="scope.$index == 0"
                                    style="padding: 0 3px; font-size: 12px"
                                  >
                                    [
                                  </p>
                                  <p v-else style="padding: 0 3px; font-size: 12px">(</p>
                                  <div
                                    style="margin-left: 5px; display: flex; align-items: flex-end"
                                  >
                                    <el-input
                                      v-model="scope.row.params[0]"
                                      style="width: 90px"
                                      :disabled="true"
                                      @keyup.up="increaseValue(scope.row)"
                                      @keyup.down="decreaseValue(scope.row)"
                                    >
                                      <template #append>%</template>
                                    </el-input>
                                    <p style="padding: 0 2px">,</p>

                                    <el-input
                                      v-model="scope.row.params[1]"
                                      :disabled="
                                        scope.row.params[1] == 100 &&
                                        scope.$index == item.setInterval.devideList.length - 1
                                      "
                                      style="width: 90px"
                                      @input="inputEvent(scope, item)"
                                      @blur="inputBlurEvent(scope, item)"
                                    >
                                      <template #append>%</template>
                                    </el-input>
                                  </div>
                                  <p style="padding: 0 5px; font-size: 12px">]</p>
                                  <el-icon
                                    v-if="
                                      item.setInterval.devideList.length > 1 && scope.$index != 0
                                    "
                                    class="el-icon-close"
                                    style="margin-right: 5px; cursor: pointer"
                                    @click="deleteInterver(scope, item)"
                                  >
                                    <Close />
                                  </el-icon>
                                </div>
                                <!-- 数值区间 -->
                                <div
                                  v-if="item.setInterval.divideName == '数值区间划分'"
                                  style="display: flex; align-items: center"
                                >
                                  <p
                                    v-if="scope.$index == 0"
                                    style="padding: 0 3px; font-size: 12px"
                                  >
                                    [
                                  </p>
                                  <p v-else style="padding: 0 3px; font-size: 12px">(</p>
                                  <div
                                    style="margin-left: 5px; display: flex; align-items: flex-end"
                                  >
                                    <!-- :disabled="scope.row.params[0] == '最大值'" -->
                                    <el-input
                                      v-model="scope.row.params[0]"
                                      :disabled="true"
                                      style="width: 90px"
                                      @keyup.up="increaseValue(scope.row)"
                                      @keyup.down="decreaseValue(scope.row)"
                                    >
                                    </el-input>
                                    <p style="padding: 0 2px">,</p>
                                    <el-input
                                      v-model="scope.row.params[1]"
                                      :disabled="scope.row.params[1] == '最小值'"
                                      style="width: 90px"
                                      @input="inputEvent(scope, item)"
                                      @blur="inputBlurEvent(scope, item)"
                                    >
                                    </el-input>
                                  </div>
                                  <p style="padding: 0 5px; font-size: 12px">]</p>
                                  <el-icon
                                    v-if="
                                      item.setInterval.devideList.length > 1 && scope.$index != 0
                                    "
                                    class="el-icon-close"
                                    style="margin-right: 5px; cursor: pointer"
                                    @click="deleteInterverNumber(scope, item)"
                                  >
                                    <Close />
                                  </el-icon>
                                </div>
                              </template>
                            </el-table-column>
                          </el-table>
                        </div>
                        <div
                          style="
                            font-size: 14px;
                            color: #2c7be5;
                            cursor: pointer;
                            display: flex;
                            align-items: center;
                            margin-bottom: 20px;
                            width: 70px;
                          "
                          @click="addDevideEvent(item)"
                        >
                          <el-icon class="el-icon-plus"><Plus /></el-icon>增加区间
                        </div>
                      </div>
                    </el-popover>
                  </div>
                  <!-- end -->

                  <el-icon
                    v-if="modelObject.measures.length > 1"
                    class="el-icon-close delete_btn"
                    @click="modelObject.measures.splice(index, 1)"
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
                            :radio-options="radioOptions"
                            :second_item="second_item"
                            :property-list="propertyList"
                            :second_index="second_index"
                            :point-proto-list="pointProtoFilter(item.eventName)"
                          ></treeSelect>
                          <!-- *** end *** -->
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
                                :label="String(x)"
                                :value="x"
                              >
                              </el-option>
                            </el-select>
                          </div>

                          <!-- 封装组件 -->
                          <condition-option :condition="second_item"></condition-option>

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
                          style="display: flex; margin-left: 45px"
                        >
                          <!-- v2 是 <i class="el-icon-plus">添加过滤条件</i>，图标靠字体类；
                               v3 换成 icons-vue 组件，外层类名沿用 el-icon-plus，样式规则不用动 -->
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
                            :radio-options="radioOptions"
                            :second_item="second_item"
                            :property-list="propertyList"
                            :second_index="second_index"
                            :point-proto-list="pointProtoFilter(item.eventName)"
                          ></treeSelect>

                          <el-select
                            v-model="second_item.function"
                            placeholder=""
                            style="width: 140px; margin-left: 15px"
                            @change="checkRelativeTime(second_item)"
                          >
                            <el-option
                              v-for="x in checkJudgmentType(second_item.field, second_item)"
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
                          <condition-option :condition="second_item"></condition-option>
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
        <!-- v2 这里有一个 .circle 新增指标按钮，整段被注释掉，保持注释状态 -->
      </el-row>
    </div>
  </div>
</template>

<style lang="scss">
// 匹配不到样式隐藏
.el-select-dropdown__empty {
  display: none !important;
}
</style>

<style lang="scss" scoped>
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

:deep(.el-input-group__append),
:deep(.el-input-group__prepend) {
  padding: 0 10px;
}

// 天数el-input-number 自定义
:deep(.el-input-number) {
  width: 160px !important;
}

:deep(.customNum) {
  margin-left: 5px;

  .el-input__wrapper {
    height: 36px;
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
  margin: 15px 0px;

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
    // margin-top: 15px;
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
