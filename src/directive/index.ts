import type { App } from 'vue'
import { permission } from './permission'
import { loadmore } from './loadmore'
import { clipboard } from './clipboard'
import { sticky } from './sticky'
import { elDragDialog } from './el-drag-dialog'
import { elHeightAdaptiveTable } from './el-table'

export function setupDirectives(app: App) {
  app.directive('permission', permission)
  app.directive('loadmore', loadmore)
  app.directive('clipboard', clipboard)
  app.directive('Clipboard', clipboard)
  app.directive('sticky', sticky)
  app.directive('el-drag-dialog', elDragDialog)
  app.directive('el-height-adaptive-table', elHeightAdaptiveTable)
}
