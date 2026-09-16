<script setup lang="ts">
import { computed, getCurrentInstance, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { FilterBar } from '@/layout/components'
import { htmlToPdf } from '@/utils/htmlToPdf'

const route = useRoute()
const title = computed(() => (route.meta.title as string) || '页面建设中')
const filterParams = ref<Record<string, unknown>>({})
const proxy = getCurrentInstance()?.proxy
const copyText = 'ClkLog v3 公共能力'

function setFilterBarParams(val: Record<string, unknown>) {
  filterParams.value = val
}

function exportPdf() {
  void htmlToPdf('placeholder-pdf', title.value).catch(() => {
    ElMessage.error('导出失败')
  })
}
</script>

<template>
  <div class="placeholder-page">
    <FilterBar ByData ByArea @set-filter-bar-params="setFilterBarParams" />
    <div id="placeholder-pdf" class="placeholder">
      <el-result icon="info" :title="title" sub-title="该菜单已接通。下面是第 3 步公共能力自检。" />
      <div class="checks">
        <div class="icon-row">
          <svg-icon icon-class="homepage" />
          <svg-icon icon-class="access" />
          <svg-icon icon-class="visitor" />
          <svg-icon icon-class="setting" />
        </div>
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="筛选参数">
            {{ filterParams.startTime }} ~ {{ filterParams.endTime }} / {{ filterParams.timeType }}
          </el-descriptions-item>
          <el-descriptions-item label="列宽 $fixedWidth">
            序号 {{ proxy?.$fixedWidth.FwIndex }}
          </el-descriptions-item>
          <el-descriptions-item label="文案 $sharedText.uv">
            <span v-html="proxy?.$sharedText.uv" />
          </el-descriptions-item>
        </el-descriptions>
        <div class="actions">
          <el-button v-clipboard="copyText">复制文案</el-button>
          <el-button type="primary" @click="exportPdf">导出 PDF</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.placeholder-page {
  min-height: calc(100vh - 50px);
  background: #eaf2fc;
}

.placeholder {
  padding: 24px;
}

.checks {
  max-width: 720px;
  margin: 0 auto;
  background: #fff;
  padding: 16px;
  border-radius: 8px;
}

.icon-row {
  display: flex;
  gap: 12px;
  font-size: 22px;
  margin-bottom: 16px;
  color: #2c7be5;
}

.actions {
  margin-top: 16px;
  display: flex;
  gap: 12px;
}
</style>
