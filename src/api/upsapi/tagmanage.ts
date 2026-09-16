import request from '@/utils/requestUps'

/**
 * 标签管理。
 * 通道与 v2 的 api/upsapi/tagmanage.js 一致（@/utils/requestUps → ups 通道）。
 * 这里只迁 user-behavior/userInfo 真正用到的一个接口，其余按需再补。
 */

/** 获取用户的全部标签和标签值（用户画像页的「用户标签 / 用户分群」） */
export function getTagValueList(params: Record<string, unknown>) {
  return request({
    url: '/userPortrait/getTagValueList',
    method: 'post',
    data: params,
  })
}
