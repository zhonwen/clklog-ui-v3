<script setup lang="ts">
/**
 * 群画像 - 画像信息「用户行为分布」的规则编辑器
 * （对应 v2 `views/ups/userPortrait/components/behaviorRules.vue`）。
 *
 * 注意：本文件与 `components/customTagPage/typeRules/behaviorRules.vue` 是两份不同的组件，
 * 那一份属于「自定义标签规则」，这一份属于「画像信息」，不要互相套用。
 *
 * v2 → v3 主要适配点（逻辑 / 字段 / 文案一律保持一致）：
 *  - 动态字符串 ref（`:ref="'cascader_one' + index"` / `ref="setCascader"` / `ref="datePickerShow"`
 *    / `ref="customPover"` / `ref="customTree"`）→ 函数式 ref 收集到 Map。
 *  - el-popover 的 `showPopper = true` / `doClose()` → `:visible` + `@update:visible` 受控写法。
 *  - el-date-picker 的 `picker-options.shortcuts` → `:shortcuts`（取 `../options` 的 rangeShortcuts）；
 *    `value-format="yyyy-MM-dd"` → `"YYYY-MM-DD"`；实例 `focus()` 同名可用。
 *  - el-cascader 的 `getCheckedNodes()` / `pathLabels` 同名可用；
 *    Element UI 的 `:active-item-change` 在 element-plus 已移除，去掉。
 *  - `this.$set(o, k, v)` → `o[k] = v`；`this.$message` → `ElMessage`。
 *  - v2 里从未被调用的死方法（generateRandomKey / clearVal2 / getClasses / checkTypeArray /
 *    filterJudgmentType / handleVisibleChange / checkpointProtoFrom）以及只服务于它们的
 *    oldProperty / filterBarParams、未被模板使用的 projectName / intervalList / defaultUserType
 *    三个 computed，一并不迁。其中 generateRandomKey 依赖 Vue2 的 `$options.filters`，Vue3 也没有。
 */
import { nextTick, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Close, Plus } from '@element-plus/icons-vue'
import conditionOption from './customTagPage/typeRules/conditionOption.vue'
import treeSelect from '@/views/ups/components/tree-select.vue'
import { NumberType, getOptionsByType, noNumber } from '@/utils/modelOptions/custom'
import type { OptionDef } from '@/utils/modelOptions/custom'
import { defaultUserType, groupValueType, rangeShortcuts } from '../options'
import type {
  BehaviorMeasure,
  CascaderNode,
  ConditionItem,
  EventGroup,
  FilterContainer,
  FilterGroup,
  PortraitInfoItem,
  PropertyListMap,
  PropertyNode,
  RadioOption,
} from '../types'

/** 全部属性（用户 / 事件 / 分群），与 v2 的 pointTypeList 结构一致 */
interface PointTypeList {
  userProtoList: PropertyNode[]
  eventProtoList: PropertyNode[]
  userGroupList: PropertyNode[]
}

/** 画像信息的展示设置（v2 modelObject.behavior.filters，当前 UI 未暴露编辑入口，但要原样提交） */
interface BehaviorFilters {
  type: string
  count: number
  sort: string
  setInterval: { name: string; params: unknown[] }
}

/** v2 的 modelObject.behavior */
interface BehaviorModel {
  relation?: string
  measures: BehaviorMeasure[]
  filters: BehaviorFilters
}

/**
 * 指标联级节点：第一层是聚合方式（总次数 / 分布天数）或事件属性，第二层是属性下的聚合方式。
 * v2 直接往属性对象上挂 `events` 字段，这里保持同样的就地写入。
 */
interface MeasureCascaderNode {
  name?: string
  displayName?: string
  dataType?: string
  events?: OptionDef[]
}

const props = withDefaults(
  defineProps<{
    propertyList?: Partial<PropertyListMap>
    pointProtoList?: EventGroup[]
    pointTypeList?: PointTypeList
    cascaderList?: CascaderNode[]
  }>(),
  {
    propertyList: () => ({
      commonPropertySum: [], // 共用事件属性
      userProperties: [], // 共用用户属性
      userGroupList: [], // 用户分群
    }),
    pointProtoList: () => [],
    pointTypeList: () => ({ userProtoList: [], eventProtoList: [], userGroupList: [] }),
    cascaderList: () => [],
  },
)

const add_btn = ref(true)

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

