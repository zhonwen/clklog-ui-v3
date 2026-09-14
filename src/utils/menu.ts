import type { MenuItem } from '@/types/app'
import { joinPaths } from '@/utils/path'

const isVisible = (m?: MenuItem) => m && m.hidden !== true

export function hasVisibleMenu(menuList: MenuItem[]) {
  if (!Array.isArray(menuList) || menuList.length === 0) return false
  const stack = [...menuList]
  while (stack.length) {
    const item = stack.pop()
    if (item && item.hidden !== true && item.componentUri !== 'Layout') {
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
    const first = items.find((x) => isVisible(x))
    if (!first) return null
    const currBase = first.componentUri === 'Layout' ? joinPaths(base, first.path) : base
    if (first.componentUri === 'Layout') {
      return findFirstLeaf((first.children || []).filter((x) => isVisible(x)), currBase)
    }
    return joinPaths(base, first.path)
  }
  const first = menuList.find((x) => isVisible(x))
  if (!first) return null
  if (first.componentUri === 'Layout') {
    return findFirstLeaf((first.children || []).filter((x) => isVisible(x)), first.path)
  }
  return first.path
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
