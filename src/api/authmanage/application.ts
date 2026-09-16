import request from '@/utils/requestAuthManage'

/** 应用列表行，字段与 v2 /app/getlistpage 返回一致 */
export type AppRow = {
  appId?: string
  appName?: string
  uri?: string
  createtime?: string | number
  modifytime?: string | number
}

export function getAppListPage(params: Record<string, unknown>) {
  return request<{ total: number; rows: AppRow[] }>({
    url: '/app/getlistpage',
    method: 'post',
    data: params,
  })
}

export function addApp(params: Record<string, unknown>) {
  return request<boolean>({
    url: '/app/add',
    method: 'post',
    data: params,
  })
}

export function editApp(params: Record<string, unknown>) {
  return request<boolean>({
    url: '/app/edit',
    method: 'post',
    data: params,
  })
}

export function deleteApp(params: Record<string, unknown>) {
  return request<boolean>({
    url: '/app/delete',
    method: 'post',
    data: params,
  })
}
