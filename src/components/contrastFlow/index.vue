<script setup lang="ts">
/**
 * 对比流量指标块（对应 v2 src/components/contrastFlow/index.vue）。
 *
 * 与 origin-view 的区别：originData 是**数组**，可同时渲染多行（对比时段），
 * 并在 dateFlag 为真时额外渲染一行「变化率」。
 * 数据由外部通过 ref 调用 originEvent(val, flag) 灌进来。
 */
import { computed, ref } from 'vue'
import { sharedText } from '@/components/pointFont'
import questionImg from '@/assets/images/question.png'
import declineImg from '@/assets/images/decline.png'
import riseImg from '@/assets/images/rise.png'
import { percentage } from '@/utils/percent'
import { formatTime } from '@/utils/format'

/**
 * originEvent 灌入的单行数据（v2 未声明类型，按模板实际读到的字段补齐）。
 * 不 export：`<script setup>` 不允许 ES module 导出；调用方直接传 `res.data` 即可（形参是 unknown）。
 */
interface ContrastFlowData {
  dateTime?: string
  pv?: number
  visitCount?: number
  uv?: number
  ipCount?: number
  avgPv?: number
  avgVisitTime?: number
  bounceRate?: number
  downPvCount?: number
  exitCount?: number
}

const props = withDefaults(
  defineProps<{
    byVisitedPage?: boolean
    byAreaAnaly?: boolean
    /** 是否更新平均访问时长-计算方式不同 */
    isUpdateDuration?: boolean
  }>(),
  {
    byVisitedPage: false,
    byAreaAnaly: false,
    isUpdateDuration: false,
  },
)

const originData = ref<ContrastFlowData[]>([])
// 调用方传进来的 flag 类型并不统一：filterBar 的 dateFlag 是 number|null（触发的日历个数），
// newOld-visitor-analysis 直接传 true，模板里只做真值判断，所以这里放宽成联合类型
const dateFlag = ref<number | boolean | null>(null)

/**
 * v2 模板里 `{{ x | averageRules }}` 用的是 src/filters/index.js 的 averageRules，
 * 与 src/utils/percent.js 的同名函数**实现不同**（filters 版是 Math.ceil + falsy 返回 '--'），
 * v3 的 @/utils/percent 只迁了 utils 版，所以这里单独复刻 filters 版。
 */
function averageRulesFilter(num: number | undefined) {
  if (num) {
    if (Number.isInteger(num)) return num
    return Math.ceil(num)
  }
  return '--'
}

/**
 * v2 模板里 `{{ x | formatTime }}` 用的是 src/filters/index.js 的 formatTime，
 * 它比 @/utils/format 的版本多一步 Math.floor。
 */
function formatTimeFilter(val: number | undefined) {
  return formatTime(Math.floor(Number(val)))
}

function percentageFun(val: number | undefined) {
  return percentage(val)
}

/**
 * 与 v2 一致（v2 此处逻辑存疑：第三个参数 bounceRate 声明了但完全没用到，
 * 调用方在跳出率那列传了 true 也不会改变结果；另外 x 为 0 时用 1 兜底作分母，
 * 算出来的“变化率”其实是绝对增量）。
 */
function changeRateEvent(x: number | undefined, y: number | undefined): string | number {
  if (x || y) {
    const a = ((Number(y) - Number(x)) / (Number(x) || 1)).toFixed(4)
    return (Number(a) * 100).toFixed(2)
  }
  return 0
}

function originEvent(val: unknown, flag?: number | boolean | null) {
  dateFlag.value = flag ?? null
  originData.value = []
  if (val instanceof Array) {
    const list = val as ContrastFlowData[]
    const first = list[0]
    const second = list[1]
    // 与 v2 一致（v2 此处逻辑存疑：直接取 val[0].dateTime / val[1].dateTime，
    // 数组不足 2 条或缺 dateTime 时会抛错；这里改成原样赋值兜底，避免整页崩溃）
    if (first?.dateTime && second?.dateTime) {
      const a = new Date(String(first.dateTime.split('~')[0])).getTime()
      const b = new Date(String(second.dateTime.split('~')[0])).getTime()
      originData.value = a >= b ? list.reverse() : list
    } else {
      originData.value = list
    }
  } else if (val) {
    originData.value.push(val as ContrastFlowData)
  }
}

type HeadItem = { label: string; tip: string }

