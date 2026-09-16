/**
 * analysis-model 共享组件（fields / funnelStep / globalFilter / conditionOption）的数据结构。
 *
 * 字段名、层级、可选性全部按 v2 的实际用法还原，不做任何重构。
 * v2 这些组件的 props 全是裸 Object / Array，这里只是把它们在 v3 里补上类型，
 * 运行时的结构与 v2 一字不差。
 */

/** 属性归属：事件属性 / 用户属性 */
export type FieldType = 'event_property' | 'user_property'

/** 且 / 或 */
export type Relation = 'and' | 'or'

/**
 * 一条筛选条件。
 * 步骤内筛选（funnelStep）与全局筛选（globalFilter）共用同一个结构，
 * 后者多了 propertyName / fieldFlag 两个字段（v2 就是这么混用的）。
 */
export interface ConditionItem {
  field: string
  dataType?: string
  /** 判断方式，如 equal / contains / between / absolute_between ... */
  function?: string
  fieldType?: FieldType
  /** 值。多选输入是 string[]，区间 / 时间类是按下标写入的定长数组 */
  params: (string | number)[]
  /** 全局筛选专用：属性所属的事件名，或 'user_property' */
  propertyName?: string
  /** 全局筛选专用：下拉框的回显值 */
  fieldFlag?: string
}

/** 一个筛选分组（组内多条件之间用 relation 连接） */
export interface FilterGroup {
  relation?: Relation
  conditions: ConditionItem[]
}

/** 筛选模型（多个分组之间用 relation 连接） */
export interface FilterModel {
  relation?: Relation
  filters: FilterGroup[]
}

/** 指标联级选择器的节点 */
export interface CascaderNode {
  name: string
  displayName: string
  dataType?: string
  events?: CascaderNode[]
}

/** 属性（事件属性 / 用户属性 / 通用属性） */
export interface PropertyItem {
  name: string
  displayName: string
  dataType?: string
  propertyId?: string
  /** formateCascader 会就地给带 dataType 的属性挂上聚合方式作为子节点 */
  events?: CascaderNode[]
}

/** 事件 */
export interface EventItem {
  name: string
  displayName: string
  propertyList: PropertyItem[]
}

/** 事件分组（mergeCommonPropertiesToEvents 会把 groupName 复制到 displayName / name） */
export interface EventGroup {
  name: string
  displayName: string
  groupName?: string
  events: EventItem[]
}

/** 通用属性 / 用户属性（fields、globalFilter 的 propertyList prop） */
export interface PropertyListMap {
  /** 共用事件属性 */
  commonPropertySum: PropertyItem[]
  /** 共用用户属性 */
  userProperties: PropertyItem[]
}

/** 指标属性（funnelStep 的 pointTypeList prop） */
export interface PointTypeList {
  /** 指标用户属性 */
  userProtoList: PropertyItem[]
  /** 指标事件属性 */
  eventProtoList: PropertyItem[]
}

/** 一个查看维度（fields.vue 维护的 modelObject.byFields 元素） */
export interface ByFieldItem {
  /** 所属事件名，或 'user_property' */
  propertyName: string
  /** 提交给后端的字段：事件属性是 `${propertyName}.${name}`，用户属性就是 name */
  field: string
  /** 下拉框的回显值 */
  fieldFlag: string
  dataType: string
  fieldType: FieldType
  /** 展示名（checkDimensioFrom 里写入 x.displayName） */
  name?: string
}

/**
 * fields / globalFilter 的 fieldTypeList prop。
 * 漏斗页传进来的就是当前漏斗的 steps，只用到 eventName / customName 两个字段。
 */
export interface FieldTypeItem {
  eventName: string
  customName: string
}

/** 一个漏斗步骤（funnelStep.vue 维护的 modelObject.steps 元素） */
export interface AnalysisStep {
  eventName: string
  customName: string
  name?: string
  type: string
  filter: FilterModel
  /** 关联属性 */
  relevanceField?: string
  /** 关联属性类型 */
  relevanceFieldType?: string
  /** 名称是否处于编辑态（v2 用 $set 挂上去的临时字段） */
  editNameFlag?: boolean | null
}

/** fields.vue 的 modelObject prop：只关心 byFields */
export interface ByFieldsHolder {
  byFields: ByFieldItem[]
}

/** globalFilter.vue 的 modelObject prop：只关心 filter */
export interface GlobalFilterHolder {
  filter: FilterModel
}

/** funnelStep.vue 的 modelObject prop：只关心 steps 与 isOpenRelation */
export interface StepsHolder {
  steps: AnalysisStep[]
  /** 是否开启关联属性 */
  isOpenRelation?: boolean
}
