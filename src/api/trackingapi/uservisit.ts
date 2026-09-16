import request from '@/utils/request'

/** 获取访问频次（v2 api/trackingapi/uservisit.js getUserVisitApi） */
export function getUserVisitApi(params: Record<string, unknown>) {
  return request({ url: '/uservisit/getUserVisit', method: 'post', data: params })
}

/** 获取访问时长（v2 getUserVisitTimeApi） */
export function getUserVisitTimeApi(params: Record<string, unknown>) {
  return request({ url: '/uservisit/getUserVisitTime', method: 'post', data: params })
}

/** 获取访问页数（v2 getUserPvApi） */
export function getUserPvApi(params: Record<string, unknown>) {
  return request({ url: '/uservisit/getUserPv', method: 'post', data: params })
}

/** 获取访问深度（v2 getUserVisitUriApi） */
export function getUserVisitUriApi(params: Record<string, unknown>) {
  return request({ url: '/uservisit/getUserVisitUri', method: 'post', data: params })
}

/**
 * 获取上次访问时间（v2 getUserLatestTimeApi）。
 * 与 v2 一致：这条虽然写在 uservisit.js 里，url 却是 /user/ 前缀。
 */
export function getUserLatestTimeApi(params: Record<string, unknown>) {
  return request({ url: '/user/getUserLatestTime', method: 'post', data: params })
}
