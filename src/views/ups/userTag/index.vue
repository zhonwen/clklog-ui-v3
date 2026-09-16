<script setup lang="ts">
/**
 * 用户标签模块的壳子（对应 v2 src/views/ups/userTag/index.vue）。
 * 自己只渲染 <router-view>，真正的页面是 tag-list.vue / tag-creator.vue。
 *
 * 它唯一的职责是监听 `$createMethod`，把「新建 / 编辑 / 查看标签」统一跳到创建页。
 * v2 的 bus 是三参数 emit，v3 的 mitt 只能带一个参数，负载合并成 CreateMethodPayload
 * （原负载：参数1 下标；参数2 模型；参数3 true 为切换、false 为新建）。
 */
import { onBeforeUnmount, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { bus } from '@/utils/event-bus'
import { useTrackingStore } from '@/stores/tracking'
import { CREATE_METHOD, type CreateMethodPayload } from './bus-events'

const router = useRouter()
const trackingStore = useTrackingStore()

function onCreateMethod(payload: unknown) {
  const { createIndex, formula, fromPage } = payload as CreateMethodPayload
  const query: Record<string, string> = {
    createIndex: String(createIndex),
    // 3.切换项目 / 项目和标签模型不匹配则跳到list page;通过项目名来进行匹配
    projectName: trackingStore.projectName,
  }
  if (formula && formula.id) {
    query.id = formula.id
  }
  if (fromPage) {
    query.createType = 'custom'
  }
  void router.push({
    path: '/ups/userTag/create',
    query,
  })
}

onMounted(() => {
  // 与 v2 一致：先 off 再 on，避免来回进出页面挂多份监听
  bus.off(CREATE_METHOD, onCreateMethod)
  bus.on(CREATE_METHOD, onCreateMethod)
})

onBeforeUnmount(() => {
  bus.off(CREATE_METHOD, onCreateMethod)
})
</script>

<template>
  <div>
    <router-view></router-view>
  </div>
</template>

<style></style>
