<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowDown } from '@element-plus/icons-vue'
import Cookies from 'js-cookie'
import { getMenuList } from '@/api/user'
import { getChannelListApi } from '@/api/trackingapi/channel'
import { bus } from '@/utils/event-bus'
import { useAppStore } from '@/stores/app'
import { usePermissionStore } from '@/stores/permission'
import { useTrackingStore } from '@/stores/tracking'
import { useUserStore } from '@/stores/user'
import { getLocalStorage, setLocalStorage } from '@/utils/localStorage'
import { getFirstRoutePath } from '@/utils/menu'
import { hideSidebarPathNames } from '@/utils/index'
import type { ProjectItem } from '@/types/app'

const route = useRoute()
const router = useRouter()
const appStore = useAppStore()
const userStore = useUserStore()
const trackingStore = useTrackingStore()
const permissionStore = usePermissionStore()

const device = computed(() => appStore.device)
const options = ref<ProjectItem[]>(
  (getLocalStorage<ProjectItem[]>('projectList') as ProjectItem[]) || trackingStore.projectArray,
)
const prejectCode = ref(trackingStore.projectName || '')
const dateTime = ref('')
const dateWeek = ref('')
const userName = ref('')
const projectIsNotShow = ref(true)
const isUserInfoPage = ref(false)
const selectWidth = ref(128)
const isDemoEnv = window.globalConfig.is_clklog_demo_environment || false

const logoSrc = './image/logo.png'
const iconSrc = './image/icon.png'

