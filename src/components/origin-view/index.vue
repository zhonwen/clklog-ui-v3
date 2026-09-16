<script setup lang="ts">
/**
 * 流量指标表头 / 指标块（对应 v2 src/components/origin-view/index.vue）。
 *
 * 5 种模式：byFlowView / byChannel 只渲染表头；byAreaAnaly / byVisit / byVisitedPage
 * 额外渲染一行数据块，数据由外部通过 ref 调用 originEvent(val) 灌进来。
 *
 * props 名称、文案、字段名、样式数值均与 v2 保持一致。
 */
import { computed, ref } from 'vue'
import { sharedText } from '@/components/pointFont'
import questionImg from '@/assets/images/question.png'
import { averageRules, percentage } from '@/utils/percent'
import { formatTime } from '@/utils/format'

/**
 * originEvent 灌入的数据结构（v2 未声明类型，这里按模板里实际读到的字段补齐）。
 * 不 export：`<script setup>` 不允许 ES module 导出；调用方直接传 `res.data` 即可（形参是 unknown）。
 */
interface OriginViewData {
  pv?: number
  visitCount?: number
  uv?: number
  ipCount?: number
  avgPv?: number
  avgVisitTime?: number
  bounceRate?: number
  newUv?: number
  visitRate?: number
  revisit?: number
  silent?: number
  churn?: number
  downPvCount?: number
  exitCount?: number
}

const props = withDefaults(
  defineProps<{
    byChannel?: boolean
    byFlowView?: boolean
    byAreaAnaly?: boolean
    byVisit?: boolean
    byVisitedPage?: boolean
    /** 是否更新平均访问时长-计算方式不同 */
    isUpdateDuration?: boolean
  }>(),
  {
    byChannel: false,
    byFlowView: false,
    byAreaAnaly: false,
    byVisit: false,
    byVisitedPage: false,
    isUpdateDuration: false,
  },
)

// 与 v2 一致：v2 里 data 的初始值是 []，模板全部走 `originData && originData.x` 取值，
// 空数组和 null 的渲染结果相同（都落到 '--'），这里用 null 以便收窄类型。
const originData = ref<OriginViewData | null>(null)

function averageRulesEvent(num: number | undefined) {
  return averageRules(num)
}

function formatTimeFun(val: number | undefined) {
  // 与 v2 一致：先 Math.floor 再格式化；val 为 undefined 时 Math.floor 得到 NaN，formatTime 返回 '--'
  return formatTime(Math.floor(Number(val)))
}

function percentageFun(val: number | undefined) {
  return percentage(val)
}

function originEvent(val: unknown) {
  originData.value = (val || null) as OriginViewData | null
}

type HeadItem = { label: string; tip: string }

/** byFlowView / byChannel / byAreaAnaly 共用的 7 个表头 */
const flowHeads: HeadItem[] = [
  { label: '浏览量', tip: sharedText.pv },
  { label: '访问次数', tip: sharedText.visitCount },
  { label: '访客数', tip: sharedText.uv },
  { label: 'IP数', tip: sharedText.ip },
  { label: '平均访问页数', tip: sharedText.avgPv },
  { label: '平均访问时长', tip: sharedText.avgVisitTime },
  { label: '跳出率', tip: sharedText.bounceRate },
]

/** byVisit 的 6 个表头；后 3 个 v2 里是写死的中文说明，不走 $sharedText */
const visitHeads: HeadItem[] = [
  { label: '访客数', tip: sharedText.uv },
  { label: '新访客数', tip: sharedText.newUv },
  { label: '新访客数占比', tip: sharedText.newUvRate },
  { label: '回流用户', tip: '老访客中，当天访问但前一天未访问的独立访客数。' },
  { label: '沉默用户', tip: '老访客中，当天未访问但前一天有访问的独立访客数。' },
  { label: '流失用户', tip: '选定时间段内每天流失的独立访客数的总和。' },
]

/** byVisitedPage 的 6 个表头，第 5 个随 isUpdateDuration 切换文案 */
const visitedPageHeads = computed<HeadItem[]>(() => [
  { label: '浏览量', tip: sharedText.pv },
  { label: '访客数', tip: sharedText.uv },
  { label: '贡献下游浏览量', tip: sharedText.downPvCount },
  { label: '退出页次数', tip: sharedText.exitCount },
  props.isUpdateDuration
    ? { label: '页面平均浏览时长', tip: sharedText.avgPageBrowseTime }
    : { label: '平均访问时长', tip: sharedText.avgVisitTime },
  { label: '跳出率', tip: sharedText.bounceRate },
])

const areaCells = computed<(string | number)[]>(() => {
  const d = originData.value
  return [
    d?.pv || '--',
    d?.visitCount || '--',
    d?.uv || '--',
    d?.ipCount || '--',
    averageRulesEvent(d?.avgPv) || '--',
    formatTimeFun(d?.avgVisitTime) || '--',
    percentageFun(d?.bounceRate) || '--',
  ]
})

