<script setup lang="ts">
/**
 * 设备分析-网络设备类型（v2 views/visitor-analysis/equipment-analysis/components/netWorkType.vue）。
 * 父组件通过 ref 调 equipmentTableEvent / PagingEvent / initCurrentPage，并直接写 currentPage。
 */
import { getCurrentInstance, onMounted, ref } from 'vue'
import type { EChartsOption } from 'echarts'
import flowPoint from '@/components/flowPoint/index.vue'
import { averageRulesTable } from '@/utils/percent'
import { getDeviceDetailApi } from '@/api/trackingapi/device'
import { copyObj } from '@/utils/copy'
import { useChart } from '@/composables/useChart'
import { useLatestOnly } from '@/composables/useLatestOnly'

interface DeviceRow {
  device?: string
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

interface DevicePayload {
  rows?: DeviceRow[]
  total?: number
}

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

/**
 * 复刻 v2 src/filters/index.js 的 averageRules 过滤器（整数原样 / 非整数 Math.ceil / falsy '--'）。
 * 与 @/utils/percent 的同名函数实现不同，不能混用。
 */
function averageRulesFilter(num: unknown): number | string {
  if (num) {
    const n = Number(num)
    if (Number.isInteger(n)) return n
    return Math.ceil(n)
  }
  return '--'
}

const proxy = getCurrentInstance()?.proxy

const { elRef: chartOneRef, init: initChartOne, setOption: setChartOneOption } = useChart()
const { elRef: chartTwoRef, init: initChartTwo, setOption: setChartTwoOption } = useChart()
const { next, isLatest } = useLatestOnly()

const emit = defineEmits<{
  (e: 'currentPage', val: Record<string, unknown>): void
}>()

const equipmentList = ref<DeviceRow[]>([])
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

const current = ref<{
  size: number
  page: number
  sortName: string | null
  sortOrder: string | null
}>({
  size: 10,
  page: 1,
  sortName: null,
  sortOrder: null,
})
const currentPage = ref(1)
const total = ref(0)
const pageSize = ref(10)
const commonParams = ref<Record<string, unknown>>({})
// 单选操作
const chekLabelList = ref<{
  uvName: (string | undefined)[]
  uv: (number | undefined)[]
  avgPvName: (string | undefined)[]
  avgPv: number[]
}>({
  uvName: [],
  uv: [],
  avgPvName: [],
  avgPv: [],
})

function uvApiEcharts() {
  const option: EChartsOption = {
    tooltip: {
      trigger: 'axis',
    },
    // v2 是 legend: { data: ['访客数'], x: 'center' }，echarts 5+ 换成 left
    legend: {
      data: ['访客数'],
      left: 'center',
    },
    grid: {
      left: '15%',
      top: '5%',
      bottom: '10%',
    },
    yAxis: [
      {
        type: 'category',

        axisTick: {
          show: false,
          alignWithLabel: true,
        },
        data: chekLabelList.value.uvName.map((v) => v ?? ''),
      },
    ],
    xAxis: [
      {
        type: 'value',
        axisTick: {
          show: false,
        },
        axisLabel: {
          interval: 0,
          // v2 写的是字符串 '26'，echarts 5+ 要求数字
          rotate: 26,
        },
      },
    ],
    series: [
      {
        name: '访客数',
        type: 'bar',
        barWidth: 10,
        data: chekLabelList.value.uv,
        label: {
          show: true,
          position: 'right',
        },
        itemStyle: {
          color: '#2c7be5',
        },
      },
    ],
  }
  setChartOneOption(option, true)
}

function avgPvApiEcharts() {
  const option: EChartsOption = {
    tooltip: {
      trigger: 'axis',
    },
    legend: {
      data: ['平均访问页数'],
      left: 'center',
    },
    grid: {
      left: '15%',
      top: '5%',
      bottom: '10%',
    },
    yAxis: [
      {
        type: 'category',

        axisTick: {
          show: false,
          alignWithLabel: true,
        },
        data: chekLabelList.value.avgPvName.map((v) => v ?? ''),
      },
    ],
    xAxis: [
      {
        type: 'value',
        axisTick: {
          show: false,
        },
        axisLabel: {
          interval: 0,
          rotate: 26,
        },
      },
    ],
    series: [
      {
        name: '平均访问页数',
        type: 'bar',
        barWidth: 10,
        data: chekLabelList.value.avgPv,
        label: {
          show: true,
          position: 'right',
        },
        itemStyle: {
          color: '#2c7be5',
        },
      },
    ],
  }
  setChartTwoOption(option, true)
}

function getDeviceDetail(sort: string, label: string) {
  const params = copyObj(commonParams.value) as Record<string, unknown>
  params.sortName = label
  params.sortOrder = sort
  params.pageNum = 1
  params.pageSize = 10
  const token = next()
  getDeviceDetailApi(params)
    .then((res) => {
      if (!isLatest(token)) return
      if (res?.code != 200) return
      const data = res.data as DevicePayload | undefined
      if (label == 'uv') {
        chekLabelList.value.uv = []
        chekLabelList.value.uvName = []
        const uvList = (data?.rows || []).reverse()
        uvList.forEach((item) => {
          chekLabelList.value.uv.push(item.uv)
          chekLabelList.value.uvName.push(item.device)
        })
        uvApiEcharts()
      } else {
        chekLabelList.value.avgPv = []
        chekLabelList.value.avgPvName = []
        const avgList = (data?.rows || []).reverse()
        avgList.forEach((item) => {
          const value = averageRulesTable(item.avgPv)
          chekLabelList.value.avgPv.push(value)
          chekLabelList.value.avgPvName.push(item.device)
        })
        avgPvApiEcharts()
      }
    })
    .catch(() => {
      /* 报错已由请求层统一提示 */
    })
}

function equipmentTableEvent(
  val: DevicePayload,
  params: Record<string, unknown>,
  pageNum: number,
) {
  commonParams.value = params
  equipmentList.value = val.rows || []
  total.value = val.total ?? 0
  if (pageNum == 1) {
    const chartOneList = copyObj(val.rows || [])
    chekLabelList.value.uv = []
    chekLabelList.value.uvName = []
    const uvList = chartOneList.reverse()
    uvList.forEach((item) => {
      chekLabelList.value.uv.push(item.uv)
      chekLabelList.value.uvName.push(item.device)
    })
    uvApiEcharts()
  }
  getDeviceDetail('desc', 'avgPv')
}

function PagingEvent(res: DevicePayload) {
  // 分页事件
  equipmentList.value = res.rows || []
  total.value = res.total ?? 0
}

function getIndex($index: number) {
  return (currentPage.value - 1) * pageSize.value + $index + 1
}

function sortChange(e: { prop?: string | null; order?: string | null }) {
  if (e.order && e.order == 'ascending') {
    // 降序
    current.value.sortName = e.prop ?? null
    current.value.sortOrder = 'asc'
    emit('currentPage', { ...current.value })
  } else if (e.order && e.order == 'descending') {
    // 升序
    current.value.sortName = e.prop ?? null
    current.value.sortOrder = 'desc'
    emit('currentPage', { ...current.value })
  } else {
    current.value.sortName = null
    current.value.sortOrder = null
    emit('currentPage', { ...current.value })
  }
}

function handleSizeChange(val: number) {
  current.value.size = val
  emit('currentPage', { ...current.value })
}

function handleCurrentChange(val: number) {
  current.value.page = val
  emit('currentPage', { ...current.value })
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

onMounted(() => {
  initChartOne()
  initChartTwo()
})

// currentPage 也要暴露：父组件里有 this.$refs.equipmentTable.currentPage = 1 这种直接赋值
defineExpose({ equipmentTableEvent, PagingEvent, initCurrentPage, currentPage })
</script>

<template>
  <div>
    <div class="chartsIcon">
      <div style="display: flex">
        <div ref="chartOneRef" class="chartStyle"></div>
        <div ref="chartTwoRef" class="chartStyle"></div>
      </div>
      <flowPoint style="margin-top: 50px" @flow-point="flowPointEvent" />

      <div>
        <div class="public-Table-minHeight">
          <el-table
            :data="equipmentList"
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
            <el-table-column prop="device" label="设备类型" width="150" />

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
        <div class="block">
          <el-pagination
            v-model:current-page="currentPage"
            next-text="下一页"
            :page-sizes="[10, 20, 30, 40]"
            :page-size="pageSize"
            layout=" total,sizes, prev, pager, next, jumper"
            :total="total"
            @size-change="handleSizeChange"
            @current-change="handleCurrentChange"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
// v2 这里是 ::v-deep { @import el-pagination.scss } + @import custom-select.scss
// 两个文件 v3 都已在 styles/index.scss 全局引入，这里不再重复

.chartStyle {
  width: 50%;
  height: 400px;
}

.chartsIcon {
  box-sizing: border-box;

  padding-top: 1px;
  min-height: 600px;
  background: #fff;
  border-radius: 6px;
  padding: 22px;
}
</style>
