<script setup lang="ts">
/**
 * 事件偏好属性的规则编辑器
 * （对应 v2 src/views/ups/userTag/components/eventPreference/basicRules.vue）。
 *
 * 数据结构（modelObject = 外层 modelObject.rules）：
 *   { relation?: 'and'|'or', measures: EventPreferenceMeasure[] }
 * measure 的形状见 circleAddEvent()，字段名与 v2 一一对应，没有做任何归并。
 *
 * element-plus / Vue3 适配：
 *   $refs.customPover[i].showPopper = true → v-model:visible + timePoverVisible[i]
 *   $refs.customPover[i].doClose()         → timePoverVisible[i] = false
 *   $refs.datePickerShow[i].focus()        → datePickerRefs[i]?.focus()
 *   $refs['cascader_one'+i][0] / $refs.setCascader[i] → 函数 ref 收进数组
 *   getCheckedNodes()                      → getCheckedNodes(false)（element-plus 必须显式传参）
 *   :picker-options                        → :shortcuts
 *   value-format="yyyy-MM-dd"              → "YYYY-MM-DD"
 *   :active-item-change                    → element-plus 没有这个属性，去掉
 *   :append-to-body="false"                → :teleported="false"
 *   slot="reference"                       → <template #reference>
 *   this.$set(a, k, v)                     → a[k] = v
 *   el-icon-xxx                            → <el-icon> + icons-vue（类名沿用 v2，样式不动）
 *   this.$message.error                    → ElMessage.error
 *
 * v2 里未搬运的死代码（模板和逻辑里都没有调用点，或者函数体整段被注释）：
 *   intervalEvent（空实现）、handleVisible（空实现，@visible-change 绑定一并去掉）、
 *   filterFieldType（函数体整段被注释，字段联级的 @change 绑定一并去掉）、
 *   clearVal2、getClasses、checkTypeArray、handleVisibleChange、checkpointProtoFrom、
 *   oldProperty（只被上面两个死方法读写）、initSumApi、
 *   computed projectName / divideList / firstOrLastList（本模块模板里没有用到）、
 *   getLetterByIndex（本模块模板没有 eg_letters 那一列）、
 *   isValidDateStr / splitDateRange / getLetterLowercase / strictMode / filterIstrue
 *   （改为 import 自 ../../local-utils，实现逐行一致）。
 */
