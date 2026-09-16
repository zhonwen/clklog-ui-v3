<script setup lang="ts">
/**
 * 分群详情弹窗（对应 v2 views/ups/usergroup/components/group-detail-dialog.vue）。
 *
 * 两个 tab：
 *   people  → 分群人数分布（只显示覆盖人数 / 基准时间，v2 把分布柱状图那块注释掉了）
 *   history → 分群历史详情（按天堆叠柱状图 + 历史用户列表）
 */
import { computed, nextTick, ref } from 'vue'
import type { CSSProperties } from 'vue'
import { ElMessage } from 'element-plus'
import type { TabsPaneContext } from 'element-plus'
import type { EChartsOption } from 'echarts'
import { Download, DocumentCopy, Search, View } from '@element-plus/icons-vue'
import taskCenter from '@/views/ups/components/tast-center.vue'
import {
  getGroupUserPageList,
  getHistoryDataByDay,
  getHistoryDataPageList,
  getUserDistributeStats,
  groupUserDistributeData,
  groupUserHistoryData,
} from '@/api/upsapi/usergroup'
import { formatDateHMS } from '@/utils/date'
import { openNewTab } from '@/utils/index'
import { useChart } from '@/composables/useChart'
import { useLatestOnly } from '@/composables/useLatestOnly'
import { useTrackingStore } from '@/stores/tracking'
import { disabledFutureDate, historyRangeShortcuts, todayYMD, ymdDaysAgo } from '../utils'
import type {
  DistributeItem,
  GroupRow,
  GroupUserRow,
  HistoryCheckRow,
  HistoryDayRow,
} from '../types'

const trackingStore = useTrackingStore()
/** 历史详情图（#historyLine） */
const { elRef: historyElRef, chart: historyChart, init: initHistory } = useChart()
/**
 * 分群人数分布图。
 * 与 v2 一致（v2 此处逻辑存疑：模板里根本没有 id="peopleLine" 的容器，
 * echarts.init(null) 拿到的是 null；并且调用它的 getDistributeCount / handleSort
 * 在 v2 里已经被注释掉了，这里保持不挂载容器，init 会直接 return）。
 */
const { elRef: peopleElRef, init: initPeople } = useChart()

const { next: nextUserList, isLatest: isLatestUserList } = useLatestOnly()
const { next: nextHistoryList, isLatest: isLatestHistoryList } = useLatestOnly()
const { next: nextHistoryDay, isLatest: isLatestHistoryDay } = useLatestOnly()
const { next: nextDistribute, isLatest: isLatestDistribute } = useLatestOnly()

const taskCenterRef = ref<{ openDialogTask: () => void } | null>(null)

const userId = ref('')
const distributeList = ref<DistributeItem[]>([])
const distributeLable = ref<string[]>([])
const pageSize = ref(10)
const pageNum = ref(1)
const total = ref(0)
const historydate = ref<string[]>([])
const userListDate = ref<string[]>([])
const activePrototype = ref('people')
const dialogVisible = ref(false)
const tagDetail = ref<GroupRow>({})
const historyParams = ref<{ name: string }>({ name: '' })
const userListData = ref<GroupUserRow[]>([])
const checkTableList = ref<HistoryCheckRow[]>([])
const tagHistoryList = ref<HistoryDayRow[]>([])
const historyChartData = ref<{
  legend: string[]
  xAxis: string[]
  series: Record<string, unknown>[]
}>({
  legend: [],
  xAxis: [],
  series: [],
})
const fieldsLable = ref<string[]>([])
const userLoading = ref(false)
const downLoading = ref(false)
/** v2 的 distributeList.slice(0, this.termMany)，termMany 从未定义过 → undefined，slice 取全部 */
const termMany: number | undefined = undefined

const projectName = computed(() => trackingStore.projectName)

const headerCellStyle: CSSProperties = { textAlign: 'center', background: '#f7fafe  ' }
const cellStyle: CSSProperties = { textAlign: 'center' }

