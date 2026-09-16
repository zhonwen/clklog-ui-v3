<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTrackingStore } from '@/stores/tracking'
import { getLocalStorage } from '@/utils/localStorage'
import type { ProjectItem } from '@/types/app'

/** 批量上传前的二次确认弹框（v2 meteData/components/upload_dialog_tip.vue） */
export interface UploadTipTitle {
  tp1: string
  tp2: string
}

const emit = defineEmits<{
  Secondary: []
}>()

const trackingStore = useTrackingStore()

const visibleProject = ref(false)
const title = ref<UploadTipTitle>({
  tp1: '',
  tp2: '',
})

const projectName = computed(() => trackingStore.projectName)

/**
 * 项目编码 -> 项目显示名。
 * v2 是模板里直接调用 filterEvent(projectName)，这里换成 computed，避免重复渲染时反复读 localStorage。
 */
const projectDisplayName = computed(() => {
  // v2 直接 JSON.parse(localStorage.getItem('projectList'))，projectList 不存在时会抛异常；
  // 这里走统一的 getLocalStorage 并判空，行为在有数据时与 v2 一致
  const projectList = getLocalStorage<ProjectItem[]>('projectList')
  let displayName = ''
  if (Array.isArray(projectList)) {
    projectList.forEach((item) => {
      if (item.projectName == projectName.value) {
        displayName = item.projectDisplayName
      }
    })
  }
  return displayName
})

function confirm() {
  visibleProject.value = false
  emit('Secondary')
}

function projectDialogTip(val: UploadTipTitle) {
  title.value = val
  visibleProject.value = true
}

// <script setup> 默认对外封闭，父组件通过 ref 调 projectDialogTip() 必须先 expose
defineExpose({ projectDialogTip })
</script>

<template>
  <div>
    <el-dialog v-model="visibleProject" title="提示" width="550px" center>
      <div style="display: flex; flex-wrap: wrap; word-wrap: break-word">
        {{ title.tp1 }}
        <span
          style="
            text-align: center;
            border-bottom: 1px solid #ccd1d4;
            color: #2c7be5;
            white-space: nowrap;
            padding: 0 10px;
          "
        >
          “{{ projectDisplayName }}”
        </span>
        {{ title.tp2 }}
      </div>

      <template #footer>
        <span class="dialog-footer" style="display: flex">
          <el-button class="zc_btn" style="margin-left: 20px" @click="confirm">确 定</el-button>
          <el-button class="zc_btn_default" @click="visibleProject = false">取 消</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
:deep() {
  .el-dialog {
    border-radius: 6px;
  }

  .el-dialog__header {
    background-color: #fff !important;
  }

  .el-dialog__body {
    padding: 20px;
    background-color: #fff !important;
    border-radius: 6px;
  }

  .el-dialog__footer {
    margin-left: 0 !important;
    width: 100%;
    display: flex;
    justify-content: center;
  }
}
</style>
