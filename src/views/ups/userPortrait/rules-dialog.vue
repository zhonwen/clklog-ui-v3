<script setup lang="ts">
/**
 * 画像人群规则弹框（对应 v2 `views/ups/userPortrait/rules-dialog.vue`）。
 * 内部包一个 rule-creator，负责「添加/更新 目标人群 / 对比人群」四种场景。
 */
import { nextTick, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ruleCreator from './rule-creator.vue'
import type { PortraitInfoItem, PortraitRow } from './types'

const emit = defineEmits<{ updatePortrait: [type: string] }>()

const route = useRoute()
const router = useRouter()

/**
 * v2 读的是 `window.globalConfig.isDebug`。
 * v3 的 env.d.ts 里 GlobalConfig 还没有这个字段，这里按可选字段取值，取不到当作 false。
 */
const isDebug = Boolean(
  (window.globalConfig as unknown as { isDebug?: boolean } | undefined)?.isDebug,
)

const dialogVisible = ref(false)
/** 更新类型 */
const updateType = ref('')
/** v2 会以 0 / index+1 / "" / undefined 四种形态传进来，原样保留，不做归一化 */
const currentIndex = ref<number | string | undefined>(0)
const portraitInfo = ref<PortraitInfoItem>({})
/** 预估接口加载状态 */
const isEstimating = ref(false)

const ruleCreatorRef = ref<InstanceType<typeof ruleCreator> | null>(null)

function handlePeopleType(type: string) {
  if (!type) {
    return '添加画像目标人群'
  } else if (type == '添加对比人群') {
    return '添加画像对比人群'
  } else if (type == '更新目标人群') {
    return '更新画像目标人群'
  } else if (type == '更新对比人群') {
    return '更新画像对比人群'
  }
  // 与 v2 一致（v2 此处逻辑存疑：四个分支都不命中时返回 undefined，标题渲染为空）
  return undefined
}

function groupPortrait(res: { id?: string }, type?: string) {
  dialogVisible.value = false
  if (route.query.id) {
    emit('updatePortrait', type || '')
  } else {
    router.push({
      path: 'analyze',
      query: { product: 'newly', id: res?.id },
    })
  }
}

/**
 * 参数一：更新详情；参数二：接口获取目标人群的数据；参数三：详情点击传递的目标人群数据
 */
function openDialogEvent(type?: string, index?: number | string, res?: PortraitRow) {
  if (res) {
    portraitInfo.value = res
  }
  // v2 的 `openDialogEvent(type, "")` / `openDialogEvent()` 都会走到这里，index 原样保留
  currentIndex.value = index
  dialogVisible.value = true
  updateType.value = type || ''
  nextTick(() => {
    if (type == '更新目标人群' || type == '更新对比人群') {
      ruleCreatorRef.value?.updatePropTransfer(res, index)
    } else {
      ruleCreatorRef.value?.updatePropTransfer('')
    }
  })
}

function estimateEvent() {
  ruleCreatorRef.value?.consoModelEvent(updateType.value, currentIndex.value)
}

function saveModelHandle() {
  estimateEvent()
}

function handleConsole() {
  ruleCreatorRef.value?.consoModelEvent(updateType.value, currentIndex.value, '打印模型')
}

function cancleHandle() {
  dialogVisible.value = false
}

function loadingEvent() {
  isEstimating.value = true
}

// 重置预估状态
function resetEstimatingState() {
  isEstimating.value = false
}

defineExpose({ openDialogEvent })
</script>

<template>
  <div>
    <el-dialog
      v-model="dialogVisible"
      :close-on-click-modal="false"
      width="1200px"
      top="3vh"
      :title="handlePeopleType(updateType)"
    >
      <el-row style="min-height: 700px">
        <ruleCreator
          ref="ruleCreatorRef"
          :portrait-info="portraitInfo"
          @group-portrait="groupPortrait"
          @loading-event="loadingEvent"
          @reset-estimating-state="resetEstimatingState"
        />

        <div style="display: flex; justify-content: center; margin: 40px">
          <el-button
            v-if="!portraitInfo.lastExecuteEndTime"
            class="zc_btn"
            :disabled="isEstimating"
            @click="saveModelHandle"
          >
            {{ isEstimating ? '预估中' : '保存' }}
          </el-button>
          <el-button class="zc_btn_default" @click="cancleHandle">取消</el-button>
          <el-button
            v-if="isDebug"
            class="zc_btn_default"
            style="margin-left: 40px"
            @click="handleConsole"
          >
            打印模型
          </el-button>
        </div>
      </el-row>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
:deep(.my-confirm .el-dialog) {
  top: 20px !important; /* 调整这个值来设置距离顶部的距离 */
  margin-top: 0 !important; /* 覆盖默认的 margin-top */
  transform: none !important; /* 覆盖可能的 transform 属性 */
}

:deep(.el-dialog__header) {
  text-align: left;
}

:deep(.el-dialog) {
  position: relative;
  border-radius: 6px;
}

:deep(.el-dialog__footer) {
  margin-left: 0 !important;
  width: 100%;
  display: flex;
  justify-content: center;
}

// 禁用状态下的按钮样式
:deep(.zc_btn.is-disabled) {
  background-color: #c0c4cc !important;
  border-color: #c0c4cc !important;
  color: #ffffff !important;
  cursor: not-allowed !important;
}

.public-secondHead {
  padding-bottom: 15px;
}

.rules_block {
  display: flex;
  margin: 20px 0px 20px 50px;

  p {
    width: 130px;
  }
}
</style>
