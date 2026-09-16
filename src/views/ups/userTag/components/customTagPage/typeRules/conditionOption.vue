<script setup lang="ts">
/**
 * 自定义标签值里过滤条件的「值」区域
 * （对应 v2 src/views/ups/userTag/components/customTagPage/typeRules/conditionOption.vue）。
 *
 * 与 components/conditionOption.vue 的区别：多了一层 modelObject（= 当前分层的 rules），
 * 用来在点过保存后给空值标红（computedStyle）。
 *
 * element-plus 适配：
 *   value-format="yyyy-MM-dd HH:mm:ss" → "YYYY-MM-DD HH:mm:ss"（dayjs 占位符）
 *   :picker-options                    → :shortcuts
 *   align="right"                      → element-plus 没有这个属性，去掉
 *
 * 注：v2 还 import 了 dayScope，但模板里没有用到它的分支。
 */
import { dateTimeList, relativeTime } from '@/utils/modelOptions/custom'
import { computedStyle as computedStyleFn, conditionDayShortcuts } from '../../../local-utils'
import type { ConditionItem, ValidHolder } from '../../../types'

const props = withDefaults(
  defineProps<{
    modelObject?: ValidHolder
    condition: ConditionItem
  }>(),
  {
    modelObject: () => ({}),
  },
)

// 设置校验样式
function computedStyle(value: unknown) {
  return computedStyleFn(value, props.modelObject)
}

function timeLimitFunc(event: string | number, second_item: ConditionItem, index: number) {
  if (Number(event) > 23) {
    second_item.params[index] = 23
  }
}
</script>

<template>
  <div class="container">
    <div v-if="condition.function == 'between'" style="display: flex">
      <el-input
        v-model="condition.params[0]"
        type="number"
        class="input_number_width"
        style="margin-left: 15px"
        placeholder=""
        :style="computedStyle(condition.params[0])"
      ></el-input>
      <span style="margin: 0 15px; font-size: 13px; color: #606266; line-height: 30px">与</span>
      <el-input
        v-model="condition.params[1]"
        type="number"
        class="input_number_width"
        :style="computedStyle(condition.params[1])"
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
    <div v-if="condition.function == 'queal' || condition.function == 'notQueal'">
      <el-input
        v-model="condition.params[0]"
        style="padding: 0 15px; width: 350px"
        :style="computedStyle(condition.params[0])"
      ></el-input>
    </div>

    <!-- 时间条件  -->
    <div v-if="condition.function == 'absolute_between'" class="conditonItem">
      <!-- 绝对时间 -->
      <span class="tipSpan" style="margin-left: 0">在</span>
      <el-date-picker
        v-model="condition.params[0]"
        type="datetime"
        placeholder="选择日期时间"
        value-format="YYYY-MM-DD HH:mm:ss"
        style="line-height: 30px; width: 180px"
        :shortcuts="conditionDayShortcuts"
        :style="computedStyle(condition.params[0])"
      >
      </el-date-picker>
      <span class="tipSpan">到</span>
      <el-date-picker
        v-model="condition.params[1]"
        value-format="YYYY-MM-DD HH:mm:ss"
        type="datetime"
        placeholder="选择日期时间"
        style="line-height: 30px; width: 180px"
        :shortcuts="conditionDayShortcuts"
        :style="computedStyle(condition.params[1])"
      >
      </el-date-picker>
      <span class="tipSpan">之间</span>
    </div>
    <div v-if="condition.function == 'extract_between'" class="conditonItem">
      <span class="tipSpan" style="margin-left: 0">在</span>
      <el-input
        v-model="condition.params[0]"
        type="number"
        :min="1"
        class="input_number_width"
        placeholder=""
        :style="computedStyle(condition.params[0])"
        @change="timeLimitFunc($event, condition, 0)"
      ></el-input>
      <span class="tipSpan">:00到</span>
      <el-input
        v-model="condition.params[1]"
        type="number"
        :min="1"
        class="input_number_width"
        :style="computedStyle(condition.params[1])"
        @change="timeLimitFunc($event, condition, 1)"
      ></el-input>
      <span class="tipSpan">:59之间</span>
    </div>
    <div v-if="condition.function == 'relative_within'" class="conditonItem">
      <span class="tipSpan" style="margin-left: 0">在</span>

      <el-input
        v-model="condition.params[0]"
        type="number"
        :min="1"
        class="input_number_width"
        :style="computedStyle(condition.params[0])"
        placeholder=""
      ></el-input>

      <el-select
        v-model="condition.params[1]"
        :style="computedStyle(condition.params[1])"
        placeholder=""
        style="width: 100px; margin-left: 15px"
      >
        <el-option v-for="x in dateTimeList" :key="x.name" :label="x.displayName" :value="x.name">
          <div>
            {{ x.displayName }}
          </div>
        </el-option>
      </el-select>
      <span class="tipSpan">之内</span>
    </div>
    <div v-if="condition.function == 'relative_between'" class="conditonItem">
      <span class="tipSpan" style="margin-left: 0">在过去</span>
      <el-input
        v-model="condition.params[0]"
        type="number"
        :min="1"
        class="input_number_width"
        :style="computedStyle(condition.params[0])"
        placeholder=""
      ></el-input>
      <span class="tipSpan">天到过去</span>
      <el-input
        v-model="condition.params[1]"
        type="number"
        :min="1"
        class="input_number_width"
        :style="computedStyle(condition.params[1])"
        placeholder=""
      ></el-input>
      <span class="tipSpan">天之内</span>
    </div>
    <div
      v-if="condition.function == 'relative_event_time'"
      class="conditonItem"
      style="display: flex"
    >
      <!-- 相对时间发生时间 -->
      <span class="tipSpan" style="margin-left: 0px">在</span>
      <el-select
        v-model="condition.params[0]"
        placeholder=""
        style="width: 100px"
        :style="computedStyle(condition.params[0])"
      >
        <el-option v-for="x in relativeTime" :key="x.name" :label="x.displayName" :value="x.name">
          <div>
            {{ x.displayName }}
          </div>
        </el-option>
      </el-select>
      <div
        v-if="condition.params[0] == 'afterDay' || condition.params[0] == 'beforeDay'"
        style="display: flex"
      >
        <el-input
          v-model="condition.params[1]"
          type="number"
          :min="1"
          class="input_number_width"
          style="margin-left: 15px"
          :style="computedStyle(condition.params[1])"
          placeholder=""
        ></el-input>
        <el-select
          v-model="condition.params[2]"
          :style="computedStyle(condition.params[2])"
          placeholder=""
          style="width: 100px; margin-left: 15px"
        >
          <el-option v-for="x in dateTimeList" :key="x.name" :label="x.displayName" :value="x.name">
            <div>
              {{ x.displayName }}
            </div>
          </el-option>
        </el-select>
        <span class="tipSpan">之内</span>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.el-input__inner::placeholder) {
  font-size: 11px;
}

.container {
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
</style>
