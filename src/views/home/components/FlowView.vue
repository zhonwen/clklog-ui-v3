<script setup lang="ts">
import { computed, ref } from 'vue'
import OriginView from '@/components/origin-view/index.vue'
import { getFlowApi } from '@/api/trackingapi/flow'
import { averageRules, percentage } from '@/utils/percent'
import { formatTime } from '@/utils/format'
import riseImg from '@/assets/images/rise.png'
import declineImg from '@/assets/images/decline.png'

type FlowMetrics = {
  pv?: number
  visitCount?: number
  uv?: number
  ipCount?: number
  avgPv?: number
  avgVisitTime?: number
  bounceRate?: number
}

type FlowData = {
  current?: FlowMetrics
  previous?: FlowMetrics
  currentPrediction?: FlowMetrics | null
  samePeriod?: FlowMetrics
}

const metricKeys = ['pv', 'visitCount', 'uv', 'ipCount', 'avgPv', 'avgVisitTime', 'bounceRate'] as const
type MetricKey = (typeof metricKeys)[number]

const props = defineProps<{
  commonParams: Record<string, unknown>
  timeTypeFlag?: string
}>()

const loadingRefresh = ref(false)
const flowData = ref<FlowData | null>(null)
const timeType = ref('')

const previous = computed(() => flowData.value?.previous || {})
const current = computed(() => flowData.value?.current || {})
const currentPrediction = computed(() => flowData.value?.currentPrediction || null)
const samePeriod = computed(() => flowData.value?.samePeriod || {})

function formatMetric(row: FlowMetrics, key: MetricKey) {
  const val = row[key]
  if (key === 'avgPv') return averageRules(val) || '--'
  if (key === 'avgVisitTime') return val ? formatTime(Math.floor(Number(val))) : '--'
  if (key === 'bounceRate') return val ? percentage(val) : '--'
  return val || '--'
}

function handleCompare(x?: number, y?: number) {
  return Number(x || 0) > Number(y || 0)
}

function huanbi(c?: number, p?: number) {
  if (c && p) return (((c - p) / p) * 100).toFixed(2)
  return '--'
}

function tongbi(c?: number, s?: number) {
  if (c && s) return (((c - s) / s) * 100).toFixed(2)
  return '--'
}

function handleClickSessionEvent() {
  window.open(
    'https://clklog.com/integration/notes.html#_1-1-%E4%BC%9A%E8%AF%9D%E7%9A%84%E9%9B%86%E6%88%90',
  )
}

function getFlow() {
  timeType.value = props.timeTypeFlag || ''
  loadingRefresh.value = true
  getFlowApi({ ...props.commonParams })
    .then((res) => {
      loadingRefresh.value = false
      flowData.value = (res.data || null) as FlowData
    })
    .catch(() => {
      loadingRefresh.value = false
    })
}

defineExpose({ getFlow })
</script>

