<script setup lang="ts">
/**
 * 区间 / 正则 / 时间类条件的输入区（对应 v2
 * views/ups/usergroup/components/customTagPage/typeRules/conditionOption.vue）。
 * 行为规则与序列卡片共用，属性规则里是同一段模板的内联副本（v2 就是这么写的，保持原样）。
 */
import { computed } from 'vue'
import type { CSSProperties } from 'vue'
import { dateTimeList, relativeTime } from '../../../constants'
import { computedStyle as computedStyleFn, dateTimeShortcuts } from '../../../utils'
import type { ConditionItem, RuleSet } from '../../../types'

const props = withDefaults(
  defineProps<{
    modelObject?: RuleSet | null
    condition: ConditionItem
  }>(),
  {
    modelObject: null,
  },
)

const shortcuts = dateTimeShortcuts

/**
 * params 按下标读写。项目开了 noUncheckedIndexedAccess，模板里直接 v-model="p0"
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

function computedStyle(value: unknown): CSSProperties | undefined {
  return computedStyleFn(value, props.modelObject)
}

function timeLimitFunc(event: string | number, second_item: ConditionItem, index: number) {
  if (Number(event) > 23) {
    second_item.params[index] = 23
  }
}

/** 模板里避免重复调用同一函数：params 的每个下标各算一次校验样式 */
const style0 = computed(() => computedStyle(props.condition.params[0]))
const style1 = computed(() => computedStyle(props.condition.params[1]))
const style2 = computed(() => computedStyle(props.condition.params[2]))
</script>

<template>
  <div class="container">
    <div v-if="condition.function == 'between'" style="display: flex">
      <el-input
        v-model="p0"
        type="number"
        style="margin-left: 15px"
        class="input_number_width"
        placeholder=""
        :style="style0"
      />
      <span style="margin: 0 15px; font-size: 13px; color: #606266; line-height: 30px">与</span>
      <el-input
        v-model="p1"
        type="number"
        class="input_number_width"
        placeholder=""
        :style="style1"
      />
      <div
        style="margin: 0 15px; font-size: 13px; color: #606266; line-height: 30px; width: 70px"
      >
        之间
      </div>
    </div>
    <div v-if="condition.function == 'queal' || condition.function == 'notQueal'">
      <el-input
        v-model="p0"
        style="padding: 0 15px; width: 350px"
        placeholder="请输入内容"
        :style="style0"
      />
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
        :shortcuts="shortcuts"
        :style="style0"
      />
      <span class="tipSpan">到</span>
      <el-date-picker
        v-model="p1"
        value-format="YYYY-MM-DD HH:mm:ss"
        type="datetime"
        placeholder="选择日期时间"
        style="line-height: 30px; width: 180px"
        :shortcuts="shortcuts"
        :style="style1"
      />
      <span class="tipSpan">之间</span>
    </div>
    <div v-if="condition.function == 'extract_between'" class="conditonItem">
      <span class="tipSpan" style="margin-left: 0">在</span>
      <el-input
        v-model="p0"
        type="number"
        :min="1"
        class="input_number_width"
        placeholder=""
        :style="style0"
        @change="timeLimitFunc($event, condition, 0)"
      />
      <span class="tipSpan">:00到</span>
      <el-input
        v-model="p1"
        type="number"
        :min="1"
        class="input_number_width"
        :style="style1"
        @change="timeLimitFunc($event, condition, 1)"
      />
      <span class="tipSpan">:59之间</span>
    </div>
    <div v-if="condition.function == 'relative_within'" class="conditonItem">
      <span class="tipSpan" style="margin-left: 0">在</span>

      <el-input
        v-model="p0"
        type="number"
        :min="1"
        class="input_number_width"
        :style="style0"
        placeholder=""
      />

      <el-select
        v-model="p1"
        :style="style1"
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
        v-model="p0"
        type="number"
        :min="1"
        style="width: 100px"
        :style="style0"
        placeholder=""
      />
      <span class="tipSpan">天到过去</span>
      <el-input
        v-model="p1"
        type="number"
        :min="1"
        class="input_number_width"
        :style="style1"
        placeholder=""
      />
      <span class="tipSpan">天之内</span>
    </div>
    <div
      v-if="condition.function == 'relative_event_time'"
      class="conditonItem"
      style="display: flex"
    >
      <!-- 相对时间发生时间 -->
      <span class="tipSpan" style="margin-left: 0px">在</span>
      <el-select v-model="p0" placeholder="" style="width: 100px" :style="style0">
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
          class="input_number_width"
          style="margin-left: 15px"
          :style="style1"
          placeholder=""
        />
        <el-select
          v-model="p2"
          :style="style2"
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
:deep() {
  .el-input__inner::placeholder {
    font-size: 11px;
  }
}

// v2 是全局类（src/styles/index.scss 的 .input_number_width），v3 尚未合并，先本地定义
.input_number_width {
  width: 100px;
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
