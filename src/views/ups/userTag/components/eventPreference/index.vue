<script setup lang="ts">
/**
 * 事件偏好属性（对应 v2 src/views/ups/userTag/components/eventPreference/index.vue）。
 *
 * 只负责持有整块模型 modelObject 和日历联级 cascaderList，规则编辑交给 basicRules。
 * 父组件 tag-creator 通过 ref 直接读 `modelObject` / `cascaderList`，所以两者都必须 defineExpose。
 *
 * cascaderList 用 makeCascaderList() 取一份新的：v2 直接引用 utils 里的常量数组，
 * 而 basicRules 会往它里面 push 自定义时间段，多个规则页共用同一个数组会互相污染。
 *
 * v2 里未搬运的死代码：computed projectName（模板/逻辑里都没有读）。
 */
import { onMounted, nextTick, ref } from 'vue'
import basicRules from './basicRules.vue'
import { makeCascaderList } from '@/utils/modelOptions/up-manage'
import type { CascaderOption } from '@/utils/modelOptions/up-manage'
import type {
  MeasureItem,
  PointTypeList,
  PropertyListMap,
  PropertyNode,
  TagFormula,
} from '../../types'

/**
 * 事件偏好属性的一条 measure。
 * 公共 MeasureItem 上没有 fieldName / appearNum 这两个本模块独有的字段，就地扩展。
 * （basicRules.vue 里有一份同形的声明，两边结构一致所以可以互相赋值。）
 */
type EventPreferenceMeasure = MeasureItem & {
  /** 事件字段（v2 的「新增 field 事件」联级） */
  fieldName: string
  /** 取前 N 名 */
  appearNum: number
}

const props = withDefaults(
  defineProps<{
    formula?: TagFormula
    propertyList?: Partial<PropertyListMap>
    pointProtoList?: PropertyNode[]
    pointTypeList?: PointTypeList
  }>(),
  {
    formula: () => ({}),
    propertyList: () => ({}),
    pointProtoList: () => [],
    pointTypeList: () => ({ userProtoList: [], eventProtoList: [] }),
  },
)

const cascaderList = ref<CascaderOption[]>(makeCascaderList())
const modelObject = ref<{
  valueType: string
  rules: { relation?: 'and' | 'or'; measures: EventPreferenceMeasure[] }
}>({
  valueType: 'LIST', //模型类型
  rules: {
    measures: [],
  },
})

const basicRulesRef = ref<InstanceType<typeof basicRules> | null>(null)

onMounted(() => {
  // 规则模型数据回显
  void nextTick(() => {
    if (props.formula.formula) {
      //编辑状态 -- 回显模型
      if (props.formula.createType == '事件偏好属性') {
        const modelRules = JSON.parse(props.formula.formula) as {
          measures: EventPreferenceMeasure[]
        }
        modelObject.value.rules.measures = modelRules.measures
        const echoCascader = modelRules.measures[0]?.echoObj.cascaderList
        if (echoCascader) {
          cascaderList.value = echoCascader
        }
      }
    } else {
      // 新增标签状态 -- 初始模型规则
      setTimeout(() => {
        basicRulesRef.value?.circleAddEvent()
      }, 500)
    }
  })
})

/** 子组件切到别的字段时，标签值类型跟着字段的 dataType 走 */
function dateTypeEvent(data: string) {
  modelObject.value.valueType = data
}

defineExpose({ modelObject, cascaderList })
</script>

<template>
  <div class="condition_rules">
    <el-row class="zc_userMannage">
      <div class="singItem">
        <div class="type_event">
          <div class="public-threeHead createTitle">创建规则:</div>
          <basicRules
            ref="basicRulesRef"
            :point-proto-list="pointProtoList"
            :model-object="modelObject.rules"
            :cascader-list="cascaderList"
            :point-type-list="pointTypeList"
            :property-list="propertyList"
            @date-type-event="dateTypeEvent"
          ></basicRules>
        </div>
      </div>
    </el-row>
  </div>
</template>

<style lang="scss" scoped>
// el-radio 自定义样式
:deep(.custom_btn) {
  padding: 1px 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;

  .el-radio-button:first-child .el-radio-button__inner {
    border-left: 0px;
    font-size: 10px;
    border-radius: 4px 4px 0 0;
  }

  .el-radio-button__original-radio:checked + .el-radio-button__inner {
    font-size: 10px;
    color: #ffffff;
    background-color: #619ff3;
    border-color: #619ff3;
    -webkit-box-shadow: -1px 0 0 0 #619ff3;
    box-shadow: -1px 0 0 0 #619ff3;
  }

  .el-radio-button:last-child .el-radio-button__inner {
    font-size: 10px;
    border-radius: 0 0 4px 4px;
  }

  .el-radio-button--small .el-radio-button__inner {
    padding: 5px;
  }
}

.createTitle {
  margin: 15px 0;
  white-space: nowrap;
  line-height: 30px;
  margin-right: 30px;
}

.condition_rules {
  min-height: 180px;
  border-radius: 6px;

  .zc_userMannage {
    // 满足模块条件
    .singItem {
      .type_event {
        display: flex;

        .el-icon-remove-outline {
          color: #2c7be5;
          margin-right: 7px;
          cursor: pointer;
        }
      }
    }
  }
}
</style>
