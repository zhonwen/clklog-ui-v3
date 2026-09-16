import { getCurrentInstance, onBeforeUnmount } from 'vue'

/**
 * 只认「最后一次发出、且组件还活着」的请求。
 *
 * 两件事：
 *
 * 1. 请求乱序。首页各卡片都是「筛选条一变就重新发请求，谁后回来谁写入」。
 *    先发的请求如果更慢（比如先选本月、再切今日，月查询耗时更长），
 *    旧响应会覆盖新数据；先回来的那个还会提前把 loading 关掉。
 *
 * 2. 卸载后回填。离开首页时组件已经卸载，在途请求回来仍会写 ref，
 *    触发一次「已卸载组件的更新」。这个错误会在 nextTick flush 时抛出，
 *    而 vue-router 的 finalizeNavigation → handleScroll 正好在等 nextTick，
 *    于是被导航的 promise 链捕获，表现为
 *      Uncaught error during route navigation
 *      TypeError: Cannot read properties of null (reading 'type')
 *    —— 看起来像路由的问题，实际是组件更新的问题。
 *
 * 用法：
 *   const { next, isLatest } = useLatestOnly()
 *   function load() {
 *     const token = next()
 *     api().then((res) => { if (!isLatest(token)) return; ... })
 *   }
 */
export function useLatestOnly() {
  let seq = 0
  let alive = true

  // 允许在组件外调用（单测等），此时没有卸载时机，始终视为存活
  if (getCurrentInstance()) {
    onBeforeUnmount(() => {
      alive = false
    })
  }

  return {
    next: () => ++seq,
    isLatest: (token: number) => alive && token === seq,
  }
}
