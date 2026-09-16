<script setup lang="ts">
/**
 * 地域分析-地图 + 省份榜单（v2 views/visitor-analysis/chart-component/regional-analysis-show.vue）。
 *
 * 地图数据来源：echarts 5+ 移除了内置地图，改为运行时 registerMap。
 * GeoJSON 取自 echarts 4.2.1 包内（与 v2 同源），放在 `public/map/{china,world}.json`，
 * 由 `@/utils/geo-map` 的 ensureGeoMap() 按需 fetch + 注册，详见该文件注释。
 * 国家名中英映射仍用 v2 的 `@/utils/world.json`（namemap + dataArr）。
 */
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'
import type { TabsPaneContext } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import { getAreaCountryListApi, getAreaProvinceListApi } from '@/api/trackingapi/area'
import { copyObj } from '@/utils/copy'
import { ensureGeoMap } from '@/utils/geo-map'
import worldData from '@/utils/world.json'
import { useLatestOnly } from '@/composables/useLatestOnly'

interface ProvinceRow {
  province?: string
  pv?: number
  pvRate?: number
  uv?: number
  uvRate?: number
  visitCount?: number
  visitCountRate?: number
  newUv?: number
  newUvRate?: number
  ipCount?: number
  ipCountRate?: number
  [key: string]: unknown
}

interface CountryRow {
  country?: string
  visitCount?: number
  visitCountRate?: number
  pv?: number
  pvRate?: number
  uv?: number
  uvRate?: number
}

interface MapProvince {
  name: string
  value: number
  rate?: number
}

/** world.json 的 dataArr 元素，合并接口数据后喂给世界地图 series.data */
interface WorldItem {
  name?: string
  value?: number
  visitCountRate?: number
  pv?: number
  pvRate?: number
  uv?: number
  uvRate?: number
}

interface HostOption {
  label: string
  value: string
  id: string
  rate: string
}

/**
 * 复刻 v2 src/filters/index.js 的 percenTable 过滤器：
 * 1 → '100%'，其余真值 → 保留两位的百分比，falsy → 0（注意不是 '--'）。
 * v3 的 @/utils/percent 里没有这个函数。
 */
function percenTableFilter(s: unknown): string | number {
  if (s == 1) return '100%'
  if (s) return (Number(s) * 100).toFixed(2) + '%'
  return 0
}

const emit = defineEmits<{
  (e: 'customEvent', val: string): void
}>()

const route = useRoute()
const router = useRouter()

const { next: nextProvince, isLatest: isLatestProvince } = useLatestOnly()
const { next: nextCountry, isLatest: isLatestCountry } = useLatestOnly()

const copyRight = window.globalConfig.copyRight || 'ClkLog'
const loadingRefresh = ref(false)
const hostValue = ref('访问次数')
const labelProperty = ref('visitCount')
const rateProperty = ref('visitCountRate')
const hostList: HostOption[] = [
  { label: '浏览量', value: '浏览量', id: 'pv', rate: 'pvRate' },
  { label: '访客数', value: '访客数', id: 'uv', rate: 'uvRate' },
  {
    label: '访问次数',
    value: '访问次数',
    id: 'visitCount',
    rate: 'visitCountRate',
  },
  {
    label: '新访客数',
    value: '新访客数',
    id: 'newUv',
    rate: 'newUvRate',
  },
  { label: 'IP数', value: 'IP数', id: 'ipCount', rate: 'ipCountRate' },
]

/** 世界地图数据：world.json 的 dataArr 与接口结果合并后的结果 */
const newWorldList = ref<WorldItem[]>([])

