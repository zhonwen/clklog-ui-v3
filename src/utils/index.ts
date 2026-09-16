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
