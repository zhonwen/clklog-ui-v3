<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { getVisitUriApi } from '@/api/trackingapi/visituri'
import { percentage } from '@/utils/percent'
import arrowIcon from '@/assets/images/icon.png'
import { useLatestOnly } from '@/composables/useLatestOnly'

const props = defineProps<{
  commonParams: Record<string, unknown>
}>()

const router = useRouter()
const loadingRefresh = ref(false)
const { next, isLatest } = useLatestOnly()
const getVisitList = ref<Record<string, unknown>[]>([])

function tableHeaderColor({ columnIndex }: { columnIndex: number }) {
  // 必须返回对象，不能返回字符串。
  // element-plus 会对 cell-style 的返回值做 Object.assign（table-body/styles-helper.mjs:42），
  // 字符串会被展开成 { 0: 't', 1: 'e', ... } 再绑到 :style，Vue 随后去设 style['0']，
  // 抛 “Failed to set an indexed property [0] on CSSStyleDeclaration”。
  // 该单元格渲染失败后，列组件的 subTree.el 为 null，离开页面时再触发更新就报
  // “Cannot read properties of null (reading 'type' / 'parentNode')”，并打断路由导航。
  // element-ui 是直接 return，Vue 2 支持字符串 style，所以 v2 没有这个问题。
  return columnIndex === 0 ? { textAlign: 'left' } : { textAlign: 'center' }
}

function getVisitUri() {
  const token = next()
  loadingRefresh.value = true
  getVisitUriApi({ ...props.commonParams })
    .then((res) => {
      if (!isLatest(token)) return
      loadingRefresh.value = false
      getVisitList.value = (res.data as Record<string, unknown>[]) || []
    })
    .catch(() => {
      if (!isLatest(token)) return
      loadingRefresh.value = false
    })
}

defineExpose({ getVisitUri })
</script>

<template>
  <div v-loading="loadingRefresh" class="PageView block-main public-hoverItem">
    <div class="block-head" @click="router.push('/access/interviewdPage/visitedPage')">
      <div class="block-title">Top10受访页面</div>
      <div class="block-head-icon">
        <img :src="arrowIcon" alt="" width="10" />
      </div>
    </div>
    <div class="block-index-form">
      <el-table
        class="public-radius"
        :data="getVisitList"
        :cell-style="tableHeaderColor"
        style="width: 100%"
      >
        <el-table-column align="left" prop="uri" label="受访页面" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.title }}<br />
            {{ row.uri }}
          </template>
        </el-table-column>
        <el-table-column align="center" prop="pv" label="浏览量" width="150" />
        <el-table-column align="center" label="占比" width="150">
          <template #default="{ row }">{{ percentage(row.percent as number) }}</template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>
