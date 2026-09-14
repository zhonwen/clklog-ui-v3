import { onBeforeUnmount, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { hideSidebarPathNames } from '@/utils/index'

const WIDTH = 992

export function useResizeHandler() {
  const route = useRoute()
  const appStore = useAppStore()

  function isMobile() {
    return document.body.getBoundingClientRect().width - 1 < WIDTH
  }

  function resizeHandler() {
    if (document.hidden) return
    const mobile = isMobile()
    appStore.toggleDevice(mobile ? 'mobile' : 'desktop')
    if (mobile) {
      appStore.closeSideBar({ withoutAnimation: true })
      appStore.toggleSideBar(false)
    } else if (hideSidebarPathNames.includes(String(route.name || ''))) {
      appStore.setSidebarIconFull(false)
      appStore.toggleSideBar(false)
    } else {
      appStore.toggleSideBar(true)
      appStore.setSidebarIconFull(true)
    }
  }

  watch(
    () => route.fullPath,
    () => {
      if (appStore.device === 'mobile' && appStore.sidebar.opened) {
        appStore.closeSideBar({ withoutAnimation: false })
      }
    },
  )

  onMounted(() => {
    window.addEventListener('resize', resizeHandler)
    if (isMobile()) {
      appStore.toggleDevice('mobile')
      appStore.closeSideBar({ withoutAnimation: true })
    }
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', resizeHandler)
  })
}
