<script setup lang="ts">
/**
 * 群画像-画像分析-静态演示版图表（v2 views/ups/userPortrait/echart-static-version.vue）。
 *
 * 说明：v2 仓库里 grep 不到任何对本组件的引用（portrait-analyze.vue 只引了 merge-echart），
 * 所以 defineExpose 按「方法体里像是给外部调的入口」来定：
 *   initApiList / contrastEvent / portraitInfoListApi / handleEchartType
 * 另外 v2 的 historyEchart() 没有任何调用点，且它 init 的 #historyLine 在模板里并不存在
 * （调用即报错），本文件未迁移。
 *
 * 本组件的图表数据全部是 Math.random 生成的假数据（v2 的 mathRandomEvent），原样保留。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import type { ComponentPublicInstance, CSSProperties } from 'vue'
import * as echarts from 'echarts'
import type { ECharts, EChartsOption } from 'echarts'
import { CaretBottom, Close, Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useRoute } from 'vue-router'
import Sortable from 'sortablejs'
import { deleteportrait, getlistportrait } from '@/api/upsapi/groupportrait'
import { useLatestOnly } from '@/composables/useLatestOnly'
import { debounce } from '@/utils/index'
import type { PortraitInfoItem } from './types'

/** 自定义区间的一段 */
interface IntervalParam {
  start: string
  end: string
}

/** 画像区间设置 */
interface SetInterval {
  name?: string
  params?: IntervalParam[]
}

/** 画像信息里的一条指标（formula.measures 元素） */
interface StaticMeasure {
  name?: string
  displayName?: string
  [key: string]: unknown
}

/**
 * 画像信息的筛选条件。
 * 与 v2 一致：v2 直接读 filters.setInterval.xxx，默认它一定存在，这里也按必填声明。
 */
interface StaticFilters {
  type?: string
  count?: number | string
  sort?: string
  setInterval: SetInterval
  [key: string]: unknown
}

/** 画像信息的 formula（入参里是 JSON 字符串，本组件解析成对象后原地覆盖） */
interface StaticFormula {
  filters: StaticFilters
  measures?: StaticMeasure[]
  [key: string]: unknown
}

/** 卡片对应的一条画像信息 */
interface StaticItem {
  id?: string
  name?: string
  type?: string
  formula: StaticFormula
  [key: string]: unknown
}

/** 对比人群 */
interface ContrastCrowdItem {
  displayName?: string
  [key: string]: unknown
}

/** tooltip 回调里用到的字段 */
interface TooltipParam {
  name?: string
  seriesName?: string
  color?: string
  value?: number | string
}

const emit = defineEmits<{
  (e: 'editPortraitInfo', item: StaticItem): void
}>()

const route = useRoute()
const projectName = computed(() => route.query.projectName)

const tableData = [
  {
    date: '2024-05-02',
    pv: '2132',
    pvRate: '1234',
  },
  {
    date: '2023-05-04',
    pv: '3210',
    pvRate: '9873',
  },
  {
    date: '2023-11-04',
    pv: '3110',
    pvRate: '98173',
  },
  {
    date: '2022-05-04',
    pv: '13210',
    pvRate: '49873',
  },
]

const radioOptions = [
  {
    label: '使用默认区间',
    value: '使用默认区间',
  },
  // {
  //   label: "使用离散数字",
  //   value: "使用离散数字",
  // },
  {
    label: '使用自定义区间',
    value: '使用自定义区间',
  },
]

const chartTypeList = [
  {
    value: 'bar',
    label: '柱状图',
  },
  {
    value: 'table',
    label: '表格',
  },
]

// firstFewItems: 7,
const firstFewItemsList = [
  { value: 7, label: '前7项' },
  { value: 10, label: '前10项' },
  { value: 15, label: '前15项' },
  { value: 20, label: '前20项' },
  { value: 30, label: '前30项' },
  { value: 50, label: '前50项' },
]

