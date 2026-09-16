import request from '@/utils/request'

/** 设备分析：网络设备类型明细（分页） */
export function getDeviceDetailApi(params: Record<string, unknown>) {
  return request({
    url: '/device/getDeviceDetailList',
    method: 'post',
    data: params,
  })
}

/** 设备分析：操作系统分析（接口不分页） */
export function getOperaSystemApi(params: Record<string, unknown>) {
  return request({
    url: '/os/getOsDetail',
    method: 'post',
    data: params,
  })
}
