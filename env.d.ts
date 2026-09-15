/// <reference types="vite/client" />

import type { fixedWidth } from '@/components/el-table-width'
import type { sharedText } from '@/components/pointFont'
import type { htmlToPdf } from '@/utils/htmlToPdf'

/** public/config.js 注入的运行时配置，字段与 v2 保持一致 */
interface GlobalConfig {
  BASE_API: string
  BASE_API_MANAGE: string
  BASE_API_AUTHMANAGE: string
  BASE_API_UPSAPI: string
  clklog_api_timeout: number
  clklog_api_load_maxtime: number
  copyRight: string
  copyRightUrl: string
  is_clklog_demo_experience_account?: boolean
  is_clklog_demo_environment?: boolean
}

declare global {
  interface Window {
    globalConfig: GlobalConfig
    menuListLoaded?: boolean
  }
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $fixedWidth: typeof fixedWidth
    $sharedText: typeof sharedText
    $htmlToPdf: typeof htmlToPdf
  }
}

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    icon?: string
    hidden?: boolean
    hideSidebar?: boolean
    activeMenu?: string
    noCache?: boolean
    affix?: boolean
  }
}

export {}
