<script setup lang="ts"></script>

<template>
  <div class="page">
    <el-result
      icon="warning"
      title="Oops!"
      sub-title="页面接口权限配置错误，请联系管理员检查该菜单是否正确配置对应的接口权限！"
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
