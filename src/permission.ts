import NProgress from 'nprogress'
import { ElMessage } from 'element-plus'
import router from '@/router'
import { getToken } from '@/utils/auth'
import getPageTitle from '@/utils/get-page-title'
import { hasVisibleMenu } from '@/utils/menu'
import { usePermissionStore } from '@/stores/permission'
import { useTrackingStore } from '@/stores/tracking'
import { useUserStore } from '@/stores/user'

NProgress.configure({ showSpinner: false })

const whiteList = [
  '/login',
  '/auth-redirect',
  '/Unauthorized',
  '/NoPermission',
  '/NoProjectPermission',
  '/PermissionDenied',
]

const WIDTH = 992
function isMobile() {
  return document.body.getBoundingClientRect().width - 1 < WIDTH
}

router.beforeEach(async (to, _from, next) => {
  if (to.path != '/mete/customAnalysis' && to.path != '/mete/funnelAnalysis') {
    NProgress.start()
  }
  document.title = getPageTitle(to.meta.title as string | undefined)

  if (
    to.path === '/Unauthorized' ||
    to.path === '/NoPermission' ||
    to.path === '/NoProjectPermission' ||
    to.path === '/PermissionDenied'
  ) {
    next()
    NProgress.done()
    return
  }

  const userStore = useUserStore()
  const permissionStore = usePermissionStore()
  const trackingStore = useTrackingStore()
  const hasToken = getToken()

  if (hasToken) {
    if (to.path === '/login') {
      const permissionUriRoles = permissionStore.uriRoutes
      if (!permissionUriRoles) {
        next({ path: '/' })
        NProgress.done()
        return
      }
      if (permissionUriRoles[1] && permissionUriRoles[1].indexOf(permissionUriRoles[0] || '') !== -1) {
        next({ path: permissionUriRoles[1] })
        NProgress.done()
        return
      }
      next({ path: permissionUriRoles[0] || '/' })
      NProgress.done()
    } else {
      const permissionRoles = permissionStore.routes && permissionStore.routes.length > 0
      const permissionUriRoles = permissionStore.uriRoutes
      if (permissionRoles) {
        if (isMobile() && to.name !== 'summary') {
          const uriRoutes = permissionStore.uriRoutes || []
          if (uriRoutes.includes('/record/summary')) {
            next({ name: 'summary' })
            NProgress.done()
            return
          }
          next({ path: '/NoPermission' })
          NProgress.done()
          return
        }
        if (!permissionUriRoles) {
          next()
          return
        }
        if (permissionUriRoles.indexOf(to.path) === -1) {
          const switching = localStorage.getItem('projectSwitching') == '1'
          const canDefault = Array.isArray(permissionUriRoles) && permissionUriRoles.length > 0
          if ((to.path === '/' && canDefault) || (switching && canDefault)) {
            next({ path: permissionUriRoles[0] })
            NProgress.done()
            return
          }
          next({ path: '/NoPermission' })
          NProgress.done()
          return
        }
        next()
      } else {
        try {
          const menuList = userStore.menuList
          const hasMenu = hasVisibleMenu(menuList)
          if (!hasMenu) {
            const projectList = trackingStore.projectArray || []
            const hasProjectList = Array.isArray(projectList) && projectList.length > 0
            next({ path: hasProjectList ? '/NoProjectPermission' : '/Unauthorized' })
            NProgress.done()
            return
          }

          await permissionStore.generateAsyncRoutes(menuList)

          if (isMobile() && to.name !== 'summary') {
            const uriRoutes = permissionStore.uriRoutes || []
            if (uriRoutes.includes('/record/summary')) {
              next({ name: 'summary', replace: true })
              NProgress.done()
              return
            }
            next({ path: '/NoPermission', replace: true })
            NProgress.done()
            return
          }

          const uriRoutes = permissionStore.uriRoutes
          if (!uriRoutes) {
            next()
            return
          }
          if (uriRoutes.indexOf(to.path) === -1) {
            const switching = localStorage.getItem('projectSwitching') == '1'
            const canDefault = Array.isArray(uriRoutes) && uriRoutes.length > 0
            if ((to.path === '/' && canDefault) || (switching && canDefault)) {
              next({ path: uriRoutes[0] })
              NProgress.done()
              return
            }
            next({ path: '/NoPermission' })
            NProgress.done()
            return
          }
          next({ ...to, replace: true })
        } catch (error) {
          userStore.resetToken()
          ElMessage.error(typeof error === 'string' ? error : 'Has Error')
          if (to.path === '/Unauthorized' || to.path === '/NoPermission') {
            next(to.path)
          } else {
            next(`/login?redirect=${to.path}`)
          }
          NProgress.done()
        }
      }
    }
  } else if (whiteList.indexOf(to.path) !== -1) {
    next()
  } else {
    next(`/login?redirect=${to.path}`)
    NProgress.done()
  }
})

router.afterEach(() => {
  NProgress.done()
})