import { computed, nextTick, ref, watch } from 'vue'
import { Close, Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { CascaderInstance } from 'element-plus'
import treeSelect from '@/views/ups/components/tree-select.vue'
import conditionOption from '../conditionOption.vue'
import { eventPreferenceList, groupValueType } from '@/utils/modelOptions/up-manage'
import type { CascaderOption } from '@/utils/modelOptions/up-manage'
import { getOptionsByType } from '@/utils/modelOptions/custom'
import {
  createUniqueString,
  filterIstrue,
  getLetterLowercase,
  isValidDateStr,
  rangeShortcuts,
  splitDateRange,
  strictMode,
} from '../../local-utils'
import type {
  ConditionItem,
  FilterBlock,
  MeasureItem,
  PointTypeList,
  PropertyListMap,
  PropertyNode,
  RadioOption,
} from '../../types'

/**
 * 事件偏好属性的一条 measure。
 * 公共 MeasureItem 上没有 fieldName / appearNum 这两个本模块独有的字段，就地扩展。
 * （index.vue 里有一份同形的声明。）
 */
type EventPreferenceMeasure = MeasureItem & {
  /** 事件字段（v2 的「新增 field 事件」联级） */
  fieldName: string
  /** 取前 N 名 */
  appearNum: number
}

/**
 * 判断条件选项（getOptionsByType 的返回项），与 `@/utils/modelOptions/custom` 的 OptionDef 同形。
 * （历史原因：local-utils 的 strictMode 早先约束成 `Record<string, unknown>`，接不住 interface；
 *  约束已改成 `T extends object`，这里直接换成 import OptionDef 也可以，保留不影响编译。）
 */
type OptionItem = { displayName: string; name: string }

interface BasicRulesModel {
  relation?: 'and' | 'or'
  measures: EventPreferenceMeasure[]
}

/** el-date-picker 实例上用得到的方法 */
interface DatePickerExposed {
  focus: () => void
}

const props = withDefaults(
  defineProps<{
    pointProtoList?: PropertyNode[]
    propertyList?: Partial<PropertyListMap>
    pointTypeList?: PointTypeList
    modelObject: BasicRulesModel
    cascaderList?: CascaderOption[]
  }>(),
  {
    pointProtoList: () => [],
    propertyList: () => ({
      commonPropertySum: [], // 共用事件属性
      userProperties: [], // 共用用户属性
      userGroupList: [], // 用户分群
    }),
    pointTypeList: () => ({ userProtoList: [], eventProtoList: [] }),
    cascaderList: () => [],
  },
)

const emit = defineEmits<{ dateTypeEvent: [dataType: string] }>()

const radioOptions: RadioOption[] = [
  { label: '事件属性', value: 'event_property' },
  // { label: "用户属性", value: "user_property" },
  // { label: "用户分群", value: "user_group" },
  // { label: "用户标签", value: "user_tag" },
]

const showCascadwe = ref(true)
const eventType = ref('')
const default_options = eventPreferenceList
const pointerDefaultOne = eventPreferenceList[0]?.name ?? ''
const pointerDefaultMeasureName = ref('')
const default_prototype = ref<PropertyNode | ''>('')
const initSelectObj = {
  dataType: '',
  displayName: '',
  name: '',
  propertyId: '',
}

/** 「相对时间/时间范围」弹窗的显隐，下标与 measures 对齐 */
const timePoverVisible = ref<boolean[]>([])
const datePickerRefs = ref<(DatePickerExposed | null)[]>([])
const cascaderOneRefs = ref<(CascaderInstance | null)[]>([])
/**
 * 与 v2 一致（v2 此处逻辑存疑：「字段」联级和「排序方式」联级都写成了 ref="setCascader"，
 * 在 Vue2 里两者会按渲染顺序挤进同一个数组 —— [字段0, 排序0, 字段1, 排序1, ...]，
 * 于是 $refs.setCascader[index] 取到的其实是第 index 个「字段」联级：
 * index=0 时恰好是本行的字段联级（所以单条规则下看不出问题），多条规则时会整体错位。
 * v3 用同一个扁平数组复刻这个下标关系：字段放 2*index、排序方式放 2*index+1。
 */
const setCascaderRefs = ref<(CascaderInstance | null)[]>([])

function setDatePickerRef(el: unknown, index: number) {
  if (el) datePickerRefs.value[index] = el as DatePickerExposed
}
function setCascaderOneRef(el: unknown, index: number) {
  if (el) cascaderOneRefs.value[index] = el as CascaderInstance
}
function setSetCascaderRef(el: unknown, slot: number) {
  if (el) setCascaderRefs.value[slot] = el as CascaderInstance
}

const measureList = computed<EventPreferenceMeasure[]>(() => props.modelObject.measures || [])

// el-popover 的 visible 必须是明确的布尔值才算「受控」，这里跟着 measures 长度补齐
watch(
  () => props.modelObject.measures.length,
  (len) => {
    for (let i = 0; i < len; i++) {
      if (timePoverVisible.value[i] === undefined) timePoverVisible.value[i] = false
    }
  },
  { immediate: true },
)

// 联级事件进行过滤出-事件属性
function pointProtoFilter(eventName: string): PropertyNode[] {
  let position: PropertyNode[] = []
  props.pointProtoList.map((a) => {
    a.events?.map((b) => {
      if (b.name == eventName) {
        return (position = b.propertyList ?? [])
      }
      return undefined
    })
  })
  return position
}

function formateFieldCascader(eventName: string): PropertyNode[]
function formateFieldCascader(eventName: string, fieldNameFlag: true): string
function formateFieldCascader(eventName: string, fieldNameFlag = false): PropertyNode[] | string {
  let options: PropertyNode[] = []
  props.pointProtoList.map((a) => {
    a.events?.map((b) => {
      if (b.name == eventName) {
        options = b.propertyList ?? []
      }
      return undefined
    })
  })
  const mergedArray = options
  const newArray: PropertyNode[] = mergedArray.map((item) => {
    return {
      dataType: item.dataType,
      displayName: item.displayName,
      name: item.name,
    }
  })
  if (fieldNameFlag) {
    // 与 v2 一致（v2 此处逻辑存疑：事件一个属性都没有时 newArray[0] 是 undefined，
    // v2 直接读 .name 会抛异常；开了 noUncheckedIndexedAccess 照抄编译不过，这里兜底成 ""）
    return newArray[0]?.name ?? ''
  }
  return newArray
}

function refreshEvent(indexNum: number) {
  props.pointProtoList.map((item, index) => {
    item.displayName = item.groupName ?? ''
    item.name = item.groupName ?? ''
    item.events?.map((sub, sub_index) => {
      if (sub_index == 0 && index == 0) {
        eventType.value = sub.name
      }
    })
  })
  const target = props.modelObject.measures[indexNum]
  if (!target) return
  target.eventName = eventType.value
  target.fieldName = formateFieldCascader(eventType.value, true)
  // 设置name 名称拼接
  pointerDefaultMeasureName.value =
    (props.pointProtoList[0]?.events?.[0]?.displayName ?? '') +
    '的' +
    (eventPreferenceList[0]?.displayName ?? '')
  target.name = pointerDefaultMeasureName.value
}

function circleAddEvent() {
  const object: EventPreferenceMeasure = {
    eventName: '',
    casList: [],
    appearNum: 1, //次数
    name: '',
    fieldName: '',
    echoObj: {
      lastRelativeTime: ['relative_time', '-1day'],
      timeScope: ['relative_time', '-1day'],
      lastAbsoluteTime: [],
      datePicker: [], //日期
      startNum: null,
      endNum: null,
    },
    // 与 v2 一致：事件偏好的 measure 对象里没有 function / params 两个字段
    // （公共类型 MeasureItem 上这两个字段已改为可选）
    earlistTime: '-1day',
    latestTime: 'now',
    filter: {
      relation: 'and',
      filters: [],
    },
  }
  props.modelObject.measures.push(object)
  const indexNum = props.modelObject.measures.length - 1
  const target = props.modelObject.measures[indexNum]
  if (!target) return

  target.casList = [pointerDefaultOne]
  target.aggregator = pointerDefaultOne
  if (props.pointProtoList.length < 1) {
    setTimeout(() => {
      refreshEvent(indexNum)
    }, 300)
    return
  }
  refreshEvent(indexNum)
}

function datePickerOptions(item: EventPreferenceMeasure) {
  const obj: CascaderOption = {
    label: '前' + item.echoObj.startNum + '天' + '到前' + item.echoObj.endNum + '天',
    value:
      `${'-'}${item.echoObj.startNum}${'day'}` + '~' + `${'-'}${item.echoObj.endNum}${'day'}`,
    custom: true,
  }
  const relative = props.cascaderList[1]
  if (relative && relative.children) {
    relative.children.push(obj)
    relative.children = relative.children.filter(
      (object, index, self) => index === self.findIndex((t) => t.label === object.label),
    )
  }

  // 进行赋值
  const newlevel = item.echoObj.timeScope
  // 步骤二
  newlevel[1] =
    `${'-'}${item.echoObj.startNum}${'day'}` + '~' + `${'-'}${item.echoObj.endNum}${'day'}`
  item.echoObj.timeScope = newlevel

  // 后端字段进行赋值 earlist和latest字段
  item.earlistTime = `${'-'}${item.echoObj.startNum}${'day'}`
  item.latestTime = `${'-'}${item.echoObj.endNum}${'day'}`
  //缓存相对时间非自定义上次数据
  item.echoObj.lastRelativeTime = newlevel
}

// 日期事件
function checkDateEvent(val: [string, string] | null, item: EventPreferenceMeasure) {
  // 与 v2 一致（v2 此处逻辑存疑：清空日期时 val 为 null，v2 直接读 val[0] 会抛异常；
  // v3 的类型里 val 可能为 null，必须先挡一下）
  if (!val) return
  const obj: CascaderOption = {
    label: val[0] + '~' + val[1],
    value: val[0] + '~' + val[1],
  }
  const absolute = props.cascaderList[0]
  if (absolute && absolute.children) {
    absolute.children.push(obj)
    absolute.children = absolute.children.filter(
      (object, index, self) => index === self.findIndex((t) => t.label === object.label),
    )
  }

  // 进行赋值
  const newlevel = item.echoObj.timeScope
  newlevel[1] = val[0] + '~' + val[1]
  item.echoObj.timeScope = newlevel
  // 与 v2 一致（v2 此处逻辑存疑：basicpointer 的同名方法会顺手把 earlistTime / latestTime
  // 换算成时间戳，本模块没有这两行，选完绝对日期区间后后端字段仍停在上一次的值）
  //缓存绝对时间 非自定义上次数据
  item.echoObj.lastAbsoluteTime = newlevel
}

//日历控件关闭后的操作
function dateBlur(item: EventPreferenceMeasure) {
  if (item.echoObj.lastAbsoluteTime.length > 0) {
    item.echoObj.timeScope = item.echoObj.lastAbsoluteTime
  } else {
    item.echoObj.timeScope = item.echoObj.lastRelativeTime
  }
}

function clickCascader(val: unknown, index: number, item: EventPreferenceMeasure) {
  const path = (val as string[] | null) || []
  // 自定义事件
  if (path.length > 1) {
    const second = path[1] ?? ''
    if (second == 'custom') {
      // pover 自定义天数
      timePoverVisible.value[index] = true
    } else if (second == 'time_scope') {
      // 自定义日期范围
      datePickerRefs.value[index]?.focus()
    } else {
      // 设置后端字段进行赋值 earlist和latest字段
      const dateTime = splitDateRange(second)
      if (dateTime) {
        const start = dateTime[0]
        const end = dateTime[1]
        if (start && end && isValidDateStr(start) && isValidDateStr(end)) {
          // 转换为时间戳（秒）
          item.earlistTime = Math.floor(new Date(start).getTime() / 1000)
          item.latestTime = Math.floor(new Date(end).getTime() / 1000)
        }
      } else {
        // 直接选择联级相对时间段
        item.earlistTime = second
        item.latestTime = 'now'
      }
    }
  }
}

function closePover(index: number, isTrue?: boolean, item?: EventPreferenceMeasure) {
  // 相对时间自定义天数   新增类
  if (isTrue && item) {
    item.echoObj.lastAbsoluteTime = []
    if (Number(item.echoObj.startNum) < Number(item.echoObj.endNum)) {
      ElMessage.error('开始时间必须早于结束时间')
      return
    }
    datePickerOptions(item)
  }
  timePoverVisible.value[index] = false
}

function handleHide(item: EventPreferenceMeasure) {
  if (item.echoObj.lastAbsoluteTime.length > 0) {
    item.echoObj.timeScope = item.echoObj.lastAbsoluteTime
  } else {
    item.echoObj.timeScope = item.echoObj.lastRelativeTime
  }
}

function testArray(val: unknown[]) {
  return val
}

function formatAggregator(val: string): PropertyNode[] {
  let options: PropertyNode[] = []
  props.pointProtoList.map((a) => {
    a.events?.map((b) => {
      if (b.name == val) {
        options = b.propertyList ?? []
      }
      return undefined
    })
  })
  // 与 v2 一致（v2 此处逻辑存疑：上面按 eventName 算出来的 options 根本没用上，
  // 返回的始终是固定的 eventPreferenceList）
  void options
  return default_options as unknown as PropertyNode[]
}

/** 与 v2 一致：每次渲染都会生成新 key，强制 el-cascader 重建 */
function generateRandomKey() {
  return createUniqueString()
}

function pickCheckedNodes(index: number) {
  const one = cascaderOneRefs.value[index]?.getCheckedNodes(false) || []
  // setCascaderRefs 的下标语义见上方声明处的说明（复刻 v2 的 $refs.setCascader[index]）
  const two = setCascaderRefs.value[index]?.getCheckedNodes(false) || []
  return {
    labelOne: one[0]?.pathLabels || [],
    pathLabels: two[0]?.pathLabels || [],
    checkedData: two[0]?.data,
  }
}

// 切换事件name
function fileterCascader(item: EventPreferenceMeasure, index: number) {
  void nextTick(() => {
    const { labelOne, pathLabels } = pickCheckedNodes(index)
    if (pathLabels.length > 1) {
      // item.defaultMeasureName =
      //   labelOne[1] + "的" + pathLabels[0] + "的" + pathLabels[1];
      item.name = (labelOne[1] + '的' + pathLabels[0] + '的' + pathLabels[1]).trim()
    } else {
      // item.defaultMeasureName = labelOne[1] + "的" + pathLabels[0];
      item.name = labelOne[1] + '的' + pathLabels[0]
    }
    item.fieldName = formateFieldCascader(item.eventName, true)
  })
}

function filterDataType(item: EventPreferenceMeasure, index: number) {
  const { labelOne, pathLabels, checkedData } = pickCheckedNodes(index)
  const dataType = checkedData ? checkedData.dataType : undefined
  emit('dateTypeEvent', dataType === undefined || dataType === null ? '' : String(dataType))

  if (pathLabels.length > 1) {
    item.name = (labelOne[1] + '的' + pathLabels[0] + '的' + pathLabels[1]).trim()
  } else {
    item.name = (labelOne[1] + '的' + pathLabels[0]).trim()
  }
  if (item.casList.length > 1) {
    item.aggregator = item.casList[1]
  } else {
    item.aggregator = item.casList[0]
  }
}

// select 数据过滤
function checkbtnPoint(fieldType: string, eventName: string): PropertyNode[] {
  let position: PropertyNode[] = []
  if (fieldType == 'event_property') {
    props.pointProtoList.map((a) => {
      a.events?.map((b) => {
        if (b.name == eventName) {
          return (position = b.propertyList ?? [])
        }
        return undefined
      })
    })
    if (fieldType == 'event_property' && position.length > 0) {
      default_prototype.value = position[0] ?? ''
    }
  } else {
    // position = this.userProtoList;
    position = props.pointTypeList.userProtoList
  }
  return position
}

// 相对时间发生时间
function checkRelativeTime(condition: ConditionItem) {
  if (condition.function == 'relative_event_time') {
    condition.params[0] = 'afterDay'
    condition.params[2] = 'day'
  }
}

function filterJudgmentType(list: PropertyNode[], val?: string): OptionItem[] {
  let options: OptionItem[] = []
  list.map((item) => {
    if (item.name == val) {
      options = getOptionsByType(item.dataType)
    }
  })
  return options
}

// 切换
function checkJudgmentType(val: string | undefined, second_item: ConditionItem): OptionItem[] {
  let options: OptionItem[] = []
  if (!val) return options
  if (second_item.fieldType == 'user_group') {
    options = groupValueType
  } else {
    props.pointTypeList.eventProtoList.map((item) => {
      if (item.name == val) {
        options = getOptionsByType(item.dataType)
      }
    })
    // 用户数据筛选
    if (options.length == 0) {
      // 与 v2 一致（v2 此处逻辑存疑：filterJudgmentType 的第二个参数没传，
      // 内部 item.name == undefined 永远不成立，返回的始终是空数组）
      options = filterJudgmentType(props.pointTypeList.userProtoList)
    }
  }

  return options
}

function filterPiPei(val: ConditionItem) {
  val.params = []
}

function deleteFirstCondition(filter: FilterBlock, secondP_index: number, index: number) {
  filter.filters.splice(secondP_index, index)
  if (filter.filters.length < 2) {
    delete filter.relation
  }
}

// 严格检验字段模式 / 判断条件列表：strictMode、filterIstrue 见 ../../local-utils
function filterCommonType(type?: string): OptionItem[] | '' {
  if (!type) return ''
  let options: OptionItem[] = []
  options = getOptionsByType(type)
  return options
}

// 增加默认值  一级事件
function firstLevelEvent(secondLevel: FilterBlock, eventName: string) {
  const list = checkbtnPoint('event_property', eventName)
  const dataType = list[0]?.dataType || ''
  // 没有初始值则设置初始值
  if (!secondLevel.relation) {
    secondLevel.relation = 'and'
  }
  const proto = default_prototype.value
  secondLevel.filters.push({
    conditions: [
      {
        field: strictMode(list, 'name'),
        dataType: dataType,
        function: strictMode(filterCommonType(proto ? proto.dataType : undefined), 'name'),
        fieldType: 'event_property',
        params: [],
      },
    ],
  })
}

// 增加默认值  二级事件
function secondLevelEvent(
  secondP_index: number,
  second_index: number,
  second_list: FilterBlock,
  model?: string,
) {
  let field = '',
    dataType = ''
  const proto = default_prototype.value
  if (model == 'gloab') {
    field = initSelectObj.name
    dataType = initSelectObj.dataType
  } else {
    field = (proto ? proto.name : '') || ''
    dataType = (proto ? proto.dataType : '') || ''
  }
  const addObj: ConditionItem = {
    field: field,
    dataType: dataType,
    function: strictMode(filterCommonType(dataType), 'name'),
    fieldType: 'event_property',
    params: [],
  }
  second_list.filters.map((item, index) => {
    if (secondP_index == index) {
      item.relation = 'and'
      item.conditions.push(addObj)
      // v2 这里还有 this.$set(item.conditions, "params", [])：往数组对象上挂了个
      // 名为 params 的属性，没有任何读取方，是无效写入，不再搬运。
    }
  })
}

// 平级事件
function equalityEvent(
  secondP_index: number,
  second_index: number,
  three_list: FilterBlock,
  model?: string,
) {
  let field = '',
    dataType = ''
  const proto = default_prototype.value
  if (model == 'gloab') {
    field = initSelectObj.name
    dataType = initSelectObj.dataType
  } else {
    field = (proto ? proto.name : '') || ''
    dataType = (proto ? proto.dataType : '') || ''
  }
  three_list.filters.map((item, index) => {
    if (index == secondP_index) {
      const threeObj: ConditionItem = {
        field: field,
        dataType: dataType,
        function: strictMode(filterCommonType(dataType), 'name'),
        fieldType: 'event_property',
        params: [],
      }
      item.conditions[item.conditions.length] = threeObj
    }
  })
}

function threeDeleteEvent(
  secondP_index: number,
  second_index: number,
  three_list: FilterBlock['filters'],
) {
  three_list[secondP_index]?.conditions.splice(second_index, 1)
}

defineExpose({ circleAddEvent })
</script>

<template>
  <div class="box-card">
    <div>
      <el-row>
        <div style="display: flex">
          <!-- 一级且或 -->
          <div v-show="modelObject.measures.length > 1" class="andOrNot">
            <div class="btn_line"></div>
            <el-radio-group v-model="modelObject.relation" size="small" class="custom_btn">
              <el-radio-button value="and">且</el-radio-button>
              <el-radio-button value="or">或</el-radio-button>
            </el-radio-group>
            <div class="btn_line"></div>
          </div>
          <div :style="modelObject.measures.length > 1 ? 'margin-left: 40px' : ''">
            <div v-for="(item, index) in measureList" :key="index">
              <el-row
                style="display: flex; flex-direction: column; margin-bottom: 5px"
                class="child"
              >
                <!-- 一级条件样式 -->
                <div class="pointer_spacing" style="display: flex; align-items: center">
                  <!-- 增加绝对日期选择 -->
                  <div style="position: relative">
                    <el-cascader
                      v-if="showCascadwe"
                      v-model="item.echoObj.timeScope"
                      :show-all-levels="true"
                      style="width: 250px; z-index: 100"
                      :options="cascaderList"
                      clearable
                      filterable
                      @change="clickCascader($event, index, item)"
                    ></el-cascader>

                    <div style="position: absolute; top: 3px; height: 30px">
                      <el-date-picker
                        :ref="(el: unknown) => setDatePickerRef(el, index)"
                        v-model="item.echoObj.datePicker"
                        type="daterange"
                        range-separator="至"
                        start-placeholder="开始日期"
                        end-placeholder="结束日期"
                        value-format="YYYY-MM-DD"
                        :shortcuts="rangeShortcuts"
                        @change="checkDateEvent($event, item)"
                        @blur="dateBlur(item)"
                      >
                      </el-date-picker>
                    </div>
                    <!-- popver 自定义逻辑 -->
                    <div style="position: absolute; top: 3px; height: 30px">
                      <el-popover
                        v-model:visible="timePoverVisible[index]"
                        placement="bottom"
                        title="相对时间/时间范围"
                        :width="300"
                        style="background: #fff !important"
                        trigger="click"
                        @hide="handleHide(item)"
                      >
                        <template #reference>
                          <div style="height: 30px; width: 250px; background: #fff"></div>
                        </template>
                        <div>
                          <div class="pover_inner">请输入1-365范围内的整数</div>
                          <div class="pover_inner" style="display: flex; margin-top: 5px">
                            开始时间: 前
                            <el-input-number
                              v-model="item.echoObj.startNum"
                              class="customNum"
                              :min="1"
                              :max="365"
                            ></el-input-number>
                          </div>
                          <div class="pover_inner" style="margin: 15px 0">
                            结束时间: 前
                            <el-input-number
                              v-model="item.echoObj.endNum"
                              class="customNum"
                              :min="1"
                              :max="365"
                            ></el-input-number>
                          </div>
                          <div class="pover_inner">
                            <el-button class="zc_btn_default" @click="closePover(index)"
                              >取消</el-button
                            >
                            <el-button class="zc_btn" @click="closePover(index, true, item)"
                              >确定</el-button
                            >
                          </div>
                        </div>
                      </el-popover>
                    </div>
                  </div>
                  <div class="customSpace">完成</div>

                  <el-cascader
                    :key="generateRandomKey()"
                    :ref="(el: unknown) => setCascaderOneRef(el, index)"
                    v-model="item.eventName"
                    :options="pointProtoList"
                    :show-all-levels="false"
                    style="font-size: 13px; margin-right: 10px"
                    class="custom_cascader"
                    filterable
                    :props="{
                      value: 'name',
                      label: 'displayName',
                      children: 'events',
                      multiple: false,
                      emitPath: false,
                    }"
                    @change="fileterCascader(item, index)"
                  ></el-cascader>
                  <!-- 增加备注 -->

                  <!-- 新增field事件-->
                  <el-cascader
                    :key="generateRandomKey()"
                    :ref="(el: unknown) => setSetCascaderRef(el, index * 2)"
                    v-model="item.fieldName"
                    style="margin-right: 20px; font-size: 13px"
                    :teleported="false"
                    :options="formateFieldCascader(item.eventName)"
                    :props="{
                      value: 'name',
                      label: 'displayName',
                      children: 'events',
                      multiple: false,
                      emitPath: false,
                    }"
                    separator="的"
                    filterable
                    class="cascader_border"
                  ></el-cascader>
                  <!-- end -->

                  <div style="position: relative">
                    <el-cascader
                      :key="generateRandomKey()"
                      :ref="(el: unknown) => setSetCascaderRef(el, index * 2 + 1)"
                      v-model="item.casList"
                      :teleported="false"
                      :options="formatAggregator(item.eventName)"
                      :props="{
                        value: 'name',
                        label: 'displayName',
                        children: 'events',
                        multiple: false,
                      }"
                      separator="的"
                      style="font-size: 13px"
                      filterable
                      class="cascader_border"
                      @change="filterDataType(item, index)"
                    ></el-cascader>
                  </div>

                  <div class="customSpace">前</div>
                  <el-input-number
                    v-model="item.appearNum"
                    style="height: 30px; line-height: 28px; width: 60px"
                    :min="1"
                    :max="365"
                  ></el-input-number>
                  <div class="customSpace">名</div>

                  <!-- 禁用回显展示 -->
                  <!-- v2 这里有一段被整体注释掉的只读 el-cascader，保持注释状态 -->
                  <!-- end -->
                  <el-icon
                    v-if="modelObject.measures.length > 1"
                    class="el-icon-close delete_btn"
                    @click="modelObject.measures.splice(index, 1)"
                  >
                    <Close />
                  </el-icon>
                </div>
                <div
                  v-if="item.filter.filters.length > 0"
                  style="
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    height: 100%;
                  "
                >
                  <div
                    v-if="item.filter.filters.length > 1"
                    style="
                      color: gray;
                      font-size: 13px;
                      position: absolute;
                      left: 0px;
                      height: calc(100% - 15px);
                      display: flex;
                      top: 15px;
                      flex-direction: column;
                      justify-content: center;
                      align-items: center;
                      z-index: 666;
                    "
                  >
                    <div class="btn_line" />
                    <el-radio-group v-model="item.filter.relation" size="small" class="custom_btn">
                      <el-radio-button value="and">且</el-radio-button>
                      <el-radio-button value="or">或</el-radio-button>
                    </el-radio-group>
                    <div class="btn_line" />
                  </div>

                  <div
                    v-for="(secondP_item, secondP_index) in item.filter.filters"
                    :key="secondP_index"
                    style="position: relative"
                  >
                    <div v-if="secondP_item.conditions.length > 1">
                      <div
                        class="letter_lower"
                        style="
                          position: absolute;
                          left: 40px;
                          display: flex;
                          align-items: center;
                          height: calc(100% + 15px);
                        "
                      >
                        {{ getLetterLowercase(secondP_index) }}
                      </div>
                      <div
                        style="
                          color: gray;
                          font-size: 10px;
                          position: absolute;
                          left: 50px;
                          display: flex;
                          height: calc(100% - 15px);
                          top: 15px;
                          flex-direction: column;
                          justify-content: center;
                          align-items: center;
                          z-index: 666;
                        "
                      >
                        <div class="btn_line" />
                        <el-radio-group
                          v-model="secondP_item.relation"
                          size="small"
                          class="custom_btn"
                        >
                          <el-radio-button value="and">且</el-radio-button>
                          <el-radio-button value="or">或</el-radio-button>
                        </el-radio-group>
                        <div class="btn_line" />
                      </div>
                    </div>
                    <div
                      v-for="(second_item, second_index) in secondP_item.conditions"
                      :key="second_index"
                      class="pointer_spacing"
                      style="margin-left: 43px; position: relative"
                    >
                      <!-- 指标二级筛选事件 -->
                      <div v-if="secondP_item.conditions.length > 1">
                        <div
                          style="
                            display: flex;
                            padding-top: 10px;
                            align-items: flex-start;
                            margin-left: 45px;
                          "
                        >
                          <treeSelect
                            :radio-options="radioOptions"
                            :second_item="second_item"
                            :property-list="propertyList"
                            :second_index="second_index"
                            :point-proto-list="pointProtoFilter(item.eventName)"
                          ></treeSelect>
                          <el-select
                            v-model="second_item.function"
                            placeholder=""
                            style="width: 100px; margin-left: 15px"
                            @change="checkRelativeTime(second_item)"
                          >
                            <el-option
                              v-for="x in checkJudgmentType(second_item.field, second_item)"
                              :key="x.name"
                              :label="x.displayName"
                              :value="x.name"
                            >
                              {{ x.displayName }}
                            </el-option>
                          </el-select>
                          <div v-if="filterIstrue(second_item.function)">
                            <el-select
                              v-model="second_item.params"
                              style="margin-left: 10px; min-height: 30px; min-width: 350px"
                              :class="'second_select' + second_index"
                              multiple
                              filterable
                              allow-create
                              default-first-option
                              placeholder=""
                            >
                              <el-option
                                v-for="(x, x_index) in testArray(second_item.params)"
                                :key="x_index"
                                :label="String(x)"
                                :value="x"
                              >
                                <!-- <div >{{ x }} </div> -->
                              </el-option>
                            </el-select>
                          </div>

                          <!-- 封装组件 -->
                          <condition-option :condition="second_item"></condition-option>

                          <el-icon
                            class="el-icon-close delete_btn"
                            style="line-height: 30px"
                            @click="
                              threeDeleteEvent(secondP_index, second_index, item.filter.filters)
                            "
                          >
                            <Close />
                          </el-icon>
                        </div>
                        <div
                          v-if="secondP_item.conditions.length == second_index + 1"
                          style="display: flex; margin-left: 45px"
                        >
                          <!-- v2 是 <i class="el-icon-plus">添加过滤条件</i>，图标靠字体类；
                               v3 换成 icons-vue 组件，外层类名沿用 el-icon-plus，样式规则不用动 -->
                          <span
                            class="el-icon-plus"
                            style="padding: 0px 0 0 0"
                            @click="equalityEvent(secondP_index, second_index, item.filter)"
                          >
                            <el-icon><Plus /></el-icon>添加过滤条件
                          </span>
                        </div>
                      </div>
                      <!-- 事件指标  一级筛选层条件 -->
                      <div v-else>
                        <div style="display: flex; padding-top: 10px; align-items: flex-start">
                          <div class="letter_lower" style="margin-right: 7px">
                            {{ getLetterLowercase(secondP_index) }}
                          </div>
                          <treeSelect
                            :radio-options="radioOptions"
                            :second_item="second_item"
                            :property-list="propertyList"
                            :second_index="second_index"
                            :point-proto-list="pointProtoFilter(item.eventName)"
                          ></treeSelect>

                          <el-select
                            v-model="second_item.function"
                            placeholder=""
                            style="width: 140px; margin-left: 15px"
                            @change="checkRelativeTime(second_item)"
                          >
                            <el-option
                              v-for="x in checkJudgmentType(second_item.field, second_item)"
                              :key="x.name"
                              :label="x.displayName"
                              :value="x.name"
                            >
                              <div @click="filterPiPei(second_item)">
                                {{ x.displayName }}
                              </div>
                            </el-option>
                          </el-select>

                          <!-- 区间 正则 匹配规则 -->
                          <condition-option :condition="second_item"></condition-option>
                          <div v-if="filterIstrue(second_item.function)">
                            <el-select
                              v-model="second_item.params"
                              style="margin-left: 15px; min-width: 350px"
                              multiple
                              filterable
                              allow-create
                              default-first-option
                              placeholder=""
                            >
                              <el-option
                                v-for="x in second_item.params"
                                :key="String(x)"
                                :label="String(x)"
                                :value="x"
                              >
                                {{ x }}
                              </el-option>
                            </el-select>
                          </div>

                          <el-icon
                            class="el-icon-close delete_btn"
                            @click="deleteFirstCondition(item.filter, secondP_index, 1)"
                          >
                            <Close />
                          </el-icon>
                        </div>
                        <div v-if="item.filter.filters.length > 1" style="display: flex">
                          <!-- 增加默认值 -->
                          <span
                            class="el-icon-plus"
                            style="padding: 0px 0 0 13px"
                            @click="secondLevelEvent(secondP_index, second_index, item.filter)"
                          >
                            <el-icon><Plus /></el-icon>添加过滤条件
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <!-- 一级 增加默认值 -->
                <div
                  v-if="pointProtoList.length > 0"
                  style="display: flex; margin-top: 5px; margin-bottom: 8px"
                >
                  <span
                    class="el-icon-plus pointer_spacing"
                    @click="firstLevelEvent(item.filter, item.eventName)"
                  >
                    <el-icon><Plus /></el-icon>添加过滤条件
                  </span>
                </div>
              </el-row>
            </div>
          </div>
        </div>
      </el-row>
    </div>
  </div>
