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
