<script setup lang="ts">
/**
 * 「用户属性满足」规则
 * （对应 v2 src/views/ups/userTag/components/customTagPage/typeRules/attributeRules.vue）。
 *
 * 数据结构：modelObject = 当前分层的 rules，本组件只动 modelObject.attribute
 *   attribute: { relation?: 'and'|'or', filters: [{ relation?, conditions: ConditionItem[] }] }
 * filters 少于 2 条时 v2 会 `delete attribute.relation`，原样保留。
 *
 * element-plus 适配：
 *   :picker-options       → :shortcuts
 *   value-format="yyyy-MM-dd HH:mm:ss" → "YYYY-MM-DD HH:mm:ss"
 *   align="right"         → element-plus 没有这个属性，去掉
 *   el-icon-xxx           → <el-icon> + icons-vue（类名沿用 v2，样式不动）
 *   this.$set(o, k, v)    → o[k] = v
 *
 * v2 里未搬运的死代码：treeOptions（computed，无引用）、repeatEvent、filterObjects、
 * handleVisibleChangeNew、dayScope（import 了但模板没用到）、conditionOption（import 了
 * 但模板里的条件区是手写的，没有用这个组件）。
 */
import { ref } from 'vue'
import { Close, Plus } from '@element-plus/icons-vue'
import treeSelect from '@/views/ups/components/tree-select.vue'
import { dateTimeList, getOptionsByType, relativeTime } from '@/utils/modelOptions/custom'
import type { OptionDef } from '@/utils/modelOptions/custom'
import { groupValueType } from '@/utils/modelOptions/up-manage'
import {
  computedStyle as computedStyleFn,
  conditionDayShortcuts,
  filterIstrue,
  getLetterByIndex,
  strictMode,
} from '../../../local-utils'
import type {
  ConditionItem,
  FilterBlock,
  PropertyListMap,
  PropertyNode,
  RadioOption,
  TagRuleSet,
} from '../../../types'

