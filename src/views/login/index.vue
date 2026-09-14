<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { Hide, View } from '@element-plus/icons-vue'
import Cookies from 'js-cookie'
import { login } from '@/api/user'
import { getAppMyList } from '@/api/sysmanage/appmanage'
import { getCaptchaImage } from '@/api/sysmanage/globalsetting'
import { getMenuList } from '@/api/user'
import { useAppStore } from '@/stores/app'
import { usePermissionStore } from '@/stores/permission'
import { useTrackingStore } from '@/stores/tracking'
import { useUserStore } from '@/stores/user'
import { pickEntryPath } from '@/utils/menu'
import { isNavigationFailure } from 'vue-router'
import { useResizeHandler } from '@/layout/mixin/ResizeHandler'

useResizeHandler()

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const userStore = useUserStore()
const trackingStore = useTrackingStore()
const permissionStore = usePermissionStore()

const loginFormRef = ref<FormInstance>()
const usernameRef = ref()
const passwordRef = ref()
const loading = ref(false)
const captchaLoading = ref(false)
const dialogVisible = ref(false)
const passwordType = ref<'password' | 'text'>('password')
const capsTooltip = ref(false)
const loginBgSrc = './image/loginBg.png'
const logoSrc = './image/logo.png'
const showLoginBg = ref(true)
const showLogo = ref(true)
const isDemoAccount = window.globalConfig.is_clklog_demo_experience_account || false
const device = computed(() => appStore.device)

const loginForm = reactive({
  username: '',
  password: '',
  code: '',
})
const captchaObj = reactive({
  img: '',
  cid: '',
})

const loginRules: FormRules = {
  username: [{ required: true, trigger: 'blur', message: '请输入账号' }],
  password: [
    { required: true, trigger: 'blur', message: '请输入密码' },
    { min: 6, trigger: 'blur', message: '密码不能少于6位' },
  ],
  code: [
    { required: true, trigger: 'blur', message: '请输入验证码' },
    { min: 4, trigger: 'blur', message: '验证码错误' },
  ],
}

const redirect = computed(() => (route.query.redirect as string) || '')

function getCaptcha() {
  captchaLoading.value = true
  getCaptchaImage()
    .then((res) => {
      if (res.data && res.code == 200) {
        captchaObj.img = res.data.img ? `data:image/png;base64,${res.data.img}` : ''
        captchaObj.cid = res.data.cid || ''
      }
    })
    .finally(() => {
      captchaLoading.value = false
    })
}

function checkCapslock(e: KeyboardEvent) {
  const { key } = e
  capsTooltip.value = !!(key && key.length === 1 && key >= 'A' && key <= 'Z')
}

function showPwd() {
  passwordType.value = passwordType.value === 'password' ? 'text' : 'password'
  nextTick(() => passwordRef.value?.focus())
}

async function handleLogin() {
  const valid = await loginFormRef.value?.validate().catch(() => false)
  if (!valid) return
  loading.value = true
  try {
    const response = await login({
      username: loginForm.username.trim(),
      password: loginForm.password,
      code: loginForm.code,
      cid: captchaObj.cid,
    })
    if (response.code != 200) {
      getCaptcha()
      return
    }
    Cookies.set('userInfo', JSON.stringify({ username: loginForm.username }))
    userStore.login(response)
    const response1 = await getAppMyList()
    if (!(response1 && response1.code == 200)) {
      await router.replace({ path: '/Unauthorized' })
      return
    }
    const projectArray = response1.data || []
    trackingStore.setProjectArray(projectArray)
    localStorage.setItem('projectList', JSON.stringify(projectArray))
    if (!Array.isArray(projectArray) || projectArray.length === 0) {
      await router.replace({ path: '/Unauthorized' })
      return
    }
    window.menuListLoaded = true
    const projectName = projectArray[0]?.projectName || ''
    trackingStore.setProject(projectName)
    const response2 = await getMenuList({ projectName })
    if (response2.code != 200) {
      await router.push({ path: '/NoPermission' })
      return
    }
    const menuListData = response2.data || []
    userStore.setMenuList(menuListData)
    await permissionStore.generateAsyncRoutes(menuListData)
    const defaultPath = pickEntryPath(
      menuListData,
      redirect.value,
      permissionStore.uriRoutes,
    )
    try {
      await router.replace({ path: defaultPath || '/' })
    } catch (error) {
      if (!isNavigationFailure(error)) throw error
      await router.replace({ path: '/NoPermission' }).catch(() => undefined)
    }
  } catch (error) {
    console.error(error)
    ElMessage.error(error instanceof Error ? error.message : '登录后进入系统失败')
    getCaptcha()
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  try {
    const userInfo = Cookies.get('userInfo') ? JSON.parse(Cookies.get('userInfo') || '') : ''
    if (userInfo) loginForm.username = userInfo.username
  } catch {
    // ignore
  }
  getCaptcha()
  nextTick(() => {
    if (!loginForm.username) usernameRef.value?.focus()
    else passwordRef.value?.focus()
  })
})
</script>

