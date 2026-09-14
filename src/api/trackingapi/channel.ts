import request from '@/utils/request'

export function getChannelDetailApi(params: Record<string, unknown>) {
  return request({
    url: '/channel/getChannelDetail',
    method: 'post',
    data: params,
  })
}

export function getChannelListApi(params: { projectName: string }) {
  return request<{ displayName: string }[]>({
    url: '/channel/getChannelList',
    method: 'post',
    data: params,
  })
}

export function getChannelOverviewApi(params: Record<string, unknown>) {
  return request({
    url: '/leader/getChannelOverview',
    method: 'post',
    data: params,
  })
}
