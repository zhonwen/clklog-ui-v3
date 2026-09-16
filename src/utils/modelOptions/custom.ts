/**
 * 查询模型（自定义分析 / 事件分析）用到的选项常量。
 *
 * 取值与 v2 的 src/utils/options.js 完全一致（自定义分析模块 import 的正是该文件；
 * v2 另有一份 src/utils/modelOptions/custom.js 是同内容的副本）。
 * getOptionsByType 对应 v2 的 src/utils/propertyOptions.js。
 */

/** 选项项：{ displayName, name } */
export interface OptionDef {
  displayName: string
  name: string
}

/** 初始默认类型（指标联级第一层） */
export const defaultType: OptionDef[] = [
  { displayName: '总次数', name: 'general' },
  { displayName: '用户数', name: 'unique' },
  { displayName: '人均次数', name: 'average' },
]

/** NUMBER 数值类聚合方式 */
export const NumberType: OptionDef[] = [
  { displayName: '总和', name: 'SUM' },
  { displayName: '均值', name: 'AVG' },
  { displayName: '最大值', name: 'MAX' },
  { displayName: '最小值', name: 'MIN' },
  { displayName: '去重数', name: 'uniqCount' },
]

/** STRING 非数值类聚合方式 */
export const noNumber: OptionDef[] = [{ displayName: '去重数', name: 'uniqCount' }]

/** STRING 判断条件 */
export const attr_string: OptionDef[] = [
  { displayName: '等于', name: 'equal' },
  { displayName: '不等于', name: 'notEqual' },
  { displayName: '包含', name: 'contains' },
  { displayName: '不包含', name: 'noContains' },
  { displayName: '有值', name: 'isSet' },
  { displayName: '没值', name: 'notSet' },
  { displayName: '为空', name: 'isEmpty' },
  { displayName: '不为空', name: 'isNotEmpty' },
  { displayName: '正则匹配', name: 'match' },
  { displayName: '正则不匹配', name: 'notMatch' },
]

/** LIST 判断条件 */
export const attr_list: OptionDef[] = [
  { displayName: '包含', name: 'contains' },
  { displayName: '不包含', name: 'noContains' },
  { displayName: '有值', name: 'isSet' },
  { displayName: '没值', name: 'notSet' },
  { displayName: '为空', name: 'isEmpty' },
  { displayName: '不为空', name: 'isNotEmpty' },
]

/** NUMBER 判断条件 */
export const attr_number: OptionDef[] = [
  { displayName: '等于', name: 'equal' },
  { displayName: '不等于', name: 'notEqual' },
  { displayName: '大于', name: 'greater' },
  { displayName: '小于', name: 'less' },
  { displayName: '有值', name: 'isSet' },
  { displayName: '没值', name: 'notSet' },
  { displayName: '区间', name: 'between' },
]

/** BOOL 判断条件 */
export const attr_boolean: OptionDef[] = [
  { displayName: '为真', name: 'isTrue' },
  { displayName: '为假', name: 'isFalse' },
  { displayName: '有值', name: 'isSet' },
  { displayName: '没值', name: 'notSet' },
]

/**
 * DATETIME 判断条件。
 * 与 v2 一致：「相对事件发生时间 relative_event_time」在 v2 里被注释掉了，这里同样不放出来
 * （但 conditionOption 仍保留了它的渲染分支，与 v2 一致）。
 */
export const attr_dateTime: OptionDef[] = [
  { displayName: '绝对时间', name: 'absolute_between' },
  { displayName: '时段区间', name: 'extract_between' },
  { displayName: '相对当前时间点', name: 'relative_within' },
  { displayName: '相对当前时间区间', name: 'relative_between' },
  { displayName: '有值', name: 'isSet' },
  { displayName: '没值', name: 'notSet' },
]

/** DATETIME 下的选择条件 */
export const dayScope: OptionDef[] = [
  { displayName: '之内', name: 'inDay' },
  { displayName: '之前', name: 'beforeDay' },
]

export const relativeTime: OptionDef[] = [
  { displayName: '之后', name: 'afterDay' },
  { displayName: '之前', name: 'beforeDay' },
  { displayName: '当天', name: 'currentDay' },
  { displayName: '当周', name: 'currentWeek' },
  { displayName: '当月', name: 'currentMonth' },
]

export const dateTimeList: OptionDef[] = [
  { displayName: '秒', name: 'second' },
  { displayName: '分', name: 'minute' },
  { displayName: '小时', name: 'hour' },
  { displayName: '天', name: 'day' },
]

/** 类型与 options 的映射（v2 utils/propertyOptions.js 的 typeOptionsMap） */
const typeOptionsMap: Record<string, OptionDef[]> = {
  STRING: attr_string,
  NUMBER: attr_number,
  DATETIME: attr_dateTime,
  BOOL: attr_boolean,
  LIST: attr_list,
}

/** 通用获取方法（v2 utils/propertyOptions.js 的 getOptionsByType） */
export function getOptionsByType(type?: string | null): OptionDef[] {
  if (!type) return []
  return typeOptionsMap[type] || []
}
