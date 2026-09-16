<script setup lang="ts">
/**
 * 地域（省 -> 地级市）详情弹窗（对应 v2 views/access-analysis/custom-dialog/regional.vue）。
 *
 * 说明：v2 里真正被地域分析页引用的是 views/visitor-analysis/custom-dialog/regional.vue，
 * access-analysis 下的这一份是更早的副本、没有任何引用点。这里按要求按 v2 原样迁移，
 * 逻辑以 access-analysis 这一份为准（不掺入 visitor-analysis 那份后来加的直辖市/台港澳特判）。
 *
 * 父组件通过 ref 调 openingEvent(row, commonParams)。
 */
import { computed, getCurrentInstance, nextTick, ref, watch } from 'vue'
import * as echarts from 'echarts'
import { percentage, averageRules } from '@/utils/percent'
import flowPoint from '@/components/flowPoint/index.vue'
import { dialogBar } from '@/layout/components'
import { copyObj } from '@/utils/copy'
import contrastFlow from '@/components/contrastFlow/index.vue'
import { getAreaDetailTotalApi, getAreaDetailCityListApi } from '@/api/trackingapi/area'
import dataV from '@/utils/dataV.json'
import { useTrackingStore } from '@/stores/tracking'
import { useChart } from '@/composables/useChart'
import { useLatestOnly } from '@/composables/useLatestOnly'

const proxy = getCurrentInstance()?.proxy
const trackingStore = useTrackingStore()
const totalLatest = useLatestOnly()
const cityLatest = useLatestOnly()
const { elRef, init, setOption } = useChart()

const provinceCode = (dataV as { provinceCode: { name: string; adcode: number }[] }).provinceCode

interface CityRow {
  city?: string
  visitCount?: number
  visitCountRate?: number
  pvRate?: number
  newUvRate?: number
  bounceRate?: number
  avgVisitTime?: number
  avgPv?: number
  [key: string]: unknown
}
interface RegionalRow {
  province?: string
  [key: string]: unknown
}
interface MapPoint {
  name: string
  value: number
  visitCountRate: number | string
}

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
const regionalList = ref<RegionalRow>({})
const dateFlag = ref<number | null>(null)
const filterBarParams = ref<Record<string, unknown>>({})
const mapTableTop10 = ref<CityRow[]>([])
const flagApi = ref<string | null>(null)

const dialogBarRef = ref<{
  dialogbarEvent: (commonParams: Record<string, unknown>) => void
  clearEvent: () => void
} | null>(null)
const originViewRef = ref<{
  originEvent: (val: unknown, flag?: number | boolean | null) => void
} | null>(null)

const projectName = computed(() => trackingStore.projectName)
const commonParams = computed<Record<string, unknown>>(() =>
  Object.assign({ projectName: projectName.value }, filterBarParams.value),
)

// 模板里原本写了两次 slice，抽成 computed
const pagedFlowTableList = computed(() =>
  flowTableList.value.slice(
    (currentPage.value - 1) * pageSize.value,
    currentPage.value * pageSize.value,
  ),
)

/** v2 filters/index.js 的 toFixedPoint */
function toFixedPoint(s?: number | string) {
  if (s == 100) return '100%'
  if (s) return (Number(s) * 1).toFixed(2) + '%'
  return 0 + '%'
}

/**
 * v2 模板里的 `| formatTimeTable`（filters 版：先判真值，再 Math.floor，falsy 返回数字 0）。
 * utils/format 里的 formatTime falsy 返回的是 '--'，语义不同，所以这里单写一份。
 */
function formatTimeTable(seconds?: number): string | number {
  if (!seconds) return 0
  const s = Math.floor(Number(seconds))
  const hours = Math.floor(s / 3600)
  const minutes = Math.floor((s - hours * 3600) / 60)
  const rest = s - hours * 3600 - minutes * 60
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n))
  return `${pad(hours)}:${pad(minutes)}:${pad(rest)}`
}

function getIndex(index: number) {
  return (currentPage.value - 1) * pageSize.value + index + 1
}

/** v2 用的是 @/utils/percent 的 averageRules（小数点后四位不为 0 才进位），不是 filters 里那个 */
function averageRulesEvent(num?: number) {
  return averageRules(num)
}

function percentageFun(val?: number) {
  if (val == 0) {
    return 0
  } else {
    return percentage(val)
  }
}

