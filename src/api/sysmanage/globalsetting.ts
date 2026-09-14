import request from '@/utils/requestManage'

export function getCaptchaImage(params: Record<string, unknown> = {}) {
  return request<{ img?: string; cid?: string }>({
    url: '/auth/getCaptchaImage',
    method: 'post',
    data: params,
  })
}
