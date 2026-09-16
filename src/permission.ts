import NProgress from 'nprogress'
import { ElMessage } from 'element-plus'
import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router'
import router from '@/router'
import { getToken } from '@/utils/auth'
import getPageTitle from '@/utils/get-page-title'
import { getVisibleRouteTitle } from '@/utils/route-meta'
import { hasVisibleMenu, isAllowedPath, pickEntryPath, pickFirstUriPath } from '@/utils/menu'
import { usePermissionStore } from '@/stores/permission'
import { useTrackingStore } from '@/stores/tracking'
import { useUserStore } from '@/stores/user'
import { isProjectSwitching } from '@/utils/project-switching'
import { CUSTOM_ANALYSIS_PATH, FUNNEL_ANALYSIS_PATH, SUMMARY_PATH } from '@/router/paths'

NProgress.configure({ showSpinner: false })

const whiteList = [
  '/login',
  '/auth-redirect',
  '/Unauthorized',
  '/NoPermission',
  '/NoProjectPermission',
  '/PermissionDenied',
]

const errorPages = ['/Unauthorized', '/NoPermission', '/NoProjectPermission', '/PermissionDenied']

const WIDTH = 992
function isMobile() {
  return document.body.getBoundingClientRect().width - 1 < WIDTH
}

/**
 * 守卫的返回值约定（vue-router 4+ 风格，next() 已废弃）：
 *   undefined / true → 放行
 *   RouteLocationRaw → 重定向
 */
type GuardResult = RouteLocationRaw | undefined

/** 移动端只允许停留在领导驾驶舱（v2 permission.js 的同名逻辑） */
function decideMobileTarget(to: RouteLocationNormalized, uriRoutes: string[] | null): GuardResult {
  if (!isMobile()) return undefined
  if (to.name === 'summary' || to.path === SUMMARY_PATH) return undefined
  const list = uriRoutes || []
  // 按 path 跳转：菜单的 component 字段不一定叫 summary，
  // vue-router 4+ 遇到不存在的 name 会直接抛错导致白屏（vue-router 3 只是警告）
  return list.includes(SUMMARY_PATH) ? { path: SUMMARY_PATH } : { path: '/NoPermission' }
}

/** uriRoutes 路径白名单校验 + 兜底落地页。原来在两个分支里各抄了一遍（旧 I-17） */
function decideUriTarget(to: RouteLocationNormalized, uriRoutes: string[] | null): GuardResult {
  if (!uriRoutes) return undefined
  if (isAllowedPath(uriRoutes, to.path)) return undefined
  const canDefault = Array.isArray(uriRoutes) && uriRoutes.length > 0
  if (canDefault && (to.path === '/' || to.path === '/index' || isProjectSwitching())) {
    const fallback = pickFirstUriPath(uriRoutes) || uriRoutes[0]
    return { path: fallback || '/NoPermission' }
  }
  return { path: '/NoPermission' }
}

router.beforeEach(async (to): Promise<GuardResult | boolean> => {
  if (to.path != CUSTOM_ANALYSIS_PATH && to.path != FUNNEL_ANALYSIS_PATH) {
    NProgress.start()
  }
  const permissionStore = usePermissionStore()
  document.title = getPageTitle(getVisibleRouteTitle(to, permissionStore.routes))

  // 错误页直接放行，避免和下面的权限判断互相打架
  if (errorPages.includes(to.path)) {
    NProgress.done()
    return undefined
  }

  const userStore = useUserStore()
  const trackingStore = useTrackingStore()

  if (!getToken()) {
    if (whiteList.indexOf(to.path) !== -1) return undefined
    NProgress.done()
    return `/login?redirect=${to.path}`
  }

  // 已登录时不允许停在登录页，直接送到落地页
  if (to.path === '/login') {
    const entry =
      pickEntryPath(userStore.menuList, undefined, permissionStore.uriRoutes) ||
      pickFirstUriPath(permissionStore.uriRoutes) ||
      '/'
    NProgress.done()
    return { path: entry }
  }

  // 动态路由已生成
  if (permissionStore.routes && permissionStore.routes.length > 0) {
    const mobileTarget = decideMobileTarget(to, permissionStore.uriRoutes)
    if (mobileTarget) {
      NProgress.done()
      return mobileTarget
    }
    const uriTarget = decideUriTarget(to, permissionStore.uriRoutes)
    if (uriTarget) {
      NProgress.done()
      return uriTarget
    }
    return undefined
  }

  // 首次进入：用菜单生成动态路由
  try {
    const menuList = userStore.menuList
    if (!hasVisibleMenu(menuList)) {
      const projectList = trackingStore.projectArray || []
      const hasProjectList = Array.isArray(projectList) && projectList.length > 0
      NProgress.done()
      return { path: hasProjectList ? '/NoProjectPermission' : '/Unauthorized' }
    }

    await permissionStore.generateAsyncRoutes(menuList)

    const mobileTarget = decideMobileTarget(to, permissionStore.uriRoutes)
    if (mobileTarget) {
      NProgress.done()
      return { ...(mobileTarget as object), replace: true } as RouteLocationRaw
    }
    const uriTarget = decideUriTarget(to, permissionStore.uriRoutes)
    if (uriTarget) {
      NProgress.done()
      return uriTarget
    }
    // 路由是刚加进来的，重新走一次导航让它生效
    return { ...to, replace: true }
  } catch (error) {
    userStore.resetToken()
    ElMessage.error(typeof error === 'string' ? error : 'Has Error')
    NProgress.done()
    if (to.path === '/Unauthorized' || to.path === '/NoPermission') return to.path
    return `/login?redirect=${to.path}`
  }
})

router.afterEach(() => {
  NProgress.done()
})

// 导航期间抛出的异常（含组件渲染/更新错误，它们会被 finalizeNavigation 的 promise 链捕获）
// 默认只打印一句 "Uncaught error during route navigation"，看不出是哪来的。
// 这里显式接管，至少保证进度条不会卡住，并把原始错误打全。
router.onError((error, to, from) => {
  NProgress.done()
  console.error('[router] 导航出错', { to: to.fullPath, from: from.fullPath }, error)
})
