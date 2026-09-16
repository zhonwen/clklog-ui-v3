<script setup lang="ts">
/** 沉默用户（对应 v2 views/user-behavior/silentUsers/index.vue） */
import { computed, onMounted, ref, watch } from 'vue'
import type { EChartsOption } from 'echarts'
import { FilterBar } from '@/layout/components'
import { getVisitorRevisitAndSilentTrendApi } from '@/api/trackingapi/visitor'
import { copyObj } from '@/utils/copy'
import { useTrackingStore } from '@/stores/tracking'
import { useSettingsStore } from '@/stores/settings'
import { useChart } from '@/composables/useChart'
import { useLatestOnly } from '@/composables/useLatestOnly'
import arrowIcon from '@/assets/images/icon.png'

/** 回流/沉默趋势接口返回的一行 */
interface SilentTrendRow {
  statTime?: string
  uvCount?: number
  revisitCount?: number
  silentCount?: number
  historyCount?: number
  newCount?: number
  activeCount?: number
}

const trackingStore = useTrackingStore()
const settingsStore = useSettingsStore()
const { next, isLatest } = useLatestOnly()
const { elRef: countLineRef, init: initCountLine, setOption: setCountLineOption } = useChart()

const cologStyle = settingsStore.cologStyle

const loadingRefresh = ref(false)
const silientTableList = ref<SilentTrendRow[]>([])
const filterBarParams = ref<Record<string, unknown>>({})
const headLege = ref<string[]>(['新用户', '老用户', '沉默用户'])
const options = ref([
  { value: '所有用户', label: '所有用户', disabled: false },
  { value: '回流用户', label: '回流用户', disabled: false },
  { value: '沉默用户', label: '沉默用户', disabled: false },
  { value: '老用户', label: '老用户', disabled: false },
  { value: '新用户', label: '新用户', disabled: false },
])
const uvCount = ref<number[]>([])
const revisitCount = ref<number[]>([])
const silentCount = ref<number[]>([])
const historyCount = ref<number[]>([])
const newCount = ref<number[]>([])
const statTime = ref<string[]>([])
const tableList = ref<SilentTrendRow[]>([])

const projectName = computed(() => trackingStore.projectName)
const commonParams = computed<Record<string, unknown>>(() =>
  Object.assign({ projectName: projectName.value }, filterBarParams.value),
)

function silientTableEvent() {
  const token = next()
  loadingRefresh.value = true
  const params = copyObj(commonParams.value)
  delete params.dimensionValue
  getVisitorRevisitAndSilentTrendApi(params)
    .then((res) => {
      if (!isLatest(token)) return
      if (res?.code == 200) {
        loadingRefresh.value = false
        const data = (res.data as SilentTrendRow[] | null) || []
        tableList.value = copyObj(data).reverse()
        silientTableList.value = data
        filterEvent()
      }
    })
    .catch(() => {
      if (!isLatest(token)) return
      loadingRefresh.value = false
    })
}

function handleCheckPointer() {
  filterEvent()
}

function filterEvent() {
  uvCount.value = []
  revisitCount.value = []
  silentCount.value = []
  historyCount.value = []
  newCount.value = []
  statTime.value = []
  for (let i = 0; i < silientTableList.value.length; i++) {
    const row = silientTableList.value[i]
    if (!row) continue
    for (let j = 0; j < headLege.value.length; j++) {
      const lege = headLege.value[j]
      if (lege == '回流用户') {
        revisitCount.value.push(row.revisitCount as number)
      }
      if (lege == '所有用户') {
        uvCount.value.push(row.uvCount as number)
      }
      if (lege == '沉默用户') {
        silentCount.value.push(row.silentCount as number)
      }
      if (lege == '老用户') {
        historyCount.value.push(row.historyCount as number)
      }
      if (lege == '新用户') {
        newCount.value.push(row.newCount as number)
      }
    }
    statTime.value.push(row.statTime as string)
  }
  countLineEcharts()
}

function countLineEcharts() {
  const option: EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        lineStyle: {
          color: '#C0CADB',
          width: 2,
        },
      },
    },
    legend: {
      // v2: legend.x = "center" / legend.y = "top"（echarts 4 写法）
      left: 'center',
      top: 'top',
      data: headLege.value,
    },
    grid: {
      left: '10%',
      right: '2%',
      top: '10%',
      bottom: '10%',
      containLabel: true,
    },

    dataZoom: [
      {
        type: 'inside',
        startValue: 0,
        endValue: 24,
        minValueSpan: 10,
        zoomOnMouseWheel: false,
        moveOnMouseWheel: true,
        moveOnMouseMove: true,
      },
    ],

    xAxis: {
      type: 'category',
      data: statTime.value,
      axisTick: {
        show: false,
      },
      axisLabel: {
        interval: 0,
        // v2 是字符串 "45"，echarts 6 要数字
        rotate: 45,
      },
    },
    yAxis: {
      axisTick: {
        show: false,
      },
      type: 'value',
    },
    // v2 写的是 series 上的 color（echarts 4 写法，echarts 6 的类型里已经没有这个字段），
    // 等价写法是 itemStyle.color，渲染结果一致
    series: [
      {
        data: uvCount.value,
        type: 'line',
        name: '所有用户',
        itemStyle: { color: cologStyle.$pv },
      },
      {
        data: revisitCount.value,
        type: 'line',
        name: '回流用户',
        itemStyle: { color: cologStyle.$uv },
      },
      {
        data: silentCount.value,
        type: 'line',
        name: '沉默用户',
        itemStyle: { color: cologStyle.$visitCount },
      },
      {
        data: historyCount.value,
        type: 'line',
        name: '老用户',
        itemStyle: { color: cologStyle.$ipCount },
      },
      {
        data: newCount.value,
        type: 'line',
        name: '新用户',
        itemStyle: { color: cologStyle.$bounceRate },
      },
    ],
  }
  setCountLineOption(option, true)
}

