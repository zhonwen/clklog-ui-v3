import { defineStore } from 'pinia'
import defaultSettings from '@/settings'

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    theme: '#2c7be5',
    showSettings: false,
    tagsView: defaultSettings.tagsView,
    fixedHeader: defaultSettings.fixedHeader,
    sidebarLogo: defaultSettings.sidebarLogo,
    cologStyle: {
      $pv: '#2c7be5',
      $uv: '#85dec8',
      $visitCount: '#ffde84',
      $ipCount: '#5dbaf7',
      $bounceRate: '#e4b2d8',
    },
  }),
})
