/**
 * 用户标签（ups / userTag）模块的数据结构。
 *
 * 字段名、层级、可选性全部按 v2 的实际运行结构定义，**没有做任何重构**：
 * v2 的规则对象是各组件就地 mutate 出来的，属性会中途 add / delete
 * （behaviorRules.filterDataType 里 `delete item.field`、`delete item.fieldType`，
 *  deleteFirstCondition 里 `delete filter.relation`），所以这里大量字段是可选的。
 */

import type { CascaderOption } from '@/utils/modelOptions/up-manage'

export type Relation = 'and' | 'or'

/** 属性来源类型（tree-select 的 radio 值） */
export type FieldType = 'event_property' | 'user_property' | 'user_group' | 'user_tag'

/**
 * 注意：下面 PropertyNode / PropertyListMap / RadioOption / ConditionItem 四个刻意用
 * `type`（对象字面量类型别名）而不是 `interface`。
 * 它们要传给 `@/views/ups/components/tree-select.vue`，而那份公共组件的
 * `ConditionItem` 带 `[key: string]: unknown` 索引签名 —— TypeScript 只给类型别名
 * 隐式索引签名，interface 是没有的，写成 interface 会在传参处报
 * "Index signature for type 'string' is missing"。
 */

/** 属性 / 事件 / 分群 / 标签的树节点 */
export type PropertyNode = {
  name: string
  displayName: string
  dataType?: string
  /** 用户标签节点的实际表名（tree-select 选中 user_tag 时取它当 field） */
  tableName?: string
  /**
   * 是否是「标签」节点。标签树里混着标签和分类，接口用这个字段区分，
   * 只有 tag === true 才是可选的标签（分类哪怕没有子节点也不可选）。
   */
  tag?: boolean
  propertyId?: string
  children?: PropertyNode[]
  /** 联级（cascader）用的子级；formateCascader 会就地写入 */
  events?: PropertyNode[]
  /** 事件节点下挂的事件属性 */
  propertyList?: PropertyNode[]
  /** 指标分组名（getGroupedPropertiesApi 返回的分组层） */
  groupName?: string
}

/** 指标联级的分组层（pointProtoList 的元素） */
export type EventGroupNode = PropertyNode

/** 公共属性集合（tree-select 的四个数据源） */
export type PropertyListMap = {
  /** 共用事件属性 */
  commonPropertySum: PropertyNode[]
  /** 共用用户属性 */
  userProperties: PropertyNode[]
  /** 用户分群 */
  userGroupList: PropertyNode[]
  /** 用户标签 */
  userTagList: PropertyNode[]
}

/** 全局（事件 / 用户）原型列表 */
export interface PointTypeList {
  userProtoList: PropertyNode[]
  eventProtoList: PropertyNode[]
}

/** tree-select 顶部的 radio 选项 */
export type RadioOption = {
  label: string
  value: FieldType
}

/**
 * 条件值。v2 往 params 里塞的只有字符串和数字
 * （日期串、正则串、下拉 name、input 的值、timeLimitFunc 的 23、行为规则的初始 [1]）。
 */
export type ConditionParam = string | number

/** 单个过滤条件（用 type 而非 interface 的原因见上方说明） */
export type ConditionItem = {
  field?: string
  dataType?: string
  /** 判断函数：equal / between / isSet / absolute_between ... */
  function?: string
  fieldType?: FieldType | string
  params: ConditionParam[]
  /** 群画像需要用到的展示名（tree-select 在 typePath 存在时写入） */
  displayName?: string
}

/** 一组条件（组内 relation 只在 conditions.length > 1 时出现） */
export interface FilterGroup {
  conditions: ConditionItem[]
  relation?: Relation
}

/** 过滤块（filters.length < 2 时 v2 会 delete relation） */
export interface FilterBlock {
  relation?: Relation
  filters: FilterGroup[]
}

/** 时间选择的回显对象 */
export interface EchoObj {
  /** 上一次的相对时间选择（联级两级路径） */
  lastRelativeTime: string[]
  /** 当前联级选择路径 */
  timeScope: string[]
  /** 上一次的绝对时间选择（联级两级路径） */
  lastAbsoluteTime: string[]
  /** 日期区间控件的值 */
  datePicker: string[]
  /** 自定义相对时间：开始前 N 天 */
  startNum: number | null
  /** 自定义相对时间：结束前 N 天 */
  endNum: number | null
  /**
   * 保存时把当前日历联级选项一并写进模型，编辑回显时再取回来。
   * 只有每种规则的第一个 measure / sequence 上有。
   */
  cascaderList?: CascaderOption[]
}

/** 区间设置里的一行 */
export interface DevideItem {
  name: string
  /** [下限, 上限]，数值区间会出现 "最大值" / "最小值" 这种字符串 */
  params: (string | number | null)[]
}

