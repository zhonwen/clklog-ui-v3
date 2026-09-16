<script setup lang="ts">
/**
 * 「显示设置」多选下拉（对应 v2 views/ups/usergroup/components/custom-select.vue）。
 *
 * group-detail-dialog 里 v2 已经把它的挂载点注释掉了（只留 initOptions / echartLazy 的调用痕迹），
 * 这里照样迁过来，保持可用。
 */
import { ref } from 'vue'
import type { SelectInstance } from 'element-plus'
import type { LabelValue } from '../types'

const emit = defineEmits<{ echartLazy: [value: string[]] }>()

const refElSelect = ref<SelectInstance | null>(null)

const selValue = ref<string[]>([])
const lastSelValue = ref<string[]>([])
const options = ref<LabelValue[]>([])

function initOptions(list?: string[]) {
  if (list) {
    selValue.value = []
    options.value = list.map((item, index) => {
      if (index < 3) {
        selValue.value.push(item)
      }
      return {
        label: item,
        value: item,
      }
    })
  }
}

function visibleEvent(val: boolean) {
  if (val == true) {
    lastSelValue.value = selValue.value
  } else {
    emit('echartLazy', selValue.value)
  }
}

// 鼠标滑入 自动展示下拉框（v2 的 mouseOver 调的是 element-ui 私有的 handleFocus）
function mouseOver() {
  refElSelect.value?.focus()
}

// 全选
function checkAll() {
  if (selValue.value.length < options.value.length) {
    // 全选
    selValue.value = options.value.map((x) => x.value)
  } else if (selValue.value.length === options.value.length) {
    // 全不选
    selValue.value = []
  }
}

// 关闭下拉框（v2 的 handleClose → element-plus 用 blur）
function cancel() {
  selValue.value = lastSelValue.value
  refElSelect.value?.blur()
}

// 请求数据并关闭下拉框
function determine() {
  refElSelect.value?.blur()
}

defineExpose({ initOptions, mouseOver, checkAll, cancel, determine, selValue })
</script>

<template>
  <div>
    <!-- <div @mouseover="mouseOver"> -->
    <el-select
      ref="refElSelect"
      v-model="selValue"
      placeholder="请选择"
      filterable
      multiple
      collapse-tags
      style="width: 240px"
      @visible-change="visibleEvent"
    >
      <el-option v-for="item in options" :key="item.value" :label="item.label" :value="item.value" />

      <div class="selec_footer">
        <el-button size="small" @click="checkAll">全选</el-button>
        <el-button size="small" @click="cancel">取消</el-button>
        <el-button size="small" @click="determine">确定</el-button>
      </div>
    </el-select>
  </div>
</template>

<style scoped lang="scss">
:deep() {
  .el-button--small {
    padding: 6px 11px;
    margin: 10px;

    .selec_footer {
      /* padding: 4px; */
      display: flex;
      justify-content: center;
    }
  }
}
</style>
