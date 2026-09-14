export const hideSidebarPathNames = ['userInfo']

export function debounce<Args extends unknown[], R>(
  func: (...args: Args) => R,
  wait: number,
  immediate?: boolean,
) {
  let timeout: ReturnType<typeof setTimeout> | null = null
  let timestamp = 0
  let result: R | undefined

  const later = function (context: unknown, args: Args) {
    const last = Date.now() - timestamp
    if (last < wait && last > 0) {
      timeout = setTimeout(() => later(context, args), wait - last)
    } else {
      timeout = null
      if (!immediate) {
        result = func.apply(context, args)
      }
    }
  }

  return function (this: unknown, ...args: Args) {
    timestamp = Date.now()
    const callNow = immediate && !timeout
    if (!timeout) timeout = setTimeout(() => later(this, args), wait)
    if (callNow) {
      result = func.apply(this, args)
    }
    return result
  }
}