const CHART_COLORS = [
  '#2c7be5',
  '#80bdef',
  '#c4ebad',
  '#85dec8',
  '#fff2ce',
  '#ffde84',
  '#4cabce',
  '#9AFF9A',
  '#7B68EE',
  '#87CEFA',
  '#E0FFFF',
  '#2E8B57',
  '#FFFFE0',
  '#E9967A',
]

/* -------------------------------------------------------------------------- */
/* 导出 / 任务中心                                                             */
/* -------------------------------------------------------------------------- */

function taskCenterEvent() {
  taskCenterRef.value?.openDialogTask()
}

function downExport() {
  downLoading.value = true
  if (activePrototype.value == 'people') {
    const params = {
      projectName: projectName.value,
      id: tagDetail.value.id,
      userId: '',
    }
    groupUserDistributeData(params)
      .then(() => {
        setTimeout(() => {
          downLoading.value = false
          taskCenterRef.value?.openDialogTask()
        }, 500)
      })
      .catch(() => {
        downLoading.value = false
      })
  } else {
    const params = {
      projectName: projectName.value,
      id: tagDetail.value.id,
      userId: '',
      startTime: historydate.value[0],
      endTime: historydate.value[1],
    }
    groupUserHistoryData(params)
      .then(() => {
        setTimeout(() => {
          downLoading.value = false
          taskCenterRef.value?.openDialogTask()
        }, 500)
      })
      .catch(() => {
        downLoading.value = false
      })
  }
}

function downLoad() {
  if (!downLoading.value) {
    downExport()
  }
}

/* -------------------------------------------------------------------------- */
/* 分群人数分布（v2 里的调用点都注释掉了，保留实现）                            */
/* -------------------------------------------------------------------------- */

function sortArrayByField(
  array: DistributeItem[],
  field: 'name' | 'count',
  order: 'asc' | 'desc' = 'asc',
) {
  return array.sort((a, b) => {
    // 根据字段名获取比较的值
    const isNumber = /^\d+(\.\d+)?$/.test(String(a[field]))
    if (isNumber) {
      const valueA = parseFloat(String(a[field]))
      const valueB = parseFloat(String(b[field]))
      if (order === 'asc') {
        return valueA - valueB
      } else if (order === 'desc') {
        return valueB - valueA
      }
      return 0
    } else {
      const valueA = String(a[field])
      const valueB = String(b[field])
      const comparison = valueA.localeCompare(valueB, 'zh-Hans-CN')
      return order === 'asc' ? comparison : -comparison
    }
  })
}

function peopleEchart() {
  const option = {
    color: CHART_COLORS,
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        lineStyle: {
          color: '#C0CADB', // 颜色
          width: 1, // 线宽
        },
      },
      formatter(params: unknown) {
        const list = (Array.isArray(params) ? params : [params]) as {
          name?: string
          value?: number | string
          data?: DistributeItem
        }[]
        const content = list
          .map((param) => {
            return `
                <div style="padding: 5px;">
                  <div style='font-size: 12px;'>${param.name}</div>
                  <p style='text-align: left; margin-top: 5px;'>
                    人数：${param.data?.count || 0}<br/>
                    占比：${param.value || 0} %<br/>
                  </p>
                </div>
              `
          })
          .join('') // 使用 join('') 将数组中的 HTML 字符串连接起来
        return `<div>${content}</div>`
      },
    },
    grid: {
      left: '3%',
      top: '3%',
      right: '12%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'value',
      axisLabel: {
        formatter: '{value} %', // X轴分群显示为百分比
      },
      axisTick: {
        show: false,
      },
      axisLine: {
        show: false,
      },
    },
    yAxis: {
      type: 'category',
      axisTick: {
        show: false,
      },
      axisLine: {
        show: false,
      },
      data: distributeLable.value,
    },
    series: [
      {
        name: '2011',
        type: 'bar',
        barWidth: 20,
        color: '#2c7be5',
        label: {
          show: true, // 显示分群
          position: 'right', // 分群位置顶部
          formatter(params: { value?: number | string; data?: DistributeItem }) {
            return `${params.value}% （${params.data?.count}人）`
          },
        },
        data: distributeList.value,
      },
    ],
  } as unknown as EChartsOption
  initPeople(option)
}

