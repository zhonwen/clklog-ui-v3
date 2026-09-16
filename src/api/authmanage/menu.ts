import request from '@/utils/requestAuthManage'

/** 菜单树节点，字段与 v2 /menu/load 返回一致 */
export interface MenuTreeNodeData {
  menuId?: string
  name?: string
  parentMenuId?: string
  children?: MenuTreeNodeData[]
}

/** 菜单详情，字段与 v2 /menu/get 返回一致 */
export interface MenuDetail {
  menuId: string
  name: string
  componentUri: string
  component: string
  icon: string
  path: string
  appId: string
  parentMenuId: string
  roles: string[]
  hidden: boolean
  externalLink: boolean
  orderNumber: string | number
  perms: string
  /** 接口权限字符串，多个以逗号分隔 */
  methods: string
}

export function loadMenu(params: Record<string, unknown>) {
  return request<MenuTreeNodeData[]>({
    url: '/menu/load',
    method: 'post',
    data: params,
  })
}

export function deleteMenu(params: Record<string, unknown>) {
  return request<boolean>({
    url: '/menu/delete',
    method: 'post',
    data: params,
  })
}

export function editMenu(params: Record<string, unknown>) {
  return request<boolean>({
    url: '/menu/edit',
    method: 'post',
    data: params,
  })
}

export function addMenu(params: Record<string, unknown>) {
  return request<{ id: string }>({
    url: '/menu/add',
    method: 'post',
    data: params,
  })
}

export function getMenu(params: Record<string, unknown>) {
  return request<MenuDetail>({
    url: '/menu/get',
    method: 'post',
    data: params,
  })
}
