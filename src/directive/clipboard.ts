import type { Directive } from 'vue'
import { ElMessage } from 'element-plus'

type ClipboardEl = HTMLElement & {
  _v_clipboard_text?: string
  _v_clipboard_success?: (e: { text: string }) => void
  _v_clipboard_error?: () => void
}

async function copyText(el: ClipboardEl) {
  const text = el._v_clipboard_text || ''
  try {
    await navigator.clipboard.writeText(text)
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
    el.addEventListener('click', () => void copyText(el))
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
}
