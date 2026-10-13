import Cookies from 'js-cookie'
import router from '@/router'
import { useUserStore } from '@/stores/user'
import type { ApiResult } from '@/utils/http'

let isRedirecting = false

export function isLoginExpiredCode(code: unknown): boolean {
  return code == 419
}

function resolveUsername(response?: { config?: { data?: unknown } }): string {
  let username = ''
  try {
    const reqData = response?.config?.data
    const parsed = typeof reqData === 'string' ? JSON.parse(reqData) : reqData || {}
    const obj = parsed as { username?: string; userName?: string }
    username = obj.username || obj.userName || ''
  } catch {
    username = ''
  }
  if (username) return username
  try {
    const raw = Cookies.get('userInfo')
    const userInfo = raw ? (JSON.parse(raw) as { username?: string }) : null
    username = (userInfo && userInfo.username) || ''
  } catch {
    username = ''
  }
  if (username) return username
  return sessionStorage.getItem('loginExpiredUsername') || ''
}

export function redirectToLoginExpired(response?: { config?: { data?: unknown } }): boolean {
  if (isRedirecting) return true
  const currentPath = router.currentRoute.value?.path || ''
  if (currentPath === '/LoginExpired') {
    return false
  }
  isRedirecting = true
  const username = resolveUsername(response)
  if (username) {
    sessionStorage.setItem('loginExpiredUsername', username)
  }
  useUserStore().resetToken()
  const query = username ? { username } : {}
  void router.replace({ path: '/LoginExpired', query }).finally(() => {
    isRedirecting = false
  })
  return true
}

export function handleLoginExpired(
  res: ApiResult | undefined,
  response?: { config?: { data?: unknown } },
): boolean {
  if (!isLoginExpiredCode(res?.code)) return false
  return redirectToLoginExpired(response)
}