</template>

<style lang="scss">
// 匹配不到样式隐藏
.el-select-dropdown__empty {
  display: none !important;
}
</style>

<style lang="scss" scoped>
.customSpace {
  font-size: 13px;
  color: #514f4f !important;
  padding: 0 10px;
  white-space: nowrap;
}

.headTitle {
  width: 80px;
  line-height: 30px;
}

// 且或
.andOrNot {
  // min-height: 200px;
  color: gray;
  font-size: 13px;
  position: absolute;
  left: 0px;
  height: calc(100% - 0px);
  display: flex;
  top: 0px;
  flex-direction: column;
  justify-content: center;
  align-items: center;

  .btn_line {
    width: 1px;
    height: 100%;
    border-right: 1px solid rgb(218, 217, 217);
  }
}

p {
  white-space: nowrap;
  padding: 0;
  margin: 0;
}

//pover
.pover_inner {
  display: flex;
  font-size: 14px;
  line-height: 35px;
  background: #fff;
}

.titleHead {
  color: #6d6e70;
  font-size: 13px;
}

:deep(.el-input-group__append),
:deep(.el-input-group__prepend) {
  padding: 0 10px;
}

// 天数el-input-number 自定义
:deep(.el-input-number) {
  width: 160px !important;
}

:deep(.customNum) {
  margin-left: 5px;

  .el-input__wrapper {
    height: 36px;
  }
}

