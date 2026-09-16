<script setup lang="ts">
/**
 * 列表页 PDF 下载的离屏容器（对应 v2 `views/ups/userPortrait/components/list-pdf-download.vue`）。
 *
 * 与 v2 一致：这里只留一个 id 为 contentToConvert 的定位容器，
 * 真正的 pdf-echart 内容在 v2 里已被注释掉（列表页的「下载 PDF」按钮同样是注释状态），
 * `portrait-list.vue` 仍以 ref 持有它。内容为空时 html2canvas 截出来是空白页，这是 v2 的现状。
 */
</script>

<template>
  <div id="contentToConvert" style="position: absolute; top: 100%; width: 100%">
    <!-- <pdf-echart ref="pdfEchartRef" @allowDownPdf="allowDownPdf"></pdf-echart> -->
    <!-- 下载pdf页面内容 -->
  </div>
</template>

<style></style>
