<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowDown, Download } from '@element-plus/icons-vue'
import Cookies from 'js-cookie'
import { getMenuList } from '@/api/user'
import { getChannelListApi } from '@/api/trackingapi/channel'
import { bus } from '@/utils/event-bus'
import { useAppStore } from '@/stores/app'
import { usePermissionStore } from '@/stores/permission'
import { useTrackingStore } from '@/stores/tracking'
import { useUserStore } from '@/stores/user'
import { getLocalStorage, setLocalStorage } from '@/utils/localStorage'
import { setProjectSwitching } from '@/utils/project-switching'
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
const defaultProject: ProjectItem[] = [
  {
    projectName: 'clklogapp',
    projectDisplayName: 'clklog',
  },
]
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

/** 领导驾驶舱（路由 name 为 summary）才显示顶栏的「下载」按钮，与 v2 showDownLoad 一致 */
const downPageFlag = ref(false)

function showDownLoad(val: typeof route) {
  downPageFlag.value = val.name === 'summary'
}

/** 通知当前页面自行截图导出，领导驾驶舱监听 $downPage */
function onSaveCanvas() {
  bus.emit('$downPage')
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
    setProjectSwitching(true)
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
      setTimeout(() => setProjectSwitching(false), 1000)
    }
  } catch {
    setProjectSwitching(false)
  }
  channelTypeList(val)
}

function channelTypeList(projectName: string) {
  if (!projectName) return
  // 403/423 等分支下拦截器会返回 undefined，这里必须容错，否则是一个未捕获的 TypeError
  void getChannelListApi({ projectName })
    .then((res) => {
      if (res?.code == 200) {
        userStore.setChannelList(res.data || [])
      }
    })
    .catch(() => {
      /* 报错已由请求层统一提示 */
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
    } else {
      // v2：项目列表为空时回退到默认项目，避免下拉框空白
      options.value = defaultProject
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
  () => {
    isOrNotRoute(route)
    showDownLoad(route)
  },
)

/**
 * 自定义分析 / 漏斗分析打开书签时，按书签里的 projectName 切项目
 * （对齐 v2 Navbar 的 $CHECKPROJECT 监听）
 */
function handleCheckProject(val: unknown) {
  const projectName = typeof val === 'string' ? val : ''
  if (!projectName) return
  prejectCode.value = projectName
  trackingStore.setProject(projectName)
}

/** 业务页请求登出（对齐 v2 Navbar 的 $loginOut 监听） */
function handleLoginOut() {
  void logout()
}

/** 顶栏监听的三个全局事件，注册与注销必须传同一个 handler 引用 */
function registerBusHandlers() {
  bus.on('$updateMenu', reloadMenu)
  bus.on('$CHECKPROJECT', handleCheckProject)
  bus.on('$loginOut', handleLoginOut)
}

function reloadMenu() {
  void getMenuList({ projectName: trackingStore.projectName }).then((res) => {
    if (res?.code == 200) {
      const menuListData = res.data || []
      userStore.setMenuList(menuListData)
      void permissionStore.generateAsyncRoutes(menuListData)
    }
  })
}

onMounted(() => {
  // 与 v2 一致：只看 localStorage 里的 projectList，不是数组就说明登录态不完整，强制登出。
  const projectList = getLocalStorage('projectList')
  if (!projectList || !Array.isArray(projectList)) {
    void userStore.logout().then(() => router.push({ path: '/login' }))
    return
  }
  isOrNotRoute(route)
  showDownLoad(route)
  try {
    userName.value = JSON.parse(Cookies.get('userInfo') || '{}').username || ''
  } catch {
    userName.value = ''
  }
  const savedProjectCode = getLocalStorage<string>('prejectCode')
  if (options.value.length === 0) {
    options.value = defaultProject
  }
  prejectCode.value = String(savedProjectCode || options.value[0]?.projectName || '')
  trackingStore.setProject(prejectCode.value)

  // 事件分析 / 漏斗分析的书签链接会带项目参数，刷新时要按 URL 切项目（v2 Navbar created 同逻辑）
  const queryParam = route.query.query
  const projectNameParam = route.query.projectName
  if (typeof queryParam === 'string' && queryParam) {
    try {
      const parsed = JSON.parse(queryParam) as { projectName?: string }
      if (parsed?.projectName) {
        prejectCode.value = parsed.projectName
        void handleChangeProject(parsed.projectName, true)
        initDate()
        document.addEventListener('visibilitychange', onVisibility)
        registerBusHandlers()
        return
      }
    } catch {
      // query 不是合法 JSON 时按普通流程走
    }
  }
  if (typeof projectNameParam === 'string' && projectNameParam) {
    prejectCode.value = projectNameParam
    void handleChangeProject(projectNameParam, true)
  } else if (localStorage.getItem('prejectCode')) {
    channelTypeList(prejectCode.value)
    if (!window.menuListLoaded) {
      window.menuListLoaded = true
      void getMenuList({ projectName: prejectCode.value }).then((res) => {
        if (res?.code == 200) {
          const menuListData = res.data || []
          userStore.setMenuList(menuListData)
          void permissionStore.generateAsyncRoutes(menuListData)
        }
      })
    }
  } else {
    channelTypeList(prejectCode.value)
  }

  // 菜单管理保存后刷新侧栏、书签切项目、业务页请求登出
  registerBusHandlers()
  initDate()
  document.addEventListener('visibilitychange', onVisibility)
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', onVisibility)
  bus.off('$updateMenu', reloadMenu)
  bus.off('$CHECKPROJECT', handleCheckProject)
  bus.off('$loginOut', handleLoginOut)
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
        <!-- 只在领导驾驶舱显示，点击后由页面自己截图导出（v2 Navbar 的 onSaveCanvas） -->
        <div
          v-if="downPageFlag"
          class="btnEvent"
          style="margin-right: 20px; background: #2c7be5; color: #fff"
          @click="onSaveCanvas"
        >
          <el-icon style="font-size: 14px"><Download /></el-icon>下载
        </div>
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

// 顶栏「下载」按钮，来源 v2 layout/components/Navbar.vue:490
.btnEvent {
  cursor: pointer;
  width: 65px;
  height: 28px;
  color: #194580;
  font-weight: 600;
  border: 1px solid #d8e2ef;
  border-radius: 4px;
  font-size: 12px;
  line-height: 28px;
  text-align: center;
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
