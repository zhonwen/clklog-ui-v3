<script setup lang="ts">
/**
 * 首次末次特征（对应 v2 src/views/ups/userTag/components/firstLastFeature/index.vue）。
 *
 * 只负责持有整块模型 modelObject 和日历联级 cascaderList，规则编辑交给 basicRules。
 * 父组件 tag-creator 通过 ref 直接读 `modelObject` / `cascaderList`，所以两者都必须 defineExpose。
 *
 * 与 basicpointer 的两点差异（以 v2 的 firstLastFeature 为准）：
 *   1. valueType 初值是 "DATETIME"（basicpointer 是 "LIST"），并且会被 basicRules 的
 *      dateTypeEvent 覆盖成所选属性的 dataType。
 *   2. 回显时多一层 `createType == "首次末次特征"` 判断，createType 对不上就什么都不做
 *      （既不回显、也不初始化一条规则，见下方注释）。
 *
 * cascaderList 用 makeCascaderList() 取一份新的：v2 直接引用 utils 里的常量数组，
 * 而 basicRules 会往它里面 push 自定义时间段，多个规则页共用同一个数组会互相污染。
 */
import { onMounted, nextTick, ref } from 'vue'
import basicRules from './basicRules.vue'
import { makeCascaderList } from '@/utils/modelOptions/up-manage'
import type { CascaderOption } from '@/utils/modelOptions/up-manage'
import type {
  EchoObj,
  FilterGroup,
  PointTypeList,
  PropertyListMap,
  PropertyNode,
  Relation,
  TagFormula,
} from '../../types'

/**
 * 与 v2 一致（v2 此处逻辑存疑：首末特征的过滤块用的字段名是 `measures`，
 * 而 basicpointer / 行为规则那几处用的是 `filters`。后端接口两种都收，
 * 这里照搬 v2 firstLastFeature 的 `measures`，不做统一）。
 */
interface FirstLastFilterBlock {
  relation?: Relation
  measures: FilterGroup[]
}

/** 首末特征的一条 measure：比公共 MeasureItem 多一个 occurFunc、没有 params / setInterval */
interface FirstLastMeasure {
  eventName: string
  casList: string[]
  aggregator?: string
  /** 发生方式：首次发生 / 末次发生 */
  occurFunc: string
  name: string
  echoObj: EchoObj
  earlistTime: string | number
  latestTime: string | number
  filter: FirstLastFilterBlock
  field?: string
  fieldType?: string
}

const props = withDefaults(
  defineProps<{
    pointProtoList?: PropertyNode[]
    propertyList?: Partial<PropertyListMap>
    pointTypeList?: PointTypeList
    formula?: TagFormula
  }>(),
  {
    pointProtoList: () => [],
    propertyList: () => ({}),
    pointTypeList: () => ({ userProtoList: [], eventProtoList: [] }),
    formula: () => ({}),
  },
)

const modelObject = ref<{
  valueType: string
  rules: { relation?: Relation; measures: FirstLastMeasure[] }
}>({
  valueType: 'DATETIME', //模型类型
  rules: {
    measures: [],
  },
})

//日历
const cascaderList = ref<CascaderOption[]>(makeCascaderList())

const basicRulesRef = ref<InstanceType<typeof basicRules> | null>(null)

onMounted(() => {
  void nextTick(() => {
    if (props.formula.formula) {
      // 与 v2 一致（v2 此处逻辑存疑：createType 不是「首次末次特征」时既不回显、
      // 也不走 else 分支初始化一条空规则，页面会是空白的）
      if (props.formula.createType == '首次末次特征') {
        const modelRules = JSON.parse(props.formula.formula) as {
          measures: FirstLastMeasure[]
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
            :property-list="propertyList"
            :point-type-list="pointTypeList"
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
