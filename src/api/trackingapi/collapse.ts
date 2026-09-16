import request from '@/utils/request'

/** 崩溃流量概览（页面顶部「流量概览」一行汇总） */
export function totalSummaryApi(params: Record<string, unknown>) {
  return request({
    url: '/appCrashed/totalSummary',
    method: 'post',
    data: params,
  })
}

/** 分页获取崩溃数据（崩溃日志列表） */
export function getPageApi(params: Record<string, unknown>) {
  return request({
    url: '/appCrashed/getPage',
    method: 'post',
    data: params,
  })
}

/** 获取崩溃分组数据（数据汇总 tab，不分页） */
export function groupedSummaryApi(params: Record<string, unknown>) {
  return request({
    url: '/appCrashed/groupedSummary',
    method: 'post',
    data: params,
  })
}

/** 获取崩溃趋势数据（崩溃率折线图） */
export function trendSummaryApi(params: Record<string, unknown>) {
  return request({
    url: '/appCrashed/trendSummary',
    method: 'post',
    data: params,
  })
}

/** 获取崩溃分组数据（设备型号弹窗里的「崩溃设备数据汇总」，分页） */
export function getPagedSummaryApi(params: Record<string, unknown>) {
  return request({
    url: '/appCrashed/getPagedSummary',
    method: 'post',
    data: params,
  })
}
