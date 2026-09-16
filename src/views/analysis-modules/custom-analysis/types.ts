/**
 * 自定义分析模块的数据结构。
 * 字段名、层级、可选性全部按 v2 的实际用法还原，不做任何重构。
 */

/**
 * 属性归属，运行时只会是 'event_property' / 'user_property'。
 * 这些字段直接绑在 el-radio-group 的 v-model 上，而 el-radio-group 的
 * update:modelValue 类型是 string | number | boolean | undefined，字段类型必须能接住它。
 */
export type FieldType = string | number | boolean | undefined

/** 且 / 或，运行时只会是 'and' / 'or'；同样要接住 el-radio-group 的回填类型 */
export type Relation = string | number | boolean | undefined

/** 一条筛选条件 */
export type ConditionItem = {
  /** v2 在 initSelectObj 为空时会写进 undefined，这里如实保留可选 */
  field?: string
  dataType?: string
  /** 判断方式，如 equal / contains / between / absolute_between ... */
  function?: string
  fieldType?: FieldType
  /** 值。多选输入是 string[]，区间/时间类是按下标写入的定长数组 */
  params: (string | number)[]
}

/** 一个筛选分组（组内多条件之间用 relation 连接） */
export type FilterGroup = {
  relation?: Relation
  conditions: ConditionItem[]
}

/** 筛选模型（多个分组之间用 relation 连接） */
export type FilterModel = {
  relation?: Relation
  filters: FilterGroup[]
}

/** 一个事件指标 */
export type MeasureItem = {
  eventName: string
  /** 联级选择器的路径：[聚合方式] 或 [属性名, 聚合方式] */
  casList: string[]
  aggregator?: string
  /** 系统自动生成的指标名 */
  defaultMeasureName: string
  /** 展示用指标名，用户可改 */
  name: string
  id?: string
  type: string
  field?: string
  fieldType?: FieldType
  /** 指标名是否处于编辑态（v2 用 $set 挂上去的临时字段） */
  editNameFlag?: boolean | null
  filter: FilterModel
}

/**
 * 一个查看维度。
 * name / dataType / field 都是可选：v2 在 initSelectObj 被清空（属性列表为空）时
 * 推进来的就是三个 undefined，这里如实反映。
 */
export type ByFieldItem = {
  name?: string
  dataType?: string
  field?: string
  fieldType?: FieldType
}

/** 查询模型，整体会被 JSON.stringify 后塞进路由 query 与书签 queryParams */
export type ModelObject = {
  byFields: ByFieldItem[]
  filter: FilterModel
  measures: MeasureItem[]
  startDate: string
  endDate: string
  dataType: string
  projectName: string
  timeFlag?: string
}

/** 属性（事件属性 / 用户属性 / 通用属性） */
export type PropertyItem = {
  name: string
  displayName: string
  dataType?: string
  propertyId?: string
}

/** 指标联级选择器的节点（第一层是聚合方式或属性，第二层是属性下的聚合方式） */
export type CascaderNode = {
  name: string
  displayName: string
  dataType?: string
  events?: CascaderNode[]
}

/** 事件 */
export type EventItem = {
  name: string
  displayName: string
  propertyList: PropertyItem[]
}

/** 事件分组（mergeCommonPropertiesToEvents 会把 groupName 复制到 displayName / name） */
export type EventGroup = {
  name: string
  displayName: string
  groupName?: string
  events: EventItem[]
}

/** getGroupedProperties 的返回体 */
export type GroupedPropertiesData = {
  events: EventGroup[]
  commonProperties: PropertyItem[]
}

/** getCommonPropertyList 的返回体 */
export type CommonPropertyData = {
  commonProperties: PropertyItem[]
  commonPresetProperties: PropertyItem[]
  userProperties: PropertyItem[]
}

/** 分析结果的一行 */
export type ResultRow = {
  /** 维度取值 */
  byValues: string[]
  /** 各时间点各指标的值，values[时间点下标][指标下标] */
  values: (number | string)[][]
  /** 指标名列表，前端补上 */
  pointList: string[]
  /** 维度的 dataType 列表，前端补上（维度没有 dataType 时会是 undefined） */
  byFields: (string | undefined)[]
  /** 时间点列表，customTable 里挂到每一行上 */
  series?: string[]
}

/** 分析结果 */
export type ResultDetail = {
  rows: ResultRow[]
  /** 时间点 */
  series: string[]
  rollupResult?: unknown
}

/** customAnalysis 接口 data */
export type CustomAnalysisData = {
  resultDetail: ResultDetail
  rollupResult?: unknown
}

/** 书签对象（路由 query.tagObj 里存的就是它的 JSON） */
export type BookmarkTag = {
  bookmarkId: string
  name: string
  remark?: string
  timeSection?: string
  queryParams?: string
}

/** customBar 往外抛的筛选条参数 */
export type CustomFilterBarParams = {
  startTime: string
  endTime: string
  timeFlag: string
  timeType: string
  groupName: string
  name?: string
  projectName?: string
}
