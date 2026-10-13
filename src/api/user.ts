import request from '@/utils/requestAuthManage'
import type { MenuItem } from '@/types/app'

export function login(params: Record<string, unknown>) {
  return request<{ token: string }>({
    url: '/auth/login',
    method: 'post',
    data: params,
  })
}

export function getInfo(params: unknown) {
  return request({
    url: '/auth/getUser',
    method: 'post',
    data: params,
  })
}

export function logout() {
  return request({
    url: '/logout',
    method: 'post',
    data: {},
  })
}

export function getMenuList(params: { projectName: string }) {
  return request<MenuItem[]>({
    url: '/auth/getMenuList',
    method: 'post',
    data: params,
  })
}

export function modifyPassword(params: Record<string, unknown>) {
  return request({
    url: '/auth/modifyPassword',
    method: 'post',
    data: params,
  })
}

export function modifyPasswordAnom(params: Record<string, unknown>) {
  return request({
    url: '/auth/modifyPasswordAnom',
    method: 'post',
    data: params,
  })
}
