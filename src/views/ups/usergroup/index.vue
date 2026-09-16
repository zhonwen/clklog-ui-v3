<script setup lang="ts">
/**
 * 用户分群的二级路由出口（对应 v2 views/ups/usergroup/index.vue）。
 *
 * 这里同时挂着全模块的「新建 / 编辑分群」跳转总线：
 * 列表页的编辑 / 查看按钮、规则弹窗的「规则创建」都是 emit 这个事件，由本组件统一 push 路由。
 */
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { bus } from '@/utils/event-bus'
import { useTrackingStore } from '@/stores/tracking'
import { siblingPath } from './utils'
import type { CreateMethodPayload } from './types'

const route = useRoute()
const router = useRouter()
const trackingStore = useTrackingStore()

const projectName = computed(() => trackingStore.projectName)

function onCreateMethod(payload: unknown) {
  const { createIndex, formula, fromPage } = (payload || {}) as CreateMethodPayload
  const query: Record<string, string | number> = {
    createIndex,
    // 3.切换项目 / 项目和标签模型不匹配则跳到list page;通过项目名来进行匹配
    projectName: projectName.value,
  }
  if (formula && formula.id) {
    query.id = formula.id
  }
  if (fromPage) {
    query.createType = 'custom'
  }
  void router.push({
    path: siblingPath(route.path, 'creator'),
    query,
  })
}

onMounted(() => {
  // v2 是 $off 后再 $on，防止路由复用时重复注册；mitt 没有「只 off 自己」以外的写法，
  // 这里改成挂载时 on、卸载时 off 同一个 handler 引用。
  bus.on('$createMethod', onCreateMethod)
})

onBeforeUnmount(() => {
  bus.off('$createMethod', onCreateMethod)
})
</script>

<template>
  <div>
    <router-view />
  </div>
</template>

<style></style>
