import request from '@/utils/requestDownLoad'

export function exportFlowTrendDetailApi(params: Record<string, unknown>) {
  return request({ url: '/download/exportFlowTrendDetail', method: 'post', data: params, responseType: 'blob' })
}

export function exportSearchWordDetailApi(params: Record<string, unknown>) {
  return request({ url: '/download/exportSearchWordDetail', method: 'post', data: params, responseType: 'blob' })
}

export function exportInternalSearchWordDetailApi(params: Record<string, unknown>) {
  return request({ url: '/download/exportInternalSearchWordDetail', method: 'post', data: params, responseType: 'blob' })
}

export function exportAreaDetailApi(params: Record<string, unknown>) {
  return request({ url: '/download/exportAreaDetail', method: 'post', data: params, responseType: 'blob' })
}

export function exportVisitUriDetailApi(params: Record<string, unknown>) {
  return request({ url: '/download/exportVisitUriDetail', method: 'post', data: params, responseType: 'blob' })
}

export function exportSourceWebsiteDetailApi(params: Record<string, unknown>) {
  return request({ url: '/download/exportSourceWebsiteDetail', method: 'post', data: params, responseType: 'blob' })
}

export function exportVisitorDetailApi(params: Record<string, unknown>) {
  return request({ url: '/user/exportUserDetail', method: 'post', data: params, responseType: 'blob' })
}

export function exportVisitorApi(params: Record<string, unknown>) {
  return request({ url: '/user/exportUser', method: 'post', data: params, responseType: 'blob' })
}

export function exportDeviceDetailApi(params: Record<string, unknown>) {
  return request({ url: '/download/exportDeviceDetail', method: 'post', data: params, responseType: 'blob' })
}

export function exportOsDetailApi(params: Record<string, unknown>) {
  return request({ url: '/download/exportOsDetail', method: 'post', data: params, responseType: 'blob' })
}

export function exportChannelDetailApi(params: Record<string, unknown>) {
  return request({ url: '/download/exportChannelDetail', method: 'post', data: params, responseType: 'blob' })
}

export function exportUserList(params: Record<string, unknown>) {
  return request({ url: '/user/exportUserList', method: 'post', data: params, responseType: 'blob' })
}

export function userHistoryData(params: Record<string, unknown>) {
  return request({ url: '/tag/export/userHistoryData', method: 'post', data: params, responseType: 'blob' })
}

export function userDistributeData(params: Record<string, unknown>) {
  return request({ url: '/tag/export/userDistributeData', method: 'post', data: params, responseType: 'blob' })
}

export function groupUserDistributeData(params: Record<string, unknown>) {
  return request({ url: '/group/export/userDistributeData', method: 'post', data: params, responseType: 'blob' })
}

export function groupUserHistoryData(params: Record<string, unknown>) {
  return request({ url: '/group/export/userHistoryData', method: 'post', data: params, responseType: 'blob' })
}

export function exportJobDownload(params: Record<string, unknown>) {
  return request({ url: '/exportJob/download', method: 'post', data: params, responseType: 'blob' })
}