function handleSort(val: string) {
  switch (val) {
    case 'tagDesc':
      distributeList.value = sortArrayByField(distributeList.value, 'name', 'desc')
      break
    case 'tagAsc':
      distributeList.value = sortArrayByField(distributeList.value, 'name', 'asc')
      break
    case 'matchUserCountAsc':
      distributeList.value = sortArrayByField(distributeList.value, 'count', 'asc')
      break
    case 'matchUserCountDesc':
      distributeList.value = sortArrayByField(distributeList.value, 'count', 'desc')
      break
  }
  distributeLable.value = distributeList.value.map((item) => item.name)
  peopleEchart()
}

function getDistributeCount(sort?: string) {
  const token = nextDistribute()
  void getUserDistributeStats({
    projectName: projectName.value,
    id: tagDetail.value.id,
    tableName: tagDetail.value.tableName,
  }).then((res) => {
    if (!isLatestDistribute(token)) return
    if (res?.data && res.data.length > 0) {
      const data = res.data
      const totalValue = data.reduce((sum, item) => sum + Number(item.value), 0)
      distributeLable.value = []
      data.forEach((item) => {
        item.count = Number(item.value)
        item.value = ((Number(item.value) / totalValue) * 100).toFixed(2)
      })
      distributeList.value = data.slice(0, termMany)
      distributeLable.value = distributeList.value.map((item) => item.name)
      // 默认排序
      if (sort) {
        distributeList.value = sortArrayByField(distributeList.value, 'name', 'desc')
      }
    }
    void nextTick(() => {
      // this.peopleEchart();
      getGroupUserPageListApi()
    })
  })
}

/* -------------------------------------------------------------------------- */
/* 用户列表                                                                    */
/* -------------------------------------------------------------------------- */

function getGroupUserPageListApi() {
  userLoading.value = true
  const params = {
    pageSize: pageSize.value,
    pageIndex: pageNum.value,
    projectName: projectName.value,
    id: tagDetail.value.id,
    tableName: tagDetail.value.tableName,
    userId: userId.value,
  }
  const token = nextUserList()
  getGroupUserPageList(params)
    .then((res) => {
      if (!isLatestUserList(token)) return
      userLoading.value = false
      userListData.value = res?.data?.rows || []
      total.value = res?.data?.total || 0
    })
    .catch(() => {
      if (!isLatestUserList(token)) return
      userLoading.value = false
    })
}

function getPageListHistoryApi() {
  userLoading.value = true
  const params = {
    pageSize: pageSize.value,
    pageIndex: pageNum.value,
    projectName: projectName.value,
    id: tagDetail.value.id,
    startTime: userListDate.value[0],
    endTime: userListDate.value[1],
    userId: userId.value,
  }
  const token = nextHistoryList()
  getHistoryDataPageList(params)
    .then((res) => {
      if (!isLatestHistoryList(token)) return
      if (res?.data) {
        userLoading.value = false
        userListData.value = res.data.rows || []
        total.value = res.data.total || 0
      }
    })
    .catch(() => {
      if (!isLatestHistoryList(token)) return
      userLoading.value = false
    })
}

function copyRowId(id: string) {
  const textarea = document.createElement('textarea')
  textarea.value = id
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
  ElMessage.success('复制成功！')
}

function handleClick() {
  switch (activePrototype.value) {
    case 'people':
      getGroupUserPageListApi()
      break
    default:
      getPageListHistoryApi()
      break
  }
}

function handleCellClick(row: GroupUserRow) {
  openNewTab({
    name: 'userInfo',
    query: { projectName: projectName.value, userId: row.userId },
  })
}

function handleSizeChange(val: number) {
  pageNum.value = 1
  pageSize.value = val
  switch (activePrototype.value) {
    case 'people':
      getGroupUserPageListApi()
      break
    default:
      getPageListHistoryApi()
      break
  }
}

