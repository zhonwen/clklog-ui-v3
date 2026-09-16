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

/** 标签分类列表（群画像 filterBar / tree-select 拉分类树用） */
export function getListCategory(params: Record<string, unknown>) {
  return request({ url: '/category/getList', method: 'post', data: params })
}

/** 新增分类（标签分类管理页） */
export function addCategory(params: Record<string, unknown>) {
  return request({ url: '/category/add', method: 'post', data: params })
}

/** 编辑分类 */
export function editCategory(params: Record<string, unknown>) {
  return request({ url: '/category/edit', method: 'post', data: params })
}

/** 拖拽排序 */
export function dragCategory(params: Record<string, unknown>) {
  return request({ url: '/category/drag', method: 'post', data: params })
}

/** 删除分类 */
export function deleteCategory(params: Record<string, unknown>) {
  return request({ url: '/category/delete', method: 'post', data: params })
}