function setFilterBarParams(val: Record<string, unknown>) {
  filterBarParams.value = copyObj(val)
}

watch(commonParams, () => {
  silientTableEvent()
})

onMounted(() => {
  initCountLine()
})
</script>

<template>
  <div>
    <FilterBar
      ByActive
      ByTimeSlot
      ByArea
      :ByCalendar="false"
      :ByTime="false"
      :ByVisitor="false"
      :ByDownLoad="false"
      @set-filter-bar-params="setFilterBarParams"
    />
    <div class="public-block">
      <div v-loading="loadingRefresh" class="trendDiv setSpace public-hoverItem block-main">
        <div class="block-head">
          <div class="block-title">趋势图</div>
          <el-select
            v-model="headLege"
            class="custom_select"
            multiple
            placeholder="请选择"
            style="margin-left: 20px; min-width: 280px"
            @change="handleCheckPointer"
          >
            <el-option
              v-for="item in options"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            >
              <div style="display: flex; align-items: center">
                <span class="checkbox__inner"><div class="inner-box" /></span>
                <span>{{ item.label }}</span>
              </div>
            </el-option>
          </el-select>

          <div class="block-head-icon">
            <img :src="arrowIcon" alt="" width="10" />
          </div>
        </div>
        <div ref="countLineRef" style="width: 90%; height: 400px" />
      </div>
      <div v-loading="loadingRefresh" class="statistics setSpace public-hoverItem block-main">
        <div class="block-head">
          <div class="block-title">数据统计</div>
          <div class="block-head-icon" />
        </div>
        <div style="width: 100%">
          <el-table
            :data="tableList"
            class="public-radius"
            :header-cell-style="{
              textAlign: 'center',
              background: '#f7fafe ',
            }"
            :cell-style="{
              textAlign: 'center',
            }"
            style="width: 100%"
            border
          >
            <el-table-column prop="statTime" min-width="20%" show-overflow-tooltip label="日期" />
            <el-table-column
              prop="uvCount"
              label="累计用户数"
              min-width="16%"
              show-overflow-tooltip
            />
            <el-table-column
              prop="revisitCount"
              label="回流用户数"
              min-width="16%"
              show-overflow-tooltip
            />
            <el-table-column
              prop="silentCount"
              label="沉默用户数"
              min-width="16%"
              show-overflow-tooltip
            />
            <el-table-column
              prop="historyCount"
              label="老用户数"
              min-width="16%"
              show-overflow-tooltip
            />
            <el-table-column
              prop="newCount"
              label="新用户数"
              min-width="16%"
              show-overflow-tooltip
            />
            <el-table-column
              prop="activeCount"
              label="用户数"
              min-width="16%"
              show-overflow-tooltip
            />
          </el-table>
        </div>
      </div>
      <div class="explain public-hoverItem block-main">
        <div class="block-head">
          <div class="block-title">名词解释</div>
          <div class="block-head-icon" />
        </div>
        <div class="customTable" style="width: 100%">
          <table border="1" width="100%" cellpadding="0" cellspacing="0" align="center">
            <tr>
              <td style="width: 20%" rowspan="3">回流用户</td>
              <td>按日返回</td>
              <td>老访客中，当天有访问但前一日未访问的独立访客数。</td>
            </tr>
            <tr>
              <td style="background-color: #fff">按周返回</td>
              <td>老访客中，当周有访问但前一周未访问的独立访客数。</td>
            </tr>
            <tr>
              <td style="background-color: #fff">按月返回</td>
              <td>老访客中，当月有访问但前一月未访问的独立访客数。</td>
            </tr>

            <tr>
              <td style="width: 20%" rowspan="3">沉默用户</td>
              <td>按日返回</td>
              <td>老访客中，当天未访问但前一日有访问的独立访客数。</td>
            </tr>
            <tr>
              <td style="background-color: #fff">按周返回</td>
              <td>老访客中，当周未访问但前一周有访问的独立访客数。</td>
            </tr>
            <tr>
              <td style="background-color: #fff">按月返回</td>
              <td>老访客中，当月未访问但前一月有访问的独立访客数。</td>
            </tr>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
// v2 这里是 @import "~@/styles/components/custom-select.scss";
// v3 已在 styles/index.scss 全局 @use，组件内不再重复引入

:deep(.el-radio-button--mini .el-radio-button__inner) {
  height: 30px;
}

.trendDiv {
  min-height: 462px;
  background-color: #fff;
  border-radius: 6px;
}

.setSpace {
  margin-bottom: 20px;
}

.statistics {
  min-height: 364px;
  background-color: #fff;
  border-radius: 6px;
}

.explain {
  min-height: 243px;
  background-color: #fff;
  border-radius: 6px;
}
</style>
