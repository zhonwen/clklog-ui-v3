import request from '@/utils/requestAuthManage'

/** 角色，字段与 v2 /role/getlist、/role/getlistpage 返回一致 */
export interface RoleRow {
  roleId: string
  roleName?: string | null
  displayName?: string | null
  orderNumber?: number | null
  /** 是否项目相关角色 */
  forProject?: boolean
  /** 'system' | 'user' */
  roleType?: string
  createtime?: string | number
  modifytime?: string | number
}

export function getRoleListPage(params: Record<string, unknown>) {
  return request<{ total: number; rows: RoleRow[] }>({
    url: '/role/getlistpage',
    method: 'post',
    data: params,
  })
}

export function getRoleList(params: Record<string, unknown>) {
  return request<RoleRow[]>({
    url: '/role/getlist',
    method: 'post',
    data: params,
  })
}

export function deleteRole(params: Record<string, unknown>) {
  return request<boolean>({
    url: '/role/delete',
    method: 'post',
    data: params,
  })
}

export function editRole(params: Record<string, unknown>) {
  return request<boolean>({
    url: '/role/edit',
    method: 'post',
    data: params,
  })
}

export function addRole(params: Record<string, unknown>) {
  return request<boolean>({
    url: '/role/add',
    method: 'post',
    data: params,
  })
}