function handleCurrentChange(val: number) {
  pageNum.value = val
  switch (activePrototype.value) {
    case 'people':
      getGroupUserPageListApi()
      break
    default:
      getPageListHistoryApi()
      break
  }
}

/* -------------------------------------------------------------------------- */
/* 历史详情                                                                    */
/* -------------------------------------------------------------------------- */

function transformData(data: HistoryDayRow[], fields: string[]) {
  const result: Record<string, (string | number)[]> = {}
  // 遍历传入的字段数组
  fields.forEach((field) => {
    result[field] = data.map((item) => item[field] ?? 0)
  })
  return result
}

function calculateSumAtIndex(obj: Record<string, (string | number)[]>, index: number) {
  return Object.values(obj).reduce((sum, array) => {
    return sum + (Number(array[index]) || 0) || 0 // 如果 array[index] 是 undefined，则使用 0
  }, 0)
}

function historyEchart(xAxisList: string[], seriesList: Record<string, unknown>[]) {
  const option = {
    color: CHART_COLORS,
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        lineStyle: {
          color: '#C0CADB',
          width: 1,
        },
      },
      formatter(params: unknown) {
        const list = (Array.isArray(params) ? params : [params]) as {
          name?: string
          value?: number
          color?: string
        }[]
        let res = ''
        for (let i = 0; i < list.length; i++) {
          const p = list[i]
          if (!p) continue
          if (i == 0) {
            res += '<div>' + p.name + '</div>'
          }
          if (p.value) {
            res +=
              "<div style='display:flex;align-items:center;'>" +
              ` <div style=' width: 10px; height: 10px; border-radius: 50%;background-color: ${p.color};'>
                    </div>` +
              "<div style='margin-left:3px;'>" +
              '分群人数' +
              ' : ' +
              p.value +
              '人' +
              '</div>' +
              '</div>'
          }
        }
        return res
      },
    },
    dataZoom: [
      {
        type: 'inside',
        startValue: 0,
        endValue: 20,
        minValueSpan: 5,
        zoomOnMouseWheel: false,
        moveOnMouseWheel: true,
        moveOnMouseMove: true,
      },
    ],
    legend: {},
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      axisTick: {
        show: false,
      },
      type: 'category',
      data: xAxisList,
    },
    yAxis: {
      axisTick: {
        show: false,
      },
      axisLine: {
        show: false,
      },
      type: 'value',
    },
    // 与 v2 一致（v2 此处逻辑存疑：这里还有一段顶层 itemStyle.normal.color 回调，
    // 引用了一个既没 import 也没定义的 COLORS；顶层 itemStyle 本就不是合法的 echarts 配置，
    // 回调从未被调用过，所以这里直接省略）
    series: seriesList,
  } as unknown as EChartsOption

  initHistory(option)

  historyChart.value?.on('click', (params: unknown) => {
    // 检查点击的是不是柱状图
    const p = params as { dataIndex: number; name: string }
    const dataIndex = p.dataIndex
    checkTableList.value = []
    const series = seriesList as { name: string; data: (string | number)[] }[]
    const totalNum = series.reduce((sum, item) => sum + Number(item.data[dataIndex]), 0)
    series.forEach((item) => {
      checkTableList.value.push({
        name: item.name,
        num: item.data[dataIndex],
        rate: ((Number(item.data[dataIndex]) / totalNum) * 100).toFixed(2),
      })
    })
    historyParams.value = { name: p.name }
    userListDate.value = [p.name, p.name]
    getPageListHistoryApi()
  })
}

function initHistoryEchart() {
  historyEchart(historyChartData.value.xAxis, historyChartData.value.series)
}

