<script setup lang="ts">
import { computed } from 'vue'
import { isExternal } from '@/utils/validate'

const props = defineProps<{
  to: string
}>()

const external = computed(() => isExternal(props.to))
</script>

<template>
  <a v-if="external" :href="to" target="_blank" rel="noopener">
    <slot />
  </a>
  <router-link v-else :to="to">
    <slot />
  </router-link>
</template>
