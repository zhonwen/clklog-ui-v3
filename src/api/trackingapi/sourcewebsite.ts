import request from '@/utils/request'

export function getSourceWebsiteApi(params: Record<string, unknown>) {
  return request({
    url: '/sourcewebsite/getSourceWebSiteTop10',
    method: 'post',
    data: params,
  })
}
