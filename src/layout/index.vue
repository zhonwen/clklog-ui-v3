<script setup lang="ts">
import { computed } from 'vue'
import Navbar from './components/Navbar.vue'
import Sidebar from './components/Sidebar/index.vue'
import AppMain from './components/AppMain.vue'
import { useAppStore } from '@/stores/app'
import { useResizeHandler } from './mixin/ResizeHandler'

const appStore = useAppStore()
useResizeHandler()

const sidebar = computed(() => appStore.sidebar)
const device = computed(() => appStore.device)
const poweredBySrc = './image/poweredBy.png'

const classObj = computed(() => ({
  hideSidebar: !sidebar.value.opened,
  openSidebar: sidebar.value.opened,
  withoutAnimation: sidebar.value.withoutAnimation,
  mobile: device.value === 'mobile',
  fullHideSidebar: !appStore.sidebarIconFull,
}))

function handleClickOutside() {
  appStore.closeSideBar({ withoutAnimation: false })
}

function openClklog() {
  window.open(window.globalConfig.copyRightUrl || 'https://clklog.com/#/introduce')
}
</script>

<template>
  <div :class="classObj" class="app-wrapper">
    <div
      v-if="device === 'mobile' && sidebar.opened"
      class="drawer-bg"
      @click="handleClickOutside"
    />
    <Sidebar class="sidebar-container" />
    <div class="main-container">
      <Navbar />
      <AppMain />
    </div>
    <div v-if="device != 'mobile'" class="logoConItem">
      <div class="logoName">POWERED BY</div>
      <img class="logoImg" :src="poweredBySrc" alt="ClkLog" @click="openClklog" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.logoConItem {
  position: fixed;
  left: 16px;
  bottom: 5px;
  display: flex;
  z-index: 2000;

  .logoImg {
    height: 16px;
    object-fit: cover;
    cursor: pointer;
  }

  .logoName {
    padding-right: 5px;
    font-size: 12px;
    color: #909399;
    line-height: 22px;
  }
}

.app-wrapper {
  position: relative;
  height: 100%;
  width: 100%;

  &.mobile.openSidebar {
    position: fixed;
    top: 0;
  }
}

.drawer-bg {
  background: #000;
  opacity: 0.3;
  width: 100%;
  top: 0;
  height: 100%;
  position: absolute;
  z-index: 999;
}
</style>
