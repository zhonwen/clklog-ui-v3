import type { Directive } from 'vue'

export const elHeightAdaptiveTable: Directive<HTMLElement, { bottomOffset?: number } | undefined> = {
  mounted(el, binding) {
    const doResize = () => {
      const bottomOffset = binding.value?.bottomOffset ?? 30
      const height = window.innerHeight - el.getBoundingClientRect().top - bottomOffset
      el.style.height = `${height}px`
    }
    doResize()
    el.dataset.resizeBound = '1'
    window.addEventListener('resize', doResize)
    ;(el as HTMLElement & { _adaptiveResize?: () => void })._adaptiveResize = doResize
  },
  unmounted(el) {
    const doResize = (el as HTMLElement & { _adaptiveResize?: () => void })._adaptiveResize
    if (doResize) window.removeEventListener('resize', doResize)
  },
}