const targetTypeList = [
  { value: '按目标人群的覆盖人数降序', label: '按目标人群的覆盖人数降序' },
  { value: '按目标人群的覆盖人数升序', label: '按目标人群的覆盖人数升序' },
  { value: '按纬度值升序', label: '按纬度值升序' },
  { value: '按纬度值降序', label: '按纬度值降序' },
]

const portraitInfoList = ref<StaticItem[]>([])
/** 对比列表 */
const contrastList = ref<ContrastCrowdItem[]>([])
/** 每个 popover 的展开状态（v2 用 ref="customPopover" + doClose()，EP3 改成 v-model:visible） */
const popoverVisible = ref<Record<number, boolean>>({})

/**
 * 目标人群图 / 对比人群图的数量都跟着 portraitInfoList × contrastList 动态变化，
 * useChart 的单 elRef 撑不住，因此本文件内用 shallowRef + echarts.init 手动管理，
 * 并自行补 resize 监听与 onBeforeUnmount 的 dispose。
 */
const targetChartEls = shallowRef<(HTMLDivElement | null)[]>([])
/** v2 的 echartsInstances */
const echartsInstances = shallowRef<(ECharts | null)[]>([])
/** 对比图的柱状图容器，key 为 `${index}${contrastIdx}`（与 v2 的 ref 名拼法一致） */
const contrastBarEls = shallowRef<Record<string, HTMLDivElement | null>>({})
/** 对比图的表格容器，scrollToSection 在 table 模式下滚的是它 */
const contrastTableEls = shallowRef<Record<string, HTMLDivElement | null>>({})
/**
 * v2 的 contrastInstances 是数组且每次 contrastDrawDevice 都 push，
 * contrastGroupInit 被调用两次就会塞进重复（且已失效）的实例；
 * 这里改成按 key 存，行为等价且不会堆积。
 */
const contrastInstances = shallowRef<Record<string, ECharts>>({})

function setTargetChartRef(el: Element | ComponentPublicInstance | null, index: number) {
  targetChartEls.value[index] = (el as HTMLDivElement | null) ?? null
}

function setContrastBarRef(el: Element | ComponentPublicInstance | null, key: string) {
  contrastBarEls.value[key] = (el as HTMLDivElement | null) ?? null
}

function setContrastTableRef(el: Element | ComponentPublicInstance | null, key: string) {
  contrastTableEls.value[key] = (el as HTMLDivElement | null) ?? null
}

const blockAreaStyle = computed<CSSProperties>(() =>
  contrastList.value.length > 0 ? { width: '100%' } : { width: '48%' },
)

const chartWidthStyle = computed<CSSProperties>(() =>
  contrastList.value.length > 0 ? { width: '48%' } : { width: '100%' },
)

/** 表头/单元格样式：Element Plus 的回调必须返回对象，不能返回字符串 */
const headerCellStyle: CSSProperties = {
  textAlign: 'center',
  background: '#f7fafe  ',
}
const cellStyle: CSSProperties = { textAlign: 'center' }

function filterDisplay(item: StaticItem): string {
  const measure = item.formula?.measures?.[0]
  if (item.type == '标签属性分布') {
    return String(measure?.displayName ?? '')
  } else {
    return String(measure?.name ?? '')
  }
}

/** 模板里 filterDisplay 每张卡要用两次，提成 computed 避免重复调用 */
const cardDisplays = computed<string[]>(() => portraitInfoList.value.map((item) => filterDisplay(item)))

function isJsonString(str: unknown): boolean {
  try {
    JSON.parse(str as string)
    return true // 如果没有抛出异常，说明是有效的 JSON 字符串
  } catch {
    return false // 如果抛出异常，说明不是有效的 JSON 字符串
  }
}

function scrollToSection(refName: string, type: string | undefined) {
  // v2: const element = this.$refs[refName]；同名 ref 上挂了两个节点，
  // [0] 是柱状图容器、[1] 是表格容器，这里按 type 分别取对应的 Record。
  const element = type === 'bar' ? contrastBarEls.value[refName] : contrastTableEls.value[refName]
  element?.scrollIntoView({
    behavior: 'smooth',
    block: 'nearest',
    inline: 'start',
  })
}

