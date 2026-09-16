import type { App } from 'vue'
import { loadmore } from './loadmore'
import { clipboard } from './clipboard'
import { sticky } from './sticky'
import { elDragDialog } from './el-drag-dialog'
import { elHeightAdaptiveTable } from './el-table'

export function setupDirectives(app: App) {
  // 说明：v2 的 main.js 只注册了 loadmore，v-permission 在 v2 中从未注册、页面也从未使用，
  // 且 userStore.roles 全流程没有赋值来源（权限模型是 menuList + uriRoutes），
  // 留着只会把所有带它的元素隐藏掉，因此按 v2 基准移除。
  app.directive('loadmore', loadmore)
  app.directive('clipboard', clipboard)
  app.directive('Clipboard', clipboard)
  app.directive('sticky', sticky)
  app.directive('el-drag-dialog', elDragDialog)
  app.directive('el-height-adaptive-table', elHeightAdaptiveTable)
}