:deep(.el-button) {
  height: 30px;
}

//日期
:deep(.el-range-editor) {
  height: 30px;
  width: 250px;
}

:deep(.el-popover) {
  background: #fff;
}

// end
:deep(.el-loading-spinner .circular) {
  height: 38px !important;
}

:deep(.el-input__inner::placeholder) {
  font-size: 11px;
}

:deep(.custom_btn .el-radio-button__original-radio:checked + .el-radio-button__inner) {
  font-size: 10px;
}

:deep(.custom_btn .el-radio-button:last-child .el-radio-button__inner) {
  font-size: 10px;
}

:deep(.el-radio-button:first-child .el-radio-button__inner) {
  font-size: 10px;
}

:deep(.el-select__wrapper) {
  min-height: 30px;
  line-height: 30px;
  font-size: 12px;
}

:deep(.el-select-dropdown__list) {
  padding: 0 0 6px;
}

:deep(.el-radio-group) {
  margin: 0 5px;
}

:deep(.el-radio-button__inner) {
  border-left: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 6px;
  font-size: 13px;
}

:deep(.el-radio-button:last-child .el-radio-button__inner) {
  border-radius: 4px;
}

:deep(.el-radio-button) {
  height: 20px;
  font-size: 12px;
}

:deep(.el-input__wrapper) {
  height: 30px;
  line-height: 30px;
  font-size: 12px;
}

