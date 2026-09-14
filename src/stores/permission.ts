import type { RouteRecordRaw } from 'vue-router'
import { defineStore } from 'pinia'
import router, { constantRoutes, markDynamicRoutes, resetRouter } from '@/router'
import type { MenuItem } from '@/types/app'
import { loadView } from '@/utils/load-view'
import { joinPaths } from '@/utils/path'

export type AppRouteRecordRaw = Omit<RouteRecordRaw, 'children' | 'name' | 'redirect'> & {
  hidden?: boolean
  alwaysShow?: boolean
  noShowingChildren?: boolean
  name?: string
  redirect?: string
  children?: AppRouteRecordRaw[]
}

function isHttpOrHttps(url: string) {
  return url.startsWith('http://') || url.startsWith('https://')
}

function isVisible(menu?: MenuItem) {
  return menu?.hidden !== true
}

function getFirstVisibleChild(node: MenuItem) {
  if (!Array.isArray(node.children)) return null
  return node.children.find((c) => isVisible(c)) || null
}

function getFirstChildFullPath(item: MenuItem) {
  if (!Array.isArray(item.children)) return null
  let node = getFirstVisibleChild(item)
  if (!node) return null
  let fullPath = joinPaths(item.path, node.path)
  while (node && Array.isArray(node.children) && node.children.length > 0) {
    const next = getFirstVisibleChild(node)
    if (!next) break
    node = next
    fullPath = joinPaths(fullPath, node.path)
  }
  return isVisible(node) ? fullPath : null
}

function findFirstVisibleLeaf(menuList: MenuItem[]) {
  if (!Array.isArray(menuList) || menuList.length === 0) return null
  const top = menuList.find((x) => isVisible(x))
  if (!top) return null
  if (top.componentUri !== 'Layout') return top
  let node = getFirstVisibleChild(top)
  if (!node) return null
  while (node && Array.isArray(node.children) && node.children.length > 0) {
    const next = getFirstVisibleChild(node)
    if (!next) break
    node = next
  }
  return node
}

function convertToRoutes(menuList: MenuItem[]): AppRouteRecordRaw[] {
  const routes: AppRouteRecordRaw[] = []
  menuList.forEach((item) => {
    if (item.componentUri === 'Layout') {
      const childrenRoutes = item.children ? convertToRoutes(item.children) : []
      const route: AppRouteRecordRaw = {
        alwaysShow: false,
        path: item.path,
        name: item.component || `layout-${item.path}`,
        component: () => import('@/layout/index.vue'),
        redirect: getFirstChildFullPath(item) || 'noRedirect',
        meta: {
          title: item.name,
          icon: item.icon,
          hideSidebar: item.hideSidebar === true,
        },
        hidden: item.hidden,
      }
      if (childrenRoutes.length > 0) {
        const redirectMap: Record<string, string> = {
          userTag: 'userTag/list',
          userGroup: 'userGroup/list',
          userportrait: 'userportrait/list',
          userReview: 'userReview/list',
        }
        childrenRoutes.forEach((child) => {
          const name = String(child.name || '')
          if (redirectMap[name]) {
            child.redirect = redirectMap[name]
          }
        })
        route.children = childrenRoutes
      }
      routes.push(route)
    } else {
      let newPath = item.path
      if (item.externalLink && !isHttpOrHttps(item.path)) {
        newPath = window.location.origin + item.path
      }
      const childrenRoutes = item.children ? convertToRoutes(item.children) : []
      const route: AppRouteRecordRaw = {
        path: newPath,
        name: item.component || `view-${newPath}`,
        component: loadView(item.componentUri),
        meta: {
          title: item.name,
          icon: item.icon,
          hideSidebar: item.hideSidebar === true,
        },
        hidden: item.hidden,
      }
      if (childrenRoutes.length > 0) {
        route.children = childrenRoutes
        route.redirect = getFirstChildFullPath(item) || 'noRedirect'
      }
      routes.push(route)
    }
  })
  return routes
}

function convertToUriRoutes(menuList: MenuItem[], parentPath = '', isRoot = true): string[] {
  let uriRoutes: string[] = []
  menuList.forEach((item) => {
    if (isRoot && item.hidden == true && item.componentUri !== 'Layout') {
      return
    }
    let currentPath = item.path
    if (!isHttpOrHttps(item.path)) {
      currentPath = joinPaths(parentPath, item.path)
    }
    if (item.componentUri !== 'Layout') {
      uriRoutes.push(currentPath)
    }
    if (item.children) {
      uriRoutes = uriRoutes.concat(convertToUriRoutes(item.children, currentPath, false))
    }
  })
  return uriRoutes
}

function parseUriRoutes(): string[] | null {
  try {
    const raw = localStorage.getItem('uriRoutes')
    return raw ? (JSON.parse(raw) as string[]) : null
  } catch {
    return null
  }
}

export const usePermissionStore = defineStore('permission', {
  state: () => ({
    routes: [] as AppRouteRecordRaw[],
    addRoutes: [] as AppRouteRecordRaw[],
    uriRoutes: parseUriRoutes(),
    addedRouteNames: [] as string[],
  }),
  actions: {
    generateAsyncRoutes(menuList: MenuItem[]) {
      const rawMenuList = Array.isArray(menuList)
        ? (JSON.parse(JSON.stringify(menuList)) as MenuItem[])
        : []
      localStorage.setItem('menuList', JSON.stringify(rawMenuList))
      const accessedRoutes = convertToRoutes(rawMenuList)
      findFirstVisibleLeaf(rawMenuList)
      let uriRoutes = convertToUriRoutes(rawMenuList)
      uriRoutes.push(
        '/NoPermission',
        '/NoProjectPermission',
        '/PermissionDenied',
        '/Unauthorized',
        '/redirect',
        '/login',
        '/auth-redirect',
      )
      this.uriRoutes = uriRoutes
      localStorage.setItem('uriRoutes', JSON.stringify(uriRoutes))
      this.setRoutes(accessedRoutes)
      return accessedRoutes
    },
    setRoutes(routes: AppRouteRecordRaw[]) {
      resetRouter()
      this.addRoutes = routes
      this.routes = (constantRoutes as AppRouteRecordRaw[]).concat(routes)
      const names: string[] = []
      routes.forEach((route) => {
        router.addRoute(route as RouteRecordRaw)
        if (typeof route.name === 'string') {
          names.push(route.name)
        }
      })
      this.addedRouteNames = names
      markDynamicRoutes(names)
    },
  },
})
