<script setup lang="ts">
import { computed, getCurrentInstance, ref } from 'vue'
import { Search, View } from '@element-plus/icons-vue'
import dialogCollapase from './dialog.vue'
import collapseDetail from './collapseDetail-dialog.vue'
import showFlagImg from '@/assets/images/showFlag.png'
import { copyObj } from '@/utils/copy'
import { percentage } from '@/utils/percent'
import { makeTableCellCenterByIndex } from '@/utils/index'
import { getPageApi, groupedSummaryApi } from '@/api/trackingapi/collapse'
import { useLatestOnly } from '@/composables/useLatestOnly'

/** 崩溃分析下方的「数据汇总 / 崩溃日志」两张表（v2 src/views/collapse-analysis/components/collapse-table.vue） */

interface CrashSummaryRow {
  appVersion?: string
  channel?: string
  modelCount?: number
  visitCount?: number
  crashedCount?: number
  pvRate?: number
  uv?: number
  crashedUv?: number
  uvRate?: number
  [key: string]: unknown
}

interface CrashLogRow {
  logTime?: string
  appVersion?: string
  os?: string
  osVersion?: string
  model?: string
  appCrashedReason?: string
  eventSessionId?: string
  [key: string]: unknown
}

type SelectOption = { label: string; id: string }

const proxy = getCurrentInstance()?.proxy

const { next: nextSum, isLatest: isLatestSum } = useLatestOnly()
const { next: nextLog, isLatest: isLatestLog } = useLatestOnly()

const loadingRefresh = ref(false)
const commonParams = ref<Record<string, unknown>>({})
const activeTab = ref('数据汇总')
const version = ref('')
const channelValue = ref('')
const pageNum = ref(1)
const pageSize = ref(10)
const total = ref(0)
const currentTime = ref<Array<string | undefined>>([])
const dataSumList = ref<CrashSummaryRow[]>([])
const crashLogList = ref<CrashLogRow[]>([])
const allChaneList: SelectOption[] = [
  { label: '全部', id: '' },
  { label: '安卓', id: '安卓' },
  { label: '苹果', id: '苹果' },
]

const dialogCollapaseRef = ref<{
  openDialogEvent: (row: CrashSummaryRow, params: Record<string, unknown>) => void
} | null>(null)
const collapseDetailRef = ref<{ openErrorLog: (row: CrashLogRow) => void } | null>(null)

// v2 的 tableHeaderColor：第 6 列左对齐，其余居中。
// element-plus 会对 cell-style 的返回值做 Object.assign，返回字符串会被展开成 {0:'t',...}
// 并抛 Failed to set an indexed property，所以统一用返回对象的工具函数。
const tableHeaderColor = makeTableCellCenterByIndex([], [6])

// 模板里每个单元格都要走一次过滤器，这里先一次性算好，避免模板反复调用同一函数
const sumRows = computed(() =>
  dataSumList.value.map((row) => ({
    ...row,
    pvRateText: percentage(row.pvRate),
    uvRateText: percentage(row.uvRate),
  })),
)

function handleDetailDialog(row: CrashLogRow) {
  collapseDetailRef.value?.openErrorLog(row)
}

function handleRowClick(row: CrashSummaryRow) {
  dialogCollapaseRef.value?.openDialogEvent(row, commonParams.value)
}

function getIndex($index: number) {
  return (pageNum.value - 1) * pageSize.value + $index + 1
}