function historyLazyLoad(check?: string[]) {
  let newObject: Record<string, (string | number)[]> = {}
  if (check) {
    //显示设置-->分页渲染格式
    newObject = transformData(tagHistoryList.value, check)
  } else {
    newObject = transformData(tagHistoryList.value, fieldsLable.value)
  }
  let currentIdx = 0
  const name = fieldsLable.value[0] ?? ''
  const first = newObject[name]
  if (first && first.length > 0) {
    currentIdx = first.length - 1
  }
  const sum = calculateSumAtIndex(newObject, currentIdx)
  checkTableList.value = fieldsLable.value
    .map((item) => {
      const arr = newObject[item]
      if (arr) {
        const rate = ((Number(arr[currentIdx]) / sum) * 100).toFixed(2)
        return {
          name: item,
          num: arr[currentIdx], // 取出数组中的第一个值
          rate: rate == 'NaN' ? 0 : rate,
        }
      }
      return undefined
    })
    .filter((item): item is HistoryCheckRow => item !== undefined)
  historyParams.value = { name: historydate.value[1] ?? '' }
  // 设置渲染格式
  historyChartData.value.series = Object.keys(newObject).map((key) => ({
    name: key,
    data: newObject[key],
    type: 'bar',
    barWidth: 30,
    stack: 'total',
    emphasis: {
      focus: 'series',
    },
    itemStyle: {
      triggerOn: 'mousemove', // 调整触发范围为鼠标经过
    },
    // barMinHeight: 0.5, // 设置最小柱状图高度
    silent: false, // 确保点击事件触发
    // 与 v2 一致：对象里写了两个 label，后一个覆盖前一个；echarts 6 去掉 normal 层级
    label: {
      show: true,
      formatter(params: { value?: number }) {
        if (Number(params.value) > 0) {
          return String(params.value)
        } else {
          return ' '
        }
      },
    },
  }))
  // 修改名称
  const firstSeries = historyChartData.value.series[0]
  if (firstSeries) {
    firstSeries.name = tagDetail.value.displayName || ''
  }
  initHistoryEchart()
}

function groupbydayApi() {
  const params = {
    projectName: projectName.value,
    id: tagDetail.value.id,
    startTime: historydate.value[0],
    endTime: historydate.value[1],
  }
  const token = nextHistoryDay()
  void getHistoryDataByDay(params).then((res) => {
    if (!isLatestHistoryDay(token)) return
    getPageListHistoryApi()
    tagHistoryList.value = res?.data || []
    // 与 v2 一致（v2 此处逻辑存疑：判断的是 `if (res.data)`，空数组同样为真，
    // 随后 Object.keys(res.data[0]) 会抛 TypeError；这里保留同样的分支，只是把下标访问兜住）
    if (res?.data) {
      // x轴
      historyChartData.value.xAxis = res.data.map((item) => String(item.day ?? ''))
      const first = res.data[0]
      const keys = first ? Object.keys(first).filter((key) => key !== 'day') : []
      fieldsLable.value = keys ? keys.slice(0, 3) : []
      historyLazyLoad()
    } else {
      // 接口值为空的情况下
      historyChartData.value.legend = []
      historyChartData.value.series = []
      historyChartData.value.xAxis = []
      initHistoryEchart()
      checkTableList.value = []
      historyParams.value = { name: historydate.value[1] ?? '' }
      fieldsLable.value = []
    }
  })
}

// 显示设置进行匹配操作
function echartLazy(check: string[]) {
  historyLazyLoad(check)
}

function handlePicker() {
  pageNum.value = 1
  pageSize.value = 10
  groupbydayApi()
}

function handleTabClick(val: TabsPaneContext) {
  userId.value = ''
  pageSize.value = 10
  pageNum.value = 1
  switch (val.paneName) {
    case 'people':
      // this.getDistributeCount();
      getGroupUserPageListApi()
      break
    case 'history':
      groupbydayApi()
      break
  }
}

function openDialogEvent(row: GroupRow) {
  pageSize.value = 10
  pageNum.value = 1
  tagDetail.value = row
  dialogVisible.value = true
  activePrototype.value = 'people'
  const toDate = todayYMD()
  const seventhDayAgo = ymdDaysAgo(7)
  historydate.value = [seventhDayAgo, toDate]
  void nextTick(() => {
    userListDate.value = [toDate, toDate] //初始设置为最后一天日期
    // this.getPageListHistoryApi(); //用户列表
    distributeList.value = []
    distributeLable.value = []
    // this.getDistributeCount("desc"); //分群人数分布接口
    getGroupUserPageListApi()
  })
}

