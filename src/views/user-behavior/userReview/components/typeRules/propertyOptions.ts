import type { OptionDef } from '@/utils/modelOptions/custom'

/**
 * 用户复查专用的判等条件（对应 v2 .../typeRules/propertyOptions.js）。
 *
 * 与 v2 一致（v2 此处逻辑存疑：文件顶部 import 了 attr_string / attr_number / attr_boolean /
 * attr_dateTime / attr_list 并建了 typeOptionsMap，getOptionsByType 里按类型取值的整段实现
 * 也全被注释掉了，最后无条件 `return defaultOptions` —— 也就是说无论属性是什么类型，
 * 下拉里永远只有「属于 isSet」一项。这里照搬这个行为，不再搬运没用到的 import 和 map）。
 */

const defaultOptions: OptionDef[] = [
  { displayName: '属于', name: 'isSet' },
  // { displayName: "属于", name: "belone" },
  // { displayName: "不属于", name: "noBelone" },
]

/** 通用获取方法：入参 type 保留签名，但与 v2 一样被忽略 */
export function getOptionsByType(_type?: string | null): OptionDef[] {
  void _type
  return defaultOptions
}
