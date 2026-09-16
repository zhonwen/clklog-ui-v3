<script setup lang="ts">
/**
 * 标签详情弹窗（对应 v2 src/views/ups/userTag/components/tag-detail-dialog.vue）。
 *
 * 两张图：「标签人数分布」横向柱状图 + 「标签历史详情」堆叠柱状图（可点柱子联动下方表格）。
 *
 * 迁移要点：
 *   moment                → 本模块的 todayYMD / daysAgoYMD
 *   echarts.init + id 选择器 → useChart()（elRef + init + setOption），两张图各起一套
 *   :visible.sync         → v-model
 *   slot-scope / slot="suffix" → #default / <template #suffix>
 *   :picker-options       → :disabled-date + :shortcuts
 *   value-format="yyyy-MM-dd" → "YYYY-MM-DD"
 *   @keyup.enter.native   → @keyup.enter
 *   $refs.xxx.method()    → ref + 子组件 defineExpose
 *   过滤器 | filterText / | formatDateHMS → 直接调 utils 函数
 *
 * v2 里没搬过来的死代码：
 *   - sliceTypeFile()：没有任何调用点（导出改成了任务中心异步下载）
 *   - filterRateEvent()：模板里对应的那行是注释
 *   - dateTime / loadingTime 两个 computed、userNumber 对象：无引用
 *   - handleResize() + beforeDestroy 里的 removeEventListener(this.handleResize())：
 *     v2 从没 addEventListener 过，而且写成了「调用」而不是「传引用」，是坏掉的；
 *     v3 的 useChart 自带 resize/dispose，语义上更完整。
 */
import { computed, getCurrentInstance, nextTick, ref } from 'vue'
import type { EChartsOption } from 'echarts'
import { Download, Search, View, DocumentCopy } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import customSelect from './custom-select.vue'
import taskCenter from '@/views/ups/components/tast-center.vue'
import {
  getHistoryDataByDay,
  getHistoryDataPageList,
  getUserDistributeStats,
  getUserPageList,
  tagUserHistoryData,
  tagUserDistributeData,
} from '@/api/upsapi/tagmanage'
import { tagLabelIndex } from '@/utils/modelOptions/up-manage'
import { openNewTab } from '@/utils/index'
import { filterText } from '@/utils/format'
import { formatDateHMS } from '@/utils/date'
import { useChart } from '@/composables/useChart'
import { useLatestOnly } from '@/composables/useLatestOnly'
import { useRouter } from 'vue-router'
import { useTrackingStore } from '@/stores/tracking'
import { daysAgoYMD, detailRangeShortcuts, todayYMD } from '../local-utils'
import type { TagFormula } from '../types'

const proxy = getCurrentInstance()?.proxy
const router = useRouter()
const trackingStore = useTrackingStore()

/** 分布统计的一行：接口给 value=人数，前端把它换算成百分比字符串、把原值挪到 count */
interface DistributeRow {
  name: string
  value: number | string
  count: number
}

/** 历史详情表格的一行 */
interface HistoryTableRow {
  name: string
  num: number | undefined
  rate: number | string
}

/** 用户列表的一行 */
interface UserRow {
  userId?: string
  loginId?: string
  value?: string
  baseTime?: number | string
}

/** getHistoryDataByDay 的一行：{ day: '2024-01-01', 标签值A: 1, 标签值B: 2 } */
type HistoryDayRow = Record<string, string | number>

const userId = ref('')
const distributeList = ref<DistributeRow[]>([])
const distributeLable = ref<string[]>([])
const pageSize = ref(10)
const pageNum = ref(1)
const total = ref(0)
const tagSort = ref('tagDesc')
const tagOptions = [
  { value: 'tagAsc', label: '按标签值升序' },
  { value: 'tagDesc', label: '按标签值降序' },
  { value: 'matchUserCountAsc', label: '按标签覆盖人数升序' },
  { value: 'matchUserCountDesc', label: '按标签覆盖人数降序' },
]

const historydate = ref<string[]>([])
/** 用户列表查询的时间区间（点柱子后收窄到某一天） */
const userListDate = ref<string[]>([])
const activePrototype = ref('people')
const customColor = '#409eff'
const dialogVisible = ref(false)
const tagDetail = ref<TagFormula>({})
const historyParams = ref<{ name: string }>({ name: '' })
const userListData = ref<UserRow[]>([])
const checkTableList = ref<HistoryTableRow[]>([])

