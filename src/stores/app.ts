import Cookies from 'js-cookie'
import { defineStore } from 'pinia'

export const useAppStore = defineStore('app', {
  state: () => ({
    sidebar: {
      opened: true,
      withoutAnimation: false,
    },
    sidebarIconFull: true,
    device: 'desktop' as 'desktop' | 'mobile',
    size: Cookies.get('size') || 'default',
  }),
  actions: {
    toggleSideBar(openState: boolean) {
      this.sidebar.opened = openState
      this.sidebar.withoutAnimation = false
      Cookies.set('sidebarStatus', openState ? '1' : '0')
    },
    closeSideBar(_payload?: { withoutAnimation?: boolean }) {
      Cookies.set('sidebarStatus', '0')
      this.sidebar.opened = false
      this.sidebar.withoutAnimation = false
    },
    setSidebarIconFull(val: boolean) {
      this.sidebarIconFull = !!val
    },
    toggleDevice(device: 'desktop' | 'mobile') {
      this.device = device
    },
    setSize(size: string) {
      this.size = size
      Cookies.set('size', size)
    },
  },
})
