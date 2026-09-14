<script setup lang="ts">
defineProps<{
  icon?: string
  title?: string
}>()
</script>

<template>
  <i v-if="icon && icon.includes('el-icon')" :class="[icon, 'sub-el-icon']" />
  <svg-icon v-else-if="icon" :icon-class="icon" />
  <span v-if="title">{{ title }}</span>
</template>

<style scoped>
.sub-el-icon {
  color: currentColor;
  width: 1em;
  height: 1em;
}
</style>