<template>
  <div v-loading="loadingRefresh" class="FlowView block-main public-hoverItem">
    <div class="block-head" style="margin-bottom: 0; justify-content: space-between">
      <div class="block-title" style="text-align: left">流量概览</div>
      <div v-if="current.pv && !current.visitCount" class="session-wrap">
        <span class="sessionTips" @click="handleClickSessionEvent">
          会话未集成，请先集成会话插件，查看会话集成方法
        </span>
      </div>
    </div>
    <div class="bid-list-page">
      <OriginView by-flow-view />
      <div class="bid-list-record">
        <div class="bid-list-item1 w157">
          <p v-if="timeType == 'day'">今日</p>
          <p v-if="timeType == 'week'">本周</p>
          <p v-if="timeType == 'month'">本月</p>
        </div>
        <div v-for="key in metricKeys" :key="`c-${key}`" class="bid-list-item w158">
          <p>{{ formatMetric(current, key) }}</p>
        </div>
      </div>
      <div class="bid-list-record">
        <div class="bid-list-item1 w157">
          <p v-if="timeType == 'day'">昨日</p>
          <p v-if="timeType == 'week'">上周</p>
          <p v-if="timeType == 'month'">上月</p>
        </div>
        <div v-for="key in metricKeys" :key="`p-${key}`" class="bid-list-item w157">
          <p>{{ formatMetric(previous, key) }}</p>
        </div>
      </div>
      <div v-if="currentPrediction" class="bid-list-record">
        <div class="bid-list-item1 w157">
          <p v-if="timeType == 'day'">今日预测</p>
        </div>
        <div v-for="key in metricKeys" :key="`pred-${key}`" class="bid-list-item w157">
          <p>{{ formatMetric(currentPrediction, key) }}</p>
          <img
            v-if="currentPrediction[key]"
            class="riseImg"
            :src="handleCompare(previous[key], currentPrediction[key]) ? declineImg : riseImg"
          />
        </div>
      </div>
      <div style="width: 100%; border-bottom: 1px solid #e7eff9; margin: 2px 0 13px" />
      <div class="bid-list-record">
        <div class="bid-list-item1 w157">
          <p v-if="timeType == 'day'">环比（今日与昨日）</p>
          <p v-if="timeType == 'week'">环比（本周与上周）</p>
          <p v-if="timeType == 'month'">环比（本月与上月）</p>
        </div>
        <div v-for="key in metricKeys" :key="`h-${key}`" class="bid-list-item w157">
          <p>{{ huanbi(current[key], previous[key]) }}</p>
          <p v-if="huanbi(current[key], previous[key]) != '--'">%</p>
          <img
            v-if="huanbi(current[key], previous[key]) != '--' && Number(huanbi(current[key], previous[key])) < 0"
            class="declineIcon"
            :src="declineImg"
            alt=""
          />
          <img
            v-if="huanbi(current[key], previous[key]) != '--' && Number(huanbi(current[key], previous[key])) > 0"
            class="riseImg"
            :src="riseImg"
            alt=""
          />
        </div>
      </div>
      <div class="bid-list-record" style="margin-bottom: 0">
        <div class="bid-list-item1 w157">
          <p v-if="timeType == 'day'">同比（今日与上周同期）</p>
          <p v-if="timeType == 'week'">同比（本周与上年同期）</p>
          <p v-if="timeType == 'month'">同比（本月与上年同期）</p>
        </div>
        <div v-for="key in metricKeys" :key="`t-${key}`" class="bid-list-item w157">
          <p>{{ tongbi(current[key], samePeriod[key]) }}</p>
          <p v-if="tongbi(current[key], samePeriod[key]) != '--'">%</p>
          <img
            v-if="tongbi(current[key], samePeriod[key]) != '--' && Number(tongbi(current[key], samePeriod[key])) < 0"
            class="declineIcon"
            :src="declineImg"
            alt=""
          />
          <img
            v-if="tongbi(current[key], samePeriod[key]) != '--' && Number(tongbi(current[key], samePeriod[key])) > 0"
            class="riseImg"
            :src="riseImg"
            alt=""
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.FlowView {
  min-height: 215px;
  background-color: #fff;

  .session-wrap {
    display: flex;
    padding-right: 20px;
    width: 100%;
    position: absolute;
    justify-content: center;
    cursor: auto;

    .sessionTips {
      min-width: 200px;
      font-size: 16px;
      color: red;
      cursor: pointer;
      font-weight: 500;
    }
  }

  .bid-list-page {
    display: flex;
    flex-direction: column;
    white-space: nowrap;
    overflow: auto;

    .bid-list-record {
      display: flex;
      margin-bottom: 11px;

      .bid-list-item1 {
        width: 12.5%;
        justify-content: flex-start;
        height: 30px;
        display: flex;
        align-items: center;
      }

      .bid-list-item {
        width: 12.5%;
        justify-content: center;
        height: 30px;
        display: flex;
        align-items: center;
      }

      .declineIcon,
      .riseImg {
        width: 9px;
        height: 11.24px;
        margin-left: 7px;
      }

      .w157 {
        font-size: 13px;
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
  }
}
</style>
