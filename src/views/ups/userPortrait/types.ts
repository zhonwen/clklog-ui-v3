import type { CSSProperties } from 'vue'
import type { ConditionItem, PropertyNode } from '@/views/ups/components/types'

/**
 * 用户群画像（ups/userPortrait）的数据结构。
 *
 * 字段名、层级、可选性全部按 v2 `views/ups/userPortrait/**` 的实际用法还原，
 * 不做任何重构：规则模型会被 JSON.stringify 后原样发给后端，改字段名等于改接口。
 *
 * ConditionItem / PropertyNode / PropertyListMap / RadioOption 复用
 * `@/views/ups/components/types`，保证传给公共 tree-select 的结构一致。
 */

export type {
  ConditionItem,
  PropertyListMap,
  PropertyNode,
  RadioOption,
  UpsFieldType,
} from '@/views/ups/components/types'

/** 一个筛选分组（组内多条件之间用 relation 连接） */
export interface FilterGroup {
  relation?: string
  conditions: ConditionItem[]
}

/** 行为 / 序列的筛选容器 */
export interface FilterContainer {
  relation?: string
  filters: FilterGroup[]
}

/**
 * 时间选择的回显对象。
 * v2 把联级选择器的展示值（timeScope）和接口值（earlistTime/latestTime）分开存，
 * echoObj 只用于回显，会被一起 JSON 序列化提交。
 */
export interface EchoObj {
  /** 上一次的相对时间联级值 */
  lastRelativeTime: string[]
  /** 当前联级展示值，形如 ['relative_time', '-1day'] */
  timeScope: string[]
  /** 上一次的绝对时间联级值 */
  lastAbsoluteTime: string[]
  /** 日期选择器绑定值 */
  datePicker: string[]
  /** 自定义「前 N 天到前 M 天」的起止 */
  startNum: number | null
  endNum: number | null
  /** 只有 measures[0] / sequences[0] 上会挂，用于把自定义联级项一起存库 */
  cascaderList?: CascaderNode[]
}

/** 日历联级选项 */
export interface CascaderNode {
  value: string
  label: string
  /** 自定义项标记（v2 用它做去重时的标识） */
  custom?: boolean
  children?: CascaderNode[]
}

/** 用户行为的一条指标 */
export interface BehaviorMeasure {
  eventName: string
  /** 指标联级选中路径 */
  casList: string[]
  aggregator: string
  name: string
  echoObj: EchoObj
  function: string
  params: (string | number)[]
  earlistTime: string | number
  latestTime: string | number
  filter: FilterContainer
  /** casList 选到二级（事件属性）时才有 */
  field?: string
  fieldType?: string
  [key: string]: unknown
}

/** 行为序列里的一步 */
export interface SequenceStep {
  eventName: string
  /** sequenceCard 里 push 的步骤不带 name，sequenceRules 里带（与 v2 两处写法一致），故可选 */
  name?: string
  filter: FilterContainer
  [key: string]: unknown
}

/** 一条行为序列 */
export interface SequenceItem {
  steps: SequenceStep[]
  earlistTime: string | number
  latestTime: string | number
  echoObj: EchoObj
  [key: string]: unknown
}

/** 一层画像规则的规则体 */
export interface PortraitRules {
  attribute: { relation?: string; filters: FilterGroup[] }
  behavior: { relation: string; measures: BehaviorMeasure[] }
  sequence: { relation: string; sequences: SequenceItem[] }
  /** 点保存时置 true，computedStyle 靠它给空值加红框 */
  isValid?: boolean
}

/** tagModelList.ruleList 的一项：一个「画像人群」 */
export interface PortraitRuleItem {
  rules: PortraitRules
  relation: string
  name: string
  isCollapse?: boolean
  /** 索引签名：图表组件把「对比人群」当成松散对象读（displayName / name 等），保证可互相赋值 */
  [key: string]: unknown
}

/** 群画像列表行 */
export interface PortraitRow {
  id?: string
  name?: string
  displayName?: string
  description?: string
  projectName?: string
  updateType?: string
  frequency?: string
  frequencyValue?: string
  frequencyTime?: string
  createType?: string
  formula?: string
  status?: string
  creator?: boolean
  createBy?: string
  createTime?: number | string
  updateTime?: number | string
  lastExecuteStartTime?: number | string
  lastExecuteEndTime?: number | string
  isOpen?: boolean
  [key: string]: unknown
}

/**
 * localStorage 里缓存的「当前群画像详情」（v2 的 gropPortraitInfo，拼写沿用 v2）。
 * formula 在存进 localStorage 之前已经被 JSON.parse 成数组。
 */
export interface GropPortraitInfo {
  id?: string
  displayName?: string
  formula: PortraitRuleItem[]
  [key: string]: unknown
}