const provinceList = ref<MapProvince[]>([
  { name: '上海', value: 0 },
  { name: '广东', value: 0 },
  { name: '北京', value: 0 },
  { name: '天津', value: 0 },
  { name: '重庆', value: 0 },
  { name: '河北', value: 0 },
  { name: '河南', value: 0 },
  { name: '云南', value: 0 },
  { name: '辽宁', value: 0 },
  { name: '黑龙江', value: 0 },
  { name: '湖南', value: 0 },
  { name: '安徽', value: 0 },
  { name: '山东', value: 0 },
  { name: '新疆', value: 0 },
  { name: '江苏', value: 0 },
  { name: '浙江', value: 0 },
  { name: '江西', value: 0 },
  { name: '湖北', value: 0 },
  { name: '广西', value: 0 },
  { name: '甘肃', value: 0 },
  { name: '山西', value: 0 },
  { name: '内蒙古', value: 0 },
  { name: '陕西', value: 0 },
  { name: '吉林', value: 0 },
  { name: '福建', value: 0 },
  { name: '贵州', value: 0 },
  { name: '青海', value: 0 },
  { name: '西藏', value: 0 },
  { name: '四川', value: 0 },
  { name: '宁夏', value: 0 },
  { name: '海南', value: 0 },
  { name: '台湾', value: 0 },
  { name: '香港', value: 0 },
  { name: '澳门', value: 0 },
])

const activeMap = ref('province')
const apiProvinceList = ref<ProvinceRow[]>([])
const maxValue = ref(200)
const commonParams = ref<Record<string, unknown>>({})

/**
 * el-table 的 formatter。v2 是 dateFormat(row, column) { row[column.property] }，
 * 这里直接用 element-plus 传进来的 cellValue（与 row[column.property] 等价）。
 */
function dateFormat(_row: ProvinceRow, _column: unknown, cellValue: unknown): string {
  if (cellValue) {
    return String(percenTableFilter(cellValue))
  } else {
    // v2 返回的是数字 0，element-plus 的 formatter 类型要求 VNode | string，渲染结果相同
    return '0'
  }
}

/** 两张地图各自的 echarts 实例，卸载时统一 dispose */
let chinaChart: echarts.ECharts | null = null
let worldChart: echarts.ECharts | null = null

/**
 * 容器可能还没挂上（el-tab-pane 懒渲染 + 路由过渡未完成），
 * 取不到就隔帧重试，避免数据先到、图却永远不画。
 */
function withMapDom(id: string, draw: (dom: HTMLElement) => void, retry = 0) {
  const dom = document.getElementById(id)
  if (dom && dom.clientWidth > 0) {
    draw(dom)
    return
  }
  if (retry < 20) {
    setTimeout(() => withMapDom(id, draw, retry + 1), 100)
  }
}

