<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const title = computed(() => (route.meta.title as string) || '页面建设中')
</script>

<template>
  <div class="placeholder">
    <el-result icon="info" :title="title" sub-title="该菜单已接通，页面将在后续步骤从 v2 迁入。" />
  </div>
</template>

<style scoped lang="scss">
.placeholder {
  min-height: calc(100vh - 50px);
  display: flex;
  align-items: center;
  justify-content: center;
  background: #eaf2fc;
}
</style>
