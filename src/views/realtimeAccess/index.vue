<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { EChartsOption } from 'echarts'
import { FilterBar } from '@/layout/components'
import { getVisitUriApi } from '@/api/trackingapi/visituri'
import { getFlowDetailApi, getFlowPreviousMinTotalApi } from '@/api/trackingapi/flow'
import { copyObj } from '@/utils/copy'
import { useChart } from '@/composables/useChart'
import { useLatestOnly } from '@/composables/useLatestOnly'
import { useSettingsStore } from '@/stores/settings'
import { useTrackingStore } from '@/stores/tracking'
import VisitLog from './components/visitLog.vue'

interface FlowDetailItem {
  statTime?: string
  visitCount?: number
  pv?: number
  uv?: number
}

interface VisitUriRow {
  uri?: string
  title?: string
  pv?: number
}

/** 轮询间隔，与 v2 一致（60 秒） */
const REFRESH_INTERVAL = 60000

const trackingStore = useTrackingStore()
const settingsStore = useSettingsStore()

const { elRef, init, setOption } = useChart()
const { next: nextMin, isLatest: isLatestMin } = useLatestOnly()
const { next: nextUri, isLatest: isLatestUri } = useLatestOnly()

const filterBarParams = ref<Record<string, unknown>>({})
const getVisitList = ref<VisitUriRow[]>([])
const mintotalList = ref<{ uv?: number }>({})
const loadingRefresh = ref(false)
const loadingSecond = ref(false)
const visitLogRef = ref<{
  visitLogEvent: (params: Record<string, unknown>, flag?: boolean) => void
} | null>(null)
let intervalId: ReturnType<typeof setInterval> | null = null

const commonParams = computed(() => ({
  projectName: trackingStore.projectName,
  ...filterBarParams.value,
}))

function setFilterBarParams(val: Record<string, unknown>) {
  filterBarParams.value = copyObj(val)
}

function tableHeaderColor({ columnIndex }: { columnIndex: number }) {
  // 必须返回对象，element-plus 会对返回值做 Object.assign，返回字符串会炸（见规范 6.5）
  return columnIndex === 1 ? { textAlign: 'left' } : { textAlign: 'center' }
}

function buildOption(data: FlowDetailItem[]): EChartsOption {
  const colors = settingsStore.cologStyle
  return {
    tooltip: {
      trigger: 'axis',
      axisPointer: { lineStyle: { color: '#C0CADB', width: 2 } },
    },
    legend: { left: 'center', top: 'top' },
    grid: { left: '5%', right: '5%', top: '15%', bottom: '10%', containLabel: true },
    dataZoom: [
      {
        type: 'inside',
        startValue: 0,
        endValue: 24,
        minValueSpan: 10,
        zoomOnMouseWheel: false, // 关闭滚轮缩放
        moveOnMouseWheel: true, // 开启滚轮平移
        moveOnMouseMove: true,
      },
    ],
    xAxis: {
      type: 'category',
      data: data.map((item) => `${item.statTime}时`),
      axisTick: { show: false },
      axisLabel: { interval: 0, rotate: 45 },
    },
    yAxis: { type: 'value', axisTick: { show: false } },
    series: [
      {
        name: '访问次数',
        type: 'line',
        data: data.map((item) => item.visitCount),
        itemStyle: { color: colors.$visitCount },
      },
      {
        name: '访问量',
        type: 'line',
        data: data.map((item) => item.pv),
        itemStyle: { color: colors.$pv },
      },
      {
        name: '访客数',
        type: 'line',
        data: data.map((item) => item.uv),
        itemStyle: { color: colors.$uv },
      },
    ],
  }
}

function getFlowDetailEvent() {
  const params = { ...copyObj(commonParams.value), previousHour: 5, timeType: 'hour' }
  void getFlowDetailApi(params)
    .then((res) => {
      if (res?.code != 200) return
      setOption(buildOption((res.data as FlowDetailItem[]) || []), true)
    })
    .catch(() => {
      /* 报错已由请求层统一提示 */
    })
}

