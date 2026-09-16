<script setup lang="ts">
/**
 * 群画像 - 「用户属性满足」规则编辑器
 * （对应 v2 `views/ups/userPortrait/components/customTagPage/typeRules/attributeRules.vue`）。
 *
 * 数据流与 v2 完全一致：直接就地修改父级传进来的 modelObject.attribute
 * （v2 用的是 props + this.$set / this.$delete），父组件 tagRules 拿的是同一个对象引用。
 *
 * 与 v2 一致（v2 此处逻辑存疑：以下都是 v2 里从没被用到的死代码，这里不再搬运）：
 *   - components 里注册了 conditionOption，但模板里一次都没用过；
 *   - import 的 attr_string / attr_number / attr_boolean / attr_dateTime 四个常量没有任何引用；
 *   - data 里的 dayScope、oldProperty；
 *   - computed projectName（$store.getters.projectName）、treeOptions
 *     （`JSON.stringify(localStorage.getItem("propertyList"))` —— 对字符串再 stringify 一次，本身就写错了）；
 *   - methods 里的 repeatEvent / filterObjects / handleVisibleChangeNew。
 *
 * 注意：`customTagPage/` 在 v2 里 userPortrait / userTag / usergroup 各有一份独立副本，
 * 这一份严格以 userPortrait 的为准。
 */
import { computed, onMounted } from 'vue'
import { Close, Plus } from '@element-plus/icons-vue'
import treeSelect from '@/views/ups/components/tree-select.vue'
import { dateTimeList, getOptionsByType, relativeTime } from '@/utils/modelOptions/custom'
import type { OptionDef } from '@/utils/modelOptions/custom'
import { attributeDateShortcuts, groupValueType } from '../../../options'
import { computedStyle as computedStyleRaw } from '../../../types'
import type {
  ConditionItem,
  EventGroup,
  FilterGroup,
  PortraitRules,
  PropertyListMap,
  PropertyNode,
  RadioOption,
} from '../../../types'

const props = withDefaults(
  defineProps<{
    /** v2 声明了但组件内部从未使用，保留以免调用方传参报未知 prop */
    fieldTypeList?: unknown[]
    propertyList?: Partial<PropertyListMap>
    /** v2 声明了但本组件没往 treeSelect 传，保留 prop 定义（tagRules 确实会传，内容是事件分组） */
    pointProtoList?: EventGroup[]
    /** v2 声明成非必填，但模板里直接取 modelObject.attribute，实际必须传 */
    modelObject: PortraitRules
  }>(),
  {
    fieldTypeList: () => [],
    propertyList: () => ({
      commonPropertySum: [], // 共用事件属性
      userProperties: [], // 共用用户属性
      userGroupList: [], // 用户分群
    }),
    pointProtoList: () => [],
  },
)

const radioOptions: RadioOption[] = [
  // { label: "事件属性", value: "event_property" },
  { label: '用户属性', value: 'user_property' },
  { label: '用户分群', value: 'user_group' },
  { label: '用户标签', value: 'user_tag' },
]

/** 用户属性初始值 */
let proto_init_value: PropertyNode = {
  dataType: '',
  displayName: '',
  name: '',
  propertyId: '',
}

/** v2 的 pickerOptions.shortcuts（今天 / 昨天 / 一周前），element-plus 改用 :shortcuts */
const dateShortcuts = attributeDateShortcuts

/**
 * v2 模板里被重复求值的那个三元判断：只有一组、且组里只有一个条件时不缩进。
 * 提成 computed，避免每一行都重新算一遍。
 */
const isSingleCondition = computed(
  () =>
    props.modelObject.attribute.filters.length == 1 &&
    (props.modelObject.attribute.filters[0]?.conditions.length ?? 0) < 2,
)

/** 条件行的左缩进（对应 v2 行内那段 :style 三元） */
const rowIndentStyle = computed(() =>
  isSingleCondition.value ? 'margin-left: 0px;' : 'margin-left: 40px;',
)

/** 底部「添加过滤条件」的左内边距（对应 v2 行内那段 :style 三元） */
const addBtnStyle = computed(() => (isSingleCondition.value ? 'padding-left:0' : ' '))

onMounted(() => {
  localStorage.removeItem('openVerificaStyle')
})

