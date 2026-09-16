<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { percentage } from '@/utils/percent'
import { getSourceWebsiteApi } from '@/api/trackingapi/sourcewebsite'
import arrowIcon from '@/assets/images/icon.png'
import { useLatestOnly } from '@/composables/useLatestOnly'

const props = defineProps<{
  commonParams: Record<string, unknown>
}>()

const router = useRouter()
const loadingRefresh = ref(false)
const { next, isLatest } = useLatestOnly()
const SourceWebsitelist = ref<Record<string, unknown>[]>([])

function tableHeaderColor({ columnIndex }: { columnIndex: number }) {
  // 必须返回对象，不能返回字符串，原因见 PageView.vue 同名函数的注释
  return columnIndex === 0 ? { textAlign: 'left' } : { textAlign: 'center' }
}

function getSourceWebsite() {
  const token = next()
  loadingRefresh.value = true
  getSourceWebsiteApi({ ...props.commonParams })
    .then((res) => {
      if (!isLatest(token)) return
      loadingRefresh.value = false
      SourceWebsitelist.value = (res.data as Record<string, unknown>[]) || []
    })
    .catch(() => {
      if (!isLatest(token)) return
      loadingRefresh.value = false
    })
}

defineExpose({ getSourceWebsite })
</script>

<template>
  <div v-loading="loadingRefresh" class="SourceWebsite block-main public-hoverItem">
    <div class="block-head" @click="router.push('/visitorAnalysis/sourceWeb')">
      <div class="block-title">Top10来源网站</div>
      <div class="block-head-icon">
        <img :src="arrowIcon" alt="" width="10" />
      </div>
    </div>
    <div class="block-index-form">
      <el-table
        class="public-radius"
        :data="SourceWebsitelist"
        :cell-style="tableHeaderColor"
        style="width: 100%"
      >
        <el-table-column align="left" prop="sourcesite" label="来源网站" show-overflow-tooltip>
          <template #default="{ row }">{{ row.sourcesite }}</template>
        </el-table-column>
        <el-table-column align="center" prop="pv" label="浏览量" width="150" />
        <el-table-column label="占比" align="center" width="150">
          <template #default="{ row }">{{ percentage(row.pvRate as number) }}</template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>
