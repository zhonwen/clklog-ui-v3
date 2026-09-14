export function setLocalStorage(key: string, value: unknown) {
  const data = typeof value === 'object' ? JSON.stringify(value) : String(value)
  localStorage.setItem(key, data)
}

export function getLocalStorage<T = unknown>(key: string): T | string | null {
  const value = localStorage.getItem(key)
  if (value == null) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return value
  }
}

export function clearLocalStorage() {
  localStorage.clear()
}
