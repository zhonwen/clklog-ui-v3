import request from '@/utils/request'

export function getVisitorApi(params: Record<string, unknown>) {
  return request({ url: '/user/getUser', method: 'post', data: params })
}

/** 按 eventSessionId 分组的访问日志（实时访问列表） */
export function getLogByEventSessionIdApi(params: Record<string, unknown>) {
  return request({
    url: '/user/getLogAnalysisListGroupByEventSessionId',
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
