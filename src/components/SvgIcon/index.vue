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

/**
 * 给单个 svg 文件里的 id 和文件内 `<style>` 的类名加上「图标名」前缀。
 *
 * v2 走 svg-sprite-loader：构建期由 svgo 统一处理，所有图标合成一张 sprite，id 天然不冲突。
 * v3 改成把源文件原样内联进页面（`?raw` + v-html），于是 icons/svg 下的同名 id 直接打架：
 *   - homepage.svg 和 behaviorAnaly.svg 都有 `id="clip-path"`
 *   - access / metadata / setting / summary / trend / visitor 六个文件都有 `id="path"`
 *   - metadata / summary 都有 `id="svg"`，behaviorAnaly / userBehavior 都有 `id="矩形_10"`
 * 内联后 `url(#clip-path)` 只会命中文档里出现的第一个，图标就被别的图标的裁剪路径切坏，
 * 看起来「用的 svg 跟 v2 不是同一个」。
 *
 * 文件内的 `<style>`（homepage / behaviorAnaly / userBehavior 里的 `.cls-1 { fill: none }` 等）
 * 内联后是**文档级**样式，不受 scoped 约束，既会互相覆盖，也会污染页面上任何同名类。
 *
 * 所以这里按图标名做命名空间，等价于 v2 sprite 的隔离效果。
 */
function namespaceSvg(raw: string, prefix: string): string {
  if (!raw) return raw
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  // 1. id 以及所有引用它的地方（url(#x)、href="#x"、xlink:href="#x"）
  const ids = new Set<string>()
  for (const m of raw.matchAll(/\sid="([^"]+)"/g)) {
    if (m[1]) ids.add(m[1])
  }

  let out = raw
  for (const id of ids) {
    const esc = escape(id)
    const next = `${prefix}__${id}`
    out = out
      .replace(new RegExp(`(\\sid=")${esc}(")`, 'g'), `$1${next}$2`)
      .replace(new RegExp(`(url\\(#)${esc}(\\))`, 'g'), `$1${next}$2`)
      .replace(new RegExp(`((?:xlink:)?href="#)${esc}(")`, 'g'), `$1${next}$2`)
  }

  // 2. 文件内 <style> 里声明的类名，连同元素上的 class 属性一起改写
  const classes = new Set<string>()
  for (const styleTag of out.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
    for (const cls of (styleTag[1] || '').matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) {
      if (cls[1]) classes.add(cls[1])
    }
  }
  if (classes.size) {
    // 先改 class 属性（此时里面还是原始类名），再改 <style> 里的选择器
    out = out.replace(
      /(\sclass=")([^"]*)(")/g,
      (_full, head: string, value: string, tail: string) =>
        head +
        value
          .split(/\s+/)
          .filter(Boolean)
          .map((token) => (classes.has(token) ? `${prefix}__${token}` : token))
          .join(' ') +
        tail,
    )
    for (const cls of classes) {
      out = out.replace(new RegExp(`\\.${escape(cls)}\\b`, 'g'), `.${prefix}__${cls}`)
    }
  }

  return out
}

/** 同一个图标复用同一份结果：跨文件冲突已消除，同文件多实例共用同一组 id 指向同一图形，视觉无差异 */
const cache = new Map<string, string>()

const svgHtml = computed(() => {
  const name = props.iconClass
  if (!name) return ''
  const cached = cache.get(name)
  if (cached !== undefined) return cached

  const key = Object.keys(modules).find((item) => item.endsWith(`/${name}.svg`))
  const html = key ? namespaceSvg(modules[key] || '', name.replace(/[^\w-]/g, '')) : ''
  cache.set(name, html)
  return html
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

/*
  内层 svg 必须跟随外层尺寸，不能再写死 1em：
  v2 的 .svg-icon 就是 <svg> 本身，外部（如侧栏的 22px）改 .svg-icon 的宽高就直接改了图形大小；
  v3 多包了一层 span，内层若固定 1em，外部把 span 撑到 22px 图形仍停在 14px，尺寸就同步不过来。
*/
.svg-icon :deep(svg) {
  width: 100%;
  height: 100%;
}
</style>
