<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CaretBottom, Download } from '@element-plus/icons-vue'
import Cookies from 'js-cookie'
// v2 用 `<img src="@/assets/images/avator.png">`，这里显式 import 让 vite 出带 hash 的资源 URL
import avatarImg from '@/assets/images/avator.png'
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

/**
 * 项目下拉的自适应宽度，照搬 v2 Navbar.vue 的 updateSelectWidth()（v2:277-308）。
 * v2 用一个离屏 span 实测所有项目显示名里最宽的一条，再 clamp 到 [128, 600]；
 * v3 之前 selectWidth 固定 128，项目名一长就被截断。
 * v2 用 canvas 量英文不准，所以坚持用真实 DOM 量，这里保持同样做法。
 */
const navbarRef = ref<HTMLElement | null>(null)

function updateSelectWidth() {
  const labels = (options.value || []).map((item) => item.projectDisplayName || '')
  if (!labels.length) {
    selectWidth.value = 128
    return
  }
  const mirror = document.createElement('span')
  mirror.style.cssText =
    'position:absolute;left:-9999px;top:-9999px;visibility:hidden;white-space:nowrap;'
  // v2 取的是 .custom_select .el-input__inner；element-plus 的 el-select 已不含 el-input，
  // 文字落在 .el-select__wrapper 上，这里换成它来取字体
  const inputEl = navbarRef.value?.querySelector('.custom_select .el-select__wrapper')
  if (inputEl) {
    mirror.style.font = window.getComputedStyle(inputEl).font
  } else {
    mirror.style.font =
      '14px "Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Arial, sans-serif'
  }
  document.body.appendChild(mirror)
  let maxTextWidth = 0
  labels.forEach((label) => {
    mirror.textContent = label
    maxTextWidth = Math.max(maxTextWidth, mirror.offsetWidth)
  })
  document.body.removeChild(mirror)
  // 左侧 padding + 右侧下拉箭头区域。
  // v2 直接写死 45（element-ui 的 .el-input__inner 是 padding: 0 15px + 约 30px 的箭头区）；
  // element-plus 的 .el-select__wrapper 盒模型不同（padding + flex gap + suffix 三段），
  // 沿用 45 会差几个像素，文字被 ellipsis 截掉，看着就是「宽度没适配」。
  // 所以这里按真实 DOM 量，量不到再回退到 v2 的 45。
  const extra = measureSelectExtra(inputEl)
  const minWidth = 128
  const maxWidth = 600
  selectWidth.value = Math.min(maxWidth, Math.max(minWidth, Math.ceil(maxTextWidth) + extra))
}

/** 下拉框里除文字以外要占掉的横向空间：左右内边距 + flex gap + 右侧箭头 */
function measureSelectExtra(wrapper: Element | null | undefined): number {
  if (!wrapper) return 45
  const cs = window.getComputedStyle(wrapper)
  const padding = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0)
  const gap = parseFloat(cs.columnGap) || 0
  const suffix = wrapper.querySelector('.el-select__suffix')
  const suffixWidth = suffix ? suffix.getBoundingClientRect().width : 0
  // +2 是留给亚像素取整，否则偶尔仍会出现一个字的省略号
  const extra = Math.ceil(padding + gap + suffixWidth) + 2
  return extra > 0 ? extra : 45
}

// v2 是 watch options（deep + immediate）后 $nextTick 再量
watch(
  options,
  () => {
    nextTick(() => updateSelectWidth())
  },
  { deep: true, immediate: true },
)

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
  // 挂载后再量一次：immediate 的那次可能跑在下拉框真正渲染出来之前，只能用兜底字体估算；
  // 字体文件晚于首帧加载完时宽度也会变，fonts.ready 后补一次。
  void nextTick(() => updateSelectWidth())
  void document.fonts?.ready?.then(() => updateSelectWidth())
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
  <div ref="navbarRef" class="navbar">
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
        <el-dropdown class="avatar-container right-menu-item hover-effect">
          <div class="avatar-wrapper">
            <img :src="avatarImg" class="user-avatar" alt="" />
            <el-icon class="caret-bottom"><CaretBottom /></el-icon>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item>
                <span style="display: block">{{ userName }}</span>
              </el-dropdown-item>
              <el-dropdown-item v-if="!isDemoEnv" @click="modifyPsw">
                <span style="display: block">修改密码</span>
              </el-dropdown-item>
              <el-dropdown-item @click="logout">
                <span style="display: block">退出</span>
              </el-dropdown-item>
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
      <div class="right-menu mobile-right-menu">
        <el-dropdown class="avatar-container right-menu-item hover-effect" trigger="click">
          <div class="avatar-wrapper">
            <img :src="avatarImg" class="user-avatar" alt="" />
            <el-icon class="caret-bottom"><CaretBottom /></el-icon>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="logout">
                <span style="display: block">退出</span>
              </el-dropdown-item>
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

.custom_select {
  :deep(.el-select__wrapper),
  :deep(.el-select__wrapper.is-focused),
  :deep(.el-select__wrapper.is-hovering:not(.is-focused)) {
    box-shadow: none;
  }

  :deep(.el-select__wrapper) {
    min-height: 40px;
    padding-left: 15px;
  }
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
  height: 100%;
  line-height: 50px;
  margin-right: 7px;
}


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
  font-weight: 400;
  line-height: 14px;
  color: #656d92;
  margin-right: 29px;
}

// 默认头像及其下拉，来源 v2 Navbar.vue:614-654。
// v3 之前把头像换成了「ArrowDown 图标 + 用户名文字」，与 v2 的圆角头像差异明显，这里改回 v2 的结构。
.user-avatar {
  cursor: pointer;
  width: 40px;
  height: 40px;
  border-radius: 10px;
}

.right-menu-item {
  display: inline-block;
  height: 100%;
  font-size: 18px;
  color: #5a5e66;
  vertical-align: text-bottom;

  &.hover-effect {
    cursor: pointer;
    transition: background 0.3s;

    &:hover {
      background: rgba(0, 0, 0, 0.025);
    }
  }
}

.avatar-container {
  margin-right: 30px;

  .avatar-wrapper {
    margin-top: 5px;
    left: 2px;
    top: 0;
    position: relative;

    // v2 是字体图标 `<i class="el-icon-caret-bottom">`，EP 无此类，换成 CaretBottom 组件，定位照搬
    .caret-bottom {
      cursor: pointer;
      position: absolute;
      right: -20px;
      top: 25px;
      font-size: 12px;
    }
  }
}

.mobile-bar {
  align-items: center;
  justify-content: flex-start;
  line-height: 50px;
}

.mobile-right-menu {
  position: absolute;
  right: 0;
}

.mobile-icon {
  width: 36px;
  margin-right: 12px;
  cursor: pointer;
}
</style>