function mathRandomEvent(): number[] {
  return [
    parseInt(String(Math.random() * 100)),
    parseInt(String(Math.random() * 100)),
    parseInt(String(Math.random() * 100)),
    parseInt(String(Math.random() * 100)),
  ]
}

/** 目标人群图 / 对比人群图共用的 option（v2 两处一字不差地各写了一遍） */
function buildBarOption(): EChartsOption {
  const num1 = parseInt(String(Math.random() * 1000))
  const num2 = parseInt(String(Math.random() * 1000))
  const num3 = parseInt(String(Math.random() * 1000))

  const option = {
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
    legend: {
      show: true,
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        lineStyle: {
          color: '#C0CADB',
          width: 1,
        },
      },
      formatter: function (rawParams: unknown) {
        const params = (Array.isArray(rawParams) ? rawParams : [rawParams]) as TooltipParam[]
        let res = ''
        for (let i = 0; i < params.length; i++) {
          const current = params[i]
          if (!current) continue
          if (i == 0) {
            res += '<div>' + current.name + '</div>'
          }
          if (current.value) {
            res +=
              "<div style='display:flex;align-items:center;'>" +
              ` <div style=' width: 10px; height: 10px; border-radius: 50%;background-color: ${current.color};'>
                  </div>` +
              "<div style='margin-left:3px;'>" +
              current.seriesName +
              ' :' +
              current.value +
              '</div>' +
              '</div>'
          }
        }
        return res
      },
    },
    xAxis: [
      {
        // 与 v2 一致（v2 此处逻辑存疑：原对象里 type: "category" 写了两遍，后者覆盖前者，取值相同）
        type: 'category',
        data: ['高度活跃', '中度活跃', '低度活跃'],
        boundaryGap: true,
        axisLabel: {
          interval: 0, //强制文字产生间隔
          // v2 写的是字符串 "0"，echarts 5+ 要求数字
          rotate: 0, //旋转角度
        },
        axisLine: {
          onZero: false,
        },
        axisTick: {
          show: false,
          alignWithLabel: true,
        },
      },
    ],
    yAxis: {
      type: 'value',
      axisTick: {
        show: false,
        alignWithLabel: true,
      },
      axisLine: {
        show: false,
      },
    },

    series: [
      {
        name: '高度活跃',
        stack: 'total',
        // barWidth: 40,
        type: 'bar',
        label: {
          show: true,
          position: 'top',
        },
        // v2 是 itemStyle.normal.color，echarts 5+ 展开一层
        itemStyle: {
          color: '#85dec8',
        },
        data: [num1, null],
      },
      {
        name: '中度活跃',
        stack: 'total',
        type: 'bar',
        label: {
          show: true,
          position: 'top',
        },
        itemStyle: {
          color: '#ffde84',
        },
        data: ['', num2, ''],
      },
      {
        name: '低度活跃',
        stack: 'total',
        type: 'bar',
        label: {
          show: true,
          position: 'top',
        },
        itemStyle: {
          color: '#c4ebad',
        },

        data: ['', '', num3],
      },
    ],
  }

  return option as unknown as EChartsOption
}

//******  画像信息 目标人群图形列表******
// statementData数据为调用借口返回的数据，本处不多做展示，数据结构如下方图
// ***** start  *****
function drawDevice(index: number, _series: number[], _XData: number[], _unit?: string) {
  nextTick(() => {
    const el = targetChartEls.value[index]
    if (!el) return
    // v2 直接 echarts.init（同 DOM 上 echarts 会返回已有实例），这里先 dispose 再 init，等价且不残留旧配置
    echartsInstances.value[index]?.dispose()
    const myChart = echarts.init(el)
    myChart.setOption(buildBarOption(), true)
    echartsInstances.value[index] = myChart
  })
}

function statementStart() {
  portraitInfoList.value.forEach((item, index) => {
    const series = mathRandomEvent()
    const XData = mathRandomEvent()
    drawDevice(index, series, XData)
  })
}

