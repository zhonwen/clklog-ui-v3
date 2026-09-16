/**
 * 只认最后一次发出的请求。
 *
 * 首页各卡片都是「筛选条一变就重新发请求，谁后回来谁写入」。
 * 先发的请求如果更慢（比如先选本月、再切今日，月查询耗时更长），
 * 旧响应会覆盖新数据，出现标题是「今日」、数字却是本月的情况；
 * 先回来的那个还会提前把 loading 关掉。
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
  return {
    next: () => ++seq,
    isLatest: (token: number) => token === seq,
  }
}
