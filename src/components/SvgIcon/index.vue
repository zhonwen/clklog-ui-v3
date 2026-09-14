<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  iconClass: string
  className?: string
}>()

const modules = import.meta.glob('@/icons/svg/*.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

const svgHtml = computed(() => {
  const key = Object.keys(modules).find((item) => item.endsWith(`/${props.iconClass}.svg`))
  return key ? modules[key] : ''
})
</script>

<template>
  <span class="svg-icon" :class="className" v-html="svgHtml" />
</template>

<style scoped>
.svg-icon {
  display: inline-flex;
  width: 1em;
  height: 1em;
  fill: currentColor;
  vertical-align: middle;
}

.svg-icon :deep(svg) {
  width: 1em;
  height: 1em;
}
</style>
