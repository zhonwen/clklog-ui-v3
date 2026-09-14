<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import SidebarItem from './SidebarItem.vue'
import { useAppStore } from '@/stores/app'
import { usePermissionStore } from '@/stores/permission'
import { useSettingsStore } from '@/stores/settings'

const route = useRoute()
const appStore = useAppStore()
const permissionStore = usePermissionStore()
const settingsStore = useSettingsStore()
const defaultOpen = ref<string[]>([])

const permissionRoutes = computed(() => permissionStore.routes)
const sidebar = computed(() => appStore.sidebar)
const showLogo = computed(() => settingsStore.sidebarLogo)
const isCollapse = computed(() => !sidebar.value.opened)

const activeMenu = computed(() => {
  const { meta, path } = route
  if (path === '/NoPermission' || path === '/NoProjectPermission') return ''
  if (meta && meta.activeMenu) return meta.activeMenu as string
  const specialKeys = ['userGroup', 'userTag', 'userportrait', 'userReview']
  for (const key of specialKeys) {
    const suffix = `/${key}/list`
    if (path.endsWith(suffix)) {
      return path.replace(/\/list$/, '')
    }
  }
  return path
})

function handleOpen(_key: string, keyPath: string[]) {
  if (keyPath.length == 1) {
    defaultOpen.value = [_key]
  }
}
</script>

<template>
  <div :class="{ 'has-logo': showLogo }">
    <el-scrollbar wrap-class="scrollbar-wrapper">
      <el-menu
        background-color="#fff"
        text-color="#4D4D4D"
        active-text-color="#000000"
        :unique-opened="false"
        :collapse-transition="false"
        :collapse="isCollapse"
        mode="vertical"
        :default-active="activeMenu"
        :default-openeds="defaultOpen"
        @open="handleOpen"
      >
        <sidebar-item
          v-for="item in permissionRoutes"
          :key="item.path"
          :item="item"
          :base-path="item.path"
        />
      </el-menu>
    </el-scrollbar>
  </div>
</template>