/** byAreaAnaly 的 7 个表头 */
const areaHeads: HeadItem[] = [
  { label: '浏览量', tip: sharedText.pv },
  { label: '访问次数', tip: sharedText.visitCount },
  { label: '访客数', tip: sharedText.uv },
  { label: 'IP数', tip: sharedText.ip },
  { label: '平均访问页数', tip: sharedText.avgPv },
  { label: '平均访问时长', tip: sharedText.avgVisitTime },
  { label: '跳出率', tip: sharedText.bounceRate },
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

/** byAreaAnaly 每行的 7 个数据格（最后一列跳出率在模板里单独用 :style 着色） */
const areaRows = computed(() =>
  originData.value.map((item) => ({
    dateTime: item.dateTime || '--',
    cells: [
      item.pv || '--',
      item.visitCount || '--',
      item.uv || '--',
      item.ipCount || '--',
      averageRulesFilter(item.avgPv),
      formatTimeFilter(item.avgVisitTime),
    ] as (string | number)[],
    bounceRate: percentageFun(item.bounceRate),
  })),
)

/** byVisitedPage 每行的 6 个数据格 */
const visitedPageRows = computed(() =>
  originData.value.map(
    (item) =>
      [
        item.pv || '--',
        item.uv || '--',
        item.downPvCount || '--',
        item.exitCount || '--',
        formatTimeFilter(item.avgVisitTime),
        percentageFun(item.bounceRate),
      ] as (string | number)[],
  ),
)

/** 变化率行：7 列，顺序与表头一致 */
const changeRates = computed(() => {
  const a = originData.value[0]
  const b = originData.value[1]
  const keys = ['pv', 'visitCount', 'uv', 'ipCount', 'avgPv', 'avgVisitTime', 'bounceRate'] as const
  return keys.map((key) => {
    const value = changeRateEvent(a?.[key], b?.[key])
    return { key, value, num: Number(value) }
  })
})

defineExpose({ originEvent })
</script>

<template>
  <div>
    <div v-if="byAreaAnaly" class="bid-list-page">
      <div class="bid-list-header">
        <div v-if="dateFlag" class="header-name w156" />
        <div v-for="item in areaHeads" :key="item.label" class="header-name w156">
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
      <div class="bid-list-record" style="display: flex; flex-direction: column">
        <div v-for="(row, index) in areaRows" :key="index" class="bid-list-item w158">
          <p
            v-if="dateFlag"
            style="font-size: 12px; font-weight: 400; line-height: 14px; color: #4d4d4d"
          >
            {{ row.dateTime }}
          </p>
          <p
            v-for="(cell, cellIndex) in row.cells"
            :key="cellIndex"
            :class="{ first: index == 0, second: index != 0 }"
          >
            {{ cell }}
          </p>
          <p :style="index != 0 ? ' color : #4D4D4D;font-size: 13px;' : 'color:#2C7BE5;'">
            {{ row.bounceRate }}
          </p>
        </div>
      </div>
      <!-- 变化概率 -->
      <div v-if="dateFlag" class="bid-list-record" style="display: flex; flex-direction: column">
        <div class="bid-list-item w158">
          <p
            style="
              font-size: 12px;
              font-weight: 400;
              line-height: 14px;
              color: #4d4d4d;
              text-align: left;
            "
          >
            变化率
          </p>
          <p v-for="rate in changeRates" :key="rate.key" class="second">
            {{ rate.value }}%
            <img v-show="rate.num < 0" class="declineIcon" :src="declineImg" alt="" />
            <img v-show="rate.num > 0" class="riseImg" :src="riseImg" alt="" />
          </p>
        </div>
      </div>
    </div>

    <div v-if="byVisitedPage" class="bid-list-page">
      <div class="bid-list-header">
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

      <div class="bid-list-record" style="display: flex; flex-direction: column">
        <div v-for="(row, index) in visitedPageRows" :key="index" class="bid-list-item w158">
          <p
            v-for="(cell, cellIndex) in row"
            :key="cellIndex"
            :class="{ first: index == 0, second: index != 0 }"
          >
            {{ cell }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.declineIcon {
  width: 9px;
  height: 11.24px;
  margin-left: 7px;
}

.riseImg {
  width: 9px;
  height: 11.24px;
  margin-left: 7px;
}

.second {
  color: #4d4d4d;
  font-size: 13px;
}

.first {
  color: #2c7be5;
}

:deep(.setFontTop) {
  margin-top: 5px;
}

.parentPosition {
  position: relative;
}

.bid-list-header {
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

.bid-list-record {
  display: flex;

  .bid-list-item {
    // width: 14%;
    width: 100%;
    // justify-content: center;
    height: 30px;
    display: flex;
    align-items: center;

    p {
      width: 14%;
      justify-content: center;
      height: 30px;
      display: flex;
      align-items: center;
    }
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
