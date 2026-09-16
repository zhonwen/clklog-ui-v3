<script setup lang="ts">
/**
 * 预估人数弹框（对应 v2 `views/ups/userPortrait/components/estimate-dialog.vue`）。
 *
 * 与 v2 一致（v2 此处逻辑存疑：tableData 是写死的三条假数据「全部 / 分层1 / 分层2」，
 * 没有任何接口写入；rule-creator.vue 里 import 了本组件但 estimateEvent 也没有调用点，
 * 属于半成品。原样迁过来，不做补全）。
 */
import { ref } from 'vue'

interface EstimateRow {
  name: string
  rate: number
  num: number
}

const customColor = '#409eff'
const dialogVisible = ref(false)
const tableData = ref<EstimateRow[]>([
  { name: '全部', rate: 100, num: 60 },
  { name: '分层1', rate: 25, num: 20 },
  { name: '分层2', rate: 75, num: 40 },
])

function dialogEvent() {
  dialogVisible.value = true
}

defineExpose({ dialogEvent })
</script>

<template>
  <div>
    <el-dialog v-model="dialogVisible" width="600px" center>
      <div>
        <div class="public-secondHead">预估人数</div>
        <el-table
          class="public-radius"
          :header-cell-style="{ textAlign: 'center', background: '#f7fafe  ' }"
          :cell-style="{ textAlign: 'center' }"
          :data="tableData"
          style="width: 600px"
        >
          <el-table-column prop="name" label="用户分层" />
          <el-table-column prop="rate" label="预估人数/占比">
            <template #default="{ row }">
              <div style="display: flex; justify-content: center; padding: 5px 0">
                <div>{{ row.num }}</div>
                <div style="color: rgb(166 161 164)">（{{ row.rate }}%）</div>
              </div>
              <el-progress :show-text="false" :percentage="row.rate" :color="customColor" />
            </template>
          </el-table-column>
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
