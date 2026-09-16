import request from '@/utils/requestUps'

/**
 * 用户分群。
 * 通道与 v2 的 api/upsapi/usergroup.js 一致（@/utils/requestUps → ups 通道）。
 * 这里只迁 user-behavior/userReview 真正用到的两个接口，其余按需再补。
 */

/** 分群列表分页（用户复查初始化「用户分群」下拉） */
export function getlistpage(params: Record<string, unknown>) {
  return request({ url: '/group/getPageList', method: 'post', data: params })
}

/** 根据分组过滤用户信息（用户复查「按分群筛选」的查询） */
export function getUserPageListNewApi(params: Record<string, unknown>) {
  return request({ url: '/group/getUserPageListNew', method: 'post', data: params })
}
