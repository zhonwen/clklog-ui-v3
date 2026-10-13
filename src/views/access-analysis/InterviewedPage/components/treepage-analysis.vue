<script setup lang="ts">
/**
 * 结构化页面分析（对应 v2 .../components/treepage-analysis.vue）。
 *
 * 父组件 treePage.vue 通过 ref 调 treeListEvent(树数据, 查询参数)。
 * 表格用的是 el-table 的树形（tree-props + row-key），不是 el-tree。
 */
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { blobDownloads } from '@/utils/localDownloadUtil'
import { exportVisitUriDetailApi } from '@/api/trackingapi/download'
import { getVisitUriDetailApi } from '@/api/trackingapi/visituri'
import vistedDialog from './visted-dialog.vue'
import { copyObj } from '@/utils/copy'
import { formatTime } from '@/utils/format'
import { bus } from '@/utils/event-bus'
import { useTrackingStore } from '@/stores/tracking'

const trackingStore = useTrackingStore()

defineEmits<{ currentPage: [val: unknown] }>()

interface TreeDetail {
  numRandom?: string
  title?: string
  uri?: string
  avgVisitTime?: number
  exitRate?: number
  [key: string]: unknown
}
interface TreeRow {
  uri?: string
  title?: string
  segment?: string
  level?: number
  firstFlag?: string
  secondFlag?: boolean
  loadingApi?: boolean
  numRandom?: string
  leafUri?: TreeRow[]
  detail?: TreeDetail
  [key: string]: unknown
}
interface UriPageResult {
  rows?: TreeRow[]
  total?: number
}
type CheckboxGroupValue = (string | number)[]
type DownloadResponse = { data: BlobPart; headers?: unknown }

const isExpand = ref(true)
// 与 v2 一致：默认值里的 index / uri / title 在模板里没有对应 checkbox，只会被带进导出的 cols
const channelList = ref<CheckboxGroupValue>(['index', 'uri', 'uv', 'ipCount', 'pv', 'title'])
const flowQuality = ref<CheckboxGroupValue>(['entryCount', 'avgVisitTime'])
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

const treeList = ref<TreeRow[]>([])
const commonParams = ref<Record<string, unknown>>({}) // 接口参数
const uriListEnd = ref<TreeRow[]>([])
const dialogParams = ref<{ uri: string }>({ uri: '' })

// 表格实例，用于编程式展开树形行（替代 v2 的 expand-row-keys 受控方式）
const multipleTable = ref<{
  toggleRowExpansion: (row: TreeRow, expanded?: boolean) => void
} | null>(null)

const vistedDialogRef = ref<{ vistedApiEvent: (params: Record<string, unknown>) => void } | null>(
  null,
)

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

/** v2 filters/index.js 的 createUniqueString */
function createUniqueString() {
  const randomBytes = new Uint8Array(4)
  window.crypto.getRandomValues(randomBytes)
  let randomNumber = 0
  for (let i = 0; i < randomBytes.length; i++) {
    randomNumber += (randomBytes[i] ?? 0) * Math.pow(256, i)
  }
  return randomNumber
}

