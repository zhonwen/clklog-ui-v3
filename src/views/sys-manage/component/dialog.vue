<script setup lang="ts">
import { ref } from 'vue'

const operationalVisible = ref(false)

function dialogEvent() {
  operationalVisible.value = true
}

// <script setup> 默认对外封闭，父组件通过 ref 调 dialogEvent() 必须先 expose
defineExpose({ dialogEvent })
</script>

<template>
  <div>
    <el-dialog v-model="operationalVisible" title="提示" width="30%" center>
      <span>演示环境不能执行相关操作</span>
      <template #footer>
        <span class="dialog-footer">
          <el-button type="primary" @click="operationalVisible = false">确 定</el-button>
          <el-button style="margin-left: 50px" @click="operationalVisible = false">取 消</el-button>
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

  .el-dialog__footer {
    margin-left: 0 !important;
    width: 100%;
    display: flex;
    justify-content: center;
  }
}
</style>
