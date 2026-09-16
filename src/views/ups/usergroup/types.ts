/**
 * 用户分群（ups/usergroup）的数据结构。
 *
 * 字段名、层级、可选性全部按 v2 `src/views/ups/usergroup/**` 的实际用法还原，
 * 不做任何重构：后端接口 formula 就是 `ruleList` 的 JSON 字符串，字段一动就对不上。
 *
 * 注意：v2 里 usergroup / userTag / userPortrait 各有一份 customTagPage 副本，
 * 这里只以 usergroup 这一份为准。
 */

/** 属性归属（tree-select 顶部的类型单选） */
export type GroupFieldType = 'event_property' | 'user_property' | 'user_group' | 'user_tag'

/** tree-select 顶部的类型单选项 */
export interface RadioOption {
  label: string
  value: string
}

/** 判断方式 / 聚合方式选项（{ displayName, name }） */
export interface OptionDef {
  displayName: string
  name: string
}

/** label/value 形式的下拉选项 */
export interface LabelValue<T = string> {
  label: string
  value: T
}

/**
 * 属性 / 事件 / 分群 / 标签的通用节点。
 * v2 把事件分组、事件、属性、标签树全塞在同一套结构里互相赋值，这里合成一个可选字段的节点，
 * 不拆成多个互不兼容的接口（拆开反而要到处断言）。
 */
export interface PropertyNode {
  name?: string
  displayName?: string
  dataType?: string
  tableName?: string
  propertyId?: string
  /** 事件分组名（getGroupedProperties 返回的 groupName，mergeCommonPropertiesToEvents 会复制到 name/displayName） */
  groupName?: string
  /** 标签分类树的子节点 */
  children?: PropertyNode[]
  /** el-cascader 的下一级（事件分组 → 事件；属性 → 聚合方式） */
  events?: PropertyNode[]
  /** 事件下挂的属性列表 */
  propertyList?: PropertyNode[]
}

/** tree-select 的四类数据源 */
export interface PropertyListMap {
  /** 共用事件属性 */
  commonPropertySum: PropertyNode[]
  /** 共用用户属性 */
  userProperties: PropertyNode[]
  /** 用户分群 */
  userGroupList: PropertyNode[]
  /** 用户标签 */
  userTagList: PropertyNode[]
}

/** 日历级联（绝对时间 / 相对时间） */
export interface CascaderNode {
  value: string
  label: string
  children?: CascaderNode[]
  /** 相对时间里「自定义」生成的项 */
  custom?: boolean
}

/**
 * 一条筛选条件，也就是 tree-select 的 `second_item`。
 *
 * 刻意写成 type 而不是 interface：`views/ups/components/types.ts` 里的 ConditionItem
 * 带 `[key: string]: unknown` 索引签名，interface 不会有隐式索引签名，传给 tree-select
 * 的 second_item 会报 "Index signature for type 'string' is missing"。
 */
export type ConditionItem = {
  field?: string
  dataType?: string
  fieldType?: string
  /** 判断方式：equal / between / isSet / absolute_between ... */
  function?: string
  /** 值。多选输入是 string[]，区间/时间类是按下标写入的定长数组 */
  params: (string | number)[]
  displayName?: string
}

/** 一个筛选分组（组内多条件之间用 relation 连接） */
export interface FilterGroup {
  relation?: string
  conditions: ConditionItem[]
}

/** 筛选模型 */
export interface FilterModel {
  relation?: string
  filters: FilterGroup[]
}

/** 行为 / 序列卡片上的时间回显对象 */
export interface EchoObj {
  lastRelativeTime: string[]
  timeScope: string[]
  lastAbsoluteTime: string[]
  /** 日期区间选择器的值 */
  datePicker: string[]
  startNum: number | null
  endNum: number | null
  /** 保存时把当前的日历级联选项一并写进模型，编辑回显时再取出来 */
  cascaderList?: CascaderNode[]
}

/** 行为规则的一条指标 */
export interface BehaviorMeasure {
  eventName: string
  casList: string[]
  aggregator?: string
  name: string
  echoObj: EchoObj
  function: string
  params: (string | number)[]
  earlistTime: string | number
  latestTime: string | number
  field?: string
  fieldType?: string
  filter: FilterModel
}

