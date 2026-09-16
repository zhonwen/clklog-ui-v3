<script setup lang="ts">
/**
 * 「用户分群创建规则」选择弹窗（对应 v2 views/ups/usergroup/components/rulesDialog.vue）。
 * v2 里「导入创建」那张卡片被注释掉了，这里同样只留「规则创建」。
 */
import { ref } from 'vue'
import { bus } from '@/utils/event-bus'
import type { CreateMethodPayload } from '../types'

const dialogVisible = ref(false)
const handleCreateMet = ref(false)

function openEvent(val?: string) {
  if (val == '切换') {
    handleCreateMet.value = true
  } else {
    handleCreateMet.value = false
  }
  dialogVisible.value = true
}

function createTagType(val: number) {
  switch (val) {
    case 1:
      break
  }
  // 原负载：$bus.$emit('$createMethod', val, '', 'creator')
  const payload: CreateMethodPayload = { createIndex: val, formula: '', fromPage: 'creator' }
  bus.emit('$createMethod', payload)
  dialogVisible.value = false
}

defineExpose({ openEvent })
</script>

<template>
  <div>
    <el-dialog
      v-model="dialogVisible"
      :modal-append-to-body="false"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      width="900px"
      class="prototype_dialog"
      title="用户分群创建规则？"
    >
      <div
        style="background: #fff; padding-top: 40px; border-radius: 6px; min-height: 460px"
      >
        <div class="tagsItem public-hoverItem" @click="createTagType(1)">
          <div class="title">规则创建</div>
          <div class="content">
            使用用户属性及行为数据，筛选出符合条件的用户。如：将“过去 7
            天有登录行为”的用户，划分为“近期登录用户”用户分群
          </div>
        </div>
        <!-- <div class="tagsItem public-hoverItem" @click="createTagType(2)">
          <div class="title">导入创建</div>
          <div class="content">
            上传包含用户属性的文件与用户列表进行匹配，筛选出符合条件的用户。如：将“线下支付”的用户电话号上传与用户列表电话号进行匹配，匹配结果保留为用户分群
          </div>
        </div> -->
      </div>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
// 设置卡片单独hover样式
.public-hoverItem {
  box-shadow: 0 0 0 0;
}

.public-hoverItem:hover {
  border: 1px solid #d8e2ef !important;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.2);
}

:deep() {
  .prototype_dialog .el-dialog__body {
    min-height: 500px;
    padding-top: 20px;
  }

  .el-dialog {
    border-radius: 6px;
  }

  .el-dialog__headerbtn {
    top: 15px;
  }

  .el-dialog__header {
    padding: 0 !important;
    border-radius: 6px;
    // height: 60px;
    height: 44px;
    line-height: 44px;
    background: #fbfcfe;
  }

  .el-dialog__title {
    margin-left: 16px;
    font-size: 15px;
    line-height: 30px;
    color: #4d4d4d;
    font-weight: 600px;
  }

  .el-dialog__body {
    padding: 20px;
    background-color: #eef4fd;
    border-radius: 6px;
  }
}

.tagsItem {
  background: #fbfcfe;
  border: 1px solid #d8e2ef !important;
  margin: 0 20px;
  margin-bottom: 40px;
  min-height: 170px;
  border-radius: 6px;
  padding: 30px;
  cursor: pointer;

  .title {
    font-size: 18px;
    font-weight: 500;
    line-height: 30px;
    color: #4d4d4d;
  }

  .content {
    margin-top: 25px;
    font-size: 15px;
    font-weight: 500;
    line-height: 20px;
    color: #4d4d4d;
  }
}
</style>
