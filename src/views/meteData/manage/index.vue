<script setup lang="ts">
import { computed, getCurrentInstance, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { TabsPaneContext } from 'element-plus'
import { Delete, Edit, Plus, View } from '@element-plus/icons-vue'
import fiterbar from '../components/fiterbar.vue'
import type { FilterOption } from '../components/fiterbar.vue'
import addEventDialog from './components/addEvent-dialog.vue'
import uploadDialog from './components/uploadDialog.vue'
import { copyObj } from '@/utils/copy'
import { isNoFilter, isNoFilterShow } from '@/utils/format'
import { makeTableCellCenterByIndex } from '@/utils/index'
import { useLatestOnly } from '@/composables/useLatestOnly'
import { useTrackingStore } from '@/stores/tracking'
import { bus } from '@/utils/event-bus'
import {
  deleteEventApi,
  getEventApi,
  getListEventApi,
  getPageListEventApi,
  setHotPropApi,
} from '@/api/sysmanage/manageEvent'
import type {
  EventPropertyRow,
  MetaEventRow,
  PropertyGroup,
} from '@/api/sysmanage/manageEvent'

const proxy = getCurrentInstance()?.proxy
const trackingStore = useTrackingStore()
const { next: nextList, isLatest: isLatestList } = useLatestOnly()
const { next: nextDetail, isLatest: isLatestDetail } = useLatestOnly()
const { next: nextProto, isLatest: isLatestProto } = useLatestOnly()

const addEventDialogRef = ref<{
  openDialog: (
    title: string,
    filerList: [FilterOption[], FilterOption[]],
    data?: MetaEventRow,
  ) => void
  protoTypeEvent: (list: PropertyGroup[]) => void
} | null>(null)
const uploadDialogRef = ref<{ openDialogEvent: () => void } | null>(null)

const loadingRefresh = ref(false)
/** 切换属性 */
const activePrototype = ref('event')
const prototypeVisible = ref(false)
const filterBarParams = ref<Record<string, unknown>>({})
const tableList = ref<MetaEventRow[]>([])
const pageNum = ref(1)
const pageSize = ref(10)
const total = ref(0)
const filerList = ref<[FilterOption[], FilterOption[]]>([[], []])
const ExtendList = ref<EventPropertyRow[]>([])
const x_pageNum = ref(1)
const x_pageSize = ref(10)
const x_total = ref(0)
const metaEventIds = ref('')
const currentMetaEventId = ref<string | null>(null)
const propTitleEvent = ref('')
const current = ref<{ sortName: string | null; sortOrder: string | null }>({
  sortName: null,
  sortOrder: null,
})
const commonPresetProperyList = ref<EventPropertyRow[]>([])
const commonProperyList = ref<EventPropertyRow[]>([])
const eventPropertyExtendList = ref<EventPropertyRow[]>([])
const prototypeKeyword = ref('')

const projectName = computed(() => trackingStore.projectName)

const commonParams = computed<Record<string, unknown>>(() => {
  return Object.assign({ projectName: projectName.value }, filterBarParams.value)
})

function filterPrototypeList(list: EventPropertyRow[]) {
  const keyword = (prototypeKeyword.value || '').trim().toLowerCase()
  if (!keyword) return list
  return (list || []).filter((item) => {
    const displayName = String(item && item.displayName ? item.displayName : '').toLowerCase()
    const name = String(item && item.name ? item.name : '').toLowerCase()
    return displayName.includes(keyword) || name.includes(keyword)
  })
}

const filteredEventList = computed(() => filterPrototypeList(eventPropertyExtendList.value || []))
const filteredPublicList = computed(() => filterPrototypeList(commonProperyList.value || []))
const filteredCommonList = computed(() => filterPrototypeList(commonPresetProperyList.value || []))
const eventTabCount = computed(() => filteredEventList.value.length)
const publicTabCount = computed(() => filteredPublicList.value.length)
const commonTabCount = computed(() => filteredCommonList.value.length)

const allTabHotDisplayNames = computed(() => {
  const allProps = [
    ...(eventPropertyExtendList.value || []),
    ...(commonProperyList.value || []),
    ...(commonPresetProperyList.value || []),
  ]
  const result: string[] = []
  const seen = new Set<string>()
  allProps.forEach((item) => {
    if (!item || item.isHot !== true) return
    const name = item.displayName
    if (!name) return
    if (seen.has(name)) return
    seen.add(name)
    result.push(name)
  })
  return result
})

/** v2 是在模板里直接 ExtendList.slice(...)，这里挪成 computed */
const pagedExtendList = computed(() =>
  ExtendList.value.slice((x_pageNum.value - 1) * x_pageSize.value, x_pageNum.value * x_pageSize.value),
)

function tableHeaderPosition(args: { columnIndex: number }) {
  return makeTableCellCenterByIndex([], [2, 3, 9, 13])(args)
}

function tableHeaderPositionTab(args: { columnIndex: number }) {
  return makeTableCellCenterByIndex([], [1, 2])(args)
}

function showText(row: EventPropertyRow) {
  row.showTextVisible = true
}

function hideText(row: EventPropertyRow) {
  row.showTextVisible = false
}

function getFilteredTabList(tabName: string) {
  switch (tabName) {
    case 'event':
      return filteredEventList.value
    case 'public':
      return filteredPublicList.value
    case 'common':
      return filteredCommonList.value
    default:
      return []
  }
}

function updateExtendList(tabName: string, resetPage = false) {
  if (resetPage) x_pageNum.value = 1
  const list = getFilteredTabList(tabName)
  ExtendList.value = list
  x_total.value = list.length
}

function handlePrototypeSearch() {
  const keyword = (prototypeKeyword.value || '').trim()
  if (!keyword) {
    updateExtendList(activePrototype.value, true)
    return
  }
  const tabOrder = ['event', 'public', 'common']
  const targetTab = tabOrder.find((tab) => getFilteredTabList(tab).length > 0) || 'event'
  activePrototype.value = targetTab
  updateExtendList(targetTab, false)
  x_pageNum.value = 1
}

function getEventData(metaEventId?: string) {
  const token = nextDetail()
  getEventApi({
    metaEventId: metaEventId,
    projectName: projectName.value,
  })
    .then((res) => {
      if (!isLatestDetail(token)) return
      if (res?.data && res.code == 200) {
        eventPropertyExtendList.value = res.data.eventPropertyExtendList || []
        commonProperyList.value = res.data.commonProperyList || []
        commonPresetProperyList.value = res.data.commonPresetProperyList || []
        handlePrototypeSearch()
      }
    })
    .catch(() => {
      if (!isLatestDetail(token)) return
      /* 报错已由请求层统一提示 */
    })
}

function getHotPropertyIds() {
  const allProps = [
    ...(eventPropertyExtendList.value || []),
    ...(commonProperyList.value || []),
    ...(commonPresetProperyList.value || []),
  ]
  const ids: string[] = []
  allProps.forEach((item) => {
    if (item && item.isHot == true && item.propertyId) {
      ids.push(item.propertyId)
    }
  })
  return Array.from(new Set(ids))
}

function switchEvent(row: EventPropertyRow, checked?: boolean) {
  if (!currentMetaEventId.value) {
    // 与 v2 一致（v2 此处逻辑存疑：模板只传了 row，checked 恒为 undefined，
    // 这里的「回滚开关」实际总是把 isHot 置成 true）
    row.isHot = !checked
    return
  }
  const ids = getHotPropertyIds()
  const params = {
    projectName: projectName.value,
    metaEventId: currentMetaEventId.value,
    propertyIds: ids,
  }

  void setHotPropApi(params).then((res) => {
    if (res?.code == 200) {
      getEventData(currentMetaEventId.value || undefined)
      return
    }
  })
}

function handleTabClick(val: TabsPaneContext) {
  updateExtendList(String(val.paneName), true)
}

function handleDemoEvent() {
  // v2 的 $bus.$emit('$demo_event')：演示环境弹提示框，不执行真实操作
  bus.emit('$demo_event')
}

function protoTypeApiEvent() {
  loadingRefresh.value = true
  const params = copyObj(commonParams.value)
  params.pageNum = pageNum.value
  params.pageSize = pageSize.value
  params.sortName = current.value.sortName
  params.sortOrder = current.value.sortOrder
  const token = nextList()
  getPageListEventApi(params)
    .then((res) => {
      if (!isLatestList(token)) return
      if (res?.code == 200) {
        loadingRefresh.value = false
        tableList.value = res.data?.rows || []
        total.value = Number(res.data?.total || 0)
      }
    })
    .catch(() => {
      if (!isLatestList(token)) return
      loadingRefresh.value = false
    })
}

function sortChange(e: { prop: string; order: string | null }) {
  if (e.order && e.order == 'ascending') {
    current.value.sortName = e.prop
    current.value.sortOrder = 'asc'
  } else if (e.order && e.order == 'descending') {
    current.value.sortName = e.prop
    current.value.sortOrder = 'desc'
  } else {
    current.value.sortName = null
    current.value.sortOrder = null
  }
  protoTypeApiEvent()
}

function openUploadDialog() {
  uploadDialogRef.value?.openDialogEvent()
}

function handleSelectionChange(val: MetaEventRow[]) {
  const metaEventIdArray: (string | undefined)[] = []
  val.forEach((item) => {
    metaEventIdArray.push(item.metaEventId)
  })
  metaEventIds.value = metaEventIdArray.toString()
}

function deleteTableApi() {
  void ElMessageBox.confirm('是否确认删除？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    cancelButtonClass: 'custom-cancel-button',
    type: 'warning',
  })
    .then(function () {
      return deleteEventApi({
        metaEventIds: metaEventIds.value,
        projectName: commonParams.value.projectName,
      })
    })
    .then(() => {
      pageNum.value = 1
      protoTypeApiEvent()
      metaEventIds.value = ''
      ElMessage({ message: '删除成功', type: 'success' })
    })
    .catch(() => {})
}

