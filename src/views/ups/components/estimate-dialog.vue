<script setup lang="ts">
/**
 * 人数预估弹窗（对应 v2 `src/views/ups/components/estimate-dialog.vue`）。
 *
 * 两种形态：
 *   fromType.typeName == '用户分群' → 圆形波浪进度条 + 用户数 / 占全部用户数
 *   其余（用户分层、标签值分布…）   → 表格 + el-progress
 *
 * v2 里还有一个 groupGauge()：用 echarts 画仪表盘，对应的 `#groupPercent` 容器在模板里
 * 已经被注释掉了，方法本身也从未被调用过，属于纯死代码，迁移时不再搬运。
 * v2 的 `import { toNumber } from "lodash"` 同理换成原生 Number（v3 没有 lodash 依赖）。
 */
import { computed, nextTick, ref } from 'vue'
import { sharedText } from '@/components/pointFont'
import type { EstimateFromType, EstimateRow } from './types'

/** v2 模板里是 `$sharedText.allUserRate`，v3 直接引常量 */
const allUserRate = sharedText.allUserRate

const customColor = '#409eff'
const dialogVisible = ref(false)
const tableData = ref<EstimateRow[]>([])
const fromType = ref<EstimateFromType>({ typeName: '' })
const progressValue = ref<number | string>(0)
const esimate_group = ref<EstimateRow>({ count: 0 })

/** 进度条外层元素，v2 是 document.querySelector('.progress') / '.number' 取的 */
const progressRef = ref<HTMLDivElement | null>(null)
const numberRef = ref<HTMLParagraphElement | null>(null)

function estimatePercent(row: EstimateRow) {
  const percent = (Number(row.count) / Number(row.totalTagged)) * 100
  if (isNaN(percent) && row.name == '全部') {
    return 100
  } else if (isNaN(percent)) {
    return 0
  } else {
    return Number(Number.isInteger(percent) ? percent : percent.toFixed(2))
  }
}

/** 模板里 count / 进度条各要读一次占比，这里一次算好，避免重复调用 */
const tableRows = computed(() =>
  tableData.value.map((row) => ({ ...row, percent: estimatePercent(row) })),
)

/**
 * 外部调用入口：`estimateDialogRef.value?.dialogEvent(res.data || [], { typeName: '用户分群' })`
 *
 * 与 v2 一致（v2 此处逻辑存疑：userPortrait/rule-creator.vue 里有一处 `dialogEvent()` 不传参，
 * v2 会把 this.fromType 置成 undefined，模板里读 fromType.typeName 直接报渲染错误。
 * 这里给 fromType 兜了个 { typeName: '' }，落到表格分支渲染空表，避免整页崩掉）。
 */
function dialogEvent(data?: EstimateRow[], type?: EstimateFromType) {
  dialogVisible.value = true
  tableData.value = data || []
  fromType.value = type || { typeName: '' }
  void nextTick(() => {
    if (fromType.value.typeName == '用户分群') {
      const first = tableData.value[0]
      if (tableData.value.length > 0 && first) {
        esimate_group.value = first
        const percent = (Number(first.count) / Number(first.totalUser)) * 100
        progressValue.value = Number.isInteger(percent) ? percent : percent.toFixed(2)
      } else {
        esimate_group.value = { count: 0 }
        progressValue.value = 0
      }
      // 进度值
      progressRef.value?.style.setProperty(
        '--progress',
        `${progressValue.value == 0 ? -1 : progressValue.value}%`,
      )
      // 更新进度数字
      if (numberRef.value) numberRef.value.textContent = `${progressValue.value}%`
    }
  })
}

defineExpose({ dialogEvent, dialogVisible })
</script>

<template>
  <div>
    <el-dialog v-model="dialogVisible" width="600px" center title="预估人数">
      <div v-if="fromType.typeName != '用户分群'">
        <el-table
          class="public-radius"
          :header-cell-style="{
            textAlign: 'center',
            background: '#f7fafe  ',
          }"
          :cell-style="{ textAlign: 'center' }"
          :data="tableRows"
          style="width: 600px"
        >
          <el-table-column prop="name" :label="fromType.typeName" />
          <el-table-column prop="rate" label="预估人数/占比">
            <template #default="{ row }">
              <div style="display: flex; justify-content: center; padding: 5px 0">
                <div>{{ row.count }}</div>
                <div style="color: rgb(166 161 164)">（{{ row.percent }}%）</div>
              </div>
              <el-progress :show-text="false" :percentage="row.percent" :color="customColor" />
            </template>
          </el-table-column>
        </el-table>
      </div>
      <!-- 用户分群 -->
      <div v-else>
        <!-- 圆形波浪进度条外层元素 -->
        <div style="width: 100%; display: flex; justify-content: center">
          <div class="outSide_box">
            <div class="progress-box">
              <div ref="progressRef" class="progress" style="--progress: 0%"></div>
              <p ref="numberRef" class="number">0%</p>
            </div>
          </div>
        </div>

        <div style="display: flex; margin-top: 20px">
          <div style="font-size: 13px">用户数：</div>
          <div style="font-size: 13px; color: #2c7be5">{{ esimate_group.count }}人</div>
        </div>
        <div style="display: flex; margin-top: 15px">
          <div style="font-size: 13px; display: flex; align-items: center">
            占全部用户数
            <el-popover placement="bottom-start" :width="200" trigger="hover" popper-class="popImg">
              <template #reference>
                <img
                  style="width: 12px; margin: 2px 2px 0 2px"
                  src="@/assets/images/question.png"
                  alt=""
                />
              </template>
              <div style="padding: 5px; font-size: 12px" v-html="allUserRate"></div>
            </el-popover>
            ：
          </div>
          <div style="font-size: 13px; color: #2c7be5">{{ progressValue }}%</div>
        </div>
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

/* 定一个旋转动画 用于实现波浪效果 */
@keyframes progressRotate {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

/* 设置外层元素样式 */
.outSide_box {
  width: 206px;
  height: 206px;
  border-radius: 50%;
  background: #fff;
  border: 1px solid #d3e3fe;
  display: flex;
  justify-content: center;
  align-items: center;
}

.progress-box {
  position: relative;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background: #fff;
  overflow: hidden;
}

/* 设置进度条样式 */
.progress {
  position: absolute;
  top: calc(100% - var(--progress));
  left: 50%;
  transform: translateX(-50%);
  z-index: 9;
  width: 200%;
  height: 200%;
  border-radius: 47%;
  background: #6495ed;
  animation: progressRotate 5s linear infinite;
  animation-composition: add;
}

.number {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
  margin: 0;
  color: #151515;
  font-size: 20px;
}
</style>