/** 中国地图（对齐 v2 showScatterInGeo） */
function showScatterInGeo() {
  void ensureGeoMap('china').then(() => {
    void nextTick(() => {
      withMapDom('echart_china', (dom) => {
      if (!chinaChart || chinaChart.isDisposed()) {
        chinaChart = echarts.init(dom)
      }
      const option: EChartsOption = {
        geo: {
          map: 'china',
          aspectScale: 0.75,
          zoom: 1.1,
        },
        tooltip: {
          formatter(params) {
            const p = params as { name?: string; value?: unknown; data?: { rate?: number } }
            return `
              <div style="padding:10px;">
                <div style='font-size:14px;'> ${p.name}</div>
                <p style='text-align:left;margin-top:10px;'>
                  ${hostValue.value}：${String(p.value ?? '')}<br/>
                  ${hostValue.value}占比 ：${percenTableFilter(p.data?.rate || 0)}<br/>
                </p>
              </div>
            `
          },
        },
        visualMap: {
          min: 0,
          max: maxValue.value || 200,
          left: '10%',
          top: 'bottom',
          text: ['高', '低'],
          realtime: false,
          calculable: true,
          inRange: {
            color: ['#fff', '#2c7be5'],
          },
        },
        series: [
          {
            zoom: 1.1,
            map: 'china',
            type: 'map',
            // echarts 6 已移除 itemStyle.normal / label.normal 层，平铺后语义与 v2 相同
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
      chinaChart.setOption(option, true)
      })
    })
  })
}

/** 世界地图（对齐 v2 worldChartEvent），max 为国家维度的最大值 */
function worldChartEvent(max?: number) {
  void ensureGeoMap('world').then(() => {
    void nextTick(() => {
      withMapDom('world_chart', (dom) => {
      if (!worldChart || worldChart.isDisposed()) {
        worldChart = echarts.init(dom)
      }
      const option: EChartsOption = {
        grid: {
          width: '100%',
          height: '100%',
          left: '10%',
          right: '0%',
          bottom: '0%',
          containLabel: true,
        },
        tooltip: {
          trigger: 'item',
          formatter(params) {
            const p = params as {
              name?: string
              value?: unknown
              data?: { uv?: number; pv?: number; pvRate?: number; uvRate?: number }
            }
            const d = p.data
            const uvRate = d ? percenTableFilter(d.uvRate) : 0
            const pvRate = d ? percenTableFilter(d.pvRate) : 0
            // 与 v2 一致（v2 此处逻辑存疑：「访问次数」那行的占比取的也是 uvRate，
            // 且 visitCountRate 取出来后并未使用）
            return `
              <div style="padding:10px;">
                <div style='font-size:14px;'> ${p.name}</div>
                <p style='text-align:left;margin-top:10px;'>
                  访问次数：${String(p.value ?? 0)}(占比：${uvRate || 0})<br/>
                  访客数：${d?.uv || 0}(占比：${uvRate || 0})<br/>
                  浏览量：${d?.pv || 0}(占比：${pvRate || 0})<br/>
                </p>
              </div>
            `
          },
        },
        visualMap: {
          min: 0,
          max: max || 100,
          text: ['高', '低'],
          left: '10%',
          top: 'bottom',
          realtime: false,
          calculable: true,
          inRange: {
            color: ['#fff', '#eaf2fc', '#2c7be5'],
          },
        },
        series: [
          {
            type: 'map',
            name: '世界地图',
            map: 'world',
            roam: false,
            label: { show: false },
            zoom: 1.2,
            itemStyle: {
              borderWidth: 0.3,
              borderColor: '#000',
              borderType: 'solid',
            },
            emphasis: {
              label: { show: true, color: '#fff' },
              itemStyle: { areaColor: '#FF6347' },
            },
            nameMap: (worldData as { namemap: Record<string, string> }).namemap,
            data: newWorldList.value,
          },
        ],
      }
      worldChart.setOption(option, true)
      })
    })
  })
}

function checkMapDataEvent() {
  const maxList: number[] = []
  const result = apiProvinceList.value
  // 清空历史省份值
  provinceList.value.forEach((item) => {
    item.value = 0
  })
  for (let i = 0; i < provinceList.value.length; i++) {
    const mapItem = provinceList.value[i]
    if (!mapItem) continue
    for (let j = 0; j < result.length; j++) {
      const row = result[j]
      if (!row) continue
      if (mapItem.name == row.province) {
        switch (hostValue.value) {
          case '浏览量':
            mapItem.value = row.pv ?? 0
            mapItem.rate = row.pvRate || 0
            maxList.push(mapItem.value)
            break
          case '访客数':
            mapItem.value = row.uv ?? 0
            mapItem.rate = row.uvRate || 0
            maxList.push(mapItem.value)
            break
          case '访问次数':
            mapItem.value = row.visitCount ?? 0
            mapItem.rate = row.visitCountRate || 0
            maxList.push(mapItem.value)
            break
          case '新访客数':
            mapItem.value = row.newUv ?? 0
            mapItem.rate = row.newUvRate || 0
            maxList.push(mapItem.value)
            break
          case 'IP数':
            mapItem.value = row.ipCount ?? 0
            mapItem.rate = row.ipCountRate || 0
            maxList.push(mapItem.value)
            break
        }
      }
    }
  }
  if (maxList.length > 0) {
    const max = maxList.sort(function (a, b) {
      return b - a
    })[0]
    maxValue.value = max ?? 200
  }
  // refresh map
  showScatterInGeo()
}

function chinaChartEvent(val: ProvinceRow[]) {
  apiProvinceList.value = val
  checkMapDataEvent()
}

// mapChina
function provinceApiEvent() {
  const params = commonParams.value
  switch (hostValue.value) {
    case '访问次数':
      params.sortName = 'visitCount'
      break
    case '访客数':
      params.sortName = 'uv'
      break
    case '浏览量':
      params.sortName = 'pv'
      break
    case '新访客数':
      params.sortName = 'newUv'
      break
    case 'IP数':
      // 与 v2 一致（v2 此处逻辑存疑：IP数排序传的是 ipCountRate，其余指标传的都是数值字段）
      params.sortName = 'ipCountRate'
      break
  }
  params.sortOrder = 'desc'
  params.pageNum = 1
  params.pageSize = 50
  loadingRefresh.value = true
  const token = nextProvince()
  getAreaProvinceListApi(params)
    .then((res) => {
      if (!isLatestProvince(token)) return
      if (res?.code != 200) return
      loadingRefresh.value = false
      const data = res.data as { rows?: ProvinceRow[] } | undefined
      chinaChartEvent(data?.rows || [])
    })
    .catch(() => {
      if (!isLatestProvince(token)) return
      loadingRefresh.value = false
    })
}

function countryApiEvent(params: Record<string, unknown>) {
  params.pageNum = 1
  params.pageSize = 100
  loadingRefresh.value = true
  const token = nextCountry()
  getAreaCountryListApi(params)
    .then((res) => {
      if (!isLatestCountry(token)) return
      if (res?.code != 200) return
      loadingRefresh.value = false
      const data = res.data as { rows?: CountryRow[] } | undefined
      const resList = data?.rows || []
      // 把接口结果按国家名合并进 world.json 的 dataArr（与 v2 逐行一致）
      const maxList: number[] = []
      newWorldList.value = copyObj(
        (worldData as { dataArr: WorldItem[] }).dataArr,
      ) as WorldItem[]
      for (let i = 0; i < newWorldList.value.length; i++) {
        const item = newWorldList.value[i]
        if (!item) continue
        for (let j = 0; j < resList.length; j++) {
          const row = resList[j]
          if (!row) continue
          if (item.name == row.country) {
            item.value = row.visitCount ?? 0
            item.visitCountRate = row.visitCountRate || 0
            item.pv = row.pv
            item.pvRate = row.pvRate
            item.uv = row.uv
            item.uvRate = row.uvRate
          }
          // 与 v2 一致：max 在内层循环里收集，同一个国家会被 push 多次（不影响取最大值）
          maxList.push(Number(item.value ?? 0))
        }
      }
      const max = maxList.sort((a, b) => b - a)[0]
      worldChartEvent(max)
    })
    .catch(() => {
      if (!isLatestCountry(token)) return
      loadingRefresh.value = false
    })
}

function handleChangeProject(val: HostOption) {
  labelProperty.value = val.id
  rateProperty.value = val.rate
  provinceApiEvent()
}

function getAreaProvince(params: Record<string, unknown>) {
  commonParams.value = copyObj(params)
  if (activeMap.value == 'province') {
    provinceApiEvent()
  } else {
    countryApiEvent(commonParams.value)
  }
}

function handleClick(pane: TabsPaneContext) {
  // v2 是 this.$router.push({ path: "regional", query: {...} })，相对路径解析后就是当前页，
  // v3 直接用当前 path，避免 vue-router 4 下相对路径解析差异
  void router.push({ path: route.path, query: { areaOption: pane.index } })
  getAreaProvince(commonParams.value)
  emit('customEvent', activeMap.value)
}

/** 两张地图不走 useChart（容器在 el-tab-pane 里按需渲染），resize 与 dispose 在这里自管 */
function handleMapResize() {
  if (chinaChart && !chinaChart.isDisposed()) chinaChart.resize()
  if (worldChart && !worldChart.isDisposed()) worldChart.resize()
}

onMounted(() => {
  // v2 是在 created 里 push 的，效果一样：把 areaOption 写进地址栏
  void router.push({ path: route.path, query: { areaOption: 0 } })
  window.addEventListener('resize', handleMapResize)
})

onBeforeUnmount(() => {
  // v2 用匿名函数 addEventListener 且从不移除，这里必须收干净，否则切页后仍在 resize 已销毁的图
  window.removeEventListener('resize', handleMapResize)
  chinaChart?.dispose()
  worldChart?.dispose()
  chinaChart = null
  worldChart = null
})

defineExpose({ getAreaProvince })
</script>

<template>
  <div v-loading="loadingRefresh" class="area_container public-hoverItem">
    <div style="width: 100%; position: relative">
      <el-tabs v-model="activeMap" @tab-click="handleClick">
        <el-tab-pane label="按省份" name="province">
          <div style="display: flex">
            <div class="mapCharts" style="position: relative">
              <!-- 指标 -->
              <div style="position: absolute; left: 0">
                <div
                  style="
                    display: flex;
                    border: 1px solid #acb2ba;
                    border-radius: 4px;
                    align-items: center;
                    height: 30px;
                    margin-left: 50px;
                  "
                >
                  <div style="font-size: 11px; color: #4d4d4d; padding-left: 6px">指标:</div>
                  <el-select
                    v-model="hostValue"
                    class="appli_select appli-select-style"
                    placeholder="请选择指标"
                    size="small"
                    style="width: 130px; z-index: 1"
                  >
                    <el-option
                      v-for="item in hostList"
                      :key="item.value"
                      :label="item.label"
                      :value="item.value"
                      @click="handleChangeProject(item)"
                    />
                  </el-select>
                </div>
              </div>
              <!-- 中国地图容器（GeoJSON 由 ensureGeoMap 注册） -->
              <div
                id="echart_china"
                style="width: 50vw; height: 400px; position: relative"
              ></div>
            </div>
            <div class="mapTable">
              <div
                style="
                  width: 500px;
                  min-height: 400px;
                  margin-top: 30px;
                  overflow: hidden;
                  margin-bottom: 30px;
                "
              >
                <el-table
                  class="public-radius"
                  height="400"
                  :header-cell-style="{
                    textAlign: 'center',
                    background: '#f7fafe  ',
                  }"
                  :cell-style="{ textAlign: 'center' }"
                  border
                  :data="apiProvinceList"
                  highlight-current-row
                  style="width: 100%"
                >
                  <el-table-column type="index" width="80" />
                  <el-table-column
                    show-overflow-tooltip
                    property="province"
                    label="省份"
                    width="200"
                  />
                  <el-table-column :property="labelProperty" :label="hostValue" />

                  <el-table-column
                    :property="rateProperty"
                    :formatter="dateFormat"
                    label="占比"
                  />
                </el-table>
              </div>
            </div>
          </div>
        </el-tab-pane>
        <el-tab-pane label="按国家" name="country">
          <!-- 世界地图容器（GeoJSON 由 ensureGeoMap 注册） -->
          <div id="world_chart" style="width: 70vw; height: 400px; margin-left: 5vw"></div>
        </el-tab-pane>
      </el-tabs>
      <div
        style="
          margin-top: 15px;
          font-size: 13px;
          position: absolute;
          right: 50px;
          top: 11px;
        "
      >
        {{ copyRight }} uses the lP2Location LlTE database for
        <a
          href="https://lite.ip2location.com"
          target="_blank"
          style="cursor: pointer; color: #2c7be5"
          >lP geolocation</a
        >
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
// v2 这里是 ::v-deep { @import "~@/styles/components/custom-select.scss"; ... }
// custom-select.scss 已在 v3 styles/index.scss 全局引入，其余规则改写成 :deep()
:deep(.el-tabs__header) {
  background-color: #f9fafd;
  margin: 0 0;
  border-radius: 6px 6px 0 0;
}

:deep(.el-tabs__item.is-active) {
  background-color: #fff;
  border-radius: 6px 0 0 0;
}

:deep(.el-tabs__nav-wrap::after) {
  background-color: #fff;
}

:deep(.el-tabs__item) {
  padding: 0 0;
  width: 130px;
  height: 65px;
  line-height: 65px;
  text-align: center;
  font-size: 15px;
  font-weight: bold;
  color: #4d4d4d;
}

.area_container {
  background-color: #fff;
  min-height: 470px;
  margin-bottom: 20px;

  .mapCharts {
    width: 50%;
    padding-top: 17px;
    padding-left: 18px;
  }

  .mapTable {
    width: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .search_table {
    height: 100%;
    padding: 18px 22px;

    span {
      font-size: 13px;
      font-weight: 500;
      line-height: 31px;
      color: #4d4d4d;
    }
  }
}
</style>