function batchDelete() {
  if (window.globalConfig.is_clklog_demo_environment) {
    return handleDemoEvent()
  }
  if (!metaEventIds.value) {
    ElMessage({ message: '请选择需要删除的内容', type: 'error' })
    return
  }
  deleteTableApi()
}

function handleDelete(val: MetaEventRow) {
  if (window.globalConfig.is_clklog_demo_environment) {
    return handleDemoEvent()
  }
  metaEventIds.value = val.metaEventId || ''
  deleteTableApi()
}

function openProtoType(row: MetaEventRow) {
  x_pageNum.value = 1
  prototypeVisible.value = true
  propTitleEvent.value = '事件名称：' + row.displayName
  currentMetaEventId.value = row.metaEventId || null
  activePrototype.value = 'event'
  getEventData(row.metaEventId)
}

function handleRowClick(row: MetaEventRow) {
  prototypeKeyword.value = ''
  openProtoType(row)
}

function getProtoIndex($index: number) {
  return (x_pageNum.value - 1) * x_pageSize.value + $index + 1
}

function XhandleSizeChange(val: number) {
  x_pageSize.value = val
}

function XhandleCurrentChange(val: number) {
  x_pageNum.value = val
}

function getPrototype() {
  const params = {
    projectName: commonParams.value.projectName,
    type: '事件',
  }
  const token = nextProto()
  getListEventApi(params)
    .then((res) => {
      if (!isLatestProto(token)) return
      if (res?.code == 200) {
        if (res.data && res.data.length) {
          res.data.forEach((item) => {
            item.displayName = item.groupName
            item.normalPropertyId = item.groupName
            item.propertyList.forEach((child) => {
              child.displayName = child.displayName + '（' + child.name + '）'
            })
          })
          // v2 还把这份数据存进了 this.protoList，但没有任何读取方，这里不再保留
          addEventDialogRef.value?.protoTypeEvent(res.data)
        }
      }
    })
    .catch(() => {
      if (!isLatestProto(token)) return
      /* 报错已由请求层统一提示 */
    })
}