const termMany = ref(10)
const termManyList = [
  { label: '前5项', value: 5 },
  { label: '前10项', value: 10 },
  { label: '前15项', value: 15 },
  { label: '前20项', value: 20 },
  { label: '前25项', value: 25 },
  { label: '前30项', value: 30 },
  { label: '前50项', value: 50 },
]
const tagHistoryList = ref<HistoryDayRow[]>([])
const history_chart = ref<{
  legend: string[]
  xAxis: (string | number)[]
  series: Record<string, unknown>[]
}>({
  legend: [],
  xAxis: [],
  series: [],
})
const fieldsLable = ref<string[]>([])
const userLoading = ref(false)
const tagValue = ref<string[]>([])
const downLoading = ref(false)

const taskCenterRef = ref<InstanceType<typeof taskCenter> | null>(null)
const customSelectRef = ref<InstanceType<typeof customSelect> | null>(null)

// 每个取数函数一套 useLatestOnly，共用会互相顶掉 token
const distributeLatest = useLatestOnly()
const userPageLatest = useLatestOnly()
const historyPageLatest = useLatestOnly()
const historyDayLatest = useLatestOnly()

// 两张图各起一套 useChart（自带 resize / dispose）
const { elRef: peopleLineRef, init: initPeopleChart, setOption: setPeopleOption } = useChart()
const {
  elRef: historyLineRef,
  chart: historyChartInst,
  init: initHistoryChartInst,
  setOption: setHistoryOption,
} = useChart()

const projectName = computed(() => trackingStore.projectName)

function disabledFuture(date: Date) {
  const today = new Date()
  return date.getTime() > today.getTime()
}

function handleCellClick(row: UserRow) {
  openNewTab({
    name: 'userInfo',
    query: { projectName: projectName.value, userId: row.userId },
  })
}

function openTaskCenter() {
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
    tagUserDistributeData(params)
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
      // startTime: this.userListDate[0],
      // endTime: this.userListDate[1],
    }
    tagUserHistoryData(params)
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

