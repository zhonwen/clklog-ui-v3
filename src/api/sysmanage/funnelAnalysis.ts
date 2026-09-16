import request from '@/utils/requestManage'

/**
 * 漏斗模型的增删改查。
 * 通道与 v2 的 api/sysmanage/funnelAnalysis.js 一致（@/utils/requestManage → manage 通道）。
 * v2 里还有一个 getApi（/funnel/get），漏斗分析模块没有用到，按「只补真正用到的」不迁。
 */

/** 新增漏斗 */
export function addsApi(params: Record<string, unknown>) {
  return request({
    url: '/funnel/add',
    method: 'post',
    data: params,
  })
}

/** 删除漏斗 */
export function deleteApi(params: Record<string, unknown>) {
  return request({
    url: '/funnel/delete',
    method: 'post',
    data: params,
  })
}

/** 编辑漏斗 */
export function editApi(params: Record<string, unknown>) {
  return request({
    url: '/funnel/edit',
    method: 'post',
    data: params,
  })
}

/** 分页获取漏斗列表 */
export function getPageListApi<T = unknown>(params: Record<string, unknown>) {
  return request<T>({
    url: '/funnel/getPageList',
    method: 'post',
    data: params,
  })
}