/**
 * params 按下标读写。项目开了 noUncheckedIndexedAccess，模板里直接 v-model="second_item.params[0]"
 * 拿到的是 string | number | undefined，接不进 el-input，所以统一走 get / set 两个方法，
 * 读写的仍然是同一个 params 数组，行为与 v2 一致。
 */
function paramAt(item: ConditionItem, index: number): string | number {
  return item.params?.[index] ?? ''
}

function setParamAt(item: ConditionItem, index: number, val: unknown) {
  if (!item.params) item.params = []
  item.params[index] = val as string | number
}

/** 时段区间的小时上限，与 v2 一致：大于 23 就钉到 23（v2 用的是 this.$set(second_item.params, index, 23)） */
function timeLimitFunc(event: string | number, second_item: ConditionItem, index: number) {
  if (Number(event) > 23) {
    setParamAt(second_item, index, 23)
  }
}

// 设置校验样式
function computedStyle(value: unknown) {
  return computedStyleRaw(value, props.modelObject)
}

/** 模板里按下标取校验样式（v-for 内无法提成 computed，这里包一层保持调用整齐） */
function styleAt(item: ConditionItem, index: number) {
  return computedStyle(item.params?.[index])
}

function gloabDeleteEvent(secondP_index: number) {
  props.modelObject.attribute.filters.splice(secondP_index, 1)
  if (props.modelObject.attribute.filters.length < 2) {
    delete props.modelObject.attribute.relation
  }
}

function getLetterByIndex(index: number) {
  if (index < 0 || index >= 26) {
    return String.fromCharCode(65 + (index % 26))
  }
  return String.fromCharCode(65 + index) // 65 是大写字母 A 的 ASCII 编码
}

function filterGlobalSelect(item: ConditionItem): OptionDef[] {
  let options: OptionDef[] = []
  if (item.fieldType == 'user_group') {
    options = groupValueType
  } else {
    options = checkTypeArray(item)
  }
  return options
}

function checkTypeArray(item: ConditionItem): OptionDef[] {
  return getOptionsByType(item.dataType)
}

function handelJudge(second_item: ConditionItem) {
  if (Array.isArray(second_item.params) && second_item.params.length > 0) {
    second_item.params = []
  }
}

/**
 * 时间区间：判断该判断方式是否还需要「值」输入框。
 * 与 v2 一致（v2 的第二个入参 second_item 在函数体里根本没用到，这里去掉）。
 */
function filterIstrue(item?: string) {
  let flag = true
  if (
    item == 'isTrue' ||
    item == 'isFalse' ||
    item == 'isSet' ||
    item == 'notSet' ||
    item == 'isEmpty' ||
    item == 'isNotEmpty' ||
    // 正则匹配
    item == 'between' ||
    item == 'queal' ||
    item == 'notQueal' ||
    // 相对时间
    item == 'absolute_between' ||
    item == 'extract_between' ||
    item == 'relative_within' ||
    item == 'relative_between' ||
    item == 'relative_event_time'
  ) {
    flag = false
  }
  return flag
}

function threeDeleteEvent(secondP_index: number, second_index: number, three_list: FilterGroup[]) {
  three_list[secondP_index]?.conditions.splice(second_index, 1)
}

function refreshDefault() {
  if (!proto_init_value.displayName) {
    // 与 v2 一致（v2 此处逻辑存疑：v2 直接取 userProperties[0]，列表为空时会拿到 undefined，
    // 后面读 .name 就会抛错；这里补一个空对象兜底，不改变有数据时的行为）
    proto_init_value = props.propertyList.userProperties?.[0] ?? {
      dataType: '',
      displayName: '',
      name: '',
      propertyId: '',
    }
  }
}

function equalityEvent(
  secondP_index: number,
  second_index: number,
  three_list: PortraitRules['attribute'],
  _model: string, // v2 传的是固定字符串 "gloab"，函数体里没用到
) {
  // 设置默认值
  const initEventName = 'user_property'
  refreshDefault()
  three_list.filters.map((item, index) => {
    if (index == secondP_index) {
      const threeObj: ConditionItem = {
        field: proto_init_value.name,
        dataType: proto_init_value.dataType, // 类型
        fieldType: initEventName, // 设置类型标识
        // fieldFlag: this.proto_init_value.name, //回显option
        function: strictMode(filterCommonType(proto_init_value.dataType), 'name'),
        params: [],
      }
      // v2 是 this.$set(item.conditions, item.conditions.length, threeObj)，等价于 push
      item.conditions.push(threeObj)
    }
  })
}

