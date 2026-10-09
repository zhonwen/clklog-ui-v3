<script setup lang="ts">
/**
 * 地域分析-省份下钻弹窗（v2 views/visitor-analysis/custom-dialog/regional.vue）。
 *
 * 弹窗内的筛选条用 @/layout/components 的 dialogBar（对应 v2 filterBar/dialogBar.vue），
 * 父组件调 openingEvent 之后由 dialogbarEvent 把外层条件同步进来，再 emit 回 setFilterBarParams。
 */
import { computed, getCurrentInstance, nextTick, ref, watch } from 'vue'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'
import { percentage, averageRules } from '@/utils/percent'
import flowPoint from '@/components/flowPoint/index.vue'
import contrastFlow from '@/components/contrastFlow/index.vue'
import { dialogBar } from '@/layout/components'
import { copyObj } from '@/utils/copy'
import { useChart } from '@/composables/useChart'
import { useLatestOnly } from '@/composables/useLatestOnly'
import { useTrackingStore } from '@/stores/tracking'
import { getAreaDetailTotalApi, getAreaDetailCityListApi } from '@/api/trackingapi/area'
import dataV from '@/utils/dataV.json'

interface CityRow {
  city?: string
  visitCount?: number
  visitCountRate?: number
  pv?: number
  pvRate?: number
  uv?: number
  newUv?: number
  newUvRate?: number
  ipCount?: number
  avgPv?: number
  avgVisitTime?: number
  bounceRate?: number
  [key: string]: unknown
}

interface MapCity {
  name: string
  value: number | undefined
  visitCountRate: number | string
}

const { provinceCode } = dataV

/**
 * 复刻 v2 src/filters/index.js 的 formatTimeTable 过滤器：
 * 与 formatTime 同样的 Math.floor + 时分秒拼装，只是 falsy 返回 0 而不是 '--'。
 */
function formatTimeTableFilter(seconds: unknown): string | number {
  if (seconds) {
    const total = Math.floor(Number(seconds))
    const hours = Math.floor(total / 3600)
    const minutes = Math.floor((total - hours * 3600) / 60)
    const rest = total - hours * 3600 - minutes * 60
    const pad = (n: number) => (n < 10 ? `0${n}` : String(n))
    return `${pad(hours)}:${pad(minutes)}:${pad(rest)}`
  }
  return 0
}

const proxy = getCurrentInstance()?.proxy
const trackingStore = useTrackingStore()

const { elRef: areaCityMapRef, init: initAreaMap, setOption: setAreaMapOption } = useChart()
const { next: nextTotal, isLatest: isLatestTotal } = useLatestOnly()
const { next: nextCity, isLatest: isLatestCity } = useLatestOnly()

const originViewRef = ref<{
  originEvent: (val: unknown, flag?: number | boolean | null) => void
} | null>(null)
const dialogBarRef = ref<{
  dialogbarEvent: (commonParams: Record<string, unknown>) => void
  clearEvent: () => void
} | null>(null)

const loadingRefresh = ref(false)
const loadingSecond = ref(false)
const newProvince = ref<string | null>('')
const flowTableList = ref<CityRow[]>([])

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
const total = ref(0)
const pageSize = ref(10)

const current = ref<{ sortName: string | null; sortOrder: string | null }>({
  sortName: '',
  sortOrder: '',
})

const centerDialogVisible = ref(false)
const regionalList = ref<{ province?: string }>({})
const dateFlag = ref<number | null>(null)
const filterBarParams = ref<Record<string, unknown>>({})
const mapTableTop10 = ref<CityRow[]>([])
const openMapLable = ref(true)
// 与 v2 一致：v2 在 watch 里写了 flagApi，但整个组件都没有读过它
const flagApi = ref<string | null>(null)

const commonParams = computed<Record<string, unknown>>(() => ({
  projectName: trackingStore.projectName,
  ...filterBarParams.value,
}))

// 模板里不重复调用 slice，预算成 computed
const pagedFlowTableList = computed(() =>
  flowTableList.value.slice(
    (currentPage.value - 1) * pageSize.value,
    currentPage.value * pageSize.value,
  ),
)