/** 区间设置 */
export interface SetInterval {
  divideName: string
  devideList: DevideItem[]
}

/** 行为 / 基础指标的一条 measure */
export interface MeasureItem {
  eventName: string
  /** 联级选中的路径（[聚合方式] 或 [属性, 聚合方式]） */
  casList: string[]
  /** 聚合方式（casList 的最后一级） */
  aggregator?: string
  /** 拼出来的展示名：事件名的属性名的聚合名 */
  name: string
  echoObj: EchoObj
  /**
   * 判断函数（行为规则用 intervalList）。
   * 只有「用户行为满足」的 measure 有 function / params，
   * 基础指标值 / 事件偏好 / 首末特征 建出来的 measure 对象里**没有**这两个字段，所以是可选的。
   */
  function?: string
  params?: ConditionParam[]
  /** 开始时间：相对时间串（-1day）或秒级时间戳 */
  earlistTime: string | number
  /** 结束时间：now / 相对时间串 / 秒级时间戳 */
  latestTime: string | number
  filter: FilterBlock
  /** 联级选到二级属性时写入 */
  field?: string
  fieldType?: string
  /** 基础指标 / 首末特征 / 行为分布的区间设置 */
  setInterval?: SetInterval
}

/** 行为序列的一步 */
export interface SequenceStep {
  eventName: string
  /**
   * 展示名。可选是刻意的：sequenceRules.circleAddEvent 建的两步带 name，
   * 而 sequenceCard.circleAddEvent 追加的那一步**不带** name（v2 里那几行是注释掉的），
   * fileterCascader 的 `item.name === item.customName` 分支正好依赖 undefined === undefined。
   */
  name?: string
  customName?: string
  /** 关联属性 */
  relevanceField?: string
  relevanceFieldType?: string
  filter: FilterBlock
  editNameFlag?: boolean | null
}

/** 一条行为序列 */
export interface SequenceItem {
  steps: SequenceStep[]
  earlistTime: string | number
  latestTime: string | number
  echoObj: EchoObj
  /** 是否开启关联属性（v2 未见写入点，仅在模板里读） */
  isOpenRelation?: boolean
}

/** 自定义标签值的一层规则 */
export interface TagRuleSet {
  attribute: FilterBlock
  behavior: {
    relation: Relation
    measures: MeasureItem[]
  }
  sequence: {
    sequences: SequenceItem[]
    relation: Relation
  }
  /** 保存时打的校验标识（保存成功后会被 delete） */
  isValid?: boolean
}

/** 自定义标签值的一层 */
export interface TagRuleLayer {
  rules: TagRuleSet
  relation: Relation
  name: string
  isCollapse?: boolean
}

/** 自定义标签值的整体模型 */
export interface CustomTagModel {
  valueType: string
  ruleList: TagRuleLayer[]
}

/** 其余五种创建方式的整体模型（规则是一组 measures） */
export interface MeasureTagModel {
  valueType: string
  rules: {
    relation?: Relation
    measures: MeasureItem[]
  }
}

/** 标签（列表行 / 详情 / 编辑回显） */
export interface TagFormula {
  id?: string
  name?: string
  displayName?: string
  categoryId?: string | number | null
  description?: string
  /** 创建方式文案：自定义标签值 / 基础指标值 / ... */
  createType?: string
  /** 更新方式：例行 / 手动 */
  updateType?: string
  /** 更新周期：天 / 周 / 月 */
  frequency?: string
  /** 周/月的具体日期，逗号分隔字符串 */
  frequencyValue?: string
  /** 开始计算时间 "00:00" */
  frequencyTime?: string
  /** 规则 JSON 串 */
  formula?: string
  /** 标签值类型 STRING / NUMBER / ... */
  valueType?: string
  tagValue?: string
  /** 当前用户是否是创建者（决定能否编辑） */
  creator?: boolean
  matchUserCount?: number | null
  tableName?: string
  status?: string
  lastExecuteStatus?: string
  lastExecuteStartTime?: number | string
  lastExecuteEndTime?: number | string
  createBy?: string
  createTime?: number | string
  updateTime?: number | string
  /** 列表页 switch 的本地状态 */
  isOpen?: boolean
  /** 列表页 hover 提示的本地状态 */
  showTextVisible?: boolean
}

/** 标签分类树节点 */
export interface CategoryNode {
  id: string
  name: string
  parent?: string
  sort?: number
  remark?: string
  children?: CategoryNode[]
  /** 叶子节点是否是标签本身（getTreeList 返回里带） */
  tag?: boolean
  displayName?: string
  tableName?: string
  valueType?: string
}

/** 表单校验用的「有 isValid 标记的对象」 */
export interface ValidHolder {
  isValid?: boolean
}
