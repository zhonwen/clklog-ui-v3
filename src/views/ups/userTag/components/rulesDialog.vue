<script setup lang="ts">
/**
 * 「选择标签创建方式」弹窗（对应 v2 src/views/ups/userTag/components/rulesDialog.vue）。
 *
 * window.globalConfig.otherRules 为真时展示 6 种创建方式，否则只展示「自定义标签值」一种。
 * 该字段不在 public/config.js 里，线上取到的是 undefined —— 与 v2 行为一致（只显示一张卡片）。
 */
import { ref } from 'vue'
import { bus } from '@/utils/event-bus'
import { CREATE_METHOD, type CreateMethodPayload } from '../bus-events'

// config.js 里没有声明 otherRules，不改公共的 env.d.ts，这里按可选字段读
const extraConfig = window.globalConfig as unknown as { otherRules?: boolean }

const dialogVisible = ref(false)
/** 与 v2 一致（v2 此处逻辑存疑：handleCreateMet 记了「切换」状态但 createTagType 里被注释掉没用上） */
const handleCreateMet = ref(false)
const otherRules = ref<boolean>(extraConfig.otherRules || false)

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
  const payload: CreateMethodPayload = {
    createIndex: val,
    formula: '',
    // this.handleCreateMet
    fromPage: 'creator',
  }
  bus.emit(CREATE_METHOD, payload)

  dialogVisible.value = false
}

defineExpose({ openEvent })
</script>

<template>
  <div>
    <el-dialog
      v-model="dialogVisible"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :width="otherRules ? '70%' : '900px'"
      style="min-height: 600px"
      class="prototype_dialog"
      title="选择标签创建方式"
    >
      <div
        v-if="!otherRules"
        style="
          background: #fff;
          padding-top: 40px;
          border-radius: 6px;
          min-height: 460px;
          width: 100%;
          display: flex;
          justify-content: center;
        "
      >
        <div
          class="tagsItem public-hoverItem"
          style="margin-left: 0; width: 90%; height: 150px"
          @click="createTagType(1)"
        >
          <div class="title">自定义标签值</div>
          <div class="content">自定义每个标签值的名称以及计算规则，将人群划分为多个分层</div>
        </div>
        <!-- <div class="tagsItem public-hoverItem" @click="createTagType(1)">
          <div class="title">自定义标签值</div>
          <div class="content">
            自定义每个标签值的名称以及计算规则，将人群划分为多个分层
          </div>
        </div> -->
      </div>

      <div
        v-else
        style="
          background: #fff;
          padding-top: 40px;
          border-radius: 6px;
          min-height: 500px;
          display: flex;
          flex-wrap: wrap;
        "
      >
        <div class="tagsItem public-hoverItem" @click="createTagType(1)">
          <div class="title">自定义标签值</div>
          <div class="content">自定义每个标签值的名称以及计算规则，将人群划分为多个分层</div>
        </div>
        <div class="tagsItem public-hoverItem" @click="createTagType(2)">
          <div class="title">基础指标值</div>
          <div class="content">将用户完成事件的次数等指标的计算结果作为标签值</div>
        </div>
        <div class="tagsItem public-hoverItem" @click="createTagType(3)">
          <div class="title">首次末次特征</div>
          <div class="content">
            将用户首次或末次完成事件的时间、距离今日的天数或事件的属性作为标签值
          </div>
        </div>
        <div class="tagsItem public-hoverItem" @click="createTagType(4)">
          <div class="title">事件偏好属性</div>
          <div class="content">
            将用户完成事件按照某个属性进行分组排序，使用排名前几个的分组作为标签值
          </div>
        </div>
        <div class="tagsItem public-hoverItem" @click="createTagType(5)">
          <div class="title">行为分布结果</div>
          <div class="content">将用户完成事件在指定时间段内分布的天数或小时数作为标签值</div>
        </div>
        <div class="tagsItem public-hoverItem" @click="createTagType(6)">
          <div class="title">SQL 计算结果</div>
          <div class="content">使用返回的 SQL 计算结果作为标签值，为用户进行标记</div>
        </div>
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

:deep(.prototype_dialog .el-dialog__body) {
  min-height: 500px;
  padding-top: 20px;
}

:deep(.el-dialog) {
  border-radius: 6px;
}

:deep(.el-dialog__headerbtn) {
  top: 15px;
}

:deep(.el-dialog__header) {
  padding: 0 !important;
  border-radius: 6px;
  height: 44px;
  line-height: 44px;
  background: #fbfcfe;
}

:deep(.el-dialog__title) {
  margin-left: 16px;
  font-size: 15px;
  line-height: 30px;
  color: #4d4d4d;
  font-weight: 600px;
}

:deep(.el-dialog__body) {
  padding: 20px;
  background-color: #eef4fd;
  border-radius: 6px;
}

.tagsItem {
  background: #fbfcfe;
  border: 1px solid #d8e2ef !important;
  margin-left: 40px;
  margin-bottom: 40px;
  width: calc(50% - 60px);
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
