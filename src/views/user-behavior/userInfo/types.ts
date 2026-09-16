import type { EventGroup, GroupedPropertiesData, PropertyItem } from '@/views/analysis-modules/custom-analysis/types'

export type { EventGroup, PropertyItem }

/**
 * getGroupedProperties 的返回体。
 * 用户细查的「事件详情」要从 commonPresetProperties 里找属性显示名，
 * 而 custom-analysis 的 GroupedPropertiesData 没有这个字段，这里补上。
 */
export interface SeqEventMeta extends GroupedPropertiesData {
  commonPresetProperties?: PropertyItem[]
}

/**
 * 日期区间。
 * 与 v2 一致：「最新」模式下 seq-filters 把它置成空字符串 ""（不是 null 也不是 []），
 * 调用方一律 `rangeTime ? rangeTime[0] : ""`，靠 "" 的 falsy 落到空串。
 */
export type SeqRange = string[] | string | null

/** seq-filters 的 v-model 值 */
export interface SeqFilterValue {
  dateMode?: string
  rangeTime?: SeqRange
  events?: string[]
  keyWord?: string
  timeFlag?: string
}

/** seq-filters 通过 set-filter-bar-params 抛给父组件的参数（v2 的 commonParams） */
export interface SeqFilterParams {
  rangeTime: SeqRange
  events: string[]
  projectName: string | null
  /** 只有 showKeyWord 时才带（与 v2 的 defaultParams 一致） */
  keyWord?: string
  /** v2 的 filterParams 里会读 userId，接口并没有回填过，保留占位 */
  userId?: string | null
}

/* ------------------------------ 行为轨迹 ------------------------------ */

/** 接口返回的原始事件 */
export interface RawSeqEvent {
  logId?: string | null
  logTime?: string
  eventName?: string
  eventDisplayName?: string
  eventProp?: string | Record<string, unknown>
  hotProp?: string | unknown[]
  date?: string
  hour?: string
}

/** formatEvent 之后的事件 */
export interface SeqEvent {
  id: string | null
  date: string
  hour: string
  name: string
  eventName: string
  time: string
  fullTime: string | undefined
  details: Record<string, unknown>
  original: RawSeqEvent
  hotProp: string
  hotPropText: string
}

/** 单日下按小时分的组 */
export interface SeqHourGroup {
  hour: string
  events: SeqEvent[]
}

/** 行为轨迹的「一天」 */
export interface SeqDay {
  date: string
  total: number
  count?: number
  groups?: SeqHourGroup[]
  loaded?: boolean
  loading?: boolean
  loadingMore?: boolean
  pageNum?: number
  pageSize?: number
  loadedCount?: number
}

/** pageGetUserEventDates 的返回体 */
export interface SeqDatesPayload {
  rows?: SeqDay[]
  total?: number
}

/** pageGetUserEventsByDateGrouped 的返回体 */
export interface SeqGroupedPayload {
  hours?: { hour?: string; hourDisplay?: string; events?: RawSeqEvent[] }[]
  total?: number
}

/** getEventNeighbours 的返回体 */
export interface SeqNeighboursPayload {
  eventsBefore?: RawSeqEvent[]
  eventsAfter?: RawSeqEvent[]
}

/**
 * 行为轨迹的查询参数。
 * 写成 type 而不是 interface：interface 没有隐式索引签名，
 * 传给 api 层的 Record<string, unknown> 形参会报「缺少索引签名」。
 */
export type SequenceQueryParams = {
  projectName?: string | string[] | null
  userId?: string | string[] | null
  startDate: string
  endDate: string
  dimension: string
  events: string[]
  keyWord: string
  pageNum: number
  pageSize: number
  sortOrder: string
}

/** 行为轨迹切 tab 时缓存的整份状态 */
export interface SequenceCache {
  seqFilter: SeqFilterValue
  queryParams: SequenceQueryParams
  seqDays: SeqDay[]
  seqPage: { page: number; size: number; total: number }
  seqOrder: string
  expandedDays: Record<string, boolean>
  expandedHours: Record<string, boolean>
  selectedEvent: SeqEvent | null
  eventOptions: EventGroup[]
  eventMeta: SeqEventMeta | null
}

