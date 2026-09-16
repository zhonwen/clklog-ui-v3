<script setup lang="ts">
import { computed, ref } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'

/**
 * 元数据模块的「分析条」（v2 src/views/meteData/components/analysisBar.vue）。
 *
 * 与 v2 一致（v2 此处逻辑存疑）：v2 的 options 对象里写了两个 `computed` 键，
 * 后一个（只含 device）把前一个（defaultParams / commonParams）整个覆盖掉了，
 * 于是 `watch: { commonParams }` 监听的是一个不存在的计算属性、从不触发，
 * `setFilterBarParams` 也就从未 emit 过，data 里也根本没有 startTime / endTime。
 * 迁移时按「实际生效的行为」还原：只保留 device 计算属性，不复活那段死代码
 * （若复活，本组件就会开始向父级 emit {startTime: undefined, endTime: undefined}，与 v2 表现不一致）。
 *
 * 另外本组件在 v2 的 meteData 模块里没有任何页面引用，这里同样只做等价迁移。
 */
defineProps<{
  ByEventGrop?: boolean
  ByReceive?: boolean
  ByGrop?: boolean
  ByTag?: boolean
}>()

const appStore = useAppStore()

const disabledDate = (date: Date) => {
  const today = new Date()
  return date.getTime() > today.getTime()
}

const pickerShortcuts = [
  {
    text: '近一周',
    value: () => {
      const end = new Date()
      const start = new Date()
      start.setTime(start.getTime() - 3600 * 1000 * 24 * 7)
      return [start, end]
    },
  },
  {
    text: '近一个月',
    value: () => {
      const end = new Date()
      const start = new Date()
      start.setTime(start.getTime() - 3600 * 1000 * 24 * 30)
      return [start, end]
    },
  },
  {
    text: '近三个月',
    value: () => {
      const end = new Date()
      const start = new Date()
      start.setTime(start.getTime() - 3600 * 1000 * 24 * 90)
      return [start, end]
    },
  },
  {
    text: '近六个月',
    value: () => {
      const end = new Date()
      const start = new Date()
      start.setTime(start.getTime() - 3600 * 1000 * 24 * 180)
      return [start, end]
    },
  },
  {
    text: '近一年',
    value: () => {
      const end = new Date()
      const start = new Date()
      start.setTime(start.getTime() - 3600 * 1000 * 24 * 365)
      return [start, end]
    },
  },
]

const checked = ref(false)
const contrastFlag = ref(false)
const checkLabel = ref('对比时间段')
/** 对比时间 */
const contrastValue = ref('')
// v2 里还留着一行多选写法 dateList: ["day", "week"]，生效的是单选的字符串
const dateList = ref('day')
const statuList = [
  {
    value: '',
    label: '全部',
  },
]
// 与 v2 一致（v2 此处逻辑存疑：currentTime 初值是空串 ""，daterange 的 v-model 应当是数组；
// 这里改成空数组，语义同样是「未选择」，避免类型冲突）
const currentTime = ref<string[]>([])
const status = ref('')
const eventValue = ref('')

const device = computed(() => appStore.device || 'desktop')

/** v2 里是空实现 */
function handleChange() {}

/** v2 里是空实现 */
function checkDateEvnet() {}

function checkTimeSlot(val: string | number | boolean | undefined) {
  switch (val) {
    case true:
      checkLabel.value = '对比'
      contrastValue.value = ''
      break
    case false:
      checkLabel.value = '对比时间段'
      contrastValue.value = ''
      // v2 这里还写了 this.dateFlag = null，dateFlag 既未声明也无任何读取方，迁移时省略
      break
  }
  contrastFlag.value = val === true
}
</script>

