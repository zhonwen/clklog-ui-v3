/// <reference types="vite/client" />

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
    $fixedWidth: {
      FwMulti: string
      FwIndex: string
      FwValue: string
      FwDate: string
      FwEventName: string
      FwTime: string
      FwDisplayName: string
      FwOperation: string
    }
    $sharedText: Record<string, string>
    $htmlToPdf: (elementId: string, htmlTitle: string) => Promise<boolean>
  }
}

export {}

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

export {}