//****** 对比人群 图形列表事件 ******
function contrastDrawDevice(key: string, _series: number[], _XData: number[], _unit?: string) {
  nextTick(() => {
    const el = contrastBarEls.value[key]
    if (!el) return
    // v2 在这里对同一个 DOM 连着 init 了两次（myChart / mCharts），
    // echarts 第二次会直接返回已有实例，等价于只 init 一次。
    contrastInstances.value[key]?.dispose()
    const mCharts = echarts.init(el)
    mCharts.setOption(buildBarOption(), true)
    contrastInstances.value[key] = mCharts
  })
}

function contrastGroupInit() {
  portraitInfoList.value.forEach((item, index) => {
    contrastList.value.forEach((contrastItem, contrastIdx) => {
      const series = mathRandomEvent()
      const XData = mathRandomEvent()
      // v2 的 ref 名是 'contrastChart' + index + contrastIdx，这里沿用同一套 key
      const indexAdd = `contrastChart` + `${index}` + `${contrastIdx}`
      contrastDrawDevice(indexAdd, series, XData)
    })
  })
}
// ****** end ******

function handleResize() {
  echartsInstances.value.forEach((item) => {
    if (item) {
      item.resize()
    }
  })
  Object.values(contrastInstances.value).forEach((item) => {
    if (item) {
      item.resize()
    }
  })
}

const onResize = debounce(() => handleResize(), 100)

// 与 v2 的 mixins/resize.js 一致：侧栏折叠只认宽度过渡
function onSidebarTransitionEnd(e: Event) {
  if ((e as TransitionEvent).propertyName === 'width') onResize()
}

function handleEchartType(index?: number) {
  // v2 的签名是 (index, item, $event)，后两个参数在方法体里没用到，这里只保留 index。
  // handleDelete 里 v2 调的是 handleEchartType()（index 为 undefined，取不到实例直接跳过），故 index 可选。
  nextTick(() => {
    const instance = index == null ? null : echartsInstances.value[index]
    if (instance && instance.resize) {
      instance.resize()
    }
    Object.values(contrastInstances.value).forEach((item) => {
      if (item.resize) {
        item.resize()
      }
    })
  })
}

function handelRandio(event: string | number | boolean | undefined, filters: StaticFilters) {
  if (event == '使用自定义区间') {
    filters.setInterval.params = [
      {
        start: '-∞',
        end: '',
      },
      {
        start: '',
        end: '+∞',
      },
    ]
  }
}

function closePopover(_index?: number) {
  // v2: this.$refs.customPopover.map((item) => item.doClose())，即关掉所有 popover
  popoverVisible.value = {}
}

function confirmPopover() {
  closePopover()
}

function intervalBlur(event: string, index: number, filters: StaticFilters) {
  // event.target.value
  const next = filters.setInterval.params?.[index + 1]
  if (next) {
    next.start = event
  }
}

function addDevideEvent(list: IntervalParam[] | undefined) {
  if (!list) return
  // 清空正无穷值
  const last = list[list.length - 1]
  if (last) {
    last.end = ''
  }
  const itemObj: IntervalParam = {
    start: '',
    end: '+∞',
  }
  list.push(itemObj)
}

function deleteInterval(index: number, list: IntervalParam[] | undefined) {
  if (!list) return
  list.splice(index, 1)
  const last = list[list.length - 1]
  if (last) {
    last.end = '+∞'
  }
}

const { next: nextPortraitList, isLatest: isLatestPortraitList } = useLatestOnly()

function portraitInfoListApi() {
  const query = route.query
  const token = nextPortraitList()
  getlistportrait({ id: query.id }).then((res) => {
    if (!isLatestPortraitList(token)) return
    if (res?.code == 200) {
      portraitInfoList.value = (res.data ?? []) as StaticItem[]
      portraitInfoList.value.forEach((item) => {
        if (item.formula) {
          item.formula = JSON.parse(String(item.formula)) as StaticFormula
        }
      })
      nextTick(() => {
        statementStart()
      })
    }
  })
}