/**
 * 与 v2 一致：v2 初值是 `""`，只会读它的 `.dataType` / `.name`（在 `""` 上读都是 undefined），
 * 这里用空对象表达同一语义，避免 string 与对象混用。
 */
const default_prototype = ref<PropertyNode>({})

/** v2 的 initSelectObj：只有 `model == "gloab"` 分支会用到，而调用方从不传这个参数 */
const initSelectObj: PropertyNode = {
  dataType: '',
  displayName: '',
  name: '',
  propertyId: '',
}

/** v2 的 pickerOptions.shortcuts（最近一周 / 一个月 / 三个月） */
const pickerShortcuts = rangeShortcuts

const modelObject = ref<{ behavior: BehaviorModel }>({
  behavior: {
    relation: 'and',
    measures: [],
    filters: {
      type: 'bar',
      count: 10,
      // sort: "按纬度值升序",
      sort: 'count_desc',
      setInterval: {
        name: '使用默认区间',
        params: [],
      },
    },
  },
})

/* -------------------------------------------------------------------------- */
/* 模板 ref 收集（v2 的字符串 ref → Vue3 函数式 ref）                            */
/* -------------------------------------------------------------------------- */

/** el-cascader 暴露的 getCheckedNodes */
type CascaderExposed = {
  getCheckedNodes: (leafOnly?: boolean) => { pathLabels: string[] }[] | undefined
}
/** el-date-picker 暴露的 focus */
type FocusablePicker = { focus: () => void }
/** 公共 tree-select 暴露的 refreshTreeList */
type TreeSelectExposed = { refreshTreeList: () => void }

const cascaderOneRefs = new Map<number, CascaderExposed>()
const setCascaderRefs = new Map<number, CascaderExposed>()
const datePickerRefs = new Map<number, FocusablePicker>()
const customTreeRefs = new Map<string, TreeSelectExposed>()

function setCascaderOneRef(index: number, el: unknown) {
  if (el) cascaderOneRefs.set(index, el as CascaderExposed)
  else cascaderOneRefs.delete(index)
}

function setSetCascaderRef(index: number, el: unknown) {
  if (el) setCascaderRefs.set(index, el as CascaderExposed)
  else setCascaderRefs.delete(index)
}

function setDatePickerRef(index: number, el: unknown) {
  if (el) datePickerRefs.set(index, el as FocusablePicker)
  else datePickerRefs.delete(index)
}

function setCustomTreeRef(key: string, el: unknown) {
  if (el) customTreeRefs.set(key, el as TreeSelectExposed)
  else customTreeRefs.delete(key)
}

/**
 * v2 通过 `this.$refs.customPover[index].showPopper = true` / `.doClose()` 直接操作 popover 实例，
 * element-plus 不再暴露这两个内部量，改成受控的 `:visible` + `@update:visible`，
 * 打开 = 置 true（clickCascader 选中「自定义」时），关闭 = 置 false（closePover）。
 */
const poverVisible = ref<Record<number, boolean>>({})

function setPoverVisible(index: number, visible: boolean) {
  poverVisible.value[index] = visible
}

/* -------------------------------------------------------------------------- */
/* 方法                                                                        */
/* -------------------------------------------------------------------------- */

// 联级事件进行过滤出-事件属性
function pointProtoFilter(eventName: string): PropertyNode[] {
  let position: PropertyNode[] = []
  props.pointProtoList.forEach((a) => {
    a.events.forEach((b) => {
      if (b.name == eventName) {
        position = b.propertyList || []
      }
    })
  })
  return position
}

function editPortraitEvent(updateItem?: PortraitInfoItem | '') {
  if (updateItem) {
    add_btn.value = false
    // 画像信息的 formula 在父组件里已经是解析好的对象，这里按 v2 直接整体赋值
    const formula = updateItem.formula as BehaviorModel
    modelObject.value.behavior = formula
  } else {
    add_btn.value = true
    // 与 v2 一致：新增时重建的对象没有 relation 字段
    modelObject.value.behavior = {
      measures: [],
      filters: {
        type: 'bar',
        count: 10,
        sort: 'count_desc',
        setInterval: {
          name: '使用默认区间',
          params: [],
        },
      },
    }
  }
}

