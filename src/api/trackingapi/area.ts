import request from '@/utils/request'

export function getAreaApi(params: Record<string, unknown>) {
  return request({ url: '/area/getArea', method: 'post', data: params })
}