<template>
  <div class="login-container" :class="{ mobile: device !== 'desktop' }">
    <div v-if="device == 'desktop'" class="login-banner">
      <img
        v-if="showLoginBg"
        :src="loginBgSrc"
        alt=""
        class="banner-img"
        @error="showLoginBg = false"
      />
    </div>
    <div class="login-panel">
      <el-form
        ref="loginFormRef"
        :model="loginForm"
        :rules="loginRules"
        class="login-form"
        autocomplete="on"
        label-position="left"
        @keyup.enter="handleLogin"
      >
        <div class="title-container">
          <img
            v-if="showLogo"
            class="logo_head"
            :src="logoSrc"
            alt="ClkLog"
            @error="showLogo = false"
          />
        </div>
        <div class="field-label">账号</div>
        <el-form-item prop="username">
          <el-input
            ref="usernameRef"
            v-model="loginForm.username"
            placeholder="请输入账号"
            name="username"
          />
        </el-form-item>
        <div class="field-label">密码</div>
        <el-tooltip :visible="capsTooltip" content="Caps lock is On" placement="right">
          <el-form-item prop="password">
            <el-input
              ref="passwordRef"
              v-model="loginForm.password"
              :type="passwordType"
              placeholder="请输入密码"
              name="password"
              @blur="capsTooltip = false"
              @keyup="checkCapslock"
            >
              <template #suffix>
                <el-icon class="pwd-icon" @click="showPwd">
                  <Hide v-if="passwordType === 'password'" />
                  <View v-else />
                </el-icon>
              </template>
            </el-input>
          </el-form-item>
        </el-tooltip>
        <div class="login-code-container">
          <el-form-item prop="code" class="code-item">
            <el-input v-model="loginForm.code" placeholder="验证码" />
          </el-form-item>
          <div v-loading="captchaLoading" class="login-code" @click="getCaptcha">
            <img v-if="captchaObj.img" :src="captchaObj.img" class="login-code-img" alt="验证码" />
            <span v-else>点击刷新</span>
          </div>
        </div>
        <div v-if="!isDemoAccount">
          <el-button :loading="loading" type="primary" class="login-btn" @click="handleLogin">
            登录
          </el-button>
        </div>
        <div v-else class="demo-actions">
          <el-button :loading="loading" type="primary" class="half-btn" @click="handleLogin">
            登录
          </el-button>
          <el-button class="half-btn experience" @click="dialogVisible = true">获取体验账号</el-button>
        </div>
      </el-form>
    </div>
    <el-dialog v-model="dialogVisible" width="400px" align-center>
      <div class="qr-wrap">
        <div>微信扫描下方二维码</div>
        <div style="margin: 20px 0">关注公众号获取体验账号</div>
        <el-button type="primary" @click="dialogVisible = false">确定</el-button>
      </div>
    </el-dialog>
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
  margin-bottom: 30px;
}

.demo-actions {
  display: flex;
  justify-content: space-between;
}

.half-btn {
  width: calc(50% - 10px);
  height: 46px;
  margin-bottom: 30px;
}

.experience {
  background-color: #fd9843;
  color: #fff;
  border: none;
}

.qr-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
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
</style>
