export function percentage(s: number | string | null | undefined) {
  if (s) {
    if (s == 1) return '100%'
    return (Number(s) * 100).toFixed(2) + '%'
  }
  return '--'
}

export function percent(s: number | string | null | undefined) {
  if (s == 1) return '100%'
  if (s) return (Number(s) * 100).toFixed(2)
  return '--'
}

export function averageRules(num: number | null | undefined) {
  if (num && num % 1 !== 0) {
    const numAfterDot = num.toString().split('.')[1]
    if (!numAfterDot || parseInt(numAfterDot.substr(0, 4)) !== 0) {
      num = parseInt(String(num + 1), 10)
    } else {
      num = parseInt(String(num), 10)
    }
  }
  return num
}

/**
 * v2 filters 的 averageRulesTable：整数原样返回，非整数向上取整，falsy 返回 0。
 * 与同文件的 averageRules 规则不同（averageRules 是「小数点后四位不为 0 才进位」），
 * v2 里表格内单元格用 averageRulesTable、大数字用 averageRules，两个都要保留。
 */
export function averageRulesTable(num: number | null | undefined) {
  if (num) {
    if (Number.isInteger(num)) {
      return num
    }
    return Math.ceil(num)
  }
  return 0
}