defineExpose({ openDialogEvent, echartLazy, handleSort, getDistributeCount })
</script>

<template>
  <div class="public-block">
    <div class="downTask" @click="taskCenterEvent">
      <el-icon class="downIcon"><Download /></el-icon>
      <span style="font-size: 8px; color: #2c7be5; margin: 1px">下载任务</span>
    </div>
    <el-dialog
      v-model="dialogVisible"
      :close-on-click-modal="false"
      width="1200px"
      top="3vh"
      title="分群详情"
    >
      <div style="min-height: 600px">
        <div class="tag_list">
          <div style="min-height: 0px">
            <el-row>
              <div>
                <!-- 分群头部 -->
                <div
                  style="
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    position: relative;
                  "
                >
                  <div style="display: flex; align-items: center; font-size: 13px">
                    <p>分群名称：</p>
                    <p style="font-size: 13px; color: rgb(147 142 142)">
                      {{ tagDetail.displayName }}
                    </p>
                  </div>
                  <div style="display: flex; align-items: center">
                    <div style="display: flex; margin-right: 20px; font-size: 13px">
                      <p>分群状态：</p>
                      <p style="color: #2c7be5">
                        {{ tagDetail.status }}
                      </p>
                    </div>
                    <div v-loading="downLoading" class="btnEvent" @click="downLoad">
                      <el-icon style="padding-right: 3px; font-size: 14px"><Download /></el-icon>
                      导出
                    </div>
                  </div>
                </div>
                <div
                  class="public-threeHead"
                  style="color: #a5a5a5; line-height: 20px; margin-top: 10px"
                >
                  {{ tagDetail.description }}
                </div>
                <div style="margin-top: 25px; position: relative">
                  <el-tabs v-model="activePrototype" style="position: relative" @tab-click="handleTabClick">
                    <el-tab-pane label="分群人数分布" name="people">
                      <div style="min-height: 30px; padding: 10px 0 0 0">
                        <div style="display: flex; align-items: center">
                          覆盖人数：{{
                            tagDetail.matchUserCount != null ? tagDetail.matchUserCount : '--'
                          }}，
                          <div
                            style="
                              width: 5px;
                              height: 5px;
                              border-radius: 50%;
                              background-color: #2c7be5;
                              margin: 0 5px;
                            "
                          ></div>
                          基准时间：
                          {{ formatDateHMS(tagDetail.lastExecuteStartTime) }}，计算完成于：
                          {{ formatDateHMS(tagDetail.lastExecuteEndTime) }}
                        </div>
                      </div>
                      <!-- v2 的 #peopleLine 容器在模板里被删掉了，这里挂一个 v-if=false 的占位保持行为一致 -->
                      <div v-if="false" ref="peopleElRef"></div>
                    </el-tab-pane>
                    <el-tab-pane label="分群历史详情" name="history">
                      <div
                        v-if="activePrototype == 'history'"
                        ref="historyElRef"
                        style="width: 1150px; height: 300px; margin-top: 15px"
                      ></div>
                    </el-tab-pane>
                  </el-tabs>
                  <div style="position: absolute; right: 16px; top: 0px; display: flex">
                    <div v-show="activePrototype == 'history'" style="display: flex">
                      <el-date-picker
                        v-model="historydate"
                        style="width: 270px"
                        value-format="YYYY-MM-DD"
                        type="daterange"
                        unlink-panels
                        range-separator="至"
                        start-placeholder="开始日期"
                        end-placeholder="结束日期"
                        :disabled-date="disabledFutureDate"
                        :shortcuts="historyRangeShortcuts"
                        @change="handlePicker"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </el-row>
          </div>
        </div>
        <!-- 用户列表 -->
        <div style="padding-bottom: 50px">
          <div style="display: flex; justify-content: space-between; align-items: center">
            <p class="public-firstHead" style="margin: 20px 0">用户列表</p>
            <div style="display: flex; align-items: center">
              <el-input
                v-model="userId"
                placeholder="请输入用户ID/业务系统用户ID"
                style="width: 300px"
                @keyup.enter="handleClick()"
              >
                <template #suffix>
                  <el-icon class="el-input__icon" @click="handleClick()"><Search /></el-icon>
                </template>
              </el-input>
            </div>
          </div>

          <el-table
            v-loading="userLoading"
            class="public-radius"
            :header-cell-style="headerCellStyle"
            :cell-style="cellStyle"
            :data="userListData"
            style="width: 100%; min-height: 300px"
            border
          >
            <el-table-column type="index" width="80" label="序号" />

            <el-table-column prop="userId" show-overflow-tooltip label="用户ID">
              <template #default="scope">
                <div
                  style="
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    cursor: pointer;
                  "
                >
                  <div style="overflow: hidden; text-overflow: ellipsis">
                    {{ scope.row.userId }}
                  </div>
                  <el-icon
                    style="color: #2c7be5; margin-left: 5px"
                    @click="copyRowId(scope.row.userId)"
                  >
                    <DocumentCopy />
                  </el-icon>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="loginId" show-overflow-tooltip label="业务系统用户ID">
              <template #default="scope">
                <div
                  style="
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    cursor: pointer;
                  "
                >
                  <div style="overflow: hidden; text-overflow: ellipsis">
                    {{ scope.row.loginId }}
                  </div>
                  <el-icon
                    v-if="scope.row.loginId"
                    style="color: #2c7be5; margin-left: 5px"
                    @click="copyRowId(scope.row.loginId)"
                  >
                    <DocumentCopy />
                  </el-icon>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="baseTime" width="200" label="分群更新时间">
              <template #default="{ row }">
                {{ formatDateHMS(row.baseTime) }}
              </template>
            </el-table-column>
            <el-table-column
              label="访问详情"
              width="130"
              :show-overflow-tooltip="false"
              align="center"
            >
              <template #default="{ row }">
                <div
                  style="display: flex; justify-content: center; cursor: pointer"
                  @click="handleCellClick(row)"
                >
                  <el-icon style="margin-right: 8px; color: #2c7be5"><View /></el-icon>
                  查看
                </div>
              </template>
            </el-table-column>
          </el-table>
          <div class="block">
            <el-pagination
              v-model:current-page="pageNum"
              next-text="下一页"
              :pager-count="5"
              :page-size="pageSize"
              :total="total"
              @size-change="handleSizeChange"
              @current-change="handleCurrentChange"
            />
          </div>
        </div>
      </div>
    </el-dialog>
    <taskCenter ref="taskCenterRef" />
  </div>