// 增加默认值
function secondLevelEvent(
  secondP_index: number,
  second_index: number,
  second_list: PortraitRules['attribute'],
  _model: string, // v2 传的是固定字符串 "gloab"，函数体里没用到
) {
  // 设置默认值
  const initEventName = 'user_property'
  refreshDefault()
  const addObj: ConditionItem = {
    field: proto_init_value.name,
    dataType: proto_init_value.dataType, // 类型
    fieldType: initEventName, // 设置类型标识
    // fieldFlag: this.proto_init_value.name, //回显option
    function: strictMode(filterCommonType(proto_init_value.dataType), 'name'),
    params: [],
  }
  second_list.filters.map((item, index) => {
    if (secondP_index == index) {
      item.relation = 'and'
      item.conditions.push(addObj)
    }
  })
}

function gloabAddEvent() {
  const initEventName = 'user_property'

  if (props.propertyList.userProperties && props.propertyList.userProperties.length > 0) {
    proto_init_value = props.propertyList.userProperties[0] ?? {
      dataType: '',
      displayName: '',
      name: '',
      propertyId: '',
    }
  } else {
    proto_init_value = {
      dataType: '',
      displayName: '',
      name: '',
      propertyId: '',
    }
  }
  // 设置初始默认值（v2 用 `a && a.push(...)` 的短路写法，这里改成等价的 if，语义不变）
  if (props.modelObject.attribute.filters)
    props.modelObject.attribute.filters.push({
      conditions: [
        {
          field: proto_init_value.name,
          // fieldFlag: this.proto_init_value.name, //回显option
          dataType: proto_init_value.dataType, // 类型
          fieldType: initEventName, // 设置选择类型
          function: strictMode(filterCommonType(proto_init_value.dataType), 'name'),
          params: [],
        },
      ],
    })
  if (props.modelObject.attribute.filters.length > 1) {
    props.modelObject.attribute.relation = 'and'
  }
}

// 严格检验字段模式
function strictMode(val: OptionDef[] | '', label: keyof OptionDef): string {
  if (val && val.length > 0) {
    return val[0]?.[label] ?? ''
  } else {
    return ''
  }
}

function filterCommonType(type?: string): OptionDef[] | '' {
  if (!type) return ''
  let options: OptionDef[] = []
  options = getOptionsByType(type)
  return options
}

// v2 里父组件 tagRules 用 ref="attributeRules" 引用本组件，但没有调用过任何方法
defineExpose({})
</script>

