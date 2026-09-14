import type { Directive } from 'vue'
import { useUserStore } from '@/stores/user'

function checkPermission(el: HTMLElement, value: unknown) {
  const roles = useUserStore().roles
  if (value && Array.isArray(value) && value.length > 0) {
    const hasPermission = roles.some((role) => value.includes(role))
    if (!hasPermission) {
      el.parentNode && el.parentNode.removeChild(el)
    }
  } else {
    throw new Error(`need roles! Like v-permission="['admin','editor']"`)
  }
}

export const permission: Directive<HTMLElement, string[]> = {
  mounted(el, binding) {
    checkPermission(el, binding.value)
  },
  updated(el, binding) {
    checkPermission(el, binding.value)
  },
}