const visitCells = computed<(string | number)[]>(() => {
  const d = originData.value
  return [
    d?.uv || '--',
    d?.newUv || '--',
    percentageFun(d?.visitRate) || '--',
    d?.revisit || '--',
    d?.silent || '--',
    d?.churn || '--',
  ]
})

/** byVisitedPage 前 5 个数据格 */
const visitedPageCells = computed<(string | number)[]>(() => {
  const d = originData.value
  return [
    d?.pv || '--',
    d?.uv || '--',
    d?.downPvCount || '--',
    d?.exitCount || '--',
    // 与 v2 一致（v2 此处逻辑存疑：表头在 isUpdateDuration 时显示“页面平均浏览时长”，
    // 但数据格仍然读 avgVisitTime，没有换字段）
    formatTimeFun(d?.avgVisitTime) || '--',
  ]
})

/** byVisitedPage 第 6 个数据格：跳出率，v2 用 v-if/v-else 包了一层 div */
const visitedPageBounce = computed(() => {
  const d = originData.value
  return d && d.bounceRate ? percentageFun(d.bounceRate) : '--'
})

defineExpose({ originEvent })
</script>

<template>
  <div>
    <div v-if="byFlowView || byChannel">
      <div class="bid-list-headed">
        <div v-if="!byChannel" class="header-name w156" />
        <div v-for="item in flowHeads" :key="item.label" class="header-name w156">
          {{ item.label }}
          <div class="parentPosition">
            <el-popover placement="bottom-start" :width="200" trigger="hover">
              <div style="padding: 5px; font-size: 12px" v-html="item.tip" />
              <template #reference>
                <img class="icon-question" :src="questionImg" alt="" />
              </template>
            </el-popover>
          </div>
        </div>
      </div>
    </div>

    <!-- 地域分析 -->
    <div v-if="byAreaAnaly" class="bid-list-page">
      <div class="bid-list-headed">
        <div v-for="item in flowHeads" :key="item.label" class="header-name w156">
          {{ item.label }}
          <div class="parentPosition">
            <el-popover placement="bottom-start" :width="200" trigger="hover">
              <div style="padding: 5px; font-size: 12px" v-html="item.tip" />
              <template #reference>
                <img class="icon-question" :src="questionImg" alt="" />
              </template>
            </el-popover>
          </div>
        </div>
      </div>
      <div class="bid-list-card">
        <div v-for="(cell, index) in areaCells" :key="index" class="bid-list-item w158">
          <p>{{ cell }}</p>
        </div>
      </div>
    </div>

    <div v-if="byVisit" class="bid-list-page">
      <div class="bid-list-headed">
        <div v-for="item in visitHeads" :key="item.label" class="header-name w156">
          {{ item.label }}
          <div class="parentPosition">
            <el-popover placement="bottom-start" :width="200" trigger="hover">
              <div style="padding: 5px; font-size: 12px" v-html="item.tip" />
              <template #reference>
                <img class="icon-question" :src="questionImg" alt="" />
              </template>
            </el-popover>
          </div>
        </div>
      </div>
      <div class="bid-list-card">
        <div v-for="(cell, index) in visitCells" :key="index" class="bid-list-item w158">
          <p>{{ cell }}</p>
        </div>
      </div>
    </div>

    <div v-if="byVisitedPage" class="bid-list-page">
      <div class="bid-list-headed">
        <div v-for="item in visitedPageHeads" :key="item.label" class="header-name w156">
          {{ item.label }}
          <div class="parentPosition">
            <el-popover placement="bottom-start" :width="200" trigger="hover">
              <div style="padding: 5px; font-size: 12px" v-html="item.tip" />
              <template #reference>
                <img class="icon-question" :src="questionImg" alt="" />
              </template>
            </el-popover>
          </div>
        </div>
      </div>
      <div class="bid-list-card">
        <div v-for="(cell, index) in visitedPageCells" :key="index" class="bid-list-item w158">
          <p>{{ cell }}</p>
        </div>
        <div class="bid-list-item w158">
          <div>
            <p>{{ visitedPageBounce }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.setFontTop) {
  margin-top: 5px;
}

.parentPosition {
  position: relative;
}

.bid-list-headed {
  padding-bottom: 10px;
  padding-top: 15px;
  display: flex;

  .header-name {
    width: 14%;
    justify-content: center;
    height: 30px;
    display: flex;
    align-items: center;
  }

  .w156 {
    font-size: 15px;
    font-weight: 400;
    line-height: 16px;
    color: #4d4d4d;
  }

  img {
    width: 11.44px;
    height: 11.44px;
    margin-left: 12px;
    cursor: pointer;
  }
}

.bid-list-card {
  display: flex;

  .bid-list-item {
    width: 14%;
    justify-content: center;
    height: 30px;
    display: flex;
    align-items: center;
  }

  .w157 {
    font-size: 12px;
    font-weight: 400;
    line-height: 14px;
    color: #4d4d4d;
  }

  .w158 {
    font-size: 16px;
    font-weight: bold;
    color: #2c7be5;
    line-height: 17px;
  }
}
</style>
