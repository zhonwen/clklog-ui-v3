/** 忠诚度分析五张表的行结构（接口返回的 key / value / rate） */
export interface LoyaltyRow {
  key?: string
  value?: number
  rate?: number
}

/**
 * 表格合计行。v2 的 visitPage / visitNum / visitTime / visitDepth / visitLastTime
 * 五个组件里各写了一份一模一样的 getSummaries，这里抽成一份共用，逻辑逐行照搬。
 *
 * 与 v2 一致（v2 此处逻辑存疑）：
 * - 第 0 列（序号）没有 property，values 全是 NaN，走 every(isNaN) 分支，合计留空；
 * - 第 1 列固定写死「当前汇总」并 return，不参与求和；
 * - 第 3 列（所占比列）先求了一次和，紧接着又被无条件覆盖成 "100%"。
 */
export function getSummaries(param: {
  // 只声明真正读到的字段，element-plus 的 TableColumnCtx<T> / T[] 都能结构化地对上
  columns: { property: string }[]
  data: LoyaltyRow[]
}): string[] {
  const { columns, data } = param
  const sums: string[] = []
  columns.forEach((column, index) => {
    if (index === 1) {
      sums[index] = '当前汇总'
      return
    }
    const values = data.map((item) =>
      Number((item as unknown as Record<string, unknown>)[column.property]),
    )
    if (!values.every((value) => isNaN(value))) {
      sums[index] = String(
        values.reduce((prev, curr) => {
          const value = Number(curr)
          if (!isNaN(value)) {
            return prev + curr
          } else {
            return prev
          }
        }, 0),
      )
    }
    if (index == 3) {
      sums[index] = '100%'
      return
    }
  })
  return sums
}