function circleAddEvent() {
  props.pointProtoList.forEach((item, index) => {
    item.displayName = item.groupName
    item.name = item.groupName
    item.events.forEach((sub, sub_index) => {
      if (sub_index == 0 && index == 0) {
        eventType.value = sub.name ?? ''
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
      lastAbsoluteTime: [],
      timeScope: ['relative_time', '-1day'],
      datePicker: [], // 日期
      startNum: null,
      endNum: null,
    },
    function: 'equal',
    params: [],
    earlistTime: '-1day',
    latestTime: 'now',
    filter: {
      relation: 'and',
      // measures: [],
      filters: [],
    },
  }
  modelObject.value.behavior.measures.push(object)
  void nextTick(() => {
    const indexNum = modelObject.value.behavior.measures.length - 1
    const current = modelObject.value.behavior.measures[indexNum]
    if (!current) return
    current.eventName = eventType.value
    current.casList = [pointerDefaultOne]
    current.aggregator = pointerDefaultOne
    // 设置name 名称拼接
    pointerDefaultMeasureName.value = props.pointProtoList[0]?.events[0]?.displayName ?? ''
    // +
    // "的" +
    // defaultUserType[0].displayName;
    current.name = pointerDefaultMeasureName.value
  })

  // end
}

function datePickerOptions(item: BehaviorMeasure) {
  const obj: CascaderNode = {
    label: '前' + item.echoObj.startNum + '天' + '到前' + item.echoObj.endNum + '天',
    value:
      `${'-'}${item.echoObj.startNum}${'day'}` + '~' + `${'-'}${item.echoObj.endNum}${'day'}`,
    custom: true,
  }

  const relativeNode = props.cascaderList[1]
  if (relativeNode && relativeNode.children) {
    relativeNode.children.push(obj)
    relativeNode.children = relativeNode.children.filter(
      (object, index, self) => index === self.findIndex((t) => t.label === object.label),
    )
  }

  // 进行赋值
  const newlevel = item.echoObj.timeScope
  newlevel[1] =
    `${'-'}${item.echoObj.startNum}${'day'}` + '~' + `${'-'}${item.echoObj.endNum}${'day'}`
  item.echoObj.timeScope = newlevel
  // 后端字段进行赋值 earlist和latest字段
  item.earlistTime = `${'-'}${item.echoObj.startNum}${'day'}`
  item.latestTime = `${'-'}${item.echoObj.endNum}${'day'}`
  // 缓存相对时间非自定义上次数据
  item.echoObj.lastRelativeTime = newlevel
}

// 日期事件
// 入参放宽成 unknown：element-plus 的 el-date-picker change 回调声明的是 DateModelType 联合类型，
// 这里按 v2 的用法只当成 [开始, 结束] 两个字符串处理
function checkDateEvent(event: unknown, item: BehaviorMeasure) {
  const val = Array.isArray(event) ? (event as string[]) : null
  if (!val) return
  const start = val[0] ?? ''
  const end = val[1] ?? ''
  const obj: CascaderNode = {
    label: start + '~' + end,
    value: start + '~' + end,
  }
  const absoluteNode = props.cascaderList[0]
  if (absoluteNode && absoluteNode.children) {
    absoluteNode.children.push(obj)
    absoluteNode.children = absoluteNode.children.filter(
      (object, index, self) => index === self.findIndex((t) => t.label === object.label),
    )
  }

  // 进行赋值
  const newlevel = item.echoObj.timeScope
  newlevel[1] = start + '~' + end
  item.echoObj.timeScope = newlevel
  // 后端字段进行赋值 earlist和latest字段
  item.earlistTime = Math.floor(new Date(start).getTime() / 1000)
  item.latestTime = Math.floor(new Date(end).getTime() / 1000)
  // 缓存绝对时间 非自定义上次数据
  item.echoObj.lastAbsoluteTime = newlevel
}

// 日历控件关闭后的操作
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
  return null
}

// 入参放宽成 unknown：el-cascader 的 change 回调声明的是 CascaderValue 联合类型，
// 本组件是单选 + emitPath，拿到的一定是路径数组
function clickCascader(event: unknown, index: number, item: BehaviorMeasure) {
  const val = Array.isArray(event) ? (event as string[]) : null
  if (!val) return
  // 自定义事件
  if (val.length > 1) {
    if (val[1] == 'custom') {
      // pover 自定义天数
      setPoverVisible(index, true)
    } else if (val[1] == 'time_scope') {
      // 自定义日期范围
      nextTick(() => datePickerRefs.get(index)?.focus())
    } else {
      // 设置后端字段进行赋值 earlist和latest字段
      const dateTime = splitDateRange(val[1] ?? '')
      if (dateTime) {
        const from = dateTime[0]
        const to = dateTime[1]
        if (from && to && isValidDateStr(from) && isValidDateStr(to)) {
          // 转换为时间戳（秒）
          item.earlistTime = Math.floor(new Date(from).getTime() / 1000)
          item.latestTime = Math.floor(new Date(to).getTime() / 1000)
        }
      } else {
        // 直接选择联级相对时间段
        item.earlistTime = val[1] ?? ''
        item.latestTime = 'now'
      }
    }
  }
}

function closePover(index: number, isTrue?: boolean, item?: BehaviorMeasure) {
  // 相对时间自定义天数   新增类
  if (isTrue && item) {
    item.echoObj.lastAbsoluteTime = []
    // 与 v2 一致（v2 此处逻辑存疑：字段是「前 N 天」，start 必须大于 end 才合法，
    // 但提示文案写的是「开始时间必须早于结束时间」；校验不通过时也不关闭弹层）
    if ((item.echoObj.startNum ?? 0) < (item.echoObj.endNum ?? 0)) {
      ElMessage.error('开始时间必须早于结束时间')
      return
    }
    datePickerOptions(item)
  }
  setPoverVisible(index, false)
}

function handleHide(item: BehaviorMeasure) {
  if (item.echoObj.lastAbsoluteTime.length > 0) {
    item.echoObj.timeScope = item.echoObj.lastAbsoluteTime
  } else {
    item.echoObj.timeScope = item.echoObj.lastRelativeTime
  }
}

// 与 v2 一致：空实现
function handleVisible() {}

function testArray(val: (string | number)[] | undefined) {
  return val
}

function formateCascader(val: string): MeasureCascaderNode[] {
  let options: PropertyNode[] = []
  props.pointProtoList.forEach((a) => {
    a.events.forEach((b) => {
      if (b.name == val) {
        options = b.propertyList || []
      }
    })
  })
  const mergedArray: MeasureCascaderNode[] = [...default_options, ...options]
  mergedArray.forEach((item) => {
    if (item.dataType) {
      switch (item.dataType) {
        case 'STRING':
          item.events = noNumber
          break
        case 'NUMBER':
          // v2 import 的 `Number` 就是这里的 NumberType
          item.events = NumberType
          break
        default:
          item.events = noNumber
          break
      }
    }
  })
  return mergedArray
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

// 判断联级路径是否存在于当前 options（需选到叶子）
function isCasPathValid(options: MeasureCascaderNode[], path: string[] | undefined) {
  if (!Array.isArray(path) || !path.length) return false
  let current: MeasureCascaderNode[] = options || []
  let node: MeasureCascaderNode | undefined
  for (let i = 0; i < path.length; i++) {
    node = current.find((opt) => opt && opt.name === path[i])
    if (!node) return false
    current = node.events || []
  }
  return !node?.events || !node.events.length
}

// 严格检验字段模式
function strictMode(
  val: { name?: string; displayName?: string }[] | '' | undefined,
  label: 'name' | 'displayName',
) {
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

// select 数据过滤
function checkbtnPoint(fieldType: string, eventName: string): PropertyNode[] {
  let position: PropertyNode[] = []
  if (fieldType == 'event_property') {
    props.pointProtoList.forEach((a) => {
      a.events.forEach((b) => {
        if (b.name == eventName) {
          position = b.propertyList || []
        }
      })
    })
    if (fieldType == 'event_property' && position.length > 0) {
      default_prototype.value = position[0] ?? {}
    }
  } else {
    // position = this.userProtoList;
    position = props.pointTypeList.userProtoList
  }
  return position
}

// 切换事件name
function fileterCascader(item: BehaviorMeasure, index: number) {
  // 切换事件后，旧 casList 可能不在新 options 中 → getCheckedNodes 为空会报 pathLabels
  const cascaderOptions = formateCascader(item.eventName)
  if (!isCasPathValid(cascaderOptions, item.casList)) {
    item.casList = [pointerDefaultOne]
    item.aggregator = pointerDefaultOne
  }

  void nextTick(() => {
    const cascaderOneRef = cascaderOneRefs.get(index)
    const setCascaderRef = setCascaderRefs.get(index)
    if (!cascaderOneRef || !setCascaderRef) {
      return
    }
    const cascader_one = cascaderOneRef.getCheckedNodes() || []
    const nodesInfo = setCascaderRef.getCheckedNodes() || []
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
    const options: PropertyNode = filtered.length > 0 ? (filtered[0] ?? {}) : {}
    const measures = item.filter.filters
    measures.forEach((measureItem) => {
      measureItem.conditions.forEach((subItem) => {
        if (subItem.fieldType == 'event_property') {
          subItem.field = options.name
        }
      })
    })
    // 更新组件中的源数据-回显操作
    customTreeRefs.forEach((treeItem) => {
      treeItem.refreshTreeList()
    })
    // *** end ***
  })
}

function filterDataType(item: BehaviorMeasure, index: number) {
  const cascaderOneRef = cascaderOneRefs.get(index)
  const setCascaderRef = setCascaderRefs.get(index)
  if (!cascaderOneRef || !setCascaderRef) {
    return
  }
  const cascader_one = cascaderOneRef.getCheckedNodes() || []
  const nodesInfo = setCascaderRef.getCheckedNodes() || []
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
    item.aggregator = item.casList[1] ?? ''
    // item.field = item.casList[0];
    // item.fieldType = "event_property";
  } else {
    item.aggregator = item.casList[0] ?? ''
    // delete item.field;
    // delete item.fieldType;
  }
}

// 相对时间发生时间
function checkRelativeTime(condition: ConditionItem) {
  if (condition.function == 'relative_event_time') {
    if (!condition.params) condition.params = []
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

function filterIstrue(item: string | undefined) {
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
function firstLevelEvent(secondLevel: FilterContainer, eventName: string) {
  // 与 v2 一致（v2 此处直接取下标，属性列表为空时会抛错；这里用可选链兜底，取值结果相同）
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
        function: strictMode(filterCommonType(default_prototype.value.dataType), 'name'),
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
  let field = '',
    dataType = ''
  if (model == 'gloab') {
    field = initSelectObj.name ?? ''
    dataType = initSelectObj.dataType ?? ''
  } else {
    field = default_prototype.value.name || ''
    dataType = default_prototype.value.dataType || ''
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
      // 与 v2 一致（v2 此处逻辑存疑：`$set(item.conditions, "params", [])` 是往数组对象上
      // 挂了一个名为 params 的普通属性，既不参与渲染也不会被提交，迁移时省略）
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
  let field = '',
    dataType = ''
  if (model == 'gloab') {
    field = initSelectObj.name ?? ''
    dataType = initSelectObj.dataType ?? ''
  } else {
    field = default_prototype.value.name || ''
    dataType = default_prototype.value.dataType || ''
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
      // v2 用 `$set(item.conditions, item.conditions.length, threeObj)` 往末尾塞，等价于 push
      item.conditions.push(threeObj)
    }
  })
}

function threeDeleteEvent(secondP_index: number, second_index: number, three_list: FilterGroup[]) {
  three_list[secondP_index]?.conditions.splice(second_index, 1)
}

/**
 * params 需要按下标双向绑定，而项目开了 noUncheckedIndexedAccess，
 * 模板里 `v-model="second_item.params[0]"` 拿到的是 `string | number | undefined`，
 * 所以统一改成 `:model-value` + `@update:model-value`，写回的仍是同一个 params 数组。
 */
function setParamAt(condition: ConditionItem, index: number, value: string | number) {
  if (!condition.params) condition.params = []
  condition.params[index] = value
}

defineExpose({ editPortraitEvent, modelObject })
</script>

<template>
  <div class="box-card">
    <div>
      <el-row>
        <div style="display: flex">
          <div
            :style="
              modelObject.behavior.measures && modelObject.behavior.measures.length > 1
                ? { marginLeft: '0px' }
                : {}
            "
          >
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
                  <div class="customSpace" style="padding-left: 0">画像人群在</div>
                  <!-- 增加绝对日期选择 -->
                  <div style="position: relative">
                    <!-- Element UI 的 :active-item-change 在 element-plus 已移除，去掉 -->
                    <el-cascader
                      v-if="showCascadwe"
                      v-model="item.echoObj.timeScope"
                      :show-all-levels="true"
                      style="width: 250px; z-index: 100"
                      :options="cascaderList"
                      clearable
                      filterable
                      @change="clickCascader($event, index, item)"
                      @visible-change="handleVisible"
                    />
                    <div
                      style="position: absolute; top: 3px; height: 30px; opacity: 0; pointer-events: none"
                    >
                      <el-date-picker
                        :ref="(el: unknown) => setDatePickerRef(index, el)"
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
                    <!--
                      popver 自定义逻辑
                      v2：`$refs.customPover[index].showPopper = true` 打开、`.doClose()` 关闭。
                      element-plus 不再暴露这两个内部量，改成 `:visible` + `@update:visible` 受控。
                      受控模式下 trigger 不再生效（这个 reference 本来就被 z-index:100 的联级挡住、
                      从来不会被用户点到），trigger="click" 只为与 v2 写法对齐而保留。
                    -->
                    <div style="position: absolute; top: 3px; height: 30px">
                      <el-popover
                        placement="bottom"
                        title="相对时间/时间范围"
                        :width="300"
                        style="background: #fff !important"
                        trigger="click"
                        :visible="poverVisible[index] === true"
                        @update:visible="setPoverVisible(index, $event)"
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
                              aria-label="请输入天数"
                            />
                          </div>
                          <div class="pover_inner" style="margin: 15px 0">
                            结束时间: 前
                            <el-input-number
                              v-model="item.echoObj.endNum"
                              class="customNum"
                              :min="1"
                              :max="365"
                              aria-label="请输入天数"
                            />
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
                  <div class="customSpace">完成</div>
                  <!-- end -->

                  <el-cascader
                    :key="'cascader_one-' + index"
                    :ref="(el: unknown) => setCascaderOneRef(index, el)"
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
                      :ref="(el: unknown) => setSetCascaderRef(index, el)"
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
                    />
                  </div>

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
                              (el) =>
                                setCustomTreeRef(
                                  index + '-' + secondP_index + '-' + second_index + '-multi',
                                  el,
                                )
                            "
                            :cloleAppendBody="true"
                            :radioOptions="radioOptions"
                            :second_item="second_item"
                            :propertyList="propertyList"
                            :second_index="second_index"
                            :pointProtoList="pointProtoFilter(item.eventName)"
                          />
                          <!-- @refreshTreeList="refreshTreeList" -->
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
                                :model-value="second_item.params?.[0] ?? ''"
                                @update:model-value="setParamAt(second_item, 0, $event)"
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
                                placeholder=""
                              >
                                <el-option
                                  v-for="(x, x_index) in testArray(second_item.params)"
                                  :key="x_index"
                                  :label="String(x)"
                                  :value="x"
                                />
                              </el-select>
                            </div>
                          </div>

                          <!-- 封装组件 -->
                          <condition-option :condition="second_item" />

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
                              (el) =>
                                setCustomTreeRef(
                                  index + '-' + secondP_index + '-' + second_index + '-single',
                                  el,
                                )
                            "
                            :cloleAppendBody="true"
                            :radioOptions="radioOptions"
                            :second_item="second_item"
                            :propertyList="propertyList"
                            :second_index="second_index"
                            :pointProtoList="pointProtoFilter(item.eventName)"
                          />

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
                              <div @click="handelJudge(second_item)">
                                {{ x.displayName }}
                              </div>
                            </el-option>
                          </el-select>

                          <!-- 区间 正则 匹配规则 -->
                          <condition-option :condition="second_item" />
                          <!-- 根据NUMBER类型展示文本 -->
                          <div v-if="filterIstrue(second_item.function)">
                            <div v-if="second_item.dataType == 'NUMBER'">
                              <el-input
                                type="number"
                                class="input_number_width"
                                style="margin-left: 15px"
                                :model-value="second_item.params?.[0] ?? ''"
                                @update:model-value="setParamAt(second_item, 0, $event)"
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
                                placeholder=""
                              >
                                <el-option
                                  v-for="x in second_item.params"
                                  :key="x"
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

        <div
          v-if="add_btn"
          :style="modelObject.behavior.measures.length > 1 ? { marginLeft: '0px' } : {}"
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

// v2 的 `::v-deep { ... }` 整块，这里逐条拆成 :deep(...)。
// 其中带 --medium / __inner 的是 Element UI 2 的类名，element-plus 已不再输出，
// 但样式数值按要求与 v2 保持一致，原样保留。

// 天数el-input-number 自定义
:deep(.el-input-number--medium) {
  width: 160px !important;
}

:deep(.customNum) {
  margin-left: 5px;

  .el-input--medium .el-input__inner {
    height: 36px;
  }
}

:deep(.el-button--medium) {
  height: 30px;
}

//日期
:deep(.el-range-editor--medium.el-input__inner) {
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

// }
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
  // 指标间距
  //margin: 15px 15px;

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
    margin-top: 10px;
    margin-left: 21px;
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
