<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { Refresh, RefreshRight, Search } from '@element-plus/icons-vue'

/**
 * 书签列表页的筛选条（v2 src/views/analysis-modules/bookMark/components/filterBar.vue）。
 * v2 里还有一个只声明、无任何使用方的 projectName computed，迁移时删除。
 */
const emit = defineEmits<{
  setFilterBarParams: [val: Record<string, unknown>]
}>()

const loadingApi = ref(false)
const commonData = ref<Record<string, unknown> | ''>('')
const searchWord = ref('')
const catetory = ref('')
const name = ref('')
const booktypeList = [
  { value: '', label: '全部' },
  { value: '事件分析', label: '事件分析' },
  { value: '漏斗分析', label: '漏斗分析' },
]

const defaultParams = computed(() => ({
  catetory: catetory.value,
  name: name.value,
}))

const commonParams = computed<Record<string, unknown>>(() => {
  let obj: Record<string, unknown> = {}
  obj = Object.assign(obj, defaultParams.value)
  return obj
})

function setTopFilterParams(val: Record<string, unknown>) {
  emit('setFilterBarParams', val)
}

function resetApiList() {
  searchWord.value = ''
  catetory.value = ''
  name.value = ''
}

function refreshApiList() {
  // v2 这里注释掉了 this.loadingApi = true
  if (name.value != searchWord.value) {
    name.value = searchWord.value
    loadingApi.value = false
    return
  }
  if (!commonData.value) {
    commonData.value = commonParams.value
  }
  setTopFilterParams(commonData.value)
  loadingApi.value = false
}

function searchEvent() {
  name.value = searchWord.value
}

watch(commonParams, (newVal, oldVal) => {
  if (JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
    commonData.value = newVal
    void nextTick(() => {
      setTopFilterParams(newVal)
    })
  }
})

onMounted(() => {
  setTopFilterParams(commonParams.value)
})
</script>

<template>
  <div>
    <div class="documentation-container">
      <div class="headerFilter">
        <!-- 第一行 -->
        <div class="tabBar">
          <div style="display: flex">
            <div class="warry_select filterbar-tab-right">
              <div class="title">书签类型:</div>
              <el-select
                v-model="catetory"
                class="single_select"
                placeholder="请选择状态"
                style="width: 150px"
              >
                <el-option
                  v-for="item in booktypeList"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </div>
            <el-input
              v-model="searchWord"
              class="custom_input filterbar-tab-right"
              style="width: 250px; border-radius: 4px; height: 30px"
              placeholder="请输入书签名称"
              clearable
              @keyup.enter="searchEvent()"
            >
              <template #prefix>
                <el-icon class="el-input__icon" style="cursor: pointer" @click="searchEvent">
                  <Search />
                </el-icon>
              </template>
            </el-input>
            <div class="tabBarBtn">
              <!-- v2 还写了 element-loading-spinner="el-icon-loading"，element-plus 的
                   loading 指令不再认这种字符串图标类名，去掉后走默认转圈 -->
              <el-button
                v-loading="loadingApi"
                class="zc_btn refresh"
                element-loading-background="#fff"
                @click="refreshApiList"
              >
                <el-icon><RefreshRight /></el-icon>刷新
              </el-button>
              <el-button class="zc_btn_default reset" @click="resetApiList">
                <el-icon><Refresh /></el-icon>重置
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
// v2 这里还 @import 了 TopFilter.scss 与 custom-radio.scss：
// 前者的 .TopFilter 本组件并未使用；后者已在 v3 src/styles/index.scss 全局引入，
// 且 sass 不允许 @use 出现在嵌套块内（会整页编译失败），这里都不再重复引入。
:deep() {
  // v2 是 .el-radio-button--mini，element-plus 的 mini 档已并入 small
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
  // v2 里这条在全局 index.scss（.tabBarBtn .el-loading-spinner），v3 全局还没有，
  // 先落在组件内（与 v3 sys-manage/component/filterBar.vue 的处理一致）
  .el-loading-spinner {
    margin-top: -6px;
  }

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
  min-height: 60px;
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
    min-height: 60px;
    position: fixed;
    z-index: 999;
    background: #fff;
    display: flex;
    flex-direction: column;
    flex-wrap: nowrap !important;
    justify-content: center;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 15px 20px;
    width: 100%;
  }

  .check_item {
    background-color: #ffffff;
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
    border: 1px solid #dde8f4;
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
