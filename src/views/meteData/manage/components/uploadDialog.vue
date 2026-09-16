<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'
import type { UploadFile, UploadFiles, UploadInstance, UploadRequestOptions } from 'element-plus'
import { importDataApi } from '@/api/sysmanage/manageEvent'
import { useTrackingStore } from '@/stores/tracking'
import { bus } from '@/utils/event-bus'
import upload_dialog_tip from '@/views/meteData/components/upload_dialog_tip.vue'
import type { UploadTipTitle } from '@/views/meteData/components/upload_dialog_tip.vue'

const emit = defineEmits<{
  refreshTableList: []
}>()

const trackingStore = useTrackingStore()

const copyRight = window.globalConfig.copyRight || 'ClkLog'
const loading = ref(false)
const file1 = '事件分析 - 自定义事件 - 元数据模板.xlsx'
const file2 = '事件分析 - 全埋点（预置）事件 - 元数据模板.xlsx'
const centerDialogVisible = ref(false)
const fileList = ref<UploadRequestOptions[]>([])
const title: UploadTipTitle = {
  tp1: '确认将所选事件采集数据模板上传至',
  tp2: '项目的事件元数据表？',
}

const uploadRef = ref<UploadInstance>()
const uploadDialogTipRef = ref<{ projectDialogTip: (val: UploadTipTitle) => void } | null>(null)

const projectName = computed(() => trackingStore.projectName)

function confirmUpload() {
  if (fileList.value && fileList.value.length > 0) {
    const fileParams = new FormData()
    fileList.value.forEach((x) => {
      fileParams.append('file', x.file)
      fileParams.append('projectName', projectName.value)
    })
    loading.value = true
    importDataApi(fileParams)
      .then((res) => {
        if (res?.code == 200) {
          ElMessage.success('上传成功！')
          centerDialogVisible.value = false
          emit('refreshTableList')
          loading.value = false
        }
        // 与 v2 一致：非 200 时 v2 的 else 分支是空的，loading 不会被复位
      })
      .catch(() => {
        loading.value = false
      })
  } else {
    ElMessage.error('请上传文件')
  }
}

// 子父传参
function Secondary() {
  if (window.globalConfig.is_clklog_demo_environment) {
    // v2 的 $bus.$emit('$demo_event')：演示环境弹提示框，不执行真实操作
    bus.emit('$demo_event')
    return
  }
  confirmUpload()
}

// 验证项目名称是否正确
function handleDemoEvent() {
  if (loading.value) {
    return
  }
  uploadDialogTipRef.value?.projectDialogTip(title)
}

function sliChange(_raw: UploadFile, files: UploadFiles) {
  if (files.length > 1) {
    files.splice(0, 1)
  }
}

function httpRequest(options: UploadRequestOptions): Promise<unknown> {
  fileList.value = []
  fileList.value.push(options)
  // v2 这里什么都不返回：文件只是暂存下来，等用户点「确认上传」再统一提交。
  // element-plus 只在返回值 instanceof Promise 时才把它当成上传结果，
  // 返回一个永远 pending 的 Promise 等价于 v2 的「既不触发 success 也不触发 error」
  return new Promise(() => {})
}

// 上传前
function beforeUpload(file: File) {
  const fileSize = file.size
  const FIVE_M = 2 * 1024 * 1024
  if (fileSize > FIVE_M) {
    ElMessage.error('最大上传2M')
    return false
  }
  const isExcel = /\.(xlsx|xls|xlsm)$/.test(file.name)
  if (!isExcel) {
    ElMessage.error('只能上传.xlsx、.xls、.xlsm 文件!')
    return false
  }
  return true
}

// 文件数量提醒
function handleExceed() {
  ElMessage({ type: 'error', message: '最多支持1个附件上传' })
}

function openDialogEvent() {
  centerDialogVisible.value = true
  fileList.value = []
  void nextTick(() => {
    uploadRef.value?.clearFiles()
  })
}

async function downloadFile(val: string) {
  try {
    const pathFile = 'collectionFile/' + val
    const response = await axios.get<Blob>(pathFile, {
      responseType: 'blob',
    })
    // 创建Blob对象
    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    // 创建下载链接
    const url = window.URL.createObjectURL(blob)

    // 创建一个<a>标签并设置相应的属性
    const link = document.createElement('a')
    link.href = url
    const x_head = copyRight ? copyRight + '-' : ''
    link.download = x_head + val
    // 模拟点击下载链接
    link.click()
    // 释放资源
    window.URL.revokeObjectURL(url)
  } catch (error) {
    console.error('下载文件时出错:', error)
  }
}

// <script setup> 默认对外封闭，父组件通过 ref 调 openDialogEvent() 必须先 expose
defineExpose({ openDialogEvent })
</script>

<template>
  <div>
    <el-dialog
      v-model="centerDialogVisible"
      title="事件数据批量上传"
      :modal-append-to-body="false"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      width="800px"
      center
    >
      <div style="padding: 0 30px; background: #fff; border-radius: 6px">
        <el-form label-width="150px" style="padding-top: 15px">
          <el-form-item label="事件采集模板下载：">
            <div class="zc_downTip" @click="downloadFile(file1)">
              {{ copyRight ? copyRight + ' -' : '' }} {{ file1 }}
            </div>
          </el-form-item>
          <el-form-item label="" style="margin-top: -15px">
            <div class="zc_downTip" @click="downloadFile(file2)">
              {{ copyRight ? copyRight + ' -' : '' }} {{ file2 }}
            </div>
          </el-form-item>
          <el-form-item label="事件采集模板上传：">
            <div style="display: flex">
              <el-upload
                ref="uploadRef"
                multiple
                class="upload-demo"
                action="#"
                :on-change="sliChange"
                :http-request="httpRequest"
                :before-upload="beforeUpload"
                :on-exceed="handleExceed"
              >
                <template #trigger>
                  <el-button class="zc_btn_default">上传excel事件采集文件</el-button>
                </template>
              </el-upload>
            </div>
          </el-form-item>
          <el-form-item>
            <el-button
              v-loading="loading"
              size="small"
              style="margin-bottom: 20px"
              type="primary"
              class="zc_loading_upload"
              @click="handleDemoEvent"
            >
              确认上传
            </el-button>
          </el-form-item>
          <el-form-item> </el-form-item>
        </el-form>
        <div class="zc_explain_tip" style="padding: 15px 0">
          请先下载
          "自定义事件"和"全埋点（预置）事件"模板，然后根据项目在实际应用中的事件采集需求，按照模板要求分别对"自定义事件"和"全埋点（预置）事件"进行整理完毕并上传至"元事件"库方可在前端或服务端按照神策事件埋点方法进行事件埋点。
        </div>
      </div>
    </el-dialog>
    <upload_dialog_tip ref="uploadDialogTipRef" @Secondary="Secondary" />
  </div>
</template>

<style lang="scss" scoped></style>
