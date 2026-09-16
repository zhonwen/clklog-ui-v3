<script setup lang="ts">
/** 忠诚度分析 - 访问深度（对应 v2 .../loyaltyAnalysis/components/visitDepth.vue） */
import { computed, onMounted, ref } from 'vue'
import type { EChartsOption } from 'echarts'
import { getUserVisitUriApi } from '@/api/trackingapi/uservisit'
import { useChart } from '@/composables/useChart'
import { useLatestOnly } from '@/composables/useLatestOnly'
import { toFixedPoint } from '@/views/user-behavior/filters'
import { getSummaries, type LoyaltyRow } from './summary'

const { elRef: depEchartRef, init: initChart, setOption } = useChart()
const { next, isLatest } = useLatestOnly()

const xData = ref<string[]>([])
const yData = ref<number[]>([])
const tableList = ref<LoyaltyRow[]>([])
const loadingRefresh = ref(false)

/** 模板里避免每行重复调过滤器，这里一次算好 */
const tableRows = computed(() =>
  tableList.value.map((row) => ({ ...row, rateText: toFixedPoint(row.rate) })),
)

function getDepthEvent(commonParams: Record<string, unknown>) {
  const token = next()
  loadingRefresh.value = true
  getUserVisitUriApi(commonParams)
    .then((res) => {
      if (!isLatest(token)) return
      if (res?.code == 200) {
        loadingRefresh.value = false
        const data = (res.data as LoyaltyRow[] | null) || []
        tableList.value = data
        xData.value = []
        yData.value = []
        data.map((item) => {
          if (item) {
            xData.value.push(item.key as string)
            yData.value.push(item.value as number)
          }
        })
        initEcharts()
      }
    })
    .catch(() => {
      if (!isLatest(token)) return
      loadingRefresh.value = false
    })
}

function initEcharts() {
  const mulColumnZZTData: EChartsOption = {
    xAxis: {
      data: xData.value,
      axisTick: {
        show: false,
        alignWithLabel: true,
      },
      axisLabel: {
        show: true,
        interval: 0,
        rotate: 35,
      },
    },
    legend: {
      orient: 'vertical',
      // v2: legend.x = "center" / legend.y = "top"（echarts 4 写法）
      left: 'center',
      top: 'top',
    },
    dataZoom: [
      {
        type: 'inside',
        startValue: 0,
        endValue: 16,
        zoomOnMouseWheel: false,
        moveOnMouseWheel: true,
        moveOnMouseMove: true,
      },
    ],
    yAxis: {},
    series: [
      {
        type: 'bar',
        data: yData.value,
        barWidth: 30,
        name: '访问次数',
        label: {
          show: true,
          position: 'top',
        },
        itemStyle: {
          color: '#2c7be5',
        },
      },
    ],
  }
  setOption(mulColumnZZTData, true)
}

onMounted(() => {
  initChart()
})

defineExpose({ getDepthEvent })
</script>

<template>
  <div v-loading="loadingRefresh" class="bar_chart" style="width: 100%">
    <div ref="depEchartRef" style="width: 89vw; height: 300px" />
    <div class="public-Table-minHeight" style="margin: 63px 25px 350px">
      <el-table
        :summary-method="getSummaries"
        show-summary
        :data="tableRows"
        :header-cell-style="{ textAlign: 'center', background: '#f7fafe ' }"
        :cell-style="{ textAlign: 'center' }"
        border
        class="public-radius"
        style="width: 100%"
      >
        <el-table-column label="序号" type="index" width="200" />
        <el-table-column prop="key" label="单次访问页数(页面去重)" align="center" />
        <el-table-column prop="value" label="访问次数" sortable align="center" />

        <el-table-column label="所占比列" align="center">
          <template #default="{ row }">
            {{ row.rateText }}
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.labelItem {
  .w156 {
    font-size: 15px;
    font-weight: 400;
    line-height: 16px;
    color: #4d4d4d;
  }

  .parentPosition {
    position: relative;

    .popImg {
      width: 11.44px;
      position: absolute;
      left: 12px;
      top: 2px;
      transform: translate(0, -50%);

      img {
        width: 11.44px;
      }
    }
  }
}

.userLoyalty {
  height: 1109px;
  margin: 15px;
  background-color: #fafafb;
  padding-top: 18px;
  padding-left: 16px;
  padding-bottom: 30px;

  span {
    font-size: 14px;
    font-weight: 500;
    line-height: 33px;
    color: #4d4d4d;
  }

  .bar_chart {
    min-height: 337px;
    background: #fff;

    span {
      font-size: 12px;
      line-height: 15px;
      color: #656d92;
    }
  }

  .setSpace {
    margin-top: 15px;
  }
}
</style>
