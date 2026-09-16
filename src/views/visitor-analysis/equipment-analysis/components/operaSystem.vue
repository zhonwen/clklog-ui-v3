<script setup lang="ts">
/**
 * 设备分析-操作系统（v2 views/visitor-analysis/equipment-analysis/components/operaSystem.vue）。
 * 父组件通过 ref 调 operaSystemEvent(commonParams) / initCurrentPage()，并直接写 currentPage。
 * 这里的勾选器用的是 flowPoint/system.vue（不监听 bus 的那一版），与 v2 一致。
 */
import { getCurrentInstance, onMounted, ref } from 'vue'
import type { EChartsOption, SeriesOption } from 'echarts'
import { getOperaSystemApi } from '@/api/trackingapi/device'
import flowPoint from '@/components/flowPoint/system.vue'
import { useChart } from '@/composables/useChart'
import { useLatestOnly } from '@/composables/useLatestOnly'
import { useSettingsStore } from '@/stores/settings'

interface OsRow {
  os?: string
  pv?: number
  pvRate?: number
  visitCount?: number
  uv?: number
  newUv?: number
  newUvRate?: number
  ipCount?: number
  avgPv?: number
  avgVisitTime?: number
  bounceRate?: number
}

type CheckboxGroupValue = (string | number)[]

/** 复刻 v2 src/filters/index.js 的 percenTable 过滤器（falsy 返回 0，不是 '--'） */
function percenTableFilter(s: unknown): string | number {
  if (s == 1) return '100%'
  if (s) return (Number(s) * 100).toFixed(2) + '%'
  return 0
}

/**
 * 复刻 v2 src/filters/index.js 的 formatTime 过滤器
 * （比 @/utils/format 的同名函数多一步 Math.floor，falsy 返回 '--'）。
 */
function formatTimeFilter(seconds: unknown): string {
  if (seconds) {
    const total = Math.floor(Number(seconds))
    const hours = Math.floor(total / 3600)
    const minutes = Math.floor((total - hours * 3600) / 60)
    const rest = total - hours * 3600 - minutes * 60
    const pad = (n: number) => (n < 10 ? `0${n}` : String(n))
    return `${pad(hours)}:${pad(minutes)}:${pad(rest)}`
  }
  return '--'
}

/** 复刻 v2 src/filters/index.js 的 averageRules 过滤器（整数原样 / 非整数 Math.ceil / falsy '--'） */
function averageRulesFilter(num: unknown): number | string {
  if (num) {
    const n = Number(num)
    if (Number.isInteger(n)) return n
    return Math.ceil(n)
  }
  return '--'
}

const proxy = getCurrentInstance()?.proxy
const settingsStore = useSettingsStore()

const {
  elRef: systemEchartRef,
  init: initSystemEchart,
  setOption: setSystemEchartOption,
} = useChart()
const { next, isLatest } = useLatestOnly()

const loadingRefresh = ref(false)
const checkLable = ref<CheckboxGroupValue>(['访客数', '访问次数', 'IP数'])
const options = [
  { value: '浏览量', label: '浏览量' },
  { value: '访客数', label: '访客数' },
  { value: '访问次数', label: '访问次数' },
  { value: 'IP数', label: 'IP数' },
  { value: '跳出率', label: '跳出率' },
]

const operaSystemList = ref<OsRow[]>([])
const pv = ref(false)
const visitCount = ref(false)
const newUv = ref(false)
const uv = ref(false)
const ipCount = ref(false)
const avgPv = ref(false)
const avgVisitTime = ref(false)
const bounceRate = ref(false)
const pvRate = ref(false)
const newUvRate = ref(false)

const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(0)
const commonParams = ref<Record<string, unknown>>({})
// 单选操作
const chekLabelList = ref<{
  statTime: (string | undefined)[]
  pv: (number | undefined)[]
  uv: (number | undefined)[]
  visitCount: (number | undefined)[]
  ipCount: (number | undefined)[]
  bounceRate: string[]
}>({
  statTime: [],
  pv: [],
  uv: [],
  visitCount: [],
  ipCount: [],
  bounceRate: [],
})

function tooltipFormatter(rawParams: unknown): string {
  const params = (Array.isArray(rawParams) ? rawParams : [rawParams]) as Array<{
    name?: string
    seriesName?: string
    value?: unknown
  }>
  let value: unknown = 0
  let res = '<div><p>' + String(params[0]?.name ?? '') + '</p></div>'
  for (let i = 0; i < params.length; i++) {
    const item = params[i]
    if (item?.seriesName == '跳出率') {
      value = String(item?.value ?? '') + '%'
    } else {
      value = item?.value
    }
    res += '<p>' + String(item?.seriesName ?? '') + ':' + String(value ?? '') + '</p>'
  }
  return res
}

/** 带必填 name 的 series，方便下面按 name 过滤（SeriesOption 联合类型上的 name 是可选的） */
type NamedSeries = SeriesOption & { name: string }

