import type { Directive } from 'vue'

export const loadmore: Directive<HTMLElement, () => void> = {
  mounted(el, binding) {
    const wrap = el.querySelector('.el-select-dropdown .el-select-dropdown__wrap') as HTMLElement | null
    if (!wrap) return
    wrap.addEventListener('scroll', function onScroll() {
      const reached = this.scrollHeight - this.scrollTop <= this.clientHeight
      if (reached) binding.value()
    })
  },
}
