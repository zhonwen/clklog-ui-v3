import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import router from '@/router'
import { useUserStore } from '@/stores/user'
import { getToken } from '@/utils/auth'

export type ApiChannel = 'api' | 'manage' | 'authmanage' | 'ups'

export interface ApiResult<T = unknown> {
  code: number
  message?: string
  msg?: string
  data?: T
}

const DEV_PREFIX: Record<ApiChannel, string> = {
  api: '/DEV-API',
  manage: '/DEV-API-MANAGE',
  authmanage: '/DEV-API-AUTHMANAGE',
  ups: '/DEV-API-UPSAPI',
}

const PROD_KEY: Record<ApiChannel, keyof Window['globalConfig']> = {
  api: 'BASE_API',
  manage: 'BASE_API_MANAGE',
  authmanage: 'BASE_API_AUTHMANAGE',
  ups: 'BASE_API_UPSAPI',
}

export function getApiTimeout() {
  const sec = window.globalConfig?.clklog_api_timeout
  return sec ? sec * 1000 : 60000
}

export function prefixApiUrl(channel: ApiChannel, url: string) {
  if (import.meta.env.DEV) {
    return `${DEV_PREFIX[channel]}${url}`
  }
  return `${window.globalConfig[PROD_KEY[channel]]}${url}`
}

const messageCache = new Map<string, number>()

export function showErrorOnce(msg: string, duration = 5000) {
  const key = `error:${msg}`
  const now = Date.now()
  const last = messageCache.get(key) || 0
  if (now - last < 3000) return
  messageCache.set(key, now)
  ElMessage({ message: msg, type: 'error', duration })
}

let isLoggingOut = false

export function handleForbidden() {
  if (isLoggingOut) return
  isLoggingOut = true
  const userStore = useUserStore()
  void userStore.logout().then(() => {
    setTimeout(() => {
      void router.push({ path: '/login' })
      isLoggingOut = false
    }, 400)
  })
}

export function handleTokenExpired() {
  ElMessageBox.confirm(
    'You have been logged out, you can cancel to stay on this page, or log in again',
    'Confirm logout',
    {
      confirmButtonText: 'Re-Login',
      cancelButtonText: 'Cancel',
      type: 'warning',
    },
  ).then(() => {
    useUserStore().resetToken()
    location.reload()
  })
}

export function attachAuth(
  config: InternalAxiosRequestConfig,
  options?: { attachXToken?: boolean },
) {
  const token = getToken()
  if (token) {
    if (options?.attachXToken) {
      config.headers.set('X-Token', token)
    }
    config.headers.set('Authorization', `Bearer ${token}`)
  }
  return config
}

export function applyDevProdPrefix(
  config: InternalAxiosRequestConfig,
  channel: ApiChannel,
) {
  const method = (config.method || 'get').toLowerCase()
  const url = config.url || ''
  const isMock = url.includes('/vue-element-admin/user')
  if ((method === 'post' || method === 'put') && !isMock) {
    if (!config.headers.get('Content-Type')) {
      config.headers.set('Content-Type', 'application/json;')
    }
    config.url = prefixApiUrl(channel, url)
  }
  return config
}

export interface CreateBizServiceOptions {
  channel: ApiChannel
  attachXToken?: boolean
  timeout?: number
  /** 返回 true 表示已自行处理，跳过默认报错 */
  onBizError?: (res: ApiResult, url: string) => boolean | ApiResult | Promise<unknown>
  onHttpError?: (error: unknown) => boolean
}

export function createBizService(options: CreateBizServiceOptions): AxiosInstance {
  const service = axios.create({
    baseURL: '',
    timeout: options.timeout ?? getApiTimeout(),
  })

  service.interceptors.request.use(
    (config) => {
      attachAuth(config, { attachXToken: options.attachXToken })
      return applyDevProdPrefix(config, options.channel)
    },
    (error) => Promise.reject(error),
  )

  service.interceptors.response.use(
    async (response: AxiosResponse<ApiResult>): Promise<any> => {
      const res = response.data
      if (res.code == 403) {
        handleForbidden()
        return
      }
      if (res.code !== 200) {
        const url = response.config.url || ''
        const handled = await options.onBizError?.(res, url)
        if (handled === true) return
        if (handled && handled !== false) return handled

        if (res.code == 423) {
          return router.replace('/PermissionDenied')
        }

        showErrorOnce(res.message || res.msg || 'Error')
        if (res.code === 50008 || res.code === 50012 || res.code === 50014) {
          handleTokenExpired()
        }
        return Promise.reject(new Error(res.message || res.msg || 'Error'))
      }
      return res
    },
    (error) => {
      if (options.onHttpError?.(error)) {
        return Promise.reject(error)
      }
      showErrorOnce(error?.message || error?.msg || 'Error')
      return Promise.reject(error)
    },
  )

  return service
}

export function wrapService(service: AxiosInstance) {
  return function request<T = unknown>(config: AxiosRequestConfig) {
    return service(config) as Promise<ApiResult<T>>
  }
}
