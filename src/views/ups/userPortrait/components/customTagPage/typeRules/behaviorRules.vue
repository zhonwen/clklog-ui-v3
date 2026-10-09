<script setup lang="ts">
/**
 * 群画像 - 「用户行为满足」规则
 * （对应 v2 `views/ups/userPortrait/components/customTagPage/typeRules/behaviorRules.vue`）。
 *
 * 注意：`customTagPage/` 在 v2 里 userPortrait / userTag / usergroup 各有一份独立副本，
 * 这一份严格以 userPortrait 的为准。
 *
 * 与 v2 一致：本组件直接就地修改父级传进来的 modelObject / pointProtoList / cascaderList
 * （v2 用的是 props + this.$set），这是该模块固有的数据流，迁移时原样保留。
 *
 * v2 → v3 的 API 对照见文件内各处注释，主要有：
 *   this.$refs.customPover[i].showPopper = true / .doClose()
 *        → el-popover 受控写法 :visible + @update:visible（setPoverVisible(i, true/false)）
 *   el-popover 的 @hide → @before-leave（element-plus 2.x 只有 before/after-enter|leave，没有 hide/show）
 *   el-input-number 的 label="…" → aria-label="…"（element-plus 2.x 已移除 label prop）
 *   this.$refs['cascader_one'+i][0].getCheckedNodes()
 *        → 函数式 ref 收集到 Map，再调 element-plus 同名的 getCheckedNodes()
 *   this.$refs.datePickerShow[i].focus()
 *        → 函数式 ref 收集到 Map，再调 el-date-picker 的 focus()
 *   :picker-options="pickerOptions" → :shortcuts="rangeShortcuts"
 *   value-format="yyyy-MM-dd"       → value-format="YYYY-MM-DD"
 *
 * v2 里这几个方法是彻底的死代码（模板与其它方法都没有引用），迁移时未保留：
 *   generateRandomKey（依赖 Vue2 的 this.$options.filters，Vue3 已无过滤器）、
 *   getClasses、clearVal2、filterJudgmentType、handleVisibleChange、checkpointProtoFrom，
 *   以及只被上面两个方法用到的 oldProperty，和只有 computed 没被模板用到的 projectName。
 */