function initEcharts(seriesdata: NamedSeries[]) {
  const sourceChart: EChartsOption = {
    tooltip: {
      trigger: 'axis',
      showContent: true,
      formatter: tooltipFormatter,
    },
    xAxis: {
      type: 'category',
      boundaryGap: true,
      data: chekLabelList.value.statTime.map((v) => v ?? ''),
      axisLabel: {
        interval: 0,
        // v2 写的是字符串 '30'，echarts 5+ 要求数字
        rotate: 30,
      },
      axisLine: {
        onZero: false,
      },
      axisTick: {
        show: false,
        alignWithLabel: true,
      },
    },
    grid: {
      bottom: '15%',
    },
    dataZoom: [
      {
        type: 'inside',
        startValue: 0,
        endValue: 4,
        zoomOnMouseWheel: false,
        moveOnMouseWheel: false,
        moveOnMouseMove: false,
      },
    ],
    // 与 v2 一致（v2 此处逻辑存疑：yAxis 上写了 onZero，这是 axisLine 的配置项，放这里不生效）
    yAxis: {},
    series: seriesdata,
  }
  setSystemEchartOption(sourceChart, true)
}

// 处理设备图表功能
function deviceEchartEvent() {
  const colors = settingsStore.cologStyle
  chekLabelList.value.pv = []
  chekLabelList.value.uv = []
  chekLabelList.value.visitCount = []
  chekLabelList.value.ipCount = []
  chekLabelList.value.bounceRate = []
  chekLabelList.value.statTime = []
  for (let i = 0; i < operaSystemList.value.length; i++) {
    const row = operaSystemList.value[i]
    if (!row) continue
    for (let j = 0; j < checkLable.value.length; j++) {
      const key = checkLable.value[j]
      if (key == '访问次数') {
        chekLabelList.value.visitCount.push(row.visitCount)
      }
      if (key == '浏览量') {
        chekLabelList.value.pv.push(row.pv)
      }
      if (key == '访客数') {
        chekLabelList.value.uv.push(row.uv)
      }
      if (key == 'IP数') {
        chekLabelList.value.ipCount.push(row.ipCount)
      }
      if (key == '跳出率') {
        chekLabelList.value.bounceRate.push((Number(row.bounceRate) * 100).toFixed(2))
      }
    }
    chekLabelList.value.statTime.push(row.os)
  }

  const seriesdata: NamedSeries[] = [
    {
      type: 'bar',
      data: chekLabelList.value.pv,
      barWidth: 20,
      barGap: '100%',
      name: '浏览量',
      label: { show: true, position: 'top' },
      itemStyle: { color: colors.$pv },
    },
    {
      type: 'bar',
      data: chekLabelList.value.uv,
      barWidth: 20,
      name: '访客数',
      label: { show: true, position: 'top' },
      itemStyle: { color: colors.$uv },
    },
    {
      type: 'bar',
      data: chekLabelList.value.visitCount,
      barWidth: 20,
      name: '访问次数',
      label: { show: true, position: 'top' },
      itemStyle: { color: colors.$visitCount },
    },
    {
      type: 'bar',
      data: chekLabelList.value.ipCount,
      barWidth: 20,
      name: 'IP数',
      label: { show: true, position: 'top' },
      itemStyle: { color: colors.$ipCount },
    },
    {
      type: 'bar',
      data: chekLabelList.value.bounceRate,
      barWidth: 20,
      name: '跳出率',
      label: {
        show: true,
        position: 'top',
        // 标签内容
        formatter: (params: { value?: unknown }) => String(params.value ?? '') + '%',
      },
      itemStyle: { color: 'red' },
    },
  ]
  // 与 v2 完全一致的「只留勾选指标」写法（splice + i--）
  for (let i = 0; i < seriesdata.length; i++) {
    const name = seriesdata[i]?.name ?? ''
    if (!checkLable.value.includes(name)) {
      seriesdata.splice(i--, 1)
    }
  }
  initEcharts(seriesdata)
}

function operaSystemEvent(params: Record<string, unknown>) {
  loadingRefresh.value = true
  commonParams.value = params
  const token = next()
  getOperaSystemApi(commonParams.value)
    .then((res) => {
      if (!isLatest(token)) return
      if (res?.code != 200) return
      loadingRefresh.value = false
      const data = (res.data as OsRow[]) || []
      operaSystemList.value = data
      total.value = data.length
      deviceEchartEvent()
    })
    .catch(() => {
      if (!isLatest(token)) return
      loadingRefresh.value = false
    })
}

// 切换 lable
function changeChartLabel() {
  deviceEchartEvent()
}

function getIndex($index: number) {
  return (currentPage.value - 1) * pageSize.value + $index + 1
}

function sortChange(e: { prop?: string | null; order?: string | null }) {
  const params = { ...commonParams.value }
  if (e.order && e.order == 'ascending') {
    // 降序
    params.sortName = e.prop
    params.sortOrder = 'asc'
    operaSystemEvent(params)
  } else if (e.order && e.order == 'descending') {
    // 升序
    params.sortName = e.prop
    params.sortOrder = 'desc'
    operaSystemEvent(params)
  } else {
    params.sortName = null
    params.sortOrder = null
    operaSystemEvent(params)
  }
}

