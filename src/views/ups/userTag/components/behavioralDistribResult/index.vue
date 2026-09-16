<script setup lang="ts">
/**
 * 行为分布结果（对应 v2 src/views/ups/userTag/components/behavioralDistribResult/index.vue）。
 *
 * 只负责持有整块模型 modelObject 和日历联级 cascaderList，规则编辑交给 basicRules。
 * 父组件 tag-creator 通过 ref 直接读 `modelObject` / `cascaderList`
 * （v2 tag-creator.vue:718 / :1029 —— Object.assign(modelObject, ruleForm) 之后
 *  再把 cascaderList 写进 obj.rules.measures[0].echoObj.cascaderList），
 * 所以两者都必须 defineExpose，漏了父组件会拿到 undefined。
 *
 * cascaderList 用 makeCascaderList() 取一份新的：v2 直接引用 utils 里的常量数组，
 * 而 basicRules 会往它里面 push 自定义时间段，多个规则页共用同一个数组会互相污染。
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
 * 行为分布结果的 measure。
 *
 * v2 的 circleAddEvent 只建 eventName / dayOrTime / echoObj / earlistTime / latestTime / filter：
 * 公共类型 MeasureItem 里的 casList / name / params 在本模块不会被初始化（name 稍后由
 * refreshEvent 补上），而「按天数 / 按小时数」的 dayOrTime 公共类型里没有，
 * 所以这里就地收窄一层。types.ts 是只读公共文件，没有去改它。
 */
type DistribMeasure = Omit<MeasureItem, 'casList' | 'name' | 'params'> &
  Partial<Pick<MeasureItem, 'casList' | 'name' | 'params'>> & {
    /** 按天数(true) / 按小时数(false)，取值来自 distributList */
    dayOrTime: boolean
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

const cascaderList = ref<CascaderOption[]>(makeCascaderList())
const modelObject = ref<{
  valueType: string
  rules: { relation?: 'and' | 'or'; measures: DistribMeasure[] }
}>({
  valueType: 'NUMBER', //模型类型
  rules: {
    measures: [],
  },
})

const basicRulesRef = ref<InstanceType<typeof basicRules> | null>(null)

onMounted(() => {
  void nextTick(() => {
    if (props.formula.formula) {
      // 编辑状态 -- 回显模型
      // 与 v2 一致：这里额外卡了一层 createType 判断（其它几种创建方式的 index.vue 都没有），
      // createType 不是「行为分布结果」时整段跳过，modelObject 保持空 measures。
      if (props.formula.createType == '行为分布结果') {
        const modelRules = JSON.parse(props.formula.formula) as {
          measures: DistribMeasure[]
        }
        const echoCascader = modelRules.measures[0]?.echoObj.cascaderList
        if (echoCascader) {
          cascaderList.value = echoCascader
        }
        modelObject.value.rules.measures = modelRules.measures
      }
    } else {
      // 新增标签状态 -- 初始模型规则
      setTimeout(() => {
        basicRulesRef.value?.circleAddEvent()
      }, 500)
    }
  })
})

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
