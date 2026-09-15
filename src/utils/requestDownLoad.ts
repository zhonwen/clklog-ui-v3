import axios from 'axios'
import { ElMessage } from 'element-plus'
import { attachAuth, getApiTimeout, handleForbidden, prefixApiUrl } from '@/utils/http'

const service = axios.create({
  baseURL: '',
  timeout: getApiTimeout(),
})

service.interceptors.request.use(
  (config) => {
    attachAuth(config, { attachXToken: true })
    const method = (config.method || 'get').toLowerCase()
    const url = config.url || ''
    const isMock = url.includes('/vue-element-admin/user')
    if ((method === 'post' || method === 'put') && !isMock) {
      if (!config.headers.get('Content-Type')) {
        config.headers.set('Content-Type', 'application/json;')
      }
      const downloadPath = '/exportJob/download'
      const channel = url === downloadPath ? 'ups' : 'api'
      config.url = prefixApiUrl(channel, url)
    }
    return config
  },
  (error) => Promise.reject(error),
)

/** responseType 是 blob 时，业务错误也会被包成 blob，需要读出来判断 */
async function readBlobError(data: unknown) {
  if (!(data instanceof Blob) || !data.type.includes('json')) return null
  try {
    return JSON.parse(await data.text()) as { code?: number; message?: string; msg?: string }
  } catch {
    return null
  }
}

service.interceptors.response.use(
  async (res) => {
    // 注意：axios 默认只有 2xx 进这里，非 2xx 一律走下面的 error 回调。
    // v2 里写在这里的 `res.status != 200` 分支实际永远走不到，已移到 error 回调。
    const bizError = await readBlobError(res.data)
    if (bizError) {
      if (bizError.code === 403) {
        handleForbidden()
        return Promise.reject(new Error('无权限'))
      }
      const message = bizError.message || bizError.msg || '导出失败'
      ElMessage({ message, type: 'error', duration: 5 * 1000 })
      return Promise.reject(new Error(message))
    }
    return res
  },
  (error) => {
    if (error?.response?.status === 403) {
      handleForbidden()
      return Promise.reject(error)
    }
    ElMessage({
      message: error?.response?.statusText || error?.message || '导出失败',
      type: 'error',
      duration: 5 * 1000,
    })
    return Promise.reject(error)
  },
)

export default service
