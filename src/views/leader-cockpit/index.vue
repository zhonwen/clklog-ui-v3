<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import html2canvas from 'html2canvas'
import { ElLoading } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { bus } from '@/utils/event-bus'
import { todateFunc } from '@/utils/date'
import Desktop from './components/desktop.vue'
import Mobile from './components/mobile.vue'

const appStore = useAppStore()
const device = computed(() => appStore.device)

const newImg = ref('')
const dialogVisible = ref(false)
const mobileRef = ref<{ mobileEvent: () => void } | null>(null)

let loadingEvent: ReturnType<typeof ElLoading.service> | null = null

/** v2 直接 document.getElementById(...).style.xxx = ...，这里统一补一次判空 */
type EditableStyleKey = 'display' | 'position' | 'height' | 'marginTop' | 'lineHeight'
function setElStyle(id: string, key: EditableStyleKey, value: string) {
  const el = document.getElementById(id)
  if (el) el.style[key] = value
}

function openFullScreen2() {
  loadingEvent = ElLoading.service({
    lock: true,
    text: '下载中',
    // v2 是 spinner: 'el-icon-loading'，element-plus 里已没有这个图标类名，
    // 传了等于没有转圈动画，这里去掉以走 element-plus 默认 spinner
    background: 'rgba(0, 0, 0, 0.7)',
  })
}

// base64转化为Blob对象
function convertBase64ToBlob(imageEditorBase64: string) {
  const base64Arr = imageEditorBase64.split(',')
  let imgtype = ''
  let base64String = ''
  if (base64Arr.length > 1) {
    //如果是图片base64，去掉头信息
    base64String = base64Arr[1] || ''
    const header = base64Arr[0] || ''
    imgtype = header.substring(header.indexOf(':') + 1, header.indexOf(';'))
  }
  // 将base64解码
  const bytes = atob(base64String)
  const bytesCode = new ArrayBuffer(bytes.length)
  // 转换为类型化数组
  const byteArray = new Uint8Array(bytesCode)

  // 将base64转换为ascii码
  for (let i = 0; i < bytes.length; i++) {
    byteArray[i] = bytes.charCodeAt(i)
  }
  // 生成Blob对象（文件对象）
  return new Blob([bytesCode], { type: imgtype })
}

// 下载Blob流文件
function downFileToLocal(fileName: string, blob: Blob) {
  // 创建用于下载文件的a标签
  const d = document.createElement('a')
  // 设置下载内容
  d.href = URL.createObjectURL(blob)
  // 设置下载文件的名字
  d.download = fileName
  // 界面上隐藏该按钮
  d.style.display = 'none'
  // 放到页面上
  document.body.appendChild(d)
  // 点击下载文件
  d.click()
  // 从页面移除掉
  document.body.removeChild(d)
  // 释放 URL.createObjectURL() 创建的 URL 对象
  window.URL.revokeObjectURL(d.href)
  setElStyle('calendar', 'display', 'block')
  setElStyle('tabBar', 'position', 'fixed')
  loadingEvent?.close()
}

function onSaveCanvas() {
  // 这里的类名要与点击事件里的一样
  setElStyle('calendar', 'display', 'none')
  setElStyle('tabBar', 'position', 'relative')
  setElStyle('headerFilter', 'lineHeight', '30px')
  const canvasEl = document.querySelector('#screenshot-box')
  if (!canvasEl) return
  void html2canvas(canvasEl as HTMLElement, { scale: 2, logging: false, useCORS: true }).then(
    function (canvas) {
      const type = 'png'
      let imgData = canvas.toDataURL(type)
      // 图片格式处理
      const _fixType = function (fileType: string) {
        const lower = fileType.toLowerCase().replace(/jpg/i, 'jpeg')
        const matched = lower.match(/png|jpeg|bmp|gif/)
        // 与 v2 一致（v2 此处逻辑存疑：直接取 match(...)[0]，匹配不上会抛 TypeError）
        return 'image/' + (matched ? matched[0] : '')
      }
      imgData = imgData.replace(_fixType(type), 'image/octet-stream')
      const toTime = todateFunc()
      const filename = '数据汇总-' + toTime + '.' + type
      // 保存为文件
      //  以bolb文件下载
      downFileToLocal(filename, convertBase64ToBlob(imgData))
    },
  )
}

async function generateCanvas() {
  // 获取需要转换的HTML元素，可以是整个页面或特定的元素
  setElStyle('calendar', 'display', 'none')
  setElStyle('tabBar', 'position', 'relative')
  setElStyle('headerFilter', 'height', '90px')
  setElStyle('timeFlag', 'marginTop', '15px')
  const element = document.querySelector('#screenshot-box')
  if (!element) return
  const canvas = await html2canvas(element as HTMLElement)
  // 可选：将Canvas图像转换为DataURL格式，以便保存为图片或进行其他操作
  const dataURL = canvas.toDataURL('image/jpeg', 1.0) || null
  newImg.value = dataURL || ''
  if (dataURL) {
    dialogVisible.value = true
  }
  loadingEvent?.close()
  setElStyle('calendar', 'display', 'block')
  setElStyle('tabBar', 'position', 'fixed')
  setElStyle('headerFilter', 'height', '90px')
  setElStyle('timeFlag', 'marginTop', '15px')
  mobileRef.value?.mobileEvent()
}

// mitt 只能传一个参数；v2 是 $bus.$on('$downPage', (val) => {...})，这里 payload 未使用。
// 注意：v3 的 Navbar 目前还没有这个「下载」按钮（v2 里 downPageFlag = route.name === 'summary'
// 时才显示），所以这个监听暂时不会被触发，待 Navbar 补上下载按钮后即可生效。
function handleDownPage() {
  openFullScreen2()
  if (device.value == 'desktop') {
    onSaveCanvas()
  } else {
    void generateCanvas()
  }
}

onMounted(() => {
  bus.on('$downPage', handleDownPage)
})

onBeforeUnmount(() => {
  bus.off('$downPage', handleDownPage)
})
</script>

<template>
  <div id="screenshot-box">
    <div v-if="device == 'desktop'">
      <Desktop />
    </div>
    <div v-else>
      <Mobile ref="mobileRef" style="box-sizing: border-box" />
      <el-dialog v-model="dialogVisible" width="80%">
        <div style="color: #194580; font-size: 14px; box-sizing: border-box">长按下图保存</div>
        <img
          :src="newImg"
          style="
            width: 100%;
            border: 1px solid #8bb2e5;
            border-radius: 4px;
            margin-top: 15px;
            box-sizing: border-box;
          "
        />
      </el-dialog>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use '@/styles/components/TopFilter.scss';

#screenshot-box {
  background-color: #e9f1fa !important;
}

:deep(.el-dialog__body) {
  padding: 0 20px !important;
}

:deep(.el-dialog__headerbtn) {
  top: 14px !important;
}

.headerFilter {
  height: 40px;
  color: #194580;
  font-size: 13px;

  .setFilter {
    justify-content: space-between;
    flex-wrap: nowrap !important;
    overflow-x: auto;
  }
}

.block_online {
  display: flex;
  width: 100%;
  justify-content: space-between;
}

.public-block {
  .accumulate_title {
    font-size: 14px;
    font-weight: 500;
  }

  .accumulate_num {
    color: #2c7be5;
    margin-top: 10px;
    font-size: 15px;
  }

  .block-index-form {
    margin-top: 10px;
  }
}
</style>
