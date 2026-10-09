<script setup lang="ts">
/**
 * 群画像 - 「行为序列」规则编辑器（外层）
 * （对应 v2 `views/ups/userPortrait/components/customTagPage/typeRules/sequenceRules.vue`）。
 *
 * 负责 sequenceObj.sequence.sequences 数组、每条序列的日历联级 / 自定义天数 popover；
 * 每条序列内部的步骤卡片交给 ./sequenceCard.vue。
 *
 * 数据流与 v2 完全一致：直接就地修改父级传进来的 sequenceObj 与 cascaderList
 * （v2 用的是 props + this.$set），父组件 tagRules 拿的是同一个对象引用。
 *
 * 与 v2 一致（v2 此处逻辑存疑：computed projectName（$store.getters.projectName）在模板里没用过，
 * 这里不再搬运）。
 *
 * 注意：`customTagPage/` 在 v2 里 userPortrait / userTag / usergroup 各有一份独立副本，
 * 这一份严格以 userPortrait 的为准。
 */
import { ref } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import { ElMessage } from 'element-plus'
import { Close, Plus } from '@element-plus/icons-vue'
import { copyObj } from '@/utils/copy'
import sequenceCard from './sequenceCard.vue'
import { rangeShortcuts } from '../../../options'
import type {
  CascaderNode,
  EventGroup,
  PortraitRules,
  PropertyListMap,
  SequenceItem,
  SequenceStep,
} from '../../../types'

const props = withDefaults(
  defineProps<{
    /** 模型数据 */
    sequenceObj: PortraitRules
    pointProtoList?: EventGroup[]
    /** 'number' 时序列编号用 1、2、3，否则用 A、B、C */
    headType?: string
    cascaderList?: CascaderNode[]
    propertyList?: Partial<PropertyListMap>
  }>(),
  {
    pointProtoList: () => [],
    headType: '',
    cascaderList: () => [],
    propertyList: () => ({
      commonPropertySum: [], // 共用事件属性
      userProperties: [], // 共用用户属性
      userGroupList: [], // 用户分群
    }),
  },
)

/**
 * v2 的 pickerOptions.shortcuts（最近一周 / 一个月 / 三个月）。
 * element-plus 不再支持 picker-options，拆成 :shortcuts，
 * 快捷项由 `onClick(picker){picker.$emit('pick', [start, end])}` 改成 `value: () => [start, end]`。
 */
const pickerShortcuts = rangeShortcuts

/** v2 的 this.eventType / this.event_displayName（普通实例变量，不参与渲染） */
let eventType = ''
let event_displayName = ''

/**
 * 且 / 或：element-plus 的 el-radio-group 在 update:modelValue 里给的是
 * string | number | boolean | undefined，写不回 relation: string，所以拆成受控写法收窄一下。
 */
function setSequenceRelation(val: string | number | boolean | undefined) {
  props.sequenceObj.sequence.relation = val == null ? '' : String(val)
}

// ---------------------------------------------------------------------------
// $refs → ref 数组 / 受控 visible
// v2: ref="customPover"       → this.$refs.customPover[index].showPopper = true / .doClose()
//     ref="datePickerShow"    → this.$refs.datePickerShow[index].focus()
// v3: el-popover 在 element-plus 里没有 showPopper / doClose，改用受控的 v-model:visible，
//     showPopper = true  → 对应下标置 true；
//     doClose()          → 对应下标置 false。
//     注意：element-plus 的 el-popover 一旦传了 visible 就是完全受控，trigger="click" 不再生效；
//     本组件里 popover 的 reference 是一块被 el-cascader（z-index:100）盖住的占位 div，
//     用户本来也点不到它，弹层只会被联级选到「自定义」时打开、被取消/确定按钮关闭，行为与 v2 一致。
// ---------------------------------------------------------------------------
const poverVisible = ref<boolean[]>([])

function isPoverVisible(index: number): boolean {
  return poverVisible.value[index] === true
}

function setPoverVisible(index: number, visible: boolean) {
  poverVisible.value[index] = visible
}

/** element-plus 的 el-date-picker 实例同样有 focus()；展开面板要用 handleOpen()，拿不到就跳过 */
interface DatePickerExposed {
  focus?: () => void
  handleOpen?: () => void
}

const datePickerRefs: (DatePickerExposed | null)[] = []

function setDatePickerRef(el: Element | ComponentPublicInstance | null, index: number) {
  datePickerRefs[index] = (el as unknown as DatePickerExposed | null) ?? null
}

// ---------------------------------------------------------------------------
// 方法
// ---------------------------------------------------------------------------

