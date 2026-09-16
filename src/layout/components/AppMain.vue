<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const key = computed(() => route.path)
</script>

<template>
  <section class="app-main">
    <router-view v-slot="{ Component }">
      <!--
        两处都不能省：

        1. v-if="Component"：目录型菜单（componentUri 为 Layout 且没有可跳转的子页）匹配到的
           记录没有子组件，Component 为 undefined 时 <component :is> 渲染出的是注释节点，
           transition 退场时读它的 parentNode 就抛 null 错误。

        2. 不要再套 <keep-alive>：cachedViews 恒为空数组（addView 全项目没有调用点，
           v2 同样没启用标签页），一个组件都缓存不了，却会让 KeepAlive 介入 DOM 的搬运流程。
           当相邻两个路由复用同一个组件、只有 key 变化时（未迁移的页面都回落到 placeholder，
           最容易命中，例如 /record/summary → /trendAnalysis/trend），
           out-in 的退场与 KeepAlive 的卸载会互相踩，报 reading 'parentNode' 并中断导航。
           将来要做标签页缓存，需连同 addView 调用一起恢复，并重新验证这个组合。
      -->
      <transition v-if="Component" name="fade-transform" mode="out-in">
        <component :is="Component" :key="key" />
      </transition>
    </router-view>
  </section>
</template>

<style lang="scss" scoped>
.app-main {
  min-height: calc(100vh - 50px);
  width: 100%;
  position: relative;
  overflow: hidden;
}
</style>
