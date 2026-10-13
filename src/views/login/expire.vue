<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import Cookies from 'js-cookie'
import { modifyPasswordAnom } from '@/api/user'
import { getCaptchaImage } from '@/api/sysmanage/globalsetting'
import { getPasswordError } from '@/utils/validate'
import { encryptPasswordWithCid } from '@/utils/rsaEncrypt'
import { useAppStore } from '@/stores/app'
import { useResizeHandler } from '@/layout/mixin/ResizeHandler'

useResizeHandler()

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()

const expireFormRef = ref<FormInstance>()
const oldPasswordRef = ref()
const newPasswordRef = ref()
const confirmPasswordRef = ref()
const loading = ref(false)
const captchaLoading = ref(false)
const loginBgSrc = './image/loginBg.png'
const logoSrc = './image/logo.png'
const device = computed(() => appStore.device)

const captchaObj = reactive({
  img: '',
  cid: '',
  publicKey: '',
})

const passwordType = reactive({
  oldPassword: 'password' as 'password' | 'text',
  newPassword: 'password' as 'password' | 'text',
  confirmPassword: 'password' as 'password' | 'text',
})

const expireForm = reactive({
  username: '',
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
  code: '',
})

const validateNewPassword = (_rule: unknown, value: string, callback: (error?: Error) => void) => {
  const error = getPasswordError(value, '请输入新密码')
  if (error) {
    callback(new Error(error))
  } else if (value === expireForm.oldPassword) {
    callback(new Error('新密码不能与原密码相同'))
  } else {
    if (expireForm.confirmPassword) {
      void expireFormRef.value?.validateField('confirmPassword')
    }
    callback()
  }
}

const validateConfirmPassword = (_rule: unknown, value: string, callback: (error?: Error) => void) => {
  if (!value) {
    callback(new Error('请再次输入新密码'))
  } else if (value !== expireForm.newPassword) {
    callback(new Error('两次密码不一致'))
  } else {
    callback()
  }
}

const expireRules: FormRules = {
  username: [{ required: true, trigger: 'blur', message: '请输入账号' }],
  oldPassword: [{ required: true, trigger: 'blur', message: '请输入原密码' }],
  newPassword: [{ required: true, trigger: 'blur', validator: validateNewPassword }],
  confirmPassword: [{ required: true, trigger: 'blur', validator: validateConfirmPassword }],
  code: [
    { required: true, trigger: 'blur', message: '请输入验证码' },
    { min: 4, trigger: 'blur', message: '验证码错误' },
  ],
}

function getCaptcha() {
  captchaLoading.value = true
  captchaObj.publicKey = ''
  captchaObj.cid = ''
  getCaptchaImage()
    .then((res) => {
      if (res && res.code == 200) {
        const payload = res.data || {}
        const img = payload.img || (res as unknown as { img?: string }).img || ''
        captchaObj.img = img ? `data:image/png;base64,${img}` : ''
        captchaObj.cid = payload.cid || (res as unknown as { cid?: string }).cid || ''
        captchaObj.publicKey =
          payload.publicKey || (res as unknown as { publicKey?: string }).publicKey || ''
      }
    })
    .finally(() => {
      captchaLoading.value = false
    })
}

function showPwd(field: 'oldPassword' | 'newPassword' | 'confirmPassword') {
  passwordType[field] = passwordType[field] === 'password' ? 'text' : 'password'
  const map = { oldPassword: oldPasswordRef, newPassword: newPasswordRef, confirmPassword: confirmPasswordRef }
  nextTick(() => map[field].value?.focus())
}

function backToLogin() {
  void router.replace({ path: '/login' })
}

function submitModify() {
  void expireFormRef.value?.validate((valid) => {
    if (!valid) return
    let encryptedOldPassword = ''
    let encryptedNewPassword = ''
    try {
      encryptedOldPassword = encryptPasswordWithCid(
        expireForm.oldPassword,
        captchaObj.cid,
        captchaObj.publicKey,
      )
      encryptedNewPassword = encryptPasswordWithCid(
        expireForm.newPassword,
        captchaObj.cid,
        captchaObj.publicKey,
      )
    } catch (e) {
      loading.value = false
      ElMessage.error((e instanceof Error && e.message) || '密码加密失败，请刷新验证码后重试')
      getCaptcha()
      return
    }
    loading.value = true
    modifyPasswordAnom({
      username: expireForm.username.trim(),
      oldPassword: encryptedOldPassword,
      newPassword: encryptedNewPassword,
      code: expireForm.code,
      cid: captchaObj.cid,
    })
      .then((res) => {
        if (res && res.code == 200) {
          Cookies.set('userInfo', JSON.stringify({ username: expireForm.username.trim() }))
          sessionStorage.removeItem('loginExpiredUsername')
          ElMessage.success('修改密码成功，请重新登录')
          void router.replace({ path: '/login' })
        } else {
          getCaptcha()
        }
      })
      .catch(() => {
        getCaptcha()
      })
      .finally(() => {
        loading.value = false
      })
  })
}

