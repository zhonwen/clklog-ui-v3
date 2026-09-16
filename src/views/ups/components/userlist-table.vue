<script setup lang="ts">
/**
 * 用户列表（对应 v2 `src/views/ups/components/userlist-table.vue`）。
 *
 * 与 v2 一致（v2 此处逻辑存疑：整个 ups 模块里没有任何地方 import 过这个组件，
 * userListData / total 也没有任何写入口，分页回调只改本地状态、不发请求，
 * 实质上是一个未接线的空壳。按要求原样迁移，并把数据入口 expose 出去，
 * 将来接线时父组件可以直接写 `ref.userListData = rows`）。
 */
import { computed, ref } from 'vue'
import { fixedWidth } from '@/components/el-table-width'
import { formatDateHMS } from '@/utils/date'

interface UserListRow {
  userId?: string
  baseTime?: number | string
  value?: string | number
}

const userListData = ref<UserListRow[]>([])
const pageSize = ref(10)
const pageNum = ref(1)
const total = ref(0)

/** 模板里避免每行重复调 formatDateHMS */
const tableRows = computed(() =>
  userListData.value.map((row) => ({ ...row, baseTimeText: formatDateHMS(row.baseTime) })),
)

function handleSizeChange(val: number) {
  pageNum.value = 1
  pageSize.value = val
}

function handleCurrentChange(val: number) {
  pageNum.value = val
}

defineExpose({ userListData, pageSize, pageNum, total })
</script>

<template>
  <div style="padding-bottom: 50px">
    <p class="public-firstHead" style="margin: 20px 0">用户列表</p>
    <el-table
      class="public-radius"
      :header-cell-style="{
        textAlign: 'center',
        background: '#f7fafe  ',
      }"
      :cell-style="{ textAlign: 'center' }"
      :data="tableRows"
      style="width: 100%"
      border
    >
      <el-table-column type="index" :width="fixedWidth.FwIndex" label="序号" />
      <el-table-column prop="userId" show-overflow-tooltip label="用户ID" />
      <el-table-column prop="baseTime" width="200" label="标签更新时间">
        <template #default="{ row }">
          {{ row.baseTimeText }}
        </template>
      </el-table-column>
      <el-table-column prop="value" label="标签值" />
    </el-table>
    <div class="block">
      <el-pagination
        next-text="下一页"
        :pager-count="5"
        :current-page="pageNum"
        :page-size="pageSize"
        :total="total"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>
  </div>
</template>