function initApiList(data: PortraitInfoItem[], _contrastList?: ContrastCrowdItem[]) {
  // 与 v2 一致（v2 此处逻辑存疑：第二个参数 contrastList 传进来后没有被使用）
  portraitInfoList.value = data as unknown as StaticItem[]
  portraitInfoList.value.forEach((item) => {
    const rawFormula: unknown = item.formula
    if (rawFormula && isJsonString(rawFormula)) {
      item.formula = JSON.parse(String(rawFormula)) as StaticFormula
    }
  })
  // **** 新增 目标人群-画像信息事件
  // this.drawDevice(data.length - 1, this.mathRandomEvent());
  nextTick(() => {
    statementStart()
    // 对比人群 - 画像信息事件
    contrastGroupInit()
  })
}

// 是否拥有对比事件
function contrastEvent(list: ContrastCrowdItem[]) {
  contrastList.value = list
  //初始化对比图表展示
  nextTick(() => {
    contrastGroupInit()
  })
}

function handleEdite(item: StaticItem) {
  emit('editPortraitInfo', item)
}

function handleDelete(item: StaticItem, _index: number) {
  deleteportrait({ id: item.id, projectName: projectName.value }).then(() => {
    // 与 v2 一致：不判 code，直接按成功处理
    ElMessage.success('删除成功')
    portraitInfoListApi()
    // 重置echarts
    handleEchartType()
  })
}

/**
 * 卡片拖拽：与 v2 mounted 里的 sortablejs 调用保持一致
 *   new Sortable(this.$refs.example, { onStart(evt) {}, onEnd({ newIndex, oldIndex }) {} })
 * v2 的 onStart / onEnd 都是空函数，sortablejs 只搬 DOM 节点、不回写数据数组，
 * 所以 v2 的真实效果是「卡片任意位置都能拖、松手后视觉顺序变化、但数据顺序不变」——
 * 列表一旦重新渲染即复原，保存/导出的仍是原顺序。这里照搬同样的行为。
 * v2 组件销毁时没有 destroy 实例，v3 补上，避免路由切换后残留监听。
 */
const containerRef = ref<HTMLElement | null>(null)
let sortable: Sortable | null = null
// 注意：本文件 v2 的 new Sortable 没有传 handle，整张卡片任意位置都能起拖，故这里也不传。