<template>
  <div class="box-card">
    <div>
      <!-- 全局筛选 -->
      <el-row>
        <div
          v-if="modelObject.attribute.filters && modelObject.attribute.filters.length > 1"
          style="
            color: gray;
            font-size: 13px;
            position: absolute;
            left: 0px;
            height: calc(100% - 15px);
            display: flex;
            top: 0px;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 666;
          "
        >
          <div class="btn_line"></div>
          <el-radio-group v-model="modelObject.attribute.relation" size="small" class="custom_btn">
            <el-radio-button value="and">且</el-radio-button>
            <el-radio-button value="or">或</el-radio-button>
          </el-radio-group>
          <div class="btn_line"></div>
        </div>

        <div v-if="modelObject.attribute.filters.length > 0">
          <div
            v-for="(secondP_item, secondP_index) in modelObject.attribute.filters"
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
                  height: calc(100% - 15px);
                "
              >
                {{ getLetterByIndex(secondP_index) }}
              </div>
              <div
                style="
                  color: gray;
                  font-size: 13px;
                  position: absolute;
                  left: 50px;
                  display: flex;
                  height: calc(100% - 15px);
                  top: 0px;
                  flex-direction: column;
                  justify-content: center;
                  align-items: center;
                  z-index: 666;
                "
              >
                <div class="btn_line" />
                <el-radio-group v-model="secondP_item.relation" size="small" class="custom_btn">
                  <el-radio-button value="and">且</el-radio-button>
                  <el-radio-button value="or">或</el-radio-button>
                </el-radio-group>
                <div class="btn_line" />
              </div>
            </div>
            <div
              v-for="(second_item, second_index) in secondP_item.conditions"
              :key="second_index"
              style="margin-left: 0px; display: flex; margin-bottom: 10px"
              :style="rowIndentStyle"
            >
              <div v-if="secondP_item.conditions.length > 1">
                <div
                  style="display: flex; padding-top: 0px; align-items: flex-start; margin-left: 45px"
                >
                  <!-- ***  二级组件 *** -->
                  <treeSelect
                    :cloleAppendBody="true"
                    :radioOptions="radioOptions"
                    :second_item="second_item"
                    :propertyList="propertyList"
                    :second_index="second_index"
                    @change="handelJudge(second_item)"
                  />

                  <el-select
                    v-model="second_item.function"
                    placeholder="请选择"
                    style="width: 100px; margin-left: 15px"
                    @change="handelJudge(second_item)"
                  >
                    <el-option
                      v-for="x in filterGlobalSelect(second_item)"
                      :key="x.name"
                      :label="x.displayName"
                      :value="x.name"
                    >
                      <div>
                        {{ x.displayName }}
                      </div>
                    </el-option>
                  </el-select>

                  <!-- 条件非空字段校验--start  -->
                  <div class="conditonItem">
                    <!-- 根据NUMBER类型展示文本 -->
                    <div v-if="filterIstrue(second_item.function)">
                      <div v-if="second_item.dataType == 'NUMBER'">
                        <el-input
                          :model-value="paramAt(second_item, 0)"
                          type="number"
                          class="input_number_width"
                          style="margin-left: 15px"
                          :style="computedStyle(second_item.params)"
                          @update:model-value="setParamAt(second_item, 0, $event)"
                        />
                      </div>
                      <div v-else>
                        <el-select
                          v-model="second_item.params"
                          style="margin-left: 15px; min-width: 350px"
                          multiple
                          filterable
                          allow-create
                          default-first-option
                          :style="computedStyle(second_item.params)"
                        >
                          <el-option
                            v-for="x in second_item.params ?? []"
                            :key="x"
                            :label="x"
                            :value="x"
                          >
                            {{ x }}
                          </el-option>
                        </el-select>
                      </div>
                    </div>
                    <div v-if="second_item.function == 'between'" style="display: flex">
                      <el-input
                        :model-value="paramAt(second_item, 0)"
                        type="number"
                        class="input_number_width"
                        style="margin-left: 15px"
                        placeholder=""
                        :style="styleAt(second_item, 0)"
                        @update:model-value="setParamAt(second_item, 0, $event)"
                      />
                      <span style="margin: 0 15px; font-size: 13px; color: #606266; line-height: 30px"
                        >与</span
                      >
                      <el-input
                        :model-value="paramAt(second_item, 1)"
                        type="number"
                        class="input_number_width"
                        placeholder=""
                        :style="styleAt(second_item, 1)"
                        @update:model-value="setParamAt(second_item, 1, $event)"
                      />
                      <div
                        style="
                          margin: 0 15px;
                          font-size: 13px;
                          color: #606266;
                          line-height: 30px;
                          width: 70px;
                          white-space: nowrap;
                        "
                      >
                        之间
                      </div>
                    </div>
                    <div
                      v-if="second_item.function == 'queal' || second_item.function == 'notQueal'"
                    >
                      <el-input
                        :model-value="paramAt(second_item, 0)"
                        style="padding: 0 15px; width: 350px"
                        placeholder="请输入内容"
                        :style="styleAt(second_item, 0)"
                        @update:model-value="setParamAt(second_item, 0, $event)"
                      />
                    </div>

                    <!-- 时间条件  -->
                    <div v-if="second_item.function == 'absolute_between'" class="conditonItem">
                      <!-- 绝对时间 -->
                      <span class="tipSpan" style="margin-left: 0">在</span>
                      <el-date-picker
                        :model-value="paramAt(second_item, 0)"
                        type="datetime"
                        placeholder="选择日期时间"
                        value-format="YYYY-MM-DD HH:mm:ss"
                        style="line-height: 30px; width: 180px"
                        :shortcuts="dateShortcuts"
                        :style="styleAt(second_item, 0)"
                        @update:model-value="setParamAt(second_item, 0, $event)"
                      />
                      <span class="tipSpan">到</span>
                      <el-date-picker
                        :model-value="paramAt(second_item, 1)"
                        value-format="YYYY-MM-DD HH:mm:ss"
                        type="datetime"
                        placeholder="选择日期时间"
                        style="line-height: 30px; width: 180px"
                        :shortcuts="dateShortcuts"
                        :style="styleAt(second_item, 1)"
                        @update:model-value="setParamAt(second_item, 1, $event)"
                      />
                      <span class="tipSpan">之间</span>
                    </div>
                    <div v-if="second_item.function == 'extract_between'" class="conditonItem">
                      <span class="tipSpan" style="margin-left: 0">在</span>
                      <el-input
                        :model-value="paramAt(second_item, 0)"
                        type="number"
                        :min="1"
                        class="input_number_width"
                        placeholder=""
                        :style="styleAt(second_item, 0)"
                        @update:model-value="setParamAt(second_item, 0, $event)"
                        @change="timeLimitFunc($event, second_item, 0)"
                      />
                      <span class="tipSpan">:00到</span>
                      <el-input
                        :model-value="paramAt(second_item, 1)"
                        type="number"
                        :min="1"
                        class="input_number_width"
                        :style="styleAt(second_item, 1)"
                        @update:model-value="setParamAt(second_item, 1, $event)"
                        @change="timeLimitFunc($event, second_item, 1)"
                      />
                      <span class="tipSpan">:59之间</span>
                    </div>
                    <div v-if="second_item.function == 'relative_within'" class="conditonItem">
                      <span class="tipSpan" style="margin-left: 0">在</span>

                      <el-input
                        :model-value="paramAt(second_item, 0)"
                        type="number"
                        :min="1"
                        class="input_number_width"
                        :style="styleAt(second_item, 0)"
                        placeholder=""
                        @update:model-value="setParamAt(second_item, 0, $event)"
                      />

                      <el-select
                        :model-value="paramAt(second_item, 1)"
                        :style="styleAt(second_item, 1)"
                        placeholder=""
                        style="width: 100px; margin-left: 15px"
                        @update:model-value="setParamAt(second_item, 1, $event)"
                      >
                        <el-option
                          v-for="x in dateTimeList"
                          :key="x.name"
                          :label="x.displayName"
                          :value="x.name"
                        >
                          <div>
                            {{ x.displayName }}
                          </div>
                        </el-option>
                      </el-select>
                      <span class="tipSpan">之内</span>
                    </div>
                    <div v-if="second_item.function == 'relative_between'" class="conditonItem">
                      <span class="tipSpan" style="margin-left: 0">在过去</span>
                      <el-input
                        :model-value="paramAt(second_item, 0)"
                        type="number"
                        :min="1"
                        class="input_number_width"
                        :style="styleAt(second_item, 0)"
                        placeholder=""
                        @update:model-value="setParamAt(second_item, 0, $event)"
                      />
                      <span class="tipSpan">天到过去</span>
                      <el-input
                        :model-value="paramAt(second_item, 1)"
                        type="number"
                        :min="1"
                        class="input_number_width"
                        :style="styleAt(second_item, 1)"
                        placeholder=""
                        @update:model-value="setParamAt(second_item, 1, $event)"
                      />
                      <span class="tipSpan">天之内</span>
                    </div>
                    <div
                      v-if="second_item.function == 'relative_event_time'"
                      class="conditonItem"
                      style="display: flex"
                    >
                      <!-- 相对时间发生时间 -->
                      <span class="tipSpan" style="margin-left: 0px">在</span>
                      <el-select
                        :model-value="paramAt(second_item, 0)"
                        placeholder=""
                        style="width: 100px"
                        :style="styleAt(second_item, 0)"
                        @update:model-value="setParamAt(second_item, 0, $event)"
                      >
                        <el-option
                          v-for="x in relativeTime"
                          :key="x.name"
                          :label="x.displayName"
                          :value="x.name"
                        >
                          <div>
                            {{ x.displayName }}
                          </div>
                        </el-option>
                      </el-select>
                      <div
                        v-if="
                          second_item.params?.[0] == 'afterDay' ||
                          second_item.params?.[0] == 'beforeDay'
                        "
                        style="display: flex"
                      >
                        <el-input
                          :model-value="paramAt(second_item, 1)"
                          type="number"
                          :min="1"
                          class="input_number_width"
                          style="margin-left: 15px"
                          :style="styleAt(second_item, 1)"
                          placeholder=""
                          @update:model-value="setParamAt(second_item, 1, $event)"
                        />
                        <el-select
                          :model-value="paramAt(second_item, 2)"
                          :style="styleAt(second_item, 2)"
                          placeholder=""
                          style="width: 100px; margin-left: 15px"
                          @update:model-value="setParamAt(second_item, 2, $event)"
                        >
                          <el-option
                            v-for="x in dateTimeList"
                            :key="x.name"
                            :label="x.displayName"
                            :value="x.name"
                          >
                            <div>
                              {{ x.displayName }}
                            </div>
                          </el-option>
                        </el-select>
                        <span class="tipSpan">之内</span>
                      </div>
                    </div>
                  </div>
                  <!-- end -->

                  <el-icon
                    class="el-icon-close delete_btn"
                    style="line-height: 30px"
                    @click="
                      threeDeleteEvent(secondP_index, second_index, modelObject.attribute.filters)
                    "
                  >
                    <Close />
                  </el-icon>
                </div>
                <div
                  v-if="secondP_item.conditions.length == second_index + 1"
                  style="display: flex; margin-left: 45px"
                >
                  <span
                    class="el-icon-plus"
                    style="padding: 0px 0 0 0"
                    @click="
                      equalityEvent(secondP_index, second_index, modelObject.attribute, 'gloab')
                    "
                  >
                    <el-icon><Plus /></el-icon>添加过滤条件
                  </span>
                </div>
              </div>
              <div v-else>
                <div style="display: flex; padding-top: 0px; align-items: flex-start">
                  <div class="letter_lower" style="margin-right: 7px">
                    {{ getLetterByIndex(secondP_index) }}
                  </div>

                  <!-- *** 一级-按钮选择事件 *** -->
                  <treeSelect
                    :radioOptions="radioOptions"
                    :second_item="second_item"
                    :propertyList="propertyList"
                    :second_index="second_index"
                    :cloleAppendBody="true"
                    @change="handelJudge(second_item)"
                  />

                  <!-- 判等条件 -->
                  <el-select
                    v-model="second_item.function"
                    placeholder="请选择"
                    style="width: 100px; margin-left: 15px"
                    @change="handelJudge(second_item)"
                  >
                    <el-option
                      v-for="x in filterGlobalSelect(second_item)"
                      :key="x.name"
                      :label="x.displayName"
                      :value="x.name"
                    >
                      <div>
                        {{ x.displayName }}
                      </div>
                    </el-option>
                  </el-select>

                  <!-- 条件非空字段校验--start  -->
                  <div class="conditonItem">
                    <div v-if="filterIstrue(second_item.function)">
                      <div v-if="second_item.dataType == 'NUMBER'">
                        <el-input
                          :model-value="paramAt(second_item, 0)"
                          type="number"
                          class="input_number_width"
                          style="margin-left: 15px"
                          :style="computedStyle(second_item.params)"
                          @update:model-value="setParamAt(second_item, 0, $event)"
                        />
                      </div>
                      <div v-else>
                        <el-select
                          v-model="second_item.params"
                          style="margin-left: 15px; min-width: 350px"
                          multiple
                          filterable
                          allow-create
                          default-first-option
                          :style="computedStyle(second_item.params)"
                        >
                          <el-option
                            v-for="x in second_item.params ?? []"
                            :key="x"
                            :label="x"
                            :value="x"
                          >
                            {{ x }}
                          </el-option>
                        </el-select>
                      </div>
                    </div>
                    <div v-if="second_item.function == 'between'" style="display: flex">
                      <el-input
                        :model-value="paramAt(second_item, 0)"
                        type="number"
                        style="margin-left: 15px"
                        class="input_number_width"
                        placeholder=""
                        :style="styleAt(second_item, 0)"
                        @update:model-value="setParamAt(second_item, 0, $event)"
                      />
                      <span style="margin: 0 15px; font-size: 13px; color: #606266; line-height: 30px"
                        >与</span
                      >
                      <el-input
                        :model-value="paramAt(second_item, 1)"
                        type="number"
                        class="input_number_width"
                        placeholder=""
                        :style="styleAt(second_item, 1)"
                        @update:model-value="setParamAt(second_item, 1, $event)"
                      />
                      <div
                        style="
                          margin: 0 15px;
                          font-size: 13px;
                          color: #606266;
                          line-height: 30px;
                          width: 70px;
                          white-space: nowrap;
                        "
                      >
                        之间
                      </div>
                    </div>
                    <div
                      v-if="second_item.function == 'queal' || second_item.function == 'notQueal'"
                    >
                      <el-input
                        :model-value="paramAt(second_item, 0)"
                        style="padding: 0 15px; width: 350px"
                        placeholder="请输入内容"
                        :style="styleAt(second_item, 0)"
                        @update:model-value="setParamAt(second_item, 0, $event)"
                      />
                    </div>

                    <!-- 时间条件  -->
                    <div v-if="second_item.function == 'absolute_between'" class="conditonItem">
                      <!-- 绝对时间 -->
                      <span class="tipSpan" style="margin-left: 0">在</span>
                      <el-date-picker
                        :model-value="paramAt(second_item, 0)"
                        type="datetime"
                        placeholder="选择日期时间"
                        value-format="YYYY-MM-DD HH:mm:ss"
                        style="line-height: 30px; width: 180px"
                        :shortcuts="dateShortcuts"
                        :style="styleAt(second_item, 0)"
                        @update:model-value="setParamAt(second_item, 0, $event)"
                      />
                      <span class="tipSpan">到</span>
                      <el-date-picker
                        :model-value="paramAt(second_item, 1)"
                        value-format="YYYY-MM-DD HH:mm:ss"
                        type="datetime"
                        placeholder="选择日期时间"
                        style="line-height: 30px; width: 180px"
                        :shortcuts="dateShortcuts"
                        :style="styleAt(second_item, 1)"
                        @update:model-value="setParamAt(second_item, 1, $event)"
                      />
                      <span class="tipSpan">之间</span>
                    </div>
                    <div v-if="second_item.function == 'extract_between'" class="conditonItem">
                      <span class="tipSpan" style="margin-left: 0">在</span>
                      <!-- 与 v2 一致（v2 此处逻辑存疑：这一个输入框用的是行内 width:100px，
                           而不是另一个分支里的 .input_number_width 类，效果相同但写法不统一） -->
                      <el-input
                        :model-value="paramAt(second_item, 0)"
                        type="number"
                        :min="1"
                        style="width: 100px"
                        placeholder=""
                        :style="styleAt(second_item, 0)"
                        @update:model-value="setParamAt(second_item, 0, $event)"
                        @change="timeLimitFunc($event, second_item, 0)"
                      />
                      <span class="tipSpan">:00到</span>
                      <el-input
                        :model-value="paramAt(second_item, 1)"
                        type="number"
                        :min="1"
                        class="input_number_width"
                        :style="styleAt(second_item, 1)"
                        @update:model-value="setParamAt(second_item, 1, $event)"
                        @change="timeLimitFunc($event, second_item, 1)"
                      />
                      <span class="tipSpan">:59之间</span>
                    </div>
                    <div v-if="second_item.function == 'relative_within'" class="conditonItem">
                      <span class="tipSpan" style="margin-left: 0">在</span>

                      <el-input
                        :model-value="paramAt(second_item, 0)"
                        type="number"
                        :min="1"
                        class="input_number_width"
                        :style="styleAt(second_item, 0)"
                        placeholder=""
                        @update:model-value="setParamAt(second_item, 0, $event)"
                      />

                      <el-select
                        :model-value="paramAt(second_item, 1)"
                        :style="styleAt(second_item, 1)"
                        placeholder=""
                        style="width: 100px; margin-left: 15px"
                        @update:model-value="setParamAt(second_item, 1, $event)"
                      >
                        <el-option
                          v-for="x in dateTimeList"
                          :key="x.name"
                          :label="x.displayName"
                          :value="x.name"
                        >
                          <div>
                            {{ x.displayName }}
                          </div>
                        </el-option>
                      </el-select>
                      <span class="tipSpan">之内</span>
                    </div>
                    <div v-if="second_item.function == 'relative_between'" class="conditonItem">
                      <span class="tipSpan" style="margin-left: 0">在过去</span>
                      <el-input
                        :model-value="paramAt(second_item, 0)"
                        type="number"
                        :min="1"
                        class="input_number_width"
                        :style="styleAt(second_item, 0)"
                        placeholder=""
                        @update:model-value="setParamAt(second_item, 0, $event)"
                      />
                      <span class="tipSpan">天到过去</span>
                      <el-input
                        :model-value="paramAt(second_item, 1)"
                        type="number"
                        :min="1"
                        class="input_number_width"
                        :style="styleAt(second_item, 1)"
                        placeholder=""
                        @update:model-value="setParamAt(second_item, 1, $event)"
                      />
                      <span class="tipSpan">天之内</span>
                    </div>
                    <div
                      v-if="second_item.function == 'relative_event_time'"
                      class="conditonItem"
                      style="display: flex"
                    >
                      <!-- 相对时间发生时间 -->
                      <span class="tipSpan" style="margin-left: 0px">在</span>
                      <el-select
                        :model-value="paramAt(second_item, 0)"
                        placeholder=""
                        style="width: 100px"
                        :style="styleAt(second_item, 0)"
                        @update:model-value="setParamAt(second_item, 0, $event)"
                      >
                        <el-option
                          v-for="x in relativeTime"
                          :key="x.name"
                          :label="x.displayName"
                          :value="x.name"
                        >
                          <div>
                            {{ x.displayName }}
                          </div>
                        </el-option>
                      </el-select>
                      <div
                        v-if="
                          second_item.params?.[0] == 'afterDay' ||
                          second_item.params?.[0] == 'beforeDay'
                        "
                        style="display: flex"
                      >
                        <el-input
                          :model-value="paramAt(second_item, 1)"
                          type="number"
                          :min="1"
                          class="input_number_width"
                          style="margin-left: 15px"
                          :style="styleAt(second_item, 1)"
                          placeholder=""
                          @update:model-value="setParamAt(second_item, 1, $event)"
                        />
                        <el-select
                          :model-value="paramAt(second_item, 2)"
                          :style="styleAt(second_item, 2)"
                          placeholder=""
                          style="width: 100px; margin-left: 15px"
                          @update:model-value="setParamAt(second_item, 2, $event)"
                        >
                          <el-option
                            v-for="x in dateTimeList"
                            :key="x.name"
                            :label="x.displayName"
                            :value="x.name"
                          >
                            <div>
                              {{ x.displayName }}
                            </div>
                          </el-option>
                        </el-select>
                        <span class="tipSpan">之内</span>
                      </div>
                    </div>
                  </div>
                  <!-- end -->

                  <el-icon
                    class="el-icon-close delete_btn"
                    style="margin-top: 0px"
                    @click="gloabDeleteEvent(secondP_index)"
                  >
                    <Close />
                  </el-icon>
                </div>
                <div v-if="modelObject.attribute.filters.length > 1" style="display: flex">
                  <span
                    class="el-icon-plus"
                    style="padding: 0px 0 0 13px"
                    @click="
                      secondLevelEvent(secondP_index, second_index, modelObject.attribute, 'gloab')
                    "
                  >
                    <el-icon><Plus /></el-icon>添加过滤条件
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <!-- 初始为空 -->
        <div
          v-if="modelObject.attribute.filters.length == 0"
          class="circle"
          @click="gloabAddEvent()"
        ></div>
        <div v-else style="display: flex">
          <div class="el-icon-plus" :style="addBtnStyle" @click="gloabAddEvent()">
            <el-icon><Plus /></el-icon>添加过滤条件
          </div>
        </div>
      </el-row>
    </div>
  </div>
