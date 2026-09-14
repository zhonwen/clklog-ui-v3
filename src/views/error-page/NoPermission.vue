<script setup lang="ts"></script>

<template>
  <div class="page">
    <el-result
      icon="warning"
      title="Oops!"
      sub-title="访问出错了！请检查路径是否无误，或是否有该页面的访问权限。"
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
