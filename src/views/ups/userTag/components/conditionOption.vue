<script setup lang="ts">
/**
 * 过滤条件的「值」区域（对应 v2 src/views/ups/userTag/components/conditionOption.vue）。
 * 被 basicpointer / firstLastFeature / eventPreference / behavioralDistribResult 四个 basicRules 复用。
 *
 * 就地改 props.condition 是 v2 的固有数据流，原样保留（eslint vue/no-mutating-props 为 warn）。
 *
 * element-plus 适配：
 *   value-format="yyyy-MM-dd HH:mm:ss" → "YYYY-MM-DD HH:mm:ss"（dayjs 占位符）
 *   :picker-options                    → :shortcuts
 *   align="right"                      → element-plus 没有这个属性，去掉
 *
 * 注：v2 还 import 了 dayScope，但用到它的那段模板整体被注释掉了，这里不再引入。
 */
import { dateTimeList, relativeTime } from '@/utils/modelOptions/custom'
import { conditionDayShortcuts } from '../local-utils'
import type { ConditionItem } from '../types'

defineProps<{
  condition: ConditionItem
}>()

function timeLimitFunc(event: string | number, condition: ConditionItem, index: number) {
  if (Number(event) > 23) {
    condition.params[index] = 23
  }
}
</script>

<template>
  <div class="container">
    <div v-if="condition.function == 'between'" style="display: flex">
      <el-input
        v-model="condition.params[0]"
        type="number"
        style="margin-left: 15px"
        placeholder="请输入内容"
      ></el-input>
      <span style="margin: 0 15px; font-size: 13px; color: #606266; line-height: 30px">与</span>
      <el-input v-model="condition.params[1]" type="number" placeholder="请输入内容"></el-input>
      <div style="margin: 0 15px; font-size: 13px; color: #606266; line-height: 30px; width: 70px">
        之间
      </div>
    </div>
    <div v-if="condition.function == 'queal' || condition.function == 'notQueal'">
      <el-input
        v-model="condition.params[0]"
        style="padding: 0 15px; width: 350px"
        placeholder="请输入内容"
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
        style="width: 100px"
        placeholder=""
        @change="timeLimitFunc($event, condition, 0)"
      ></el-input>
      <span class="tipSpan">:00到</span>
      <el-input
        v-model="condition.params[1]"
        type="number"
        :min="1"
        style="width: 100px"
        placeholder=""
        @change="timeLimitFunc($event, condition, 1)"
      ></el-input>
      <span class="tipSpan">:59之间</span>
    </div>
    <div v-if="condition.function == 'relative_within'" class="conditonItem">
      <span class="tipSpan" style="margin-left: 0">在</span>
      <!-- v2 这里还有一段「天 + 之内/之前(dayScope)」的写法被注释掉了，保持注释状态 -->
      <el-input
        v-model="condition.params[0]"
        type="number"
        :min="1"
        style="width: 100px"
        placeholder=""
      ></el-input>

      <el-select
        v-model="condition.params[1]"
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
        style="width: 100px"
        placeholder=""
      ></el-input>
      <span class="tipSpan">天到过去</span>
      <el-input
        v-model="condition.params[1]"
        type="number"
        :min="1"
        style="width: 100px"
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
      <el-select v-model="condition.params[0]" placeholder="" style="width: 100px">
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
          style="width: 100px; margin-left: 15px"
          placeholder=""
        ></el-input>
        <el-select
          v-model="condition.params[2]"
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
