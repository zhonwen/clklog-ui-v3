<script setup lang="ts">
/**
 * 分群用户弹窗（对应 v2 views/ups/usergroup/components/users-dialog.vue）。
 * 表格数据在 v2 里就是写死的 mock，这里原样保留。
 */
import { getCurrentInstance, ref } from 'vue'
import type { GroupRow } from '../types'

interface MockRow {
  name: string
  rate: number
  num: number
}

const proxy = getCurrentInstance()?.proxy

const dialogVisible = ref(false)
const userObject = ref<GroupRow>({})
const tableData = ref<MockRow[]>([
  {
    name: '全部',
    rate: 100,
    num: 60,
  },
  {
    name: '分层1',
    rate: 25,
    num: 20,
  },
  {
    name: '分层2',
    rate: 75,
    num: 40,
  },
])

// cell-style / header-cell-style 必须返回对象，返回字符串会被 element-plus 展开成 {0:'t',...}
const headerCellStyle = { textAlign: 'center', background: '#f7fafe  ' } as const
const cellStyle = { textAlign: 'center' } as const

function openDialog(obj: GroupRow) {
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
          :header-cell-style="headerCellStyle"
          :cell-style="cellStyle"
          :data="tableData"
          style="width: 100%"
        >
          <el-table-column
            label="序号"
            type="index"
            :width="proxy?.$fixedWidth.FwIndex"
            align="center"
          />
          <el-table-column label="访客id" />
          <el-table-column label="用户名" />
          <el-table-column label="首次访问时间" />
        </el-table>
      </div>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
:deep() {
  .el-dialog {
    border-radius: 6px;
  }

  .el-dialog__footer {
    margin-left: 0 !important;
    width: 100%;
    display: flex;
    justify-content: center;
  }
}

.public-secondHead {
  border-bottom: 1px solid #e7e7e7;
  padding-bottom: 15px;
  margin-bottom: 15px;
}
</style>
