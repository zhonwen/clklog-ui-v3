<script setup lang="ts">
import { computed, getCurrentInstance, onBeforeUnmount, ref, watch } from 'vue'
import analysisBar from '../components/analysisBar.vue'
import event_dialog from './components/event_dialog.vue'
import { copyObj } from '@/utils/copy'
import { getEventListApi } from '@/api/sysmanage/eventAnalysis'
import { useTrackingStore } from '@/stores/tracking'
import { useLatestOnly } from '@/composables/useLatestOnly'

/** 事件分析列表页（v2 src/views/analysis-modules/event-analysis/index.vue） */

interface EventRow {
  eventDisplayName?: string
  eventName?: string
  eventGroupName?: string
  uv?: number
  pv?: number
  avgPv?: number
}

const proxy = getCurrentInstance()?.proxy
const trackingStore = useTrackingStore()
const { next, isLatest } = useLatestOnly()

const loadingRefresh = ref(false)
const current = ref<{ sortName: string | null; sortOrder: string | null }>({
  sortName: null,
  sortOrder: null,
})
const tableList = ref<EventRow[]>([])
const pageNum = ref(1)
const pageSize = ref(10)
const total = ref(0)
const filterBarParams = ref<Record<string, unknown>>({})
let debounceTimer: ReturnType<typeof setTimeout> | null = null

const eventDialog = ref<{
  openDialogEvent: (row: EventRow, params: Record<string, unknown>) => void
} | null>(null)

const projectName = computed(() => trackingStore.projectName)

const commonParams = computed<Record<string, unknown>>(() =>
  Object.assign({ projectName: projectName.value }, filterBarParams.value),
)

function filterFixed(val: number) {
  // 与 v2 一致（v2 此处逻辑存疑：avgPv 为 null / undefined 时 .toFixed 会抛 TypeError，未做兜底）
  return val.toFixed(1)
}

// 模板里逐行调用 filterFixed 会反复求值，这里先算好（人均次数的展示值）
const tableRows = computed(() =>
  tableList.value.map((row) => ({
    ...row,
    avgPvText: filterFixed(row.avgPv as number),
  })),
)

function getIndex(index: number) {
  return (pageNum.value - 1) * pageSize.value + index + 1
}

function tableHeaderColor({ columnIndex }: { columnIndex: number }) {
  // 必须返回对象：element-plus 会对返回值做 Object.assign，返回字符串会被展开成 {0:'t',...}
  // 与 v2 一致（v2 此处逻辑存疑：if / else 两个分支返回的是同一个值，判断没有意义）
  if (columnIndex === 1) {
    return { textAlign: 'center' }
  } else {
    return { textAlign: 'center' }
  }
}

function protoTypeApiEvent() {
  const token = next()
  loadingRefresh.value = true
  const params = {
    pageNum: pageNum.value,
    pageSize: pageSize.value,
    projectName: commonParams.value.projectName,
    eventName: commonParams.value.name == 'all' ? '' : commonParams.value.name,
    groupName: commonParams.value.groupName,
    startTime: commonParams.value.startTime,
    endTime: commonParams.value.endTime,
    sortName: current.value.sortName,
    sortOrder: current.value.sortOrder,
  }
  getEventListApi(params)
    .then((res) => {
      if (!isLatest(token)) return
      if (res?.code == 200) {
        loadingRefresh.value = false
        const data = res.data as { rows?: EventRow[]; total?: number }
        tableList.value = data?.rows || []
        total.value = Number(data?.total || 0)
      }
    })
    .catch(() => {
      if (!isLatest(token)) return
      loadingRefresh.value = false
    })
}

function sortChange(e: { prop?: string; order?: string | null }) {
  if (e.order && e.order == 'ascending') {
    current.value.sortName = e.prop ?? null
    current.value.sortOrder = 'asc'
  } else if (e.order && e.order == 'descending') {
    current.value.sortName = e.prop ?? null
    current.value.sortOrder = 'desc'
  } else {
    current.value.sortName = null
    current.value.sortOrder = null
  }
  // v2 这里给 protoTypeApiEvent 传了 this.commonParams，但该函数不接参数，实参被忽略
  protoTypeApiEvent()
}

function handleRowClick(row: EventRow) {
  eventDialog.value?.openDialogEvent(row, commonParams.value)
}

function setFilterBarParams(val: Record<string, unknown>) {
  filterBarParams.value = copyObj(val)
}

function handleSizeChange(val: number) {
  pageSize.value = val
  protoTypeApiEvent()
}

function handleCurrentChange(val: number) {
  pageNum.value = val
  protoTypeApiEvent()
}

watch(commonParams, (newVal, oldVal) => {
  if (JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      pageNum.value = 1
      protoTypeApiEvent()
    }, 300)
  }
})

onBeforeUnmount(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
})
</script>

<template>
  <div>
    <analysisBar BySearchCustom ByGrop ByRefresh @set-filter-bar-params="setFilterBarParams" />
    <div class="public-block">
      <div v-loading="loadingRefresh" class="block_online block-main public-hoverItem">
        <div style="display: flex; justify-content: space-between">
          <div class="public-tableHead">事件数据统计</div>
        </div>
        <el-table
          :data="tableRows"
          class="public-radius"
          :header-cell-style="{ textAlign: 'center', background: '#f7fafe ' }"
          :cell-style="tableHeaderColor"
          style="width: 100%; min-height: 500px"
          border
          @sort-change="sortChange"
        >
          <el-table-column type="index" label="序号" :width="proxy?.$fixedWidth.FwIndex">
            <template #default="scope">
              <div>
                <span>{{ getIndex(scope.$index) }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="eventDisplayName" label="事件显示名" show-overflow-tooltip />
          <el-table-column prop="eventName" label="事件英文名" show-overflow-tooltip>
            <template #default="{ row }">
              <div style="display: flex; justify-content: center; position: relative">
                <div style="text-align: center">{{ row.eventName }}</div>

                <img
                  src="@/assets/images/showFlag.png"
                  style="
                    width: 13px;
                    height: 13px;
                    position: absolute;
                    right: 0;
                    cursor: pointer;
                  "
                  @click="handleRowClick(row)"
                />
              </div>
            </template>
          </el-table-column>
          <!-- prop 写成 "eventGroupName || '--'" 是 v2 原样保留：该列未启用排序/筛选，prop 实际不生效 -->
          <el-table-column prop="eventGroupName || '--'" show-overflow-tooltip label="事件分组">
            <template #default="{ row }">
              {{ row.eventGroupName || "--" }}
            </template>
          </el-table-column>
          <el-table-column prop="uv" sortable="custom" label="用户数" show-overflow-tooltip />
          <el-table-column prop="pv" sortable="custom" label="触发次数" show-overflow-tooltip />

          <el-table-column prop="avgPv" label="人均次数" show-overflow-tooltip>
            <template #default="{ row }">
              {{ row.avgPvText }}
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

    <event_dialog ref="eventDialog" />
  </div>
</template>

<style lang="scss" scoped>
// 分页样式 el-pagination 已在 src/styles/index.scss 全局引入（sass 不允许 @use 出现在嵌套块里）

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
