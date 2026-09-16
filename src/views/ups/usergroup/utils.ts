import type { CSSProperties } from 'vue'
import { getOptionsByType } from '@/utils/modelOptions/custom'
import type { LabelValue, OptionDef, PropertyNode, RuleSet } from './types'

/**
 * 用户分群模块内部的工具函数。
 *
 * computedStyle / verificaRules / isEmptyParams / handleTree / weekOrMonthRangeList
 * 在 v2 里都在 `src/utils/index.js`，v3 的 `src/utils/index.ts` 由别的任务维护，
 * 所以先放在模块内，语义与 v2 完全一致（见迁移报告的「需要合并到 utils 的函数」）。
 */

/* -------------------------------------------------------------------------- */
/* 校验                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * 红框校验样式（v2 `utils/index.js` 的 computedStyle）。
 * v2 返回的就是对象，这里原样保留；未命中时返回 undefined，绑到 :style 等同于不加样式。
 */
export function computedStyle(value: unknown, valid?: RuleSet | null): CSSProperties | undefined {
  const isValid = valid ? valid.isValid : ''
  if (Array.isArray(value) && isValid) {
    if (value.length == 0) {
      return { border: '1px solid red', borderRadius: '4px' }
    }
  } else {
    if (!value && isValid) {
      return { border: '1px solid red', borderRadius: '4px' }
    }
  }
  return undefined
}

/** 判断方式需要几个参数（v2 `utils/index.js` 的 verificaRules） */
export function verificaRules(type?: string): number {
  if (!type) return 1
  if (
    type == 'isTrue' ||
    type == 'isFalse' ||
    type == 'isSet' ||
    type == 'notSet' ||
    type == 'isEmpty' ||
    type == 'isNotEmpty'
  ) {
    return 0
  } else if (
    type == 'between' ||
    type == 'queal' ||
    type == 'notQueal' ||
    type == 'absolute_between' ||
    type == 'extract_between' ||
    type == 'relative_within' ||
    type == 'relative_between' ||
    type == 'relative_event_time'
  ) {
    return 2
  } else {
    return 1
  }
}

/**
 * 参数是否为空（v2 `utils/index.js` 的 isEmptyParams）。
 * 与 v2 一致（v2 此处逻辑存疑：不满足条件时返回的是 undefined 而不是 false，
 * 调用方都是当布尔用，所以行为一致，这里同样保留 undefined 语义改成 boolean 返回）。
 */
export function isEmptyParams(params: unknown): boolean {
  if (params == '' || params == null || params == undefined) return true
  if (Array.isArray(params) && params.length == 0) return true
  // v2 还会对非数组取 .length（字符串同样成立），这里保持等价
  if (typeof params === 'string' && params.length == 0) return true
  return false
}

/**
 * 「条件是否需要一个自由输入的值」（属性 / 行为 / 序列三处的 filterIstrue 完全一致）。
 * 返回 false 表示这个判断方式由别的分支渲染（区间 / 正则 / 时间类 / 无参数类）。
 */
export function filterIstrue(item?: string): boolean {
  let flag = true
  if (
    item == 'isTrue' ||
    item == 'isFalse' ||
    item == 'isSet' ||
    item == 'notSet' ||
    item == 'isEmpty' ||
    item == 'isNotEmpty' ||
    // 正则匹配
    item == 'between' ||
    item == 'queal' ||
    item == 'notQueal' ||
    // 相对时间
    item == 'absolute_between' ||
    item == 'extract_between' ||
    item == 'relative_within' ||
    item == 'relative_between' ||
    item == 'relative_event_time'
  ) {
    flag = false
  }
  return flag
}

/* -------------------------------------------------------------------------- */
/* 默认值                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * 取候选项里的第一项（v2 各组件里的 strictMode）。
 * v2 对 OptionDef[]（判断方式）和属性列表都调它，所以这里放宽到「有 name / displayName 的对象数组」。
 */
export function strictMode(
  val: { name?: string; displayName?: string }[] | '' | undefined,
  label: 'name' | 'displayName',
): string {
  if (val && val.length > 0) {
    return val[0]?.[label] ?? ''
  } else {
    return ''
  }
}

/** 按 dataType 取判断方式候选（v2 各组件里的 filterCommonType） */
export function filterCommonType(type?: string): OptionDef[] | '' {
  if (!type) return ''
  return getOptionsByType(type)
}

/* -------------------------------------------------------------------------- */
/* 序号 / 字母                                                                 */
/* -------------------------------------------------------------------------- */

export function getLetterByIndex(index: number): string {
  if (index < 0 || index >= 26) {
    return String.fromCharCode(65 + (index % 26))
  }
  return String.fromCharCode(65 + index) // 65 是大写字母 A 的 ASCII 编码
}

/** v2 `filters/index.js` 的 createUniqueString（模板里当随机 key 用） */
export function createUniqueString(): number {
  const randomBytes = new Uint8Array(4)
  window.crypto.getRandomValues(randomBytes)
  let randomNumber = 0
  for (let i = 0; i < randomBytes.length; i++) {
    randomNumber += (randomBytes[i] ?? 0) * Math.pow(256, i)
  }
  return randomNumber
}

export function getLetterLowercase(index: number): string {
  if (index < 0 || index >= 26) {
    return String.fromCharCode(97 + (index % 26))
  }
  return String.fromCharCode(97 + index)
}

/* -------------------------------------------------------------------------- */
/* 树 / 日期区间                                                               */
/* -------------------------------------------------------------------------- */

