import request from '@/utils/request'

/**
 * 事件分析 / 日志分析相关接口。
 * 对照 v2 src/api/sysmanage/eventAnalysis.js，通道与 v2 一致：`@/utils/request`（api 通道）。
 * 这里只补 analysis-modules 事件分析、日志分析两个页面真正用到的函数。
 */

/** 分页获取事件分析数据 */
export function getEventListApi(params: Record<string, unknown>) {
  return request({ url: '/event/getEventList', method: 'post', data: params })
}

/**
 * 分页获取日志事件明细数据。
 * v2 的注释里留了旧地址 /event/getLogEventlList（拼写带多余的 l），实际生效的是下面这个。
 * 函数名保留 v2 的 getLogEventlListApi 拼写，便于与 v2 逐行对照。
 */
export function getLogEventlListApi(params: Record<string, unknown>) {
  return request({ url: '/event/getLogEventList', method: 'post', data: params })
}

/** 分页获取事件详情分析数据 */
export function getEventDetailListApi(params: Record<string, unknown>) {
  return request({ url: '/event/getEventDetailList', method: 'post', data: params })
}

/** 获取事件属性清单 */
export function getEventPropertyListApi(params: Record<string, unknown>) {
  return request({ url: '/event/getEventPropertyList', method: 'post', data: params })
}

/** 事件详情趋势数据 */
export function getEventDetailTrendApi(params: Record<string, unknown>) {
  return request({ url: '/event/getEventDetailTrend', method: 'post', data: params })
}
