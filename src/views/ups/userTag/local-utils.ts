/**
 * 用户标签模块用到、但 v3 公共 utils 里还没有的小工具。
 *
 * v3 的 `src/utils/index.ts` / `format.ts` 是只读文件（其它并行任务在用），
 * 所以 v2 `utils/index.js` 的 handleTree / computedStyle / verificaRules /
 * isEmptyParams / weekOrMonthRangeList 和 `utils/format.js` 的 datePickerDay
 * 先落在本模块里，实现逐行对齐 v2。
 */

import type { ValueLabel } from '@/utils/modelOptions/up-manage'

/** handleTree 内部按字符串下标取值时用的形状 */
type TreeSource = Record<string, unknown>

/**
 * 扁平列表 → 树。与 v2 utils/index.js 的 handleTree 完全一致
 * （包括「就地给节点写 children」这一点：传进来的对象会被改）。
 *
 * 泛型不加约束，调用方直接传 interface 声明的节点类型即可
 * （约束成 Record<string, unknown> 的话 interface 传不进来，没有隐式索引签名）。
 */
export function handleTree<T>(
  data: T[],
  id?: string,
  parentId?: string,
  children?: string,
): T[] {
  const config = {
    id: id || 'id',
    parentId: parentId || 'parentId',
    childrenList: children || 'children',
  }

  const read = (o: T) => o as unknown as TreeSource

  const childrenListMap: Record<string, T[]> = {}
  const nodeIds: Record<string, T> = {}
  const tree: T[] = []

  for (const d of data) {
    const pid = String(read(d)[config.parentId])
    if (childrenListMap[pid] == null) {
      childrenListMap[pid] = []
    }
    nodeIds[String(read(d)[config.id])] = d
    childrenListMap[pid]?.push(d)
  }

  for (const d of data) {
    const pid = String(read(d)[config.parentId])
    if (nodeIds[pid] == null) {
      tree.push(d)
    }
  }

  function adaptToChildrenList(o: T) {
    const key = String(read(o)[config.id])
    if (childrenListMap[key] !== null) {
      read(o)[config.childrenList] = childrenListMap[key]
    }
    const list = read(o)[config.childrenList] as T[] | undefined
    if (list) {
      for (const c of list) {
        adaptToChildrenList(c)
      }
    }
  }

  for (const t of tree) {
    adaptToChildrenList(t)
  }
  return tree
}

/** computedStyle 的返回值：命中校验失败时给一个红框 */
export interface ErrorBorderStyle {
  border: string
  borderRadius: string
}

/**
 * 校验样式。与 v2 utils/index.js 的 computedStyle 一致：
 * 只有在 Valid.isValid 为真（= 点过保存）时才对空值标红。
 */
