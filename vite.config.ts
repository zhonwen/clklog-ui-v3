import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// 本地开发代理：改 'demo' | 'test' 即可切换，不必改 config.js
const PROXY_ENV: 'demo' | 'test' = 'demo'

const proxyPresets = {
  // 本地代理对齐 v2 vue.config.js：演示站网关是 /manage，不是 /api/manage
  // 生产包仍读 public/config.js 里带 /api 前缀的地址
  demo: {
    // api: 'https://pro.clklog.com/api',
    // manage: 'https://pro.clklog.com/manage',
    // authmanage: 'https://pro.clklog.com/authmanage',
    // ups: 'https://pro.clklog.com/ups-api',
    api:'http://clklog-idm3.servers.zcunsoft.com/proapi-wt',
    manage:'http://clklog-idm3.servers.zcunsoft.com/manage-wt',
    authmanage:'http://clklog-idm3.servers.zcunsoft.com/manage-wt',
    ups:'http://clklog-idm3.servers.zcunsoft.com/ups-api-wt',
  },
  test: {
    api: 'http://10.10.220.188/proapi',
    manage: 'http://10.10.220.188/manage',
    authmanage: 'http://10.10.220.188/authmanage',
    ups: 'http://10.10.220.188/ups-api',
  },
}

const proxyTarget = proxyPresets[PROXY_ENV]

export default defineConfig({
  base: './',
  plugins: [vue(), vueDevTools()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData(content: string, filepath: string) {
          const normalized = filepath.replace(/\\/g, '/')
          // src/styles 里自己 @use 变量；避免 @use 子文件时 additionalData 不注入导致变量丢失
          if (normalized.includes('/src/styles/')) {
            return content
          }
          return `@use "@/styles/variables.scss" as *;\n${content}`
        },
      },
    },
  },
  server: {
    proxy: {
      '/DEV-API-UPSAPI': {
        target: proxyTarget.ups,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/DEV-API-UPSAPI/, ''),
      },
      '/DEV-API-AUTHMANAGE': {
        target: proxyTarget.authmanage,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/DEV-API-AUTHMANAGE/, ''),
      },
      '/DEV-API-MANAGE': {
        target: proxyTarget.manage,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/DEV-API-MANAGE/, ''),
      },
      '/DEV-API': {
        target: proxyTarget.api,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/DEV-API/, ''),
      },
    },
  },
})
