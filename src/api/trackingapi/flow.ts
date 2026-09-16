import request from '@/utils/request'

export function getFlowApi(params: Record<string, unknown>) {
  return request({ url: '/flow/getFlow', method: 'post', data: params })
}

export function getFlowTrendApi(params: Record<string, unknown>) {
  return request({ url: '/flow/getFlowTrend', method: 'post', data: params })
}

/** 按时间粒度取流量明细（实时访问的折线图用，传 previousHour + timeType） */
export function getFlowDetailApi(params: Record<string, unknown>) {
  return request({ url: '/flow/getFlowDetail', method: 'post', data: params })
}

/** 取最近 n 分钟的合计数据（实时访问顶部「近半小时」用，传 previousMin） */
export function getFlowPreviousMinTotalApi(params: Record<string, unknown>) {
  return request({ url: '/flow/getFlowPreviousMinTotal', method: 'post', data: params })
}
