import type { OptionDef } from './custom'

/**
 * 漏斗分析的选项常量。
 * 取值、顺序、注释与 v2 的 src/utils/modelOptions/funnel.js 完全一致。
 */

/** 计算方式 */
export const calculation_method: OptionDef[] = [
  { displayName: '人数', name: 'UV' },
  { displayName: '次数', name: 'PV' },
]

/** 转换周期 */
export const conversion_cycle: OptionDef[] = [
  { displayName: '五分钟', name: '5MINUTE' },
  { displayName: '一小时', name: '1HOUR' },
  // 与 v2 一致：{ displayName: "当天", name: "0DAY" } 在 v2 里是注释掉的
  { displayName: '24小时', name: '24HOUR' },
  { displayName: '7天', name: '7DAY' },
  { displayName: '14天', name: '14DAY' },
  { displayName: '30天', name: '30DAY' },
  { displayName: '60天', name: '60DAY' },
  { displayName: '90天', name: '90DAY' },
  { displayName: '120天', name: '120DAY' },
  { displayName: '180天', name: '180DAY' },
]
