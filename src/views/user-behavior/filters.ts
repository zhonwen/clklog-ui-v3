/**
 * user-behavior 模块内用到的 v2 全局过滤器（src/filters/index.js）。
 *
 * 之所以放在模块内而不是 @/utils/percent：v2 的 filters 版本与 utils 版本同名但实现不同，
 * 混进 utils 容易被误用。这里只搬本模块模板里实际出现过的两个管道，语义与 v2 完全一致。
 */

/**
 * v2 filters/index.js 的 toFixedPoint：入参已经是百分数（0~100），只补两位小数和百分号。
 * 忠诚度分析的「所占比列」列用的就是它。
 * 与 v2 一致（v2 此处逻辑存疑：0 会走 falsy 分支返回 "0%"，而 100 直接返回 "100%" 不带小数）。
 */
export function toFixedPoint(s: number | string | null | undefined): string {
  if (s == 100) return '100%'
  if (s) {
    return (Number(s) * 1).toFixed(2) + '%'
  }
  return 0 + '%'
}

/**
 * v2 filters/index.js 的 percenTableNull：入参是比例（0~1），转百分数。
 * 留存/流失矩阵的单元格用它。与同名的 utils/percent.percentage 的区别是
 * 0 返回 "0.00%"（而不是 "--"），空值返回空串（而不是 "--"）。
 */
export function percenTableNull(s: number | string | null | undefined): string {
  if (s == 1) return '100%'
  if (s || s == 0) {
    return (Number(s) * 100).toFixed(2) + '%'
  }
  return ''
}