function initCurrentPage() {
  currentPage.value = 1
}

function flowPointEvent(val: string[]) {
  if (val.length > 0) {
    pv.value = val.includes('pv')
    visitCount.value = val.includes('visitCount')
    newUv.value = val.includes('newUv')
    uv.value = val.includes('uv')
    ipCount.value = val.includes('ipCount')
    avgPv.value = val.includes('avgPv')
    avgVisitTime.value = val.includes('avgVisitTime')
    bounceRate.value = val.includes('bounceRate')
    pvRate.value = val.includes('pvRate')
    newUvRate.value = val.includes('newUvRate')
  }
}

onMounted(() => initSystemEchart())

// currentPage 也要暴露：父组件里有 this.$refs.operaSystem.currentPage = 1 这种直接赋值
defineExpose({ operaSystemEvent, initCurrentPage, currentPage })
</script>

<template>
  <div v-loading="loadingRefresh">
    <div class="chartsIcon">
      <div class="block">
        <el-select
          v-model="checkLable"
          class="custom_select"
          multiple
          placeholder="请选择"
          style="min-width: 280px"
          @change="changeChartLabel"
        >
          <el-option
            v-for="item in options"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          >
            <div style="display: flex; align-items: center">
              <span class="checkbox__inner"><div class="inner-box"></div></span>
              <span style="">{{ item.label }}</span>
            </div>
          </el-option>
        </el-select>
      </div>
      <div ref="systemEchartRef" style="width: 80vw; height: 400px"></div>
      <flowPoint style="margin-top: 50px" @flow-point="flowPointEvent" />

      <div>
        <div class="public-Table-minHeight">
          <el-table
            :data="operaSystemList"
            :header-cell-style="{ textAlign: 'center', background: '#f7fafe ' }"
            :cell-style="{ textAlign: 'center' }"
            border
            class="public-radius"
            style="width: 100%"
            @sort-change="sortChange($event)"
          >
            <el-table-column
              label="序号"
              type="index"
              :width="proxy?.$fixedWidth.FwIndex"
              align="center"
            >
              <template #default="scope">
                <span v-text="getIndex(scope.$index)"> </span>
              </template>
            </el-table-column>
            <el-table-column prop="os" label="设备类型" width="150" />

            <el-table-column prop="date" label="流量基础指标">
              <el-table-column v-if="pv" prop="pv" label="浏览量" sortable="custom" />
              <el-table-column
                v-if="pvRate"
                prop="pvRate"
                label="浏览量占比"
                sortable="custom"
              >
                <template #default="{ row }">
                  {{ percenTableFilter(row.pvRate) }}
                </template>
              </el-table-column>
              <el-table-column
                v-if="visitCount"
                prop="visitCount"
                label="访问次数"
                sortable="custom"
              />
              <el-table-column v-if="uv" prop="uv" label="访客数" sortable="custom" />
              <el-table-column v-if="newUv" prop="newUv" label="新访客数" sortable="custom" />

              <el-table-column
                v-if="newUvRate"
                prop="newUvRate"
                label="新访客数占比"
                sortable="custom"
              >
                <template #default="{ row }">
                  {{ percenTableFilter(row.newUvRate) }}
                </template>
              </el-table-column>
              <el-table-column v-if="ipCount" prop="ipCount" label="IP数" sortable="custom" />
            </el-table-column>
            <el-table-column prop="date" label="流量质量指标">
              <el-table-column
                v-if="bounceRate"
                prop="bounceRate"
                label="跳出率"
                sortable="custom"
              >
                <template #default="{ row }">
                  {{ percenTableFilter(row.bounceRate) }}
                </template>
              </el-table-column>
              <el-table-column
                v-if="avgVisitTime"
                prop="avgVisitTime"
                label="平均访问时长"
                sortable="custom"
              >
                <template #default="{ row }">
                  {{ formatTimeFilter(row.avgVisitTime) }}
                </template>
              </el-table-column>
              <el-table-column
                v-if="avgPv"
                prop="avgPv"
                label="平均访问页数"
                sortable="custom"
              >
                <template #default="{ row }">
                  {{ averageRulesFilter(row.avgPv) }}
                </template>
              </el-table-column>
            </el-table-column>
          </el-table>
        </div>
        <!-- 当前接口不支持分页 -->
        <!-- <div class="block">
          <el-pagination
            next-text="下一页"
            v-model:current-page="currentPage"
            :page-sizes="[10, 20, 30, 40]"
            :page-size="pageSize"
            layout=" total,sizes, prev, pager, next, jumper"
            :total="total"
            @size-change="handleSizeChange"
            @current-change="handleCurrentChange"
          />
        </div> -->
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
// v2 这里是 ::v-deep { @import el-pagination.scss } + @import custom-select.scss
// 两个文件 v3 都已在 styles/index.scss 全局引入，这里不再重复

.chartsIcon {
  box-sizing: border-box;

  padding-top: 1px;
  min-height: 600px;
  background: #fff;
  border-radius: 6px;
  padding: 22px;
}
</style>
