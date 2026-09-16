<template>
  <div class="container">
    <div v-if="condition.function == 'between'" style="display: flex">
      <el-input
        v-model="p0"
        type="number"
        style="margin-left: 15px"
        placeholder="请输入内容"
      />
      <span
        style="margin: 0 15px; font-size: 13px; color: #606266; line-height: 30px"
        >与</span
      >
      <el-input v-model="p1" type="number" placeholder="请输入内容" />
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
      <el-input v-model="p0" style="padding: 0 15px; width: 350px" placeholder="请输入内容" />
    </div>

    <!-- 时间条件  -->
    <div v-if="condition.function == 'absolute_between'" class="conditonItem">
      <!-- 绝对时间 -->
      <span class="tipSpan" style="margin-left: 0">在</span>
      <el-date-picker
        v-model="p0"
        type="datetime"
        placeholder="选择日期时间"
        value-format="YYYY-MM-DD HH:mm:ss"
        style="line-height: 30px; width: 180px"
        :shortcuts="dateShortcuts"
      />
      <span class="tipSpan">到</span>
      <el-date-picker
        v-model="p1"
        value-format="YYYY-MM-DD HH:mm:ss"
        type="datetime"
        placeholder="选择日期时间"
        style="line-height: 30px; width: 180px"
        :shortcuts="dateShortcuts"
      />
      <span class="tipSpan">之间</span>
    </div>
    <div v-if="condition.function == 'extract_between'" class="conditonItem">
      <span class="tipSpan" style="margin-left: 0">在</span>
      <el-input
        v-model="p0"
        type="number"
        :min="1"
        style="width: 100px"
        placeholder=""
        @change="timeLimitFunc($event, 0)"
      />
      <span class="tipSpan">:00到</span>
      <el-input
        v-model="p1"
        type="number"
        :min="1"
        style="width: 100px"
        placeholder=""
        @change="timeLimitFunc($event, 1)"
      />
      <span class="tipSpan">:59之间</span>
    </div>
    <div v-if="condition.function == 'relative_within'" class="conditonItem">
      <span class="tipSpan" style="margin-left: 0">在</span>
      <!-- 与 v2 一致：v2 此处注释掉了一段「天 + dayScope」的写法，现用的是下面这段 -->
      <el-input v-model="p0" type="number" :min="1" style="width: 100px" placeholder="" />

      <el-select v-model="p1" placeholder="" style="width: 100px; margin-left: 15px">
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
      <el-input v-model="p0" type="number" :min="1" style="width: 100px" placeholder="" />
      <span class="tipSpan">天到过去</span>
      <el-input v-model="p1" type="number" :min="1" style="width: 100px" placeholder="" />
      <span class="tipSpan">天之内</span>
    </div>
    <div
      v-if="condition.function == 'relative_event_time'"
      class="conditonItem"
      style="display: flex"
    >
      <!-- 相对时间发生时间 -->
      <span class="tipSpan" style="margin-left: 0px">在</span>
      <el-select v-model="p0" placeholder="请选择" style="width: 100px">
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
          v-model="p1"
          type="number"
          :min="1"
          style="width: 100px; margin-left: 15px"
          placeholder=""
        />
        <el-select v-model="p2" placeholder="请选择" style="width: 100px; margin-left: 15px">
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

<script setup lang="ts">
import { computed } from 'vue'
import { dateTimeList, relativeTime } from '@/utils/modelOptions/custom'
import type { ConditionItem } from '../types'

/**
 * 区间 / 正则 / 时间类条件的取值控件。
 * 与 v2 一致：直接就地修改父级传进来的 condition.params（v2 用的是 props: ["condition"] + $set）。
 * v2 里 dayScope 只用在被注释掉的那段模板里，这里同样不引入。
 */
const props = defineProps<{ condition: ConditionItem }>()

/**
 * params 按下标读写。项目开了 noUncheckedIndexedAccess，模板里直接 v-model="condition.params[0]"
 * 拿到的是 string | number | undefined，接不进 el-input，所以统一走 computed 的 get/set，
 * 读写的仍然是同一个 params 数组，行为与 v2 一致。
 */
function paramAt(index: number) {
  return computed<string | number>({
    get: () => props.condition.params[index] ?? '',
    set: (val) => {
      props.condition.params[index] = val
    },
  })
}

const p0 = paramAt(0)
const p1 = paramAt(1)
const p2 = paramAt(2)

/** v2 的 pickerOptions.shortcuts，onClick(picker){picker.$emit('pick', date)} → value: () => date */
const dateShortcuts = [
  {
    text: '今天',
    value: () => new Date(),
  },
  {
    text: '昨天',
    value: () => {
      const date = new Date()
      date.setTime(date.getTime() - 3600 * 1000 * 24)
      return date
    },
  },
  {
    text: '一周前',
    value: () => {
      const date = new Date()
      date.setTime(date.getTime() - 3600 * 1000 * 24 * 7)
      return date
    },
  },
]

/** 时段区间的小时上限，与 v2 一致：大于 23 就钉到 23（v2 用的是 this.$set(condition.params, index, 23)） */
function timeLimitFunc(event: string | number, index: number) {
  if (Number(event) > 23) {
    props.condition.params[index] = 23
  }
}
</script>

<style lang="scss" scoped>
:deep(.el-input__inner::placeholder) {
  font-size: 11px;
}

.container {
  .conditonItem {
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
