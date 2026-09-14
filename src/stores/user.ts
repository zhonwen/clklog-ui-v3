import { defineStore } from 'pinia'
import { getToken, removeToken, setToken } from '@/utils/auth'

export const useUserStore = defineStore('user', {
  state: () => ({
    token: getToken() || '',
  }),
  actions: {
    setAuthToken(token: string) {
      this.token = token
      setToken(token)
    },
    resetToken() {
      this.token = ''
      removeToken()
    },
    async logout() {
      this.resetToken()
    },
  },
})