<template>
  <div>
    <div class="documentation-container">
      <div class="headerFilter">
        <!-- 第一行 -->
        <div class="tabBar">
          <div style="display: flex; align-items: center; white-space: nowrap">
            <div class="check_item public_border_color" style="height: 30">
              <span>时间:</span>
              <!-- v2 这里另有一段「多选事件对比」的 el-checkbox-group 被注释掉，保持一致不迁移 -->

              <!-- 单选事件 -->
              <el-radio-group v-model="dateList" class="checkBoxStyle" @change="handleChange">
                <el-radio value="day">今日</el-radio>
                <el-radio value="previous">昨日</el-radio>
                <el-radio value="week">过去7天</el-radio>
                <el-radio value="month">过去30天</el-radio>
                <!-- 与 v2 一致（v2 此处逻辑存疑：单选组里混进了一个没有 v-model 的 el-checkbox，
                     它不参与 dateList 的单选，点了也不会改变时间口径） -->
                <el-checkbox label="all">总计</el-checkbox>
              </el-radio-group>
            </div>
            <!-- v2 这里另有一段「自定义时间」文案被注释掉，保持一致不迁移 -->
            <el-date-picker
              v-model="currentTime"
              class="timnePickCSS"
              style="margin-left: 20px; width: 250px; height: 30px"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
              :disabled-date="disabledDate"
              :shortcuts="pickerShortcuts"
              @change="checkDateEvnet"
            />
            <div style="margin-left: 20px; line-height: 30px">
              <el-checkbox v-model="checked" @change="checkTimeSlot">
                {{ checkLabel }}
              </el-checkbox>
            </div>

            <!-- refresh -->
            <div
              :style="
                device == 'desktop'
                  ? 'position: fixed; right: 50px'
                  : 'position:relative;margin-left:50px;margin-right:30px'
              "
            >
              <el-button class="custom_button">重新加载</el-button>
            </div>
          </div>

          <!-- 第二行 -->
          <div style="display: flex; margin-left: 20px; margin-top: 12px">
            <div class="warry_select">
              <div class="title">分组:</div>
              <el-select v-model="status" class="single_select" placeholder="请选择状态">
                <el-option
                  v-for="item in statuList"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </div>
            <el-input
              v-model="eventValue"
              class="custom_input"
              style="width: 250px; border-radius: 4px; height: 30px"
              placeholder="请输入事件名称、事件标识符搜索"
              clearable
            >
              <template #prefix>
                <el-icon class="el-input__icon"><Search /></el-icon>
              </template>
            </el-input>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
// v2 这里 @import 了 TopFilter.scss 与 custom-radio.scss：
// 前者的 .TopFilter 本组件并未使用；后者已在 v3 src/styles/index.scss 全局引入，
// 且 sass 不允许 @use 出现在嵌套块内，这里都不再重复引入。
:deep() {
  .el-radio-button--small .el-radio-button__inner {
    padding: 9px 15px;
  }

  .el-checkbox__input.is-checked + .el-checkbox__label {
    color: #4d4d4d;
  }

  .el-checkbox__label {
    font-size: 13px;
  }

  // 日历样式start
  .el-range-editor--medium .el-range-input {
    font-size: 13px;
  }

  .el-date-editor .el-range__icon {
    font-size: 13px;
    line-height: 24px;
  }

  .el-range-editor--medium .el-range-separator {
    font-size: 13px;
    line-height: 24px;
  }
}

:deep() {
  .custom_input {
    .el-input__inner {
      font-size: 11px;
    }
  }

  .custom_input .el-input--medium .el-input__inner {
    width: 250px !important;
  }

  .el-button--medium {
    padding: 0 20px;
  }

  .el-input--medium .el-input__inner {
    height: 30px;
    line-height: 30px;
  }

  .el-input--medium .el-input__icon {
    line-height: 30px;
  }

  .el-input__inner {
    font-size: 13px;
  }

  .single_select .el-input__inner {
    border-radius: 0px;
    border-top-width: 0px;
    border-left-width: 0px;
    border-right-width: 0px;
    border-bottom-width: 1px;
    border-bottom: 1px solid #acb2ba;
    background-color: transparent;
    font-size: 12px;
    height: 30px;
    line-height: 30px;
    border-bottom-width: 0;
    padding-left: 10px;
    width: 100px;
  }
}

.custom_button {
  height: 30px;
  color: #fff;
  font-size: 13px;
  background-color: #2c7be5;
}

.headerFilter {
  min-height: 105px;
  color: #194580;
  font-size: 13px;
  background: #fff;
  box-sizing: border-box;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: nowrap !important;
  overflow-x: auto;

  .tabBar {
    min-height: 105px;
    position: fixed;
    z-index: 999;
    background: #fff;
    display: flex;
    flex-direction: column;
    flex-wrap: nowrap !important;
    justify-content: center;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 0 20px;
    width: 100%;
  }

  .check_item {
    background-color: #ffffff;
    margin-left: 20px;
    height: 30px;
    border-radius: 4px;
    display: flex;
    align-items: center;

    span {
      font-size: 13px;
      font-weight: 400;
      line-height: 13px;
      color: #4d4d4d;
      padding: 0 10px;
    }

    .checkBoxStyle {
      padding-right: 10px;
    }
  }

  .singleItem {
    display: flex;
    margin-right: 30px;
  }

  .setTitle {
    height: 30px;
    line-height: 30px;
  }

  .custom_select {
    width: 100px;
    margin-left: 10px;
    height: 30px;
    line-height: 30px;
  }

  .warry_select {
    display: flex;
    border: 1px solid #d5dfed;
    border-radius: 4px;
    align-items: center;
    height: 30px;
    margin-right: 20px;

    .title {
      font-size: 12px;
      color: #4d4d4d;
      padding-left: 6px;
      white-space: nowrap;
    }
  }
}
</style>
