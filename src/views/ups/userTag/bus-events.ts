/**
 * userTag 模块用到的事件总线负载。
 *
 * v3 的 bus 是 mitt，**只能传一个参数**，而 v2 的 `$bus.$emit("$createMethod", val, formula, fromPage)`
 * 是三个参数，所以这里把它们合成一个对象。原负载顺序见 CreateMethodPayload 上的注释。
 */

import type { CategoryNode, TagFormula } from './types'

/** `$createMethod` 的负载。v2 原始签名：(val, formula, fromPage) */
export interface CreateMethodPayload {
  /** v2 参数 1：下标（createIndex，1~6） */
  createIndex: number | string
  /** v2 参数 2：模型（编辑/查看时是列表行，新建时是 ""） */
  formula: TagFormula | ''
  /** v2 参数 3：true / "creator" 表示走「新建」而不是「切换」 */
  fromPage?: string | boolean
}

/** `$categoryList` 的负载：v2 是单参数，原样传分类扁平列表 */
export type CategoryListPayload = CategoryNode[]

export const CREATE_METHOD = '$createMethod'
export const CATEGORY_LIST = '$categoryList'
