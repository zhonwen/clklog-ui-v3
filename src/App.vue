<script setup lang="ts">
import { RouterView } from 'vue-router'
import ModifyPsw from '@/components/ModifyPsw/index.vue'
// favicon 由 index.html 的 <link rel="icon"> 指定，不再在运行时重复插入
</script>

<template>
  <RouterView />
  <ModifyPsw />
</template>

<style lang="scss">
.el-message-box__btns {
  display: flex;
  flex-direction: row-reverse;
}

.custom-cancel-button {
  margin-left: 10px;
}

.el-message-box__btns button:nth-child(2) {
  margin-right: 10px;
}

.el-table {
  .el-table__body-wrapper::-webkit-scrollbar {
    width: 7px;
    height: 7px;
  }

  .el-table__body-wrapper::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 5px;
  }
}

::-webkit-scrollbar {
  width: 7px;
  height: 7px;
}

::-webkit-scrollbar-track {
  border-radius: 0 6px 0 0;
  background: #f1f1f1;
}

::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 5px;
}

::-webkit-scrollbar-thumb:hover {
  background: #555;
}

.el-dialog__title {
  font-size: 15px;
  font-weight: 600;
  line-height: 25px;
  color: #4d4d4d;
}

.el-scrollbar__wrap {
  overflow: auto;
}

#nprogress .bar {
  background: #2c7be5;
}

#nprogress .peg {
  box-shadow:
    0 0 10px #2c7be5,
    0 0 5px #2c7be5;
}
</style>
