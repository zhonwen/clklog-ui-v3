import { defineStore } from 'pinia'
import { logout as logoutApi } from '@/api/user'
import { getToken, removeToken, setToken } from '@/utils/auth'
import { clearLocalStorage } from '@/utils/localStorage'
import { resetRouter } from '@/router'
import { useTagsViewStore } from '@/stores/tagsView'
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
      this.channelList = list.map((item) => ({
        displayName: item.displayName,
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
      removeToken()
      clearLocalStorage()
      resetRouter()
      useTagsViewStore().delAllViews()
    },
  },
})
