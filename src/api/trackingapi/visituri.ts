import request from '@/utils/request'

export function getVisitUriApi(params: Record<string, unknown>) {
  return request({ url: '/visituri/getVisitUri', method: 'post', data: params })
}