function refreshTableList(val?: string) {
  if (val == 'deleteProto') {
    getPrototype()
    return
  }
  pageNum.value = 1
  protoTypeApiEvent()
}

function setFilterBarParams(
  val: Record<string, unknown> | undefined,
  list: [FilterOption[], FilterOption[]],
) {
  filerList.value = list
  // v2 是 copyObj(val)，val 为 undefined 时父级拿到 undefined；
  // Object.assign({projectName}, undefined) 与 Object.assign({projectName}, {}) 结果一致
  filterBarParams.value = copyObj(val || {})
}

function handleAddEvent(title: string) {
  addEventDialogRef.value?.openDialog(title, filerList.value)
}

function handleUpdate(data: MetaEventRow, title: string) {
  addEventDialogRef.value?.openDialog(title, filerList.value, data)
}

function getIndex($index: number) {
  return (pageNum.value - 1) * pageSize.value + $index + 1
}

function handleSizeChange(val: number) {
  pageSize.value = val
  protoTypeApiEvent()
}

function handleCurrentChange(val: number) {
  pageNum.value = val
  protoTypeApiEvent()
}

watch(commonParams, () => {
  pageNum.value = 1
  protoTypeApiEvent()
})

watch(projectName, () => {
  getPrototype()
})

watch(prototypeKeyword, () => {
  handlePrototypeSearch()
})