onMounted(() => {
  window.addEventListener('resize', onResize)
  const sidebar = document.getElementsByClassName('sidebar-container')[0]
  sidebar?.addEventListener('transitionend', onSidebarTransitionEnd)
  if (containerRef.value) {
    sortable = new Sortable(containerRef.value, {
      onStart() {},
      onEnd() {},
    })
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  const sidebar = document.getElementsByClassName('sidebar-container')[0]
  sidebar?.removeEventListener('transitionend', onSidebarTransitionEnd)
  sortable?.destroy()
  sortable = null
  echartsInstances.value.forEach((item) => item?.dispose())
  Object.values(contrastInstances.value).forEach((item) => item.dispose())
  echartsInstances.value = []
  contrastInstances.value = {}
  targetChartEls.value = []
  contrastBarEls.value = {}
  contrastTableEls.value = {}
})

defineExpose({
  initApiList,
  contrastEvent,
  portraitInfoListApi,
  handleEchartType,
})
</script>

<template>
  <div ref="containerRef" class="container">
    <div
      v-for="(item, index) in portraitInfoList"
      :key="index"
      class="blockArea"
      :style="blockAreaStyle"
    >
      <div class="header" style="cursor: move">
        <div class="header_left">
          <span
            >{{ cardDisplays[index] }} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;的分布</span
          >
          <div class="reasonFont">
            <p>画像目标人群中</p>
            <span>{{ 80.21 }} %</span>
            <p>拥有</p>
            <span
              style="margin: 0 3px; max-width: 250px; overflow: hidden; text-overflow: ellipsis"
              >{{ cardDisplays[index] }}</span
            >
            <p>属性;</p>
          </div>
        </div>
        <div class="header_right">
          <span @click="handleEdite(item)">编辑</span>
          <span @click="handleDelete(item, index)">删除</span>
        </div>
      </div>
      <!-- 条件筛选 -->
      <div style="display: flex; padding: 10px; position: relative">
        <el-select
          v-model="item.formula.filters.type"
          placeholder="请选择"
          class="custom_select"
          @change="handleEchartType(index)"
        >
          <el-option
            v-for="chartType in chartTypeList"
            :key="chartType.value"
            :label="chartType.label"
            :value="chartType.value"
          />
        </el-select>
        <el-select
          v-model="item.formula.filters.count"
          placeholder="请选择"
          class="custom_select"
          style="margin-left: 10px"
        >
          <el-option
            v-for="fewItem in firstFewItemsList"
            :key="fewItem.value"
            :label="fewItem.label"
            :value="fewItem.value"
          />
        </el-select>
        <el-select
          v-model="item.formula.filters.sort"
          placeholder="请选择"
          class="custom_select"
          style="margin-left: 10px"
        >
          <el-option
            v-for="targetItem in targetTypeList"
            :key="targetItem.value"
            :label="targetItem.label"
            :value="targetItem.value"
          />
        </el-select>
        <!-- 设置锚点定位功能 -->
        <div
          v-if="contrastList.length > 0"
          style="
            position: absolute;
            display: flex;
            top: 20px;
            left: 48%;
            width: 50%;
            padding-bottom: 5px;
            z-index: 999;
            border-bottom: 1px solid rgb(211 211 211);
          "
        >
          <div
            v-for="(contrastItem, contrastIdx) in contrastList"
            :key="contrastIdx"
            class="anchorPoint"
          >
            <div
              id="myAnchor"
              @click.prevent="
                scrollToSection('contrastChart' + index + contrastIdx, item.formula.filters.type)
              "
            >
              {{ contrastItem.displayName }}
            </div>
          </div>
        </div>
        <!-- 行为分析模块下的筛选条件 -->
        <!-- 画像区间设置 start -->
        <el-popover
          v-if="item.type == '用户行为分布'"
          v-model:visible="popoverVisible[index]"
          placement="bottom"
          :width="300"
          style="background: #fff !important"
          trigger="click"
        >
          <template #reference>
            <div
              style="
                font-size: 13px;
                cursor: pointer;
                color: #4d4d4d;
                margin-left: 10px;
                line-height: 28px;
                border-radius: 4px;
                white-space: nowrap;
              "
            >
              使用默认区间<el-icon class="el-icon-caret-bottom"><CaretBottom /></el-icon>
            </div>
          </template>
          <div class="interval_ls">
            <div style="min-height: 50px; overflow: hidden">
              <el-radio-group
                v-model="item.formula.filters.setInterval.name"
                style="display: flex; flex-direction: column"
                @change="handelRandio($event, item.formula.filters)"
              >
                <el-radio
                  v-for="radioItem in radioOptions"
                  :key="radioItem.value"
                  style="line-height: 30px"
                  :value="radioItem.value"
                >
                  {{ radioItem.label }}
                </el-radio>
              </el-radio-group>
            </div>
            <!-- 区间范围 -->
            <div
              v-if="item.formula.filters.setInterval.name == '使用自定义区间'"
              style="padding: 0 25px"
            >
              <div
                v-for="(subItem, subIndex) in item.formula.filters.setInterval.params"
                :key="subIndex"
              >
                <div
                  style="display: flex; align-items: center; margin-bottom: 10px; font-size: 14px"
                >
                  <p>区间{{ subIndex + 1 }}：</p>
                  <div style="display: flex; align-items: center">
                    {{ subIndex == 0 ? "(" : "[" }}
                    <p
                      v-if="subIndex == 0"
                      style="margin-left: 10px; width: 60px; text-align: center"
                    >
                      {{ subItem.start }}
                    </p>
                    <el-input
                      v-else
                      v-model="subItem.start"
                      style="
                        margin-left: 10px;
                        width: 60px;
                        height: 30px;
                        line-height: 30px;
                        font-size: 12px;
                      "
                      disabled
                    ></el-input>
                    <span style="margin: 0 10px">,</span>
                    <!-- 最后一个正无穷 -->
                    <div
                      v-if="
                        (item.formula.filters.setInterval.params?.length ?? 0) == subIndex + 1
                      "
                      style="width: 70px; text-align: center"
                    >
                      {{ subItem.end }}
                    </div>
                    <el-input
                      v-else
                      v-model="subItem.end"
                      style="width: 60px; height: 30px; margin-right: 10px; font-size: 11px"
                      placeholder="请输入"
                      @input="intervalBlur($event, subIndex, item.formula.filters)"
                    ></el-input>
                    )
                  </div>
                  <el-icon
                    v-if="
                      subIndex + 1 == (item.formula.filters.setInterval.params?.length ?? 0) &&
                      subIndex > 1
                    "
                    class="el-icon-close"
                    @click="deleteInterval(subIndex, item.formula.filters.setInterval.params)"
                  >
                    <Close />
                  </el-icon>
                </div>
              </div>
              <div
                style="
                  font-size: 14px;
                  color: #2c7be5;
                  cursor: pointer;
                  display: flex;
                  align-items: center;
                  margin-bottom: 20px;
                  margin-top: 10px;
                  width: 70px;
                "
                @click="addDevideEvent(item.formula.filters.setInterval.params)"
              >
                <el-icon class="el-icon-plus"><Plus /></el-icon>增加区间
              </div>
            </div>
            <!-- end -->
          </div>
          <div style="display: flex; justify-content: center; margin-top: 15px">
            <el-button class="zc_btn_default" @click="closePopover(index)">取消</el-button>
            <el-button class="zc_btn" @click="confirmPopover">确定</el-button>
          </div>
        </el-popover>

        <!-- end -->
      </div>

      <div class="selectTabs"></div>

      <div style="display: flex; overflow: auto; width: 100%; position: relative">
        <div style="font-size: 12px; color: #8a8989; margin-left: 15px; position: absolute">
          目标人群
        </div>
        <!-- 目标人群-chart -->
        <div
          v-show="item.formula.filters.type == 'bar'"
          :id="'targerChart' + index"
          :ref="(el) => setTargetChartRef(el, index)"
          style="height: 300px; flex: 1; margin-top: 15px"
          :style="chartWidthStyle"
        ></div>

        <!-- 切换为table表格 -->
        <div
          v-show="item.formula.filters.type == 'table'"
          style="margin-top: 15px"
          :style="chartWidthStyle"
        >
          <el-table
            height="260"
            :header-cell-style="headerCellStyle"
            :cell-style="cellStyle"
            border
            class="public-radius"
            :data="tableData"
            style="width: 90%; margin-left: 5%; margin-top: 10px"
          >
            <el-table-column prop="name" label="画像人群1">
              <template #default>画像目标人群</template>
            </el-table-column>
            <el-table-column sortable prop="date" :label="item.name"> </el-table-column>

            <el-table-column sortable prop="pv" label="用户数"> </el-table-column>
            <el-table-column sortable prop="pvRate" label="用户占比"> </el-table-column>
          </el-table>
        </div>

        <!-- 对比人群-chart -->
        <div
          v-if="contrastList.length > 0"
          style="display: flex; overflow-x: auto; width: 52%; white-space: nowrap"
        >
          <div
            v-for="(contrastItem, contrastIdx) in contrastList"
            :key="contrastIdx"
            style="min-width: 96%; position: relative"
          >
            <div
              style="
                text-align: left;
                font-size: 12px;
                height: 15px;
                color: #8a8989;
                z-index: 999;
                overflow: hidden;
                text-overflow: ellipsis;
              "
            >
              {{ contrastItem.displayName }}
              <!-- <a :href="'#' + 'contrastChart' + index + contrastIdx">{{
                contrastItem.displayName
              }}</a> -->
            </div>
            <div
              v-show="item.formula.filters.type === 'bar'"
              :id="'contrastChart' + index + contrastIdx"
              :ref="(el) => setContrastBarRef(el, 'contrastChart' + index + contrastIdx)"
              style="height: 300px; flex: 1; width: 100%"
            ></div>
            <!-- 切换为table表格 -->
            <div
              v-show="item.formula.filters.type === 'table'"
              :ref="(el) => setContrastTableRef(el, 'contrastChart' + index + contrastIdx)"
              style="height: 300px; flex: 1; width: 100%"
            >
              <el-table
                height="260"
                :header-cell-style="headerCellStyle"
                :cell-style="cellStyle"
                border
                class="public-radius"
                :data="tableData"
                style="width: 90%; margin-left: 5%; margin-top: 10px"
              >
                <el-table-column prop="name" label="画像人群2">
                  <template #default>画像目标人群</template>
                </el-table-column>
                <el-table-column sortable prop="date" :label="item.name"> </el-table-column>

                <el-table-column sortable prop="pv" label="用户数"> </el-table-column>
                <el-table-column sortable prop="pvRate" label="用户占比"> </el-table-column>
              </el-table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.sortable-chosen {
  // background-color: #7aa4e0 !important;
}
// .sortable-drag {
//   background-color: #7aa4e0 !important;
// }
// .sortable-ghost {
//   opacity: 0.4;
//   // background-color: #7aa4e0 !important;
//   box-shadow: 10px 0px 12px 0 rgba(0, 0, 0, 0.7);
// }