// 弹框清空事件
function closeEvent() {
  newProvince.value = null
  // this.$refs.dialogBar.clearEvent();
}

function getIndex($index: number) {
  return (currentPage.value - 1) * pageSize.value + $index + 1
}

function averageRulesEvent(num: number | undefined) {
  return averageRules(num)
}

function percentageFun(val: unknown) {
  if (val == 0) {
    return 0
  } else {
    return percentage(val as number)
  }
}

function ascDscEvent() {
  const nameAttr = current.value.sortName
  if (nameAttr && current.value.sortOrder === 'ascending') {
    flowTableList.value = flowTableList.value.sort(function (a, b) {
      return Number(a[nameAttr]) - Number(b[nameAttr])
    })
  } else if (nameAttr && current.value.sortOrder === 'descending') {
    flowTableList.value = flowTableList.value.sort(function (a, b) {
      return Number(b[nameAttr]) - Number(a[nameAttr])
    })
  }
}

function sortChange(e: { prop?: string | null; order?: string | null }) {
  if (e.order && e.order == 'ascending') {
    // 降序
    current.value.sortName = e.prop ?? null
    current.value.sortOrder = 'ascending'
  } else if (e.order && e.order == 'descending') {
    // 升序
    current.value.sortName = e.prop ?? null
    current.value.sortOrder = 'descending'
  } else {
    current.value.sortName = null
    current.value.sortOrder = null
  }
  // 与 v2 一致（v2 此处逻辑存疑：有一句空的 if (this.current.sortName == "statTime") {}）
  ascDscEvent()
}

function handleSizeChange(val: number) {
  currentPage.value = 1
  pageSize.value = val
}

function handleCurrentChange(val: number) {
  currentPage.value = val
}

