import request from '@/utils/request'

/** 分页查询用户列表（v2 api/trackingapi/userreview.js getUserListNewApi，用户复查「按ID筛选」） */
export function getUserListNewApi(params: Record<string, unknown>) {
  return request({ url: '/user/getUserListNew', method: 'post', data: params })
}

/* ---- 以下为 user-behavior/userInfo（用户细查详情页）用到的接口 ---- */

/** 用户事件统计（访问概览 Top10 / 行为分析饼图） */
export function getUserEventReportsApi(params: Record<string, unknown>) {
  return request({ url: '/user/getUserEventReports', method: 'post', data: params })
}

/** 用户事件时间维度统计（行为分析事件趋势） */
export function getUserEventReportByDateApi(params: Record<string, unknown>) {
  return request({ url: '/user/getUserEventReportByDate', method: 'post', data: params })
}

/** 分页查询用户事件（按事件名称，行为分析事件日志） */
export function pageGetUserEventsApi(params: Record<string, unknown>) {
  return request({ url: '/user/pageGetUserEvents', method: 'post', data: params })
}

/** 分页查询用户事件（按日期分页，行为轨迹左侧日期列表） */
export function pageGetUserEventDatesApi(params: Record<string, unknown>) {
  return request({ url: '/user/pageGetUserEventDates', method: 'post', data: params })
}

/** 分页查询用户事件（单日按小时分组，行为轨迹展开某一天） */
export function pageGetUserEventsByDateGroupedApi(params: Record<string, unknown>) {
  return request({ url: '/user/pageGetUserEventsByDateGrouped', method: 'post', data: params })
}

/** 获取事件上下文（邻近事件，行为轨迹右侧上下文面板） */
export function getEventNeighboursApi(params: Record<string, unknown>) {
  return request({ url: '/user/getEventNeighbours', method: 'post', data: params })
}
