<script setup lang="ts">
/**
 * 标签历史详情的「显示设置」多选框（对应 v2 src/views/ups/userTag/components/custom-select.vue）。
 *
 * 父组件（tag-detail-dialog）通过 ref 调 initOptions(keys, spliceLength) 灌数据，
 * 下拉收起时 emit echartLazy 把当前选中项回给父组件重绘图表。
 *
 * element-plus 的 el-select 没有暴露 handleFocus / handleClose，
 * 对应换成实例上的 focus() / blur()（blur 会关掉下拉，行为与 v2 的 handleClose 一致）。
 */
import { ref } from 'vue'

interface SelectOption {
  label: string
  value: string
}

const emit = defineEmits<{ echartLazy: [value: string[]] }>()

const selValue = ref<string[]>([])
const lastSelValue = ref<string[]>([])
const options = ref<SelectOption[]>([])
const refElSelect = ref<{ focus: () => void; blur: () => void } | null>(null)

function initOptions(list: string[] | null | undefined, spliceLength: number) {
  if (list) {
    selValue.value = []
    options.value = list.map((item, index) => {
      if (index < spliceLength) {
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

// 鼠标滑入 自动展示下拉框
function mouseOver() {
  refElSelect.value?.focus()
}

// 全选
function checkAll() {
  if (selValue.value.length < options.value.length) {
    // 全选
    const valueList = options.value.map((x) => x.value)
    selValue.value = valueList
  } else if (selValue.value.length === options.value.length) {
    // 全不选
    selValue.value = []
  }
}

// 关闭下拉框
function cancel() {
  selValue.value = lastSelValue.value
  refElSelect.value?.blur()
}

// 请求数据并关闭下拉框
function determine() {
  refElSelect.value?.blur()
}

defineExpose({ initOptions, mouseOver })
</script>

<template>
  <div>
    <el-select
      ref="refElSelect"
      v-model="selValue"
      placeholder="请选择"
      filterable
      multiple
      collapse-tags
      style="width: 240px; height: 30px"
      @visible-change="visibleEvent"
    >
      <el-option v-for="item in options" :key="item.value" :label="item.label" :value="item.value">
      </el-option>
      <div class="selec_footer">
        <el-button size="small" @click="checkAll">全选</el-button>
        <el-button size="small" @click="cancel">取消</el-button>
        <el-button size="small" @click="determine">确定</el-button>
      </div>
    </el-select>
  </div>
</template>

<style scoped lang="scss">
// 与 v2 一致（v2 此处逻辑存疑：.selec_footer 被写在 .el-button--small 里面了，
// 而它其实是按钮的父级，所以那条 flex 规则在 v2 里也从没生效过 —— 原样保留）
:deep(.el-button--small) {
  padding: 6px 11px;
  margin: 10px;

  .selec_footer {
    /* padding: 4px; */
    display: flex;
    justify-content: center;
  }
}
</style>
