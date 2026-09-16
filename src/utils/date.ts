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

/**
 * 以 dateString 为基准，往前 12 个月的那个月 1 号，'YYYY-MM-DD'。
 * 从 v2 filters/index.js 的 getTwelveMonthsAgoFirstDay 原样迁入（领导驾驶舱按月区间用）。
 */
export function getTwelveMonthsAgoFirstDay(dateString: string): string {
  const currentDate = new Date(dateString)
  const currentYear = currentDate.getFullYear()
  const currentMonth = currentDate.getMonth() + 1
  // 减 1 年即 12 个月前，月份不变
  const twelveMonthsAgoDate = new Date(currentYear - 1, currentMonth - 1, 1)
  return formatDateYMD(twelveMonthsAgoDate)
}

/**
 * 以 dateString 所在周的周一为基准再往前 77 天（共 12 周）的那个周一。
 * 从 v2 filters/index.js 的 get3WeekdaysFromDate 原样迁入（函数名与实际语义不符，v2 如此）。
 */
export function get3WeekdaysFromDate(dateString: string): Date {
  const currentDate = new Date(dateString)
  const currentDayOfWeek = currentDate.getDay()
  const daysUntilPreviousMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1
  const previousMonday = new Date(currentDate)
  previousMonday.setDate(previousMonday.getDate() - daysUntilPreviousMonday)
  const thirdWeekPreviousMonday = new Date(previousMonday)
  thirdWeekPreviousMonday.setDate(thirdWeekPreviousMonday.getDate() - 77)
  return thirdWeekPreviousMonday
}

/**
 * 以 dateString 为基准往前 29 天（含当天共 30 天），'YYYY-MM-DD'。
 * 从 v2 filters/index.js 的 getThirtyDaysAgo 原样迁入。
 */
export function getThirtyDaysAgo(dateString: string): string {
  const currentDate = new Date(dateString)
  const thirtyDaysAgoDate = new Date(currentDate.getTime() - 29 * 24 * 60 * 60 * 1000)
  return formatDateYMD(thirtyDaysAgoDate)
}

/**
 * 时间戳 → 'YYYY-MM-DD HH:mm:ss'（v2 filters/index.js 的 formatDateHMS）。
 * 与 v2 一致：falsy 值原样返回（不是返回 '--'）。
 */
export function formatDateHMS(timestamp: number | string | null | undefined): string {
  if (!timestamp) {
    return timestamp as unknown as string
  }
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
}

/** 日期字符串 → 时间戳（v2 filters/index.js 的 dateTimeStringToTimestamp） */
export function dateTimeStringToTimestamp(dateTimeString: string): number {
  const date = new Date(dateTimeString)
  return date.getTime()
}

/**
 * 时间戳按位数归一到毫秒（v2 filters/index.js 里未导出的 normalizeTimestamp）。
 * 3~10 位当秒、11~13 位当毫秒、14~16 位当微秒、17~19 位当纳秒，其余 NaN。
 */
function normalizeTimestamp(timestamp: number | string): number {
  const timestampStr = String(timestamp).trim()
  // 非数字字符串直接返回无效标识
  if (!/^\d+$/.test(timestampStr)) {
    return NaN
  }

  const length = timestampStr.length
  const num = BigInt(timestampStr) // 使用 BigInt 避免大数字精度丢失

  // 根据位数判断时间单位并转换为毫秒
  if (length >= 3 && length <= 10) {
    // 3-10 位：秒级（v2 拆成 3-8 / 9 / 10 三个分支，结果完全相同，这里合并）
    return Number(num * 1000n)
  } else if (length >= 11 && length <= 13) {
    // 11-13 位：毫秒级（13 位是标准 JS 时间戳）
    return Number(num)
  } else if (length >= 14 && length <= 16) {
    // 14-16 位：微秒级
    return Number(num / 1000n)
  } else if (length >= 17 && length <= 19) {
    // 17-19 位：纳秒级
    return Number(num / 1000000n)
  }
  // 超出范围的视为无效
  return NaN
}

/**
 * 统一时间格式处理（v2 filters/index.js 的 filterTimeFormatUnified）。
 * 事件属性、用户属性的值类型不确定，这里统一按「时间戳 / ISO / YYYY-MM-DD[ HH:mm:ss]」识别，
 * 识别不了就原样转成字符串返回。
 */
export function filterTimeFormatUnified(value: unknown): string {
  // 处理空值情况
  if (value == null || value === 'null' || value === '') {
    return ''
  }

  // 工具函数：格式化日期为年月日时分秒（补零处理）
  const formatDateTime = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
  }

  // 工具函数：格式化日期为年月日（补零处理）
  const formatDatePart = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // 1. 处理时间戳（数字或数字字符串）
  if (
    (typeof value === 'number' && Number.isInteger(value)) ||
    (typeof value === 'string' && /^\d+$/.test(value))
  ) {
    try {
      const normalizedTimestamp = normalizeTimestamp(value)
      if (isNaN(normalizedTimestamp)) {
        return String(value)
      }

      const date = new Date(normalizedTimestamp)
      if (isNaN(date.getTime())) {
        return String(value)
      }

      // 判断是否为纯日期（时分秒均为 0）
      const isPureDate =
        date.getHours() === 0 &&
        date.getMinutes() === 0 &&
        date.getSeconds() === 0 &&
        date.getMilliseconds() === 0

      return isPureDate ? formatDatePart(date) : formatDateTime(date)
    } catch (error) {
      console.warn('时间戳转换失败:', value, error)
      return String(value)
    }
  }

  // 2. 处理字符串格式
  if (typeof value === 'string') {
    const trimmedValue = value.trim()

    // 匹配 YYYY-MM-DD 纯日期格式
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
      const date = new Date(trimmedValue)
      if (!isNaN(date.getTime())) {
        return trimmedValue
      }
    }

    // 匹配带 T 分隔符的 ISO 格式（如 2025-03-28T17:57:09 或 2025-03-28T17:57:09.123Z）
    const isoFormatMatch = trimmedValue.match(/^(\d{4}-\d{2}-\d{2})T([\d:.]+)(Z|\+\d{2}:\d{2})?$/)
    if (isoFormatMatch) {
      const datePart = isoFormatMatch[1]
      // 移除毫秒部分（如果存在）
      const timePart = (isoFormatMatch[2] ?? '').split('.')[0]
      return `${datePart} ${timePart}`
    }

    // 匹配 YYYY-MM-DD 后面带时间的格式（如 2025-07-01 01:09:39）
    if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(trimmedValue)) {
      const date = new Date(trimmedValue)
      if (!isNaN(date.getTime())) {
        return trimmedValue
      }
    }

    // 匹配带毫秒的日期时间格式（如 2025-07-01 01:09:39.123）
    const msDateTimeMatch = trimmedValue.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\.\d+$/)
    if (msDateTimeMatch) {
      const matched = msDateTimeMatch[1] ?? ''
      const date = new Date(matched)
      if (!isNaN(date.getTime())) {
        return matched
      }
    }
  }

  // 无法识别的格式直接返回原始值的字符串形式
  return String(value)
}
