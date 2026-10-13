<script setup lang="ts">
import { computed, getCurrentInstance, ref, watch } from 'vue'
import analysisBar from '../components/analysisBar.vue'
import { copyObj } from '@/utils/copy'
import { formatDateHMS } from '@/utils/date'
import { getLogEventlListApi } from '@/api/sysmanage/eventAnalysis'
import { useTrackingStore } from '@/stores/tracking'
import { useLatestOnly } from '@/composables/useLatestOnly'

/**
 * 日志分析列表页（v2 src/views/analysis-modules/log-analysis/index.vue）。
 * v2 的 data 里还留着 ruleForm / rules / DialogVisible 以及 saveForm / cancleForm /
 * handleAddPrototype / handleUpdate / handleDelete / parsedObject，页面上没有任何使用方，
 * 是从事件管理页复制过来的死代码，迁移时删除。
 */

interface LogRow {
  logTime?: string
  userId?: string
  eventDisplayName?: string
  eventName?: string
  eventProp?: Record<string, unknown>
  userProp?: Record<string, unknown>
  newprops?: Record<string, unknown>
}

const proxy = getCurrentInstance()?.proxy
const trackingStore = useTrackingStore()
const { next, isLatest } = useLatestOnly()

const filterBarParams = ref<Record<string, unknown>>({})
const current = ref<{ sortName: string | null; sortOrder: string | null }>({
  sortName: null,
  sortOrder: null,
})
const pageNum = ref(1)
const pageSize = ref(20)
const total = ref(0)
const logTableList = ref<LogRow[]>([])
const loadingRefresh = ref(false)

const projectName = computed(() => trackingStore.projectName)

const commonParams = computed<Record<string, unknown>>(() =>
  Object.assign({ projectName: projectName.value }, filterBarParams.value),
)

function filterTimeStep(key: string, item: unknown) {
  if (key == 'lastloginTime' || key == 'registerTime') {
    return formatDateHMS(item as number | string)
  } else {
    return item
  }
}

function showProp(val: Record<string, unknown>) {
  // 与 v2 一致（v2 此处逻辑存疑：val 为 null / undefined 时 Object.keys 会抛 TypeError，未做兜底）
  if (Object.keys(val).length == 0) {
    return true
  }
  return false
}

// 模板里 showProp 会被逐行、逐列重复调用，这里一次算好
const logRows = computed(() =>
  logTableList.value.map((row) => ({
    ...row,
    eventPropText: showProp(row.eventProp as Record<string, unknown>) ? '--' : row.eventProp,
    userPropText: showProp(row.userProp as Record<string, unknown>) ? '--' : row.userProp,
    hasUserProp: !!row.userProp && !showProp(row.userProp),
  })),
)

function getIndex(index: number) {
  return (pageNum.value - 1) * pageSize.value + index + 1
}

