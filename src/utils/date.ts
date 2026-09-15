/**
 * 日期工具。
 *
 * 从 v2 的 src/filters 迁过来，只保留当前真正在用的函数并补上类型。
 * 原 src/utils/filters.ts 是 621 行 `@ts-nocheck` 的 JS 原样搬运，33 个导出里只有
 * 这 6 个被引用，且 formatTime / percentage / averageRules 与 utils/format.ts、
 * utils/percent.ts 重复实现。需要别的函数时从 v2 单独迁、单独补类型，不要整文件复制。
 */

/** Date → 'YYYY-MM-DD' */
export function formatDateYMD(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** 今天，'YYYY-MM-DD' */
export function formatDateToday(): string {
  return formatDateYMD(new Date())
}

/** 今天，'YYYY-MM-DD'（与 formatDateToday 同义，保留 v2 的调用名） */
export function todateFunc(): string {
  return formatDateYMD(new Date())
}

/** 时间戳 → 'YYYY-MM-DD' */
export function timeStampFunc(timestamp: number): string {
  return formatDateYMD(new Date(timestamp))
}

/** 往前数 weeksAgo 周所在那一周的周一，'YYYY-MM-DD' */
export function getMondayOfPreviousWeeks(weeksAgo: number): string {
  const today = new Date()
  const dayOfWeek = today.getDay()
  // 把周日（0）折算成一周的第 7 天，使周一为一周起点
  const daysSinceMonday = (dayOfWeek + 6) % 7
  const monday = new Date(
    today.getTime() - (daysSinceMonday + weeksAgo * 7) * 24 * 60 * 60 * 1000,
  )
  return formatDateYMD(monday)
}

/** 往前数 monthsAgo 个月的 1 号，'YYYY-MM-DD' */
export function getFirstDayOfMonths(monthsAgo: number): string {
  const today = new Date()
  return formatDateYMD(new Date(today.getFullYear(), today.getMonth() - monthsAgo, 1))
}
