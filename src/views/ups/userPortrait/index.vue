<script setup lang="ts">
/**
 * 用户群画像的二级路由出口（对应 v2 `views/ups/userPortrait/index.vue`）。
 *
 * 除了渲染 router-view，还监听总线事件 `$createMethod` 跳到规则创建页。
 * v2 的事件负载是三个参数 `(val, formula, isChecked)`：
 *   val       —— 下标（createIndex）
 *   formula   —— 模型对象，只取了 formula.id
 *   isChecked —— true 为切换、false 为新建（v2 回调里并没有用到它）
 * mitt 只能传一个参数，这里合并成单对象 `{ val, formula, isChecked }`，字段名与原参数名一一对应。
 */
import { onBeforeUnmount, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { bus } from '@/utils/event-bus'

interface CreateMethodPayload {
  /** 原第 1 个参数：下标 */
  val?: number | string
  /** 原第 2 个参数：模型 */
  formula?: { id?: string }
  /** 原第 3 个参数：true 为切换，false 为新建（v2 回调里未使用） */
  isChecked?: boolean
}

const router = useRouter()

function onCreateMethod(payload: unknown) {
  const { val, formula } = (payload || {}) as CreateMethodPayload
  router.push({
    path: 'creator',
    query: {
      createIndex: val == null ? undefined : String(val),
      id: formula?.id,
      from: 'list',
    },
  })
}

onMounted(() => {
  // v2 是先 $off 再 $on，防止重复注册；mitt 的 off 必须传同一个 handler 引用
  bus.off('$createMethod', onCreateMethod)
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
