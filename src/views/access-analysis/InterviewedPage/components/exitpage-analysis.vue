<script setup lang="ts">
/**
 * 退出页分析表格（对应 v2 views/access-analysis/InterviewedPage/components/exitpage-analysis.vue）。
 *
 * 父组件 exitpage.vue 通过 ref 直接改 pageNum、并调 exitpageEvent()。
 */
import { onBeforeUnmount, onMounted, reactive, ref, getCurrentInstance } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { blobDownloads } from '@/utils/localDownloadUtil'
import { exportVisitUriDetailApi } from '@/api/trackingapi/download'
import visitPageDialog from '../../custom-dialog/visited.vue'
import { getVisitUriDetailApi } from '@/api/trackingapi/visituri'
import { copyObj } from '@/utils/copy'
import { formatTime } from '@/utils/format'
import { makeTableCellCenterByIndex } from '@/utils/index'
import { bus } from '@/utils/event-bus'
import { useTrackingStore } from '@/stores/tracking'
import { useLatestOnly } from '@/composables/useLatestOnly'

const proxy = getCurrentInstance()?.proxy
const trackingStore = useTrackingStore()
const { next, isLatest } = useLatestOnly()

// 与 v2 一致：父组件监听了 @currentPage，但 v2 里这个事件从未被 emit 过
defineEmits<{ currentPage: [val: unknown] }>()

interface UriRow {
  title?: string
  uri?: string
  avgVisitTime?: number
  exitRate?: number
  [key: string]: unknown
}
interface UriPageResult {
  rows?: UriRow[]
  total?: number
}
type CheckboxGroupValue = (string | number)[]
type DownloadResponse = { data: BlobPart; headers?: unknown }

const loadingRefresh = ref(false)
const searchValue = ref('')
// 与 v2 一致：默认值里的 index / uri / title 在模板里没有对应 checkbox，只会被带进导出的 cols
const channelList = ref<CheckboxGroupValue>(['index', 'uri', 'uv', 'ipCount', 'pv', 'title'])
const flowQuality = ref<CheckboxGroupValue>([
  'entryCount',
  'exitCount',
  'avgVisitTime',
  'exitRate',
])
const current = reactive<{ sortName: string | null; sortOrder: string | null }>({
  sortName: null,
  sortOrder: null,
})
const mergedArr = ref<string[]>([])

const uri = ref(false)
const uv = ref(false)
const pv = ref(false)
const ipCount = ref(false)
const exitCount = ref(false)
const avgVisitTime = ref(false)
const exitRate = ref(false)
const entryCount = ref(false)
const downPvCount = ref(false)

const total = ref(0)
const pageSize = ref(10)
const pageNum = ref(1)
const entrylist = ref<UriRow[]>([])
const commonParams = ref<Record<string, unknown>>({})

const visitPageDialogRef = ref<{
  openingEvent: (rows: UriRow, commonParams: Record<string, unknown>) => void
} | null>(null)

// v2 的 `:cell-style="tableHeaderColor"`：「页面URL」列（第 2 列）左对齐，其余居中
const tableHeaderColor = makeTableCellCenterByIndex([], [1])

/** v2 filters/index.js 的 filterUrl 过滤器 */
function filterUrl(value?: string) {
  const regExp = /^(http:\/\/|https:\/\/|www\.)/
  return regExp.test(value || '')
}

/** v2 模板里的 `| formatTime`（filters 版会先 Math.floor） */
function formatTimeFilter(val?: number) {
  return formatTime(Math.floor(Number(val)))
}

/** v2 filters/index.js 的 percenTable：非法/0 值返回数字 0 */
function percenTable(s?: number): string | number {
  if (s == 1) return '100%'
  if (s) return (Number(s) * 100).toFixed(2) + '%'
  return 0
}

