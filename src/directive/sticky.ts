import type { Directive } from 'vue'

export const sticky: Directive<HTMLElement, { stickyTop?: number; zIndex?: number } | undefined> = {
  mounted(el, binding) {
    const params = binding.value || {}
    const stickyTop = params.stickyTop || 0
    const zIndex = params.zIndex || 1000
    el.style.position = 'sticky'
    el.style.top = `${stickyTop}px`
    el.style.zIndex = String(zIndex)
  },
}
