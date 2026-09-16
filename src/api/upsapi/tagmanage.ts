import request from '@/utils/requestUps'

/**
 * 标签管理。
 * 通道与 v2 的 api/upsapi/tagmanage.js 一致（@/utils/requestUps → ups 通道）。
 * url / method / 入参名称全部照抄 v2，不做归并。
 */

/** 获取用户的全部标签和标签值（用户画像页的「用户标签 / 用户分群」） */
export function getTagValueList(params: Record<string, unknown>) {
  return request({
    url: '/userPortrait/getTagValueList',
    method: 'post',
    data: params,
  })
}

/** 标签列表分页 */
export function getlistpage<T = unknown>(params: Record<string, unknown>) {
  return request<T>({
    url: '/tag/getPageList',
    method: 'post',
    data: params,
  })
}

/** 新增标签 */
export function add<T = unknown>(params: Record<string, unknown>) {
  return request<T>({
    url: '/tag/add',
    method: 'post',
    data: params,
  })
}

/** 标签详情 */
export function get<T = unknown>(params: Record<string, unknown>) {
  return request<T>({
    url: '/tag/get',
    method: 'post',
    data: params,
  })
}

/** 删除标签 */
export function tagDelete<T = unknown>(params: Record<string, unknown>) {
  return request<T>({
    url: '/tag/delete',
    method: 'post',
    data: params,
  })
}

/** 编辑标签 */
export function edit<T = unknown>(params: Record<string, unknown>) {
  return request<T>({
    url: '/tag/edit',
    method: 'post',
    data: params,
  })
}

/** 启用 / 暂停标签 */
export function tagstatus<T = unknown>(params: Record<string, unknown>) {
  return request<T>({
    url: '/tag/status',
    method: 'post',
    data: params,
  })
}

/** 获取标签历史详情分页 */
export function getHistoryDataPageList<T = unknown>(params: Record<string, unknown>) {
  return request<T>({
    url: '/tag/getHistoryDataPageList',
    method: 'post',
    data: params,
  })
}

/** 分页获取人数分布的用户列表 */
export function getUserPageList<T = unknown>(params: Record<string, unknown>) {
  return request<T>({
    url: '/tag/getUserPageList',
    method: 'post',
    data: params,
  })
}

/** 标签下的用户分布统计 */
export function getUserDistributeStats<T = unknown>(params: Record<string, unknown>) {
  return request<T>({
    url: '/tag/getUserDistributeStats',
    method: 'post',
    data: params,
  })
}

/** 获取标签历史按天统计 */
export function getHistoryDataByDay<T = unknown>(params: Record<string, unknown>) {
  return request<T>({
    url: '/tag/getHistoryDataByDay',
    method: 'post',
    data: params,
  })
}

/** 验证标识是否存在 */
export function check<T = unknown>(params: Record<string, unknown>) {
  return request<T>({
    url: '/tag/check',
    method: 'post',
    data: params,
  })
}

/** 运行标签（手动更新） */
export function tagNow<T = unknown>(params: Record<string, unknown>) {
  return request<T>({
    url: '/tag/tagNow',
    method: 'post',
    data: params,
  })
}

/** 预估结果 */
export function estimate<T = unknown>(params: Record<string, unknown>) {
  return request<T>({
    url: '/tag/estimate',
    method: 'post',
    data: params,
  })
}

/** 导出用户标签历史详情数据 */
export function tagUserHistoryData<T = unknown>(params: Record<string, unknown>) {
  return request<T>({
    url: '/tag/export/userHistoryData',
    method: 'post',
    data: params,
  })
}

/** 导出标签下的用户分布数据 */
export function tagUserDistributeData<T = unknown>(params: Record<string, unknown>) {
  return request<T>({
    url: '/tag/export/userDistributeData',
    method: 'post',
    data: params,
  })
}

/** 导出任务列表（下载任务中心） */
export function exportJobGetList<T = unknown>(params: Record<string, unknown>) {
  return request<T>({
    url: '/exportJob/getList',
    method: 'post',
    data: params,
  })
}

/** 删除导出任务 */
export function exportJobDelete<T = unknown>(params: Record<string, unknown>) {
  return request<T>({
    url: '/exportJob/delete',
    method: 'post',
    data: params,
  })
}
