<script setup lang="ts">
import { computed } from 'vue'

const config = computed(
  () =>
    window.globalConfig ?? {
      BASE_API: '',
      BASE_API_MANAGE: '',
      BASE_API_AUTHMANAGE: '',
      BASE_API_UPSAPI: '',
      clklog_api_timeout: 120,
      clklog_api_load_maxtime: 120,
      copyRight: 'ClkLog',
      copyRightUrl: 'https://clklog.com/#/introduce',
    },
)
</script>

<template>
  <div class="shell">
    <el-card class="shell-card">
      <template #header>
        <div class="shell-header">
          <span>{{ config.copyRight }} UI v3</span>
          <el-tag type="success" size="small">第 1 步：工程骨架</el-tag>
        </div>
      </template>
      <p class="desc">
        Vue 3 + TypeScript + Element Plus + Vite 已就绪。登录、布局和动态菜单在第 2 步接入。
      </p>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="clklog-api">{{ config.BASE_API }}</el-descriptions-item>
        <el-descriptions-item label="manage">{{ config.BASE_API_MANAGE }}</el-descriptions-item>
        <el-descriptions-item label="authmanage">{{
          config.BASE_API_AUTHMANAGE
        }}</el-descriptions-item>
        <el-descriptions-item label="ups-api">{{ config.BASE_API_UPSAPI }}</el-descriptions-item>
      </el-descriptions>
      <div class="actions">
        <el-button type="primary" disabled>登录（第 2 步）</el-button>
        <el-link :href="config.copyRightUrl" target="_blank" rel="noopener noreferrer">官网</el-link>
      </div>
    </el-card>
  </div>
</template>

<style scoped lang="scss">
.shell {
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.shell-card {
  width: 640px;
  max-width: 100%;
}

.shell-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: $font-size-supper;
  font-weight: 600;
}

.desc {
  margin: 0 0 16px;
  color: $gray;
}

.actions {
  margin-top: 16px;
}
</style>
