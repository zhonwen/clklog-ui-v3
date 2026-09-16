/**
 * 漏斗分析模块的数据结构。
 * 字段名、层级、可选性全部按 v2 的实际用法还原，不做任何重构。
 */
import type { AnalysisStep, ByFieldItem, FilterModel } from '@/components/analysis-model/types'

/** 转化周期。v2 的 concatenatedValue setter 用正则拆串后写回，numeral 会从 number 变成 string */
export interface FunnelWindow {
  numeral: number | string
  unit: string
}

/** 漏斗查询模型，整体会被 JSON.stringify 后塞进路由 query 与书签 queryParams */
export interface FunnelModelObject {
  name: string
  /** 计算方式：UV 人数 / PV 次数 */
  measurement: string
  /** 转换周期 */
  window: FunnelWindow
  /** 漏斗步骤 */
  steps: AnalysisStep[]
  /** 维度 */
  byFields: ByFieldItem[]
  /** 全局过滤 */
  filter: FilterModel
  projectName: string
  startDate: string
  endDate: string
  dataType: string
  timeFlag: string
  /** 是否开启关联属性（只有漏斗定义里才有，查询模型透传） */
  isOpenRelation?: boolean
}

/** dialog.vue 里新增 / 编辑的漏斗定义（保存进 funnel 的 queryParams） */
export interface FunnelDefinition {
  name: string
  /** 开启关联性 */
  isOpenRelation: boolean
  steps: AnalysisStep[]
}

/** 漏斗列表项（/funnel/getPageList 的 rows） */
export interface FunnelListItem {
  funnelId: string
  name: string
  /** JSON 字符串，内容是 FunnelDefinition */
  queryParams: string
  remark?: string
  funnelWindow?: string
  /** 是否本人创建，决定能否编辑 / 删除 */
  owner?: boolean
  creator?: string
  createTime?: string
  updateTime?: string
}

/** /funnel/getPageList 的 data */
export interface FunnelPageData {
  total: number
  rows: FunnelListItem[]
}

/** dialog.vue 编辑保存时回传给父级的入参，父级靠 funnelId / queryParams 决定是否刷新当前步骤 */
export interface FunnelEditParams {
  projectName?: string
  funnelId?: string
  name: string
  remark: string
  queryParams: string
  funnelWindow: string
}

/** 书签对象（路由 query.tagObj 里存的就是它的 JSON） */
export interface BookmarkTag {
  bookmarkId: string
  name: string
  remark?: string
  timeSection?: string
  queryParams?: string
}

/** 结果：单个步骤的转化数据 */
export interface FunnelStepResult {
  convertedUser: number
  conversionRate: number
  completionRate?: number
}

/** 结果：一行（dimDate 为 '$ALL' 的那一行是总体） */
export interface FunnelRow {
  dimDate: string
  byValues: string[]
  convertedUser: number
  conversionRate: number
  steps: FunnelStepResult[]
}

/** 漏斗分析结果 */
export interface FunnelResult {
  rows: FunnelRow[]
  /** 主页面的时间列表，含 '$ALL' */
  dateList?: string[]
  /** 弹窗里的维度组合列表 */
  byValuesList?: string[][]
  /** 数据量过大时后端只返回了部分数据 */
  partial?: boolean
  /** 人数 / 次数，metricLineChart 的 tooltip 单位靠它 */
  measurementType?: string
}

/** 异步任务：创建任务返回的 id */
export interface TaskInstanceData {
  instanceId: string
}

/** 异步任务：查询状态。200 完成 / 102 进行中 */
export interface TaskQueryData {
  code: number
}

/** 异步任务：拉取结果 */
export interface TaskFetchData {
  result?: FunnelResult
}

/** el-table 的二级表头 */
export interface TableSubColumn {
  prop: string
  label: string
  width?: number
  sortable?: string
  /** 是否为百分比列（渲染时补一个 %） */
  isRate?: boolean
}

/** el-table 的一级表头 */
export interface TableColumn {
  label: string
  children: TableSubColumn[]
}

/** 显示设置里的「显示指标」选项 */
export interface StepTabOption {
  value: number
  label: string
}

/** 时间 / 维度多选下拉项 */
export interface GroupOption {
  id: string
  label: string
}
