<script setup lang="ts">
/** 活跃用户（对应 v2 views/user-behavior/activeUsers/index.vue） */
import { computed, onMounted, ref, watch } from 'vue'
import type { EChartsOption } from 'echarts'
import { FilterBar } from '@/layout/components'
import { copyObj } from '@/utils/copy'
import { getVisitorActiveTrendApi } from '@/api/trackingapi/visitor'
import { useTrackingStore } from '@/stores/tracking'
import { useChart } from '@/composables/useChart'
import { useLatestOnly } from '@/composables/useLatestOnly'
import arrowIcon from '@/assets/images/icon.png'

/** 趋势接口返回的一行 */
interface ActiveTrendRow {
  statTime?: string
  uvCount?: number
  activeCount?: number
}

const trackingStore = useTrackingStore()
const { next, isLatest } = useLatestOnly()
const { elRef: countLineRef, init: initCountLine, setOption: setCountLineOption } = useChart()

const loadingRefresh = ref(false)
const timeTypeActive = ref('日活跃数')
const headLege = ref<string[]>(['日活跃数'])
const options = ref([
  { value: '用户总数', label: '用户总数' },
  { value: '日活跃数', label: '日活跃数' },
])
const activeDataList = ref<ActiveTrendRow[]>([])
const filterBarParams = ref<Record<string, unknown>>({})
const startTime = ref<string[]>([])
const activeCount = ref<number[]>([])
const uvCount = ref<number[]>([])
const tableList = ref<ActiveTrendRow[]>([])

const projectName = computed(() => trackingStore.projectName)
const commonParams = computed<Record<string, unknown>>(() =>
  Object.assign({ projectName: projectName.value }, filterBarParams.value),
)

function handleCheckPointer() {
  filterEvent()
}

function activeTableEvent() {
  const token = next()
  loadingRefresh.value = true
  getVisitorActiveTrendApi(commonParams.value)
    .then((res) => {
      if (!isLatest(token)) return
      if (res?.code == 200) {
        loadingRefresh.value = false
        const data = (res.data as ActiveTrendRow[] | null) || []
        tableList.value = copyObj(data).reverse()
        activeDataList.value = data
        switch (commonParams.value.timeType) {
          case 'day':
            timeTypeActive.value = '日活跃数'
            options.value[1] = { value: '日活跃数', label: '日活跃数' }
            // 与 v2 一致：这里注释掉了 headLege = ["日活跃数"]，改成把已勾选项里的「x活跃数」重命名
            headLege.value = headLege.value.map((item) =>
              item.includes('活跃数') ? '日活跃数' : item,
            )
            break
          case 'week':
            timeTypeActive.value = '周活跃数'
            options.value[1] = { value: '周活跃数', label: '周活跃数' }
            headLege.value = headLege.value.map((item) =>
              item.includes('活跃数') ? '周活跃数' : item,
            )
            break
          case 'month':
            timeTypeActive.value = '月活跃数'
            options.value[1] = { value: '月活跃数', label: '月活跃数' }
            headLege.value = headLege.value.map((item) =>
              item.includes('活跃数') ? '月活跃数' : item,
            )
            break
        }

        filterEvent()
      }
    })
    .catch(() => {
      if (!isLatest(token)) return
      loadingRefresh.value = false
    })
}

function filterEvent() {
  startTime.value = []
  activeCount.value = []
  uvCount.value = []

  for (let i = 0; i < activeDataList.value.length; i++) {
    const row = activeDataList.value[i]
    if (!row) continue
    for (let j = 0; j < headLege.value.length; j++) {
      const lege = headLege.value[j]
      if (lege == '日活跃数' || lege == '周活跃数' || lege == '月活跃数') {
        // 与 v2 一致：接口没给值时推的就是 undefined，echarts 当空点处理
        activeCount.value.push(row.activeCount as number)
      }
      if (lege == '用户总数') {
        uvCount.value.push(row.uvCount as number)
      }
    }
    startTime.value.push(row.statTime as string)
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
      left: '5%',
      right: '0',
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
      data: startTime.value,
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
    series: [
      // v2 写的是 series 上的 color（echarts 4 写法，echarts 6 的类型里已经没有这个字段），
      // 等价写法是 itemStyle.color，渲染结果一致
      {
        data: activeCount.value,
        name: timeTypeActive.value,
        type: 'line',
        itemStyle: { color: '#2c7be5' },
      },
      {
        data: uvCount.value,
        type: 'line',
        name: '用户总数',
        itemStyle: { color: '#FFDE84' },
      },
    ],
  }
  setCountLineOption(option, true)
}

function setFilterBarParams(val: Record<string, unknown>) {
  filterBarParams.value = copyObj(val)
}

watch(commonParams, () => {
  activeTableEvent()
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
    <div class="public-block" style="margin-top: 20px">
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
        <div ref="countLineRef" style="width: 95%; height: 400px" />
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
            <el-table-column prop="statTime" min-width="30%" show-overflow-tooltip label="日期" />
            <el-table-column prop="uvCount" label="用户总数" min-width="30%" show-overflow-tooltip />
            <el-table-column
              prop="activeCount"
              :label="timeTypeActive"
              min-width="30%"
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
              <td>活跃用户</td>
              <td>打开应用的用户即为活跃用户，不考虑用户的使用情况</td>
            </tr>
            <tr>
              <td>日活跃用户</td>
              <td>一日 (统计日)之内，访问了应用的用户 (去除重复访问的用户)</td>
            </tr>
            <tr>
              <td>周活跃用户</td>
              <td>一周 (统计周)之内，访问了应用的用户 (去除重复访问的用户)</td>
            </tr>
            <tr>
              <td>月活跃用户</td>
              <td>一月 (统计月) 之内，访问了应用的用户 (去除重复访问的用户)</td>
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