:deep(.el-cascader .el-input__inner) {
  font-size: 12px;
}

:deep(.custom_btn) {
  padding: 1px 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;

  .el-radio-button:first-child .el-radio-button__inner {
    border-radius: 4px 4px 0 0;
  }

  .el-radio-button:last-child .el-radio-button__inner {
    border-radius: 0 0 4px 4px;
  }

  .el-radio-button--small .el-radio-button__inner {
    padding: 5px;
  }

  .el-radio-button__original-radio:checked + .el-radio-button__inner {
    color: #ffffff;
    background-color: #619ff3;
    border-color: #619ff3;
    -webkit-box-shadow: -1px 0 0 0 #619ff3;
    box-shadow: -1px 0 0 0 #619ff3;
  }
}

.letter_lower {
  font-size: 14px;
  line-height: 30px;
}

.btn_line {
  width: 1px;
  height: 100%;
  border-right: 1px solid rgb(218, 217, 217);
}

.empty-text {
  display: flex;
  text-align: center;
  color: #909399;
  padding: 10px 0;
  margin-bottom: 10px;
}

.select_empty {
  text-align: center;
  margin-bottom: 10px;
  font-size: 12px;
  color: #909399;
}

.box-card {
  // 指标间距
  margin: 15px 0px;

  .el-icon-plus {
    color: #2c7be5;
    font-size: 13px;
    margin-top: 3px;
    box-sizing: border-box;
    cursor: pointer;
  }

  .eg_letters {
    color: rgb(101, 100, 100);
    width: 30px;
    height: 30px;
    font-size: 14px;
    display: flex;
    justify-content: center;
    align-items: center;
    font-weight: 400;
    margin-right: 10px;
  }

  .default_font {
    color: #fff;
    font-size: 14px;
  }

  .el-icon-close:hover {
    color: #2c7be5;
  }

  .add_icon {
    cursor: pointer;
    font-size: 30px;
    font-weight: 400;
    // margin-top: 15px;
    color: rgb(225, 225, 225);
  }

  .delete_btn {
    cursor: pointer;
    font-size: 16px;
    margin: 0 8px;
    line-height: 30px;
    color: rgb(188, 188, 188);
  }

  .circle {
    width: 25px;
    height: 25px;
    border-radius: 50%;
    background-color: #fff;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 20px;
    font-weight: 400;
    border: 1px solid #2c7be5;
    color: #2c7be5;
    cursor: pointer;
  }

  .circle::after {
    content: '+';
  }

  .tipSpan {
    margin: 0 15px;
    font-size: 13px;
    color: #606266;
    line-height: 30px;
  }
}
</style>
