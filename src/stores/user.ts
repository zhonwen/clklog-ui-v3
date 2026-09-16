import { defineStore } from 'pinia'
import { logout as logoutApi } from '@/api/user'
import { getToken, removeToken, setToken } from '@/utils/auth'
import { clearLocalStorage } from '@/utils/localStorage'
import { resetRouter } from '@/router'
import { useTagsViewStore } from '@/stores/tagsView'
import { usePermissionStore } from '@/stores/permission'
import { useTrackingStore } from '@/stores/tracking'
import type { ChannelItem, MenuItem } from '@/types/app'

function parseMenuList(): MenuItem[] {
  try {
    return JSON.parse(localStorage.getItem('menuList') || '[]') as MenuItem[]
  } catch {
    return []
  }
}

export const useUserStore = defineStore('user', {
  state: () => ({
    token: getToken() || '',
    name: '',
    avatar: '',
    introduction: '',
    roles: [] as string[],
    menuList: parseMenuList(),
    channelList: [] as ChannelItem[],
  }),
  actions: {
    login(response: { data?: { token?: string } | string; token?: string }) {
      const data = response.data
      const token =
        (typeof data === 'object' && data?.token) ||
        (typeof data === 'string' ? data : '') ||
        response.token ||
        ''
      this.token = token
      setToken(token)
    },
    setMenuList(menuList: MenuItem[]) {
      this.menuList = menuList
    },
    setChannelList(list: { displayName: string }[]) {
      // 与 v2 一致：保留接口返回的全部字段，只补一个 id，后续模块可能用到别的字段
      this.channelList = list.map((item) => ({
        ...item,
        id: item.displayName == '全部' ? '' : item.displayName,
      }))
    },
    resetToken() {
      this.token = ''
      this.roles = []
      removeToken()
    },
    async logout() {
      try {
        await logoutApi()
      } catch {
        // ignore
      }
      this.token = ''
      this.roles = []
      this.menuList = []
      removeToken()
      clearLocalStorage()
      resetRouter()
      useTagsViewStore().delAllViews()
      // v2 只清了 token 和路由，permission/tracking 的内存态会留到下一次登录。
      // Pinia 下这会让守卫误判「路由已生成」，同标签页换账号时用的是上一个人的 uriRoutes。
      usePermissionStore().$reset()
      useTrackingStore().$reset()
      window.menuListLoaded = false
    },
  },
})
