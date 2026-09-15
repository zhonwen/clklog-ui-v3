import type { Directive } from 'vue'
import { ElMessage } from 'element-plus'

type ClipboardEl = HTMLElement & {
  _v_clipboard_text?: string
  _v_clipboard_success?: (e: { text: string }) => void
  _v_clipboard_error?: () => void
}

/** 挂在元素上的 click handler，用 WeakMap 存，不污染 DOM 节点 */
const handlers = new WeakMap<HTMLElement, () => void>()

/**
 * navigator.clipboard 只在安全上下文（HTTPS / localhost）可用。
 * ClkLog 大量部署在内网 http 下，必须保留 execCommand 回退 ——
 * v2 用的 clipboard.js 底层就是 execCommand。
 */
async function writeClipboard(text: string) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text)
    return
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', 'readonly')
  textarea.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0'
  document.body.appendChild(textarea)
  textarea.select()
  textarea.setSelectionRange(0, textarea.value.length)
  let ok = false
  try {
    ok = document.execCommand('copy')
  } finally {
    document.body.removeChild(textarea)
  }
  if (!ok) throw new Error('execCommand copy failed')
}

async function copyText(el: ClipboardEl) {
  const text = el._v_clipboard_text || ''
  try {
    await writeClipboard(text)
    el._v_clipboard_success?.({ text })
    ElMessage.success('已复制')
  } catch {
    el._v_clipboard_error?.()
    ElMessage.error('复制失败')
  }
}

export const clipboard: Directive<ClipboardEl, string | ((e: { text: string }) => void)> = {
  mounted(el, binding) {
    if (binding.arg === 'success') {
      el._v_clipboard_success = binding.value as ClipboardEl['_v_clipboard_success']
      return
    }
    if (binding.arg === 'error') {
      el._v_clipboard_error = binding.value as ClipboardEl['_v_clipboard_error']
      return
    }
    el._v_clipboard_text = String(binding.value ?? '')
    const handler = () => void copyText(el)
    handlers.set(el, handler)
    el.addEventListener('click', handler)
  },
  updated(el, binding) {
    if (binding.arg === 'success') {
      el._v_clipboard_success = binding.value as ClipboardEl['_v_clipboard_success']
      return
    }
    if (binding.arg === 'error') {
      el._v_clipboard_error = binding.value as ClipboardEl['_v_clipboard_error']
      return
    }
    el._v_clipboard_text = String(binding.value ?? '')
  },
  unmounted(el) {
    const handler = handlers.get(el)
    if (handler) el.removeEventListener('click', handler)
    handlers.delete(el)
    delete el._v_clipboard_text
    delete el._v_clipboard_success
    delete el._v_clipboard_error
  },
}
