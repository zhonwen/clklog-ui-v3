/**
 * 下载任务中心（views/ups/components/tast-center.vue 用）。
 *
 * v2 里这几个接口是散的：
 *   exportJobGetList / exportJobDelete 挂在 api/upsapi/tagmanage.js（requestUps，ups 通道）
 *   exportJobDownload 挂在 api/trackingapi/download.js（requestDownLoad，responseType: blob）
 * v3 把前两个收口到本文件；exportJobDownload 已经在 api/trackingapi/download.ts 迁好了
 * （requestDownLoad 里对 '/exportJob/download' 单独走 ups 通道前缀），这里只做转出，
 * 避免同一个接口出现两份 axios 定义。
 */
import request from '@/utils/requestUps'

export { exportJobDownload } from '@/api/trackingapi/download'

/** 导出任务列表 */
export function exportJobGetList(params: Record<string, unknown>) {
  return request({ url: '/exportJob/getList', method: 'post', data: params })
}

/** 删除导出任务 */
export function exportJobDelete(params: Record<string, unknown>) {
  return request({ url: '/exportJob/delete', method: 'post', data: params })
}
