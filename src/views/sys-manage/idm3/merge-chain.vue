<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { mergeChain } from '@/api/sysmanage/idm3userassoc'
import type { MergeChainItem } from '@/api/sysmanage/idm3userassoc'
import { MERGE_REASON_OPTIONS, MERGE_STATUS_OPTIONS, labelOf } from './constants'

const userId = ref('')
const loading = ref(false)
const searched = ref(false)
const finalUser = ref('')
const chain = ref<MergeChainItem[]>([])

function statusTagType(status: string): string {
  if (status === 'SUCCESS') return 'success'
  if (status === 'FAILED') return 'danger'
  if (status === 'PARTIAL') return 'warning'
  return 'info'
}

function handleQuery() {
  if (!userId.value) {
    ElMessage.warning('请输入用户ID')
    return
  }
  loading.value = true
  searched.value = false
  mergeChain({ userId: userId.value })
    .then((res) => {
      const data = res.data || {}
      finalUser.value = data.finalUser || ''
      chain.value = (data.chain || []).slice().reverse()
      searched.value = true
    })
    .finally(() => {
      loading.value = false
    })
}
</script>

<template>
  <div class="public-block">
    <div class="Overview public-hoverItem" style="padding: 25px">
      <div class="public-firstHead">合并链路追踪（全域用户关联）</div>
      <br />
      <el-form :inline="true" size="small" style="margin-bottom: 20px">
        <el-form-item label="用户ID">
          <el-input v-model="userId" placeholder="请输入要追踪的用户ID" clearable style="width: 320px" />
        </el-form-item>
        <el-form-item>
          <el-button class="zc_btn" :loading="loading" @click="handleQuery">查询链路</el-button>
        </el-form-item>
      </el-form>

      <el-alert
        v-if="searched && chain.length === 0"
        title="未查询到该用户参与的合并记录"
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom: 15px"
      />

      <div v-if="searched && chain.length > 0" class="chain-wrapper">
        <div class="final-card">
          <div class="final-title">最终归属主用户</div>
          <div class="final-content-row">
            <span class="final-user">{{ finalUser || '-' }}</span>
            <span class="final-count">（共参与 {{ chain.length }} 次合并）</span>
          </div>
        </div>

        <div class="chain-list">
          <div
            v-for="(item, idx) in chain"
            :key="item.mergeId"
            class="chain-item"
            :class="{ 'is-newest': idx === 0 }"
          >
            <div class="chain-node">
              <div class="chain-line chain-line-top"></div>
              <div class="chain-dot"></div>
              <div class="chain-line chain-line-bottom"></div>
            </div>
            <div class="chain-content">
              <div class="chain-user-row">
                <span class="chain-user-id">{{ item.userIdMerge }}</span>
              </div>
              <div class="chain-info-block">
                <div class="chain-info-row">
                  <span class="info-item">
                    <span class="info-label">合并ID：</span>
                    <span class="info-value">{{ item.mergeId }}</span>
                  </span>
                  <span class="info-item">
                    <span class="info-label">项目：</span>
                    <span class="info-value">{{ item.projectName }}</span>
                  </span>
                  <span class="info-item">
                    <span class="info-label">原因：</span>
                    <span class="info-value">{{ labelOf(MERGE_REASON_OPTIONS, item.mergeReason) }}</span>
                  </span>
                  <span class="info-item">
                    <span class="info-label">状态：</span>
                    <el-tag :type="statusTagType(item.status || '')" size="small">
                      {{ labelOf(MERGE_STATUS_OPTIONS, item.status) }}
                    </el-tag>
                  </span>
                </div>
                <div class="chain-info-row chain-info-second">
                  <span class="info-item">
                    <span class="info-label">保留用户：</span>
                    <span class="info-value">{{ item.userIdKeep }}</span>
                  </span>
                  <span class="info-item">
                    <span class="info-label">合并用户：</span>
                    <span class="info-value">{{ item.userIdMerge }}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.el-form-item__label) {
  font-weight: 400;
}

.zc_btn {
  color: #fff;
  background: #2c7be5;
  border: 1px solid #2c7be5;
}

.chain-wrapper {
  border: 1px solid #ebeef5;
  border-radius: 4px;
  background: #fff;
  overflow: hidden;
}

.final-card {
  border-left: 2px solid #2c7be5;
  padding: 16px 20px;
  background: #fff;
  border-bottom: 1px solid #ebeef5;
}

.final-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
}

.final-content-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.final-user {
  font-size: 18px;
  font-weight: bold;
  color: #2c7be5;
  letter-spacing: 0.5px;
}

.final-count {
  margin-left: 14px;
  color: #909399;
  font-size: 14px;
}

.chain-list {
  margin: 0;
}

.chain-item {
  display: flex;
  align-items: stretch;
}

.chain-node {
  width: 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
  position: relative;
  margin-left: 15px;
}

.chain-node::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 0;
  transform: translateX(-50%);
  width: 2px;
  height: 100%;
  background: #dcdfe6;
}

.chain-item.is-newest .chain-node::before {
  top: 20px;
  height: calc(100% - 20px);
}

.chain-item:last-child .chain-node::before {
  top: 0;
  height: 15px;
}

.chain-item.is-newest:last-child .chain-node::before {
  display: none;
}

.chain-line {
  display: none;
}

.chain-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #2c7be5;
  position: absolute;
  left: 50%;
  top: 15px;
  transform: translateX(-50%);
  z-index: 2;
}

.chain-content {
  flex: 1;
  padding: 12px 24px 18px 14px;
}

.chain-user-row {
  margin-bottom: 8px;
}

.chain-user-id {
  font-size: 14px;
  color: #606266;
  font-weight: 500;
  display: inline-block;
  line-height: 1;
}

.chain-info-block {
  background: #f5f7fa;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 12px 16px;
  transition: background-color 0.2s ease;
}

.chain-info-block:hover {
  background: #eef3fb;
}

.chain-info-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 24px;
  color: #303133;
  font-size: 14px;
  line-height: 1.8;
}

.chain-info-second {
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px dashed #dde3ea;
}

.info-item {
  display: inline-flex;
  align-items: center;
}

.info-label {
  color: #606266;
  font-weight: 500;
  margin-right: 2px;
}

.info-value {
  color: #303133;
  font-family: 'SF Mono', Menlo, Consolas, monospace;
  font-size: 13px;
}
</style>
