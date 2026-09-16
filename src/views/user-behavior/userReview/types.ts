import type { CSSProperties } from 'vue'

/**
 * 用户复查（userReview）的数据结构。
 * 字段名、层级、可选性全部按 v2 的实际用法还原，不做任何重构。
 */

/** 属性归属。v2 的 radioOptions 给出的是这三种，事件属性只在 treeSelect 内部分支里出现 */
export type ReviewFieldType = 'event_property' | 'user_property' | 'user_group' | 'user_tag'

/** 一条筛选条件 */
export interface ConditionItem {
  field?: string
  dataType?: string
  /** 判断方式，如 isSet / belone / equal / between / absolute_between ... */
  function?: string
  fieldType?: string
  /** 值。多选输入是 string[]，区间/时间类是按下标写入的定长数组 */
  params: (string | number)[]
  /** 群画像需要用到 displayName 作为名称（treeSelect 的 typePath 分支会写） */
  displayName?: string
}

/** 一个筛选分组（组内多条件之间用 relation 连接） */
export interface FilterGroup {
  relation?: string
  conditions: ConditionItem[]
}

/** 筛选模型。isValid 是 computedStyle 读的校验开关（v2 在本模块里从未写过它） */
export interface ModelObject {
  relation?: string
  filters: FilterGroup[]
  isValid?: boolean
}

/** 属性 / 分群 / 标签的树节点 */
export interface PropertyNode {
  name?: string
  displayName?: string
  dataType?: string
  tableName?: string
  propertyId?: string
  children?: PropertyNode[]
}

/** treeSelect 的四类可选数据源 */
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

/** treeSelect 顶部的类型单选 */
export interface RadioOption {
  label: string
  value: string
}

/**
 * 校验样式（对应 v2 src/utils/index.js 的 computedStyle）。
 * v2 返回的就是对象，这里原样保留；未命中时返回 undefined，绑到 :style 上等同于不加样式。
 *
 * 与 v2 一致（v2 此处逻辑存疑：本模块从没有人给 modelObject 写过 isValid，
 * 所以 isValid 恒为 undefined，这个函数实际上永远返回 undefined，红框校验从未生效过）。
 */
export function computedStyle(
  value: unknown,
  valid?: ModelObject | null,
): CSSProperties | undefined {
  const isValid = valid ? valid.isValid : ''
  if (Array.isArray(value) && isValid) {
    if (value.length == 0) {
      return {
        border: '1px solid red',
        borderRadius: '4px',
      }
    }
  } else {
    if (!value && isValid) {
      return {
        border: '1px solid red',
        borderRadius: '4px',
      }
    }
  }
  return undefined
}
