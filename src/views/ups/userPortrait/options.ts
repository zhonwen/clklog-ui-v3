import type { OptionDef } from '@/utils/modelOptions/custom'
import type { CascaderNode } from './types'

/**
 * 群画像模块用到、但 v3 `@/utils/modelOptions/custom.ts` 里还没有的选项常量。
 *
 * 取值与 v2 `src/utils/modelOptions/custom.js` / `src/utils/modelOptions/group-limit.js`
 * / `src/utils/format.js` 完全一致，顺序不能改（多处按下标取值）。
 * 这些常量本该合进 `@/utils/modelOptions/custom.ts`，但那个文件由别的任务负责，
 * 所以先放在本模块内，合并时整体搬过去即可。
 */

/** v2 里导出名就叫 `Number`（遮蔽了全局构造器），v3 里改名 NumberType，语义不变 */
export const NumberType: OptionDef[] = [
  { displayName: '总和', name: 'SUM' },
  { displayName: '均值', name: 'AVG' },
  { displayName: '最大值', name: 'MAX' },
  { displayName: '最小值', name: 'MIN' },
  { displayName: '去重数', name: 'uniqCount' },
]

/** 用户行为里的默认指标类型（v2 defaultUserType） */
export const defaultUserType: OptionDef[] = [
  { displayName: '总次数', name: 'general' },
  { displayName: '分布天数', name: 'distribution' },
]

/** 指标区间判断（v2 intervalList，注释掉的符号项一并保留为注释） */
export const intervalList: OptionDef[] = [
  // { displayName: ">", name: ">" },
  // { displayName: "<", name: "<" },
  // { displayName: "=", name: "=" },
  // { displayName: "≥", name: ">=" },
  // { displayName: "≤", name: "<=" },
  // { displayName: "≠", name: "!=" },
  { displayName: '等于', name: 'equal' },
  { displayName: '不等于', name: 'notEqual' },
  { displayName: '大于', name: 'greater' },
  { displayName: '小于', name: 'less' },
  { displayName: '区间', name: 'between' },
]

/** 用户分群-值类型（v2 groupValueType，「不存在」在 v2 里被注释掉） */
export const groupValueType: OptionDef[] = [
  { displayName: '存在', name: 'isSet' },
  // { displayName: "不存在", name: "notSet" },
]

/** 日历联级（v2 cascaderList）。注意：组件里会往 children 里 push 自定义项，需要各自持有副本 */
export const cascaderList: CascaderNode[] = [
  {
    value: 'absolute_time',
    label: '绝对时间',
    children: [{ value: 'time_scope', label: '选择范围' }],
  },
  {
    value: 'relative_time',
    label: '相对时间',
    children: [
      { value: '0day', label: '当天' },
      { value: '-1day', label: '前1天' },
      { value: '-3day', label: '前3天' },
      { value: '-7day', label: '前7天' },
      { value: '-14day', label: '前14天' },
      { value: '-30day', label: '前30天' },
      { value: 'custom', label: '自定义' },
    ],
  },
]

/** 全量估算选择项（v2 estimateList，抽样项全被注释掉） */
export const estimateList: { value: string; label: string }[] = [
  { value: 'all', label: '按全量估算' },
  // { value: "1/2", label: "按1/2抽样计算" },
  // { value: "1/8", label: "按1/8抽样计算" },
  // { value: "1/16", label: "按1/16抽样计算" },
  // { value: "1/32", label: "按1/32抽样计算" },
  // { value: "1/64", label: "按1/64抽样计算" },
]

/** 例行更新频率（v2 updateTimeList） */
export const updateTimeList: { value: string; label: string }[] = [
  { value: '天', label: '天' },
  { value: '周', label: '周' },
  { value: '月', label: '月' },
]

/** 整点小时下拉（v2 latestVersionCountTime） */
export function latestVersionCountTime(isAll?: boolean): { value: string; label: string }[] {
  const hourOptions: { value: string; label: string }[] = []
  for (let i = 0; i < 24; i++) {
    const hour = String(i).padStart(2, '0') // 确保两位数
    hourOptions.push({ value: `${hour}:00`, label: `${hour}:00` })
  }
  if (isAll) {
    hourOptions.unshift({ value: '', label: '全部' })
  }
  return hourOptions
}

/** v2 `utils/modelOptions/group-limit.js` 的三个常量（回流用户设置，当前 UI 未展示） */
export const propertyTypeList: { label: string; value: string }[] = [
  { label: '随机', value: '随机' },
  { label: '属性', value: '属性' },
]

export const conditionList: { label: string; value: string }[] = [
  { label: '用户关注主播量', value: '用户关注主播量' },
]

export const sortList: { label: string; value: string }[] = [
  { label: '数值从大到小', value: '数值从大到小' },
  { label: '数值从小到大', value: '数值从小到大' },
]

/**
 * 单日日期选择器的限制（v2 `utils/format.js` 的 datePickerDay）。
 * element-plus 不再支持 picker-options，拆成 :disabled-date 与 :shortcuts 两个 prop，
 * 快捷项由 `onClick(picker){picker.$emit('pick', d)}` 改成 `value: () => d`。
 */
export function datePickerDisabledDate(time: Date) {
  return time.getTime() > Date.now()
}

function daysAgo(days: number) {
  const date = new Date()
  date.setTime(date.getTime() - 3600 * 1000 * 24 * days)
  return date
}

export const datePickerDayShortcuts = [
  { text: '今天', value: () => new Date() },
  { text: '昨天', value: () => daysAgo(1) },
  { text: '一周前', value: () => daysAgo(7) },
  { text: '近一个月', value: () => daysAgo(30) },
  { text: '近三个月', value: () => daysAgo(90) },
  { text: '近六个月', value: () => daysAgo(180) },
  { text: '近一年', value: () => daysAgo(365) },
]

/** attributeRules 里的单日快捷项（v2 只给了「今天/昨天/一周前」三项） */
export const attributeDateShortcuts = [
  { text: '今天', value: () => new Date() },
  { text: '昨天', value: () => daysAgo(1) },
  { text: '一周前', value: () => daysAgo(7) },
]

/** behaviorRules / sequenceRules 里的日期区间快捷项（v2 的「最近一周/一个月/三个月」） */
export const rangeShortcuts: { text: string; value: () => [Date, Date] }[] = [
  { text: '最近一周', value: () => [daysAgo(7), new Date()] },
  { text: '最近一个月', value: () => [daysAgo(30), new Date()] },
  { text: '最近三个月', value: () => [daysAgo(90), new Date()] },
]
