import request from '@/utils/request'

export function getInternalSearchWordDetailApi(params: Record<string, unknown>) {
  return request({
    url: '/internalsearchword/getInternalSearchWordDetail',
    method: 'post',
    data: params,
  })
}

/** 站外搜索词详情（v2 api/trackingapi/searchword.js getSearchWordDetailApi） */
export function getSearchWordDetailApi(params: Record<string, unknown>) {
  return request({ url: '/searchword/getSearchWordDetail', method: 'post', data: params })
}
