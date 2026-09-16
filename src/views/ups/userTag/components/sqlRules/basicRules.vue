<script setup lang="ts">
/**
 * SQL 计算结果的规则编辑器
 * （对应 v2 src/views/ups/userTag/components/sqlRules/basicRules.vue）。
 *
 * 与 v2 一致：这一块在 v2 里还是个占位实现 —— el-tree 里是「一级 1 / 二级 1-1」这种
 * 演示数据，handleNodeClick 只打了个 console.log，sqlType 也没有回传给任何模型。
 * 只有 window.globalConfig.otherRules 为真时才可能进到这个创建方式（默认配置里没有这个字段）。
 * 原样搬运，不做补全。
 *
 * element-plus 适配：`el-radio` 的 `label` 作值 → `value`。
 */
import { ref } from 'vue'

interface DemoTreeNode {
  label: string
  children?: DemoTreeNode[]
}

const sqlType = ref('BOOLEAN')
const data: DemoTreeNode[] = [
  {
    label: '一级 1',
    children: [
      {
        label: '二级 1-1',
        children: [
          {
            label: '三级 1-1-1',
          },
        ],
      },
    ],
  },
  {
    label: '一级 2',
    children: [
      {
        label: '二级 2-1',
        children: [
          {
            label: '三级 2-1-1',
          },
        ],
      },
      {
        label: '二级 2-2',
        children: [
          {
            label: '三级 2-2-1',
          },
        ],
      },
    ],
  },
  {
    label: '一级 3',
    children: [
      {
        label: '二级 3-1',
        children: [
          {
            label: '三级 3-1-1',
          },
        ],
      },
      {
        label: '二级 3-2',
        children: [
          {
            label: '三级 3-2-1',
          },
        ],
      },
    ],
  },
]
const defaultProps = {
  children: 'children',
  label: 'label',
}

function handleNodeClick(node: DemoTreeNode) {
  console.log(node)
}
</script>

<template>
  <div class="box-card">
    <div class="public-threeHead">标签数据类型</div>
    <div class="typeItems">
      <el-radio v-model="sqlType" value="STRING">字符串</el-radio>
      <el-radio v-model="sqlType" value="BOOLEAN">布尔</el-radio>
      <el-radio v-model="sqlType" value="NUMBER">数值</el-radio>
      <el-radio v-model="sqlType" value="DATETIME">时间</el-radio>
      <el-radio v-model="sqlType" value="ALL">集合</el-radio>
    </div>
    <div class="public-threeHead" style="font-size: 12px; color: rgb(175 175 175)">
      SQL 语句中第三列返回值需是字符串类型
    </div>
    <div class="public-threeHead" style="margin: 15px 0">SQL 规则</div>
    <el-tree :data="data" :props="defaultProps" @node-click="handleNodeClick"></el-tree>
  </div>
</template>

<style lang="scss" scoped>
.box-card {
  border: 1px solid #ede9e9;
  border-radius: 6px;
  padding: 15px;
  margin: 15px 0px;
  width: 100%;

  .public-threeHead {
    line-height: 20px;
  }

  .el-radio__label {
    font-size: 13px;
  }

  .typeItems {
    margin: 10px 0;
  }
}
</style>
