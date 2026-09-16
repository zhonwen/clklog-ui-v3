import request from '@/utils/request'

/**
 * 自定义分析查询。
 *
 * 通道与 v2 的 api/sysmanage/customAnalysis.js 一致（@/utils/request → api 通道）。
 * 该 url 在 request.ts 的 onBizError 里有特判：非 200 时弹「自定义分析查询模型错误…」
 * 并把 res 原样回传（不 reject），调用方按 res?.code == 200 判断即可。
 *
 * funnelAnalysisApi / funnelAnalysisAllDimsApi / taskRueryApi / taskFetchApi 由漏斗分析模块使用，
 * v2 里它们同样放在这个文件里，走的也是同一个 request 通道。
 * 漏斗页（/mete/funnelAnalysis）下 request.ts 的 beforeBizError 会把非 200 的 res 原样回传、
 * 不弹错误框，onHttpError 也会吞掉 HTTP 错误，所以调用方要自己按 res?.code 分支处理。
 */
export function customAnalysisApi(params: Record<string, unknown>) {
  return request({
    url: '/eventanalysis/customAnalysis',
    method: 'post',
    data: params,
  })
}

/** 获取查询漏斗的 id */
export function funnelAnalysisApi<T = unknown>(params: Record<string, unknown>) {
  return request<T>({
    url: '/eventanalysis/funnelAnalysis',
    method: 'post',
    data: params,
  })
}

/** 获取查询漏斗全维度的 id */
export function funnelAnalysisAllDimsApi<T = unknown>(params: Record<string, unknown>) {
  return request<T>({
    url: '/eventanalysis/funnelAnalysisAllDims',
    method: 'post',
    data: params,
  })
}

/** 异步任务：查询任务状态 */
export function taskRueryApi<T = unknown>(params: Record<string, unknown>) {
  return request<T>({
    url: '/task/query',
    method: 'post',
    data: params,
  })
}

/** 异步任务：拉取最终结果 */
export function taskFetchApi<T = unknown>(params: Record<string, unknown>) {
  return request<T>({
    url: '/task/fetch',
    method: 'post',
    data: params,
  })
}
