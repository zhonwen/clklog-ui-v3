<script setup lang="ts">
import { computed, ref } from 'vue'
import { Close } from '@element-plus/icons-vue'
import trafficOverviewCommon from '@/components/trafficOverview/index.vue'
import { sharedText } from '@/components/pointFont'

/** 崩溃详情信息弹窗（v2 src/views/collapse-analysis/components/collapseDetail-dialog.vue） */

// 共享组件的 labelList 形状（<script setup> 不能 export 类型，两边各自声明）
interface TrafficOverviewLabel {
  name: string
  tip?: string
}

interface CrashLogRow {
  logTime?: string
  appVersion?: string
  os?: string
  osVersion?: string
  model?: string
  appCrashedReason?: string
  eventSessionId?: string
  [key: string]: unknown
}

/**
 * v2 写的是 sharedText.Crashtriggercount / Collapserate / visitUser / CrashtriggerUser，
 * pointFont 里并没有这几个键，取到的是 undefined。与 v2 一致（v2 此处逻辑存疑：键名对不上，
 * 而且这里的 5 个标题是「崩溃时间/应用版本/…」，tip 内容本身也和标题不匹配）。
 * tip 只喂给共享组件里已被注释掉的 popover，当前没有渲染出口。
 */
const sharedTextMap = sharedText as unknown as Record<string, string | undefined>

const dialogVisible = ref(false)
const rowList = ref<CrashLogRow>({})
const overviewList = ref<CrashLogRow[]>([{}])

const labelList: TrafficOverviewLabel[] = [
  {
    name: '崩溃时间',
    tip: sharedText.visitCount,
  },
  {
    name: '应用版本',
    tip: sharedTextMap.Crashtriggercount,
  },
  {
    name: '操作系统',
    tip: sharedTextMap.Collapserate,
  },
  {
    name: '操作系统版本',
    tip: sharedTextMap.visitUser,
  },
  {
    name: '设备型号',
    tip: sharedTextMap.CrashtriggerUser,
  },
]

function filterReason(str: string | undefined) {
  return str ? str.replace(/\n/g, '<br/>') : ''
}

// v2 模板里直接调用 filterReason(rowList.appCrashedReason)，这里改成 computed 避免重复求值
const reasonHtml = computed(() => filterReason(rowList.value.appCrashedReason))

function openErrorLog(row: CrashLogRow) {
  rowList.value = row
  overviewList.value = [rowList.value]
  dialogVisible.value = true
}

// v2 里父组件用 this.$refs.collapseDetail.openErrorLog(row) 调用，<script setup> 默认对外封闭
defineExpose({ openErrorLog })
</script>

<template>
  <div>
    <el-dialog v-model="dialogVisible" :show-close="false" width="1000px">
      <div>
        <div class="custom-header">
          <div>
            <div
              style="
                height: 44px;
                background: #fbfcfe;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-radius: 6px 6px 0 0;
              "
            >
              <div
                style="
                  font-size: 16px;
                  font-weight: bold;
                  line-height: 44px;
                  margin-left: 16px;
                  color: #4d4d4d;
                "
              >
                崩溃详情信息
              </div>
              <div class="closeIcon" @click="dialogVisible = false">
                <el-icon><Close /></el-icon>
              </div>
            </div>
          </div>
        </div>

        <div class="public-block" style="margin-right: 24px">
          <div class="public-hoverItem">
            <div
              class="public-firstHead"
              style="background-color: #fff; border-radius: 6px; height: 100px"
            >
              <trafficOverviewCommon
                :labelList="labelList"
                :width="19.6"
                :overviewList="overviewList"
              />
              <div
                v-for="(item, index) in overviewList"
                :key="index"
                class="bid-list-carded"
              >
                <div
                  class="bid-list-item w111"
                  :style="index == 0 ? 'color:#2c7be5' : 'color:#4d4d4d'"
                >
                  <p>{{ item.logTime }}</p>
                </div>
                <div
                  class="bid-list-item w111"
                  :style="index == 0 ? 'color:#2c7be5' : 'color:#4d4d4d'"
                >
                  <p>{{ item.appVersion }}</p>
                </div>
                <div
                  class="bid-list-item w111"
                  :style="index == 0 ? 'color:#2c7be5' : 'color:#4d4d4d'"
                >
                  <p>{{ item.os }}</p>
                </div>
                <div
                  class="bid-list-item w111"
                  :style="index == 0 ? 'color:#2c7be5' : 'color:#4d4d4d'"
                >
                  <p>{{ item.osVersion }}</p>
                </div>
                <div
                  class="bid-list-item w111"
                  :style="index == 0 ? 'color:#2c7be5' : 'color:#4d4d4d'"
                >
                  <p>{{ item.model }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style="min-height: 400px; max-height: 600px; overflow: auto; position: relative">
          <div class="userLoyalty public-hoverItem" style="margin-top: 0px">
            <!-- eslint-disable-next-line vue/no-v-html -->
            <div style="line-height: 17px" v-html="reasonHtml"></div>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
:deep() {
  .el-dialog {
    border-radius: 6px;
  }

  .el-dialog__headerbtn {
    top: 15px;
  }

  .el-dialog__header {
    padding: 0 !important;
    border-radius: 6px;
  }

  .el-dialog__body {
    padding: 0;
    background-color: #eef4fd;
    border-radius: 6px;
  }
}

.bid-list-carded {
  display: flex;

  .bid-list-item {
    width: 19.6%;
    justify-content: center;
    height: 30px;
    display: flex;
    align-items: center;
  }

  .w157 {
    color: #4d4d4d;
    font-size: 12px;
    line-height: 14px;
  }

  .w158 {
    color: #3a98e6;
    font-size: 17px;
    line-height: 17px;
  }
}

.closeIcon {
  margin-right: 30px;
  cursor: pointer;
  font-size: 20px;
}

.userLoyalty {
  margin: 20px;
  padding: 20px;
  min-height: 400px;
  box-sizing: border-box;
  background: #fff;
  position: relative;
  border-radius: 6px !important;
}
</style>