</template>

<style lang="scss">
.headTitle {
  width: 80px;
  line-height: 30px;
}

// 匹配不到样式隐藏
.el-select-dropdown__empty {
  display: none !important;
}
</style>

<style lang="scss" scoped>
// 校验字段
.conditonItem {
  .border-error {
    border-color: red;
  }

  .conditonItem {
    min-width: 500px;
    line-height: 30px;
    font-size: 13px;
    color: gray;
    margin-left: 20px;
  }

  .tipSpan {
    margin: 0 15px;
    font-size: 13px;
    color: #606266;
    line-height: 30px;
  }
}

p {
  white-space: nowrap;
  padding: 0;
  margin: 0;
}

.titleHead {
  color: #6d6e70;
  font-size: 13px;
}

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
  font-size: 10px;
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

// v2 的 .el-input--medium .el-input__inner 同理
:deep(.el-input__inner) {
  height: 30px;
  line-height: 30px;
  font-size: 12px;
  margin-top: 0 !important;
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
  margin: 15px 48px;

  // 指标间距
  .pointer_spacing {
  }

  .el-icon-plus {
    color: #2c7be5;
    font-size: 13px;
    margin-top: 3px;
    padding-left: 37px;
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

  .el-icon-close {
    &:hover {
      color: #2c7be5;
    }
  }

  .add_icon {
    cursor: pointer;
    font-size: 30px;
    font-weight: 400;
    margin-top: 15px;
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
}
</style>
