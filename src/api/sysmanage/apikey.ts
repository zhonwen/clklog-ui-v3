import request from '@/utils/requestManage'

/** 列表行，字段与 v2 api-key.vue 使用的一致 */
export interface ApiKeyRow {
  id?: string
  displayName?: string
  apiKey?: string
  status?: string
  createdAt?: string
  expiresAt?: string
  /** v2 用 this.$set(row,'showKey') 临时切换明文显示 */
  showKey?: boolean
}

/** 新建成功后后端一次性返回的明文密钥 */
export interface ApiKeyCreated {
  apiKey?: string
  apiSecret?: string
}

export function addApiKey(params: Record<string, unknown>) {
  return request<ApiKeyCreated>({
    url: '/apikey/add',
    method: 'post',
    data: params,
  })
}

export function editApiKey(params: Record<string, unknown>) {
  return request<ApiKeyRow>({
    url: '/apikey/edit',
    method: 'post',
    data: params,
  })
}

export function getApiKey(params: Record<string, unknown>) {
  return request<ApiKeyRow>({
    url: '/apikey/get',
    method: 'post',
    data: params,
  })
}

export function deleteApiKey(params: Record<string, unknown>) {
  return request({
    url: '/apikey/delete',
    method: 'post',
    data: params,
  })
}

export function listApiKey(params: Record<string, unknown>) {
  return request<ApiKeyRow[]>({
    url: '/apikey/list',
    method: 'post',
    data: params,
  })
}