function getLetterByIndex(index: number) {
  if (index < 0 || index >= 26) {
    return String.fromCharCode(65 + (index % 26))
  }
  return String.fromCharCode(65 + index) // 65 是大写字母 A 的 ASCII 编码
}

function circleAddEvent() {
  // 设置初始值
  props.pointProtoList.map((item, index) => {
    item.displayName = item.groupName
    item.name = item.groupName
    item.events.map((sub, sub_index) => {
      if (sub_index == 0 && index == 0) {
        eventType = sub.name ?? ''
        event_displayName = sub.displayName ?? ''
      }
    })
  })
  // end

  const params: SequenceStep = {
    eventName: eventType,
    name: event_displayName,
    // aggregator: "",
    // field:"",
    // fieldType:'',
    filter: {
      relation: 'and',
      filters: [],
    },
  }
  const measures: SequenceStep[] = []
  // 依次默认增加两个事件
  measures.push(params)
  measures.push(copyObj(params))

  props.sequenceObj.sequence.sequences.push({
    // measures: measures,
    steps: measures,
    earlistTime: '-1day',
    latestTime: 'now',
    echoObj: {
      lastRelativeTime: ['relative_time', '-1day'],
      timeScope: ['relative_time', '-1day'],
      lastAbsoluteTime: [],
      datePicker: [], // 日期
      startNum: null,
      endNum: null,
    },
  })
}

/** el-cascader 的 v-model：timeScope 在类型里是 string[]，联级给的是 CascaderValue，拆成受控写法 */
function setTimeScope(item: SequenceItem, val: unknown) {
  item.echoObj.timeScope = Array.isArray(val) ? (val as string[]) : []
}

/** el-date-picker 的 v-model：datePicker 在类型里是 string[]，日期控件给的是联合类型，拆成受控写法 */
function setDatePicker(item: SequenceItem, val: unknown) {
  item.echoObj.datePicker = Array.isArray(val) ? (val as string[]) : []
}

function setStartNum(item: SequenceItem, val: number | undefined) {
  item.echoObj.startNum = val ?? null
}

function setEndNum(item: SequenceItem, val: number | undefined) {
  item.echoObj.endNum = val ?? null
}

// 日历控件关闭后的操作
function checkDateEvent(val: unknown, item: SequenceItem) {
  const range = Array.isArray(val) ? (val as string[]) : []
  // 与 v2 一致（v2 此处逻辑存疑：清空日期时 val 是 null，v2 直接取 val[0] 会抛异常；
  // 这里取不到区间就直接返回，不再往下走）
  if (range.length < 2) return
  const start = range[0] ?? ''
  const end = range[1] ?? ''

  const obj: CascaderNode = {
    label: start + '~' + end,
    value: start + '~' + end,
  }
  const absolute = props.cascaderList[0]
  if (absolute) {
    if (!absolute.children) absolute.children = []
    absolute.children.push(obj)
    absolute.children = absolute.children.filter(
      (object, index, self) => index === self.findIndex((t) => t.label === object.label),
    )
  }

  // 进行赋值
  const newlevel = item.echoObj.timeScope
  newlevel[1] = start + '~' + end
  item.echoObj.timeScope = newlevel
  // 后端字段进行赋值 earlist和latest字段
  item.earlistTime = Math.floor(new Date(start).getTime() / 1000)
  item.latestTime = Math.floor(new Date(end).getTime() / 1000)
  // 缓存绝对时间 非自定义上次数据
  item.echoObj.lastAbsoluteTime = newlevel
}

// v2 形参是 (val, item)，val 从来没用过，这里只收 item
function dateBlur(item: SequenceItem) {
  if (item.echoObj.lastAbsoluteTime.length > 0) {
    item.echoObj.timeScope = item.echoObj.lastAbsoluteTime
  } else {
    item.echoObj.timeScope = item.echoObj.lastRelativeTime
  }
}

function isValidDateStr(str: string) {
  // 允许YYYY-M-D或YYYY-MM-DD，分隔符为-或/
  const reg = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/
  if (!reg.test(str)) return false
  const d = new Date(str.replace(/-/g, '/')) // 兼容Safari
  return !isNaN(d.getTime())
}