function checkApiType(type: string) {
  commonParams.value.pageSize = pageSize.value
  commonParams.value.pageNum = pageNum.value
  commonParams.value.version = version.value
  commonParams.value.channel = channelValue.value ? [channelValue.value] : []
  loadingRefresh.value = true
  if (type == '数据汇总') {
    const params = copyObj(commonParams.value)
    delete params.pageNum
    delete params.pageSize
    const token = nextSum()
    groupedSummaryApi(params)
      .then((res) => {
        if (!isLatestSum(token)) return
        if (res?.code == 200) {
          loadingRefresh.value = false
          // v2 这里注释掉了 this.total = res.data.total（数据汇总不分页）
          dataSumList.value = (res.data ?? []) as CrashSummaryRow[]
        }
      })
      .catch(() => {
        if (!isLatestSum(token)) return
        loadingRefresh.value = false
      })
  } else {
    const params = copyObj(commonParams.value)
    params.startTime = currentTime.value[0]
    params.endTime = currentTime.value[1]
    const token = nextLog()
    getPageApi(params)
      .then((res) => {
        if (!isLatestLog(token)) return
        if (res?.code == 200) {
          loadingRefresh.value = false
          const data = (res.data ?? {}) as { total?: number; rows?: CrashLogRow[] }
          total.value = data.total ?? 0
          crashLogList.value = data.rows ?? []
        }
      })
      .catch(() => {
        if (!isLatestLog(token)) return
        loadingRefresh.value = false
      })
  }
}

function paramsEvent(params: Record<string, unknown>) {
  commonParams.value = copyObj(params)
  currentTime.value = [
    params.startTime as string | undefined,
    params.endTime as string | undefined,
  ]
  checkApiType(activeTab.value)
}

// 与 v2 一致：changSystemEvent 声明了 type 形参却没有用到，实际取的还是当前 tab
function changSystemEvent() {
  pageNum.value = 1
  checkApiType(activeTab.value)
}

function searchEvent() {
  pageNum.value = 1
  checkApiType(activeTab.value)
}

function handleClear() {
  checkApiType(activeTab.value)
}

function handleClick() {
  pageSize.value = 10
  pageNum.value = 1
  checkApiType(activeTab.value)
}

function handleSizeChange(val: number) {
  pageNum.value = 1
  pageSize.value = val
  checkApiType('崩溃日志')
}

function handleCurrentChange(val: number) {
  pageNum.value = val
  checkApiType('崩溃日志')
}

// v2 里父组件既调用 this.$refs.collapseTable.paramsEvent(...)，也直接写 this.$refs.collapseTable.pageNum = 1，
// 所以 pageNum 也要暴露出去（<script setup> 默认对外封闭）
defineExpose({ pageNum, paramsEvent })
</script>