function initDate() {
  const date = new Date()
  const weekMap = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  dateWeek.value = weekMap[date.getDay()] || ''
  dateTime.value = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

function isOrNotRoute(val: typeof route) {
  const pathsToShowProject = [
    '/sysManage/sysLog',
    '/sysManage/globalSetting',
    '/sysManage/appManage',
    '/authManage/app',
    '/authManage/user',
    '/authManage/role',
    '/authManage/menu',
    '/ups/userportrait/analyze',
  ]
  projectIsNotShow.value = !pathsToShowProject.includes(val.path)
  isUserInfoPage.value = hideSidebarPathNames.includes(String(val.name || ''))
}

async function handleChangeProject(val: string, isInit = false) {
  if (!val) return
  trackingStore.setProject(val)
  setLocalStorage('prejectCode', val)
  if (!isInit) {
    setLocalStorage('projectSwitching', 1)
  }
  window.menuListLoaded = false
  try {
    const res = await getMenuList({ projectName: val })
    if (res.code == 200) {
      const menuListData = res.data || []
      userStore.setMenuList(menuListData)
      await permissionStore.generateAsyncRoutes(menuListData)
      window.menuListLoaded = true
      if (route.path == '/NoPermission') {
        const defaultPath = getFirstRoutePath(res.data || []) || '/NoPermission'
        await router.replace({ path: defaultPath })
      }
      setTimeout(() => setLocalStorage('projectSwitching', 0), 1000)
    }
  } catch {
    setLocalStorage('projectSwitching', 0)
  }
  channelTypeList(val)
}

function channelTypeList(projectName: string) {
  if (!projectName) return
  void getChannelListApi({ projectName }).then((res) => {
    if (res.code == 200) {
      userStore.setChannelList(res.data || [])
    }
  })
}

function modifyPsw() {
  bus.emit('$modifyPsw')
}

async function logout() {
  await userStore.logout()
  await router.push('/login')
}

function handleLogoClick() {
  if (window.history && window.history.length > 1) {
    router.back()
    return
  }
  let menuList = []
  try {
    menuList = JSON.parse(localStorage.getItem('menuList') || '[]')
  } catch {
    menuList = []
  }
  const targetPath = getFirstRoutePath(menuList) || '/index'
  if (route.path === targetPath) return
  void router.push({ path: targetPath })
}

function onVisibility() {
  if (!document.hidden) initDate()
}

watch(
  () => trackingStore.projectArray,
  (newVal) => {
    if (newVal && newVal.length > 0) {
      options.value = newVal
      if (!prejectCode.value || !newVal.some((item) => item.projectName === prejectCode.value)) {
        prejectCode.value = trackingStore.projectName || options.value[0]?.projectName || ''
        void handleChangeProject(prejectCode.value)
      }
    }
  },
  { deep: true },
)

watch(
  () => trackingStore.projectName,
  (newVal) => {
    if (newVal && newVal !== prejectCode.value) {
      prejectCode.value = newVal
    }
  },
)

watch(
  () => route.fullPath,
  () => isOrNotRoute(route),
)

onMounted(() => {
  const projectList = getLocalStorage('projectList')
  const storeProjects = trackingStore.projectArray
  if (
    (!projectList || !Array.isArray(projectList) || projectList.length === 0) &&
    (!Array.isArray(storeProjects) || storeProjects.length === 0)
  ) {
    void userStore.logout().then(() => router.push({ path: '/login' }))
    return
  }
  isOrNotRoute(route)
  try {
    userName.value = JSON.parse(Cookies.get('userInfo') || '{}').username || ''
  } catch {
    userName.value = ''
  }
  const savedProjectCode = getLocalStorage<string>('prejectCode')
  if (options.value.length > 0) {
    prejectCode.value =
      (typeof savedProjectCode === 'string' && savedProjectCode) || options.value[0]?.projectName || ''
  }
  trackingStore.setProject(prejectCode.value)
  channelTypeList(prejectCode.value)
  if (localStorage.getItem('prejectCode') && !window.menuListLoaded) {
    window.menuListLoaded = true
    getMenuList({ projectName: prejectCode.value }).then((res) => {
      if (res.code == 200) {
        const menuListData = res.data || []
        userStore.setMenuList(menuListData)
        void permissionStore.generateAsyncRoutes(menuListData)
      }
    })
  }
  initDate()
  document.addEventListener('visibilitychange', onVisibility)
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<template>
  <div class="navbar">
    <div v-if="device == 'desktop'" class="burying_point">
      <div style="display: flex; align-items: center">
        <div class="logoFlag">
          <img class="imgLogo" :src="logoSrc" alt="ClkLog" @click="handleLogoClick" />
          <div class="edition">商业版</div>
        </div>
        <div class="project-wrap" :style="{ width: selectWidth + 'px', maxWidth: '600px' }">
          <el-select
            v-show="projectIsNotShow"
            v-model="prejectCode"
            placeholder="请选择"
            class="custom_select"
            style="width: 100%"
            @change="(val: string) => handleChangeProject(val)"
          >
            <el-option
              v-for="item in options"
              :key="item.projectName"
              :label="item.projectDisplayName"
              :value="item.projectName"
            />
          </el-select>
          <div v-if="isUserInfoPage" class="NoClkSelect" />
        </div>
      </div>
      <div class="right-menu">
        <div class="dataTime">{{ dateTime }}&nbsp;&nbsp;{{ dateWeek }}</div>
        <el-dropdown class="avatar-container">
          <div class="avatar-wrapper">
            <el-icon><ArrowDown /></el-icon>
            <span class="user-name">{{ userName }}</span>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item>{{ userName }}</el-dropdown-item>
              <el-dropdown-item v-if="!isDemoEnv" @click="modifyPsw">修改密码</el-dropdown-item>
              <el-dropdown-item @click="logout">退出</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
    <div v-else class="burying_point mobile-bar">
      <img :src="iconSrc" alt="" class="mobile-icon" @click="handleLogoClick" />
      <el-select
        v-model="prejectCode"
        placeholder="请选择"
        class="custom_select"
        :style="{ width: selectWidth + 'px' }"
        @change="(val: string) => handleChangeProject(val)"
      >
        <el-option
          v-for="item in options"
          :key="item.projectName"
          :label="item.projectDisplayName"
          :value="item.projectName"
        />
      </el-select>
      <div class="right-menu">
        <el-dropdown trigger="click">
          <span class="user-name">{{ userName }}</span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="logout">退出</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.navbar {
  position: fixed;
  top: 0;
  left: 0;
  height: 50px;
  overflow: hidden;
  width: 100%;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
  z-index: 1002;
}

.burying_point {
  display: flex;
  justify-content: space-between;
  height: 50px;
  margin-left: 20px;
}

.logoFlag {
  margin-right: 70px;
  display: flex;
  align-items: center;
}

.edition {
  margin-left: 20px;
  font-size: 12px;
  color: rgba(76, 81, 86, 0.657);
  margin-top: 6px;
}

.imgLogo {
  height: 44px;
  cursor: pointer;
}

.project-wrap {
  position: relative;
  min-width: 0;
  overflow: hidden;
}

.NoClkSelect {
  position: absolute;
  inset: 0;
  z-index: 100;
  cursor: not-allowed;
}

.right-menu {
  display: flex;
  align-items: center;
  margin-right: 16px;
}

.dataTime {
  font-size: 13px;
  color: #656d92;
  margin-right: 24px;
}

.avatar-wrapper,
.user-name {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  color: #4d4d4d;
}

.mobile-bar {
  align-items: center;
}

.mobile-icon {
  width: 36px;
  margin-right: 12px;
  cursor: pointer;
}
</style>