function clickCascader(val: unknown, index: number, item: SequenceItem) {
  const path = Array.isArray(val) ? (val as string[]) : []
  // 自定义事件
  if (path.length > 1) {
    const second = path[1] ?? ''
    if (second == 'custom') {
      // pover 自定义天数（v2: this.$refs.customPover[index].showPopper = true）
      setPoverVisible(index, true)
    } else if (second == 'time_scope') {
      // 自定义日期范围（v2: this.$refs.datePickerShow[index].focus()）
      const picker = datePickerRefs[index]
      picker?.focus?.()
      // element-plus 里 focus() 只聚焦输入框，展开面板要再调一次 handleOpen()
      picker?.handleOpen?.()
    } else {
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

function splitDateRange(dateRange: string): string[] | null {
  if (dateRange.includes('~')) {
    return dateRange.split('~')
  }
  return null // 如果没有 '~'，返回 null 或其他你想返回的值
}

function closePover(index: number, isTrue?: boolean, item?: SequenceItem) {
  // 相对时间自定义天数   新增类
  if (isTrue && item) {
    item.echoObj.lastAbsoluteTime = []
    // 与 v2 一致（v2 此处逻辑存疑：两个数都表示「前 N 天」，开始时间应该比结束时间「更前」也就是数更大，
    // 这里判断的却是 startNum < endNum 才提示「开始时间必须早于结束时间」，判断方向和文案对不上）
    if ((item.echoObj.startNum as number) < (item.echoObj.endNum as number)) {
      ElMessage.error('开始时间必须早于结束时间')
      return
    }
    datePickerOptions(item)
  }
  // v2: this.$refs.customPover[index].doClose()
  setPoverVisible(index, false)
}

function datePickerOptions(item: SequenceItem) {
  const obj: CascaderNode = {
    label: '前' + item.echoObj.startNum + '天' + '到前' + item.echoObj.endNum + '天',
    // value: item.echoObj.startNum + "-" + item.echoObj.endNum,
    value:
      `${'-'}${item.echoObj.startNum}${'day'}` + '~' + `${'-'}${item.echoObj.endNum}${'day'}`,
    custom: true,
  }

  // 方式二   去重
  const relative = props.cascaderList[1]
  if (relative) {
    if (!relative.children) relative.children = []
    relative.children.push(obj)
    relative.children = relative.children.filter(
      (object, index, self) => index === self.findIndex((t) => t.label === object.label),
    )
  }

  // 进行赋值
  const newlevel = item.echoObj.timeScope
  // newlevel[1] = item.echoObj.startNum + "-" + item.echoObj.endNum;
  newlevel[1] =
    `${'-'}${item.echoObj.startNum}${'day'}` + '~' + `${'-'}${item.echoObj.endNum}${'day'}`
  item.echoObj.timeScope = newlevel

  // 后端字段进行赋值 earlist和latest字段
  item.earlistTime = `${'-'}${item.echoObj.startNum}${'day'}`
  item.latestTime = `${'-'}${item.echoObj.endNum}${'day'}`
  // 缓存相对时间非自定义上次数据
  item.echoObj.lastRelativeTime = newlevel
}

// v2 形参是 (item, index)，index 从来没用过，这里只收 item
function handleHide(item: SequenceItem) {
  if (item.echoObj.lastAbsoluteTime.length > 0) {
    item.echoObj.timeScope = item.echoObj.lastAbsoluteTime
  } else {
    item.echoObj.timeScope = item.echoObj.lastRelativeTime
  }
}
// end

// v2 里父组件 tagRules 用 ref="sequenceRules" 引用本组件，但没有调用过任何方法
defineExpose({})
</script>

<template>
  <div class="container_box">
    <el-row style="display: flex; position: relative">
      <!-- 且或 -->
      <div v-show="sequenceObj.sequence.sequences.length > 1" class="andOrNot">
        <div class="btn_line"></div>
        <el-radio-group
          :model-value="sequenceObj.sequence.relation"
          size="small"
          class="custom_btn"
          @update:model-value="setSequenceRelation($event)"
        >
          <el-radio-button value="and">且</el-radio-button>
          <el-radio-button value="or">或</el-radio-button>
        </el-radio-group>
        <div class="btn_line"></div>
      </div>
      <!-- end -->
      <div>
        <div
          v-for="(item, index) in sequenceObj.sequence.sequences"
          :key="index"
          style="margin-left: 0px; margin-top: 15px"
        >
          <!-- 增加绝对日期选择 -->
          <div style="display: flex">
            <div v-if="headType == 'number'" class="eg_letters number_letters">
              {{ index + 1 }}
            </div>
            <div v-else class="eg_letters number_letters" style="margin-left: 15px">
              {{ getLetterByIndex(index) }}
            </div>
            <div style="position: relative; margin-bottom: 5px">
              <!-- v2 这里还有一个 :active-item-change="true"，那是 Element UI 1.x 的属性，
                   element-plus 没有，去掉 -->
              <el-cascader
                :show-all-levels="true"
                style="width: 250px; z-index: 100"
                :model-value="item.echoObj.timeScope"
                :options="cascaderList"
                filterable
                @update:model-value="setTimeScope(item, $event)"
                @change="clickCascader($event, index, item)"
              />
              <div style="position: absolute; top: 3px; height: 30px">
                <el-date-picker
                  :ref="(el: Element | ComponentPublicInstance | null) => setDatePickerRef(el, index)"
                  :model-value="item.echoObj.datePicker"
                  type="daterange"
                  range-separator="至"
                  start-placeholder="开始日期"
                  end-placeholder="结束日期"
                  value-format="YYYY-MM-DD"
                  :shortcuts="pickerShortcuts"
                  @update:model-value="setDatePicker(item, $event)"
                  @change="checkDateEvent($event, item)"
                  @blur="dateBlur(item)"
                />
              </div>
              <div style="position: absolute; top: 3px; height: 30px">
                <!-- v2 的 @hide 在 element-plus 里没有同名事件，对应的是 after-leave（弹层收起后触发） -->
                <el-popover
                  placement="bottom"
                  title="相对时间/时间范围"
                  :width="300"
                  style="background: #fff !important"
                  trigger="click"
                  :visible="isPoverVisible(index)"
                  @update:visible="setPoverVisible(index, $event)"
                  @after-leave="handleHide(item)"
                >
                  <template #reference>
                    <div style="height: 30px; width: 250px; background: #fff"></div>
                  </template>
                  <div>
                    <div class="pover_inner">请输入1-365范围内的整数</div>
                    <div class="pover_inner" style="display: flex; margin-top: 5px">
                      开始时间: 前
                      <el-input-number
                        class="customNum"
                        :model-value="item.echoObj.startNum ?? undefined"
                        :min="1"
                        :max="365"
                        aria-label="请输入天数"
                        @update:model-value="setStartNum(item, $event)"
                      />
                    </div>
                    <div class="pover_inner" style="margin: 15px 0">
                      结束时间: 前
                      <el-input-number
                        class="customNum"
                        :model-value="item.echoObj.endNum ?? undefined"
                        :min="1"
                        :max="365"
                        aria-label="请输入天数"
                        @update:model-value="setEndNum(item, $event)"
                      />
                    </div>
                    <div class="pover_inner">
                      <el-button class="zc_btn_default" @click="closePover(index)">取消</el-button>
                      <el-button class="zc_btn" @click="closePover(index, true, item)">
                        确定
                      </el-button>
                    </div>
                  </div>
                </el-popover>
              </div>
            </div>
            <p class="customSpace" style="line-height: 32px">依次做过</p>
            <el-icon
              class="el-icon-close delete_btn"
              @click="sequenceObj.sequence.sequences.splice(index, 1)"
            >
              <Close />
            </el-icon>
          </div>

          <!-- end -->
          <!-- v2 这里还挂了 ref="sequenceCardRef"，但从来没通过它调用过方法，v3 不再声明 -->
          <sequenceCard
            :sequenceObject="item"
            :modelObject="sequenceObj"
            :pointProtoList="pointProtoList"
            :propertyList="propertyList"
            :letters="index"
          />
        </div>
      </div>
    </el-row>
    <div
      v-if="sequenceObj.sequence.sequences.length == 0"
      style="margin-left: 40px"
      class="circle add_icon pointer_spacing"
      @click="circleAddEvent()"
    ></div>
    <div
      v-else
      style="font-size: 14px; color: #2c7be5; position: relative; cursor: pointer; display: flex"
      :style="sequenceObj.sequence.sequences.length == 1 ? 'left: 10px;' : 'left: 55px;'"
      @click="circleAddEvent()"
    >
      <el-icon class="el-icon-plus"><Plus /></el-icon>添加事件
    </div>
  </div>
</template>

<style lang="scss" scoped>
.delete_btn {
  cursor: pointer;
  font-size: 16px;
  margin: 0 8px;
  line-height: 37px;
    // v3 的 <el-icon> 是 inline-flex + height:1em，line-height 撑不开盒子；
    // 用同值 height 还原 v2 字体图标的垂直居中（el-icon 自带 align-items:center）
    height: 37px;
  color: rgb(188, 188, 188);
}

// 自定义组件

.pover_inner {
  display: flex;
  font-size: 14px;
  line-height: 35px;
  background: #fff;
}

.customSpace {
  font-size: 13px;
  color: #514f4f !important;
  // padding: 0 10px;
  white-space: nowrap;
  line-height: 10px;
}

.number_letters {
  // margin-left: 40px;
  width: 25px;
  height: 25px;
  border-radius: 50%;
  background-color: #2c7be5;
  color: #fff !important;
  display: flex;
  justify-content: center;
  align-items: center;
  line-height: 30px;
  font-size: 15px;
  font-weight: 400;
}

.eg_letters {
  color: rgb(101, 100, 100);
  width: 25px;
  height: 25px;
  font-size: 14px;
  margin-top: 5px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-weight: 400;
  margin-right: 10px;
}

// 天数el-input-number 自定义
// v2 是 ::v-deep .el-input-number--medium{width:160px!important} + .customNum .el-input--medium .el-input__inner{height:30px}；
// element-plus 没有 medium 尺寸类，而且这两个输入框在 teleport 出去的 popover 里，
// `:deep(祖先 后代)` 形式选不中，所以直接写在组件自己的 .customNum 类上
.customNum {
  width: 160px !important;
  margin-left: 5px;

  :deep(.el-input__inner) {
    height: 30px;
  }
}

// v2 的 ::v-deep .el-button--medium{height:30px}：弹层里的两个按钮用的是全局 .zc_btn / .zc_btn_default，
// 它们本身就是 height:30px，不需要再补一条

// 日期
// v2 是 .el-range-editor--medium.el-input__inner；element-plus 的区间选择器根元素
// 类名换成了 el-input__wrapper，尺寸类也没有 medium
:deep(.el-range-editor.el-input__wrapper) {
  height: 30px;
  width: 250px;
}

// 与 v2 一致：popover 会 teleport 到 body，:deep(祖先 后代) 选不中它，这条规则和 v2 一样不生效
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

:deep(.el-input-number.is-controls-right[class*='medium'] [class*='increase']),
:deep(.el-input-number.is-controls-right[class*='medium'] [class*='decrease']) {
  line-height: 12px;
  margin-top: 3px;
}

// v2 的 .el-radio-button__orig-radio 在 element-plus 里叫 .el-radio-button__original-radio
:deep(.custom_btn .el-radio-button__original-radio:checked + .el-radio-button__inner) {
  font-size: 10px;
}

:deep(.custom_btn .el-radio-button:last-child .el-radio-button__inner) {
  font-size: 10px;
}

:deep(.el-radio-button:first-child .el-radio-button__inner) {
}

:deep(.el-select .el-input .el-select__caret) {
  line-height: 30px;
}

:deep(.el-select-dropdown__list) {
  padding: 0 0 6px;
}

:deep(.el-radio-group) {
  margin: 0 5px;
}

// v2 的 .el-radio-button--medium .el-radio-button__inner（padding/font-size）
// 在 element-plus 里没有 medium 尺寸类，直接并到基础选择器上
/*
 * tab 按钮字号。v2 这一块的净效果是**所有**按钮 10px：
 *     .el-radio-button--medium .el-radio-button__inner { font-size: 10px !important; }   ← 带 !important
 *     .el-radio-button--medium .el-radio-button__inner { padding: 6px; font-size: 13px; } ← 13px 被上面盖掉
 * （v2 产物里共 26 个组件带这条 !important 规则，逐个核对过）
 * 迁移时按「first/last 10px、其余 13px」拆开写了，三个及以上 tab 时字号就不一致。
 * element-plus 没有 --medium 后缀，这里直接把净效果写在基础规则上。
 */
:deep(.el-radio-button__inner) {
  border-left: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 6px;
  font-size: 10px;
}

:deep(.el-radio-button:last-child .el-radio-button__inner) {
  border-radius: 4px;
}

:deep(.el-radio-button) {
  height: 20px;
  font-size: 12px;
}

// v2 的 .el-input--medium .el-input__inner 同理
:deep(.el-input__inner) {
  height: 30px;
  line-height: 30px;
  font-size: 12px;
}

:deep(.el-cascader .el-input .el-input__inner) {
  font-size: 12px;
}

.custom_btn {
  padding: 1px 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;

  :deep(.el-radio-button:first-child .el-radio-button__inner) {
    border-radius: 4px 4px 0 0;
  }

  :deep(.el-radio-button:last-child .el-radio-button__inner) {
    border-radius: 0 0 4px 4px;
  }

  :deep(.el-radio-button--small .el-radio-button__inner) {
    padding: 5px;
  }

  :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
    color: #ffffff;
    background-color: #619ff3;
    border-color: #619ff3;
    -webkit-box-shadow: -1px 0 0 0 #619ff3;
    box-shadow: -1px 0 0 0 #619ff3;
  }
}

.container_box {
  margin: 10px;

  // 且或
  .andOrNot {
    margin: 0 20px;
    color: gray;
    font-size: 13px;
    position: relative;
    left: 20px;
    // height: calc(100% - 0px);
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
}
</style>
