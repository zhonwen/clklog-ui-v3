<script setup lang="ts">
/**
 * 「行为序列」规则
 * （对应 v2 src/views/ups/userTag/components/customTagPage/typeRules/sequenceRules.vue）。
 *
 * 数据结构：sequenceObj = 当前分层的 rules，本组件只动 sequenceObj.sequence
 *   sequence: { relation: 'and'|'or', sequences: SequenceItem[] }
 * 每条 sequence 有自己的时间范围（echoObj / earlistTime / latestTime）和 steps（交给 sequenceCard）。
 *
 * element-plus / Vue3 适配：
 *   $refs.customPover[i].showPopper = true / .doClose() → v-model:visible + timePoverVisible[i]
 *   $refs.datePickerShow[i].focus()                     → datePickerRefs[i]?.focus()
 *   :picker-options                                     → :shortcuts
 *   value-format="yyyy-MM-dd"                           → "YYYY-MM-DD"
 *   :active-item-change                                 → element-plus 没有这个属性，去掉
 *   el-icon-xxx                                         → <el-icon> + icons-vue（类名沿用 v2）
 *
 * v2 里未搬运的死代码：sequenceCard 上的 ref="sequenceCardRef"（没有调用点）、
 * eventType / event_displayName 之外的空实现。
 */
import { nextTick, ref, watch } from 'vue'
import { Close, Plus } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import sequenceCard from './sequenceCard.vue'
import { copyObj } from '@/utils/copy'
import type { CascaderOption } from '@/utils/modelOptions/up-manage'
import {
  getLetterByIndex,
  isValidDateStr,
  rangeShortcuts,
  splitDateRange,
} from '../../../local-utils'
import type {
  PropertyListMap,
  PropertyNode,
  SequenceItem,
  SequenceStep,
  TagRuleSet,
} from '../../../types'

/** el-date-picker 实例上用得到的方法 */
interface DatePickerExposed {
  focus: () => void
}

const props = withDefaults(
  defineProps<{
    /** 模型数据（= 当前分层的 rules） */
    sequenceObj: TagRuleSet
    pointProtoList?: PropertyNode[]
    /** 'number' 时序号用数字圆点，否则用字母。v2 里 tagRules 没传，走字母分支 */
    headType?: string
    cascaderList?: CascaderOption[]
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

const eventType = ref<string | null>(null)
const event_displayName = ref('')

const timePoverVisible = ref<boolean[]>([])
const datePickerRefs = ref<(DatePickerExposed | null)[]>([])

function setDatePickerRef(el: unknown, index: number) {
  if (el) datePickerRefs.value[index] = el as DatePickerExposed
}

// el-popover 的 visible 必须是明确的布尔值才算「受控」
watch(
  () => props.sequenceObj.sequence.sequences.length,
  (len) => {
    for (let i = 0; i < len; i++) {
      if (timePoverVisible.value[i] === undefined) timePoverVisible.value[i] = false
    }
  },
  { immediate: true },
)

function circleAddEvent() {
  // 设置初始值
  props.pointProtoList.map((item, index) => {
    item.displayName = item.groupName ?? ''
    item.name = item.groupName ?? ''
    item.events?.map((sub, sub_index) => {
      if (sub_index == 0 && index == 0) {
        eventType.value = sub.name
        event_displayName.value = sub.displayName
      }
    })
  })
  // end

  const params: SequenceStep = {
    eventName: eventType.value ?? '',
    name: event_displayName.value,
    // aggregator: "",
    // field:"",
    // fieldType:'',
    filter: {
      relation: 'and',
      filters: [],
    },
  }
  const stepList: SequenceStep[] = []
  // 依次默认增加两个事件
  stepList.push(params)
  stepList.push(copyObj(params))

  props.sequenceObj.sequence.sequences.push({
    // measures: measures,
    steps: stepList,
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
function checkDateEvent(val: [string, string] | null, item: SequenceItem) {
  // 与 v2 一致（v2 此处逻辑存疑：清空日期时 val 为 null，v2 直接读 val[0] 会抛异常）
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
  // 后端字段进行赋值 earlist和latest字段
  item.earlistTime = Math.floor(new Date(val[0]).getTime() / 1000)
  item.latestTime = Math.floor(new Date(val[1]).getTime() / 1000)
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

function clickCascader(val: unknown, index: number, item: SequenceItem) {
  const path = (val as string[] | null) || []
  // 自定义事件
  if (path.length > 1) {
    const second = path[1] ?? ''
    if (second == 'custom') {
      // pover 自定义天数
      timePoverVisible.value[index] = true
    } else if (second == 'time_scope') {
      // 自定义日期范围
      void nextTick(() => {
        datePickerRefs.value[index]?.focus()
      })
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

function datePickerOptions(item: SequenceItem) {
  const obj: CascaderOption = {
    label: '前' + item.echoObj.startNum + '天' + '到前' + item.echoObj.endNum + '天',
    // value: item.echoObj.startNum + "-" + item.echoObj.endNum,
    value: `${'-'}${item.echoObj.startNum}${'day'}` + '~' + `${'-'}${item.echoObj.endNum}${'day'}`,
    custom: true,
  }

  // 方式二   去重
  const relative = props.cascaderList[1]
  if (relative && relative.children) {
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
  timePoverVisible.value[index] = false
}

function handleHide(item: SequenceItem) {
  if (item.echoObj.lastAbsoluteTime.length > 0) {
    item.echoObj.timeScope = item.echoObj.lastAbsoluteTime
  } else {
    item.echoObj.timeScope = item.echoObj.lastRelativeTime
  }
}
// end
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
                      <el-button class="zc_btn_default" @click="closePover(index)">取消</el-button>
                      <el-button class="zc_btn" @click="closePover(index, true, item)"
                        >确定</el-button
                      >
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
          <!-- :pointTypeList="pointTypeList" -->
          <sequenceCard
            :sequence-object="item"
            :model-object="sequenceObj"
            :point-proto-list="pointProtoList"
            :property-list="propertyList"
            :letters="index"
          ></sequenceCard>
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
:deep(.el-input-number) {
  width: 160px !important;
}

:deep(.customNum) {
  margin-left: 5px;

  .el-input__wrapper {
    height: 30px;
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
