export interface OptionItem<V = string | number | boolean> {
  value: V
  label: string
}

export const IDM_VERSION_OPTIONS: OptionItem[] = [
  { value: '1.0', label: '1.0' },
  { value: '2.0', label: '2.0' },
  { value: '3.0', label: '3.0' },
]

export const IDENTITY_CATEGORY_OPTIONS: OptionItem[] = [
  { value: 'DEVICE', label: '设备(DEVICE)' },
  { value: 'ECOSYSTEM', label: '生态(ECOSYSTEM)' },
  { value: 'BUSINESS', label: '业务(BUSINESS)' },
]

export const CONSTRAINT_TYPE_OPTIONS: OptionItem[] = [
  { value: 'SINGLE', label: '唯一(SINGLE)' },
  { value: 'MULTI', label: '多值(MULTI)' },
]

export const OVERFLOW_STRATEGY_OPTIONS: OptionItem[] = [
  { value: 'ROLLING_UNBIND', label: '滚动解绑(ROLLING_UNBIND)' },
  { value: 'BLOCK', label: '拒绝绑定(BLOCK)' },
]

export const MERGE_STRATEGY_OPTIONS: OptionItem[] = [
  { value: 'ALTER_UPDATE', label: 'ALTER_UPDATE' },
  { value: 'MERGE_MAP', label: 'MERGE_MAP' },
]

export const STATUS_OPTIONS: OptionItem<number>[] = [
  { value: 1, label: '启用' },
  { value: 0, label: '禁用' },
]

export const BOOLEAN_YES_NO_OPTIONS: OptionItem<boolean>[] = [
  { value: true, label: '是' },
  { value: false, label: '否' },
]

export const MERGE_REASON_OPTIONS: OptionItem[] = [
  { value: 'IDENTITY_CONFLICT', label: '身份冲突' },
  { value: 'ANO_CONFLICT', label: '匿名冲突' },
  { value: 'MANUAL', label: '人工合并' },
  { value: 'IDM_UPGRADE', label: 'IDM 升级' },
]

export const MERGE_STATUS_OPTIONS: OptionItem[] = [
  { value: 'SUCCESS', label: '成功' },
  { value: 'PARTIAL', label: '部分成功' },
  { value: 'FAILED', label: '失败' },
  { value: 'PENDING', label: '处理中' },
]

export const DETAIL_TYPE_OPTIONS: OptionItem[] = [
  { value: 'IDENTITY', label: '身份(IDENTITY)' },
  { value: 'ANO', label: '匿名(ANO)' },
  { value: 'LOGIN', label: '登录(LOGIN)' },
  { value: 'TRANSITIVE', label: '传递(TRANSITIVE)' },
]

export function labelOf<V>(options: OptionItem<V>[], value: V, fallback?: string): string {
  if (value === undefined || value === null || value === '') {
    return fallback !== undefined ? fallback : ''
  }
  const hit = options.find((item) => item.value === value)
  return hit ? hit.label : fallback !== undefined ? fallback : String(value)
}
