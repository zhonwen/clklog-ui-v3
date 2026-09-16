import type { CSSProperties } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import router from '@/router'

export const hideSidebarPathNames = ['userInfo']

/**
 * 把 route.query 上的值规整成字符串。
 * vue-router 的 query 值类型是 `string | null | (string | null)[]`，
 * 直接赋给业务参数会有类型错误，数组时取第一个（与 v2 直接用 this.$route.query.x 的实际取值一致）。
 */
export function queryToString(val: unknown): string {
  if (Array.isArray(val)) {
    const first = val[0]
    return typeof first === 'string' ? first : ''
  }
  return typeof val === 'string' ? val : ''
}

/**
 * 在新标签页打开路由（用户信息详情页）。
 * 会自动带上 _from，详情页的「返回来源页」靠它（对齐 v2 utils/index.js 的同名函数）。
 */
export function openNewTab(location: { name?: string; path?: string; query?: Record<string, unknown> }) {
  if (!location) return
  const fromPath = router.currentRoute.value?.fullPath || ''
  const query: Record<string, unknown> = { ...(location.query || {}) }
  if (!query._from) query._from = fromPath
  const route = router.resolve({ ...location, query } as RouteLocationRaw)
  const base = `${window.location.origin}${window.location.pathname}`
  window.open(`${base}${route.href}`, '_blank')
}

export function debounce<Args extends unknown[], R>(
  func: (...args: Args) => R,
  wait: number,
  immediate?: boolean,
) {
  let timeout: ReturnType<typeof setTimeout> | null = null
  let timestamp = 0
  let result: R | undefined
  // 必须记最后一次调用的参数：v2 用的是 lodash.debounce，执行时取的是最新实参。
  // 若在这里闭包捕获首次调用的 args，筛选栏「省份 → 国家」这种同一轮内先后变化的字段会丢掉后一次的值。
  let lastArgs: Args

  const later = function () {
    const last = Date.now() - timestamp
    if (last < wait && last > 0) {
      timeout = setTimeout(later, wait - last)
    } else {
      timeout = null
      if (!immediate) {
        result = func(...lastArgs)
      }
    }
  }

  const debounced = function (...args: Args) {
    lastArgs = args
    timestamp = Date.now()
    const callNow = immediate && !timeout
    if (!timeout) timeout = setTimeout(later, wait)
    if (callNow) {
      result = func(...args)
    }
    return result
  }

  /**
   * 取消尚未触发的那一次调用。
   * 组件卸载时必须调用，否则延迟回调会去写已卸载组件的 ref / emit 事件，
   * 触发「已卸载组件的更新」，进而在 nextTick flush 时报错并打断路由导航。
   */
  debounced.cancel = () => {
    if (timeout) clearTimeout(timeout)
    timeout = null
  }

  return debounced
}

/**
 * el-table 的 cell-style 生成器（对齐 v2 utils/index.js 的同名函数）。
 * v2 返回的是 "text-align: left" 这样的字符串，element-plus 会对返回值做 Object.assign，
 * 字符串会被展开成 {0:'t',1:'e'...} 并报 Failed to set an indexed property on CSSStyleDeclaration，
 * 所以这里统一返回 CSSProperties 对象，语义与 v2 完全一致。
 */
export function makeTableCellCenterByIndex(
  centerIdx: number[] = [],
  leftIdx: number[] = [],
): (args: { columnIndex: number }) => CSSProperties {
  const centerList = Array.isArray(centerIdx) ? centerIdx.slice() : [centerIdx]
  const leftList = Array.isArray(leftIdx) ? leftIdx.slice() : [leftIdx]
  return ({ columnIndex }: { columnIndex: number }) => {
    if (centerList.includes(columnIndex)) {
      return { textAlign: 'center' }
    } else if (leftList.includes(columnIndex)) {
      return { textAlign: 'left' }
    } else {
      return { textAlign: 'center' }
    }
  }
}

