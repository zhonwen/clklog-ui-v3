import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  scrollBehavior: () => ({ top: 0, left: 0 }),
  routes: [
    {
      path: '/',
      name: 'shell',
      component: () => import('@/views/shell/index.vue'),
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/login/index.vue'),
    },
    {
      path: '/PermissionDenied',
      name: 'PermissionDenied',
      component: () => import('@/views/error-page/PermissionDenied.vue'),
    },
  ],
})

export default router