/** v2 `utils/index.js` 的 handleTree（列表转树） */
export function handleTree(
  data: PropertyNode[] & { [k: string]: unknown }[],
  id?: string,
  parentId?: string,
  children?: string,
): Record<string, unknown>[] {
  const config = {
    id: id || 'id',
    parentId: parentId || 'parentId',
    childrenList: children || 'children',
  }

  const childrenListMap: Record<string, Record<string, unknown>[]> = {}
  const nodeIds: Record<string, Record<string, unknown>> = {}
  const tree: Record<string, unknown>[] = []
  const list = (data || []) as unknown as Record<string, unknown>[]

  for (const d of list) {
    const pid = String(d[config.parentId])
    if (childrenListMap[pid] == null) {
      childrenListMap[pid] = []
    }
    nodeIds[String(d[config.id])] = d
    childrenListMap[pid]?.push(d)
  }

  for (const d of list) {
    const pid = String(d[config.parentId])
    if (nodeIds[pid] == null) {
      tree.push(d)
    }
  }

  function adaptToChildrenList(o: Record<string, unknown>) {
    const mine = childrenListMap[String(o[config.id])]
    if (mine !== undefined) {
      o[config.childrenList] = mine
    }
    const kids = o[config.childrenList]
    if (Array.isArray(kids)) {
      for (const c of kids as Record<string, unknown>[]) {
        adaptToChildrenList(c)
      }
    }
  }

  for (const t of tree) {
    adaptToChildrenList(t)
  }
  return tree
}

/** v2 `utils/index.js` 的 weekOrMonthRangeList（例行更新的周/月可选项） */
export function weekOrMonthRangeList(val?: string): LabelValue<number>[] {
  const dateRangeList: LabelValue<number>[] = []
  if (val === '周') {
    const daysOfWeek = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    daysOfWeek.forEach((day, index) => {
      dateRangeList.push({ value: index + 1, label: day })
    })
  } else if (val === '月') {
    // 与 v2 一致：固定 31 天，不按当前月份算
    const daysInMonth = 31
    for (let day = 1; day <= daysInMonth; day++) {
      dateRangeList.push({ value: day, label: day.toString() + '号' })
    }
  }
  return dateRangeList
}

/* -------------------------------------------------------------------------- */
/* 路由                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * 取当前路由的同级路径。
 *
 * v2 用的是 `this.$router.push({ path: 'creator' })`（vue-router 3 的相对路径）
 * 和 `this.$router.push({ name: 'userGroup' })`（靠父路由 redirect 到 userGroup/list）。
 * v3 的动态路由名字是后端菜单的 component 字段拼出来的，按 name 跳不可靠，
 * 所以统一换成「当前路径的兄弟路径」，语义和 v2 完全一样（list / creator 是同级子路由）。
 */
export function siblingPath(currentPath: string, name: string): string {
  const idx = currentPath.lastIndexOf('/')
  return idx <= 0 ? `/${name}` : `${currentPath.slice(0, idx)}/${name}`
}

/* -------------------------------------------------------------------------- */
/* 日期选择器（v2 的 picker-options → element-plus 的 shortcuts / disabled-date） */
/* -------------------------------------------------------------------------- */

function daysAgo(days: number): Date {
  const date = new Date()
  date.setTime(date.getTime() - 3600 * 1000 * 24 * days)
  return date
}

function rangeDaysAgo(days: number): [Date, Date] {
  const end = new Date()
  return [daysAgo(days), end]
}

/** 单个日期时间：今天 / 昨天 / 一周前（attributeRules、conditionOption） */
export const dateTimeShortcuts = [
  { text: '今天', value: () => new Date() },
  { text: '昨天', value: () => daysAgo(1) },
  { text: '一周前', value: () => daysAgo(7) },
]

/** 日期区间：最近一周 / 最近一个月 / 最近三个月（behaviorRules、sequenceRules、group-detail） */
export const rangeShortcuts = [
  { text: '最近一周', value: () => rangeDaysAgo(7) },
  { text: '最近一个月', value: () => rangeDaysAgo(30) },
  { text: '最近三个月', value: () => rangeDaysAgo(90) },
]

/** 日期区间：近一周 ~ 近一年（group-detail-dialog） */
export const historyRangeShortcuts = [
  { text: '近一周', value: () => rangeDaysAgo(7) },
  { text: '近一个月', value: () => rangeDaysAgo(30) },
  { text: '近三个月', value: () => rangeDaysAgo(90) },
  { text: '近六个月', value: () => rangeDaysAgo(180) },
  { text: '近一年', value: () => rangeDaysAgo(365) },
]

/** 不能选未来（group-detail-dialog 的 disabledDate） */
export function disabledFutureDate(date: Date): boolean {
  const today = new Date()
  return date.getTime() > today.getTime()
}

/** v2 `utils/format.js` 的 datePickerDay：不能选未来 + 七个快捷项（filterBar） */
export const datePickerDayShortcuts = [
  { text: '今天', value: () => new Date() },
  { text: '昨天', value: () => daysAgo(1) },
  { text: '一周前', value: () => daysAgo(7) },
  { text: '近一个月', value: () => daysAgo(30) },
  { text: '近三个月', value: () => daysAgo(90) },
  { text: '近六个月', value: () => daysAgo(180) },
  { text: '近一年', value: () => daysAgo(365) },
]

export function datePickerDayDisabled(time: Date): boolean {
  return time.getTime() > Date.now()
}

/** 今天（YYYY-MM-DD），替代 v2 的 moment().format("YYYY-MM-DD") */
export function todayYMD(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** N 天前（YYYY-MM-DD），替代 v2 的 moment().subtract(n, "days") */
export function ymdDaysAgo(days: number): string {
  const d = daysAgo(days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