function flowPoint(val: string[]) {
  if (val.length > 0) {
    pv.value = val.includes('pv')
    uri.value = val.includes('uri')
    uv.value = val.includes('uv')
    ipCount.value = val.includes('ipCount')
    exitCount.value = val.includes('exitCount')
    avgVisitTime.value = val.includes('avgVisitTime')
    exitRate.value = val.includes('exitRate')
    downPvCount.value = val.includes('downPvCount')
    entryCount.value = val.includes('entryCount')
  }
}

function initShowTable() {
  mergedArr.value = []
  mergedArr.value = [...channelList.value, ...flowQuality.value].map(String)
  flowPoint(mergedArr.value)
}

function exitpageEvent(params0: Record<string, unknown>) {
  const token = next()
  loadingRefresh.value = true
  commonParams.value = params0
  const params = copyObj(params0)
  params.selectOption = 'Exit'
  params.needFuzzySearchUriPath = false
  params.pageSize = pageSize.value
  params.pageNum = pageNum.value
  params.searchParam = searchValue.value
  params.sortName = current.sortName
  params.sortOrder = current.sortOrder
  getVisitUriDetailApi(params)
    .then((res) => {
      if (!isLatest(token)) return
      if (res?.code == 200) {
        loadingRefresh.value = false
        const data = res.data as UriPageResult | undefined
        entrylist.value = data?.rows || []
        total.value = data?.total || 0
      }
      // 与 v2 一致（v2 此处逻辑存疑：code 非 200 时不关 loading，遮罩会一直转）
    })
    .catch(() => {
      if (!isLatest(token)) return
      loadingRefresh.value = false
    })
  initShowTable()
}

function handleClick() {
  pageNum.value = 1
  exitpageEvent(commonParams.value)
}

function checkDialogEvent(row: UriRow) {
  visitPageDialogRef.value?.openingEvent(row, commonParams.value)
}

// 分页
function getIndex(index: number) {
  return (pageNum.value - 1) * pageSize.value + index + 1
}

function sortChange(e: { prop?: string | null; order?: string | null }) {
  if (e.order && e.order == 'ascending') {
    // 降序
    current.sortName = e.prop || null
    current.sortOrder = 'asc'
  } else if (e.order && e.order == 'descending') {
    // 升序
    current.sortName = e.prop || null
    current.sortOrder = 'desc'
  } else {
    current.sortName = null
    current.sortOrder = null
  }
  exitpageEvent(commonParams.value)
}

/** 与 v2 一致：从 content-disposition 里截 filename= 之后的部分 */
function sliceTypeFile(res: DownloadResponse) {
  const headers = res.headers as
    | ({ get?: (k: string) => unknown } & Record<string, unknown>)
    | undefined
  const fileName = String(
    headers?.['content-disposition'] || headers?.get?.('content-disposition') || '',
  )
  const index1 = fileName.indexOf('filename=')
  let result = fileName.substring(index1)
  result = decodeURIComponent(decodeURI(result.slice(9)))
  return result
}

function publicEventDown(val: Record<string, unknown>) {
  // 与 v2 一致：直接在 bus 传来的对象上写字段（没有拷贝）
  const params = val
  params.projectName = trackingStore.projectName
  params.cols = [...channelList.value, ...flowQuality.value].map(String)
  void (exportVisitUriDetailApi(params) as unknown as Promise<DownloadResponse>).then((res) => {
    const name = sliceTypeFile(res)
    blobDownloads(res.data, name)
  })
}

// 分页器
function handleSizeChange(val: number) {
  pageNum.value = 1
  pageSize.value = val
  exitpageEvent(commonParams.value)
}

function handleCurrentChange(val: number) {
  pageNum.value = val
  exitpageEvent(commonParams.value)
}

function handelChannelList() {
  initShowTable()
}
function handelFlowQuality() {
  initShowTable()
}
function initpageNum() {
  pageNum.value = 1
}

// mitt 只能传一个参数，负载就是 v2 `$bus.$emit("publicEventDown", commonData)` 的 commonData
const onPublicEventDown = (val: unknown) => publicEventDown(val as Record<string, unknown>)

