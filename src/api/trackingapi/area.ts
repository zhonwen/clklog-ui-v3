import request from '@/utils/request'

export function getAreaApi(params: Record<string, unknown>) {
  return request({ url: '/area/getArea', method: 'post', data: params })
}

/** 地域详情-流量概览（v2 api/trackingapi/area.js getAreaDetailTotalApi） */
export function getAreaDetailTotalApi(params: Record<string, unknown>) {
  return request({ url: '/area/getAreaDetailTotal', method: 'post', data: params })
}

/** 分页获取按省过滤城市统计数据（v2 getAreaDetailCityListApi） */
export function getAreaDetailCityListApi(params: Record<string, unknown>) {
  return request({ url: '/area/getAreaDetailCityList', method: 'post', data: params })
}

/** 获取地域列表（v2 getAreaDetailListApi） */
export function getAreaDetailListApi(params: Record<string, unknown>) {
  return request({ url: '/area/getAreaDetailList', method: 'post', data: params })
}

/**
 * 分页获取按省份访问统计数据（v2 getAreaProvinceListApi）。
 * 与 v2 一致：url 和 getAreaDetailListApi 完全相同，v2 就是两个同 url 的导出，
 * 地域分析里省份地图用前者、下方列表用后者。
 */
export function getAreaProvinceListApi(params: Record<string, unknown>) {
  return request({ url: '/area/getAreaDetailList', method: 'post', data: params })
}

/** 分页获取按国家访问统计数据（v2 getAreaCountryListApi） */
export function getAreaCountryListApi(params: Record<string, unknown>) {
  return request({ url: '/area/getAreaDetailCountryList', method: 'post', data: params })
}

/** 分页获取按国家访问统计对比数据（v2 getAreaCountryCompareApi） */
export function getAreaCountryCompareApi(params: Record<string, unknown>) {
  return request({
    url: '/area/getAreaDetailCountryListByCompare',
    method: 'post',
    data: params,
  })
}

/** 分页获取按省份访问统计对比数据（v2 getAreaProvinceCompareApi） */
export function getAreaProvinceCompareApi(params: Record<string, unknown>) {
  return request({
    url: '/area/getAreaDetailProvinceListByCompare',
    method: 'post',
    data: params,
  })
}