onMounted(() => {
  expireForm.username =
    (route.query && (route.query.username as string)) ||
    sessionStorage.getItem('loginExpiredUsername') ||
    ''
  getCaptcha()
})
</script>

<template>
  <div class="login-container" :class="{ mobile: device !== 'desktop' }">
    <div v-if="device == 'desktop'" class="login-banner">
      <img :src="loginBgSrc" alt="" class="banner-img" />
    </div>
    <div class="login-panel">
      <el-form
        ref="expireFormRef"
        :model="expireForm"
        :rules="expireRules"
        class="login-form"
        autocomplete="off"
        label-position="left"
      >
        <div class="title-container">
          <img class="logo_head" :src="logoSrc" alt="ClkLog" />
        </div>
        <div class="expire-tip">为了保障您的账号安全，请修改密码后再登录</div>
        <div class="field-label">账号</div>
        <el-form-item prop="username">
          <el-input v-model="expireForm.username" placeholder="请输入账号" name="username" />
        </el-form-item>
        <div class="field-label">原密码</div>
        <el-form-item prop="oldPassword">
          <el-input
            ref="oldPasswordRef"
            v-model="expireForm.oldPassword"
            :type="passwordType.oldPassword"
            placeholder="请输入原密码"
            name="oldPassword"
            @keyup.enter="submitModify"
          >
            <template #suffix>
              <el-icon class="pwd-icon" @click="showPwd('oldPassword')">
                <span class="el-icon-lock" />
              </el-icon>
            </template>
          </el-input>
        </el-form-item>
        <div class="field-label">新密码</div>
        <el-form-item prop="newPassword">
          <el-input
            ref="newPasswordRef"
            v-model="expireForm.newPassword"
            :type="passwordType.newPassword"
            placeholder="请输入新密码"
            name="newPassword"
            maxlength="18"
            @keyup.enter="submitModify"
          >
            <template #suffix>
              <el-icon class="pwd-icon" @click="showPwd('newPassword')">
                <span class="el-icon-lock" />
              </el-icon>
            </template>
          </el-input>
        </el-form-item>
        <div class="field-label">确认密码</div>
        <el-form-item prop="confirmPassword">
          <el-input
            ref="confirmPasswordRef"
            v-model="expireForm.confirmPassword"
            :type="passwordType.confirmPassword"
            placeholder="请再次输入新密码"
            name="confirmPassword"
            maxlength="18"
            @keyup.enter="submitModify"
          >
            <template #suffix>
              <el-icon class="pwd-icon" @click="showPwd('confirmPassword')">
                <span class="el-icon-lock" />
              </el-icon>
            </template>
          </el-input>
        </el-form-item>
        <div class="login-code-container">
          <el-form-item prop="code" class="code-item">
            <el-input v-model="expireForm.code" placeholder="验证码" @keyup.enter="submitModify" />
          </el-form-item>
          <div v-loading="captchaLoading" class="login-code" @click="getCaptcha">
            <img v-if="captchaObj.img" :src="captchaObj.img" class="login-code-img" alt="验证码" />
            <span v-else>点击刷新</span>
          </div>
        </div>
        <el-button :loading="loading" type="primary" class="login-btn" @click="submitModify">
          修改密码
        </el-button>
        <el-button class="back-btn" @click="backToLogin">返回登录</el-button>
      </el-form>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.login-container {
  display: flex;
  min-height: 100%;
  width: 100%;
  background: #fff;
}

.login-banner {
  width: 60vw;
  height: 100vh;
  background: linear-gradient(160deg, #dbeafe 0%, #f7faff 100%);
}

.banner-img {
  height: 100vh;
  width: 100%;
  object-fit: contain;
}

.login-panel {
  width: 40vw;
  background-color: #f7faff;
  height: 100vh;
  display: flex;
  align-items: center;
}

.mobile .login-panel {
  width: 100vw;
}

.login-form {
  width: 80%;
  max-width: 500px;
  margin: 0 auto;
}

.title-container {
  text-align: center;
  margin-bottom: 40px;
}

.logo_head {
  height: 80px;
  object-fit: contain;
}

.expire-tip {
  font-size: 14px;
  color: #f74848;
  margin: -20px 0 28px;
  text-align: center;
}

.field-label {
  font-size: 14px;
  color: #4d4d4d;
  margin-bottom: 8px;
}

.pwd-icon {
  cursor: pointer;
}

.login-code-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 22px;
}

.code-item {
  width: calc(60% - 20px);
  margin-bottom: 0;
}

.login-code {
  width: 40%;
  height: 46px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border: 1px solid #ddeafb;
  border-radius: 6px;
}

.login-code-img {
  width: 100%;
  height: 100%;
}

.login-btn {
  width: 100%;
  height: 46px;
  margin-bottom: 16px;
}

.back-btn {
  width: 100%;
  height: 46px;
  margin-bottom: 30px;
  margin-left: 0;
}

:deep(.el-form-item) {
  border: 1px solid #ddeafb;
  background: #fff;
  border-radius: 6px;
}

:deep(.el-input__wrapper) {
  box-shadow: none;
  height: 46px;
}

:deep(.el-form-item__error) {
  white-space: normal;
  line-height: 1.4;
}
</style>
