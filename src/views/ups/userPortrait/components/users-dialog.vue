<script setup lang="ts">
/**
 * 用户明细弹框（对应 v2 `views/ups/userPortrait/components/users-dialog.vue`）。
 *
 * 与 v2 一致（v2 此处逻辑存疑：tableData 是写死的三条假数据，四个表格列都没有 prop，
 * 所以除了「序号」以外全是空列；本模块内也没有任何地方 import 过这个组件，属于半成品。
 * 按要求原样迁过来，不做补全）。
 */
import { getCurrentInstance, ref } from 'vue'

interface UserRow {
  name: string
  rate: number
  num: number
}

const proxy = getCurrentInstance()?.proxy

const dialogVisible = ref(false)
const tableData = ref<UserRow[]>([
  { name: '全部', rate: 100, num: 60 },
  { name: '分层1', rate: 25, num: 20 },
  { name: '分层2', rate: 75, num: 40 },
])
const userObject = ref<{ name?: string }>({})

function openDialog(obj: { name?: string }) {
  userObject.value = obj
  dialogVisible.value = true
}

defineExpose({ openDialog })
</script>

<template>
  <div>
    <el-dialog v-model="dialogVisible" width="800px" center>
      <div>
        <div class="public-secondHead">{{ userObject.name }}</div>
        <el-table
          class="public-radius"
          :header-cell-style="{ textAlign: 'center', background: '#f7fafe  ' }"
          :cell-style="{ textAlign: 'center' }"
          :data="tableData"
          style="width: 100%"
        >
          <el-table-column
            label="序号"
            type="index"
            :width="proxy?.$fixedWidth.FwIndex"
            align="center"
          >
            <!-- <template #default="scope">
              <span v-text="getIndex(scope.$index)"> </span>
            </template> -->
          </el-table-column>
          <el-table-column label="访客id" />
          <el-table-column label="用户名" />
          <el-table-column label="首次访问时间" />
        </el-table>
      </div>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
:deep(.el-dialog) {
  border-radius: 6px;
}

:deep(.el-dialog__footer) {
  margin-left: 0 !important;
  width: 100%;
  display: flex;
  justify-content: center;
}

.public-secondHead {
  border-bottom: 1px solid #e7e7e7;
  padding-bottom: 15px;
  margin-bottom: 15px;
}
</style>