// 随机数
function generateRandomNumber() {
  return createUniqueString().toString()
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

function handelChannelList() {
  initShowTable()
}
function handelFlowQuality() {
  initShowTable()
}

function showManualAddIcon(row: TreeRow) {
  return !!(row.leafUri && row.leafUri.length == 0 && !row.firstFlag)
}

function treeRowClassName({ row }: { row: TreeRow }) {
  return showManualAddIcon(row) ? 'manual-add-row' : ''
}

// 动态增加节点
function insertChild(list: TreeRow, id: string | undefined, newChild: TreeRow[]) {
  ;(list.leafUri || []).forEach((item) => {
    // 过滤非匹配 id（v2 注释里原来是按 uri 匹配，后来改成 detail.numRandom）
    const flag = item.detail?.numRandom == id
    if (flag) {
      item.loadingApi = true
      const newArray = JSON.parse(JSON.stringify(newChild)) as TreeRow[]
      item.leafUri = [...new Set([...(item.leafUri || []), ...newArray])]
      // 子节点写入后，等 treeData 归一化完成再展开该行
      nextTick(() => multipleTable.value?.toggleRowExpansion(item, true))
      if (uriListEnd.value.length == 0) {
        item.firstFlag = 'istrue'
      }
      return
    } else {
      if ((item.leafUri || []).length > 0) {
        insertChild(item, id, newChild)
      }
    }
  })
}

// 更换接口事件
function scopeEventApi(
  uriPath: string | undefined,
  event: string,
  numRandom: string | undefined,
  showAdd?: boolean,
  level?: number,
) {
  const params = copyObj(commonParams.value)
  params.uriPath = uriPath
  params.pageSize = 10
  params.pageNum = 1
  void getVisitUriDetailApi(params).then((res) => {
    if (res?.code == 200) {
      const data = (res.data as UriPageResult | undefined) || {}
      const rows = data.rows || []
      if ((data.total || 0) > 10) {
        rows.push({
          title: '更多',
          uri: '',
          id: 'more',
        })
      }
      uriListEnd.value = rows

      // 动态添加节点
      rows.forEach((item, index) => {
        item.segment = item.uri
        // 去除前缀
        if ((item.segment || '').includes('.com/#')) {
          item.segment = (item.uri || '').split('.com/#')[1]
        } else if ((item.segment || '').includes('.com/')) {
          item.segment = (item.uri || '').split('.com/')[1]
        }
        item.numRandom = item.uri + generateRandomNumber()
        // 与 v2 一致：这里是字符串拼接，`uri + index + 1` 得到的是形如 "http://a01" 的串
        item.uri = String(item.uri) + index + 1
        item.leafUri = []

        item.detail = JSON.parse(JSON.stringify(item)) as TreeDetail
        // 展示 img
        if (showAdd) {
          item.firstFlag = 'istrue'
          item.secondFlag = true
          item.level = level
        } else {
          item.firstFlag = 'istrue'
        }
      })
      treeList.value.forEach((item) => {
        insertChild(item, numRandom, rows)
      })
      // 与 v2 一致：v2 这里写的是 `this.treeList = this.treeList`（无副作用的自赋值，
      // 靠 Vue2 的深度响应式刷新），v3 的 ref 同样是深度响应式，直接省掉这句
    }
  })
}

// 二级标题调用接口添加动态数据
// Element Plus 的 expand-change 第二参是 expanded: boolean（非 v2 的数组）
function expandChangeEvent(row: TreeRow, expanded: boolean) {
  if (expanded && row.level && !row.loadingApi) {
    const level = row.level
    dialogParams.value.uri = String(row.uri ?? '')
    scopeEventApi(row.uri, '', row.detail?.numRandom, true, level)
  }
}

// 随机数作为行 key
function getRowKeys(row: TreeRow) {
  return String(row.detail?.numRandom ?? '')
}

// 层级展开事件
function handleTree(scope: { uri?: string; detail?: TreeDetail }, event: string) {
  if (event == 'dialog') {
    // 弹框分页事件
    const params = copyObj(commonParams.value)
    params.uriPath = scope.uri
    params.needFuzzySearchUriPath = false
    vistedDialogRef.value?.vistedApiEvent(params)
  } else {
    dialogParams.value.uri = String(scope.uri ?? '') // 赋值 uri
    isExpand.value = false
    // 动态添加节点
    scopeEventApi(scope.uri, '', scope.detail?.numRandom)
  }
}

// 表头动态对齐（保留 .cell 为 flex）
function headerCellClass({ column }: { column?: { label?: string } }) {
  // 与 v2 一致（v2 此处逻辑存疑：两个分支返回同一个类名，判断没有意义）
  if (column && column.label === '页面地址') {
    return 'align-center'
  }
  return 'align-center'
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

// 动态添加节点
function insertRandom(list: TreeRow[], level = 1) {
  list.forEach((item) => {
    item.level = level
    if (item.detail) {
      item.detail.numRandom = item.detail.uri + generateRandomNumber()
      if (item.leafUri && item.leafUri.length > 0) {
        insertRandom(item.leafUri, level + 1)
      }
    }
  })
}

/** 父组件通过 ref 调用：灌入树数据（v2 treeListEvent） */
function treeListEvent(val: unknown, params: Record<string, unknown>) {
  commonParams.value = params
  const rows = (val as TreeRow[] | undefined) || []
  rows.map((item) => {
    if (item.detail) {
      item.segment = item.uri
      item.firstFlag = 'istrue'
    }
  })
  handelChannelList()
  treeList.value = rows
  treeList.value.forEach((item) => {
    // 与 v2 一致：v2 这里没判 detail 是否存在，接口少给 detail 会直接抛异常
    if (item.detail) {
      item.detail.numRandom = item.detail.uri + generateRandomNumber()
    }
    insertRandom(item.leafUri || [])
  })
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

defineExpose({ treeListEvent, initShowTable })
</script>

<template>
  <div class="chartsIcon public-hoverItem">
    <div class="public-firstHead" style="display: flex; justify-content: space-between">
      结构化页面分析
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
    <div>
      <!-- 树状图 -->
      <div class="public-Table-minHeight">
        <el-table
          ref="multipleTable"
          class="public-radius"
          :header-cell-style="{ background: '#f7fafe' }"
          :header-cell-class-name="headerCellClass"
          :data="treeList"
          style="width: 100%"
          :row-key="getRowKeys"
          :row-class-name="treeRowClassName"
          :tree-props="{ children: 'leafUri', hasChildren: 'hasChildren' }"
          border
          lazy
          @expand-change="expandChangeEvent"
        >
          <el-table-column label="页面地址" width="400px" show-overflow-tooltip>
            <template #default="scope">
              <div
                v-if="showManualAddIcon(scope.row)"
                class="tableName"
                @click="handleTree(scope.row, '')"
              >
                <img
                  src="@/assets/images/add.png"
                  style="
                    width: 16px;
                    height: 16px;
                    object-fit: cover;
                    box-sizing: border-box;
                    cursor: pointer;
                  "
                />
              </div>

              <div v-if="scope.row.secondFlag" :style="scope.row.title == '更多' ? 'display:flex; ' : ''">
                <div class="tree-title-row">
                  <div
                    v-if="scope.row.title == '更多'"
                    class="setMoreCon"
                    @click="handleTree(dialogParams, 'dialog')"
                  >
                    更多受访页面...
                  </div>
                  <div v-else>
                    {{ scope.row.title ? scope.row.title : "" }}
                  </div>
                </div>
                <div v-if="scope.row.title != '更多'" class="second-flag-segment-row">
                  {{ scope.row.segment ? scope.row.segment : "/" }}
                </div>
              </div>

              <div v-else>
                <div class="tree-title-row">
                  <div
                    v-if="scope.row.title == '更多'"
                    class="setMoreCon"
                    @click="handleTree(dialogParams, 'dialog')"
                  >
                    更多受访页面...
                  </div>
                  <div v-else>
                    {{ scope.row.title ? scope.row.title : "" }}
                  </div>
                </div>
                <div v-if="scope.row.title != '更多'">
                  {{ scope.row.segment ? scope.row.segment : "/" }}
                </div>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="流量基础指标">
            <el-table-column v-if="pv" align="center" prop="detail.pv" label="浏览量" />
            <el-table-column v-if="uv" align="center" prop="detail.uv" label="访客数" />
            <el-table-column v-if="ipCount" align="center" prop="detail.ipCount" label="IP数" />
          </el-table-column>
          <el-table-column align="center" prop="detail.date" label="流量质量指标">
            <el-table-column
              v-if="entryCount"
              align="center"
              prop="detail.entryCount"
              label="入口页次数"
            />
            <el-table-column
              v-if="downPvCount"
              align="center"
              prop="detail.downPvCount"
              label="贡献下游浏览量"
            />
            <el-table-column
              v-if="exitCount"
              align="center"
              prop="detail.exitCount"
              label="退出页次数"
            />
            <el-table-column
              v-if="avgVisitTime"
              align="center"
              prop="detail.avgVisitTime"
              label="页面平均浏览时长"
            >
              <!-- v2 是 `<template slot-scope="{row}" v-if="row.detail.title != '更多'">`，
                   Vue3 里 v-if 不能和作用域插槽写在同一个 template 上（拿不到 row），挪到内部 -->
              <template #default="{ row }">
                <template v-if="row.detail?.title != '更多'">
                  {{ formatTimeFilter(row.detail?.avgVisitTime) }}
                </template>
              </template>
            </el-table-column>
            <el-table-column v-if="exitRate" align="center" prop="detail.exitRate" label="退出率">
              <template #default="{ row }">
                <template v-if="row.detail?.title != '更多'">
                  {{ percenTable(row.detail?.exitRate) }}
                </template>
              </template>
            </el-table-column>
          </el-table-column>
        </el-table>
      </div>

      <vistedDialog ref="vistedDialogRef" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
// v2 是在 ::v-deep {} 里 @import 的，v3 的 @use 不能出现在嵌套块内，只能放在样式块顶部
@use '@/styles/components/el-checkbox.scss';
// v2 这里还 @import 了 el-pagination.scss，v3 已在 styles/index.scss 全局引入，不再重复引

:deep(.el-table .cell) {
  display: flex;
}

:deep(.el-input--medium .el-input__inner) {
  height: 30px;
  line-height: 30px;
}

:deep(.el-icon-search) {
  cursor: pointer;
}

:deep(.el-table__expand-icon) {
  width: 16px;
  height: 16px;
  min-width: 16px;
  flex: 0 0 16px;
  box-sizing: border-box;
  padding: 0;
  margin-right: 6px;
  border: 0;
  background: url('../../../../assets/images/add.png') no-repeat center;
  background-size: 16px 16px;
  transform: none !important;
}

:deep(.el-table__expand-icon .el-icon) {
  opacity: 0;
  width: 16px;
  height: 16px;
}

// 有子节点且已展开
:deep(.el-table__expand-icon--expanded) {
  background-image: url('../../../../assets/images/reduce.png');
  transform: none !important;
}

// 没有子节点时占位宽度与图标保持一致
:deep(.el-table__placeholder) {
  width: 16px;
  height: 16px;
  margin-right: 6px;
  flex: 0 0 16px;
}

:deep(.manual-add-row .el-table__placeholder) {
  display: none;
}

// 内容区按列对齐（align="center" 时，flex 居中）
:deep(.el-table__body td.is-center .cell) {
  justify-content: center;
}

:deep(.el-table__body td.is-left .cell) {
  justify-content: flex-start;
}

// 表头按列名动态对齐
:deep(.el-table__header th.align-left .cell) {
  justify-content: flex-start;
}

:deep(.el-table__header th.align-center .cell) {
  justify-content: center;
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

.setMoreCon {
  margin-left: 5px;
  display: flex;
  border: solid;
  border-radius: 15px;
  color: #2c7be5;
  font-size: 12px;
  padding: 5px;
  cursor: pointer;
}

.loadMoreImg {
  cursor: pointer;
  width: 17px;
  margin-right: 10px;
  margin-left: -5px;
}

.tableName {
  position: static;
  width: 16px;
  height: 16px;
  min-width: 16px;
  flex: 0 0 16px;
  box-sizing: border-box;
  margin-right: 6px;
  padding: 0 !important;
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.tableName img {
  display: block;
  width: 16px;
  height: 16px;
}

.tree-title-row {
  display: flex;
  align-items: center;
}

.second-flag-segment-row {
  margin-left: 0;
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
