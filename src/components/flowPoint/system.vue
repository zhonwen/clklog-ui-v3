<script setup lang="ts">
/**
 * 公用流量指标勾选器 —— 操作系统分析专用版本（对应 v2 src/components/flowPoint/system.vue）。
 *
 * 与同目录 index.vue 的差别（都保持 v2 原样）：
 * 1. 没有 byNoQuality prop，「流量质量指标」区块常驻；
 * 2. 不监听 bus，也没有 publicEventDown 导出逻辑；
 * 3. clearArray 的默认值是 ['pv','uv','ipCount']（index.vue 多一个 'searchCount'）。
 *
 * v2 里这个文件 import 了一堆 export*Api 和 percentage 却从未使用，v3 已删掉这些死导入。
 * v2 的 beforeDestroy 里还有一句 `$bus.$off(["publicEventDown"])`——本组件从没注册过该事件，
 * 那句只会误伤别的组件的监听，v3 未迁。
 */
import { onMounted, ref } from 'vue'

withDefaults(
  defineProps<{
    byChannel?: boolean
    byNewOldVisit?: boolean
    bySite?: boolean
  }>(),
  {
    byChannel: false,
    byNewOldVisit: false,
    bySite: false,
  },
)

const emit = defineEmits<{
  (e: 'flowPoint', val: string[]): void
}>()

// el-checkbox-group 的 modelValue 类型是 (string | number)[]，v-model 双向绑定必须与之一致
type CheckboxGroupValue = (string | number)[]

// 与 v2 一致：默认勾选项里带了 'searchCount'，但模板里没有对应的 checkbox，
// 它只会被原样合并进 emit 出去的数组
const channelList = ref<CheckboxGroupValue>(['pv', 'uv', 'ipCount', 'searchCount'])
const flowQuality = ref<CheckboxGroupValue>(['avgPv'])
const mergedArr = ref<string[]>([])

// 与 v2 一致（v2 此处逻辑存疑：初始值带 'searchCount'，clearArray 之后就没有了）
function clearArray() {
  channelList.value = ['pv', 'uv', 'ipCount']
  flowQuality.value = ['avgPv']
}

function initShowTable() {
  mergedArr.value = []
  // .map(String) 只为满足类型（值本来就是字符串），与 v2 的 [...channelList, ...flowQuality] 等价
  mergedArr.value = [...channelList.value, ...flowQuality.value].map(String)
  emit('flowPoint', mergedArr.value)
}

function handelChannelList() {
  initShowTable()
}

function handelFlowQuality() {
  initShowTable()
}

onMounted(() => {
  initShowTable()
})

defineExpose({ channelList, flowQuality, clearArray, initShowTable })
</script>

<template>
  <!-- 公用流量指标 -->
  <div class="flow-indicator public_indicator">
    <div class="flow-item">
      <div class="flow-title">流量基础指标</div>
      <el-checkbox-group v-model="channelList" class="checkBoxStyle" @change="handelChannelList">
        <!-- 搜索次数占比 -->
        <el-checkbox v-if="bySite" value="pv">搜索次数</el-checkbox>
        <el-checkbox v-if="bySite" value="pvRate">搜索次数占比</el-checkbox>
        <el-checkbox v-if="!bySite" value="pv">浏览量</el-checkbox>
        <el-checkbox v-if="!bySite" value="pvRate">浏览量占比</el-checkbox>
        <el-checkbox value="visitCount">访问次数</el-checkbox>
        <el-checkbox v-if="byChannel || bySite" value="visitCountRate">访问次数占比</el-checkbox>
        <el-checkbox value="uv">访客数</el-checkbox>
        <el-checkbox v-if="byChannel && !bySite" value="uvRate">访客数占比</el-checkbox>
        <el-checkbox v-if="!byNewOldVisit || bySite" value="newUv">新访客数</el-checkbox>
        <el-checkbox v-if="!byNewOldVisit && !bySite" value="newUvRate">新访客数占比</el-checkbox>
        <el-checkbox v-if="byNewOldVisit" value="uvRate">访客数占比</el-checkbox>
        <el-checkbox value="ipCount">IP数</el-checkbox>
        <el-checkbox v-if="byChannel || bySite" value="ipCountRate" style="margin-right: 0">
          IP数占比
        </el-checkbox>
      </el-checkbox-group>
    </div>
    <div class="flow-item setSpace">
      <div class="flow-title">流量质量指标</div>
      <el-checkbox-group v-model="flowQuality" class="checkBoxStyle" @change="handelFlowQuality">
        <el-checkbox value="bounceRate">跳出率</el-checkbox>
        <el-checkbox value="avgVisitTime">平均访问时长</el-checkbox>
        <el-checkbox v-if="byChannel" value="visitTimeRate">平均访问时长占比</el-checkbox>
        <el-checkbox value="avgPv">平均访问页数</el-checkbox>
        <!-- <el-checkbox v-if="byChannel" value="avgPvRate">平均访问页数占比</el-checkbox> -->
      </el-checkbox-group>
    </div>
  </div>
</template>

<style lang="scss" scoped>
// 来源：v2 src/styles/components/el-checkbox.scss（v2 是在 ::v-deep {} 里 @import 的，
// v3 的 @use 不能出现在嵌套块内，这里用已改写成 :deep() 的同名文件）
@use '@/styles/components/el-checkbox.scss';

// 与 v2 一致：这一段在 v2 里也是包在 .chartsIcon 下的，
// .chartsIcon 来自**父组件**模板（operaSystem.vue 外层就是 .chartsIcon），
// scoped 后编译成 `.chartsIcon .flow-indicator[data-v-x]`，仍然能命中本组件根节点。
.chartsIcon {
  box-sizing: border-box;
  margin: 20px;
  padding-top: 1px;
  min-height: 461px;
  background: #fff;
  border-radius: 6px;
  padding: 22px;

  .flow-indicator {
    margin-top: 10px;
    min-height: 58px;
    border: 1px solid #f0f0f5;
    border-radius: 6px;
    box-sizing: border-box;

    .setSpace {
      margin-bottom: 12px;
    }

    .flow-item {
      display: flex;
      margin-top: 12px;
      margin-left: 10px;

      .flow-title {
        white-space: nowrap;
        margin-right: 21px;
        font-size: 13px;
        font-weight: 400;
        line-height: 32px;
        color: #4d4d4d;
      }
    }

    .check_item {
      background-color: #ffffff;
      margin-left: 20px;
      height: 40px;
      border-radius: 4px;
      border: 1px solid #eee;
      display: flex;
      align-items: center;

      span {
        font-size: 14px;
        padding: 0 10px;
      }

      .checkBoxStyle {
        padding-right: 10px;
      }
    }
  }
}
</style>
