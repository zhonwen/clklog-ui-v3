import type { CascaderNode, LabelValue, OptionDef, RadioOption } from './types'

/**
 * 用户分群模块用到的选项常量。
 *
 * 取值逐条对齐 v2：
 *   - propertyTypeList / conditionList / sortList → v2 `src/utils/modelOptions/group-limit.js`
 *   - estimateList / updateTimeList / latestVersionCountTime / groupValueType /
 *     intervalList / defaultUserType / defaultType / NumberAgg / noNumber
 *     → v2 `src/utils/modelOptions/custom.js`
 *   - cascaderList → v2 customTagPage/index.vue 里内联的那份日历级联
 *
 * 放在模块内而不是 `src/utils/modelOptions/*`：v3 的 `utils/modelOptions/custom.ts`
 * 由别的任务维护，这里不去改它。等收尾时可以把这些常量并回去（见迁移报告）。
 */

/* -------------------------------------------------------------------------- */
/* group-limit：人数限制                                                       */
/* -------------------------------------------------------------------------- */

export const propertyTypeList: LabelValue[] = [
  { label: '随机', value: '随机' },
  { label: '属性', value: '属性' },
]

export const conditionList: LabelValue[] = [{ label: '用户关注主播量', value: '用户关注主播量' }]

export const sortList: LabelValue[] = [
  { label: '数值从大到小', value: '数值从大到小' },
  { label: '数值从小到大', value: '数值从小到大' },
]

/* -------------------------------------------------------------------------- */
/* custom：分群创建                                                            */
/* -------------------------------------------------------------------------- */

/** 全量估算选择项（v2 里除「按全量估算」外都被注释掉了，这里同样只留一项） */
export const estimateList: LabelValue[] = [{ value: 'all', label: '按全量估算' }]

/** 例行更新的周期 */
export const updateTimeList: LabelValue[] = [
  { value: '天', label: '天' },
  { value: '周', label: '周' },
  { value: '月', label: '月' },
]

/** 最新版本计算时间（整点列表） */
export function latestVersionCountTime(isAll?: boolean): LabelValue[] {
  const hourOptions: LabelValue[] = []
  for (let i = 0; i < 24; i++) {
    const hour = String(i).padStart(2, '0') // 确保两位数
    hourOptions.push({ value: `${hour}:00`, label: `${hour}:00` })
  }
  if (isAll) {
    hourOptions.unshift({ value: '', label: '全部' })
  }
  return hourOptions
}

/** 用户分群作为条件时的判断方式（v2 把「不存在」注释掉了） */
export const groupValueType: OptionDef[] = [{ displayName: '存在', name: 'isSet' }]

/** 行为指标的判断方式 */
export const intervalList: OptionDef[] = [
  { displayName: '等于', name: 'equal' },
  { displayName: '不等于', name: 'notEqual' },
  { displayName: '大于', name: 'greater' },
  { displayName: '小于', name: 'less' },
  { displayName: '区间', name: 'between' },
]

/** 行为规则的聚合方式（behaviorRules 用） */
export const defaultUserType: OptionDef[] = [
  { displayName: '总次数', name: 'general' },
  { displayName: '分布天数', name: 'distribution' },
]

/** 序列卡片的聚合方式（sequenceCard 用） */
export const defaultType: OptionDef[] = [
  { displayName: '总次数', name: 'general' },
  { displayName: '用户数', name: 'unique' },
  { displayName: '人均次数', name: 'average' },
]

/** NUMBER 数值类聚合（v2 导出名就叫 Number，这里避开全局 Number 改名） */
export const NumberAgg: OptionDef[] = [
  { displayName: '总和', name: 'SUM' },
  { displayName: '均值', name: 'AVG' },
  { displayName: '最大值', name: 'MAX' },
  { displayName: '最小值', name: 'MIN' },
  { displayName: '去重数', name: 'uniqCount' },
]

/** STRING 非数值类聚合 */
export const noNumber: OptionDef[] = [{ displayName: '去重数', name: 'uniqCount' }]

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

/* -------------------------------------------------------------------------- */
/* 其它                                                                        */
/* -------------------------------------------------------------------------- */

/** tree-select 顶部的四个类型按钮（属性 / 行为 / 序列三处完全一致） */
export const radioOptions: RadioOption[] = [
  { label: '事件属性', value: 'event_property' },
  { label: '用户属性', value: 'user_property' },
  { label: '用户分群', value: 'user_group' },
  { label: '用户标签', value: 'user_tag' },
]

/** 日历级联的初始值（v2 customTagPage/index.vue 的 data.cascaderList） */
export function createCascaderList(): CascaderNode[] {
  return [
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
}

/** 分群状态 */
export const tagStatusList: LabelValue[] = [
  { value: '', label: '全部' },
  { value: '启用', label: '启用' },
  { value: '暂停', label: '暂停' },
]

/** 更新方式 */
export const updateTypeList: LabelValue[] = [
  { value: '', label: '全部' },
  { value: '例行', label: '例行' },
  { value: '手动', label: '手动' },
]

/** 创建方式 */
export const createMethod: LabelValue[] = [
  { value: '', label: '全部' },
  { value: '自定义规则', label: '规则创建' },
  { value: '导入创建', label: '导入创建' },
]