function sortArrayByField(
  array: DistributeRow[],
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
        return valueB - valueA
      } else if (order === 'desc') {
        return valueA - valueB
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
  initPeopleChart()
  const option: EChartsOption = {
    color: [
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
    ],
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        lineStyle: {
          color: '#C0CADB', // 颜色
          width: 1, // 线宽
        },
      },
      formatter(params: unknown) {
        const list = params as { name: string; value: unknown; data: DistributeRow }[]
        const content = list
          .map((param) => {
            return `
                <div style="padding: 5px;">
                  <div style='font-size: 12px;'>${param.name}</div>
                  <p style='text-align: left; margin-top: 5px;'>
                    人数：${param.data.count || 0}<br/>
                    占比：${(param.value as string | number) || 0} %<br/>
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
        formatter: '{value} %', // X轴标签显示为百分比
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
          show: true, // 显示标签
          position: 'right', // 标签位置顶部
          formatter: function (params: { value: unknown; data: unknown }) {
            const row = params.data as DistributeRow
            return `${params.value as string | number}% （${row.count}人）`
          },
        },
        data: distributeList.value as unknown as number[],
      },
    ],
  }
  setPeopleOption(option, true)
}

function getPageListNumberApi() {
  userLoading.value = true
  const params = {
    pageSize: pageSize.value,
    pageIndex: pageNum.value,
    projectName: projectName.value,
    id: tagDetail.value.id,
    tableName: tagDetail.value.tableName,
    userId: userId.value,
  }
  const token = userPageLatest.next()
  getUserPageList<{ rows?: UserRow[]; total?: number }>(params)
    .then((res) => {
      if (!userPageLatest.isLatest(token)) return
      userLoading.value = false
      userListData.value = res?.data?.rows || []
      total.value = res?.data?.total || 0
    })
    .catch(() => {
      if (!userPageLatest.isLatest(token)) return
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
  const token = historyPageLatest.next()
  getHistoryDataPageList<{ rows?: UserRow[]; total?: number }>(params)
    .then((res) => {
      if (!historyPageLatest.isLatest(token)) return
      if (res?.data) {
        userLoading.value = false
        userListData.value = res.data.rows || []
        total.value = res.data.total || 0
      }
    })
    .catch(() => {
      if (!historyPageLatest.isLatest(token)) return
      userLoading.value = false
    })
}

function getDistributeCount(sort?: string) {
  const token = distributeLatest.next()
  void getUserDistributeStats<DistributeRow[]>({
    projectName: projectName.value,
    id: tagDetail.value.id,
    tableName: tagDetail.value.tableName,
  }).then((res) => {
    if (!distributeLatest.isLatest(token)) return
    if (res?.data && res.data.length > 0) {
      const data = res.data
      const totalValue = data.reduce((sum, item) => sum + Number(item.value), 0)
      distributeLable.value = []
      tagValue.value = []
      data.forEach((item) => {
        item.count = Number(item.value)
        item.value = ((Number(item.value) / totalValue) * 100).toFixed(2)
        tagValue.value.push(item.name)
      })
      distributeList.value = data.slice(0, termMany.value)
      // 默认排序
      if (sort) {
        distributeList.value = sortArrayByField(distributeList.value, 'name', 'desc')
      }
      distributeLable.value = distributeList.value.map((item) => item.name)
      // this.tagValue = this.distributeLable;
    }
    // 与 v2 一致：等 DOM 渲染完再画图（v3 里图表容器改用 v-show，本来也一直在 DOM 里）
    void nextTick(() => {
      peopleEchart()
      getPageListNumberApi()
    })
  })
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

function handleNumber() {
  getDistributeCount()
}

function checkChartsTable(params: { name: string }) {
  const current_list = tagHistoryList.value.filter((item) => item.day == params.name)

  const sum = current_list.reduce((totalNum, obj) => {
    for (const key in obj) {
      if (typeof obj[key] === 'number' && key !== 'day') {
        totalNum += obj[key]
      }
    }
    return totalNum
  }, 0)

  checkTableList.value = []
  current_list.forEach((obj) => {
    for (const key in obj) {
      if (key !== 'day') {
        checkTableList.value.push({
          name: key,
          num: Number(obj[key]),
          rate: ((Number(obj[key]) / sum) * 100).toFixed(2),
        })
      }
    }
  })
}

function historyEchart(xAxis_list: (string | number)[], series_list: Record<string, unknown>[]) {
  initHistoryChartInst()
  const option = {
    color: [
      '#2c7be5',
      '#80bdef',
      '#c4ebad',
      '#ffde84',
      '#85dec8',
      '#4cabce',
      '#fff2ce',
      '#9AFF9A',
      '#7B68EE',
      '#87CEFA',
      '#E0FFFF',
      '#2E8B57',
      '#FFFFE0',
      '#E9967A',
    ],
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        lineStyle: {
          color: '#C0CADB',
          width: 1,
        },
      },
      formatter: function (params: unknown) {
        const list = params as { name: string; value: unknown; color: string; seriesName: string }[]
        let res = ''
        for (let i = 0; i < list.length; i++) {
          const item = list[i]
          if (!item) continue
          if (i == 0) {
            res += '<div>' + item.name + '</div>'
          }
          if (item.value) {
            res +=
              "<div style='display:flex;align-items:center;'>" +
              ` <div style=' width: 10px; height: 10px; border-radius: 50%;background-color: ${item.color};'>
                    </div>` +
              "<div style='margin-left:3px;'>" +
              item.seriesName +
              ' :' +
              String(item.value) +
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
      data: xAxis_list,
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
    // 与 v2 一致（v2 此处逻辑存疑：option 根上还挂了一段
    //   itemStyle: { normal: { color: (item) => COLORS[item.dataIndex % COLORS.length] } }
    // COLORS 在 v2 这个文件里根本没有定义，而 echarts 的根级 option 也不认 itemStyle，
    // 所以它从来没被调用过。照搬会直接变成「找不到 COLORS」的编译错误，这里只保留说明。
    series: series_list,
  }

  setHistoryOption(option as unknown as EChartsOption, true)
  historyChartInst.value?.off('click')
  historyChartInst.value?.on('click', function (params: unknown) {
    const p = params as { name: string }
    checkTableList.value = []
    checkChartsTable(p)
    historyParams.value = p
    userListDate.value = [p.name, p.name]
    getPageListHistoryApi()
  })
}

function initHistoryEchart() {
  historyEchart(history_chart.value.xAxis, history_chart.value.series)
}

function calculateSumAtIndex(obj: Record<string, (string | number)[]>, index: number) {
  return Object.values(obj).reduce((sum, array) => {
    return sum + (Number(array[index]) || 0) || 0 // 如果 array[index] 是 undefined，则使用 0
  }, 0)
}

function transformData(data: HistoryDayRow[], fields: string[]) {
  const result: Record<string, (string | number)[]> = {}
  // 遍历传入的字段数组
  fields.forEach((field) => {
    result[field] = data.map((item) => item[field] as string | number)
  })
  return result
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
  const name = fieldsLable.value[0]
  if (name && newObject[name] && (newObject[name]?.length ?? 0) > 0) {
    currentIdx = (newObject[name]?.length ?? 0) - 1
  }
  const sum = calculateSumAtIndex(newObject, currentIdx)
  if (!check) {
    checkTableList.value = fieldsLable.value
      .map((item): HistoryTableRow | undefined => {
        const column = newObject[item]
        if (column) {
          const cell = column[currentIdx]
          return {
            name: item,
            num: Number(cell), // 取出数组中的第一个值
            rate:
              ((Number(cell) / sum) * 100).toFixed(2) == 'NaN'
                ? 0
                : ((Number(cell) / sum) * 100).toFixed(2),
          }
        }
        return undefined
      })
      .filter((item): item is HistoryTableRow => item !== undefined)
    historyParams.value.name = historydate.value[1] ?? ''
  }

  // 设置渲染格式
  history_chart.value.series = Object.keys(newObject).map((key) => ({
    name: key,
    data: newObject[key],
    type: 'bar',
    barWidth: 30,
    stack: 'total',
    emphasis: {
      focus: 'series',
    },
    // v2 这里还写了 itemStyle: { triggerOn: "mousemove" } —— itemStyle 没有 triggerOn 这个配置，
    // echarts 直接忽略，是个写错位置的属性，不再搬运。
    // barMinHeight: 0.5, // 设置最小柱状图高度
    silent: false, // 确保点击事件触发
    // v2 写了两个 label，后一个覆盖前一个；echarts 6 里 label.normal 这层要展开
    label: {
      show: true,
      formatter: function (params: { value: unknown }) {
        if (Number(params.value) > 0) {
          return String(params.value)
        } else {
          return ' '
        }
      },
    },
  }))
  initHistoryEchart()
}

// 显示设置进行匹配操作
function echartLazy(check: string[]) {
  historyLazyLoad(check)
  // this.tagValue = check;
}

function groupbydayApi() {
  const params = {
    projectName: projectName.value,
    id: tagDetail.value.id,
    startTime: historydate.value[0],
    endTime: historydate.value[1],
  }
  const token = historyDayLatest.next()
  void getHistoryDataByDay<HistoryDayRow[]>(params).then((res) => {
    if (!historyDayLatest.isLatest(token)) return
    getPageListHistoryApi()
    tagHistoryList.value = res?.data || []
    const first = res?.data?.[0]
    if (res?.data && first) {
      // x轴
      history_chart.value.xAxis = res.data.map((item) => item.day as string)
      const keys = Object.keys(first).filter((key) => key !== 'day')
      tagValue.value = keys // all tag value
      // 设置标签历史详情截取的数组长度
      const spliceLength = 10
      fieldsLable.value = keys ? keys.slice(0, spliceLength) : []
      // this.tagValue = this.fieldsLable;
      customSelectRef.value?.initOptions(keys || [], spliceLength)
      historyLazyLoad()
    } else {
      // 接口值为空的情况下
      history_chart.value.legend = []
      history_chart.value.series = []
      history_chart.value.xAxis = []
      initHistoryEchart()
      checkTableList.value = []
      historyParams.value.name = historydate.value[1] ?? ''
      fieldsLable.value = []
    }
  })
}

function openDialogEvent(row: TagFormula) {
  pageSize.value = 10
  pageNum.value = 1
  tagDetail.value = row
  dialogVisible.value = true
  activePrototype.value = 'people'
  // this.tagSort = ""; //默认排序
  const toDate = todayYMD()
  const seventhDayAgo = daysAgoYMD(7)
  historydate.value = [seventhDayAgo, toDate]
  userListDate.value = [toDate, toDate] //初始设置为最后一天日期
  distributeList.value = []
  distributeLable.value = []
  getDistributeCount('desc') //标签人数分布接口
}

function handleTabClick(pane: { paneName?: string | number }) {
  userId.value = ''
  pageSize.value = 10
  pageNum.value = 1
  switch (String(pane.paneName)) {
    case 'people':
      getDistributeCount('desc')
      tagSort.value = 'tagDesc'
      break
    case 'history':
      groupbydayApi()
      break
  }
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
      getPageListNumberApi()
      break
    default:
      getPageListHistoryApi()
      break
  }
}

function filterLable(index: number) {
  if (tagValue.value.length == index + 1) {
    return '>'
  } else {
    return '，'
  }
}

function findGroupHandle() {
  void router.push({
    path: '/ups/userTag/create',
    query: {
      from: 'detail',
      id: tagDetail.value.id,
      createIndex: tagLabelIndex(tagDetail.value.createType),
    },
  })
}

function handleSizeChange(val: number) {
  pageNum.value = 1
  pageSize.value = val
  switch (activePrototype.value) {
    case 'people':
      getPageListNumberApi()
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
      getPageListNumberApi()
      break
    default:
      getPageListHistoryApi()
      break
  }
}

function handlePicker() {
  pageNum.value = 1
  pageSize.value = 10
  groupbydayApi()
}

defineExpose({ openDialogEvent })
</script>

<template>
  <div class="public-block">
    <div class="downTask" @click="openTaskCenter">
      <el-icon class="downIcon"><Download /></el-icon>
      <span style="font-size: 8px; color: #2c7be5; margin: 1px">下载任务</span>
    </div>
    <taskCenter ref="taskCenterRef"></taskCenter>
    <el-dialog
      v-model="dialogVisible"
      :close-on-click-modal="false"
      width="1200px"
      top="3vh"
      title="标签详情"
    >
      <div class="tag_list">
        <div style="min-height: 400px">
          <el-row>
            <div>
              <!-- 标签头部 -->
              <div style="display: flex; align-items: center; justify-content: space-between">
                <div style="display: flex; align-items: center">
                  <p>标签名称：</p>
                  <p style="font-size: 13px; color: rgb(147 142 142)">
                    {{ tagDetail.displayName }}
                  </p>
                  <p style="margin-left: 60px">标签值类型：</p>
                  <p style="color: rgb(147 142 142); font-size: 12px; margin-left: 0px">
                    {{ filterText(tagDetail.valueType) }}
                  </p>
                </div>
                <div style="display: flex; align-items: center">
                  <div style="display: flex; margin-right: 20px; font-size: 13px">
                    <p>标签状态：</p>
                    <p style="color: #2c7be5">
                      {{ tagDetail.status }}
                    </p>
                  </div>
                  <!-- v-show="activePrototype != 'history'" -->
                  <div v-loading="downLoading" class="btnEvent" @click="downLoad">
                    <el-icon style="padding-right: 3px; font-size: 14px"><Download /></el-icon>导出
                  </div>
                </div>
              </div>
              <div
                class="public-threeHead"
                style="color: #a5a5a5; line-height: 20px; margin-top: 10px"
              >
                {{ tagDetail.description }}
              </div>
              <div
                class="public-threeHead"
                style="
                  color: #a5a5a5;
                  line-height: 20px;
                  margin-top: 10px;
                  display: flex;
                  color: #303133;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  min-width: 200px;
                "
              >
                标签值：
                <div style="color: #2c7be5">
                  <div
                    v-if="tagValue.length > 0"
                    style="
                      display: flex;
                      overflow: hidden;
                      text-overflow: ellipsis;
                      width: 1000px;
                      flex-wrap: nowrap;
                    "
                  >
                    <div v-for="(item, index) in tagValue" :key="index" @click="findGroupHandle">
                      <div style="white-space: nowrap; cursor: pointer">
                        {{ item }} {{ filterLable(index) }}
                      </div>
                    </div>
                  </div>

                  <div v-else style="width: 150px; cursor: pointer">暂无标签值</div>
                </div>
              </div>
              <!-- tab切换 -->
              <div style="margin-top: 25px; position: relative">
                <el-tabs v-model="activePrototype" style="position: relative" @tab-click="handleTabClick">
                  <el-tab-pane label="标签人数分布" name="people">
                    <div style="min-height: 300px; padding: 20px">
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
                      <div
                        v-show="distributeList.length > 0"
                        ref="peopleLineRef"
                        style="width: 1150px; height: 300px; margin-top: 15px"
                      ></div>
                      <div
                        v-show="distributeList.length == 0"
                        style="width: 1150px; height: 300px; padding-top: 130px; text-align: center"
                      >
                        暂无数据
                      </div>
                    </div>
                  </el-tab-pane>
                  <el-tab-pane label="标签历史详情" name="history">
                    <div
                      v-show="activePrototype == 'history'"
                      ref="historyLineRef"
                      style="width: 1150px; height: 300px; margin-top: 15px"
                    ></div>
                    <el-table
                      class="public-radius"
                      :header-cell-style="{
                        textAlign: 'center',
                        background: '#f7fafe  ',
                      }"
                      max-height="300px"
                      :cell-style="{ textAlign: 'center' }"
                      :data="checkTableList"
                      style="width: 90%; margin: 30px"
                    >
                      <el-table-column prop="name" label="标签值"> </el-table-column>
                      <el-table-column prop="rate" :label="'打标时间：' + historyParams.name">
                        <template #default="{ row }">
                          <div style="display: flex; justify-content: center; padding: 5px 0">
                            <div>{{ row.num }}</div>
                            <div style="color: rgb(166 161 164)">
                              （{{ row.rate }}%）
                              <!-- {{ filterRateEvent(row.num) }} -->
                            </div>
                          </div>
                          <el-progress
                            :show-text="false"
                            :percentage="Number(row.rate)"
                            :color="customColor"
                          ></el-progress>
                        </template>
                      </el-table-column>
                    </el-table>
                  </el-tab-pane>
                </el-tabs>
                <div style="position: absolute; right: 16px; top: 0px; display: flex">
                  <div v-show="activePrototype != 'history'" style="display: flex">
                    <el-select
                      v-model="termMany"
                      placeholder="请选择"
                      style="width: 100px"
                      @change="handleNumber"
                    >
                      <el-option
                        v-for="item in termManyList"
                        :key="item.value"
                        :label="item.label"
                        :value="item.value"
                      >
                      </el-option>
                    </el-select>
                    <el-select
                      v-model="tagSort"
                      placeholder="请选择"
                      style="width: 150px; margin-left: 15px"
                      @change="handleSort"
                    >
                      <el-option
                        v-for="item in tagOptions"
                        :key="item.value"
                        :label="item.label"
                        :value="item.value"
                      >
                      </el-option>
                    </el-select>
                  </div>
                  <div v-show="activePrototype == 'history'" style="display: flex">
                    <div style="display: flex; align-items: center">
                      <p>显示设置：</p>
                      <customSelect
                        ref="customSelectRef"
                        style="margin-right: 15px"
                        @echart-lazy="echartLazy"
                      >
                      </customSelect>
                    </div>

                    <el-date-picker
                      v-model="historydate"
                      style="width: 270px"
                      value-format="YYYY-MM-DD"
                      type="daterange"
                      unlink-panels
                      range-separator="至"
                      start-placeholder="开始日期"
                      end-placeholder="结束日期"
                      :disabled-date="disabledFuture"
                      :shortcuts="detailRangeShortcuts"
                      @change="handlePicker"
                    >
                    </el-date-picker>
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
                <el-icon style="cursor: pointer" @click="handleClick()"><Search /></el-icon>
              </template>
            </el-input>
          </div>
        </div>

        <el-table
          v-loading="userLoading"
          class="public-radius"
          :header-cell-style="{
            textAlign: 'center',
            background: '#f7fafe  ',
          }"
          :cell-style="{ textAlign: 'center' }"
          :data="userListData"
          style="width: 100%"
          border
        >
          <el-table-column type="index" :width="proxy?.$fixedWidth.FwIndex" label="序号">
          </el-table-column>
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
                <el-icon style="color: #2c7be5; margin-left: 5px" @click="copyRowId(scope.row.userId)">
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
          <el-table-column prop="value" label="标签值"> </el-table-column>
          <el-table-column prop="baseTime" width="200" label="标签更新时间">
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
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
// v2 这里 @import 了 el-pagination.scss，v3 已在 styles/index.scss 全局引入，不再重复引

:deep(.el-loading-spinner .circular) {
  height: 20px;
  margin-top: 12px;
}

:deep(.el-input__wrapper) {
  height: 33px;
}

:deep(.el-dialog__header) {
  text-align: left;
}

:deep(.el-dialog) {
  border-radius: 6px;
}

:deep(.el-dialog__body) {
  padding: 0 25px;
}

:deep(.el-dialog__footer) {
  margin-left: 0 !important;
  width: 100%;
  display: flex;
  justify-content: center;
}

.public-secondHead {
  line-height: 30px;
}

.btnEvent {
  cursor: pointer;
  width: 65px;
  height: 28px;
  color: #194580;
  font-weight: 600px;
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
