<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useTagsViewStore } from '@/stores/tagsView'

const route = useRoute()
const tagsViewStore = useTagsViewStore()
const cachedViews = computed(() => tagsViewStore.cachedViews)
const key = computed(() => route.path)
</script>

<template>
  <section class="app-main">
    <router-view v-slot="{ Component }">
      <!--
        必须判空：目录型菜单（componentUri 为 Layout 且没有可跳转的子页）匹配到的记录没有子组件，
        Component 此时是 undefined，<component :is="undefined"> 渲染出的是注释节点。
        transition 的 out-in 在退场时会去读这个节点的 parentNode，
        于是报 Cannot read properties of null (reading 'parentNode')，导航随之中断。
      -->
      <transition v-if="Component" name="fade-transform" mode="out-in">
        <keep-alive :include="cachedViews">
          <component :is="Component" :key="key" />
        </keep-alive>
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
