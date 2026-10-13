import type { MenuItem } from '@/types/app'
import { resolveRoutePath } from '@/utils/path'
import { isExternal } from '@/utils/validate'

function isHiddenFlag(val: unknown) {
  return val === true || val === 'true' || val === 1 || val === '1'
}

const isVisible = (m?: MenuItem) => !!m && !isHiddenFlag(m.hidden)
const isInternal = (path?: string) => !!path && !isExternal(path)

export const EXTRA_URI_PATHS = [
  '/NoPermission',
  '/NoProjectPermission',
  '/PermissionDenied',
  '/Unauthorized',
  '/LoginExpired',
  '/redirect',
  '/login',
  '/auth-redirect',
]

export function hasVisibleMenu(menuList: MenuItem[]) {
  if (!Array.isArray(menuList) || menuList.length === 0) return false
  const stack = [...menuList]
  while (stack.length) {
    const item = stack.pop()
    if (item && !isHiddenFlag(item.hidden) && item.componentUri !== 'Layout' && isInternal(item.path)) {
      return true
    }
    if (item && Array.isArray(item.children) && item.children.length > 0) {
      stack.push(...item.children)
    }
  }
  return false
}

export function getFirstRoutePath(menuList: MenuItem[]) {
  if (!Array.isArray(menuList) || menuList.length === 0) return null
  const findFirstLeaf = (items: MenuItem[], base = ''): string | null => {
    for (const first of items) {
      if (!isVisible(first) || !isInternal(first.path)) continue
      if (first.componentUri === 'Layout') {
        const childPath = findFirstLeaf(
          (first.children || []).filter((x) => isVisible(x)),
          resolveRoutePath(base, first.path),
        )
        if (childPath) return childPath
        continue
      }
      return resolveRoutePath(base, first.path)
    }
    return null
  }
  return findFirstLeaf(menuList)
}

export function isAllowedPath(uriRoutes: string[] | null | undefined, path: string) {
  if (!path || !Array.isArray(uriRoutes) || uriRoutes.length === 0) return false
  if (uriRoutes.includes(path)) return true
  if (path === '/') return false
  return uriRoutes.some((item) => item === path || item.startsWith(`${path}/`))
}

export function pickFirstUriPath(uriRoutes: string[] | null | undefined) {
  if (!Array.isArray(uriRoutes) || uriRoutes.length === 0) return ''
  const extra = new Set(EXTRA_URI_PATHS)
  return uriRoutes.find(
    (item) => item && !extra.has(item) && !item.startsWith('/login') && !isExternal(item),
  ) || ''
}

export function pickEntryPath(
  menuList: MenuItem[],
  redirect?: string,
  uriRoutes?: string[] | null,
) {
  if (
    redirect &&
    !isExternal(redirect) &&
    uriRoutes?.includes(redirect) &&
    !EXTRA_URI_PATHS.includes(redirect)
  ) {
    return redirect
  }
  return (
    getFirstRoutePath(menuList) ||
    pickFirstUriPath(uriRoutes) ||
    getPermissionRedirectPath(menuList) ||
    '/'
  )
}

export function getPermissionRedirectPath(menuList: MenuItem[]) {
  let projectList: unknown[] = []
  try {
    projectList = JSON.parse(localStorage.getItem('projectList') || '[]')
  } catch {
    projectList = []
  }
  const hasMenu = hasVisibleMenu(menuList)
  const hasProjectList = Array.isArray(projectList) && projectList.length > 0
  if (!hasMenu && !hasProjectList) return '/Unauthorized'
  if (!hasMenu && hasProjectList) return '/NoProjectPermission'
  return '/NoPermission'
}