/** 行为序列里的一个步骤 */
export interface SequenceStep {
  eventName: string
  /** 与 v2 一致：sequenceCard 新增 step 时不写 name（保持 undefined），sequenceRules 新增序列时才写 */
  name?: string
  customName?: string
  /** 关联属性 */
  relevanceField?: string
  relevanceFieldType?: string
  filter: FilterModel
  /** v2 的 editCustomName 会 $set 上去（当前模板没有用到，保留字段） */
  editNameFlag?: boolean | null
  defaultMeasureName?: string
  casList?: string[]
  aggregator?: string
  field?: string
  fieldType?: string
}

/** 行为序列的一条序列 */
export interface SequenceItem {
  steps: SequenceStep[]
  earlistTime: string | number
  latestTime: string | number
  echoObj: EchoObj
  /** 是否展示「关联属性」（v2 从未写过它，模板里读） */
  isOpenRelation?: boolean
}

/** 一层分群规则 */
export interface RuleSet {
  attribute: FilterModel
  behavior: {
    relation: string
    measures: BehaviorMeasure[]
  }
  sequence: {
    sequences: SequenceItem[]
    relation: string
  }
  /** 保存时打开的红框校验开关 */
  isValid?: boolean
}

/** ruleList 的一项（v2 只用到一层，新建分层的入口被注释掉了） */
export interface RuleListItem {
  rules: RuleSet
  relation: string
  /** v2 初始值就是布尔 true（分层名称输入框被注释掉了） */
  name: boolean | string
  isCollapse?: boolean
}

/** customTagPage 维护的整个模型 */
export interface TagModelList {
  /** 模型类型 */
  valueType: string
  ruleList: RuleListItem[]
}

/** 人数限制设置（手动更新时使用，接口里是 JSON 字符串） */
export interface ReturnUserLimitSetting {
  source_type: string
  sort_profile: string
  sort_asc: string
  limit: string | number
}

/** 基础信息表单 */
export interface GroupRuleForm {
  displayName: string
  description: string
  name: string
  updateType: string
  frequency: string
  frequencyValue: number[]
  frequencyTime: string
  returnUserLimitSetting: ReturnUserLimitSetting
  /** 保存时校验「是否需要估算」：undefined 未校验 / true 已估算 / 'empty' 估算为空 / 'edit' 模型改了要重估 */
  isEstimate?: boolean | string
}

/** 分群列表 / 详情的一行 */
export interface GroupRow {
  id?: string
  name?: string
  displayName?: string
  description?: string
  status?: string
  /** 列表里的开关绑定值（由 status 推导） */
  isOpen?: boolean
  /** hover 时显示「启用 / 暂停」文案 */
  showTextVisible?: boolean
  createType?: string
  updateType?: string
  frequency?: string
  frequencyValue?: string
  frequencyTime?: string
  matchUserCount?: number
  lastExecuteStatus?: string
  lastExecuteStartTime?: number | string
  lastExecuteEndTime?: number | string
  createBy?: string
  createTime?: number | string
  updateTime?: number | string
  /** 是否本人创建（决定能否编辑） */
  creator?: boolean
  tableName?: string
  /** ruleList 的 JSON 字符串 */
  formula?: string
  returnUserLimitSetting?: string
  valueType?: string
  tagValue?: string
  categoryId?: string
  projectName?: string
  type?: string
}

/** 分群下的用户列表一行 */
export interface GroupUserRow {
  userId?: string
  loginId?: string
  baseTime?: number | string
}

/** 分群人数分布的一项 */
export interface DistributeItem {
  name: string
  value: number | string
  count?: number
}

/** 分群历史按天统计的一行（day + 若干动态字段） */
export type HistoryDayRow = Record<string, string | number> & { day?: string }

/**
 * 「新建 / 编辑分群」跳转事件的负载。
 *
 * bus 只能传一个参数，v2 的三个参数合并成一个对象。
 * 原负载：$bus.$emit('$createMethod', val, formula, fromPage)
 *   - 参数1 val：下标（分群类型，1 = 自定义规则，2 = 导入创建）
 *   - 参数2 formula：模型（编辑时传当前行，新建时传空串）
 *   - 参数3 fromPage：传 'creator' 表示从创建页切换创建方式
 */
export interface CreateMethodPayload {
  createIndex: number | string
  formula?: GroupRow | ''
  fromPage?: string
}

/** 历史详情表格里的一行 */
export interface HistoryCheckRow {
  name: string
  num: number | string | undefined
  rate: number | string
}
