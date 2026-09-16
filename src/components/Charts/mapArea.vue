<script setup lang="ts">
/**
 * 首页「地域分布」的中国地图，对齐 v2 src/components/Charts/mapArea.vue。
 *
 * 与 v2 的唯一差别是地图数据来源：v2 直接 `import chinamap from "echarts/map/json/china.json"`，
 * echarts 5 起内置地图数据被移除，改由 `@/utils/geo-map` 的 ensureGeoMap('china')
 * 从 `public/map/china.json`（与 v2 同源，取自 echarts 4.2.1）按需 fetch + registerMap。
 *
 * 省份清单、tooltip 文案、visualMap 配色、itemStyle / label 的取值全部照搬 v2。
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'
import { ensureGeoMap } from '@/utils/geo-map'
import { percentage } from '@/utils/percent'

/** 接口返回的省份行 */
interface AreaRow {
  province?: string
  visitCount?: number
  visitCountRate?: number | string
  uv?: number
  uvRate?: number | string
}

/** 喂给 echarts series.data 的一项，额外挂了 tooltip 要用的字段 */
interface ProvinceItem {
  name: string
  value: number
  visitCountRate: number | string
  uv: number | string
  uvRate: number | string
}

const copyRight = window.globalConfig.copyRight || 'ClkLog'

/** v2 的省份清单，顺序与取值逐行照搬 */
const PROVINCE_NAMES = [
  '上海', '广东', '北京', '天津', '重庆', '河北', '河南', '云南', '辽宁', '黑龙江',
  '湖南', '安徽', '山东', '新疆', '江苏', '浙江', '江西', '湖北', '广西', '甘肃',
  '山西', '内蒙古', '陕西', '吉林', '福建', '贵州', '青海', '西藏', '四川', '宁夏',
  '海南', '台湾', '香港', '澳门',
]

const maxValue = ref(200)
const provinceList = ref<ProvinceItem[]>(
  PROVINCE_NAMES.map((name) => ({ name, value: 0, visitCountRate: 0, uv: 0, uvRate: 0 })),
)

const chartRef = ref<HTMLElement | null>(null)
let myChart: echarts.ECharts | null = null

/**
 * 容器可能还没有尺寸（首页多个 block 同时渲染、路由过渡未结束），
 * 取不到就隔帧重试，避免数据先到、图却永远不画。
 */
function withChartDom(draw: (dom: HTMLElement) => void, retry = 0) {
  const dom = chartRef.value
  if (dom && dom.clientWidth > 0 && dom.clientHeight > 0) {
    draw(dom)
    return
  }
  if (retry < 20) {
    setTimeout(() => withChartDom(draw, retry + 1), 100)
  }
}

/** 对齐 v2 getMapChartsData：按省份名把接口结果合并进 provinceList，并取出最大访问次数 */
function getMapChartsData(val: AreaRow[] | null | undefined) {
  const result = val || []
  const merged: ProvinceItem[] = PROVINCE_NAMES.map((name) => ({
    name,
    value: 0,
    visitCountRate: 0,
    uv: 0,
    uvRate: 0,
  }))
  const maxList: number[] = []

  for (const item of merged) {
    for (const row of result) {
      if (item.name == row.province) {
        item.value = row.visitCount ?? 0
        item.visitCountRate = percentage(row.visitCountRate)
        item.uv = row.uv ?? 0
        item.uvRate = percentage(row.uvRate)
        maxList.push(Number(row.visitCount ?? 0))
      }
    }
  }

  // v2：有匹配数据时取最大值做 visualMap 上限，没有则整张图归零（maxValue 保持上一次的值）
  if (maxList.length > 0) {
    maxValue.value = maxList.sort((a, b) => b - a)[0] ?? 200
  } else {
    merged.forEach((item) => {
      item.value = 0
    })
  }

  provinceList.value = merged
  showScatterInGeo()
}

/** 对齐 v2 showScatterInGeo */
function showScatterInGeo() {
  void ensureGeoMap('china').then(() => {
    withChartDom((dom) => {
      if (!myChart || myChart.isDisposed()) {
        myChart = echarts.init(dom)
      }
      const option: EChartsOption = {
        geo: {
          map: 'china',
          aspectScale: 0.75,
          zoom: 1.1,
        },
        tooltip: {
          formatter(params) {
            const single = Array.isArray(params) ? params[0] : params
            const data = single?.data as ProvinceItem | undefined
            const visitCountRate = data ? data.visitCountRate : 0
            const uv = data ? data.uv : 0
            const uvRate = data ? data.uvRate : 0
            return `
              <div style="padding:10px;">
                <div style='font-size:14px;'> ${single?.name}</div>
                <p style='text-align:left;margin-top:10px;'>
                  访问次数：${single?.value}(占比：${visitCountRate})<br/>
                  访客数：${uv}(占比：${uvRate})<br/>
                </p>
              </div>
            `
          },
        },
        visualMap: {
          min: 0,
          max: maxValue.value,
          left: '5%',
          top: '5%',
          bottom: '5%',
          text: ['高'],
          calculable: true,
          /*
           * v2 写的是已废弃的 `color: ["#2c7be5", "#fff"]`。
           * 注意两者顺序是**反的**：visualMap.color 是「高 → 低」，inRange.color 是「低 → 高」。
           * 所以 v2 的含义是 最大值=#2c7be5(蓝) / 最小值=#fff(白)，
           * 换成 inRange 必须写成 ['#fff', '#2c7be5']，直接照抄数组会把冷热色对调。
           * v2 其余用 inRange 的地方（regional / visited / collapse-table）写的也都是 ["#fff", "#2c7be5"]，一致。
           */
          inRange: { color: ['#fff', '#2c7be5'] },
        },
        series: [
          {
            zoom: 1.1,
            map: 'china',
            type: 'map',
            // echarts 6 取消了 itemStyle.normal 这一层，直接平铺
            itemStyle: {
              borderColor: 'rgba(0, 0, 0, 0.2)',
            },
            emphasis: {
              itemStyle: {
                shadowOffsetX: 0,
                shadowOffsetY: 0,
                shadowBlur: 20,
                borderWidth: 0,
                shadowColor: 'rgba(0, 0, 0, 0.5)',
              },
              label: { show: false },
            },
            label: { show: false },
            data: provinceList.value,
          },
        ],
      }
      myChart.setOption(option, true)
    })
  })
}

function handleResize() {
  if (myChart && !myChart.isDisposed()) myChart.resize()
}

onMounted(() => {
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  // v2 用匿名函数 addEventListener 且从不移除，这里必须收干净
  window.removeEventListener('resize', handleResize)
  myChart?.dispose()
  myChart = null
})

defineExpose({ getMapChartsData })
</script>

<template>
  <div style="width: 100%; height: 100%">
    <div ref="chartRef" style="width: 100%; height: 75%"></div>
    <div style="margin-top: 15px; font-size: 13px; text-align: center">
      {{ copyRight }} uses the lP2Location LlTE database for
      <a
        href="https://lite.ip2location.com"
        target="_blank"
        style="cursor: pointer; color: #2c7be5"
        >lP geolocation</a
      >
    </div>
  </div>
</template>
