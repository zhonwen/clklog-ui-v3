import request from '@/utils/requestUps'

/**
 * 群画像（用户画像 userPortrait 模块）。
 * 通道与 v2 的 api/upsapi/groupportrait.js 一致（@/utils/requestUps → ups 通道），
 * url / method / 参数名逐条照搬，未做任何合并或重命名。
 */

/** 获取群画像列表 */
export function getlistpage(params: Record<string, unknown>) {
  return request({ url: '/groupPortrait/getPageList', method: 'post', data: params })
}

/** 编辑群画像更新方式 */
export function editUpdateMet(params: Record<string, unknown>) {
  return request({ url: '/groupPortrait/edit', method: 'post', data: params })
}

/** 添加群画像 */
export function add(params: Record<string, unknown>) {
  return request({ url: '/groupPortrait/add', method: 'post', data: params })
}

/** 获取群画像 */
export function get(params: Record<string, unknown>) {
  return request({ url: '/groupPortrait/get', method: 'post', data: params })
}

/** 更新群画像 */
export function update(params: Record<string, unknown>) {
  return request({ url: '/groupPortrait/update', method: 'post', data: params })
}

/** 更新对比人群画像 */
export function updatecontrast(params: Record<string, unknown>) {
  return request({ url: '/groupPortrait/contrast/update', method: 'post', data: params })
}

/** 添加对比群画像 */
export function addcontrast(params: Record<string, unknown>) {
  return request({ url: '/groupPortrait/contrast/add', method: 'post', data: params })
}

/** 获取对比群画像列表 */
export function getlistcontrast(params: Record<string, unknown>) {
  return request({ url: '/groupPortrait/contrast/getList', method: 'post', data: params })
}

/** 获取对比群画像 */
export function getcontrast(params: Record<string, unknown>) {
  return request({ url: '/groupPortrait/contrast/get', method: 'post', data: params })
}

/** 删除对比群画像 */
export function deletecontrast(params: Record<string, unknown>) {
  return request({ url: '/groupPortrait/contrast/delete', method: 'post', data: params })
}

/** 删除群画像 */
export function portraitListDelete(params: Record<string, unknown>) {
  return request({ url: '/groupPortrait/delete', method: 'post', data: params })
}

/** 添加画像信息 */
export function addportrait(params: Record<string, unknown>) {
  return request({ url: '/groupPortrait/portrait/add', method: 'post', data: params })
}

/** 编辑画像信息 */
export function editportrait(params: Record<string, unknown>) {
  return request({ url: '/groupPortrait/portrait/edit', method: 'post', data: params })
}

/** 删除画像信息 */
export function deleteportrait(params: Record<string, unknown>) {
  return request({ url: '/groupPortrait/portrait/delete', method: 'post', data: params })
}

/** 获取画像信息列表 */
export function getlistportrait(params: Record<string, unknown>) {
  return request({ url: '/groupPortrait/portrait/getList', method: 'post', data: params })
}

/** 获取群画像分布 */
export function getDistribution(params: Record<string, unknown>) {
  return request({ url: '/groupPortrait/portrait/getDistribution', method: 'post', data: params })
}

/** 获取群画像对比数据 */
export function getComparison(params: Record<string, unknown>) {
  return request({ url: '/groupPortrait/getComparison', method: 'post', data: params })
}

/** 预估结果 */
export function estimate(params: Record<string, unknown>) {
  return request({ url: '/groupPortrait/estimate', method: 'post', data: params })
}

/** 手动更新 */
export function portraitTagNow(params: Record<string, unknown>) {
  return request({ url: '/groupPortrait/tagNow', method: 'post', data: params })
}

/** 复制群画像（v2 注释写的也是「手动更新」，此处保留接口语义） */
export function groupPortraitCopy(params: Record<string, unknown>) {
  return request({ url: '/groupPortrait/copy', method: 'post', data: params })
}
