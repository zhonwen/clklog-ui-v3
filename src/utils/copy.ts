export function copyObj<T>(obj: T): T {
  if (typeof obj == 'object' && obj !== null) {
    const newobj: Record<string, unknown> | unknown[] = Array.isArray(obj) ? [] : {}
    for (const i in obj) {
      ;(newobj as Record<string, unknown>)[i] = copyObj((obj as Record<string, unknown>)[i])
    }
    return newobj as T
  }
  return obj
}
