import type { Directive } from 'vue'

export const elDragDialog: Directive<HTMLElement> = {
  mounted(el) {
    const dialogHeaderEl = el.querySelector('.el-dialog__header') as HTMLElement | null
    const dragDom = el.querySelector('.el-dialog') as HTMLElement | null
    if (!dialogHeaderEl || !dragDom) return
    dialogHeaderEl.style.cursor = 'move'
    dragDom.style.top = '0px'

    dialogHeaderEl.onmousedown = (e) => {
      const disX = e.clientX - dialogHeaderEl.offsetLeft
      const disY = e.clientY - dialogHeaderEl.offsetTop
      const dragDomWidth = dragDom.offsetWidth
      const dragDomHeight = dragDom.offsetHeight
      const screenWidth = document.body.clientWidth
      const screenHeight = document.body.clientHeight
      const minDragDomLeft = dragDom.offsetLeft
      const maxDragDomLeft = screenWidth - dragDom.offsetLeft - dragDomWidth
      const minDragDomTop = dragDom.offsetTop
      const maxDragDomTop = screenHeight - dragDom.offsetTop - dragDomHeight

      let styL = Number.parseInt(getComputedStyle(dragDom).left || '0', 10) || 0
      let styT = Number.parseInt(getComputedStyle(dragDom).top || '0', 10) || 0

      document.onmousemove = function (ev) {
        let left = ev.clientX - disX
        let top = ev.clientY - disY
        if (-left > minDragDomLeft) left = -minDragDomLeft
        else if (left > maxDragDomLeft) left = maxDragDomLeft
        if (-top > minDragDomTop) top = -minDragDomTop
        else if (top > maxDragDomTop) top = maxDragDomTop
        dragDom.style.cssText += `;left:${left + styL}px;top:${top + styT}px;`
      }
      document.onmouseup = function () {
        document.onmousemove = null
        document.onmouseup = null
      }
    }
  },
}
