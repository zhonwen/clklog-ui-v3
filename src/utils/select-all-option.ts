/**
 * 筛选下拉里「全部」选项的兼容处理。
 *
 * v2（element-ui）用的是 `{ value: '', label: '全部' }` + `ref('')`：
 * el-select 会按值匹配到该项，框里正常显示「全部」。
 *
 * element-plus **把空字符串当作「无值」**
 *（el-select 的 `hasModelValue` 判定里显式排除了 `''`），
 * 于是同样的写法只会显示占位符「请选择」——
 * 列表里明明有「全部」，却既选不中、也显示不出来。
 *
 * 这里用一个只存在于 UI 层的哨兵值顶替空串：
 *   - 渲染选项时用 `withAllOption()` 把 `''` 换成 `ALL_OPTION`
 *   - 组装接口参数时用 `toApiValue()` 换回 `''`
 *
 * 这样接口收到的参数与 v2 完全一致，只是界面上能正确显示并选中「全部」。
 *
 * 之所以不直接改各处的常量定义（up-manage.ts / usergroup/constants.ts 等），
 * 是因为那些常量还被别处当作接口取值直接使用，改源头会波及更大。
 */

/** 「全部」在 UI 层的取值。不要把它发给后端——先过一次 toApiValue() */
export const ALL_OPTION = 'all'

/**
 * 把选项列表里 value 为空串的那一项（即「全部」）换成哨兵值。
 * value 用 unknown 约束：元数据管理的筛选条里选项值是 `string | boolean` 混用的。
 */
export function withAllOption<T extends { value: unknown }>(list: readonly T[]): T[] {
  return list.map((item) => (item.value === '' ? { ...item, value: ALL_OPTION } : item))
}

/** 单个「全部」选项（部分筛选条是运行时 unshift 进列表的，不是写死的数组） */
export const allOption = { value: ALL_OPTION, label: '全部' }

/** 哨兵值 → 接口取值（「全部」对应空串），其余原样返回 */
export function toApiValue<T>(val: T): T | '' {
  return val === ALL_OPTION || val == null ? '' : val
}
