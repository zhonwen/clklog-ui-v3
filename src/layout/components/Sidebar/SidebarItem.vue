<script setup lang="ts">
import { computed, ref } from 'vue'
import Item from './Item.vue'
import AppLink from './Link.vue'
import { isExternal } from '@/utils/validate'
import { resolveRoutePath } from '@/utils/path'
import type { AppRouteRecordRaw } from '@/stores/permission'

function isHiddenItem(item?: AppRouteRecordRaw) {
  const flag = item?.hidden as unknown
  return flag === true || flag === 'true' || flag === 1 || flag === '1' || item?.meta?.hidden === true
}

const props = defineProps<{
  item: AppRouteRecordRaw
  isNest?: boolean
  basePath?: string
}>()

const onlyOneChild = ref<AppRouteRecordRaw | null>(null)

function hasOneShowingChild(children: AppRouteRecordRaw[] = [], parent: AppRouteRecordRaw) {
  const showingChildren = children.filter((item) => {
    if (isHiddenItem(item)) return false
    onlyOneChild.value = item
    return true
  })
  if (showingChildren.length === 1) return true
  if (showingChildren.length === 0) {
    onlyOneChild.value = { ...parent, path: '', noShowingChildren: true } as unknown as AppRouteRecordRaw
    return true
  }
  return false
}

function resolvePath(routePath: string) {
  if (isExternal(routePath)) return routePath
  return resolveRoutePath(props.basePath || '', routePath)
}

const showSingle = computed(() =>
  hasOneShowingChild(props.item.children || [], props.item) &&
  (!onlyOneChild.value?.children ||
    (onlyOneChild.value as AppRouteRecordRaw & { noShowingChildren?: boolean }).noShowingChildren) &&
  !props.item.alwaysShow,
)
</script>

<template>
  <div v-if="!isHiddenItem(item)">
    <template v-if="showSingle">
      <app-link v-if="onlyOneChild?.meta" :to="resolvePath(onlyOneChild.path)">
        <el-menu-item
          :index="resolvePath(onlyOneChild.path)"
          :class="{ 'submenu-title-noDropdown': !isNest }"
        >
          <item
            :icon="(onlyOneChild.meta.icon as string) || (item.meta && (item.meta.icon as string))"
            :title="onlyOneChild.meta.title as string"
          />
        </el-menu-item>
      </app-link>
    </template>

    <el-sub-menu v-else :index="resolvePath(item.path)" :class="{ 'root-level': !isNest }" teleported>
      <template #title>
        <item
          v-if="item.meta"
          :icon="item.meta && (item.meta.icon as string)"
          :title="item.meta.title as string"
        />
      </template>
      <sidebar-item
        v-for="child in item.children"
        :key="child.path"
        :is-nest="true"
        :item="child"
        :base-path="resolvePath(child.path)"
        class="nest-menu"
      />
    </el-sub-menu>
  </div>
</template>
