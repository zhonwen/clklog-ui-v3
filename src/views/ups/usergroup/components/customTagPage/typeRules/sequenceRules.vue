<script setup lang="ts">
/**
 * 行为序列（对应 v2
 * views/ups/usergroup/components/customTagPage/typeRules/sequenceRules.vue）。
 *
 * 数据落在 sequenceObj.sequence 上：{ relation, sequences: [{ steps, earlistTime, latestTime, echoObj }] }。
 * 每条序列自己带时间范围，步骤列表交给 sequenceCard 渲染。
 */
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Close, Plus } from '@element-plus/icons-vue'
import sequenceCard from './sequenceCard.vue'
import { copyObj } from '@/utils/copy'
import { getLetterByIndex, rangeShortcuts } from '../../../utils'
import type {
  CascaderNode,
  PropertyListMap,
  PropertyNode,
  RuleSet,
  SequenceItem,
  SequenceStep,
} from '../../../types'

interface DatePickerLike {
  handleOpen: () => void
}

const props = withDefaults(
  defineProps<{
    /** 模型数据（整个 rules 对象，sequenceCard 还要拿它做红框校验） */
    sequenceObj: RuleSet
    pointProtoList?: PropertyNode[]
    /** 'number' 时序列序号用数字，否则用大写字母（v2 没人传过它） */
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

/** v2 的 $refs.datePickerShow[index] */
const datePickerRefs = ref<Record<number, unknown>>({})
function setDatePicker(index: number, el: unknown) {
  datePickerRefs.value[index] = el
}
/** v2 的 $refs.customPover[index].showPopper / doClose()，element-plus 改成受控 visible */
const poverVisible = ref<Record<number, boolean>>({})

const pickerShortcuts = rangeShortcuts

let eventType: string | null = null
let event_displayName = ''

function circleAddEvent() {
  // 设置初始值
  props.pointProtoList.forEach((item, index) => {
    item.displayName = item.groupName
    item.name = item.groupName
    ;(item.events || []).forEach((sub, sub_index) => {
      if (sub_index == 0 && index == 0) {
        eventType = sub.name ?? ''
        event_displayName = sub.displayName ?? ''
      }
    })
  })
  // end

  const params: SequenceStep = {
    eventName: eventType ?? '',
    name: event_displayName,
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
    steps: measures,
    earlistTime: '-1day',
    latestTime: 'now',
    echoObj: {
      lastRelativeTime: ['relative_time', '-1day'],
      timeScope: ['relative_time', '-1day'],
      lastAbsoluteTime: [],
      datePicker: [], //日期
      startNum: null,
      endNum: null,
    },
  })
}

//日历控件关闭后的操作
function checkDateEvent(val: unknown, item: SequenceItem) {
  const range = (val || []) as string[]
  const obj: CascaderNode = {
    label: range[0] + '~' + range[1],
    value: range[0] + '~' + range[1],
  }
  const absolute = props.cascaderList[0]
  if (absolute) {
    absolute.children = (absolute.children || []).concat([obj])
    absolute.children = absolute.children.filter(
      (object, index, self) => index === self.findIndex((t) => t.label === object.label),
    )
  }

  // 进行赋值
  const newlevel = item.echoObj.timeScope
  newlevel[1] = range[0] + '~' + range[1]
  item.echoObj.timeScope = newlevel
  // 后端字段进行赋值 earlist和latest字段
  item.earlistTime = Math.floor(new Date(String(range[0])).getTime() / 1000)
  item.latestTime = Math.floor(new Date(String(range[1])).getTime() / 1000)
  //缓存绝对时间 非自定义上次数据
  item.echoObj.lastAbsoluteTime = newlevel
}

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

function splitDateRange(dateRange: string) {
  if (dateRange.includes('~')) {
    return dateRange.split('~')
  }
  return null // 如果没有 '~'，返回 null 或其他你想返回的值
}

function clickCascader(val: unknown, index: number, item: SequenceItem) {
  const path = (val || []) as string[]
  // 自定义事件
  if (path.length > 1) {
    if (path[1] == 'custom') {
      // pover 自定义天数
      poverVisible.value[index] = true
    } else if (path[1] == 'time_scope') {
      // 自定义日期范围
      // v2 调的是 element-ui 的 focus()（会打开面板），element-plus 对应 handleOpen()
      ;(datePickerRefs.value[index] as DatePickerLike | null)?.handleOpen()
    } else {
      // 设置后端字段进行赋值 earlist和latest字段
      const dateTime = splitDateRange(String(path[1]))
      if (dateTime) {
        if (
          dateTime[0] &&
          dateTime[1] &&
          isValidDateStr(dateTime[0]) &&
          isValidDateStr(dateTime[1])
        ) {
          item.earlistTime = Math.floor(new Date(dateTime[0]).getTime() / 1000)
          item.latestTime = Math.floor(new Date(dateTime[1]).getTime() / 1000)
        }
      } else {
        item.earlistTime = String(path[1])
        item.latestTime = 'now'
      }
    }
  }
}

function datePickerOptions(item: SequenceItem) {
  const obj: CascaderNode = {
    label: '前' + item.echoObj.startNum + '天' + '到前' + item.echoObj.endNum + '天',
    value:
      `${'-'}${item.echoObj.startNum}${'day'}` + '~' + `${'-'}${item.echoObj.endNum}${'day'}`,
    custom: true,
  }

  // 方式二   去重
  const relative = props.cascaderList[1]
  if (relative) {
    relative.children = (relative.children || []).concat([obj])
    relative.children = relative.children.filter(
      (object, index, self) => index === self.findIndex((t) => t.label === object.label),
    )
  }

  // 进行赋值
  const newlevel = item.echoObj.timeScope
  newlevel[1] =
    `${'-'}${item.echoObj.startNum}${'day'}` + '~' + `${'-'}${item.echoObj.endNum}${'day'}`
  item.echoObj.timeScope = newlevel

  // 后端字段进行赋值 earlist和latest字段
  item.earlistTime = `${'-'}${item.echoObj.startNum}${'day'}`
  item.latestTime = `${'-'}${item.echoObj.endNum}${'day'}`
  //缓存相对时间非自定义上次数据
  item.echoObj.lastRelativeTime = newlevel
}

function closePover(index: number, isTrue?: boolean, item?: SequenceItem) {
  // 相对时间自定义天数   新增类
  if (isTrue && item) {
    item.echoObj.lastAbsoluteTime = []
    if (Number(item.echoObj.startNum) < Number(item.echoObj.endNum)) {
      ElMessage.error('开始时间必须早于结束时间')
      return
    }
    datePickerOptions(item)
  }
  poverVisible.value[index] = false
}

function handleHide(item: SequenceItem) {
  if (item.echoObj.lastAbsoluteTime.length > 0) {
    item.echoObj.timeScope = item.echoObj.lastAbsoluteTime
  } else {
    item.echoObj.timeScope = item.echoObj.lastRelativeTime
  }
}
</script>

<template>
  <div class="container_box">
    <el-row style="display: flex; position: relative">
      <!-- 且或 -->
      <div v-show="sequenceObj.sequence.sequences.length > 1" class="andOrNot">
        <div class="btn_line"></div>
        <el-radio-group v-model="sequenceObj.sequence.relation" size="small" class="custom_btn">
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
              <el-cascader
                v-model="item.echoObj.timeScope"
                :show-all-levels="true"
                style="width: 250px; z-index: 100"
                :options="cascaderList"
                filterable
                @change="clickCascader($event, index, item)"
              />
              <div style="position: absolute; top: 3px; height: 30px">
                <el-date-picker
                  :ref="(el: unknown) => setDatePicker(index, el)"
                  v-model="item.echoObj.datePicker"
                  type="daterange"
                  range-separator="至"
                  start-placeholder="开始日期"
                  end-placeholder="结束日期"
                  value-format="YYYY-MM-DD"
                  :shortcuts="pickerShortcuts"
                  @change="checkDateEvent($event, item)"
                  @blur="dateBlur(item)"
                />
              </div>
              <div style="position: absolute; top: 3px; height: 30px">
                <el-popover
                  placement="bottom"
                  title="相对时间/时间范围"
                  :width="300"
                  style="background: #fff !important"
                  trigger="click"
                  :visible="!!poverVisible[index]"
                  @update:visible="(v: boolean) => (poverVisible[index] = v)"
                  @before-leave="handleHide(item)"
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
                      />
                    </div>
                    <div class="pover_inner" style="margin: 15px 0">
                      结束时间: 前
                      <el-input-number
                        v-model="item.echoObj.endNum"
                        class="customNum"
                        :min="1"
                        :max="365"
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
              class="delete_btn"
              @click="sequenceObj.sequence.sequences.splice(index, 1)"
            >
              <Close />
            </el-icon>
          </div>

          <!-- end -->
          <sequenceCard
            :sequence-object="item"
            :model-object="sequenceObj"
            :point-proto-list="pointProtoList"
            :property-list="propertyList"
            :letters="index"
          />
        </div>
      </div>
    </el-row>
    <!-- 与 v2 一致：v2 这里是 `length == 1 ? 'margin-left: 40px' : 'margin-left: 40px'`，
         两个分支的值一样，而且外层 v-if 已经限定 length == 0，所以直接写死同一个值 -->
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
      <el-icon><Plus /></el-icon>添加事件
    </div>
  </div>
</template>

<style lang="scss" scoped>
.delete_btn {
  cursor: pointer;
  font-size: 16px;
  margin: 0 8px;
  line-height: 37px;
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
  white-space: nowrap;
  line-height: 10px;
}

.number_letters {
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

:deep() {
  // 天数el-input-number 自定义
  .el-input-number {
    width: 160px !important;
  }

  .customNum {
    margin-left: 5px;

    .el-input__wrapper {
      height: 30px;
    }
  }

  //日期
  .el-range-editor.el-input__wrapper {
    height: 30px;
    width: 250px;
  }

  .el-popover {
    background: #fff;
  }

  // end
  .el-loading-spinner .circular {
    height: 38px !important;
  }

  .el-input__inner::placeholder {
    font-size: 11px;
  }

  .custom_btn .el-radio-button__original-radio:checked + .el-radio-button__inner {
    font-size: 10px;
  }

  .custom_btn .el-radio-button:last-child .el-radio-button__inner {
    font-size: 10px;
  }

  .el-radio-button:first-child .el-radio-button__inner {
    font-size: 10px;
  }

  .el-select .el-select__caret {
    line-height: 30px;
  }

  .el-select-dropdown__list {
    padding: 0 0 6px;
  }

  .el-radio-group {
    margin: 0 5px;
  }

  .el-radio-button__inner {
    border-left: 1px solid #dcdfe6;
    border-radius: 4px;
  }

  .el-radio-button:last-child .el-radio-button__inner {
    border-radius: 4px;
  }

  .el-radio-button:first-child .el-radio-button__inner {
    border-radius: 4px;
  }

  .el-radio-button {
    height: 20px;
    font-size: 12px;
  }

  .el-cascader .el-input .el-input__inner {
    font-size: 12px;
  }

  .custom_btn {
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
