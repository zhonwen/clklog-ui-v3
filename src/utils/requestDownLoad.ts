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

let isLoggingOut = false

service.interceptors.response.use(
  (res): any => {
    if (res.status != 200) {
      if (res.status == 403) {
        if (!isLoggingOut) {
          isLoggingOut = true
          handleForbidden()
          setTimeout(() => {
            isLoggingOut = false
          }, 400)
        }
        return
      }
      ElMessage({
        message: res.statusText || 'Error',
        type: 'error',
        duration: 5 * 1000,
      })
      return Promise.reject(new Error(res.statusText || 'Error'))
    }
    return res
  },
  (error) => {
    ElMessage({
      message: error.statusText || error.message || error.msg || 'Error',
      type: 'error',
      duration: 5 * 1000,
    })
    return Promise.reject(error)
  },
)

export default service
