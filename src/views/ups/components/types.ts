/**
 * ups 公共组件的对外数据结构。
 *
 * 字段名、层级、可选性全部按 v2 `views/ups/components/*.vue` 的实际用法还原，
 * 不做任何重构。userTag / usergroup / userPortrait 三个模块从这里 import 类型，
 * 保证传给 tree-select 的 second_item / propertyList 结构一致。
 *
 * 形状与 views/user-behavior/userReview/types.ts 里的同名类型保持一致
 * （那份是 userReview 自带的一份拷贝，两边可互相赋值）。
 */

/** 属性归属。v2 的 radioOptions 给出前三种，user_tag 只在 tree-select 内部分支里出现 */
export type UpsFieldType = 'event_property' | 'user_property' | 'user_group' | 'user_tag'

/** 属性 / 分群 / 标签的树节点（tree-select 的 options 元素） */
export interface PropertyNode {
  name?: string
  displayName?: string
  dataType?: string
  /** user_tag 类型选中时写回 item.field 的是 tableName 而不是 name */
  tableName?: string
  propertyId?: string
  children?: PropertyNode[]
}

/** tree-select 的四类可选数据源 */
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

/** tree-select 顶部的类型单选项 */
export interface RadioOption {
  label: string
  value: string
}

/**
 * 一条筛选条件，也就是 tree-select 的 `second_item`。
 * tree-select 会就地写 field / dataType / function / fieldType / displayName 五个字段。
 */
export interface ConditionItem {
  field?: string
  dataType?: string
  /** 判断方式，如 isSet / belone / equal / between / absolute_between ... */
  function?: string
  fieldType?: string
  /** 值。多选输入是 string[]，区间 / 时间类是按下标写入的定长数组 */
  params?: (string | number)[]
  /** 群画像需要用到 displayName 作为名称（tree-select 的 typePath 分支会写） */
  displayName?: string
  [key: string]: unknown
}

/** estimate-dialog 表格的一行（人数预估接口返回） */
export interface EstimateRow {
  /** 分层名称 / 标签值，'全部' 是一个特殊值 */
  name?: string
  /** 命中人数 */
  count?: number
  /** 打过标签的总人数（非分群口径的占比分母） */
  totalTagged?: number
  /** 全部用户数（用户分群口径的占比分母） */
  totalUser?: number
  [key: string]: unknown
}

/** estimate-dialog 的第二个入参：区分「用户分群」和其它类型 */
export interface EstimateFromType {
  /** 「用户分群」走圆形波浪进度条，其余走表格 */
  typeName: string
  [key: string]: unknown
}
