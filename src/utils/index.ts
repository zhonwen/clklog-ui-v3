export const hideSidebarPathNames = ['userInfo']

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

  return function (...args: Args) {
    lastArgs = args
    timestamp = Date.now()
    const callNow = immediate && !timeout
    if (!timeout) timeout = setTimeout(later, wait)
    if (callNow) {
      result = func(...args)
    }
    return result
  }
}
