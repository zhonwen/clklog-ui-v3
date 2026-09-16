import request from '@/utils/requestUps'

/**
 * 标签分类管理。
 * 通道与 v2 的 api/upsapi/categorymanage.js 一致（@/utils/requestUps → ups 通道）。
 * 这里只迁 user-behavior/userReview 真正用到的一个接口，其余按需再补。
 */

/** 标签分类树（用户复查初始化「用户标签」树选择） */
export function getTreeList(params: Record<string, unknown>) {
  return request({ url: '/category/getTreeList', method: 'post', data: params })
}
