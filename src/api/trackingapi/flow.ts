import request from '@/utils/request'

export function getFlowApi(params: Record<string, unknown>) {
  return request({ url: '/flow/getFlow', method: 'post', data: params })
}

export function getFlowTrendApi(params: Record<string, unknown>) {
  return request({ url: '/flow/getFlowTrend', method: 'post', data: params })
}
