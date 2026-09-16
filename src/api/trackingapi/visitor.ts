import request from '@/utils/request'

export function getVisitorApi(params: Record<string, unknown>) {
  return request({ url: '/user/getUser', method: 'post', data: params })
}

/** 获取访客统计（新老访客分析的流量概览头部） */
export function getVisitorTotalApi(params: Record<string, unknown>) {
  return request({ url: '/user/getUserTotal', method: 'post', data: params })
}

/** 获取访客详情（新老访客对比数据） */
export function getVisitorDetailApi(params: Record<string, unknown>) {
  return request({ url: '/user/getUserDetail', method: 'post', data: params })
}

/** 按 eventSessionId 分组的访问日志（实时访问列表） */
export function getLogByEventSessionIdApi(params: Record<string, unknown>) {
  return request({
    url: '/user/getLogAnalysisListGroupByEventSessionId',
    method: 'post',
    data: params,
  })
}

/** 活跃用户趋势（领导驾驶舱 leader-cockpit 用） */
export function getVisitorActiveTrendApi(params: Record<string, unknown>) {
  return request({
    url: '/user/getUserActiveTrend',
    method: 'post',
    data: params,
  })
}

/** 访客详情弹窗左侧：用户基本信息 */
export function getVisitorDetailinfoApi(params: Record<string, unknown>) {
  return request({ url: '/user/getUserDetailInfo', method: 'post', data: params })
}

/** 访客详情弹窗右侧：按时间降序的每次访问，分页 */
export function getVisitorSessionListApi(params: Record<string, unknown>) {
  return request({ url: '/user/getUserSessionList', method: 'post', data: params })
}

/** 访客详情弹窗右侧：单次访问的页面明细，分页 */
export function getVisitorSessionUriListApi(params: Record<string, unknown>) {
  return request({ url: '/user/getUserSessionUriList', method: 'post', data: params })
}

/** 用户属性（用户画像页左侧「用户属性」，v2 在 api/upsapi/userportrait.js，同为 api 通道） */
export function getUserPropApi(params: Record<string, unknown>) {
  return request({ url: '/user/getUserProp', method: 'post', data: params })
}

/** 获取访客详情列表（用户行为分析的用户列表，v2 getVisitorListApi） */
export function getVisitorListApi(params: Record<string, unknown>) {
  return request({ url: '/user/getUserList', method: 'post', data: params })
}

/** 回流 / 沉默用户趋势（沉默用户页，v2 getVisitorRevisitAndSilentTrendApi） */
export function getVisitorRevisitAndSilentTrendApi(params: Record<string, unknown>) {
  return request({ url: '/user/getUserRevisitAndSilentTrend', method: 'post', data: params })
}

/** 留存趋势（留存流失页 dimensionValue == 'save'，v2 getVisitorRemainTrendApi） */
export function getVisitorRemainTrendApi(params: Record<string, unknown>) {
  return request({ url: '/user/getUserRemainTrend', method: 'post', data: params })
}

/** 流失趋势（留存流失页 dimensionValue == 'out'，v2 getVisitorChurnTrendApi） */
export function getVisitorChurnTrendApi(params: Record<string, unknown>) {
  return request({ url: '/user/getUserChurnTrend', method: 'post', data: params })
}
