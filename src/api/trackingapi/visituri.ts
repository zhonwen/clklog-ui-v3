import request from '@/utils/request'

export function getVisitUriApi(params: Record<string, unknown>) {
  return request({ url: '/visituri/getVisitUri', method: 'post', data: params })
}

/** 受访页面-流量概览（v2 api/trackingapi/visituri.js getVisitUriTotalApi） */
export function getVisitUriTotalApi(params: Record<string, unknown>) {
  return request({ url: '/visituri/getVisitUriTotal', method: 'post', data: params })
}

/** 结构化页面分析-树状结构（v2 getVisitUriPathTreeTotalApi） */
export function getVisitUriPathTreeTotalApi(params: Record<string, unknown>) {
  return request({ url: '/visituri/getVisitUriPathTreeTotal', method: 'post', data: params })
}

/** 单个受访页面访问统计数据（v2 getVisitOneUriTotalApi） */
export function getVisitOneUriTotalApi(params: Record<string, unknown>) {
  return request({ url: '/visituri/getVisitUriDetailTotal', method: 'post', data: params })
}

/** 单个受访页面访问趋势数据（v2 getVisitOneUriTrendApi） */
export function getVisitOneUriTrendApi(params: Record<string, unknown>) {
  return request({ url: '/visituri/getVisitUriDetailTrend', method: 'post', data: params })
}

/** 受访页面明细列表（v2 getVisitUriDetailApi） */
export function getVisitUriDetailApi(params: Record<string, unknown>) {
  return request({ url: '/visituri/getVisitUriDetailList', method: 'post', data: params })
}
