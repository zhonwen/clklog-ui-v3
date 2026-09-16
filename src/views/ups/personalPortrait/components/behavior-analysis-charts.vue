<script setup lang="ts">
/**
 * 个人画像 - 用户列表（对应 v2 `views/ups/personalPortrait/components/behavior-analysis-charts.vue`）。
 *
 * 父组件 personalPortrait/index.vue 通过 ref 调 updateVisitorList，所以必须 defineExpose。
 * 和 user-behavior/behaviorAnalysis/components/table.vue 长得很像，但不是同一个：
 * 这里走 upsapi/userportrait 的 getUserList，点行打开的是 dialog/userPortrait.vue。
 *
 * 与 v2 一致（v2 此处逻辑存疑：data 里留着 chart / options / pointValue / disabledSelect
 * 一整套图表残留，pointValue 还被声明了两次，模板里没有任何图表，mounted 的 initChartValue
 * 和 beforeDestroy 的 chart.dispose 都作用在这堆死数据上，迁移时不再搬运；
 * cologStyle 同理，取了 settings store 但从未使用）。
 */
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { DocumentCopy, Search, View } from '@element-plus/icons-vue'
import dialogs from '@/layout/components/dialog/userPortrait.vue'
import { averageRules } from '@/utils/percent'
import { formatTime } from '@/utils/format'
import { getUserList } from '@/api/upsapi/userportrait'
import { useTrackingStore } from '@/stores/tracking'
import { useLatestOnly } from '@/composables/useLatestOnly'

/** 用户列表的一行 */
interface UserRow {
  userId?: string
  visitorType?: string
  pv?: number
  visitCount?: number
  avgPv?: number
  /** 接口返回秒数，getUserListEvent 里就地换成了 formatTime 的字符串（与 v2 一致） */
  visitTime?: number | string
  latestTime?: string
}

interface UserListData {
  rows?: UserRow[]
  total?: number
}

const trackingStore = useTrackingStore()
const { next, isLatest } = useLatestOnly()

const searchId = ref('')
const userListData = ref<UserRow[]>([])
const loadingUserList = ref(false)
/** 父组件传进来的筛选条参数 */
const filterParams = ref<Record<string, unknown> | null>(null)
const userId = ref('')
const current = ref<{
  size: number
  page: number
  sortName: string | null
  sortOrder: string | null
}>({
  size: 20,
  page: 1,
  sortName: null,
  sortOrder: null,
})
const total = ref(0)

const childRef = ref<{ callMethod: (val: string) => void } | null>(null)

const projectName = computed(() => trackingStore.projectName)

/** 模板里避免每行重复调 averageRules，这里一次算好 */
const tableRows = computed(() =>
  userListData.value.map((row) => ({
    ...row,
    avgPvText: averageRules(row.avgPv),
  })),
)

function copyRowId(id: string) {
  const textarea = document.createElement('textarea')
  textarea.value = id
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
  ElMessage.success('复制成功！')
}

function handleClick() {
  userId.value = searchId.value
  current.value.page = 1
  getUserListApi()
}

function sortChange(e: { prop: string; order: string | null }) {
  if (e.order && e.order == 'ascending') {
    current.value.sortName = e.prop
    current.value.sortOrder = 'asc'
    getUserListApi()
  } else if (e.order && e.order == 'descending') {
    current.value.sortName = e.prop
    current.value.sortOrder = 'desc'
    getUserListApi()
  } else {
    current.value.sortName = null
    current.value.sortOrder = null
    getUserListApi()
  }
}

function initCurrentPage() {
  current.value.page = 1
}

function getUserListEvent(val: UserListData | null) {
  const rows = val?.rows || []
  userListData.value = rows
  rows.map((item) => {
    if (item.visitTime || item.visitTime == 0) {
      item.visitTime = formatTime(Math.floor(Number(item.visitTime)))
    }
  })
  total.value = Number(val?.total || 0)
}

