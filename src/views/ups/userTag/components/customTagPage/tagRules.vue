<script setup lang="ts">
/**
 * 单层规则的三块内容：用户属性满足 / 用户行为满足 / 行为序列
 * （对应 v2 src/views/ups/userTag/components/customTagPage/tagRules.vue）。
 *
 * modelObject 是「一层」对象（含 relation 和 rules），三个子组件拿到的都是 modelObject.rules，
 * 各自就地 mutate —— 与 v2 完全一致。
 *
 * v2 里 attributeRules / behaviorRules / sequenceRules 上都挂了 ref，但没有任何调用点；
 * fieldTypeList 是个空数组，saveEvent() 方法体只剩注释。这些死代码不再搬运。
 */
import attributeRules from './typeRules/attributeRules.vue'
import behaviorRules from './typeRules/behaviorRules.vue'
import sequenceRules from './typeRules/sequenceRules.vue'
import type { CascaderOption } from '@/utils/modelOptions/up-manage'
import type {
  PointTypeList,
  PropertyListMap,
  PropertyNode,
  RadioOption,
  TagRuleLayer,
} from '../../types'

withDefaults(
  defineProps<{
    modelObject: TagRuleLayer
    // (事件 / 用户)  全局
    pointProtoList?: PropertyNode[]
    cascaderList?: CascaderOption[]
    pointTypeList?: PointTypeList
    // 公共 (事件 / 用户) 局部
    propertyList?: Partial<PropertyListMap>
  }>(),
  {
    pointProtoList: () => [],
    cascaderList: () => [],
    pointTypeList: () => ({ userProtoList: [], eventProtoList: [] }),
    propertyList: () => ({
      commonPropertySum: [], // 共用事件属性
      userProperties: [], // 共用用户属性
    }),
  },
)

/** 与 v2 一致：fieldTypeList 传给 attributeRules 但始终是空数组 */
const fieldTypeList: RadioOption[] = []
</script>

<template>
  <div class="condition_rules">
    <el-row class="zc_userMannage">
      <!-- 一级且或条件 -->
      <div class="andOrNot">
        <div class="btn_line"></div>
        <el-radio-group v-model="modelObject.relation" size="small" class="custom_btn">
          <el-radio-button value="and">且</el-radio-button>
          <el-radio-button value="or">或</el-radio-button>
        </el-radio-group>
        <div class="btn_line"></div>
      </div>
      <!-- 满足条件类型 -->
      <div class="singItem">
        <div class="type_event">
          <div class="public-threeHead">用户属性满足</div>
          <attributeRules
            style="height: auto"
            :point-proto-list="pointProtoList"
            :field-type-list="fieldTypeList"
            :model-object="modelObject.rules"
            :property-list="propertyList"
          ></attributeRules>
        </div>
        <div class="type_event">
          <div class="public-threeHead">用户行为满足</div>
          <behaviorRules
            :point-proto-list="pointProtoList"
            :model-object="modelObject.rules"
            :cascader-list="cascaderList"
            :property-list="propertyList"
            :point-type-list="pointTypeList"
          ></behaviorRules>
        </div>
        <div class="type_event">
          <div class="public-threeHead">行为序列</div>
          <!-- :sequenceObj="modelObject.rules.sequence." -->
          <sequenceRules
            :sequence-obj="modelObject.rules"
            :cascader-list="cascaderList"
            :point-proto-list="pointProtoList"
            :property-list="propertyList"
          ></sequenceRules>
          <!-- :pointTypeList="pointTypeList" -->
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

.condition_rules {
  width: 60%;
  // margin: 30px 0 20px;
  min-height: 180px;
  border-radius: 6px;

  .zc_userMannage {
    display: flex;

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

    // 满足模块条件
    .singItem {
      margin-left: 30px;

      .type_event {
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
