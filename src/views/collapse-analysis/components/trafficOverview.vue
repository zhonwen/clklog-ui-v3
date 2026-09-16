<script setup lang="ts">
import { computed, ref } from 'vue'
import trafficOverview from '@/components/trafficOverview/index.vue'
import { sharedText } from '@/components/pointFont'
import { percentage } from '@/utils/percent'

/** 崩溃分析页顶部「流量概览」（v2 src/views/collapse-analysis/components/trafficOverview.vue） */

// 共享组件的 labelList 形状（<script setup> 不能 export 类型，两边各自声明）
interface TrafficOverviewLabel {
  name: string
  tip?: string
}

interface CollapseOverviewItem {
  visitCount?: number
  crashedCount?: number
  pvRate?: number
  uv?: number
  crashedUv?: number
  uvRate?: number
}

/**
 * v2 模板里用的是 `| filterOverview` 过滤器（src/filters/index.js）：falsy 一律显示 '--'。
 * v3 的 utils 里暂时没有同名函数，这里就地实现，语义与 v2 完全一致（0 也会显示 '--'）。
 */
function filterOverview(val: number | string | null | undefined): number | string {
  if (!val) {
    return '--'
  }
  return val
}

/**
 * v2 写的是 sharedText.Crashtriggercount / Collapserate / visitUser / CrashtriggerUser /
 * CrashtriggerUserRate，但 pointFont 里根本没有这几个键，取到的是 undefined。
 * 与 v2 一致（v2 此处逻辑存疑：键名对不上），且 tip 只喂给已被注释掉的 popover，当前无渲染出口。
 * v3 的 sharedText 是字面量类型，直接点属性会编译失败，所以按索引取。
 */
const sharedTextMap = sharedText as unknown as Record<string, string | undefined>

const overviewList = ref<CollapseOverviewItem[]>([{}])

const labelList: TrafficOverviewLabel[] = [
  {
    name: '访问次数',
    tip: sharedText.visitCount,
  },
  {
    name: '崩溃触发次数',
    tip: sharedTextMap.Crashtriggercount,
  },
  {
    name: '崩溃率',
    tip: sharedTextMap.Collapserate,
  },
  {
    name: '访问用户数',
    tip: sharedTextMap.visitUser,
  },
  {
    name: '崩溃触发用户数',
    tip: sharedTextMap.CrashtriggerUser,
  },
  {
    name: '崩溃触发用户数占比',
    tip: sharedTextMap.CrashtriggerUserRate,
  },
]

// 模板里每个单元格都要走一次过滤器，这里先一次性算好，避免模板反复调用同一函数
const rows = computed(() =>
  overviewList.value.map((item) => ({
    visitCount: filterOverview(item.visitCount),
    crashedCount: filterOverview(item.crashedCount),
    pvRate: percentage(item.pvRate),
    uv: filterOverview(item.uv),
    crashedUv: filterOverview(item.crashedUv),
    uvRate: percentage(item.uvRate),
  })),
)

function dataListEvent(val: CollapseOverviewItem[]) {
  overviewList.value = val
}

// v2 里父组件用 this.$refs.trafficOverview.dataListEvent(...) 调用，<script setup> 默认对外封闭
defineExpose({ dataListEvent })
</script>

<template>
  <div class="container">
    <trafficOverview :labelList="labelList" :width="16.6" :overviewList="overviewList" />
    <div v-for="(item, index) in rows" :key="index" class="bid-list-carded">
      <div class="bid-list-item w111" :style="index == 0 ? 'color:#2c7be5' : 'color:#4d4d4d'">
        <p>{{ item.visitCount }}</p>
      </div>
      <div class="bid-list-item w111" :style="index == 0 ? 'color:#2c7be5' : 'color:#4d4d4d'">
        <p>{{ item.crashedCount }}</p>
      </div>
      <div class="bid-list-item w111" :style="index == 0 ? 'color:#2c7be5' : 'color:#4d4d4d'">
        <p>{{ item.pvRate }}</p>
      </div>
      <div class="bid-list-item w111" :style="index == 0 ? 'color:#2c7be5' : 'color:#4d4d4d'">
        <p>{{ item.uv }}</p>
      </div>
      <div class="bid-list-item w111" :style="index == 0 ? 'color:#2c7be5' : 'color:#4d4d4d'">
        <p>{{ item.crashedUv }}</p>
      </div>
      <div class="bid-list-item w111" :style="index == 0 ? 'color:#2c7be5' : 'color:#4d4d4d'">
        <p>{{ item.uvRate }}</p>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.container {
  .bid-list-carded {
    display: flex;

    .bid-list-item {
      width: 16.6%;
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
}
</style>
