import request from '@/utils/requestUps'
import type {
  DistributeItem,
  GroupRow,
  GroupUserRow,
  HistoryDayRow,
} from '@/views/ups/usergroup/types'
import type { EstimateRow } from '@/views/ups/components/types'

/**
 * 用户分群。
 * 通道与 v2 的 api/upsapi/usergroup.js 一致（@/utils/requestUps → ups 通道）。
 */

/** 分页结果 */
export interface PageResult<T> {
  rows?: T[]
  total?: number
}

/**
 * 估算结果的一行。直接复用 ups 公共组件那份定义，
 * 否则传给 estimate-dialog 的 dialogEvent 会因为索引签名对不上而报错。
 */
export type { EstimateRow } from '@/views/ups/components/types'

/* -------------------------------------------------------------------------- */
/* 列表 / 详情 / 增删改                                                        */
/* -------------------------------------------------------------------------- */

/** 编辑状态（启用 / 暂停） */
export function status(params: Record<string, unknown>) {
  return request({ url: '/group/status', method: 'post', data: params })
}

/** 分群列表分页 */
export function getlistpage(params: Record<string, unknown>) {
  return request<PageResult<GroupRow>>({
    url: '/group/getPageList',
    method: 'post',
    data: params,
  })
}

/** 分群详情 */
export function get(params: Record<string, unknown>) {
  return request<GroupRow>({ url: '/group/get', method: 'post', data: params })
}

export function edit(params: Record<string, unknown>) {
  return request({ url: '/group/edit', method: 'post', data: params })
}

export function deleteApi(params: Record<string, unknown>) {
  return request({ url: '/group/delete', method: 'post', data: params })
}

export function add(params: Record<string, unknown>) {
  return request({ url: '/group/add', method: 'post', data: params })
}

/** 分群标识唯一性校验 */
export function check(params: Record<string, unknown>) {
  return request<boolean>({ url: '/group/check', method: 'post', data: params })
}

/* -------------------------------------------------------------------------- */
/* 估算 / 手动更新                                                             */
/* -------------------------------------------------------------------------- */

/** 预估结果 */
export function groupEstimate(params: Record<string, unknown>) {
  return request<EstimateRow[]>({ url: '/group/estimate', method: 'post', data: params })
}

/** 手动更新 */
export function groupTagNow(params: Record<string, unknown>) {
  return request({ url: '/group/tagNow', method: 'post', data: params })
}

/* -------------------------------------------------------------------------- */
/* 历史 / 用户分布                                                             */
/* -------------------------------------------------------------------------- */

/** 获取分群历史按天统计 */
export function getHistoryDataByDay(params: Record<string, unknown>) {
  // v2 注释掉的另一个地址是 /group/history/groupByDay，这里同样用 getHistoryDataByDay
  return request<HistoryDayRow[]>({
    url: '/group/getHistoryDataByDay',
    method: 'post',
    data: params,
  })
}

/** 获取分群历史详情分页 */
export function getHistoryDataPageList(params: Record<string, unknown>) {
  return request<PageResult<GroupUserRow>>({
    url: '/group/getHistoryDataPageList',
    method: 'post',
    data: params,
  })
}

/** 分页获取用户分群下的用户信息 */
export function getGroupUserPageList(params: Record<string, unknown>) {
  return request<PageResult<GroupUserRow>>({
    url: '/group/getUserPageList',
    method: 'post',
    data: params,
  })
}

/** 获取分群下的用户分布统计数据 */
export function getUserDistributeStats(params: Record<string, unknown>) {
  return request<DistributeItem[]>({
    url: '/group/getUserDistributeStats',
    method: 'post',
    data: params,
  })
}

/* -------------------------------------------------------------------------- */
/* 导出                                                                        */
/* -------------------------------------------------------------------------- */

/** 导出用户标签历史详情数据 */
export function groupUserHistoryData(params: Record<string, unknown>) {
  return request({ url: '/group/export/userHistoryData', method: 'post', data: params })
}

/** 导出标签下的用户分布数据 */
export function groupUserDistributeData(params: Record<string, unknown>) {
  return request({ url: '/group/export/userDistributeData', method: 'post', data: params })
}

/* -------------------------------------------------------------------------- */
/* 用户细查                                                                    */
/* -------------------------------------------------------------------------- */

/** 用户细查 - 根据分组过滤用户信息 */
export function getUserPageListNewApi(params: Record<string, unknown>) {
  return request({ url: '/group/getUserPageListNew', method: 'post', data: params })
}
