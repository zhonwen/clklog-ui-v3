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
}

declare global {
  interface Window {
    globalConfig: GlobalConfig
  }
}

export {}