/** 画像信息（画像分析页左侧的「画像项」） */
export interface PortraitInfoItem {
  id?: string
  name?: string
  displayName?: string
  groupPortraitId?: string
  projectName?: string
  formula?: unknown
  lastExecuteEndTime?: number | string
  [key: string]: unknown
}

/**
 * 校验样式（对应 v2 src/utils/index.js 的 computedStyle）。
 * v2 返回的就是对象，这里原样保留；未命中时返回 undefined，绑到 :style 上等同于不加样式。
 */
export function computedStyle(
  value: unknown,
  valid?: { isValid?: boolean } | null,
): CSSProperties | undefined {
  const isValid = valid ? valid.isValid : ''
  if (Array.isArray(value) && isValid) {
    if (value.length == 0) {
      return { border: '1px solid red', borderRadius: '4px' }
    }
  } else {
    if (!value && isValid) {
      return { border: '1px solid red', borderRadius: '4px' }
    }
  }
  return undefined
}

/**
 * 校验规则：返回该判断方式需要几个参数（对应 v2 src/utils/index.js 的 verificaRules）。
 * 0 = 不需要参数，1 = 一个，2 = 两个。
 */
export function verificaRules(type?: string | null): number {
  if (!type) return 1
  if (
    type == 'isTrue' ||
    type == 'isFalse' ||
    type == 'isSet' ||
    type == 'notSet' ||
    type == 'isEmpty' ||
    type == 'isNotEmpty'
  ) {
    return 0
  } else if (
    type == 'between' ||
    type == 'queal' ||
    type == 'notQueal' ||
    type == 'absolute_between' ||
    type == 'extract_between' ||
    type == 'relative_within' ||
    type == 'relative_between' ||
    type == 'relative_event_time'
  ) {
    return 2
  } else {
    return 1
  }
}

/**
 * 判断参数是否是空值（对应 v2 src/utils/index.js 的 isEmptyParams）。
 * 与 v2 一致（v2 此处逻辑存疑：非空时不 return，函数返回 undefined 而不是 false，
 * 调用方都是 `if (isEmptyParams(x))`，所以行为等价）。
 */
export function isEmptyParams(params: unknown): boolean | undefined {
  if (
    params == '' ||
    params == null ||
    params == undefined ||
    (params as { length?: number }).length == 0
  ) {
    return true
  }
  return undefined
}

/** handleTree 的节点：至少能按 id / parentId 取值，children 是写回去的 */
export interface TreeSourceNode {
  [key: string]: unknown
}

/**
 * 扁平数组 → el-tree 数据（对应 v2 src/utils/index.js 的 handleTree）。
 * 逻辑逐行照搬，包括「childrenListMap[o[id]] !== null 恒为 true」这种写法。
 */
export function handleTree<T extends TreeSourceNode>(
  data: T[],
  id?: string,
  parentId?: string,
  children?: string,
): T[] {
  const config = {
    id: id || 'id',
    parentId: parentId || 'parentId',
    childrenList: children || 'children',
  }

  const childrenListMap: Record<string, T[]> = {}
  const nodeIds: Record<string, T> = {}
  const tree: T[] = []

  for (const d of data) {
    const pid = String(d[config.parentId])
    if (childrenListMap[pid] == null) {
      childrenListMap[pid] = []
    }
    nodeIds[String(d[config.id])] = d
    childrenListMap[pid]?.push(d)
  }

  for (const d of data) {
    const pid = String(d[config.parentId])
    if (nodeIds[pid] == null) {
      tree.push(d)
    }
  }

  function adaptToChildrenList(o: T) {
    const list = childrenListMap[String(o[config.id])]
    if (list !== undefined) {
      ;(o as TreeSourceNode)[config.childrenList] = list
    }
    const kids = o[config.childrenList] as T[] | undefined
    if (kids) {
      for (const c of kids) {
        adaptToChildrenList(c)
      }
    }
  }

  for (const t of tree) {
    adaptToChildrenList(t)
  }
  return tree
}

/** 周 / 月的可选项（对应 v2 src/utils/index.js 的 weekOrMonthRangeList） */
export function weekOrMonthRangeList(val?: string): { value: number; label: string }[] {
  const dateRangeList: { value: number; label: string }[] = []
  if (val === '周') {
    const daysOfWeek = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    daysOfWeek.forEach((day, index) => {
      dateRangeList.push({ value: index + 1, label: day })
    })
  } else if (val === '月') {
    // 与 v2 一致：固定 31 天，不按当月实际天数算
    const daysInMonth = 31
    for (let day = 1; day <= daysInMonth; day++) {
      dateRangeList.push({ value: day, label: day.toString() + '号' })
    }
  }
  return dateRangeList
}

/** 事件分组（pointProtoList 的一项） */
export interface EventGroup {
  groupName?: string
  displayName?: string
  name?: string
  events: EventNode[]
  [key: string]: unknown
}

/** 单个事件 */
export interface EventNode {
  name?: string
  displayName?: string
  propertyList?: PropertyNode[]
  [key: string]: unknown
}
