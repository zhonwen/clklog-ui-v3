import request from '@/utils/requestAuthManage'

/** 账号绑定的项目角色，字段与 v2 /user/get 返回一致 */
export interface UserProjectRole {
  projectName: string
  roleId: string
}

/** 账号列表行 / 详情，字段与 v2 /user/getlistpage、/user/get 返回一致 */
export interface UserRow {
  userId?: string | null
  userName?: string
  displayName?: string
  createtime?: string | number
  latesttime?: string | number
  createuser?: string
  /** 项目相关角色 */
  roles?: UserProjectRole[]
  /** 系统角色 id 列表 */
  roleIds?: string[]
}

export function getUserListPage(params: Record<string, unknown>) {
  return request<{ total: number; rows: UserRow[] }>({
    url: '/user/getlistpage',
    method: 'post',
    data: params,
  })
}

export function deleteUser(params: Record<string, unknown>) {
  return request<boolean>({
    url: '/user/delete',
    method: 'post',
    data: params,
  })
}

export function editUser(params: Record<string, unknown>) {
  return request<boolean>({
    url: '/user/edit',
    method: 'post',
    data: params,
  })
}

export function addUser(params: Record<string, unknown>) {
  return request<boolean>({
    url: '/user/add',
    method: 'post',
    data: params,
  })
}

export function getUser(params: Record<string, unknown>) {
  return request<UserRow>({
    url: '/user/get',
    method: 'post',
    data: params,
  })
}

export function modifyPassword(params: Record<string, unknown>) {
  return request<boolean>({
    url: '/user/modifyPassword',
    method: 'post',
    data: params,
  })
}
