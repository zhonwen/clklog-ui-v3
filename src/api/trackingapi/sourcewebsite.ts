import request from '@/utils/request'

/** 来源网站流量概览 */
export function getSourceWebSiteTotalApi(params: Record<string, unknown>) {
  return request({
    url: '/sourcewebsite/getSourceWebSiteTotal',
    method: 'post',
    data: params,
  })
}

/** 获取 Top10 来源网站 */
export function getSourceWebsiteApi(params: Record<string, unknown>) {
  return request({
    url: '/sourcewebsite/getSourceWebSiteTop10',
    method: 'post',
    data: params,
  })
}

/** 分页获取来源网站详情 */
export function getSourceSiteDetailApi(params: Record<string, unknown>) {
  return request({
    url: '/sourcewebsite/getSourceWebSiteDetail',
    method: 'post',
    data: params,
  })
}
