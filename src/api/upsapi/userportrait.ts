/**
 * 用户画像（个人画像 / 访客详情弹窗）。
 *
 * 注意通道：v2 的 api/upsapi/userportrait.js 引的是 `@/utils/request`（api 通道），
 * 而不是同目录其它 ups 文件用的 requestUps（ups 通道）。这里与 v2 保持一致，
 * 不要「顺手」改成 requestUps —— 这几个 /user/* 接口挂在主服务上。
 */
import request from '@/utils/request'

/** 分页获取用户访问明细（个人画像的用户列表） */
export function getUserList(params: Record<string, unknown>) {
  return request({ url: '/user/getUserList', method: 'post', data: params })
}

/** 获取用户基本信息 */
export function getUserDetailInfo(params: Record<string, unknown>) {
  return request({ url: '/user/getUserDetailInfo', method: 'post', data: params })
}

/** 分页获取用户单次访问的页面明细 */
export function getUserSessionUriList(params: Record<string, unknown>) {
  return request({ url: '/user/getUserSessionUriList', method: 'post', data: params })
}

/** 分页获取用户访问明细（一次访问 = 一个 session） */
export function getUserSessionList(params: Record<string, unknown>) {
  return request({ url: '/user/getUserSessionList', method: 'post', data: params })
}

/** 获取用户属性 */
export function getUserProp(params: Record<string, unknown>) {
  return request({ url: '/user/getUserProp', method: 'post', data: params })
}