/* ------------------------------ 行为分析 ------------------------------ */

/** getUserEventReports 的一行 */
export interface EventReportRow {
  eventName?: string
  eventDisplay?: string
  count?: number
}

/** getUserEventReportByDate 的一行 */
export interface EventReportByDateRow {
  dimDate?: string
  startDate?: string
  endDate?: string
  totalCount: number
  eventCount: number
}

/** 饼图的一项（与 v2 一致：name / value 在前，...item 在后会覆盖同名字段） */
export interface PieDatum extends EventReportRow {
  name: string
  value: number
}

/** 饼图右侧表格的一行 */
export interface PieTableRow {
  name: string | undefined
  eventDisplay: string | undefined
  value: number
  rate: number
}

/** 事件日志表格的一行 */
export interface EventLogRow {
  logTime?: string
  eventDisplayName?: string
  eventName?: string
  eventProp?: string
  logId?: string
  createdAt?: string
  time?: string
  parsedEventProp: Record<string, unknown>
}

/** 柱状图 / 折线图的一个点（带上下钻用的起止日期） */
export interface TrendPoint {
  value: number
  startDate?: string
  endDate?: string
}

/** 行为分析的查询参数（写成 type 的理由同 SequenceQueryParams） */
export type AnalysisQueryParams = {
  userId?: string | string[] | null
  startDate: string
  endDate: string
  pageNum: number
  pageSize: number
  dimension: string
  events: string[]
  projectName?: string | string[] | null
}

/** 行为分析切 tab 时缓存的整份状态 */
export interface AnalysisCache {
  seqFilter: SeqFilterValue
  filterParams: Partial<SeqFilterParams>
  topSummary: { total: number; distinct: number }
  topSeries: { x: string[]; bar: TrendPoint[]; line: TrendPoint[] }
  pieData: PieDatum[]
  logList: EventLogRow[]
  logTotal: number
  queryParams: AnalysisQueryParams
  pieMode: string
  openChartObj: { startDate: string; endDate: string; isClick: boolean }
  eventOptions: EventGroup[]
}

/* ------------------------------ 访问 / 概览 ------------------------------ */

/** 用户基本信息（getUserDetailInfo） */
export interface UserBaseInfo {
  userId?: string
  pv?: number
  avgPv?: number
  firstTime?: string | number
  latestTime?: string | number
  visitTime?: number
  avgVisitTime?: number
  manufacturer?: string
  areaList?: { country?: string; province?: string; city?: string }[]
}

/** 用户列表（getUserListNew）里的一行，只用到这三个 ID */
export interface UserObjInfo {
  userId?: string
  loginId?: string
  anonymousId?: string
}

/** 标签值 */
export interface TagValue {
  valueType?: string
  valueDatetime?: string
  valueNumber?: number
  valueString?: string
  valueBoolean?: boolean
  tableName?: string
  displayName?: string
}

/** getTagValueList 的一行 */
export interface TagGroupRow {
  type?: string
  tableName?: string
  displayName?: string
  tagValues: TagValue[]
}

/** 单次访问里的一个页面（getUserSessionUriList） */
export interface VisitUriRow {
  logTime?: string
  title?: string
  uri?: string
  eventSessionId?: string
}

/** 一次访问（getUserSessionList） */
export interface VisitSessionRow {
  userId?: string
  eventSessionId?: string
  firstTime?: string | number
  pv?: number
  /** 拉回来是秒数，v2 会就地改写成 formatTime 之后的 "hh:mm:ss" 字符串 */
  visitTime?: string | number
  rows?: { clientIp?: string; province?: string }[]
  httpList: VisitUriRow[][]
  allHttpList: VisitUriRow[][]
  clickMore?: number
}

/** 浏览历史切 tab 时缓存的整份状态 */
export interface VisitHistoryCache {
  seqFilter: SeqFilterValue
  commonParams: { startDate: string; endDate: string }
  visitorSessionList: VisitSessionRow[]
  total: number
  currentPage: number
  pageSize: number
  clickIndex: number
}
