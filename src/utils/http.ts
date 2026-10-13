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
import { handleLoginExpired } from '@/utils/loginExpired'

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
  ElMessageBox.confirm('登录状态已失效，可以取消继续留在本页，或重新登录。', '重新登录', {
    confirmButtonText: '重新登录',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => {
      useUserStore().resetToken()
      location.reload()
    })
    .catch(() => undefined)
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
  const url = config.url || ''
  // mock 地址直通，不加任何前缀
  if (url.includes('/vue-element-admin/user')) return config

  const method = (config.method || 'get').toLowerCase()
  if ((method === 'post' || method === 'put') && !config.headers.get('Content-Type')) {
    config.headers.set('Content-Type', 'application/json;')
  }
  // 前缀与 method 解耦：v2 的 request.js 对 get 也加前缀，
  // 之前只处理 post/put，新增的 GET 接口会直接打到前端域名上。
  config.url = prefixApiUrl(channel, url)
  return config
}

export interface CreateBizServiceOptions {
  channel: ApiChannel
  attachXToken?: boolean
  timeout?: number
  /** 在 423 判断「之前」执行的特判（漏斗分析静默、书签不存在）。返回 true 或 ApiResult 表示已处理 */
  beforeBizError?: (res: ApiResult, url: string) => boolean | ApiResult | Promise<unknown>
  /** 在 423 判断「之后」执行的特判。返回 true 表示已自行处理，跳过默认报错 */
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

  /**
   * 所有「已处理」的分支都回传一个 ApiResult，而不是 undefined 或 router.replace() 的 Promise。
   * 否则 wrapService 声明的返回类型就是假的，调用方 `res.code` 会在 403 / 423 时抛
   * Cannot read properties of undefined。调用方按 `res.code === 200` 判断，
   * 拿到非 200 的结果自然会跳过后续逻辑。
   */
  async function onResponse(response: AxiosResponse<ApiResult>): Promise<ApiResult> {
    const res = response.data
    if (res.code == 403) {
      handleForbidden()
      return res
    }
    if (handleLoginExpired(res, response)) {
      showErrorOnce(res.message || res.msg || 'Error')
      return Promise.reject(new Error(res.message || res.msg || 'Error'))
    }
    if (res.code !== 200) {
      const url = response.config.url || ''
      // v2 里各通道的特判分两组：一组在 423 之前（漏斗分析静默、书签不存在），
      // 一组在 423 之后（自定义分析模型错误、UPS 唯一标识重复）。顺序不能颠倒，
      // 否则 423 会被特判吃掉，用户看到的是业务提示而不是跳「权限不足」页。
      const pre = await options.beforeBizError?.(res, url)
      if (pre === true) return res
      if (pre && pre !== false) return pre as ApiResult

      if (res.code == 423) {
        void router.replace('/PermissionDenied')
        return res
      }

      const handled = await options.onBizError?.(res, url)
      if (handled === true) return res
      if (handled && handled !== false) return handled as ApiResult

      showErrorOnce(res.message || res.msg || 'Error')
      if (res.code === 50008 || res.code === 50012 || res.code === 50014) {
        handleTokenExpired()
      }
      return Promise.reject(new Error(res.message || res.msg || 'Error'))
    }
    return res
  }

  service.interceptors.response.use(
    // axios 的拦截器签名要求回传 AxiosResponse，而这里刻意只回传 response.data，
    // 整个项目唯一一处需要跨这个边界的类型转换就收在这一行。
    onResponse as unknown as (response: AxiosResponse) => Promise<AxiosResponse>,
    (error) => {
      const res = error?.response?.data as ApiResult | undefined
      if (handleLoginExpired(res, error?.response)) {
        showErrorOnce((res && (res.message || res.msg)) || error?.message || 'Error')
        return Promise.reject(error)
      }
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
    // 响应拦截器已经把 AxiosResponse 换成了 ApiResult，这里只是把类型对上
    return service(config) as unknown as Promise<ApiResult<T>>
  }
}
