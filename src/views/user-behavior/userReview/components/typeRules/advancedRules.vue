<script setup lang="ts">
/**
 * 用户复查 - 高级筛选的条件编辑器（对应 v2 .../userReview/components/typeRules/advancedRules.vue）。
 *
 * 注意：v2 的 list.vue 里 `queryForm.mode == 'advanced'` 那一段模板和 advancedRules 的使用
 * 整体被注释掉了，所以本组件目前没有任何入口，这里按原样迁过来备用。
 *
 * 与 v2 一致（v2 此处逻辑存疑，以下都是从没被用到的死代码，这里不再搬运）：
 *   - import 的 groupValueType（@/utils/modelOptions/custom 里根本没有这个导出）
 *   - computed treeOptions、data 里的 dayScope / oldProperty / pickerOptions
 *   - methods 里的 handleVisibleChangeNew / repeatEvent / filterObjects / strictMode / filterCommonType
 *   - this.complexMode 这个属性在组件里根本不存在，所以
 *     `this.complexMode ? "user_property" : this.radioOptions[0].value` 恒为 radioOptions[0].value，
 *     而 radioOptions[0].value 正好也是 "user_property"。
 */
import { computed, nextTick, onMounted, ref } from 'vue'
import { Close, Plus } from '@element-plus/icons-vue'
import treeSelect from './treeSelect.vue'
import { getOptionsByType } from './propertyOptions'
import { relativeTime, dateTimeList } from '@/utils/modelOptions/custom'
import { computedStyle as computedStyleRaw } from '../../types'
import type {
  ConditionItem,
  FilterGroup,
  ModelObject,
  PropertyListMap,
  PropertyNode,
  RadioOption,
} from '../../types'

