import type { Directive } from 'vue'
import { useUserStore } from '@/stores/user'

function checkPermission(el: HTMLElement, value: unknown) {
  if (!Array.isArray(value) || value.length === 0) {
    // 原实现在这里 throw，会在渲染期炸掉整棵组件树；改成告警并放行
    console.warn(`v-permission 需要角色数组，例如 v-permission="['admin','editor']"`)
    return
  }
  const roles = useUserStore().roles
  const hasPermission = roles.some((role) => value.includes(role))
  // 用 hidden 而不是 removeChild：removeChild 不可逆，updated 再触发时元素已不在树上
  el.hidden = !hasPermission
}

export const permission: Directive<HTMLElement, string[]> = {
  mounted(el, binding) {
    checkPermission(el, binding.value)
  },
  updated(el, binding) {
    checkPermission(el, binding.value)
  },
}