const props = withDefaults(
  defineProps<{
    fieldTypeList?: RadioOption[]
    propertyList?: Partial<PropertyListMap>
    pointProtoList?: PropertyNode[]
    modelObject: TagRuleSet
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
  // { label: "用户分群", value: "user_group" },
  { label: '用户标签', value: 'user_tag' },
]

/** 用户属性初始值 */
const proto_init_value = ref<PropertyNode>({
  dataType: '',
  displayName: '',
  name: '',
  propertyId: '',
})

function timeLimitFunc(event: string | number, second_item: ConditionItem, index: number) {
  if (Number(event) > 23) {
    second_item.params[index] = 23
  }
}

// 设置校验样式
function computedStyle(value: unknown) {
  return computedStyleFn(value, props.modelObject)
}

function gloabDeleteEvent(secondP_index: number) {
  props.modelObject.attribute.filters.splice(secondP_index, 1)
  if (props.modelObject.attribute.filters.length < 2) {
    delete props.modelObject.attribute.relation
  }
}

function checkTypeArray(item: ConditionItem): OptionDef[] {
  return getOptionsByType(item.dataType)
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

function inputTypeByDataType(item: ConditionItem) {
  if (!item || !item.dataType) return 'text'
  return item.dataType === 'NUMBER' ? 'number' : 'text'
}

function handelJudge(second_item: ConditionItem) {
  if (Array.isArray(second_item.params) && second_item.params.length > 0) {
    second_item.params = []
  }
}

function threeDeleteEvent(
  secondP_index: number,
  second_index: number,
  three_list: FilterBlock['filters'],
) {
  three_list[secondP_index]?.conditions.splice(second_index, 1)
}

function refreshDefault() {
  if (!proto_init_value.value.displayName) {
    const first = props.propertyList.userProperties?.[0]
    if (first) proto_init_value.value = first
  }
}

function filterCommonType(type?: string): OptionDef[] | '' {
  if (!type) return ''
  let options: OptionDef[] = []
  options = getOptionsByType(type)
  return options
}

function equalityEvent(
  secondP_index: number,
  second_index: number,
  three_list: FilterBlock,
  _model?: string,
) {
  // 设置默认值
  const initEventName = 'user_property'
  refreshDefault()
  three_list.filters.map((item, index) => {
    if (index == secondP_index) {
      const threeObj: ConditionItem = {
        field: proto_init_value.value.name,
        dataType: proto_init_value.value.dataType, //类型
        fieldType: initEventName, //设置类型标识
        // fieldFlag: this.proto_init_value.name, //回显option
        function: strictMode(filterCommonType(proto_init_value.value.dataType), 'name'),
        params: [],
      }

      item.conditions[item.conditions.length] = threeObj
    }
  })
}

// 增加默认值
function secondLevelEvent(
  secondP_index: number,
  second_index: number,
  second_list: FilterBlock,
  _model?: string,
) {
  // 设置默认值
  const initEventName = 'user_property'
  refreshDefault()
  const addObj: ConditionItem = {
    field: proto_init_value.value.name,
    dataType: proto_init_value.value.dataType, //类型
    fieldType: initEventName, //设置类型标识
    // fieldFlag: this.proto_init_value.name, //回显option
    function: strictMode(filterCommonType(proto_init_value.value.dataType), 'name'),
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

  const userProperties = props.propertyList.userProperties
  if (userProperties && userProperties.length > 0) {
    proto_init_value.value = userProperties[0] as PropertyNode
  } else {
    proto_init_value.value = {
      dataType: '',
      displayName: '',
      name: '',
      propertyId: '',
    }
  }
  // 设置初始默认值
  if (props.modelObject.attribute.filters) {
    props.modelObject.attribute.filters.push({
      conditions: [
        {
          field: proto_init_value.value.name,
          // fieldFlag: this.proto_init_value.name, //回显option
          dataType: proto_init_value.value.dataType, //类型
          fieldType: initEventName, //设置选择类型
          function: strictMode(filterCommonType(proto_init_value.value.dataType), 'name'),
          params: [],
        },
      ],
    })
  }
  if (props.modelObject.attribute.filters.length > 1) {
    props.modelObject.attribute.relation = 'and'
  }
}
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
          <el-radio-group
            v-model="modelObject.attribute.relation"
            size="small"
            class="custom_btn"
          >
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
              :style="
                modelObject.attribute.filters.length == 1 &&
                (modelObject.attribute.filters[0]?.conditions.length ?? 0) < 2
                  ? 'margin-left: 0px;'
                  : 'margin-left: 40px;'
              "
            >
              <div v-if="secondP_item.conditions.length > 1">
                <div
                  style="
                    display: flex;
                    padding-top: 0px;
                    align-items: flex-start;
                    margin-left: 45px;
                  "
                >
                  <!-- ***  二级组件 *** -->
                  <treeSelect
                    :radio-options="radioOptions"
                    :second_item="second_item"
                    :property-list="propertyList"
                    :second_index="second_index"
                    @change="handelJudge(second_item)"
                  ></treeSelect>
                  <!-- *** end *** -->

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
                          v-model="second_item.params[0]"
                          type="number"
                          class="input_number_width"
                          style="margin-left: 15px"
                          :style="computedStyle(second_item.params)"
                        ></el-input>
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
                            v-for="x in second_item.params"
                            :key="String(x)"
                            :label="String(x)"
                            :value="x"
                          >
                            {{ x }}
                          </el-option>
                        </el-select>
                      </div>
                    </div>
                    <div v-if="second_item.function == 'between'" style="display: flex">
                      <el-input
                        v-model="second_item.params[0]"
                        type="number"
                        style="margin-left: 15px"
                        class="input_number_width"
                        placeholder=""
                        :style="computedStyle(second_item.params[0])"
                      ></el-input>
                      <span
                        style="margin: 0 15px; font-size: 13px; color: #606266; line-height: 30px"
                        >与</span
                      >
                      <el-input
                        v-model="second_item.params[1]"
                        type="number"
                        class="input_number_width"
                        placeholder=""
                        :style="computedStyle(second_item.params[1])"
                      ></el-input>
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
                      v-if="
                        second_item.function == 'queal' || second_item.function == 'notQueal'
                      "
                    >
                      <el-input
                        v-model="second_item.params[0]"
                        :type="inputTypeByDataType(second_item)"
                        style="padding: 0 15px; width: 350px"
                        placeholder="请输入内容"
                        :style="computedStyle(second_item.params[0])"
                      ></el-input>
                    </div>

                    <!-- 时间条件  -->
                    <div v-if="second_item.function == 'absolute_between'" class="conditonItem">
                      <!-- 绝对时间 -->
                      <span class="tipSpan" style="margin-left: 0">在</span>
                      <el-date-picker
                        v-model="second_item.params[0]"
                        type="datetime"
                        placeholder="选择日期时间"
                        value-format="YYYY-MM-DD HH:mm:ss"
                        style="line-height: 30px; width: 180px"
                        :shortcuts="conditionDayShortcuts"
                        :style="computedStyle(second_item.params[0])"
                      >
                      </el-date-picker>
                      <span class="tipSpan">到</span>
                      <el-date-picker
                        v-model="second_item.params[1]"
                        value-format="YYYY-MM-DD HH:mm:ss"
                        type="datetime"
                        placeholder="选择日期时间"
                        style="line-height: 30px; width: 180px"
                        :shortcuts="conditionDayShortcuts"
                        :style="computedStyle(second_item.params[1])"
                      >
                      </el-date-picker>
                      <span class="tipSpan">之间</span>
                    </div>
                    <div v-if="second_item.function == 'extract_between'" class="conditonItem">
                      <span class="tipSpan" style="margin-left: 0">在</span>
                      <el-input
                        v-model="second_item.params[0]"
                        type="number"
                        :min="1"
                        class="input_number_width"
                        placeholder=""
                        :style="computedStyle(second_item.params[0])"
                        @change="timeLimitFunc($event, second_item, 0)"
                      ></el-input>
                      <span class="tipSpan">:00到</span>
                      <el-input
                        v-model="second_item.params[1]"
                        type="number"
                        :min="1"
                        class="input_number_width"
                        :style="computedStyle(second_item.params[1])"
                        @change="timeLimitFunc($event, second_item, 1)"
                      ></el-input>
                      <span class="tipSpan">:59之间</span>
                    </div>
                    <div v-if="second_item.function == 'relative_within'" class="conditonItem">
                      <span class="tipSpan" style="margin-left: 0">在</span>

                      <el-input
                        v-model="second_item.params[0]"
                        type="number"
                        :min="1"
                        class="input_number_width"
                        :style="computedStyle(second_item.params[0])"
                        placeholder=""
                      ></el-input>

                      <el-select
                        v-model="second_item.params[1]"
                        :style="computedStyle(second_item.params[1])"
                        placeholder=""
                        style="width: 100px; margin-left: 15px"
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
                        v-model="second_item.params[0]"
                        type="number"
                        :min="1"
                        class="input_number_width"
                        :style="computedStyle(second_item.params[0])"
                        placeholder=""
                      ></el-input>
                      <span class="tipSpan">天到过去</span>
                      <el-input
                        v-model="second_item.params[1]"
                        type="number"
                        :min="1"
                        class="input_number_width"
                        :style="computedStyle(second_item.params[1])"
                        placeholder=""
                      ></el-input>
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
                        v-model="second_item.params[0]"
                        placeholder=""
                        style="width: 100px"
                        :style="computedStyle(second_item.params[0])"
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
                          second_item.params[0] == 'afterDay' ||
                          second_item.params[0] == 'beforeDay'
                        "
                        style="display: flex"
                      >
                        <el-input
                          v-model="second_item.params[1]"
                          type="number"
                          :min="1"
                          class="input_number_width"
                          style="margin-left: 15px"
                          :style="computedStyle(second_item.params[1])"
                          placeholder=""
                        ></el-input>
                        <el-select
                          v-model="second_item.params[2]"
                          :style="computedStyle(second_item.params[2])"
                          placeholder=""
                          style="width: 100px; margin-left: 15px"
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
                      threeDeleteEvent(
                        secondP_index,
                        second_index,
                        modelObject.attribute.filters,
                      )
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
                      equalityEvent(
                        secondP_index,
                        second_index,
                        modelObject.attribute,
                        'gloab',
                      )
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
                    :radio-options="radioOptions"
                    :second_item="second_item"
                    :property-list="propertyList"
                    :second_index="second_index"
                    @change="handelJudge(second_item)"
                  ></treeSelect>
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
                    <!-- 根据NUMBER类型展示文本 -->
                    <div v-if="filterIstrue(second_item.function)">
                      <div v-if="second_item.dataType == 'NUMBER'">
                        <el-input
                          v-model="second_item.params[0]"
                          type="number"
                          class="input_number_width"
                          style="margin-left: 15px"
                          :style="computedStyle(second_item.params)"
                        ></el-input>
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
                            v-for="x in second_item.params"
                            :key="String(x)"
                            :label="String(x)"
                            :value="x"
                          >
                            {{ x }}
                          </el-option>
                        </el-select>
                      </div>
                    </div>
                    <div v-if="second_item.function == 'between'" style="display: flex">
                      <el-input
                        v-model="second_item.params[0]"
                        type="number"
                        class="input_number_width"
                        style="margin-left: 15px"
                        placeholder=""
                        :style="computedStyle(second_item.params[0])"
                      ></el-input>
                      <span
                        style="margin: 0 15px; font-size: 13px; color: #606266; line-height: 30px"
                        >与</span
                      >
                      <el-input
                        v-model="second_item.params[1]"
                        type="number"
                        class="input_number_width"
                        placeholder=""
                        :style="computedStyle(second_item.params[1])"
                      ></el-input>
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
                      v-if="
                        second_item.function == 'queal' || second_item.function == 'notQueal'
                      "
                    >
                      <el-input
                        v-model="second_item.params[0]"
                        :type="inputTypeByDataType(second_item)"
                        style="padding: 0 15px; width: 350px"
                        placeholder="请输入内容"
                        :style="computedStyle(second_item.params[0])"
                      ></el-input>
                    </div>

                    <!-- 时间条件  -->
                    <div v-if="second_item.function == 'absolute_between'" class="conditonItem">
                      <!-- 绝对时间 -->
                      <span class="tipSpan" style="margin-left: 0">在</span>
                      <el-date-picker
                        v-model="second_item.params[0]"
                        type="datetime"
                        placeholder="选择日期时间"
                        value-format="YYYY-MM-DD HH:mm:ss"
                        style="line-height: 30px; width: 180px"
                        :shortcuts="conditionDayShortcuts"
                        :style="computedStyle(second_item.params[0])"
                      >
                      </el-date-picker>
                      <span class="tipSpan">到</span>
                      <el-date-picker
                        v-model="second_item.params[1]"
                        value-format="YYYY-MM-DD HH:mm:ss"
                        type="datetime"
                        placeholder="选择日期时间"
                        style="line-height: 30px; width: 180px"
                        :shortcuts="conditionDayShortcuts"
                        :style="computedStyle(second_item.params[1])"
                      >
                      </el-date-picker>
                      <span class="tipSpan">之间</span>
                    </div>
                    <div v-if="second_item.function == 'extract_between'" class="conditonItem">
                      <span class="tipSpan" style="margin-left: 0">在</span>
                      <el-input
                        v-model="second_item.params[0]"
                        type="number"
                        :min="1"
                        class="input_number_width"
                        placeholder=""
                        :style="computedStyle(second_item.params[0])"
                        @change="timeLimitFunc($event, second_item, 0)"
                      ></el-input>
                      <span class="tipSpan">:00到</span>
                      <el-input
                        v-model="second_item.params[1]"
                        type="number"
                        :min="1"
                        class="input_number_width"
                        :style="computedStyle(second_item.params[1])"
                        @change="timeLimitFunc($event, second_item, 1)"
                      ></el-input>
                      <span class="tipSpan">:59之间</span>
                    </div>
                    <div v-if="second_item.function == 'relative_within'" class="conditonItem">
                      <span class="tipSpan" style="margin-left: 0">在</span>

                      <el-input
                        v-model="second_item.params[0]"
                        type="number"
                        :min="1"
                        class="input_number_width"
                        :style="computedStyle(second_item.params[0])"
                        placeholder=""
                      ></el-input>

                      <el-select
                        v-model="second_item.params[1]"
                        :style="computedStyle(second_item.params[1])"
                        placeholder=""
                        style="width: 100px; margin-left: 15px"
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
                        v-model="second_item.params[0]"
                        type="number"
                        :min="1"
                        class="input_number_width"
                        :style="computedStyle(second_item.params[0])"
                        placeholder=""
                      ></el-input>
                      <span class="tipSpan">天到过去</span>
                      <el-input
                        v-model="second_item.params[1]"
                        type="number"
                        :min="1"
                        class="input_number_width"
                        :style="computedStyle(second_item.params[1])"
                        placeholder=""
                      ></el-input>
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
                        v-model="second_item.params[0]"
                        placeholder=""
                        style="width: 100px"
                        :style="computedStyle(second_item.params[0])"
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
                          second_item.params[0] == 'afterDay' ||
                          second_item.params[0] == 'beforeDay'
                        "
                        style="display: flex"
                      >
                        <el-input
                          v-model="second_item.params[1]"
                          type="number"
                          :min="1"
                          class="input_number_width"
                          style="margin-left: 15px"
                          :style="computedStyle(second_item.params[1])"
                          placeholder=""
                        ></el-input>
                        <el-select
                          v-model="second_item.params[2]"
                          :style="computedStyle(second_item.params[2])"
                          placeholder=""
                          style="width: 100px; margin-left: 15px"
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
                      secondLevelEvent(
                        secondP_index,
                        second_index,
                        modelObject.attribute,
                        'gloab',
                      )
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
          <div
            class="el-icon-plus"
            :style="
              modelObject.attribute.filters.length == 1 &&
              (modelObject.attribute.filters[0]?.conditions.length ?? 0) < 2
                ? 'padding-left:0'
                : ' '
            "
            @click="gloabAddEvent()"
          >
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

:deep(.custom_btn .el-radio-button__original-radio:checked + .el-radio-button__inner) {
  font-size: 10px;
}

:deep(.custom_btn .el-radio-button:last-child .el-radio-button__inner) {
  font-size: 10px;
}

:deep(.el-radio-button:first-child .el-radio-button__inner) {
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

:deep(.el-input__wrapper) {
  height: 30px;
  line-height: 30px;
  font-size: 12px;
  margin-top: 0 !important;
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
  margin: 15px 48px;

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

  .el-icon-close:hover {
    color: #2c7be5;
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
    // v3 的 <el-icon> 是 inline-flex + height:1em，line-height 撑不开盒子；
    // 用同值 height 还原 v2 字体图标的垂直居中（el-icon 自带 align-items:center）
    height: 30px;
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
