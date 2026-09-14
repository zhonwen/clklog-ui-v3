import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// 与 v2/vue.config.js 当前 setProxy("prod") 一致，可按环境改这里
const proxyTarget = {
  api: 'https://pro.clklog.com/api',
  manage: 'https://pro.clklog.com/manage',
  authmanage: 'https://pro.clklog.com/authmanage',
  ups: 'https://pro.clklog.com/ups-api',
}

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
          if (normalized.includes('/src/styles/variables.scss')) {
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
