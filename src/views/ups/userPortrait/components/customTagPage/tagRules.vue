<script setup lang="ts">
/**
 * 画像人群的三类规则容器（对应 v2 `views/ups/userPortrait/components/customTagPage/tagRules.vue`）：
 * 用户属性满足 / 用户行为满足 / 行为序列。
 *
 * v2 里的 `saveEvent`（空函数）与 `projectName` computed 无任何引用，不再搬运；
 * 三个子组件上的 ref（attributeRules / behaviorRules / sequenceRules）在 v2 也从未被调用过，同样去掉。
 */
import attributeRules from './typeRules/attributeRules.vue'
import behaviorRules from './typeRules/behaviorRules.vue'
import sequenceRules from './typeRules/sequenceRules.vue'
import type { CascaderNode, EventGroup, PortraitRuleItem, PropertyListMap } from '../../types'

withDefaults(
  defineProps<{
    modelObject: PortraitRuleItem
    /** (事件 / 用户)  全局 */
    pointProtoList?: EventGroup[]
    cascaderList?: CascaderNode[]
    propertyList?: Partial<PropertyListMap>
  }>(),
  {
    pointProtoList: () => [],
    cascaderList: () => [],
    propertyList: () => ({
      commonPropertySum: [], // 共用事件属性
      userProperties: [], // 共用用户属性
      userGroupList: [], // 用户分群
      userTagList: [], // 用户标签
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

  // v2 是 .el-radio-button--small .el-radio-button__inner，element-plus 不再生成 --small 尺寸类，
  // 直接落到 __inner 上，数值不变
  .el-radio-button__inner {
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
