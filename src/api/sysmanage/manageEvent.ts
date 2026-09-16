import request from '@/utils/requestManage'

/**
 * 元数据 - 事件 / 属性。
 * 通道与 v2 的 api/sysmanage/manageEvent.js 一致（@/utils/requestManage → manage 通道）。
 * 这里只迁自定义分析模块真正用到的三个接口，其余按需再补。
 */

/** 获取属性列表（不分组） */
export function getListNoGroupEventApi(params: Record<string, unknown>) {
  return request({
    url: '/normal/property/getListNoGroup',
    method: 'post',
    data: params,
  })
}

/** 获取分组后的事件与属性 */
export function getGroupedPropertiesApi(params: Record<string, unknown>) {
  return request({
    url: '/meta/event/getGroupedProperties',
    method: 'post',
    data: params,
  })
}

/** 获取通用属性列表 */
export function getCommonPropertyListApi(params: Record<string, unknown>) {
  return request({
    url: '/normal/property/getCommonPropertyList',
    method: 'post',
    data: params,
  })
}

/** 获取事件分组列表（analysis-modules 的分析条「分组」下拉在用） */
export function getGroupNameListEventApi(params: Record<string, unknown>) {
  return request({
    url: '/meta/event/getGroupNameList',
    method: 'post',
    data: params,
  })
}

/* -------------------------------------------------------------------------- */
/* 元数据管理（meteData）模块用到的接口与类型                                   */
/* -------------------------------------------------------------------------- */

/** 元事件列表的一行（v2 meteData/manage/index.vue 的表格数据） */
export interface MetaEventRow {
  metaEventId?: string
  projectName?: string
  displayName?: string
  name?: string
  groupName?: string
  status?: string
  display?: boolean
  isPreset?: boolean
  isAccept?: boolean
  channel?: string | string[]
  triggerOpportunity?: string
  remark?: string
  orderNum?: number | string
  createTime?: string
  updateTime?: string
  creator?: string
  tag?: string[]
  propertyIds?: string[] | string
}

/** 事件详情里的属性行（事件属性 / 公共属性 / 通用预置属性共用同一结构） */
export interface EventPropertyRow {
  propertyId?: string
  normalPropertyId?: string
  displayName?: string
  name?: string
  dataType?: string
  type?: string
  groupName?: string
  remark?: string
  isHot?: boolean
  /** v2 用 this.$set 动态挂上去的「hover 时显示开关文案」标记 */
  showTextVisible?: boolean
}

/** /meta/event/get 的返回 */
export interface MetaEventDetail {
  eventPropertyExtendList?: EventPropertyRow[]
  commonProperyList?: EventPropertyRow[]
  commonPresetProperyList?: EventPropertyRow[]
}

/** /normal/property/getList 的分组节点（级联选择器的一级） */
export interface PropertyGroup {
  groupName?: string
  displayName?: string
  normalPropertyId?: string
  propertyList: EventPropertyRow[]
}

export interface MetaEventPageResult {
  rows?: MetaEventRow[]
  total?: number
}

// 事件管理分页获取事件列表（用户细查「行为概览」也靠它过滤掉预置事件）
export function getPageListEventApi(params: Record<string, unknown>) {
  return request<MetaEventPageResult>({
    url: '/meta/event/getPageList',
    method: 'post',
    data: params,
  })
}

// 编辑列表
export function editEventApi(params: Record<string, unknown>) {
  return request({
    url: '/meta/event/edit',
    method: 'post',
    data: params,
  })
}

// 删除列表
export function deleteEventApi(params: Record<string, unknown>) {
  return request({
    url: '/meta/event/delete',
    method: 'post',
    data: params,
  })
}

// 添加列表
export function addEventApi(params: Record<string, unknown>) {
  return request({
    url: '/meta/event/add',
    method: 'post',
    data: params,
  })
}

// 获取事件详情
export function getEventApi(params: Record<string, unknown>) {
  return request<MetaEventDetail>({
    url: '/meta/event/get',
    method: 'post',
    data: params,
  })
}

// 获取属性列表-分组
export function getListEventApi(params: Record<string, unknown>) {
  return request<PropertyGroup[]>({
    url: '/normal/property/getList',
    method: 'post',
    data: params,
  })
}

// 批量导入功能-自定义事件
export function importDataApi(params: FormData) {
  return request({
    url: '/meta/event/importData',
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    method: 'post',
    data: params,
  })
}

// 导入用户属性
export function importUserApi(params: FormData) {
  return request({
    url: '/normal/property/import',
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    method: 'post',
    data: params,
  })
}

// 设置热点属性
export function setHotPropApi(params: Record<string, unknown>) {
  return request({
    url: '/meta/event/setHotProp',
    method: 'post',
    data: params,
  })
}