/** 通过 ref 调用的方法：父组件筛选条变化时刷新列表 */
function updateVisitorList(params?: { filterParams?: Record<string, unknown> | null } | null) {
  if (params) {
    // 与 v2 一致：params.filterParams 为空时，把 params 自身当筛选参数用
    filterParams.value = params.filterParams
      ? params.filterParams
      : (params as Record<string, unknown>)
    userId.value = searchId.value
  }
  initCurrentPage()
  getUserListApi()
}

/** v2 里方法名就叫 getUserList，和 api 同名；v3 里 api 占了这个名字，本地方法加 Api 后缀 */
function getUserListApi() {
  const token = next()
  loadingUserList.value = true
  const requestParams: Record<string, unknown> = Object.assign({}, filterParams.value || {})
  requestParams.projectName = projectName.value
  requestParams.userId = userId.value
  requestParams.pageNum = current.value.page
  requestParams.pageSize = current.value.size
  requestParams.sortName = current.value.sortName
  requestParams.sortOrder = current.value.sortOrder || 'desc'

  getUserList(requestParams)
    .then((res) => {
      if (!isLatest(token)) return
      loadingUserList.value = false
      if (res?.code === 200) {
        getUserListEvent(res.data as UserListData | null)
      } else {
        ElMessage.error(res?.msg || '获取用户列表失败')
      }
    })
    .catch(() => {
      if (!isLatest(token)) return
      loadingUserList.value = false
      ElMessage.error('获取用户列表时发生错误')
    })
}

function handleCellClick(val?: string) {
  if (!val) return
  // v2 是 this.$refs.child.callMethod(val, "个人画像")，弹窗的 callMethod 只取第一个参数
  childRef.value?.callMethod(val)
}

function handleSizeChange(val: number) {
  current.value.size = val
  current.value.page = 1
  getUserListApi()
}

function handleCurrentChange(val: number) {
  current.value.page = val
  getUserListApi()
}

defineExpose({ updateVisitorList, initCurrentPage, current, searchId })
</script>

<template>
  <div>
    <div class="search_wrappy public-hoverItem">
      <div class="search_table">
        <span class="public-firstHead">用户列表</span>
        <div style="text-align: right">
          <el-input
            v-model="searchId"
            placeholder="请输入用户ID"
            style="width: 300px"
            @keyup.enter="handleClick()"
          >
            <template #suffix>
              <el-icon class="el-input__icon search-icon" @click="handleClick()">
                <Search />
              </el-icon>
            </template>
          </el-input>
        </div>

        <!-- 搜索词 -->
        <div class="setTable">
          <el-table
            v-loading="loadingUserList"
            border
            :data="tableRows"
            :header-cell-style="{
              textAlign: 'center',
              background: '#f7fafe  ',
            }"
            class="public-radius"
            :cell-style="{ textAlign: 'center' }"
            style="width: 100%; margin-top: 12px; height: 98%"
            @sort-change="sortChange"
          >
            <el-table-column
              show-overflow-tooltip
              style="cursor: pointer !important"
              label="用户ID"
              width="450"
              prop="userId"
            >
              <template #default="scope">
                <div
                  style="
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    cursor: pointer;
                  "
                >
                  <div
                    style="overflow: hidden; text-overflow: ellipsis"
                    @click="handleCellClick(scope.row.userId)"
                  >
                    {{ scope.row.userId }}
                  </div>
                  <el-icon
                    v-if="scope.row.userId"
                    style="color: #2c7be5; margin-left: 5px"
                    @click="copyRowId(scope.row.userId)"
                  >
                    <DocumentCopy />
                  </el-icon>
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="visitorType" label="访客类型" sortable="custom">
              <template #default="scope">
                <div
                  style="cursor: pointer; overflow: hidden; text-overflow: ellipsis"
                  @click="handleCellClick(scope.row.userId)"
                >
                  {{ scope.row.visitorType }}
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="pv" label="浏览量" sortable="custom">
              <template #default="scope">
                <div
                  style="cursor: pointer; overflow: hidden; text-overflow: ellipsis"
                  @click="handleCellClick(scope.row.userId)"
                >
                  {{ scope.row.pv }}
                </div>
              </template>
            </el-table-column>

            <el-table-column prop="visitCount" label="访问次数" sortable="custom">
              <template #default="scope">
                <div
                  style="cursor: pointer; overflow: hidden; text-overflow: ellipsis"
                  @click="handleCellClick(scope.row.userId)"
                >
                  {{ scope.row.visitCount }}
                </div>
              </template>
            </el-table-column>

            <el-table-column prop="avgPv" label="平均访问页数" sortable="custom">
              <template #default="scope">
                <div
                  style="cursor: pointer; overflow: hidden; text-overflow: ellipsis"
                  @click="handleCellClick(scope.row.userId)"
                >
                  {{ scope.row.avgPvText }}
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="visitTime" label="停留时长" sortable="custom">
              <template #default="scope">
                <div
                  style="cursor: pointer; overflow: hidden; text-overflow: ellipsis"
                  @click="handleCellClick(scope.row.userId)"
                >
                  {{ scope.row.visitTime }}
                </div>
              </template>
            </el-table-column>

            <el-table-column prop="latestTime" label="上次访问时间" sortable="custom" width="200">
              <template #default="scope">
                <div
                  style="cursor: pointer; overflow: hidden; text-overflow: ellipsis"
                  @click="handleCellClick(scope.row.userId)"
                >
                  {{ scope.row.latestTime }}
                </div>
              </template>
            </el-table-column>
            <el-table-column
              prop="pvRate"
              label="访问详情"
              width="130"
              :show-overflow-tooltip="false"
              align="center"
            >
              <template #default="{ row }">
                <div
                  style="display: flex; justify-content: center; cursor: pointer"
                  @click="handleCellClick(row.userId)"
                >
                  <el-icon style="margin-right: 8px; color: #2c7be5">
                    <View />
                  </el-icon>
                  查看
                </div>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
      <div class="block">
        <el-pagination
          v-model:current-page="current.page"
          next-text="下一页"
          :page-sizes="[10, 20, 30, 40]"
          :page-size="current.size"
          layout=" total,sizes, prev, pager, next, jumper"
          :total="total"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </div>

    <dialogs ref="childRef" />
  </div>