function ascDscEvent() {
  const nameAttr = current.value.sortName
  if (nameAttr && current.value.sortOrder === 'ascending') {
    flowTableList.value = flowTableList.value.sort(
      (a, b) => Number(a[nameAttr]) - Number(b[nameAttr]),
    )
  } else if (nameAttr && current.value.sortOrder === 'descending') {
    flowTableList.value = flowTableList.value.sort(
      (a, b) => Number(b[nameAttr]) - Number(a[nameAttr]),
    )
  }
}

function sortChange(e: { prop?: string | null; order?: string | null }) {
  if (e.order && e.order == 'ascending') {
    // 降序
    current.value.sortName = e.prop || null
    current.value.sortOrder = 'ascending'
  } else if (e.order && e.order == 'descending') {
    // 升序
    current.value.sortName = e.prop || null
    current.value.sortOrder = 'descending'
  } else {
    current.value.sortName = null
    current.value.sortOrder = null
  }
  // 与 v2 一致（v2 此处逻辑存疑：这里有个空的 `if (this.current.sortName == "statTime") {}`）
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

function mapContainerEvent(data: unknown, cityList: MapPoint[], maxValue: number) {
  echarts.registerMap('cityCode', data as Parameters<typeof echarts.registerMap>[1])
  init()
  setOption(
    {
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
        formatter(params: unknown) {
          const p = params as { name?: string; value?: number; data?: MapPoint }
          let visitCountRate: number | string = 0
          if (p.data) {
            visitCountRate = p.data.visitCountRate
          }
          const htmlStr = `
              <div style="padding:10px;">
                <div style='font-size:14px;'> ${p.name}</div>
                <p style='text-align:left;margin-top:10px;'>
                  访问次数：${p.value || 0}<br/>
                  访问占比：${visitCountRate || 0}<br/>
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
            show: true,
            // echarts 6 里 textStyle 已展开到 label 上
            fontSize: 8,
            position: 'insideTop',
          },
          data: cityList,
        },
      ],
    },
    true,
  )
}

// 区域地图事件
function fetchDataVApi(rows: Record<string, unknown>, list: CityRow[]) {
  let mapCode = '450000_full'
  const rowProvince = String(rows.province ?? '')
  provinceCode.map((item) => {
    if (item.name == rowProvince || rowProvince.includes(item.name)) {
      mapCode = item.adcode + '_full'
      return
    }
  })
  const cityList: MapPoint[] = []
  const maxList: number[] = []
  list.map((item) => {
    cityList.push({
      name: item.city + '市',
      value: Number(item.visitCount),
      visitCountRate: item.visitCountRate || 0,
    })
    maxList.push(Number(item.visitCount))
  })
  const maxValue = maxList.sort((a, b) => b - a)[0] || 200
  void fetch(`https://geo.datav.aliyun.com/areas_v3/bound/${mapCode}.json`)
    .then((response) => response.json())
    .then((data) => {
      mapContainerEvent(data, cityList, maxValue)
    })
}

function getCityDetail() {
  const params = copyObj(commonParams.value)
  params.pageSize = 10
  params.pageNum = 1
  if (newProvince.value) {
    params.province = newProvince.value
  } else {
    params.province = regionalList.value.province
  }
  const token = cityLatest.next()
  void getAreaDetailCityListApi(params).then((res) => {
    if (!cityLatest.isLatest(token)) return
    if (res?.code == 200) {
      const rows = (res.data as CityRow[]) || []
      mapTableTop10.value = rows.slice(0, 10)
      flowTableList.value = rows
      total.value = rows.length
      void nextTick(() => {
        fetchDataVApi(params, rows)
      })
    }
  })
}

function totalApiEvent() {
  const params = copyObj(commonParams.value)
  if (newProvince.value) {
    params.province = [newProvince.value]
  } else {
    params.province = [regionalList.value.province]
  }
  const token = totalLatest.next()
  void getAreaDetailTotalApi(params).then((res) => {
    if (!totalLatest.isLatest(token)) return
    if (res?.code == 200) {
      originViewRef.value?.originEvent(res.data, dateFlag.value)
      getCityDetail()
    }
  })
}

/** 父组件通过 ref 调用 */
function openingEvent(rows: RegionalRow, params: Record<string, unknown>) {
  centerDialogVisible.value = true
  regionalList.value = rows
  if (flagApi.value == localStorage.getItem('timeFlag')) {
    totalApiEvent()
  }
  void nextTick(() => {
    dialogBarRef.value?.dialogbarEvent(params)
  })
}

// 弹框清空事件
function closeEvent() {
  newProvince.value = null
  dialogBarRef.value?.clearEvent()
}

function setFilterBarParams(val: Record<string, unknown>, flag: number | null) {
  filterBarParams.value = copyObj(val)
  dateFlag.value = flag
}

watch(commonParams, (val) => {
  // 与 v2 一致：v2 直接读 val.province.length（ByArea 时 dialogBar 一定会带 province）
  const provinceArr = val.province
  if (Array.isArray(provinceArr) && provinceArr.length > 0) {
    newProvince.value = String(provinceArr[0])
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
        <div style="border-radius: 6px 6px 0px 0px; height: 44px; background: #fbfcfe">
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
            style="height: 100px; width: 100%; background-color: #fbfcfe; border-radius: 6px"
          >
            <dialogBar ref="dialogBarRef" ByArea @set-filter-bar-params="setFilterBarParams" />
          </div>
          <!-- 流量概览 -->
          <div
            class="public-hoverItem"
            style="
              height: 151px;
              background-color: #fbfcfe;
              margin-top: 16px;
              border-radius: 6px;
            "
          >
            <div class="public-firstHead" style="padding: 15px">流量概览</div>
            <contrastFlow ref="originViewRef" by-area-analy />
          </div>
          <!--  城市区域图例 -->
          <div
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
              <div id="areaCityMap" ref="elRef" style="width: 100%; height: 500px" />
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
                  ref="singleTable"
                  class="public-radius"
                  :data="mapTableTop10"
                  highlight-current-row
                  border
                  :header-cell-style="{ textAlign: 'center', background: '#f7fafe  ' }"
                  :cell-style="{ textAlign: 'center' }"
                  style="width: 100%"
                >
                  <el-table-column type="index" :width="proxy?.$fixedWidth.FwIndex" label="序号" />
                  <el-table-column show-overflow-tooltip property="city" label="地级市" width="200" />
                  <el-table-column property="visitCount" label="访问次数" />
                  <el-table-column label="占比">
                    <template #default="{ row }">
                      {{ toFixedPoint(row.visitCountRate) }}
                    </template>
                  </el-table-column>
                </el-table>
              </div>
            </div>
          </div>
          <!-- 复杂表格展示与隐藏事件 -->
          <div
            class="public-hoverItem"
            style="
              min-height: 488px;
              background-color: #fbfcfe;
              padding: 25px 16px;
              box-sizing: border-box;
            "
          >
            <div class="public-firstHead">地域分布图</div>
            <flowPoint ref="flowPointClear" @flow-point="flowPointEvent" />
            <div>
              <el-table
                class="public-radius"
                :header-cell-style="{ textAlign: 'center', background: '#f7fafe ' }"
                :cell-style="{ textAlign: 'center' }"
                :data="pagedFlowTableList"
                border
                style="width: 100%"
                @sort-change="sortChange($event)"
              >
                <el-table-column label="序号" type="index" width="80" align="center">
                  <template #default="scope">
                    <span>{{ getIndex(scope.$index) }}</span>
                  </template>
                </el-table-column>
                <el-table-column prop="city" label="地级市" />
                <el-table-column prop="date" label="流量基础指标" width="150">
                  <el-table-column v-if="pv" prop="pv" label="浏览量" sortable="custom" />
                  <el-table-column v-if="pvRate" prop="pvRate" label="浏览量占比" sortable="custom">
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
                  <el-table-column v-if="newUv" prop="newUv" label="新访客数" sortable="custom" />
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

                  <el-table-column v-if="ipCount" prop="ipCount" label="IP数" sortable="custom" />
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
                      {{ formatTimeTable(scope.row.avgVisitTime) }}
                    </template>
                  </el-table-column>
                  <el-table-column v-if="avgPv" prop="avgPv" label="平均访问页数" sortable="custom">
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
// v2 是在 ::v-deep {} 里 @import 的，v3 的 @use 不能出现在嵌套块内，只能放在样式块顶部
@use '@/styles/components/el-checkbox.scss';
// v2 这里还 @import 了 el-pagination.scss，v3 已在 styles/index.scss 全局引入，不再重复引

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