import { computed, nextTick, ref } from 'vue'
import { Close, Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { CascaderOption, CascaderProps, CascaderValue } from 'element-plus'
import conditionOption from './conditionOption.vue'
import treeSelect from '@/views/ups/components/tree-select.vue'
import { getOptionsByType, noNumber } from '@/utils/modelOptions/custom'
import type { OptionDef } from '@/utils/modelOptions/custom'
import {
  NumberType,
  defaultUserType,
  groupValueType,
  intervalList,
  rangeShortcuts,
} from '../../../options'
import { computedStyle as computedStyleRaw } from '../../../types'
import type {
  BehaviorMeasure,
  CascaderNode,
  ConditionItem,
  EventGroup,
  FilterContainer,
  FilterGroup,
  PortraitRules,
  PropertyListMap,
  PropertyNode,
  RadioOption,
} from '../../../types'

defineOptions({ name: 'behaviorRules' })

const props = withDefaults(
  defineProps<{
    pointProtoList?: EventGroup[]
    propertyList?: Partial<PropertyListMap>
    /** v2 是 `type: Object` 不带默认值，实际调用方（tagRules.vue）必传，这里收紧成必填省掉满屏判空 */
    modelObject: PortraitRules
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

/** 指标联级第二层的节点：默认聚合方式（OptionDef）与事件属性（PropertyNode）合并后的形状 */
interface MeasureCascaderNode {
  name?: string
  displayName?: string
  dataType?: string
  events?: OptionDef[]
}

const radioOptions: RadioOption[] = [
  { label: '事件属性', value: 'event_property' },
  { label: '用户属性', value: 'user_property' },
  { label: '用户分群', value: 'user_group' },
  { label: '用户标签', value: 'user_tag' },
]
const showCascadwe = ref(true)
const eventType = ref('')
const default_options = defaultUserType
const pointerDefaultOne = defaultUserType[0]?.name ?? ''
const pointerDefaultMeasureName = ref('')
/** v2 初值是 ""，v3 用 null 表达同一个「还没取到默认属性」的状态 */
const default_prototype = ref<PropertyNode | null>(null)
const initSelectObj = {
  dataType: '',
  displayName: '',
  name: '',
  propertyId: '',
}

// ===== 模板 ref 收集（v2 的字符串 $refs → 函数式 ref + Map）=====
/** el-cascader 暴露的 getCheckedNodes，节点上带 pathLabels */
type CascaderExposed = {
  getCheckedNodes: (leafOnly?: boolean) => { pathLabels: string[] }[] | undefined
}
/** el-date-picker 暴露的 focus */
type FocusablePicker = { focus: () => void }

/** v2: this.$refs['cascader_one' + index][0] */
const cascaderOneRefs = new Map<number, CascaderExposed>()
/** v2: this.$refs.setCascader[index] */
const setCascaderRefs = new Map<number, CascaderExposed>()
/** v2: this.$refs.datePickerShow[index] */
const datePickerRefs = new Map<number, FocusablePicker>()
/** v2: this.$refs.customTree（一个跨多层 v-for 的数组），v3 按「层级下标」拼 key 存 Map */
const treeSelectRefs = new Map<string, InstanceType<typeof treeSelect>>()

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

function setTreeRef(key: string, el: unknown) {
  if (el) treeSelectRefs.set(key, el as InstanceType<typeof treeSelect>)
  else treeSelectRefs.delete(key)
}

// ===== el-popover 受控可见（v2 的 showPopper / doClose）=====
const poverVisible = ref<Record<number, boolean>>({})

/** v2: this.$refs.customPover[index] 的 showPopper 读取 */
function isPoverVisible(index: number) {
  return poverVisible.value[index] === true
}

/**
 * v2: `this.$refs.customPover[index].showPopper = true` → setPoverVisible(index, true)
 *     `this.$refs.customPover[index].doClose()`        → setPoverVisible(index, false)
 * element-plus 的 el-popover 不再暴露 showPopper / doClose，改用 v-model:visible 受控。
 */
function setPoverVisible(index: number, visible: boolean) {
  poverVisible.value[index] = visible
}

// ===== 联级选项 =====
// el-cascader 的 options 形参是 CascaderOption[]（带索引签名），下面几个只做类型转换、
// 不复制对象，选项数组的引用保持稳定
const protoOptions = computed(() => props.pointProtoList as unknown as CascaderOption[])
const timeCascaderOptions = computed(() => props.cascaderList as unknown as CascaderOption[])

/** v2 内联在模板上的 :props，提出来避免每次渲染新建对象 */
const cascaderOneProps: CascaderProps = {
  value: 'name',
  label: 'displayName',
  children: 'events',
  multiple: false,
  emitPath: false,
}
const cascaderTwoProps: CascaderProps = {
  value: 'name',
  label: 'displayName',
  children: 'events',
  multiple: false,
}

/** v2 的 pickerOptions.shortcuts（最近一周 / 一个月 / 三个月），已抽到 options.ts */
const pickerShortcuts = rangeShortcuts

/**
 * v2 的 formateCascader：每次渲染都重新遍历 pointProtoList 拼一次数组。
 * v3 按事件名缓存成 Map（只在 pointProtoList 变化时重算），
 * 合并出的节点对象仍是 propertyList 里的原对象（v2 也是就地写 item.events），行为一致。
 */
const cascaderOptionsMap = computed(() => {
  const map = new Map<string, MeasureCascaderNode[]>()
  props.pointProtoList.forEach((a) => {
    a.events.forEach((b) => {
      if (!b.name) return
      const mergedArray: MeasureCascaderNode[] = [...default_options, ...(b.propertyList || [])]
      mergedArray.forEach((item) => {
        if (item.dataType) {
          switch (item.dataType) {
            case 'STRING':
              item.events = noNumber
              break
            case 'NUMBER':
              // v2 import 的 `Number` 就是这里的 NumberType（v2 的导出名遮蔽了全局构造器）
              item.events = NumberType
              break
            default:
              item.events = noNumber
              break
          }
        }
      })
      map.set(b.name, mergedArray)
    })
  })
  return map
})

/** 事件名匹配不上时，与 v2 一致地只返回默认聚合方式 */
const defaultCascaderOptions: MeasureCascaderNode[] = [...default_options]

function formateCascader(val: string): MeasureCascaderNode[] {
  return cascaderOptionsMap.value.get(val) ?? defaultCascaderOptions
}

function casOptions(val: string) {
  return formateCascader(val) as unknown as CascaderOption[]
}

/**
 * 联级事件进行过滤出-事件属性。
 * v2 是每次渲染遍历一遍，v3 同样按事件名缓存；返回的仍是 propertyList 的原数组引用。
 */
const pointProtoFilterMap = computed(() => {
  const map = new Map<string, PropertyNode[]>()
  props.pointProtoList.forEach((a) => {
    a.events.forEach((b) => {
      if (!b.name) return
      map.set(b.name, b.propertyList || [])
    })
  })
  return map
})

function pointProtoFilter(eventName: string): PropertyNode[] {
  return pointProtoFilterMap.value.get(eventName) ?? []
}

// ===== 工具 =====
/**
 * el-cascader 回传的是 CascaderValue（可能是单值也可能是路径数组），
 * v2 的 @change 直接拿到数组 / 单值，这里统一收敛成 v2 用到的形状。
 */
function toStrArray(val: CascaderValue): string[] {
  if (Array.isArray(val)) return val.flat().map((v) => String(v))
  return val === null || val === undefined ? [] : [String(val)]
}

function toStr(val: CascaderValue): string {
  if (Array.isArray(val)) return String(val.flat()[0] ?? '')
  return val === null || val === undefined ? '' : String(val)
}

/**
 * noUncheckedIndexedAccess 下 params[i] 不能直接 v-model（读出来是 T | undefined），
 * 统一走这两个小工具，读写的仍是同一个 params 数组，行为与 v2 一致。
 */
function paramValue(params: (string | number)[] | undefined, index: number): string | number {
  return params?.[index] ?? ''
}

function setParam(
  target: { params?: (string | number)[] },
  index: number,
  val: string | number,
): void {
  if (!target.params) target.params = []
  target.params[index] = val
}

/** el-input-number 的 modelValue 是 number | undefined，echoObj 里存的是 number | null */
function setEchoNum(item: BehaviorMeasure, key: 'startNum' | 'endNum', val: number | undefined) {
  item.echoObj[key] = val ?? null
}

// 设置校验样式。模板里是在 v-for 里按 item 取值，没法提成固定的 computed，保留函数调用
function computedStyle(value: unknown) {
  return computedStyleRaw(value, props.modelObject)
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
      // 步骤一
      timeScope: ['relative_time', '-1day'],
      lastAbsoluteTime: [],
      datePicker: [], // 日期
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
    // 与 v2 一致（v2 直接 this.pointProtoList[0].events[0].displayName 取值，
    //  pointProtoList 为空时会抛错；v3 为过类型检查兜底成空串）
    pointerDefaultMeasureName.value =
      (props.pointProtoList[0]?.events[0]?.displayName ?? '') +
      '的' +
      (defaultUserType[0]?.displayName ?? '')
    target.name = pointerDefaultMeasureName.value
  })

  // end
}

function datePickerOptions(item: BehaviorMeasure) {
  // 与 v2 的字符串拼接完全等价，这里用模板字符串是为了让 startNum/endNum 的 null 能参与拼接
  const obj: CascaderNode = {
    label: `前${item.echoObj.startNum}天到前${item.echoObj.endNum}天`,
    // value: item.echoObj.startNum + "-" + item.echoObj.endNum,
    value: `-${item.echoObj.startNum}day~-${item.echoObj.endNum}day`,
    custom: true,
  }

  // 方式一 覆盖上次自定义数据
  // this.cascaderList[2].children = this.cascaderList[2].children.filter(
  //   (obj) => !obj.custom || obj.custom !== true
  // );
  // this.cascaderList[2].children.push(obj);
  // 方式二   去重
  const relativeNode = props.cascaderList[1]
  if (relativeNode) {
    if (!relativeNode.children) relativeNode.children = []
    relativeNode.children.push(obj)
    relativeNode.children = relativeNode.children.filter(
      (object, index, self) => index === self.findIndex((t) => t.label === object.label),
    )
  }

  // 进行赋值
  const newlevel = item.echoObj.timeScope
  // newlevel[1] = item.echoObj.startNum + "-" + item.echoObj.endNum;
  // 步骤二
  newlevel[1] = `-${item.echoObj.startNum}day~-${item.echoObj.endNum}day`
  item.echoObj.timeScope = newlevel

  // 后端字段进行赋值 earlist和latest字段
  item.earlistTime = `-${item.echoObj.startNum}day`
  item.latestTime = `-${item.echoObj.endNum}day`

  // 缓存相对时间非自定义上次数据
  item.echoObj.lastRelativeTime = newlevel
}

// 日期事件
function checkDateEvent(val: unknown, item: BehaviorMeasure) {
  // v2 直接取 val[0] / val[1]；element-plus 清空时会给 null，这里兜一层再按 v2 逻辑走
  const range = Array.isArray(val) ? (val as unknown[]).map((v) => String(v)) : []
  const start = range[0] ?? ''
  const end = range[1] ?? ''
  const obj: CascaderNode = {
    label: start + '~' + end,
    value: start + '~' + end,
  }
  const absoluteNode = props.cascaderList[0]
  if (absoluteNode) {
    if (!absoluteNode.children) absoluteNode.children = []
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
  // item.earlistTime = val[1];
  // item.latestTime = val[0];
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
  return null // 如果没有 '~'，返回 null 或其他你想返回的值
}

function clickCascader(val: CascaderValue, index: number, item: BehaviorMeasure) {
  const path = toStrArray(val)
  // 自定义事件
  if (path.length > 1) {
    if (path[1] == 'custom') {
      // pover 自定义天数（v2: this.$refs.customPover[index].showPopper = true）
      setPoverVisible(index, true)
    } else if (path[1] == 'time_scope') {
      // 自定义日期范围（v2: this.$refs.datePickerShow[index].focus()）
      // 拿不到实例就跳过，不抛错
      datePickerRefs.get(index)?.focus()
    } else {
      const dateTime = splitDateRange(path[1] ?? '')
      if (dateTime) {
        if (
          dateTime[0] &&
          dateTime[1] &&
          isValidDateStr(dateTime[0]) &&
          isValidDateStr(dateTime[1])
        ) {
          // v2 这里还有一句 console.log("符合规则")，迁移时去掉
          // 转换为时间戳（秒）
          item.earlistTime = Math.floor(new Date(dateTime[0]).getTime() / 1000)
          item.latestTime = Math.floor(new Date(dateTime[1]).getTime() / 1000)
        }
      } else {
        // 直接选择联级相对时间段
        item.earlistTime = path[1] ?? ''
        item.latestTime = 'now'
      }
    }
  }
}

function closePover(index: number, isTrue?: boolean, item?: BehaviorMeasure) {
  // 相对时间自定义天数   新增类
  if (isTrue && item) {
    item.echoObj.lastAbsoluteTime = []
    // 与 v2 一致（v2 此处逻辑存疑：判断的是「开始天数 < 结束天数」才报错，
    //  但这里两个数都是「前 N 天」，N 越大时间越早，正确的判断应当反过来）
    if ((item.echoObj.startNum ?? 0) < (item.echoObj.endNum ?? 0)) {
      ElMessage.error('开始时间必须早于结束时间')
      return
    }
    datePickerOptions(item)
  }
  // v2: this.$refs.customPover[index].doClose()
  setPoverVisible(index, false)
}

function handleHide(item: BehaviorMeasure) {
  if (item.echoObj.lastAbsoluteTime.length > 0) {
    item.echoObj.timeScope = item.echoObj.lastAbsoluteTime
  } else {
    item.echoObj.timeScope = item.echoObj.lastRelativeTime
  }
}

/** v2 是 handleVisible(event, item) 的空实现，模板上绑了它，这里保留占位 */
function handleVisible() {}

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

// 判断联级路径是否存在于当前 options（需选到叶子）
function isCasPathValid(options: MeasureCascaderNode[], path: string[]) {
  if (!Array.isArray(path) || !path.length) return false
  let current: MeasureCascaderNode[] = options || []
  let node: MeasureCascaderNode | undefined = undefined
  for (let i = 0; i < path.length; i++) {
    node = current.find((opt) => opt && opt.name === path[i])
    if (!node) return false
    current = node.events || []
  }
  return !node || !node.events || !node.events.length
}

// 切换事件name
function fileterCascader(item: BehaviorMeasure, index: number) {
  // 切换事件后，旧 casList 可能不在新 options 中 → getCheckedNodes 为空会报 pathLabels
  const cascaderOptions = formateCascader(item.eventName)
  if (!isCasPathValid(cascaderOptions, item.casList)) {
    item.casList = [pointerDefaultOne]
    item.aggregator = pointerDefaultOne
    delete item.field
    delete item.fieldType
  }

  void nextTick(() => {
    // v2: this.$refs["cascader_one" + index][0] / this.$refs["setCascader"][index]
    const cascader_one = cascaderOneRefs.get(index)?.getCheckedNodes(false)
    const nodesInfo = setCascaderRefs.get(index)?.getCheckedNodes(false)
    if (!cascader_one || !cascader_one[0] || !nodesInfo || !nodesInfo[0]) {
      return
    }
    const labelOne = cascader_one[0].pathLabels || []
    const pathLabels = nodesInfo[0].pathLabels || []
    if (!labelOne[1]) {
      return
    }
    if (pathLabels.length > 1) {
      item.name = (
        labelOne[1] +
        '的' +
        (pathLabels[0] ?? '') +
        '的' +
        (pathLabels[1] ?? '')
      ).trim()
    } else {
      item.name = (labelOne[1] + '的' + (pathLabels[0] ?? '')).trim()
    }

    // *** 切换cascader更改默认值 ***
    const options = pointProtoFilter(item.eventName)[0]
    const measures = item.filter.filters
    measures.forEach((measureItem) => {
      measureItem.conditions.forEach((subItem) => {
        if (subItem.fieldType == 'event_property') {
          // 与 v2 一致（v2 此处逻辑存疑：没有事件属性时 options 是 []，options.name 取到 undefined，
          //  会把 field 清成 undefined）
          subItem.field = options ? options.name : undefined
        }
      })
    })
    // 更新组件中的源数据-回显操作
    treeSelectRefs.forEach((treeItem) => {
      treeItem.refreshTreeList()
    })
    // *** end ***
  })
}

function filterDataType(item: BehaviorMeasure, index: number) {
  const cascader_one = cascaderOneRefs.get(index)?.getCheckedNodes(false)
  const nodesInfo = setCascaderRefs.get(index)?.getCheckedNodes(false)
  if (!cascader_one || !cascader_one[0] || !nodesInfo || !nodesInfo[0]) {
    return
  }
  const labelOne = cascader_one[0].pathLabels || []
  const pathLabels = nodesInfo[0].pathLabels || []
  // 与 v2 一致（v2 这里没有像 fileterCascader 那样先判空 labelOne[1]，
  //  取不到时 v2 会拼出 "undefined的xxx"；v3 为过类型检查兜底成空串）
  const eventLabel = labelOne[1] ?? ''
  if (pathLabels.length > 1) {
    item.name = (eventLabel + '的' + (pathLabels[0] ?? '') + '的' + (pathLabels[1] ?? '')).trim()
  } else {
    item.name = (eventLabel + '的' + (pathLabels[0] ?? '')).trim()
  }
  if (item.casList.length > 1) {
    item.aggregator = item.casList[1] ?? ''
    item.field = item.casList[0]
    item.fieldType = 'event_property'
  } else {
    item.aggregator = item.casList[0] ?? ''
    delete item.field
    delete item.fieldType
  }
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
      default_prototype.value = position[0] ?? null
    }
  } else if (fieldType == 'user_group') {
    position = props.propertyList.userGroupList || []
  } else {
    position = props.propertyList.userProperties || []
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

/**
 * 与 v2 一致（v2 此处逻辑存疑：splice 的第二个参数是「删除个数」，
 *  这里传进来的 index 被当成了删除个数用；模板上固定传 1，所以表现上仍是删一条）。
 */
function deleteFirstCondition(filter: FilterContainer, secondP_index: number, index: number) {
  filter.filters.splice(secondP_index, index)
  if (filter.filters.length < 2) {
    delete filter.relation
  }
}

// 增加默认值  一级事件
function firstLevelEvent(secondLevel: FilterContainer, eventName: string) {
  // 与 v2 一致（v2 直接 [0].dataType，没有事件属性时会抛错；v3 用可选链兜底）
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
        function: strictMode(filterCommonType(default_prototype.value?.dataType), 'name'),
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
    props.pointProtoList.forEach((a) => {
      a.events.forEach((b) => {
        if (b.name == eventName) {
          position = b.propertyList || []
        }
      })
    })
    if (position.length > 0) {
      default_prototype.value = position[0] ?? null
    }
  }
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
  refreshDefault()
  if (model == 'gloab') {
    field = initSelectObj.name
    dataType = initSelectObj.dataType
  } else {
    field = default_prototype.value?.name || ''
    dataType = default_prototype.value?.dataType || ''
  }
  const addObj: ConditionItem = {
    field: field,
    dataType: dataType,
    function: strictMode(filterCommonType(dataType), 'name'),
    fieldType: 'event_property',
    params: [],
  }
  // second_list.measures.map((item, index) => {
  second_list.filters.forEach((item: FilterGroup, index: number) => {
    if (secondP_index == index) {
      item.relation = 'and'
      item.conditions.push(addObj)
      // 与 v2 一致（v2 此处还有一句 this.$set(item.conditions, "params", [])，
      //  是往数组对象上挂了个名为 params 的非下标属性，没有任何作用，迁移时去掉）
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
  refreshDefault()
  if (model == 'gloab') {
    field = initSelectObj.name
    dataType = initSelectObj.dataType
  } else {
    field = default_prototype.value?.name || ''
    dataType = default_prototype.value?.dataType || ''
  }
  three_list.filters.forEach((item: FilterGroup, index: number) => {
    if (index == secondP_index) {
      const threeObj: ConditionItem = {
        field: field,
        // fieldFlag: field,
        dataType: dataType,
        function: strictMode(filterCommonType(dataType), 'name'),
        fieldType: 'event_property',
        params: [],
      }
      // v2: this.$set(item.conditions, item.conditions.length, threeObj)，等价于 push
      item.conditions.push(threeObj)
    }
  })
}

function threeDeleteEvent(secondP_index: number, second_index: number, three_list: FilterGroup[]) {
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

// 本组件被 tagRules.vue 以 ref="behaviorRules" 引用，但 v2 里从未调用它的方法
defineExpose({})
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
                class="child"
                style="display: flex; flex-direction: column; margin-bottom: 5px"
              >
                <!-- 一级条件样式 -->
                <div class="pointer_spacing" style="display: flex; align-items: center">
                  <div class="eg_letters">
                    {{ getLetterByIndex(index) }}
                  </div>
                  <!-- 绝对时间/相对时间 --》选择 -->
                  <!-- {{ item.echoObj.timeScope }} -->
                  <div style="position: relative">
                    <!-- v2 还有个 :active-item-change="true"，element-plus 的 el-cascader 已无该属性，去掉 -->
                    <el-cascader
                      v-if="showCascadwe"
                      :model-value="item.echoObj.timeScope"
                      :show-all-levels="true"
                      style="width: 250px; z-index: 100"
                      :options="timeCascaderOptions"
                      filterable
                      @update:model-value="item.echoObj.timeScope = toStrArray($event)"
                      @visible-change="handleVisible"
                      @change="clickCascader($event, index, item)"
                    />
                    <div style="position: absolute; top: 3px; height: 30px">
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
                    <!-- popver 自定义逻辑 -->
                    <div style="position: absolute; top: 3px; height: 30px">
                      <!--
                        v2 是非受控 el-popover + this.$refs.customPover[index].showPopper / doClose()；
                        element-plus 改成受控：:visible + @update:visible
                      -->
                      <el-popover
                        :visible="isPoverVisible(index)"
                        placement="bottom"
                        title="相对时间/时间范围"
                        width="300"
                        style="background: #fff !important"
                        trigger="click"
                        @update:visible="(v: boolean) => setPoverVisible(index, v)"
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
                              class="customNum"
                              :model-value="item.echoObj.startNum"
                              :min="1"
                              :max="365"
                              aria-label="请输入天数"
                              @update:model-value="setEchoNum(item, 'startNum', $event)"
                            />
                          </div>
                          <div class="pover_inner" style="margin: 15px 0">
                            结束时间: 前
                            <el-input-number
                              class="customNum"
                              :model-value="item.echoObj.endNum"
                              :min="1"
                              :max="365"
                              aria-label="请输入天数"
                              @update:model-value="setEchoNum(item, 'endNum', $event)"
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
                  <div class="customSpace">做过</div>
                  <!-- end -->

                  <el-cascader
                    :key="'cascader_one-' + index"
                    :ref="(el: unknown) => setCascaderOneRef(index, el)"
                    :model-value="item.eventName"
                    :options="protoOptions"
                    :show-all-levels="false"
                    style="font-size: 13px"
                    class="custom_cascader"
                    filterable
                    :props="cascaderOneProps"
                    @update:model-value="item.eventName = toStr($event)"
                    @change="fileterCascader(item, index)"
                  />
                  <div class="default_font customSpace">的</div>
                  <div style="position: relative">
                    <el-cascader
                      :key="'setCascader-' + index + '-' + item.eventName"
                      :ref="(el: unknown) => setSetCascaderRef(index, el)"
                      :model-value="item.casList"
                      :options="casOptions(item.eventName)"
                      :props="cascaderTwoProps"
                      separator="的"
                      style="font-size: 13px"
                      filterable
                      class="cascader_border"
                      @update:model-value="item.casList = toStrArray($event)"
                      @change="filterDataType(item, index)"
                    />
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
                    />
                  </el-select>
                  <!-- 校验次数 / 条数 -->
                  <div v-if="item.function == 'between'" style="white-space: nowrap">
                    <el-input
                      :model-value="paramValue(item.params, 0)"
                      type="number"
                      :min="1"
                      class="input_number_width"
                      style="margin-left: 15px"
                      :style="computedStyle(item.params[0])"
                      @update:model-value="setParam(item, 0, $event)"
                    />
                    <span class="tipSpan">到</span>
                    <el-input
                      :model-value="paramValue(item.params, 1)"
                      type="number"
                      :min="1"
                      class="input_number_width"
                      :style="computedStyle(item.params[1])"
                      @update:model-value="setParam(item, 1, $event)"
                    />
                  </div>
                  <el-input
                    v-else
                    :model-value="paramValue(item.params, 0)"
                    type="number"
                    :min="1"
                    class="input_number_width"
                    style="margin-left: 15px"
                    :style="computedStyle(item.params[0])"
                    placeholder=""
                    @update:model-value="setParam(item, 0, $event)"
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

                          <treeSelect
                            :ref="
                              (el: unknown) =>
                                setTreeRef(index + '-' + secondP_index + '-' + second_index, el)
                            "
                            :radio-options="radioOptions"
                            :second_item="second_item"
                            :property-list="propertyList"
                            :second_index="second_index"
                            :point-proto-list="pointProtoFilter(item.eventName)"
                            :clole-append-body="true"
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
                          <!-- 根据NUMBER类型展示文本 -->
                          <div v-if="filterIstrue(second_item.function)">
                            <div v-if="second_item.dataType == 'NUMBER'">
                              <el-input
                                :model-value="paramValue(second_item.params, 0)"
                                type="number"
                                class="input_number_width"
                                style="margin-left: 15px"
                                :style="computedStyle(second_item.params)"
                                @update:model-value="setParam(second_item, 0, $event)"
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
                                  :label="String(x)"
                                  :value="x"
                                />
                              </el-select>
                            </div>
                          </div>
                          <!-- <div v-if="filterIstrue(second_item.function)">
                            <el-select style="
                                margin-left: 10px;
                                min-height: 30px;
                                min-width: 350px;
                              " :class="'second_select' + second_index" v-model="second_item.params" multiple
                              filterable allow-create default-first-option :style="computedStyle(second_item.params)">
                              <el-option v-for="(x, x_index) in testArray(
                                second_item.params
                              )" :key="x_index" :label="x" :value="x">

                              </el-option>
                            </el-select>
                          </div> -->

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
                                setTreeRef(index + '-' + secondP_index + '-' + second_index, el)
                            "
                            :radio-options="radioOptions"
                            :second_item="second_item"
                            :property-list="propertyList"
                            :second_index="second_index"
                            :point-proto-list="pointProtoFilter(item.eventName)"
                            :clole-append-body="true"
                            @change="handelJudge(second_item)"
                          />
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
                          <conditionOption :condition="second_item" :model-object="modelObject" />
                          <!-- <div v-if="filterIstrue(second_item.function)">
                            <el-select style="margin-left: 15px; min-width: 350px" v-model="second_item.params" multiple
                              filterable allow-create default-first-option :style="computedStyle(second_item.params)">
                              <el-option v-for="x in second_item.params" :key="x"
                                :label="typeof x === 'object' ? x.displayName || x.name || JSON.stringify(x) : x"
                                :value="x">
                                {{ typeof x === 'object' ? x.displayName || x.name || JSON.stringify(x) : x }}
                              </el-option>
                            </el-select>
                          </div> -->
                          <!-- 根据NUMBER类型展示文本 -->
                          <div v-if="filterIstrue(second_item.function)">
                            <div v-if="second_item.dataType == 'NUMBER'">
                              <el-input
                                :model-value="paramValue(second_item.params, 0)"
                                type="number"
                                class="input_number_width"
                                style="margin-left: 15px"
                                :style="computedStyle(second_item.params)"
                                @update:model-value="setParam(second_item, 0, $event)"
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
          class="circle add_icon pointer_spacing"
          :style="modelObject.behavior.measures.length > 1 ? 'margin-left: 40px' : ''"
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

// v2 是 ::v-deep { ... } 包一层，v3 逐条 :deep()
// 天数el-input-number 自定义
:deep(.el-input-number--medium) {
  width: 160px !important;
}

:deep(.customNum) {
  margin-left: 5px;
}

:deep(.customNum .el-input--medium .el-input__inner) {
  height: 36px;
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