function tableHeaderColor({ columnIndex }: { columnIndex: number }) {
  // 必须返回对象：element-plus 会对返回值做 Object.assign，返回字符串会被展开成 {0:'t',...}
  if (columnIndex === 3) {
    return { textAlign: 'left' }
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
    startTime: commonParams.value.startTime,
    endTime: commonParams.value.endTime,
    projectName: commonParams.value.projectName,
    propertyValue: '',
    eventName: commonParams.value.name,
    sortName: current.value.sortName,
    sortOrder: current.value.sortOrder,
  }
  getLogEventlListApi(params)
    .then((res) => {
      if (!isLatest(token)) return
      if (res?.code == 200) {
        loadingRefresh.value = false
        const data = res.data as { rows?: LogRow[]; total?: number }
        logTableList.value = data?.rows || []
        total.value = Number(data?.total || 0)
        logTableList.value.forEach((item) => {
          if (item.eventProp) {
            // v2 这里注释掉了 parsedObject(item.eventProp)，直接原样赋值
            item.newprops = item.eventProp
          }
        })
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

watch(commonParams, () => {
  pageNum.value = 1
  protoTypeApiEvent()
})
</script>

<template>
  <div>
    <analysisBar ByRefresh BySearchWord @set-filter-bar-params="setFilterBarParams" />
    <div class="public-block">
      <div v-loading="loadingRefresh" class="block_online block-main public-hoverItem">
        <div style="display: flex; justify-content: space-between">
          <div class="public-tableHead">日志列表</div>
        </div>
        <el-table
          :data="logRows"
          class="public-radius"
          :header-cell-style="{ textAlign: 'center', background: '#f7fafe ' }"
          :cell-style="tableHeaderColor"
          style="width: 100%; min-height: 500px"
          border
          @sort-change="sortChange"
        >
          <el-table-column type="expand" fixed="left">
            <template #default="{ row }">
              <div class="log-expand-content">
                <div style="width: 50%">
                  <div style="font-size: 16px; font-weight: 600; margin-bottom: 15px">
                    事件属性
                  </div>
                  <div
                    v-for="(item, key, index) of row.newprops"
                    :key="index"
                    style="display: flex"
                  >
                    <div
                      style="
                        font-size: 16px;
                        width: 100%;
                        padding-right: 5px;
                        overflow: hidden;
                        text-overflow: ellipsis;
                      "
                    >
                      {{ key }}：{{ filterTimeStep(String(key), item) }}
                    </div>
                  </div>
                </div>
                <div style="width: 50%">
                  <div style="font-size: 16px; font-weight: 600; margin-bottom: 15px">
                    用户属性
                  </div>
                  <div v-if="row.hasUserProp">
                    <div v-for="(item, key, index) of row.userProp" :key="index">
                      <div
                        style="
                          font-size: 16px;
                          width: 100%;
                          padding-right: 5px;
                          overflow: hidden;
                          text-overflow: ellipsis;
                        "
                      >
                        {{ key }}：{{ filterTimeStep(String(key), item) }}
                      </div>
                    </div>
                  </div>
                  <div v-else>暂无数据</div>
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column
            type="index"
            label="序号"
            :width="proxy?.$fixedWidth.FwIndex"
            fixed="left"
          >
            <template #default="scope">
              <div>
                <span>{{ getIndex(scope.$index) }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column
            fixed="left"
            prop="logTime"
            label="时间"
            :width="proxy?.$fixedWidth.FwTime"
            show-overflow-tooltip
          />
          <el-table-column
            fixed="left"
            prop="userId"
            label="用户ID"
            width="300"
            show-overflow-tooltip
          />
          <el-table-column
            prop="eventDisplayName"
            show-overflow-tooltip
            label="事件显示名"
            :width="proxy?.$fixedWidth.FwEventName"
          >
            <template #default="{ row }">
              {{ row.eventDisplayName }}
            </template>
          </el-table-column>
          <el-table-column
            :width="proxy?.$fixedWidth.FwEventName"
            prop="eventName"
            show-overflow-tooltip
            label="事件英文名"
          >
            <template #default="{ row }">
              {{ row.eventName }}
            </template>
          </el-table-column>
          <el-table-column prop="eventProp" label="事件属性" show-overflow-tooltip width="400">
            <template #default="{ row }">
              {{ row.eventPropText }}
            </template>
          </el-table-column>

          <el-table-column prop="userProp" show-overflow-tooltip label="用户属性">
            <template #default="{ row }">
              {{ row.userPropText }}
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
  </div>
</template>

<style lang="scss" scoped>
// 分页样式 el-pagination 已在 src/styles/index.scss 全局引入（sass 不允许 @use 出现在嵌套块里）
.log-expand-content {
  display: flex;
  box-sizing: border-box;
  width: 100%;
  padding: 20px 50px;
}

:deep(.el-table__expanded-cell) {
  padding: 0 !important;
}

:deep() {
  .custom_button.el-button--medium {
    padding: 0 20px;
  }

  .el-dialog {
    border-radius: 6px;
  }

  .el-dialog__body {
    padding: 30px 50px;
  }

  .el-dialog__title {
    font-size: 15px;
    font-weight: 600;
    line-height: 25px;
    color: #4d4d4d;
  }

  .el-form-item__label {
    font-size: 15px;
    font-weight: 500;
    color: #4d4d4d;
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
