<script setup lang="ts">
import { computed } from 'vue'
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

type SingleChild = AppRouteRecordRaw & { noShowingChildren?: boolean }

function resolvePath(routePath: string) {
  if (isExternal(routePath)) return routePath
  return resolveRoutePath(props.basePath || '', routePath)
}

/**
 * 一次算完「是否只渲染单个菜单项」和「那一项是谁」。
 *
 * 之前是 computed 内部去写另一个 ref（onlyOneChild），模板依赖两者的求值先后，
 * 一旦 computed 命中缓存或 onlyOneChild 被提前读取就会拿到陈旧值。
 */
const single = computed<{ show: boolean; child: SingleChild | null }>(() => {
  const showingChildren = (props.item.children || []).filter((item) => !isHiddenItem(item))

  let child: SingleChild | null = null
  if (showingChildren.length === 1) {
    child = showingChildren[0] as SingleChild
  } else if (showingChildren.length === 0) {
    child = { ...props.item, path: '', noShowingChildren: true } as SingleChild
  } else {
    return { show: false, child: null }
  }

  const show = (!child.children || child.noShowingChildren === true) && !props.item.alwaysShow
  return { show, child }
})

const onlyOneChild = computed(() => single.value.child)
const showSingle = computed(() => single.value.show)
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
