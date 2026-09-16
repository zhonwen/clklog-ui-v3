export function formatDate(date: Date) {
  return (
    date.getFullYear() +
    '-' +
    (date.getMonth() + 1 < 10 ? '0' + (date.getMonth() + 1) : date.getMonth() + 1) +
    '-' +
    (date.getDate() < 10 ? '0' + date.getDate() : date.getDate())
  )
}

export function formatTime(seconds: number) {
  if (!seconds) return '--'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds - hours * 3600) / 60)
  const rest = seconds - hours * 3600 - minutes * 60
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n))
  return `${pad(hours)}:${pad(minutes)}:${pad(rest)}`
}

/**
 * 格式化占用空间（v2 src/filters/index.js 的 conver 过滤器，sys-log 页在用）。
 * 与 v2 一致（v2 此处逻辑存疑：小数位为 "00" 时用 substr(len + 3, 2) 拼单位，
 * 只有两位的单位 KB/MB/GB 才能拼回来；单位是 1 个字符的 "B" 会被整个丢掉，
 * 例如 5 字节 -> "5" 而不是 "5B"）。
 */
export function conver(limit: number | null | undefined): string {
  if (limit) {
    let size = ''
    if (limit < 0.1 * 1024) {
      // 如果小于0.1KB转化成B
      size = limit.toFixed(2) + 'B'
    } else if (limit < 0.1 * 1024 * 1024) {
      // 如果小于0.1MB转化成KB
      size = (limit / 1024).toFixed(2) + 'KB'
    } else if (limit < 0.1 * 1024 * 1024 * 1024) {
      // 如果小于0.1GB转化成MB
      size = (limit / (1024 * 1024)).toFixed(2) + 'MB'
    } else {
      // 其他转化成GB
      size = (limit / (1024 * 1024 * 1024)).toFixed(2) + 'GB'
    }
    const sizestr = size + ''
    const len = sizestr.indexOf('.')
    // v2 用的是 substr(len + 1, 2) / substr(len + 3, 2)，这里换成等价的 slice（substr 已废弃）
    const dec = sizestr.slice(len + 1, len + 3)
    if (dec == '00') {
      // 当小数点后为00时 去掉小数部分
      return sizestr.substring(0, len) + sizestr.slice(len + 3, len + 5)
    }
    return sizestr
  }
  return '--'
}

/**
 * 大数字转「万 / 亿」（v2 src/filters/index.js 的 formatNumber 过滤器）。
 * 与 v2 一致（v2 此处逻辑存疑：number 恰好等于 100000000 时两个分支都不命中，
 * 返回 undefined，模板上会渲染成空白）。
 */
export function formatNumber(number: number | null | undefined): string | number | undefined {
  if (!number && number != 0) {
    return '--'
  } else if (number == 0) {
    return 0
  }
  if (number < 10000) {
    return number.toString()
  }
  if (number < 100000000) {
    return (number / 10000).toFixed(2) + '万'
  }
  if (number > 100000000) {
    return (number / 100000000).toFixed(2) + '亿'
  }
  return undefined
}

/**
 * 数据格式识别（v2 filters/index.js 的 foramtDataValue，函数名的拼写错误沿用 v2）。
 * 只把字符串 'null' / 'NULL' / 'undefined' 归一成空串，其余原样返回。
 */
export function foramtDataValue(value: unknown): unknown {
  if (value === true) {
    return true
  } else if (value === false) {
    return false
  } else if (value === '') {
    return ''
  } else if (value === 0) {
    return 0
  } else if (value === 'null' || value === 'NULL' || value === 'undefined') {
    return ''
  } else {
    return value // 或者根据需求返回其他默认值
  }
}

/** v2 src/filters/index.js 的 isNoFilter 过滤器：布尔值 -> 是/否 */
export function isNoFilter(val: boolean | null | undefined): string {
  if (val) {
    return '是'
  } else if (val == false) {
    return '否'
  } else {
    return ''
  }
}

/** v2 src/filters/index.js 的 isNoFilterShow 过滤器：布尔值 -> 显示/隐藏 */
export function isNoFilterShow(val: boolean | null | undefined): string {
  if (val) {
    return '显示'
  } else if (val == false) {
    return '隐藏'
  } else {
    return ''
  }
}

/**
 * v2 src/filters/index.js 的 filterText 过滤器：属性数据类型 -> 中文。
 * 与 v2 一致（v2 此处逻辑存疑：switch 没有 default 分支，未知类型返回 undefined，模板上渲染为空）。
 */
export function filterText(val: string | null | undefined): string | undefined {
  switch (val) {
    case 'STRING':
      return '文本'
    case 'NUMBER':
      return '数值'
    case 'DATETIME':
      return '时间'
    case 'BOOL':
      return '是非'
    case 'LIST':
      return 'LIST'
  }
  return undefined
}