</template>

<style lang="scss" scoped>
// 分页样式 el-pagination 已在 src/styles/index.scss 全局引入（sass 不允许 @use 出现在嵌套块里）
:deep() {
  .el-loading-spinner .circular {
    height: 20px;
    margin-top: 12px;
  }

  .el-dialog__header {
    text-align: left;
  }

  .el-dialog {
    border-radius: 6px;
  }

  .el-dialog__body {
    padding: 0 25px;
  }

  .el-dialog__footer {
    margin-left: 0 !important;
    width: 100%;
    display: flex;
    justify-content: center;
  }
}

.public-secondHead {
  line-height: 30px;
}

.btnEvent {
  cursor: pointer;
  width: 65px;
  height: 28px;
  color: #194580;
  border: 1px solid #d8e2ef;
  border-radius: 4px;
  font-size: 12px;
  line-height: 28px;
  text-align: center;
}

.downTask {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: absolute;
  right: 20px;
  bottom: 20px;
  z-index: 9999;
  cursor: pointer;
  box-sizing: border-box;
  border-radius: 50%;
  background: #fff;
  padding: 3px;
  border: 2px solid #2c7be5;
  width: 52px;
  height: 52px;

  .downIcon {
    font-size: 28px;
    color: #2c7be5;
    padding: 0px;
    margin-top: -2px;
    font-weight: 700px;
  }
}
</style>
