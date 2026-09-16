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
 * 错误详情弹窗。
 * v2 里这个组件放在 src/views/funnel-analysis/components/dialog-msgError.vue，
 * 自定义分析跨目录引用它。v3 里漏斗分析由另一个任务负责，为了不抢同一个文件，
 * 这里在自定义分析目录下放一份内容一致的拷贝；后续两边合并成公共组件即可。
 */
const visibleErrorFlag = ref(false)
const msg = ref('')

function openErrorMsg(message: string) {
  if (message.includes('JSON parse error') || message.includes('JSON parse error:')) {
    // 与 v2 一致（v2 此处逻辑存疑：两个 includes 判断完全等价，后一个恒被前一个覆盖）
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
