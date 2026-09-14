<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { getFirstRoutePath } from '@/utils/menu'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const raw = route.params.path
const pathParam = Array.isArray(raw) ? raw.join('/') : raw
const target = pathParam ? `/${pathParam}` : null
const fallback = getFirstRoutePath(userStore.menuList) || '/NoPermission'
void router.replace({ path: target || fallback, query: route.query })
</script>

<template>
  <div />
</template>
