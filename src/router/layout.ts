/**
 * 全项目唯一的 Layout 组件引用。
 *
 * Vue Router 判断组件能否复用看的是引用是否相等。如果每条路由各写一个
 * `() => import('@/layout/index.vue')`，切换顶层菜单时 <RouterView> 会认为是不同组件，
 * 于是整个布局壳子（顶栏 + 侧栏 + 主区）卸载重建 —— 侧栏展开态丢失、
 * Navbar 的 onMounted 重跑并重复请求渠道列表。
 *
 * 常量路由和动态路由生成都必须引用这一个常量。
 */
export const Layout = () => import('@/layout/index.vue')
