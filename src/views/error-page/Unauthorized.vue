<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()

async function back() {
  await userStore.logout()
  await router.replace({ path: '/login' })
}

function openClklog() {
  window.open(window.globalConfig.copyRightUrl || 'https://clklog.com/#/introduce')
}
</script>

<template>
  <div class="page">
    <el-result icon="warning" title="Oops!" sub-title="您的账号暂无任何数据访问权限，请联系管理员分配权限后再登录">
      <template #extra>
        <el-button type="primary" @click="back">返回登录</el-button>
        <el-button @click="openClklog">官网</el-button>
      </template>
    </el-result>
  </div>
</template>

<style scoped lang="scss">
.page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(247, 250, 255);
}
</style>
