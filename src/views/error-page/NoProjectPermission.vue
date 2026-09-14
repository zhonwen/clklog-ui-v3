<script setup lang="ts"></script>

<template>
  <div class="page">
    <el-result
      icon="warning"
      title="Oops!"
      sub-title="您没有该项目的数据访问权限，请联系管理员分配项目权限后再访问！"
    />
  </div>
</template>

<style scoped lang="scss">
.page {
  min-height: calc(100vh - 50px);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(247, 250, 255);
}
</style>
