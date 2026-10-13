import JSEncrypt from 'jsencrypt'
import { getCaptchaImage } from '@/api/sysmanage/globalsetting'
import type { ApiResult } from '@/utils/http'

function toPemPublicKey(publicKey: string): string {
  if (!publicKey) return ''
  const key = String(publicKey).trim()
  if (key.includes('BEGIN PUBLIC KEY')) {
    return key
  }
  const body = key.replace(/\s+/g, '')
  const chunks = body.match(/.{1,64}/g) || [body]
  return `-----BEGIN PUBLIC KEY-----\n${chunks.join('\n')}\n-----END PUBLIC KEY-----`
}

export function encryptWithPublicKey(plainText: string, publicKey: string): string {
  if (plainText == null || plainText === '') {
    throw new Error('加密内容不能为空')
  }
  if (!publicKey) {
    throw new Error('缺少公钥，请刷新后重试')
  }
  const encryptor = new JSEncrypt()
  encryptor.setPublicKey(toPemPublicKey(publicKey))
  const cipher = encryptor.encrypt(String(plainText))
  if (!cipher) {
    throw new Error('密码加密失败，请刷新后重试')
  }
  return cipher
}

export function encryptPasswordWithCid(password: string, cid: string, publicKey: string): string {
  if (!cid) {
    throw new Error('缺少验证码标识，请刷新后重试')
  }
  return encryptWithPublicKey(`${password}|${cid}`, publicKey)
}

export function parseCaptchaEncryptFields(res: ApiResult<{ cid?: string; publicKey?: string }>) {
  const payload = (res && res.data) || {}
  return {
    cid: payload.cid || (res && (res as unknown as { cid?: string }).cid) || '',
    publicKey: payload.publicKey || (res && (res as unknown as { publicKey?: string }).publicKey) || '',
  }
}

export function fetchEncryptContext(): Promise<{ cid: string; publicKey: string }> {
  return getCaptchaImage().then((res) => {
    if (!res || res.code != 200) {
      throw new Error('获取加密公钥失败，请重试')
    }
    const { cid, publicKey } = parseCaptchaEncryptFields(res)
    if (!cid || !publicKey) {
      throw new Error('缺少公钥，请重试')
    }
    return { cid, publicKey }
  })
}
