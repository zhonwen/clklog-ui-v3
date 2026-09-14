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
import { setupDirectives } from '@/directive'
import { fixedWidth } from '@/components/el-table-width'
import { sharedText } from '@/components/pointFont'
import { htmlToPdf } from '@/utils/htmlToPdf'
import './permission'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(ElementPlus, {
  locale: zhCn,
  size: 'default',
})
setupDirectives(app)
app.component('SvgIcon', SvgIcon)
app.component('svg-icon', SvgIcon)
app.config.globalProperties.$fixedWidth = fixedWidth
app.config.globalProperties.$sharedText = sharedText
app.config.globalProperties.$htmlToPdf = htmlToPdf

app.mount('#app')
