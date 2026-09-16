<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { getInternalSearchWordDetailApi } from '@/api/trackingapi/searchword'
import { copyObj } from '@/utils/copy'
import { percentage } from '@/utils/percent'
import arrowIcon from '@/assets/images/icon.png'
import { useLatestOnly } from '@/composables/useLatestOnly'

const props = defineProps<{
  commonParams: Record<string, unknown>
}>()

const router = useRouter()
const loadingRefresh = ref(false)
const { next, isLatest } = useLatestOnly()
const searchWordList = ref<Record<string, unknown>[]>([])

function tableHeaderColor({ columnIndex }: { columnIndex: number }) {
  // 必须返回对象，不能返回字符串，原因见 PageView.vue 同名函数的注释
  return columnIndex === 0 ? { textAlign: 'left' } : { textAlign: 'center' }
}

function getSearchWord() {
  const token = next()
  loadingRefresh.value = true
  const onSiteParams = copyObj({ ...props.commonParams, pageSize: 10, pageNum: 1 })
  getInternalSearchWordDetailApi(onSiteParams)
    .then((res) => {
      if (!isLatest(token)) return
      loadingRefresh.value = false
      if (res.code == 200) {
        const data = res.data as { rows?: Record<string, unknown>[] }
        searchWordList.value = data?.rows || []
      }
    })
    .catch(() => {
      if (!isLatest(token)) return
      loadingRefresh.value = false
    })
}

defineExpose({ getSearchWord })
</script>

<template>
  <div v-loading="loadingRefresh" class="SearchWord block-main public-hoverItem">
    <div class="block-head" @click="router.push('/access/searchTerm/siteonSearch')">
      <div class="block-title">Top10站内搜索词</div>
      <div class="block-head-icon">
        <img :src="arrowIcon" alt="" width="10" />
      </div>
    </div>
    <div class="block-index-form">
      <el-table
        class="public-radius"
        :data="searchWordList"
        :cell-style="tableHeaderColor"
        style="width: 100%"
      >
        <el-table-column prop="word" label="搜索词" align="left" show-overflow-tooltip>
          <template #default="{ row }">{{ row.searchword }}</template>
        </el-table-column>
        <el-table-column prop="pv" label="搜索次数" align="center" />
        <el-table-column label="搜索次数占比" align="center">
          <template #default="{ row }">{{ percentage(row.pvRate as number) }}</template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>
