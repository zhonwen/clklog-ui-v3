<script setup lang="ts">
import { Delete as DeleteIcon, Plus as PlusIcon } from '@element-plus/icons-vue'
import { bus } from '@/utils/event-bus'
import type { MenuTreeNodeData } from '@/api/authmanage/menu'

/**
 * el-tree 的节点内容。v2 是 Menu.vue 用 render-content + h(TreeRender, { props, on }) 挂上来的，
 * v3 改成在 Menu.vue 里用 el-tree 的 #default 插槽直接写这个组件，渲染结果与事件一致。
 * 插槽只提供 node / data，拿不到 store，因此 STORE 恒为 null
 * （v2 的 Append / Delete / WatchInfo 三个回调实际都没用到 store）。
 */

/**
 * el-tree 的 Node，这里只用到 parent / data，按需最小声明。
 * Menu.vue 里有一份结构相同的声明：`<script setup>` 不能 export 类型，两边各留一份。
 */
interface TreeNodeLike {
  data: MenuTreeNodeData | MenuTreeNodeData[]
  parent: TreeNodeLike | null
}

const props = defineProps<{
  NODE: TreeNodeLike
  DATA: MenuTreeNodeData
  STORE: unknown
}>()

const emit = defineEmits<{
  Append: [s: unknown, d: MenuTreeNodeData, n: TreeNodeLike]
  Delete: [s: unknown, d: MenuTreeNodeData, n: TreeNodeLike]
  WatchInfo: [s: unknown, d: MenuTreeNodeData, n: TreeNodeLike]
}>()

function Append(s: unknown, d: MenuTreeNodeData, n: TreeNodeLike) {
  // 添加节点事件
  emit('Append', s, d, n)
}

function Delete(s: unknown, d: MenuTreeNodeData, n: TreeNodeLike) {
  if (window.globalConfig.is_clklog_demo_environment) {
    // v2 的 $bus.$emit('$demo_event')：演示环境弹提示框，不执行真实操作
    bus.emit('$demo_event')
    return
  }
  emit('Delete', s, d, n)
  // v2 这里注释掉了一段二次确认（确认逻辑现在在 Menu.vue 的 removeMenu 里），原样保留：
  // this.$confirm("确认删除" + this.DATA.name + "吗?", "提示", {
  //   confirmButtonText: "确定",
  //   cancelButtonText: "取消",
  //   cancelButtonClass: "custom-cancel-button",
  //   type: "warning",
  // })
  //   .then(() => {
  //     // this.$emit("Delete", s, d, n);
  //   })
}

function WatchInfo(s: unknown, d: MenuTreeNodeData, n: TreeNodeLike) {
  emit('WatchInfo', s, d, n)
}

function handleWatch() {
  if (!props.DATA || props.DATA.menuId === '') return
  WatchInfo(props.STORE, props.DATA, props.NODE)
}
</script>

<template>
  <span class="tree-node-row">
    <span class="tree-node-label" :class="{ 'is-root': DATA.menuId === '' }" @click="handleWatch">
      <span>{{ DATA.menuId === '' ? '根节点' : DATA.name }}</span>
    </span>
    <span class="tree-node-actions">
      <span class="tree-node-action-slot">
        <el-button link @click="Append(STORE, DATA, NODE)">
          <el-icon><PlusIcon /></el-icon>
        </el-button>
      </span>
      <span class="tree-node-action-slot">
        <el-button v-if="DATA.menuId != ''" link @click="Delete(STORE, DATA, NODE)">
          <el-icon><DeleteIcon /></el-icon>
        </el-button>
      </span>
    </span>
  </span>
</template>

<style lang="scss" scoped>
.tree-node-row {
  flex: 1;
  display: block;
  min-width: 0;
}

.tree-node-label {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding-right: 72px;
  cursor: pointer;
}

.tree-node-label.is-root {
  cursor: default;
}

.tree-node-actions {
  position: absolute;
  right: 8px;
  top: 0;
  bottom: 0;
  display: grid;
  grid-template-columns: 20px 20px;
  align-items: center;
  column-gap: 5px;
}

.tree-node-action-slot {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tree-node-actions :deep(.el-button) {
  padding: 0;
  font-size: 12px;
  line-height: 1;
}
</style>
