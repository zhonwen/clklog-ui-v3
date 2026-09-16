<template>
  <el-dialog
    v-model="visibleErrorFlag"
    title="错误详情"
    :modal-append-to-body="false"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    width="500px"
    center
  >
    <div style="line-height: 1.5; display: flex; flex-wrap: wrap; word-wrap: break-word">
      {{ msg }}
    </div>

    <template #footer>
      <span class="dialog-footer" style="text-align: left">
        <el-button class="zc_btn_default" @click="visibleErrorFlag = false">已知晓</el-button>
      </span>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'

/**
 * 漏斗分析的错误提示弹窗。
 * 与 v2 的 src/views/funnel-analysis/components/dialog-msgError.vue 一一对应。
 *
 * 注意：v3 里自定义分析模块已经有一份同源的副本
 * （src/views/analysis-modules/custom-analysis/components/dialogMsgError.vue），
 * v2 里自定义分析是直接 import 漏斗这一份的，后续可以考虑合并成一个共享组件。
 */
const visibleErrorFlag = ref(false)
const msg = ref('')

function openErrorMsg(message: string) {
  if (message.includes('JSON parse error') || message.includes('JSON parse error:')) {
    msg.value = '书签内的查询分析模型已变更，请重新调整模型后再查询！'
  } else {
    msg.value = message
  }
  visibleErrorFlag.value = true
}

defineExpose({ openErrorMsg })
</script>

<style lang="scss" scoped>
:deep(.el-dialog) {
  border-radius: 6px;
}

:deep(.el-dialog__header) {
  background-color: #fff !important;
  border-radius: 6px;
}

:deep(.el-dialog__body) {
  padding: 20px;
  background-color: #fff !important;
  border-radius: 6px;
}

:deep(.el-dialog__footer) {
  margin-left: 0 !important;
  width: 100%;
  display: flex;
  justify-content: center;
}
</style>