// 复杂表格处理
function flowPointEvent(val: string[]) {
  if (val) {
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

function filterMapCode(mapCode: string | number): string | undefined {
  switch (mapCode) {
    case 710000:
      return '台湾省'
    case 810000:
      return '香港特别行政区'
    case 820000:
      return '澳门特别行政区'
    case 310000:
      return '上海市'
    case 110000:
      return '北京市'
    case 120000:
      return '天津市'
    case 500000:
      return '重庆市'
  }
  // 与 v2 一致（v2 此处逻辑存疑：switch 没有 default，其它 adcode 会返回 undefined）
  return undefined
}

// 海口市关闭 lable
function filterMapLable(mapCode: string | number) {
  if (mapCode == '460000_full') {
    openMapLable.value = false
  } else {
    openMapLable.value = true
  }
}

function mapContainerEvent(data: unknown, cityList: MapCity[], maxValue: number) {
  // 这里的地图数据是运行时从 geo.datav.aliyun.com 拉回来的 GeoJSON，
  // 不依赖 echarts 内置地图，echarts 6 下 registerMap 照常可用
  echarts.registerMap('cityCode', data as Parameters<typeof echarts.registerMap>[1])
  const option: EChartsOption = {
    visualMap: {
      min: 0,
      max: maxValue,
      realtime: false,
      calculable: true,
      inRange: {
        // color: ["lightskyblue", "yellow", "orangered"],
        color: ['#fff', '#2c7be5'],
      },
    },
    grid: {
      top: 0,
      left: '0%',

      containLabel: true,
    },
    /*
     * v2 这里有一个 `geo: { aspectScale: 0.75, zoom: 1.1 }`，**故意不迁**：
     * 它没有 map 属性。echarts 4 遇到这种 geo 只打一条 "Map not exists" 警告就跳过，
     * 所以 aspectScale / zoom 在 v2 里根本没生效，图是 series(type:"map") 按默认参数画的。
     * echarts 6 则会直接抛 TypeError（getFilledRegions 读 undefined.regions），
     * setOption 整个中断 —— 表现就是「弹框里的省份地图一片空白」。
     * 补 map:"cityCode" 会让 aspectScale/zoom 真的生效并多画一层，反而和 v2 不一样；
     * 直接删掉才是与 v2 渲染结果等价的写法。
     */
    tooltip: {
      formatter: (params: unknown) => {
        const p = params as { name?: string; value?: unknown; data?: { visitCountRate?: unknown } }
        let visitCountRate: unknown = 0
        if (p.data) {
          visitCountRate = p.data.visitCountRate
        }
        const htmlStr = `
              <div style="padding:10px;">
                <div style='font-size:14px;'> ${String(p.name ?? '')}</div>
                <p style='text-align:left;margin-top:10px;'>
                  访问次数：${String(p.value ?? 0)}<br/>
                  访问占比：${percentage(visitCountRate as number)}<br/>
                </p>
              </div>
              `
        return htmlStr
      },
    },
    series: [
      {
        name: '地图',
        type: 'map',
        map: 'cityCode',
        label: {
          show: openMapLable.value,
          // v2 是 label.textStyle.fontSize/position，echarts 5+ 已移除 textStyle，平铺到 label 上
          fontSize: 8,
          position: 'insideTop',
        },

        data: cityList,
      },
    ],
  }
  // el-dialog 的内容是懒渲染的，onMounted 时容器还不存在，所以在有数据时再 init
  initAreaMap()
  setAreaMapOption(option, true)
}

function fetchDataVApi(rows: { province?: string }, list: CityRow[]) {
  let mapCode: string | number = '450000_full'
  const province = rows.province ?? ''
  provinceCode.forEach((item) => {
    if (item.name == province || province.includes(item.name)) {
      if (
        item.name == '台湾' ||
        item.name == '香港' ||
        item.name == '澳门' ||
        item.name == '北京' ||
        item.name == '天津' ||
        item.name == '重庆' ||
        item.name == '上海'
      ) {
        mapCode = item.adcode
        return
      }
      mapCode = item.adcode + '_full'
    }
  })
  const cityList: MapCity[] = []
  const maxList: number[] = []
  list.forEach((item) => {
    let params: MapCity
    // 方式二 台湾记录总数
    if (
      mapCode == 710000 ||
      mapCode == 810000 ||
      mapCode == 820000 ||
      mapCode == 110000 ||
      mapCode == 120000 ||
      mapCode == 500000 ||
      mapCode == 310000
    ) {
      params = {
        // name: "台湾省",
        name: filterMapCode(mapCode) ?? '',
        value: item.visitCount,
        visitCountRate: '1',
      }
    } else {
      params = {
        name: item.city + '市',
        value: item.visitCount,
        visitCountRate: item.visitCountRate || 0,
      }
    }
    cityList.push(params)
    maxList.push(item.visitCount ?? 0)
  })
  const maxValue =
    maxList.sort(function (a, b) {
      return b - a
    })[0] || 200

  void fetch(`https://geo.datav.aliyun.com/areas_v3/bound/${mapCode}.json`)
    .then((response) => response.json())
    .then((data) => {
      filterMapLable(mapCode)
      mapContainerEvent(data, cityList, maxValue)
    })
    .catch(() => {
      /* 地图数据拉取失败时静默，保持与 v2 一致（v2 没有 catch，只是会抛未处理的 rejection） */
    })
}

function getCityDetail() {
  loadingSecond.value = true
  const params = copyObj(commonParams.value) as Record<string, unknown>
  params.pageSize = 10
  params.pageNum = 1
  if (newProvince.value) {
    params.province = newProvince.value
  } else {
    params.province = regionalList.value.province
  }
  if (!params.province) return
  const token = nextCity()
  getAreaDetailCityListApi(params)
    .then((res) => {
      if (!isLatestCity(token)) return
      if (res?.code != 200) return
      loadingSecond.value = false
      const data = (res.data as CityRow[]) || []
      mapTableTop10.value = data.slice(0, 10)
      flowTableList.value = data
      total.value = data.length
      fetchDataVApi(params as { province?: string }, data)
    })
    .catch(() => {
      if (!isLatestCity(token)) return
      loadingSecond.value = false
    })
}

function totalApiEvent() {
  loadingRefresh.value = true
  const params = copyObj(commonParams.value) as Record<string, unknown>
  if (newProvince.value) {
    params.province = [newProvince.value]
  } else {
    params.province = [regionalList.value.province]
  }
  const token = nextTotal()
  getAreaDetailTotalApi(params)
    .then((res) => {
      if (!isLatestTotal(token)) return
      loadingRefresh.value = false
      if (res?.code != 200) return
      void nextTick(() => {
        originViewRef.value?.originEvent(res.data, dateFlag.value)
      })
      getCityDetail()
      loadingRefresh.value = false
    })
    .catch(() => {
      if (!isLatestTotal(token)) return
      // 【有意偏离 v2】v2 这里把 loadingRefresh 置成了 true（疑似笔误），报错后遮罩不会消失
      loadingRefresh.value = false
    })
}

function setFilterBarParams(val: Record<string, unknown>, flag: number | null) {
  filterBarParams.value = copyObj(val)
  dateFlag.value = flag
}

function openingEvent(rows: { province?: string }, parentParams: Record<string, unknown>) {
  centerDialogVisible.value = true
  regionalList.value = rows
  void nextTick(() => {
    const params = copyObj(parentParams) as Record<string, unknown>
    params.province = [rows.province]
    dialogBarRef.value?.dialogbarEvent(params)
  })
}

watch(commonParams, (val) => {
  const province = val.province
  if (Array.isArray(province) && province.length > 0) {
    newProvince.value = String(province[0])
  }
  totalApiEvent()
  flagApi.value = localStorage.getItem('timeFlag')
})

defineExpose({ openingEvent })
</script>

<template>
  <div>
    <el-dialog v-model="centerDialogVisible" width="70%" top="1vh" @close="closeEvent">
      <div style="min-height: 900px">
        <div
          style="
            border-radius: 6px 6px 0px 0px;
            height: 44px;
            background: #fbfcfe;
          "
        >
          <div
            style="
              font-size: 16px;
              font-weight: bold;
              line-height: 44px;
              margin-left: 16px;
              color: #4d4d4d;
            "
          >
            {{ newProvince || regionalList.province }}
          </div>
        </div>

        <!-- body -->
        <div style="padding: 16px; box-sizing: border-box">
          <!-- 筛选头部 -->
          <div
            class="public-hoverItem"
            style="
              height: 100px;
              width: 100%;
              background-color: #fbfcfe;
              border-radius: 6px;
            "
          >
            <dialogBar ByArea ref="dialogBarRef" @set-filter-bar-params="setFilterBarParams" />
          </div>
          <!-- 流量概览 -->
          <div
            v-loading="loadingRefresh"
            class="public-hoverItem"
            style="
              height: 151px;
              background-color: #fbfcfe;
              margin-top: 16px;
              border-radius: 6px;
            "
          >
            <div class="public-firstHead" style="padding: 15px">流量概览</div>
            <contrastFlow ref="originViewRef" byAreaAnaly />
          </div>
          <!--  城市区域图例 -->
          <div
            v-loading="loadingSecond"
            class="public-hoverItem"
            style="
              width: 100%;
              min-height: 450px;
              background-color: #fbfcfe;
              margin: 16px 0;
              padding: 16px;
              box-sizing: border-box;
              display: flex;
            "
          >
            <div style="width: 50%; height: 560px">
              <div class="public-firstHead">地域分布图</div>
              <div ref="areaCityMapRef" style="width: 100%; height: 500px"></div>
            </div>
            <div class="mapTable">
              <div
                style="
                  width: 500px;
                  height: 410px;
                  margin-top: 30px;
                  overflow: hidden;
                  margin-bottom: 30px;
                "
              >
                <el-table
                  class="public-radius"
                  :data="mapTableTop10"
                  highlight-current-row
                  border
                  :header-cell-style="{
                    textAlign: 'center',
                    background: '#f7fafe  ',
                  }"
                  :cell-style="{ textAlign: 'center' }"
                  style="width: 100%"
                >
                  <el-table-column
                    type="index"
                    :width="proxy?.$fixedWidth.FwIndex"
                    label="序号"
                  />
                  <el-table-column
                    show-overflow-tooltip
                    property="city"
                    label="地级市"
                    width="200"
                  />
                  <el-table-column property="visitCount" label="访问次数" />
                  <el-table-column label="占比">
                    <template #default="{ row }">
                      {{ percentage(row.visitCountRate) }}
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </div>
          </div>
          <!-- 复杂表格展示与隐藏事件 -->
          <div
            v-loading="loadingSecond"
            class="public-hoverItem"
            style="
              min-height: 488px;
              background-color: #fbfcfe;
              padding: 25px 16px;
              box-sizing: border-box;
            "
          >
            <div class="public-firstHead">地域分布图</div>
            <flowPoint @flow-point="flowPointEvent" />
            <div>
              <el-table
                class="public-radius"
                :header-cell-style="{
                  textAlign: 'center',
                  background: '#f7fafe ',
                }"
                :cell-style="{ textAlign: 'center' }"
                :data="pagedFlowTableList"
                border
                style="width: 100%"
                @sort-change="sortChange($event)"
              >
                <el-table-column label="序号" type="index" width="80" align="center">
                  <template #default="scope">
                    <span v-text="getIndex(scope.$index)"> </span>
                  </template>
                </el-table-column>
                <el-table-column prop="city" label="地级市" />
                <el-table-column prop="date" label="流量基础指标" width="150">
                  <el-table-column v-if="pv" prop="pv" label="浏览量" sortable="custom" />
                  <el-table-column
                    v-if="pvRate"
                    prop="pvRate"
                    label="浏览量占比"
                    sortable="custom"
                  >
                    <template #default="scope">
                      {{ percentageFun(scope.row.pvRate) }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="visitCount"
                    prop="visitCount"
                    label="访问次数"
                    sortable="custom"
                  />
                  <el-table-column v-if="uv" prop="uv" label="访客数" sortable="custom" />
                  <el-table-column
                    v-if="newUv"
                    prop="newUv"
                    label="新访客数"
                    sortable="custom"
                  />
                  <el-table-column
                    v-if="newUvRate"
                    prop="newUvRate"
                    label="新访客数占比"
                    sortable="custom"
                  >
                    <template #default="scope">
                      {{ percentageFun(scope.row.newUvRate) }}
                    </template>
                  </el-table-column>

                  <el-table-column
                    v-if="ipCount"
                    prop="ipCount"
                    label="IP数"
                    sortable="custom"
                  />
                </el-table-column>
                <el-table-column prop="date" label="流量质量指标" width="150">
                  <el-table-column
                    v-if="bounceRate"
                    prop="bounceRate"
                    label="跳出率"
                    sortable="custom"
                  >
                    <template #default="scope">
                      {{ percentageFun(scope.row.bounceRate) }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="avgVisitTime"
                    label="平均访问时长"
                    sortable="custom"
                    prop="avgVisitTime"
                  >
                    <template #default="scope">
                      {{ formatTimeTableFilter(scope.row.avgVisitTime) }}
                    </template>
                  </el-table-column>
                  <el-table-column
                    v-if="avgPv"
                    prop="avgPv"
                    label="平均访问页数"
                    sortable="custom"
                  >
                    <template #default="scope">
                      {{ averageRulesEvent(scope.row.avgPv) }}
                    </template>
                  </el-table-column>
                </el-table-column>
              </el-table>
              <div class="block">
                <el-pagination
                  next-text="下一页"
                  :current-page="currentPage"
                  :page-sizes="[10, 20, 30, 40]"
                  :page-size="pageSize"
                  layout="total, sizes, prev, pager, next, jumper"
                  :total="total"
                  @size-change="handleSizeChange"
                  @current-change="handleCurrentChange"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
// v2 这里是 ::v-deep { @import el-checkbox.scss; @import el-pagination.scss }
// el-checkbox.scss 在 v3 里每条规则已写成 :deep(...)，只能在 scoped 块顶部 @use；
// el-pagination.scss 已全局引入，不再重复
@use '@/styles/components/el-checkbox.scss';

:deep(.el-dialog) {
  border-radius: 6px;
}

:deep(.el-dialog__headerbtn) {
  top: 15px;
}

:deep(.el-dialog__header) {
  padding: 0 !important;
  border-radius: 6px;
}

:deep(.el-dialog__body) {
  padding: 0;
  background-color: #eef4fd;
  border-radius: 6px;
}

.setSpace {
  margin-bottom: 8px;
  margin-left: 25px;
}

.setBody {
  margin-bottom: 8px;
}

.mapTable {
  width: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