function getMinTotalEvent() {
  const token = nextMin()
  const params = { ...copyObj(commonParams.value), previousMin: 30 }
  loadingRefresh.value = true
  getFlowPreviousMinTotalApi(params)
    .then((res) => {
      if (!isLatestMin(token)) return
      loadingRefresh.value = false
      if (res?.code == 200) {
        mintotalList.value = (res.data as { uv?: number }) || {}
        getFlowDetailEvent()
      }
    })
    .catch(() => {
      if (!isLatestMin(token)) return
      loadingRefresh.value = false
    })
}

function getVisitUri() {
  const token = nextUri()
  loadingSecond.value = true
  getVisitUriApi(commonParams.value)
    .then((res) => {
      if (!isLatestUri(token)) return
      loadingSecond.value = false
      getVisitList.value = (res?.data as VisitUriRow[]) || []
      visitLogRef.value?.visitLogEvent(commonParams.value, true)
    })
    .catch(() => {
      if (!isLatestUri(token)) return
      loadingSecond.value = false
    })
}

function performQuery() {
  getMinTotalEvent()
  getVisitUri()
}

watch(commonParams, () => {
  getVisitUri()
  getMinTotalEvent()
})

onMounted(() => {
  init()
  intervalId = setInterval(performQuery, REFRESH_INTERVAL)
})

onBeforeUnmount(() => {
  if (intervalId) clearInterval(intervalId)
})
</script>

<template>
  <div class="wrapItem">
    <FilterBar
      :ByCalendar="false"
      :ByTime="false"
      :ByDownLoad="false"
      @set-filter-bar-params="setFilterBarParams"
    />
    <div class="public-block" style="margin-top: 20px">
      <div class="blockDiv setSpace">
        <div v-loading="loadingRefresh" class="blockLeft public-hoverItem block-main">
          <div class="block-head" style="cursor: auto">
            <div class="block-title" style="cursor: auto">访问量</div>
            <div class="block-head-icon" style="cursor: auto">
              <div class="personTh">{{ mintotalList.uv }}人</div>
              <div class="timeTd">(近半小时)</div>
            </div>
          </div>
          <div ref="elRef" style="width: 100%; height: 400px" />
        </div>

        <div v-loading="loadingSecond" class="blockRight public-hoverItem block-main">
          <div class="block-head">
            <div class="block-title" style="cursor: auto">热门页面</div>
            <div class="block-head-icon" />
          </div>
          <div style="width: 100%">
            <el-table
              :data="getVisitList"
              class="public-radius"
              :header-cell-style="{ textAlign: 'center', background: '#f7fafe' }"
              :cell-style="tableHeaderColor"
              style="width: 100%"
              border
            >
              <el-table-column type="index" label="排名" min-width="15%" show-overflow-tooltip />
              <el-table-column prop="uri" min-width="55%" show-overflow-tooltip label="页面Url">
                <template #default="scope">
                  <div v-if="scope.row.title" class="text-ellipsis">{{ scope.row.title }}</div>
                  <div class="text-ellipsis">{{ scope.row.uri }}</div>
                </template>
              </el-table-column>
              <el-table-column prop="pv" label="访问量" min-width="30%" show-overflow-tooltip />
            </el-table>
          </div>
        </div>
      </div>
      <!-- 地域分布图在 v2 里就是注释掉的，这里保持一致，第 6 步接地图时再定 -->
      <VisitLog ref="visitLogRef" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.wrapItem {
  .personTh {
    width: 58px;
    height: 30px;
    background: rgba(255, 255, 255, 0.39);
    border-radius: 6px 0 0 6px;
    line-height: 30px;
    text-align: center;
    font-size: 16px;
    font-weight: bold;
    color: #2c7be5;
  }

  .timeTd {
    width: 70px;
    height: 30px;
    background: rgba(255, 255, 255, 0.39);
    border-radius: 0 6px 6px 0;
    line-height: 30px;
    text-align: center;
    font-size: 13px;
    font-weight: 400;
    color: #4d4d4d;
  }

  .setSpace {
    margin-bottom: 20px;
  }

  .blockDiv {
    box-sizing: border-box;
    min-height: 300px;
    display: flex;
    justify-content: space-between;

    .blockLeft,
    .blockRight {
      width: calc(50% - 10px);
      background-color: #fff;
      min-height: 502px;
      border-radius: 6px;
    }
  }

  .text-ellipsis {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
    line-height: 1.4;
    margin-bottom: 2px;
  }
}
</style>
