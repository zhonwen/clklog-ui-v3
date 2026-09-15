import request from '@/utils/request'

export function getVisitorApi(params: Record<string, unknown>) {
  return request({ url: '/user/getUser', method: 'post', data: params })
}