.el-icon-close {
  margin-left: 5px;
  cursor: pointer;
}
.el-icon-close:hover {
  color: #2c7be5;
}

// v2 是 ::v-deep { ... } 包一层，Vue3 里逐条改成 :deep(...)。
// .el-input--medium 是 element-ui 2 的尺寸类，Element Plus 对应的是 .el-input--default，
// 两个都写上，保证 30px 高度在 v3 里仍然生效。
:deep(.el-input--medium .el-input__inner),
:deep(.el-input--default .el-input__inner) {
  height: 30px;
  line-height: 30px;
}
:deep(::-webkit-scrollbar) {
  height: 8px;
}
:deep(::-webkit-scrollbar-thumb) {
  background-color: #888;
  border-radius: 10px;
}
:deep(::-webkit-scrollbar-thumb:hover) {
  background-color: #555;
}

.custom_select {
  width: 90px;

  :deep(.el-input--medium .el-input__inner),
  :deep(.el-input--default .el-input__inner) {
    height: 30px;
    line-height: 30px;
    font-size: 12px;
  }
  :deep(.el-input__suffix) {
    display: flex;
    align-items: center;
  }
  :deep(.el-input--medium .el-input__icon),
  :deep(.el-input--default .el-input__icon) {
    line-height: 30px;
  }
}
// .anchorPoint:focus{
//   color: #2c7be5;
// }
.anchorPoint:hover {
  color: #2c7be5 !important;
}
.anchorPoint {
  display: flex;
  margin-right: 15px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600px;
}
.container {
  padding: 20px;
  box-sizing: border-box;
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  .blockArea {
    height: 450px;
    border-radius: 6px;
    border: 1px solid #eeecec;
    margin-bottom: 20px;
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #eeecec;
      .header_left {
        width: calc(100% - 100px);
        padding: 10px;
        box-sizing: border-box;

        line-height: 20px;
        p {
          font-size: 12px;
          color: #8a8989;
        }
        span {
          font-size: 13px;
          white-space: nowrap;
        }
        .reasonFont {
          display: flex;
          flex-wrap: wrap;
        }
      }
      .header_right {
        width: 100px;
        text-align: right;

        span {
          font-size: 13px;
          color: #2c7be5;
          cursor: pointer;
        }
        span:nth-child(2) {
          margin: 0 15px;
        }
      }
    }
    .selectTabs {
      display: flex;
    }
    .singItem {
    }
  }
}
</style>
