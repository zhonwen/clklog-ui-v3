const modules = import.meta.glob('../views/**/*.vue')

export function loadView(componentUri?: string) {
  if (!componentUri || componentUri === 'Layout') {
    return () => import('@/views/placeholder/index.vue')
  }
  const normalized = componentUri.replace(/^\//, '').replace(/\.vue$/, '')
  const candidates = [
    `../views/${normalized}.vue`,
    `../views/${normalized}/index.vue`,
  ]
  for (const key of candidates) {
    if (modules[key]) {
      return modules[key]
    }
  }
  return () => import('@/views/placeholder/index.vue')
}