onMounted(() => {
  bus.on('publicEventDown', onPublicEventDown)
})

onBeforeUnmount(() => {
  // v2 是 $off(["publicEventDown"])（会摘掉其它组件的同名监听），v3 只注销自己的 handler 引用
  bus.off('publicEventDown', onPublicEventDown)
})

defineExpose({ pageNum, exitpageEvent, initpageNum, initShowTable })
</script>

<template>
  <div v-loading="loadingRefresh" class="chartsIcon public-hoverItem">
    <div class="public-firstHead" style="display: flex; justify-content: space-between">
      退出页分析
    </div>

    <div class="flow-indicator public_indicator">
      <div class="flow-item">
        <div class="flow-title">流量基础指标</div>
        <el-checkbox-group v-model="channelList" class="checkBoxStyle" @change="handelChannelList">
          <el-checkbox value="pv">浏览量</el-checkbox>
          <el-checkbox value="uv">访客数</el-checkbox>
          <el-checkbox value="ipCount" style="margin-right: 0">IP数</el-checkbox>
        </el-checkbox-group>
      </div>
      <div class="flow-item setSpace">
        <div class="flow-title">流量质量指标</div>
        <el-checkbox-group v-model="flowQuality" class="checkBoxStyle" @change="handelFlowQuality">
          <el-checkbox value="entryCount">入口页次数</el-checkbox>
          <el-checkbox value="downPvCount">贡献下游浏览量</el-checkbox>
          <el-checkbox value="exitCount">退出页次数</el-checkbox>
          <el-checkbox value="avgVisitTime">页面平均浏览时长</el-checkbox>
          <el-checkbox value="exitRate">退出率</el-checkbox>
        </el-checkbox-group>
      </div>
    </div>
    <div style="display: flex; justify-content: flex-end; margin: 20px 0; height: 30px">
      <el-input
        v-model="searchValue"
        placeholder="请输入页面标题或页面URL"
        style="width: 300px"
        @keyup.enter="handleClick()"
      >
        <template #suffix>
          <el-icon class="el-input__icon el-icon-search" @click="handleClick()">
            <Search />
          </el-icon>
        </template>
      </el-input>
    </div>
    <div>
      <div>
        <div class="public-Table-minHeight">
          <el-table
            :data="entrylist"
            border
            class="public-radius"
            style="width: 100%"
            :header-cell-style="{ textAlign: 'center', background: '#f7fafe ' }"
            :cell-style="tableHeaderColor"
            @sort-change="sortChange($event)"
          >
            <el-table-column label="序号" type="index" :width="proxy?.$fixedWidth.FwIndex" align="center">
              <template #default="scope">
                <span>{{ getIndex(scope.$index) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="页面URL" show-overflow-tooltip width="400" align="center">
              <template #default="scope">
                <div>
                  <div style="display: flex; justify-content: start; position: relative">
                    <div>{{ scope.row.title }}</div>
                    <img
                      src="@/assets/images/showFlag.png"
                      style="
                        width: 13px;
                        height: 13px;
                        position: absolute;
                        right: 0;
                        cursor: pointer;
                      "
                      @click="checkDialogEvent(scope.row)"
                    />
                  </div>
                  <div style="overflow: hidden; white-space: nowrap; text-overflow: ellipsis">
                    <a
                      v-if="filterUrl(scope.row.uri)"
                      :href="scope.row.uri"
                      style="color: #2c7be5"
                      target="_blank"
                      >{{ scope.row.uri }}</a
                    >
                    <a v-else>{{ scope.row.uri }}</a>
                  </div>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="流量基础指标">
              <el-table-column v-if="pv" prop="pv" label="浏览量" sortable="custom" align="center" />
              <el-table-column v-if="uv" prop="uv" label="访客数" sortable="custom" />
              <el-table-column v-if="ipCount" prop="ipCount" label="IP数" sortable="custom" />
            </el-table-column>
            <el-table-column prop="date" label="流量质量指标">
              <el-table-column v-if="entryCount" prop="entryCount" label="入口页次数" sortable="custom" />
              <el-table-column
                v-if="downPvCount"
                prop="downPvCount"
                label="贡献下游浏览量"
                sortable="custom"
              />
              <el-table-column v-if="exitCount" prop="exitCount" label="退出页次数" sortable="custom" />
              <el-table-column
                v-if="avgVisitTime"
                prop="avgVisitTime"
                label="页面平均浏览时长"
                sortable="custom"
              >
                <template #default="{ row }">
                  {{ formatTimeFilter(row.avgVisitTime) }}
                </template>
              </el-table-column>
              <el-table-column v-if="exitRate" prop="exitRate" label="退出率" sortable="custom">
                <template #default="{ row }">
                  {{ percenTable(row.exitRate) }}
                </template>
              </el-table-column>
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
    </div>
    <visitPageDialog ref="visitPageDialogRef" />
  </div>
</template>

<style lang="scss" scoped>
// v2 是在 ::v-deep {} 里 @import 的，v3 的 @use 不能出现在嵌套块内，只能放在样式块顶部
@use '@/styles/components/el-checkbox.scss';
// v2 这里还 @import 了 el-pagination.scss，v3 已在 styles/index.scss 全局引入，不再重复引

:deep(.el-input--medium .el-input__inner) {
  height: 30px;
  line-height: 30px;
}

:deep(.el-icon-search) {
  cursor: pointer;
}

:deep(.el-table__expand-icon--expanded) {
  transform: rotate(0deg);
}

:deep(.el-icon-arrow-right::before) {
  position: relative !important;
  background: url('../../../../assets/images/add.png') no-repeat 0 3px;
  content: '';
  display: block;
  width: 16px;
  height: 16px;
  font-size: 16px;
  background-size: 13px;
}

// 有子节点 且已展开
:deep(.el-table__expand-icon--expanded) {
  position: relative !important;

  .el-icon-arrow-right:before {
    background: url('../../../../assets/images/reduce.png') no-repeat 0 3px;
    content: '';
    display: block;
    width: 16px;
    height: 16px;
    font-size: 16px;
    background-size: 13px;
  }
}

// 没有字节
:deep(.el-table__placeholder::before) {
  background: '';
  content: '';
  display: block;
  width: 15px;
  height: 15px;
  font-size: 15px;
  background-size: 15px;
}

:deep(.el-table__header) {
  // 使表格兼容 safari，不错位，表头宽度较小
  width: 100%;
  table-layout: fixed !important;
}

:deep(.el-table__body) {
  width: 100%;
  // 使表格兼容 safari，不错位
  table-layout: fixed !important;
}

.tableName {
  position: absolute;
}

.treeStyle {
  margin-left: 15px;
}

.chartsIcon {
  box-sizing: border-box;
  margin: 20px;
  padding-top: 1px;
  min-height: 461px;
  background: #fff;
  border-radius: 6px;
  padding: 22px;

  .flow-indicator {
    min-height: 58px;
    border: 1px solid #f0f0f5;
    border-radius: 6px;
    box-sizing: border-box;
    margin-top: 10px;

    .setSpace {
      margin-bottom: 12px;
    }

    .flow-item {
      display: flex;
      margin-top: 12px;
      margin-left: 10px;

      .flow-title {
        margin-right: 21px;
        font-size: 13px;
        font-weight: 400;
        line-height: 32px;
        color: #4d4d4d;
      }
    }

    .check_item {
      background-color: #ffffff;
      margin-left: 20px;
      height: 40px;
      border-radius: 4px;
      border: 1px solid #eee;
      display: flex;
      align-items: center;

      span {
        font-size: 14px;
        padding: 0 10px;
      }

      .checkBoxStyle {
        padding-right: 10px;
      }
    }
  }
}
</style>