export function computedStyle(
  value: unknown,
  valid?: { isValid?: boolean } | null,
): ErrorBorderStyle | undefined {
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

/**
 * 校验规则：返回该 function 需要几个 params。
 * 与 v2 utils/index.js 的 verificaRules 一致。
 */
export function verificaRules(type?: string | null): number {
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
 * 判断参数是否是空值。与 v2 一致
 * （v2 此处逻辑存疑：不为空时返回的是 undefined 而不是 false，
 *  调用方都是 if (isEmptyParams(x)) 所以行为一致，这里照迁并显式写成 boolean）
 */
export function isEmptyParams(params: unknown): boolean {
  if (
    params == '' ||
    params == null ||
    params == undefined ||
    (Array.isArray(params) && params.length == 0)
  ) {
    return true
  }
  return false
}

/** 更新周期为「周」/「月」时的可选日期列表。与 v2 一致（月固定 31 天） */
export function weekOrMonthRangeList(val?: string | null): ValueLabel<number>[] {
  const dateRangeList: ValueLabel<number>[] = []
  if (val === '周') {
    const daysOfWeek = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    daysOfWeek.forEach((day, index) => {
      dateRangeList.push({
        value: index + 1,
        label: day,
      })
    })
  } else if (val === '月') {
    // const now = new Date();
    // const year = now.getFullYear();
    // const month = now.getMonth() + 1;
    // const daysInMonth = new Date(year, month, 0).getDate();
    const daysInMonth = 31
    for (let day = 1; day <= daysInMonth; day++) {
      dateRangeList.push({
        value: day,
        label: day.toString() + '号',
      })
    }
  }
  return dateRangeList
}

/** element-plus 日期控件的快捷项 */
export interface DateShortcut {
  text: string
  value: () => Date | [Date, Date]
}

function daysAgo(days: number) {
  const date = new Date()
  date.setTime(date.getTime() - 3600 * 1000 * 24 * days)
  return date
}

function rangeDaysAgo(days: number): [Date, Date] {
  const end = new Date()
  const start = daysAgo(days)
  return [start, end]
}

/**
 * 单个日期的快捷项 + 禁用未来。
 * 对应 v2 utils/format.js 的 datePickerDay()（picker-options 在 element-plus
 * 里拆成了 :shortcuts 与 :disabled-date 两个属性）。
 */
export const datePickerDayShortcuts: DateShortcut[] = [
  { text: '今天', value: () => new Date() },
  { text: '昨天', value: () => daysAgo(1) },
  { text: '一周前', value: () => daysAgo(7) },
  { text: '近一个月', value: () => daysAgo(30) },
  { text: '近三个月', value: () => daysAgo(90) },
]

/** 禁用今天之后的日期 */
export function disabledFutureDate(time: Date) {
  return time.getTime() > Date.now()
}

/** 条件面板里「绝对时间」用的三个快捷项（v2 各 basicRules / conditionOption 里那份） */
export const conditionDayShortcuts: DateShortcut[] = [
  { text: '今天', value: () => new Date() },
  { text: '昨天', value: () => daysAgo(1) },
  { text: '一周前', value: () => daysAgo(7) },
]

/** 日期区间快捷项（各 basicRules 的 daterange） */
export const rangeShortcuts: DateShortcut[] = [
  { text: '最近一周', value: () => rangeDaysAgo(7) },
  { text: '最近一个月', value: () => rangeDaysAgo(30) },
  { text: '最近三个月', value: () => rangeDaysAgo(90) },
]

/** 标签详情弹窗的日期区间快捷项 */
export const detailRangeShortcuts: DateShortcut[] = [
  { text: '近一周', value: () => rangeDaysAgo(7) },
  { text: '近一个月', value: () => rangeDaysAgo(30) },
  { text: '近三个月', value: () => rangeDaysAgo(90) },
  { text: '近六个月', value: () => rangeDaysAgo(180) },
  { text: '近一年', value: () => rangeDaysAgo(365) },
]

/**
 * 随机 key。对应 v2 filters/index.js 的 createUniqueString，
 * v2 各组件通过 `this.$options.filters.createUniqueString()` 调它，
 * 拿来当 el-cascader 的 :key 强制重建。
 */
export function createUniqueString(): string {
  const randomBytes = new Uint8Array(4)
  window.crypto.getRandomValues(randomBytes)
  let randomNumber = 0
  for (let i = 0; i < randomBytes.length; i++) {
    randomNumber += (randomBytes[i] ?? 0) * Math.pow(256, i)
  }
  return String(randomNumber)
}

/** A、B、C...（v2 各组件里重复定义的 getLetterByIndex） */
export function getLetterByIndex(index: number): string {
  if (index < 0 || index >= 26) {
    return String.fromCharCode(65 + (index % 26))
  }
  return String.fromCharCode(65 + index) // 65 是大写字母 A 的 ASCII 编码
}

/** a、b、c...（v2 各组件里重复定义的 getLetterLowercase） */
export function getLetterLowercase(index: number): string {
  if (index < 0 || index >= 26) {
    return String.fromCharCode(97 + (index % 26))
  }
  return String.fromCharCode(97 + index)
}

/**
 * 严格检验字段模式：取 options[0][label]，空则返回 ""（v2 各组件里重复定义的 strictMode）。
 * 约束写 `T extends object` 而不是 `Record<string, unknown>`：后者接不住 interface
 * 声明的类型（比如 custom.ts 的 OptionDef），interface 没有隐式索引签名。
 */
export function strictMode<T extends object, K extends keyof T & string>(
  val: T[] | '' | null | undefined,
  label: K,
): string {
  if (val && val.length > 0) {
    return String(val[0]?.[label] ?? '')
  } else {
    return ''
  }
}

/**
 * 判断是否展示「值输入框」。与 v2 各组件里那份 filterIstrue 完全一致
 * （这些 function 自己会渲染专用控件，不需要通用输入框）。
 */
export function filterIstrue(item?: string | null): boolean {
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

/** "2024-01-01~2024-01-08" → ["2024-01-01", "2024-01-08"]，没有 ~ 返回 null */
export function splitDateRange(dateRange: string): string[] | null {
  if (dateRange.includes('~')) {
    return dateRange.split('~')
  }
  return null // 如果没有 '~'，返回 null 或其他你想返回的值
}

/** 允许 YYYY-M-D 或 YYYY-MM-DD，分隔符为 - 或 / */
export function isValidDateStr(str: string): boolean {
  const reg = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/
  if (!reg.test(str)) return false
  const d = new Date(str.replace(/-/g, '/')) // 兼容 Safari
  return !isNaN(d.getTime())
}

/** 今天（YYYY-MM-DD）—— 替代 v2 的 moment().format("YYYY-MM-DD") */
export function todayYMD(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** N 天前（YYYY-MM-DD）—— 替代 v2 的 moment().subtract(n, "days") */
export function daysAgoYMD(days: number): string {
  return todayYMD(daysAgo(days))
}
