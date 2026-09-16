import request from '@/utils/requestManage'

/**
 * 书签。
 * 通道与 v2 的 api/sysmanage/bookMark.js 一致（@/utils/requestManage → manage 通道）。
 * requestManage 的 beforeBizError 对 /bookmark/get 做了特判：非 200 时不弹错误、原样回传 res，
 * 自定义分析靠 res.code == 500 判断「当前用户没有这个书签」。
 */

/** 保存书签 */
export function addApi(params: Record<string, unknown>) {
  return request({
    url: '/bookmark/add',
    method: 'post',
    data: params,
  })
}

/** 删除书签 */
export function deleteApi(params: Record<string, unknown>) {
  return request({
    url: '/bookmark/delete',
    method: 'post',
    data: params,
  })
}

/** 编辑书签 */
export function editApi(params: Record<string, unknown>) {
  return request({
    url: '/bookmark/edit',
    method: 'post',
    data: params,
  })
}

/** 分页获取书签列表 */
export function getPageListApi(params: Record<string, unknown>) {
  return request({
    url: '/bookmark/getPageList',
    method: 'post',
    data: params,
  })
}

/** 获取书签详情 */
export function getApi(params: Record<string, unknown>) {
  return request({
    url: '/bookmark/get',
    method: 'post',
    data: params,
  })
}
