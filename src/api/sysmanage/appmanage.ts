import request from '@/utils/requestManage'
import type { ProjectItem } from '@/types/app'
import type { LogStat } from '@/api/sysmanage/globalsetting'

/** 项目（应用）详情 / 表单，字段与 v2 app-manage.vue 的 form 一致 */
export interface AppDetail {
  id?: string
  projectName?: string
  projectDisplayName?: string
  excludedIp?: string
  excludedUa?: string
  excludedUrlParams?: string
  searchwordKey?: string
  searchwordCategoryKey?: string
  rootUrls?: string
}

/** /project/getlist 的行：项目设置页用前半段，日志管理页额外用 stat */
export interface AppRow extends AppDetail {
  token?: string
  createTime?: string
  updateTime?: string
  stat?: LogStat
}

export interface AppListResult {
  rows?: AppRow[]
  total?: number
}

export function getAppMyList() {
  return request<ProjectItem[]>({
    url: '/project/getMyList',
    method: 'post',
    data: {},
  })
}

export function addApp(params: Record<string, unknown>) {
  return request<AppDetail>({
    url: '/project/add',
    method: 'post',
    data: params,
  })
}

export function editApp(params: Record<string, unknown>) {
  return request<AppDetail>({
    url: '/project/edit',
    method: 'post',
    data: params,
  })
}

export function getApp(params: Record<string, unknown>) {
  return request<AppDetail>({
    url: '/project/get',
    method: 'post',
    data: params,
  })
}

export function deleteApp(params: Record<string, unknown>) {
  return request({
    url: '/project/delete',
    method: 'post',
    data: params,
  })
}

export function getAppList(params: Record<string, unknown>) {
  return request<AppListResult>({
    url: '/project/getlist',
    method: 'post',
    data: params,
  })
}
