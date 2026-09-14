import html2Canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

export function htmlToPdf(elementId: string, htmlTitle: string) {
  return new Promise<boolean>((resolve, reject) => {
    const el = document.getElementById(elementId)
    if (!el) {
      reject(false)
      return
    }
    html2Canvas(el, {
      allowTaint: true,
      useCORS: true,
      scale: 5,
    })
      .then((canvas) => {
        const contentWidth = canvas.width
        const contentHeight = canvas.height
        const a4Width = 595.28
        const a4Height = 841.89
        const scale = Math.min(a4Width / contentWidth, a4Height / contentHeight)
        const scaledWidth = contentWidth * scale
        const scaledHeight = contentHeight * scale
        const offsetX = (a4Width - scaledWidth) / 2
        const pageData = canvas.toDataURL('image/jpeg', 1.0)
        const PDF = new jsPDF({ unit: 'pt', format: 'a4' })
        try {
          PDF.addImage(pageData, 'JPEG', offsetX, 0, scaledWidth, scaledHeight)
          PDF.save(`${htmlTitle}.pdf`)
          resolve(true)
        } catch {
          reject(false)
        }
      })
      .catch(() => reject(false))
  })
}