</template>

<style lang="scss" scoped>
// v2 这里是 @import "~@/styles/components/custom-select.scss"
// 和 ::v-deep { @import "~@/styles/components/el-pagination.scss"; }，
// v3 两者都已在 styles/index.scss 全局 @use，组件内不再重复引入

:deep(.el-table__header) {
  // 使表格兼容safari，不错位,表头宽度较小
  width: 100%;
  table-layout: fixed !important;
}

:deep(.el-table__body) {
  width: 100%;
  // 使表格兼容safari，不错位
  table-layout: fixed !important;
}

// v2 是 .el-icon-search { cursor: pointer; }，v3 图标换成 el-icon 组件，这里改挂自定义类
.search-icon {
  cursor: pointer;
}

.trafficHead {
  font-size: 16px;
  font-weight: 600;
  color: #4d4d4d;
  padding: 0px 30px 20px;
}

img {
  width: 11.44px;
  height: 11.44px;
  margin-left: 12px;
  cursor: pointer;
}

.trendHead {
  display: flex;
  align-items: center;
  font-size: 14px;
  font-weight: 500;
  line-height: 33px;
  color: #4d4d4d;

  .iconFlag {
    position: absolute;
    right: 13px;
    top: 19px;
    color: #acaaaa;
    font-size: 16px;
    cursor: pointer;
  }
}

.chartsIcon {
  margin: 20px;
  min-height: 300px;
  display: flex;
  justify-content: space-between;

  .chartLeft {
    border-radius: 6px;
    background-color: #fff;
    padding: 15px;
    width: 100%;
    min-height: 400px;

    .point {
      padding-right: 10px;
    }
  }
}

// table表格
.search_wrappy {
  border-radius: 6px;
  position: relative;
  margin: 20px;
  background-color: #fff;
  min-height: 530px;
  padding: 22px;
}

.search_table {
  height: 100%;
}
</style>