<template>
  <div v-loading="loadingRefresh" class="userLoyalty public-hoverItem">
    <!-- v2 这里还留着一段「测试台湾地图展示内容」的注释与配套的 initMap()，
         依赖 echarts 4 的 echarts/map/json/*.json，echarts 6 已不再提供该目录，迁移时一并去掉 -->
    <el-tabs v-model="activeTab" @tab-click="handleClick">
      <el-tab-pane label="数据汇总" name="数据汇总">
        <div class="tab-warry block-main" style="padding-top: 0">
          <div class="tab-sing">
            <div style="display: flex">
              <el-input
                v-model="version"
                class="custom_input"
                placeholder="请输入应用版本"
                style="width: 200px; border-radius: 4px"
                clearable
                @keyup.enter="searchEvent()"
                @clear="handleClear"
              >
                <template #prefix>
                  <el-icon class="el-input__icon" style="cursor: pointer" @click="searchEvent">
                    <Search />
                  </el-icon>
                </template>
              </el-input>
            </div>
            <div class="warry_select">
              <div class="title">操作系统:</div>
              <el-select
                v-model="channelValue"
                style="width: 100px"
                class="single_select"
                @change="changSystemEvent"
              >
                <el-option
                  v-for="item in allChaneList"
                  :key="item.id"
                  :label="item.label"
                  :value="item.id"
                />
              </el-select>
            </div>
            <!-- v2 这里注释掉了一个「崩溃原因」下拉 -->
          </div>
          <div class="table-block">
            <el-table
              :header-cell-style="{
                textAlign: 'center',
                background: '#f7fafe ',
              }"
              :cell-style="{ textAlign: 'center' }"
              class="public-radius"
              border
              :data="sumRows"
              style="width: 100%"
            >
              <el-table-column
                label="序号"
                type="index"
                :width="proxy?.$fixedWidth.FwIndex"
                align="center"
              >
                <template #default="scope">
                  <span v-text="getIndex(scope.$index)"> </span>
                </template>
              </el-table-column>
              <el-table-column prop="appVersion" label="应用版本" width="180" />

              <el-table-column prop="channel" label="操作系统" width="180" />
              <el-table-column prop="" label="设备型号数" width="180">
                <template #default="{ row }">
                  <div
                    style="display: flex; justify-content: center; position: relative"
                    @click="handleRowClick(row)"
                  >
                    <div style="text-align: center">{{ row.modelCount }}</div>

                    <img
                      :src="showFlagImg"
                      style="
                        width: 13px;
                        height: 13px;
                        position: absolute;
                        right: 0;
                        cursor: pointer;
                      "
                    />
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="visitCount" label="访问次数" />
              <el-table-column prop="crashedCount" label="崩溃次数" />
              <el-table-column prop="pvRate" label="崩溃率">
                <template #default="{ row }">
                  {{ row.pvRateText }}
                </template>
              </el-table-column>
              <el-table-column prop="uv" label="访问用户数" />
              <el-table-column prop="crashedUv" label="崩溃触发用户数" />

              <el-table-column prop="uvRate" label="崩溃触发用户占比">
                <template #default="{ row }">
                  {{ row.uvRateText }}
                </template>
              </el-table-column>
              <el-table-column prop="pvRate" label="崩溃数占比">
                <template #default="{ row }">
                  {{ row.pvRateText }}
                </template>
              </el-table-column>
            </el-table>
          </div>
        </div>
      </el-tab-pane>
      <el-tab-pane label="崩溃日志" name="崩溃日志">
        <div class="tab-warry block-main" style="padding-top: 0">
          <div class="tab-sing">
            <el-input
              v-model="version"
              class="custom_input"
              placeholder="请输入应用版本"
              style="width: 200px; border-radius: 4px"
              clearable
              @keyup.enter="searchEvent()"
              @clear="handleClear"
            >
              <template #prefix>
                <el-icon class="el-input__icon" style="cursor: pointer" @click="searchEvent">
                  <Search />
                </el-icon>
              </template>
            </el-input>
            <div class="warry_select">
              <div class="title">操作系统:</div>
              <el-select
                v-model="channelValue"
                style="width: 100px"
                class="single_select"
                placeholder=""
                @change="changSystemEvent"
              >
                <el-option
                  v-for="item in allChaneList"
                  :key="item.id"
                  :label="item.label"
                  :value="item.id"
                />
              </el-select>
            </div>
          </div>
          <div class="table-block">
            <el-table
              :header-cell-style="{
                textAlign: 'center',
                background: '#f7fafe ',
              }"
              :cell-style="tableHeaderColor"
              class="public-radius"
              border
              :data="crashLogList"
              style="width: 100%"
            >
              <el-table-column
                label="序号"
                type="index"
                :width="proxy?.$fixedWidth.FwIndex"
                align="center"
              >
                <template #default="scope">
                  <span v-text="getIndex(scope.$index)"> </span>
                </template>
              </el-table-column>
              <el-table-column prop="logTime" label="崩溃时间" width="200" />
              <el-table-column prop="appVersion" label="应用版本" />
              <el-table-column prop="os" label="操作系统" />
              <el-table-column prop="osVersion" label="操作系统版本" />

              <el-table-column prop="model" label="设备型号" show-overflow-tooltip min-width="200" />
              <el-table-column prop="appCrashedReason" width="250" label="崩溃详情信息">
                <!-- v2 这里注释掉了 :show-overflow-tooltip="true" -->
                <template #default="{ row }">
                  <div
                    style="
                      display: flex;
                      justify-content: center;
                      align-items: center;
                      position: relative;
                    "
                    @click="handleDetailDialog(row)"
                  >
                    <div
                      style="
                        text-align: center;
                        width: 200px;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                        margin-right: 15px;
                        cursor: pointer;
                      "
                    >
                      {{ row.appCrashedReason }}
                    </div>
                    <el-icon v-if="row.appCrashedReason" style="color: #2c7be5; cursor: pointer">
                      <View />
                    </el-icon>
                  </div>
                </template>
              </el-table-column>
              <el-table-column prop="eventSessionId" width="325" label="会话ID">
                <template #default="{ row }">
                  <div style="display: flex; justify-content: center; position: relative">
                    <div
                      style="
                        text-align: left;
                        width: 325px;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                        margin-right: 15px;
                        cursor: pointer;
                      "
                    >
                      {{ row.eventSessionId }}
                    </div>

                    <!-- v2 这里注释掉了一个「复制会话ID」的图标按钮（配套的 copyRowId 方法一并省略） -->
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </div>

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
      </el-tab-pane>
    </el-tabs>
    <dialogCollapase ref="dialogCollapaseRef" />
    <collapseDetail ref="collapseDetailRef" />
  </div>
</template>

<style lang="scss" scoped>
// v2 这里在 ::v-deep 块内 @import 了 el-pagination.scss，v3 已在 src/styles/index.scss 全局引入，
// 且 sass 不允许 @use 出现在嵌套块内（会整页编译失败），这里不再重复引入。
:deep() {
  // 设置input
  .el-input__inner {
    font-size: 11px;
  }

  .custom_input {
    margin-right: 20px;
  }

  .el-button--medium {
    padding: 0 20px;
  }

  .el-input--medium .el-input__inner {
    height: 32px;
    line-height: 32px;
  }

  .el-input--medium .el-input__icon {
    line-height: 32px;
  }

  // end

  .el-tabs__header {
    background-color: #f9fafd;
    margin: 0 0;
    border-radius: 6px 6px 0 0;
  }

  .el-tabs__item.is-active {
    background-color: #fff;
    border-radius: 6px 0 0 0;
  }

  .el-tabs__nav-wrap::after {
    background-color: #fff;
  }

  .el-tabs__item {
    padding: 0 0;
    width: 130px;
    height: 65px;
    line-height: 65px;
    text-align: center;
    font-size: 15px;
    font-weight: bold;
    color: #4d4d4d;
  }

  .single_select .el-input__inner {
    border-radius: 0px;
    border-top-width: 0px;
    border-left-width: 0px;
    border-right-width: 0px;
    border-bottom-width: 1px;
    border-bottom: 1px solid #acb2ba;
    background-color: transparent;
    font-size: 12px;
    height: 30px;
    line-height: 30px;
    border-bottom-width: 0;
    padding-left: 10px;
    width: 100px;
  }

  .el-input--medium .el-input__icon {
    line-height: 30px;
    cursor: pointer;
  }

  // 日历样式start
  .el-range-editor--medium .el-range-input {
    font-size: 13px;
  }

  .el-date-editor .el-range__icon {
    font-size: 13px;
    line-height: 24px;
  }

  .el-range-editor--medium .el-range-separator {
    font-size: 13px;
    line-height: 24px;
  }
}

.userLoyalty {
  margin: 20px;
  background: #fff;
  border-radius: 6px !important;

  .tab-warry {
    min-height: 500px;

    .tab-sing {
      display: flex;
      margin: 20px 0;
      justify-content: flex-end;
    }

    .table-block {
      min-height: 400px;
    }

    .warry_select {
      display: flex;
      border: 1px solid #d5dfed;
      border-radius: 4px;
      align-items: center;
      min-height: 30px;
      margin-right: 20px;
      width: 153px;

      .title {
        font-size: 12px;
        color: #4d4d4d;
        padding-left: 6px;
        white-space: nowrap;
      }
    }
  }
}
</style>
