import request from '@/utils/requestManage'

/** 基本属性（事件属性 / 用户属性共用同一张表，靠 type 区分） */
export interface NormalPropertyRow {
  normalPropertyId?: string
  projectName?: string
  displayName?: string
  name?: string
  groupName?: string
  status?: string
  display?: boolean
  dataType?: string
  unit?: string
  precisions?: number | string
  isPreset?: boolean
  isCommon?: boolean | string
  remark?: string
  orderNum?: number | string
  createTime?: string
  updateTime?: string
  creator?: string
  /** '事件' | '用户' */
  type?: string
  tag?: string[]
}

export interface NormalPropertyPageResult {
  rows?: NormalPropertyRow[]
  total?: number
}

// 属性 分页获取基本属性列表
export function getPageListApi(params: Record<string, unknown>) {
  return request<NormalPropertyPageResult>({
    url: '/normal/property/getPageList',
    method: 'post',
    data: params,
  })
}

// 获取基本属性分组列表
export function getGroupNameListApi(params: Record<string, unknown>) {
  return request<string[]>({
    url: '/normal/property/getGroupNameList',
    method: 'post',
    data: params,
  })
}

// 新增
export function addApi(params: Record<string, unknown>) {
  return request({
    url: '/normal/property/add',
    method: 'post',
    data: params,
  })
}

// 删除
export function deleteApi(params: Record<string, unknown>) {
  return request({
    url: '/normal/property/delete',
    method: 'post',
    data: params,
  })
}

// 编辑
export function editApi(params: Record<string, unknown>) {
  return request({
    url: '/normal/property/edit',
    method: 'post',
    data: params,
  })
}

// 获取基本属性详情
export function getApi(params: Record<string, unknown>) {
  return request<NormalPropertyRow>({
    url: '/normal/property/get',
    method: 'post',
    data: params,
  })
}
