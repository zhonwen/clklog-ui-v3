export function isExternal(path: string) {
  return /^(https?:|mailto:|tel:)/.test(path)
}

export const PASSWORD_COMPLEXITY_MESSAGE =
  '密码格式必须包含大小写字母、数字、特殊字符，长度不得小于12位且不超过18位'

export function validPassword(password: string): boolean {
  if (!password || typeof password !== 'string') {
    return false
  }
  const reg = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,18}$/
  return reg.test(password)
}

export function getPasswordError(password: string | undefined, emptyMessage?: string): string {
  if (!password) {
    return emptyMessage || '请输入密码'
  }
  if (!validPassword(password)) {
    return PASSWORD_COMPLEXITY_MESSAGE
  }
  return ''
}