/**
 * 时间格式化（对齐 v2 utils/index.js 的同名函数）。
 * 与 v3 utils/date.ts 的 formatDateHMS 不同：这里会把纯数字字符串按时间戳解析、
 * 把 '-' 换成 '/' 以兼容 Safari、并把 10 位秒级时间戳乘 1000，语义必须保持 v2 的。
 */
export function parseTime(
  time: Date | string | number | null | undefined,
  cFormat?: string,
): string | null {
  if (time === undefined || !time) {
    return null
  }
  const format = cFormat || '{y}-{m}-{d} {h}:{i}:{s}'
  let date: Date
  if (typeof time === 'object') {
    date = time
  } else {
    let t: string | number = time
    if (typeof t === 'string') {
      if (/^[0-9]+$/.test(t)) {
        // support "1548221490638"
        t = parseInt(t)
      } else {
        // support safari
        // https://stackoverflow.com/questions/4310953/invalid-date-in-safari
        t = t.replace(new RegExp(/-/gm), '/')
      }
    }
    if (typeof t === 'number' && t.toString().length === 10) {
      t = t * 1000
    }
    date = new Date(t)
  }
  const formatObj: Record<string, number> = {
    y: date.getFullYear(),
    m: date.getMonth() + 1,
    d: date.getDate(),
    h: date.getHours(),
    i: date.getMinutes(),
    s: date.getSeconds(),
    a: date.getDay(),
  }
  return format.replace(/{([ymdhisa])+}/g, (result: string, key: string) => {
    const value = formatObj[key]
    if (value === undefined) return result
    // Note: getDay() returns 0 on Sunday
    if (key === 'a') {
      return ['日', '一', '二', '三', '四', '五', '六'][value] || ''
    }
    return value.toString().padStart(2, '0')
  })
}

/**
 * 用户属性值展示格式化（对齐 v2 utils/index.js 的同名函数）。
 * 数组 / 数组字符串拼「，」，带连字符的日期串按日期格式化，
 * 纯数字只有在字段名含「时间 / 日期」时才当时间戳，避免把 ID 当时间。
 */
export function formatUserPropValueByKey(key: unknown, value: unknown): string {
  const toDateYMD = (v: string | number) => {
    try {
      return parseTime(v, '{y}-{m}-{d} {h}:{i}:{s}') || '--'
    } catch {
      return '--'
    }
  }
  const isDateKey = /时间|日期/i.test(String(key || ''))
  if (Array.isArray(value)) {
    const arr = value
      .map((v) => (v === null || v === undefined ? '' : String(v).trim()))
      .filter((v) => v)
    return arr.length ? arr.join('，') : '--'
  }
  if (typeof value === 'string') {
    const s = value.trim()
    // 可能是数组字符串
    if (s.startsWith('[') && s.endsWith(']')) {
      try {
        const arr: unknown = JSON.parse(s)
        if (Array.isArray(arr)) {
          const list = arr
            .map((v) => (v === null || v === undefined ? '' : String(v).trim()))
            .filter((v) => v)
          return list.length ? list.join('，') : '--'
        }
      } catch {
        // fallthrough
      }
    }
    // 日期字符串：带连字符的日期
    const isDashedDate = /^\d{4}-\d{1,2}-\d{1,2}(?:\s+\d{2}:\d{2}:\d{2})?$/.test(s)
    // 纯数字时间戳：仅当字段名为日期/时间时才转换，避免误把 ID 当时间
    const isPureTs = isDateKey && /^\d{10,13}$/.test(s)
    if (isDashedDate || isPureTs) {
      return toDateYMD(s)
    }
    return s || '--'
  }
  // 数字的时间戳
  if (typeof value === 'number') {
    const isTs = isDateKey && (String(value).length === 10 || String(value).length === 13)
    if (isTs) {
      return toDateYMD(value)
    }
  }
  return value === null || value === undefined ? '--' : String(value)
}
