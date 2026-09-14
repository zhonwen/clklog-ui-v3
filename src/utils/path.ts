import { isExternal } from '@/utils/validate'

export function joinPaths(parent: string, child: string) {
  const p = (parent || '').replace(/\/+$/g, '')
  const c = (child || '').replace(/^\/+/g, '')
  if (!p) return `/${c}`
  if (!c) return p.startsWith('/') ? p : `/${p}`
  return `${p}/${c}`
}

export function resolveRoutePath(basePath: string, routePath: string) {
  if (isExternal(routePath)) return routePath
  if (isExternal(basePath)) return basePath
  if (routePath.startsWith('/')) return normalizePath(routePath)
  return normalizePath(joinPaths(basePath, routePath))
}

export function normalizePath(path: string) {
  const parts = path.split('/')
  const stack: string[] = []
  for (const part of parts) {
    if (!part || part === '.') continue
    if (part === '..') stack.pop()
    else stack.push(part)
  }
  return `/${stack.join('/')}`
}
