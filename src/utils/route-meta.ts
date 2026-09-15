import type { RouteLocationNormalized, RouteRecordNormalized } from 'vue-router'
import { resolveRoutePath } from '@/utils/path'
import { isExternal } from '@/utils/validate'

type RouteLike = {
  path?: string
  hidden?: boolean
  meta?: {
    title?: unknown
    hidden?: boolean
    hideSidebar?: boolean
  }
  children?: RouteLike[]
}

function isHiddenFlag(val: unknown) {
  return val === true || val === 'true' || val === 1 || val === '1'
}

function isHiddenMeta(meta?: RouteLike['meta'] | RouteRecordNormalized['meta']) {
  return isHiddenFlag(meta?.hidden)
}

function isHiddenRoute(route: RouteLike) {
  return isHiddenFlag(route.hidden) || isHiddenMeta(route.meta)
}

/** 隐藏目录（如「默认权限（勿删）」）不进侧栏，其可见子菜单提升到当前层。 */
export function visibleSidebarRoutes<T extends RouteLike>(routes: T[], parentPath = ''): T[] {
  const result: T[] = []
  for (const route of routes) {
    const rawPath = String(route.path || '')
    const fullPath = isExternal(rawPath) ? rawPath : resolveRoutePath(parentPath, rawPath)
    if (isHiddenRoute(route)) {
      if (route.children?.length) {
        result.push(...visibleSidebarRoutes(route.children as T[], fullPath))
      }
      continue
    }
    result.push(parentPath ? ({ ...route, path: fullPath } as T) : route)
  }
  return result
}

function findVisibleTitleByPath(routes: RouteLike[], path: string, parentPath = ''): string | undefined {
  for (const route of routes) {
    const rawPath = String(route.path || '')
    const fullPath = isExternal(rawPath) ? rawPath : resolveRoutePath(parentPath, rawPath)
    const hidden = isHiddenRoute(route)
    if (!hidden && fullPath === path && route.meta?.title) {
      return String(route.meta.title)
    }
    if (route.children?.length) {
      const found = findVisibleTitleByPath(route.children, path, fullPath)
      if (found) return found
    }
  }
  return undefined
}

/** 标题、侧边栏只认非 hidden 的 matched；隐藏菜单（如「默认权限（勿删）」）不参与。 */
export function getVisibleRouteTitle(to: RouteLocationNormalized, routes: RouteLike[] = []) {
  for (let i = to.matched.length - 1; i >= 0; i--) {
    const meta = to.matched[i].meta
    if (isHiddenMeta(meta)) continue
    if (meta?.title) return String(meta.title)
  }
  return findVisibleTitleByPath(routes, to.path)
}

export function shouldHideSidebarByMeta(to: RouteLocationNormalized) {
  return to.matched.some((record) => record.meta?.hideSidebar === true && !isHiddenMeta(record.meta))
}