const props = withDefaults(
  defineProps<{
    fieldTypeList?: unknown[]
    propertyList?: Partial<PropertyListMap>
    pointProtoList?: PropertyNode[]
    modelObject: ModelObject
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

/** 是否开启复杂条件。v2 的 data 默认 true，gloabAddEvent 里再按 localStorage 刷新 */
const openComplex = ref(true)

const radioOptions: RadioOption[] = [
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

/** 事件属性。v2 在模板里写的是 pointProtoFilter()，这里改成 computed 免得每次渲染都调一遍 */
const pointProtoFilter = computed(() => props.propertyList.commonPropertySum || [])

function timeLimitFunc(event: string | number, second_item: ConditionItem, index: number) {
  if (Number(event) > 23) {
    second_item.params[index] = 23
  }
}

// 设置校验样式
function computedStyle(value: unknown) {
  return computedStyleRaw(value, props.modelObject)
}

function gloabDeleteEvent(secondP_index: number) {
  props.modelObject.filters.splice(secondP_index, 1)
  if (props.modelObject.filters.length < 2) {
    delete props.modelObject.relation
  }
}

function getLetterByIndex(index: number) {
  if (index < 0 || index >= 26) {
    return String.fromCharCode(65 + (index % 26))
  }
  return String.fromCharCode(65 + index) // 65 是大写字母 A 的 ASCII 编码
}

/**
 * 判等符下拉。getOptionsByType 忽略入参、永远返回同一个常量数组，
 * 所以模板里直接调用不会引起额外渲染（与 v2 行为一致）。
 */
function filterGlobalSelect(item: ConditionItem) {
  return getOptionsByType(item.dataType) || []
}

function handelJudge(second_item: ConditionItem) {
  if (second_item.params[0]) {
    second_item.params = []
  }
  if (second_item.params[1]) {
    second_item.params = []
  }
}

// 时间区间
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
  if (proto_init_value && !proto_init_value.displayName) {
    // 与 v2 一致：userProperties 为空时这里会被赋成 undefined，后面读 .name 就抛错
    const first = props.propertyList.userProperties?.[0]
    proto_init_value = first as PropertyNode
  }
}

function equalityEvent(secondP_index: number, three_list: ModelObject) {
  // 设置默认值：优先取单选类型的第一个值，其次使用 user_property（complexMode 不存在，恒走 else）
  const initEventName = radioOptions[0]?.value
  refreshDefault()
  three_list.filters.map((item, index) => {
    if (index == secondP_index) {
      const threeObj: ConditionItem = {
        field: proto_init_value && proto_init_value.name,
        dataType: proto_init_value && proto_init_value.dataType, // 类型
        fieldType: initEventName, // 设置类型标识
        function: 'belone',
        params: [],
      }

      item.conditions[item.conditions.length] = threeObj
    }
  })
}

// 增加默认值
function secondLevelEvent(secondP_index: number, second_list: ModelObject) {
  // 设置默认值（同上）
  const initEventName = radioOptions[0]?.value
  refreshDefault()
  const addObj: ConditionItem = {
    field: proto_init_value && proto_init_value.name,
    dataType: proto_init_value && proto_init_value.dataType, // 类型
    fieldType: initEventName, // 设置类型标识
    function: 'belone',
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
  // 初始类型：优先 radioOptions 第一个值，其次使用 user_property
  const initEventName = radioOptions[0]?.value
  const userProperties = props.propertyList.userProperties
  const first = userProperties?.[0]
  if (userProperties && userProperties.length > 0 && first) {
    proto_init_value = first
  } else {
    proto_init_value = {
      dataType: '',
      displayName: '',
      name: '',
      propertyId: '',
    }
  }
  openComplexMode()
  // 设置初始默认值
  if (props.modelObject.filters) {
    props.modelObject.filters.push({
      conditions: [
        {
          field: proto_init_value.name,
          dataType: proto_init_value.dataType,
          fieldType: initEventName,
          function: openComplex.value ? 'equal' : 'belone',
          params: [],
        },
      ],
    })
  }
  if (props.modelObject.filters.length > 1) {
    props.modelObject.relation = 'and'
  }
}

// 开启复杂模式按钮
function openComplexMode() {
  const raw = localStorage.getItem('complexMode')
  // 将字符串值规范为布尔：'true'/'1' 视为开启，其它视为关闭
  const enabled = raw === 'true' || raw === '1'
  openComplex.value = enabled
}

onMounted(() => {
  nextTick(() => {
    // 初始化时如果没有过滤条件 则添加一个
    if (props.modelObject.filters.length == 0) {
      gloabAddEvent()
    }
  })
})

defineExpose({ gloabAddEvent, openComplexMode })
</script>

<template>
  <div class="box-card">
    <div>
      <!-- 全局筛选 -->
      <el-row>
        <div v-if="modelObject.filters && modelObject.filters.length > 1" class="global_filter">
          <div class="btn_line" />
          <el-radio-group v-model="modelObject.relation" size="small" class="custom_btn">
            <el-radio-button value="and">且</el-radio-button>
            <el-radio-button value="or">或</el-radio-button>
          </el-radio-group>
          <div class="btn_line" />
        </div>

        <div v-if="modelObject.filters.length > 0">
          <div
            v-for="(secondP_item, secondP_index) in modelObject.filters"
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
                modelObject.filters.length == 1 &&
                (modelObject.filters[0]?.conditions.length ?? 0) < 2
                  ? 'margin-left: 0px;'
                  : 'margin-left: 40px;'
              "
            >
              <div v-if="secondP_item.conditions.length > 1 && openComplex">
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
                    :radioOptions="radioOptions"
                    :second_item="second_item"
                    :propertyList="propertyList"
                    :second_index="second_index"
                    :pointProtoList="pointProtoFilter"
                  />
                  <!-- *** end *** -->

                  <el-select
                    v-model="second_item.function"
                    placeholder="请选择"
                    style="min-width: 100px"
                    :style="
                      second_item.function != 'noBelone' && second_item.function != 'belone'
                        ? 'margin-left: 0;'
                        : ''
                    "
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
                      <el-select
                        v-model="second_item.params"
                        style="margin-left: 15px; min-width: 350px"
                        multiple
                        filterable
                        allow-create
                        default-first-option
                        :style="computedStyle(second_item.params)"
                      >
                        <el-option v-for="x in second_item.params" :key="x" :label="x" :value="x">
                          {{ x }}
                        </el-option>
                      </el-select>
                    </div>
                    <div v-if="second_item.function == 'between'" style="display: flex">
                      <el-input
                        v-model="second_item.params[0]"
                        type="number"
                        style="margin-left: 15px"
                        placeholder="请输入内容-区间"
                        :style="computedStyle(second_item.params[0])"
                      />
                      <span
                        style="margin: 0 15px; font-size: 13px; color: #606266; line-height: 30px"
                        >与</span
                      >
                      <el-input
                        v-model="second_item.params[1]"
                        type="number"
                        placeholder="请输入内容"
                        :style="computedStyle(second_item.params[1])"
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
                      v-if="
                        second_item.function == 'queal' || second_item.function == 'notQueal'
                      "
                    >
                      <el-input
                        v-model="second_item.params[0]"
                        style="padding: 0 15px; width: 350px"
                        placeholder="请输入内容"
                        :style="computedStyle(second_item.params[0])"
                      />
                    </div>
                  </div>
                  <!-- end -->

                  <el-icon
                    class="el-icon-close delete_btn"
                    style="line-height: 30px"
                    @click="threeDeleteEvent(secondP_index, second_index, modelObject.filters)"
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
                    @click="equalityEvent(secondP_index, modelObject)"
                  >
                    <el-icon><Plus /></el-icon>添加分群
                  </span>
                </div>
              </div>
              <!-- 一级条件筛选控件 -->
              <div v-else-if="secondP_item.conditions.length == 1">
                <div class="condition-init-item">
                  <div v-if="openComplex" class="letter_lower" style="margin-right: 7px">
                    {{ getLetterByIndex(secondP_index) }}
                  </div>
                  <treeSelect
                    :radioOptions="radioOptions"
                    :second_item="second_item"
                    :propertyList="propertyList"
                    :second_index="second_index"
                    :pointProtoList="pointProtoFilter"
                  />
                  <!-- 判等条件 -->
                  <el-select
                    v-model="second_item.function"
                    placeholder="请选择判等符"
                    style="min-width: 100px; margin-left: 15px"
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

                  <!-- 按分群筛选 属于 ？？  根据select选择 -->
                  <div class="conditonItem">
                    <div v-if="filterIstrue(second_item.function)">
                      <el-select
                        v-model="second_item.params"
                        style="margin-left: 15px; min-width: 350px"
                        multiple
                        filterable
                        allow-create
                        default-first-option
                        :style="computedStyle(second_item.params)"
                      >
                        <el-option v-for="x in second_item.params" :key="x" :label="x" :value="x">
                          {{ x }}
                        </el-option>
                      </el-select>
                    </div>
                    <div v-if="second_item.function == 'between'" style="display: flex">
                      <el-input
                        v-model="second_item.params[0]"
                        type="number"
                        style="margin-left: 15px"
                        :style="computedStyle(second_item.params[0])"
                      />
                      <span
                        style="margin: 0 15px; font-size: 13px; color: #606266; line-height: 30px"
                        >与</span
                      >
                      <el-input
                        v-model="second_item.params[1]"
                        type="number"
                        :style="computedStyle(second_item.params[1])"
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
                      v-if="
                        second_item.function == 'queal' || second_item.function == 'notQueal'
                      "
                    >
                      <el-input
                        v-model="second_item.params[0]"
                        style="padding: 0 15px; width: 350px"
                        placeholder="请输入内容"
                        :style="computedStyle(second_item.params[0])"
                      />
                    </div>

                    <div v-if="second_item.function == 'extract_between'" class="conditonItem">
                      <span class="tipSpan" style="margin-left: 0">在</span>
                      <el-input
                        v-model="second_item.params[0]"
                        type="number"
                        :min="1"
                        style="width: 100px"
                        placeholder=""
                        :style="computedStyle(second_item.params[0])"
                        @change="timeLimitFunc($event, second_item, 0)"
                      />
                      <span class="tipSpan">:00到</span>
                      <el-input
                        v-model="second_item.params[1]"
                        type="number"
                        :min="1"
                        style="width: 100px"
                        :style="computedStyle(second_item.params[1])"
                        @change="timeLimitFunc($event, second_item, 1)"
                      />
                      <span class="tipSpan">:59之间</span>
                    </div>
                    <div v-if="second_item.function == 'relative_within'" class="conditonItem">
                      <span class="tipSpan" style="margin-left: 0">在</span>

                      <el-input
                        v-model="second_item.params[0]"
                        type="number"
                        :min="1"
                        style="width: 100px"
                        :style="computedStyle(second_item.params[0])"
                        placeholder=""
                      />

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
                        style="width: 100px"
                        :style="computedStyle(second_item.params[0])"
                        placeholder=""
                      />
                      <span class="tipSpan">天到过去</span>
                      <el-input
                        v-model="second_item.params[1]"
                        type="number"
                        :min="1"
                        style="width: 100px"
                        :style="computedStyle(second_item.params[1])"
                        placeholder=""
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
                          style="width: 100px; margin-left: 15px"
                          :style="computedStyle(second_item.params[1])"
                          placeholder=""
                        />
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
                <div v-if="modelObject.filters.length > 1 && openComplex" style="display: flex">
                  <span
                    class="el-icon-plus"
                    style="padding: 0px 0 0 13px"
                    @click="secondLevelEvent(secondP_index, modelObject)"
                  >
                    <el-icon><Plus /></el-icon>添加分群
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <!-- 初始为空 -->
        <div
          v-if="modelObject.filters.length == 0"
          style="display: flex; align-items: center; font-size: 13px"
        >
          <div class="setMarginRight" style="color: #2c7be6">添加分群:</div>
          <div class="circle" @click="gloabAddEvent()" />
        </div>

        <div v-else style="display: flex">
          <div
            class="el-icon-plus"
            :style="
              modelObject.filters.length == 1 &&
              (modelObject.filters[0]?.conditions.length ?? 0) < 2
                ? 'padding-left:0'
                : ' '
            "
            @click="gloabAddEvent()"
          >
            <el-icon><Plus /></el-icon>添加分群
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
.condition-init-item {
  display: flex;
  padding-top: 0px;
  align-items: flex-start;
}

.global_filter {
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
}

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
  margin: 15px 15px;

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
