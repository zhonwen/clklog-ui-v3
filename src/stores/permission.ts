import type { RouteRecordRaw } from 'vue-router'
import { defineStore } from 'pinia'
import router, { constantRoutes, markDynamicRoutes, resetRouter } from '@/router'
import type { MenuItem } from '@/types/app'
import { EXTRA_URI_PATHS } from '@/utils/menu'
import { loadView } from '@/utils/load-view'
import { resolveRoutePath } from '@/utils/path'
import { isExternal } from '@/utils/validate'

export type AppRouteRecordRaw = Omit<RouteRecordRaw, 'children' | 'name' | 'redirect'> & {
  hidden?: boolean
  alwaysShow?: boolean
  noShowingChildren?: boolean
  name?: string
  redirect?: string
  children?: AppRouteRecordRaw[]
}

const CHILD_REDIRECT_MAP: Record<string, string> = {
  userTag: 'userTag/list',
  userGroup: 'userGroup/list',
  userportrait: 'userportrait/list',
  userReview: 'userReview/list',
}

function isHttpOrHttps(url: string) {
  return isExternal(url)
}

function isVisible(menu?: MenuItem) {
  return menu?.hidden !== true
}

function getFirstVisibleChild(node: MenuItem) {
  if (!Array.isArray(node.children)) return null
  return (
    node.children.find((c) => isVisible(c) && !isExternal(c.path || '')) ||
    node.children.find((c) => isVisible(c)) ||
    null
  )
}

function getFirstChildFullPath(item: MenuItem) {
  if (!Array.isArray(item.children)) return null
  let node = getFirstVisibleChild(item)
  if (!node) return null
  let fullPath = resolveRoutePath(item.path, node.path)
  while (node && Array.isArray(node.children) && node.children.length > 0) {
    const next = getFirstVisibleChild(node)
    if (!next) break
    node = next
    fullPath = resolveRoutePath(fullPath, node.path)
  }
  return isVisible(node) && !isExternal(fullPath) ? fullPath : null
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

function collectRouteNames(routes: AppRouteRecordRaw[], into: Set<string>) {
  routes.forEach((route) => {
    if (typeof route.name === 'string' && route.name) into.add(route.name)
    if (route.children?.length) collectRouteNames(route.children, into)
  })
}

function uniquifyRouteNames(routes: AppRouteRecordRaw[], used: Set<string>) {
  routes.forEach((route) => {
    const preferred =
      (typeof route.name === 'string' && route.name) ||
      `route-${String(route.path || 'unnamed').replace(/\W+/g, '_')}`
    let name = preferred
    let i = 2
    while (used.has(name)) {
      name = `${preferred}__${i++}`
    }
    used.add(name)
    route.name = name
    if (route.children?.length) uniquifyRouteNames(route.children, used)
  })
}

/** Vue Router 4+ 顶层 path 必须以 / 开头；子路由保持相对路径 */
function toRootPath(path: string) {
  if (!path) return '/'
  if (isHttpOrHttps(path)) return path
  return path.startsWith('/') ? path : `/${path}`
}

function convertToRoutes(menuList: MenuItem[], isRoot = true): AppRouteRecordRaw[] {
  const routes: AppRouteRecordRaw[] = []
  menuList.forEach((item) => {
    const routePath = isRoot ? toRootPath(item.path) : item.path
    if (item.componentUri === 'Layout') {
      const childrenRoutes = item.children ? convertToRoutes(item.children, false) : []
      const route: AppRouteRecordRaw = {
        alwaysShow: false,
        path: routePath,
        name: item.component || `layout-${item.path}`,
        component: () => import('@/layout/index.vue'),
        meta: {
          title: item.name,
          icon: item.icon,
          hideSidebar: item.hideSidebar === true,
        },
        hidden: item.hidden,
      }
      const firstChildPath = getFirstChildFullPath(item)
      if (firstChildPath && !isExternal(firstChildPath)) route.redirect = firstChildPath
      if (childrenRoutes.length > 0) {
        childrenRoutes.forEach((child) => {
          const name = String(child.name || '')
          if (CHILD_REDIRECT_MAP[name]) {
            child.redirect = CHILD_REDIRECT_MAP[name]
          }
        })
        route.children = childrenRoutes
      }
      routes.push(route)
    } else {
      let newPath = isRoot ? toRootPath(item.path) : item.path
      if (item.externalLink && !isHttpOrHttps(item.path)) {
        newPath = window.location.origin + item.path
      }
      const childrenRoutes = item.children ? convertToRoutes(item.children, false) : []
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
        const firstChildPath = getFirstChildFullPath(item)
        if (firstChildPath && !isExternal(firstChildPath)) route.redirect = firstChildPath
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
      currentPath = resolveRoutePath(parentPath, item.path)
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

function cloneForRouter(routes: AppRouteRecordRaw[]): AppRouteRecordRaw[] {
  const result: AppRouteRecordRaw[] = []
  routes.forEach((route) => {
    if (isExternal(String(route.path || ''))) return
    const copy: AppRouteRecordRaw = { ...route }
    if (copy.redirect && isExternal(String(copy.redirect))) {
      delete copy.redirect
    }
    if (copy.children?.length) {
      const children = cloneForRouter(copy.children)
      if (children.length > 0) copy.children = children
      else delete copy.children
    }
    result.push(copy)
  })
  return result
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
      const usedNames = new Set<string>()
      collectRouteNames(constantRoutes as AppRouteRecordRaw[], usedNames)
      uniquifyRouteNames(accessedRoutes, usedNames)
      findFirstVisibleLeaf(rawMenuList)
      const uriRoutes = convertToUriRoutes(rawMenuList).concat(EXTRA_URI_PATHS)
      this.uriRoutes = uriRoutes
      localStorage.setItem('uriRoutes', JSON.stringify(uriRoutes))
      this.setRoutes(accessedRoutes)
      return accessedRoutes
    },
    setRoutes(routes: AppRouteRecordRaw[]) {
      resetRouter()
      this.addRoutes = routes
      this.routes = (constantRoutes as AppRouteRecordRaw[]).concat(routes)
      const routerRoutes = cloneForRouter(routes)
      const names: string[] = []
      routerRoutes.forEach((route) => {
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
