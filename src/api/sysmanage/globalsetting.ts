import request from '@/utils/requestManage'

/** 全局设置表单，字段与 v2 global-setting.vue 一致 */
export interface GlobalSetting {
  excludedIp?: string
  excludedUa?: string
  excludedUrlParams?: string
  searchwordKey?: string
  searchwordCategoryKey?: string
}

/** 日志统计，sys-log.vue 的两张表都用这组字段 */
export interface LogStat {
  logRecordCount?: number
  logSpaceSize?: number
  logLatestTime?: string
  logDays?: number
  dbRecordCount?: number
  dbSpaceSize?: number
  dbFirstTime?: string
  dbLatestTime?: string
}

export function saveSetting(params: Record<string, unknown>) {
  return request<GlobalSetting>({
    url: '/global/saveSetting',
    method: 'post',
    data: params,
  })
}

export function getSetting() {
  return request<GlobalSetting>({
    url: '/global/getSetting',
    method: 'post',
    data: {},
  })
}

export function getStat(params: Record<string, unknown>) {
  return request<LogStat>({
    url: '/global/getStat',
    method: 'post',
    data: params,
  })
}

export function getCaptchaImage(params: Record<string, unknown> = {}) {
  return request<{ img?: string; cid?: string; publicKey?: string }>({
    url: '/auth/getCaptchaImage',
    method: 'post',
    data: params,
  })
}
