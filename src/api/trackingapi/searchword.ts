import request from '@/utils/request'

export function getInternalSearchWordDetailApi(params: Record<string, unknown>) {
  return request({
    url: '/internalsearchword/getInternalSearchWordDetail',
    method: 'post',
    data: params,
  })
}
