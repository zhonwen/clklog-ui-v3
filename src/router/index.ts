import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'
import { hideSidebarPathNames } from '@/utils/index'
import { shouldHideSidebarByMeta } from '@/utils/route-meta'
import { useAppStore } from '@/stores/app'
import type { AppRouteRecordRaw } from '@/stores/permission'

const Layout = () => import('@/layout/index.vue')

export const constantRoutes: AppRouteRecordRaw[] = [
  {
    path: '/redirect',
    component: Layout,
    hidden: true,
    children: [
      {
        path: '/redirect/:path(.*)',
        component: () => import('@/views/redirect/index.vue'),
      },
    ],
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/login/index.vue'),
    hidden: true,
  },
  {
    path: '/auth-redirect',
    component: () => import('@/views/login/auth-redirect.vue'),
    hidden: true,
  },
  {
    path: '/NoPermission',
    component: Layout,
    hidden: true,
    children: [
      {
        path: '',
        name: 'Error404',
        component: () => import('@/views/error-page/NoPermission.vue'),
        meta: { hideSidebar: false, title: '无权限' },
      },
    ],
  },
  {
    path: '/Unauthorized',
    name: 'Unauthorized',
    component: () => import('@/views/error-page/Unauthorized.vue'),
    hidden: true,
  },
  {
    path: '/NoProjectPermission',
    component: Layout,
    hidden: true,
    children: [
      {
        path: '',
        name: 'NoProjectPermission',
        component: () => import('@/views/error-page/NoProjectPermission.vue'),
        meta: { hideSidebar: true, title: '无项目菜单权限' },
      },
    ],
  },
  {
    path: '/PermissionDenied',
    component: Layout,
    hidden: true,
    children: [
      {
        path: '',
        name: 'PermissionDenied',
        component: () => import('@/views/error-page/PermissionDenied.vue'),
        meta: { hideSidebar: false, title: '权限不足' },
      },
    ],
  },
]

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  scrollBehavior: () => ({ top: 0, left: 0 }),
  routes: constantRoutes as RouteRecordRaw[],
})

let dynamicRouteNames: string[] = []

export function resetRouter() {
  dynamicRouteNames.forEach((name) => {
    if (router.hasRoute(name)) {
      router.removeRoute(name)
    }
  })
  dynamicRouteNames = []
}

export function markDynamicRoutes(names: string[]) {
  dynamicRouteNames = names
}

router.beforeEach((to, _from, next) => {
  const appStore = useAppStore()
  const hideByMeta = shouldHideSidebarByMeta(to)
  const hideByPath = hideSidebarPathNames.includes(String(to.name || ''))
  const shouldOpen = !(hideByMeta || hideByPath)
  if (appStore.sidebarIconFull !== shouldOpen) {
    appStore.setSidebarIconFull(shouldOpen)
  }
  if (appStore.sidebar.opened !== shouldOpen) {
    appStore.toggleSideBar(shouldOpen)
  }
  next()
})

export default router
