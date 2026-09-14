import 'normalize.css/normalize.css'
import 'element-plus/dist/index.css'
import 'nprogress/nprogress.css'
import '@/styles/index.scss'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'

import App from './App.vue'
import router from './router'
import SvgIcon from '@/components/SvgIcon/index.vue'
import './permission'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(ElementPlus, {
  locale: zhCn,
  size: 'default',
})
app.component('SvgIcon', SvgIcon)
app.component('svg-icon', SvgIcon)

app.mount('#app')