onMounted(() => {
  getPrototype()
})
</script>

<template>
  <div>
    <fiterbar
      ByEventGrop
      ByReceive
      BySearchWord
      ByEventTag
      ByPlatform
      @set-filter-bar-params="setFilterBarParams"
    />
    <div class="public-block">
      <div v-loading="loadingRefresh" class="block_online block-main public-hoverItem">
        <div class="public-tableHead">元事件</div>
        <div
          style="
            display: flex;
            margin-bottom: 20px;
            justify-content: space-between;
          "
        >
          <el-button class="zc_btn_default" @click="batchDelete()">批量删除</el-button>
          <div style="display: flex">
            <el-button class="custom_button zc_btn_default" @click="handleAddEvent('新增事件')">
              <el-icon><Plus /></el-icon>新增事件
            </el-button>
            <el-button class="custom_button zc_btn_default" @click="openUploadDialog">
              <el-icon><Plus /></el-icon>事件批量上传
            </el-button>
          </div>
        </div>
        <el-table
          :data="tableList"
          class="public-radius"
          :header-cell-style="{
            textAlign: 'center',
            background: '#f7fafe ',
          }"
          :cell-style="tableHeaderPosition"
          style="width: 100%; min-height: 400px"
          border
          @selection-change="handleSelectionChange"
          @sort-change="sortChange($event)"
        >
          <el-table-column fixed type="selection" width="40" />
          <el-table-column fixed type="index" label="序号" :width="proxy?.$fixedWidth.FwIndex">
            <template #default="scope">
              <div style="cursor: pointer" @click="openProtoType(scope.row)">
                <span v-text="getIndex(scope.$index)"></span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="displayName" label="事件显示名" width="200" fixed sortable="custom">
            <template #default="{ row }">
              {{ row.displayName }}
            </template>
          </el-table-column>
          <el-table-column prop="name" width="200" fixed label="事件英文名" sortable="custom" />
          <el-table-column label="事件属性" width="120">
            <template #default="{ row }">
              <div
                style="
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  cursor: pointer;
                "
                @click="handleRowClick(row)"
              >
                <div style="width: 120px">属性查看</div>
                <el-icon style="color: #2c7be5"><View /></el-icon>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="groupName" label="事件分组" sortable="custom" show-overflow-tooltip />
          <!-- v2 这里注释掉了「是否接收」一列，保持一致不迁移 -->
          <el-table-column prop="status" label="状态" sortable="custom" show-overflow-tooltip />
          <el-table-column prop="display" label="显示状态" sortable="custom" show-overflow-tooltip>
            <template #default="{ row }">
              {{ isNoFilterShow(row.display) }}
            </template>
          </el-table-column>

          <el-table-column prop="isPreset" label="预置属性" sortable="custom" show-overflow-tooltip>
            <template #default="{ row }">
              {{ isNoFilter(row.isPreset) }}
            </template>
          </el-table-column>

          <el-table-column
            prop="channel"
            sortable="custom"
            label="应埋点平台"
            width="180px"
            show-overflow-tooltip
          />
          <el-table-column
            prop="triggerOpportunity"
            label="触发时机"
            sortable="custom"
            show-overflow-tooltip
          />
          <el-table-column prop="remark" label="备注" sortable="custom" show-overflow-tooltip />
          <el-table-column prop="orderNum" sortable="custom" label="排序号" width="100px">
            <template #default="{ row }">
              {{ row.orderNum || '0' }}
            </template>
          </el-table-column>
          <el-table-column
            sortable="custom"
            show-overflow-tooltip
            prop="createTime"
            label="创建时间"
          />
          <el-table-column prop="updateTime" label="修改时间" sortable="custom" show-overflow-tooltip>
            <!-- 与 v2 一致（v2 此处逻辑存疑：插槽参数写成了 row，实际拿到的是 { row, column, $index }，
                 所以 row.updateTime 恒为 undefined，这一列永远显示 "--"） -->
            <template #default="row">{{ row.updateTime || '--' }}</template>
          </el-table-column>

          <el-table-column prop="creator" label="创建人" sortable="custom" show-overflow-tooltip />
          <el-table-column prop="pv" fixed="right" label="操作" align="left" width="130">
            <template #default="scope">
              <div style="display: flex; justify-content: center">
                <el-icon class="edit_btn" @click="handleUpdate(scope.row, '修改事件')">
                  <Edit />
                </el-icon>
                <el-icon class="delete_btn" @click="handleDelete(scope.row)"><Delete /></el-icon>
              </div>
            </template>
          </el-table-column>
        </el-table>
        <div class="block">
          <el-pagination
            v-model:current-page="pageNum"
            next-text="下一页"
            :page-sizes="[10, 20, 30, 40]"
            :page-size="pageSize"
            layout="total, sizes, prev, pager, next, jumper"
            :total="total"
            @size-change="handleSizeChange"
            @current-change="handleCurrentChange"
          />
        </div>
      </div>
    </div>
    <uploadDialog ref="uploadDialogRef" @refresh-table-list="refreshTableList" />
    <addEventDialog ref="addEventDialogRef" @refresh-table-list="refreshTableList" />

    <!-- 属性弹框 -->
    <el-dialog
      v-model="prototypeVisible"
      :modal-append-to-body="false"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      width="70%"
      style="min-height: 600px"
      class="prototype_dialog"
      :title="propTitleEvent"
    >
      <div style="background: #fff; padding: 20px 20px; border-radius: 6px">
        <div
          style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
          "
        >
          <div
            style="
              display: flex;
              align-items: center;
              flex: 1;
              min-width: 0;
              margin-right: 12px;
            "
          >
            <div style="font-size: 16px; font-weight: 600; color: #4d4d4d; white-space: nowrap">
              关键属性：
            </div>
            <div
              style="
                margin-left: 8px;
                color: #4d4d4d;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              "
            >
              <template v-if="allTabHotDisplayNames.length">
                <span>{{ allTabHotDisplayNames.join('、') }}</span>
              </template>
              <template v-else>
                <span>未设置关键属性</span>
              </template>
            </div>
          </div>
          <el-input
            v-model="prototypeKeyword"
            clearable
            size="small"
            placeholder="搜索属性显示名/标识"
            style="width: 260px"
          />
        </div>
        <el-tabs v-model="activePrototype" @tab-click="handleTabClick">
          <el-tab-pane :label="`事件属性（${eventTabCount}）`" name="event" />
          <el-tab-pane :label="`公共属性（${publicTabCount}）`" name="public" />
          <el-tab-pane :label="`通用预置属性（${commonTabCount}）`" name="common" />
        </el-tabs>
        <el-table
          border
          class="public-radius"
          :header-cell-style="{
            textAlign: 'center',
            background: '#f7fafe ',
          }"
          :cell-style="tableHeaderPositionTab"
          :data="pagedExtendList"
          style="width: 100%; min-height: 400px"
        >
          <el-table-column type="index" label="序号">
            <template #default="scope">
              <div style="cursor: pointer">
                <span v-text="getProtoIndex(scope.$index)"></span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="displayName" label="属性显示名">
            <template #default="{ row }">
              <div>{{ row.displayName }}</div>
            </template>
          </el-table-column>
          <el-table-column prop="name" label="属性标识" />
          <el-table-column prop="dataType" label="属性类型" />
          <el-table-column prop="hotpro" label="关键属性" width="245">
            <template #default="{ row }">
              <el-switch
                v-model="row.isHot"
                @change="switchEvent(row)"
                @mouseenter="showText(row)"
                @mouseleave="hideText(row)"
              />
              <div v-if="row.showTextVisible" class="switch-text">
                {{ row.isHot ? '开启关键属性' : '关闭关键属性' }}
              </div>
            </template>
          </el-table-column>
        </el-table>
        <div class="block">
          <el-pagination
            v-model:current-page="x_pageNum"
            next-text="下一页"
            :page-sizes="[10, 20, 30]"
            :page-size="x_pageSize"
            layout="total, sizes, prev, pager, next, jumper"
            :total="x_total"
            @size-change="XhandleSizeChange"
            @current-change="XhandleCurrentChange"
          />
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
// 分页样式 el-pagination 已在 src/styles/index.scss 全局引入（sass 不允许 @use 出现在嵌套块里）
:deep() {
  .switch-text {
    position: absolute;
    right: 0;
    transform: translate(-0%, -90%); //左右上下
    padding: 4px 8px;
    background-color: #fff;
    color: #2c7be5;
    border-radius: 4px;
    border: 1px solid #f4f4f4;
  }

  .custom_button.el-button--medium {
    padding: 0 20px;
  }

  .prototype_dialog .el-dialog__body {
    min-height: 500px;
    padding-top: 20px;
  }

  .el-dialog {
    border-radius: 6px;
  }

  .el-dialog__headerbtn {
    top: 15px;
  }

  .el-dialog__header {
    padding: 0 !important;
    border-radius: 6px;
    height: 44px;
    line-height: 44px;
    background: #fbfcfe;
  }

  .el-dialog__title {
    margin-left: 16px;
    font-size: 15px;
    color: #4d4d4d;
    font-weight: bold;
  }

  .el-dialog__body {
    padding: 20px;
    background-color: #eef4fd;
    border-radius: 6px;
  }
}

//dialog
.add_prototype {
  .custom_button {
    height: 30px;
    color: #fff;
    font-size: 13px;
    background-color: #2c7be5;
  }

  .gp-item-title {
    font-size: 15px;
    font-weight: 500;
    color: #4d4d4d;
  }
}

.edit_btn {
  width: 20px;
  height: 20px;
  line-height: 20px;
  border-radius: 2px;
  background: #dde4ed;
  color: #2c7be5;
  cursor: pointer;
}

.delete_btn {
  width: 20px;
  height: 20px;
  line-height: 20px;
  border-radius: 2px;
  background: #f3e2d0;
  color: #de6210;
  margin-left: 20px;
  cursor: pointer;
}

.public-block {
  .block_online {
    width: 100%;
    justify-content: space-between;
    min-height: 700px;
  }
}
</style>
