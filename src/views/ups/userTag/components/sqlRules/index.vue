<script setup lang="ts">
/**
 * SQL 计算结果（对应 v2 src/views/ups/userTag/components/sqlRules/index.vue）。
 *
 * 与 v2 一致：这里只持有一个空的 modelObject（rules.measures = []），
 * basicRules 目前还是占位实现，两者之间没有任何数据往来。
 * tag-creator 会通过 ref 读 `modelObject`（Object.assign 到保存参数里），所以必须 defineExpose。
 */
import { ref } from 'vue'
import basicRules from './basicRules.vue'
import type { MeasureItem } from '../../types'

const modelObject = ref<{ rules: { measures: MeasureItem[] } }>({
  rules: {
    measures: [],
  },
})

defineExpose({ modelObject })
</script>

<template>
  <div class="condition_rules">
    <el-row class="zc_userMannage">
      <div class="singItem">
        <div class="type_event">
          <div class="public-threeHead createTitle">创建规则:</div>
          <basicRules></basicRules>
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
