<script setup lang="ts">
/**
 * 一层分群规则（对应 v2 views/ups/usergroup/components/customTagPage/tagRules.vue）。
 * 把「用户属性满足 / 用户行为满足 / 行为序列」三块串起来，三者共用同一个 rules 对象。
 */
import attributeRules from './typeRules/attributeRules.vue'
import behaviorRules from './typeRules/behaviorRules.vue'
import sequenceRules from './typeRules/sequenceRules.vue'
import type { CascaderNode, PropertyListMap, PropertyNode, RuleListItem } from '../../types'

withDefaults(
  defineProps<{
    modelObject: RuleListItem
    // (事件 / 用户)  全局
    pointProtoList?: PropertyNode[]
    cascaderList?: CascaderNode[]
    // 公共 (事件 / 用户) 局部
    propertyList?: Partial<PropertyListMap>
  }>(),
  {
    pointProtoList: () => [],
    cascaderList: () => [],
    propertyList: () => ({
      commonPropertySum: [], // 共用事件属性
      userProperties: [], // 共用用户属性
    }),
  },
)
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
            :point-proto-list="pointProtoList"
            :model-object="modelObject.rules"
            :property-list="propertyList"
          />
        </div>
        <div class="type_event">
          <div class="public-threeHead">用户行为满足</div>
          <behaviorRules
            :point-proto-list="pointProtoList"
            :model-object="modelObject.rules"
            :cascader-list="cascaderList"
            :property-list="propertyList"
          />
        </div>
        <div class="type_event">
          <div class="public-threeHead">行为序列</div>
          <sequenceRules
            :sequence-obj="modelObject.rules"
            :cascader-list="cascaderList"
            :point-proto-list="pointProtoList"
            :property-list="propertyList"
          />
        </div>
      </div>
    </el-row>
  </div>
</template>

<style lang="scss" scoped>
:deep() {
  // el-radio 自定义样式
  .custom_btn {
    padding: 1px 0;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;

    .el-radio-button:first-child .el-radio-button__inner {
      border-left: 0px;
      font-size: 10px;
    }

    .el-radio-button__original-radio:checked + .el-radio-button__inner {
      font-size: 10px;
    }

    .el-radio-button:last-child .el-radio-button__inner {
      font-size: 10px;
    }

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

.condition_rules {
  width: 60%;
  min-height: 180px;
  border-radius: 6px;

  .zc_userMannage {
    display: flex;

    // 且或
    .andOrNot {
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
    }
  }
}
</style>
