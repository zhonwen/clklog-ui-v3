<script setup lang="ts">
/**
 * 分群管理列表（对应 v2 views/ups/usergroup/group-list.vue）。
 */
import { computed, getCurrentInstance, ref, watch } from 'vue'
import type { CSSProperties } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Edit, VideoPlay, View } from '@element-plus/icons-vue'
import filterBar from './components/filterBar.vue'
import rulesDialog from './components/rulesDialog.vue'
import groupDetailDialog from './components/group-detail-dialog.vue'
import { deleteApi, getlistpage, groupTagNow, status } from '@/api/upsapi/usergroup'
import { copyObj } from '@/utils/copy'
import { formatDateHMS } from '@/utils/date'
import { useLatestOnly } from '@/composables/useLatestOnly'
import { useTrackingStore } from '@/stores/tracking'
import { bus } from '@/utils/event-bus'
import type { CreateMethodPayload, GroupRow } from './types'

const proxy = getCurrentInstance()?.proxy
const trackingStore = useTrackingStore()
const { next: nextList, isLatest: isLatestList } = useLatestOnly()

const rulesDialogRef = ref<{ openEvent: (val?: string) => void } | null>(null)
const groupDetailDialogRef = ref<{ openDialogEvent: (row: GroupRow) => void } | null>(null)

const refreshTagList = ref(false)
const topFilterParams = ref<Record<string, unknown>>({})
const pageSize = ref(10)
const pageNum = ref(1)
const tagPageList = ref<GroupRow[]>([])
const total = ref(0)

const projectName = computed(() => trackingStore.projectName)

const commonParams = computed<Record<string, unknown>>(() =>
  Object.assign({ projectName: projectName.value }, topFilterParams.value),
)

/** header-cell-style / cell-style 必须返回对象；v2 返回的是 "text-align:left" 字符串 */
const headerCellStyle: CSSProperties = { textAlign: 'center', background: '#f7fafe  ' }

function tableHeaderColor({ columnIndex }: { columnIndex: number }): CSSProperties {
  if (columnIndex === 1) {
    return { textAlign: 'left' }
  } else {
    return { textAlign: 'center' }
  }
}

function filterUpdataDate(row: GroupRow) {
  if (row.updateType == '例行') {
    if (row.frequencyValue) {
      const days = row.frequencyValue.split(',').map(Number)
      const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
      const result: string[] = []
      if (row.frequency === '周') {
        days.forEach((day) => {
          result.push(dayNames[day - 1] ?? '')
        })
      } else if (row.frequency === '月') {
        days.forEach((day) => {
          result.push(day + '号')
        })
      }
      return row.frequency === '月' ? '月' + result.join(',') : result.join(',')
    } else {
      return row.frequency
    }
  }
  return undefined
}

function filterLabel(label?: string) {
  switch (label) {
    // case "规则创建":
    case '自定义规则':
      return 1
    case '导入创建':
      return 2
    default:
      return 1
  }
}

function getpagelistApi(newval: Record<string, unknown>, loadClose?: boolean) {
  if (!loadClose) {
    refreshTagList.value = true
  }

  const pageIndex = pageNum.value
  const params = Object.assign({ pageSize: pageSize.value, pageIndex }, newval)
  const token = nextList()
  getlistpage(params)
    .then((res) => {
      if (!isLatestList(token)) return
      refreshTagList.value = false
      tagPageList.value = res?.data?.rows || []
      tagPageList.value.forEach((item) => {
        if (item.status && item.status == '启用') {
          item.isOpen = true
        } else {
          item.isOpen = false
        }
      })
      total.value = res?.data?.total || 0
    })
    .catch(() => {
      if (!isLatestList(token)) return
      refreshTagList.value = false
    })
}

function viewHandle(row: GroupRow) {
  // 原负载：$bus.$emit('$createMethod', this.filterLabel(row.createType), row)
  const payload: CreateMethodPayload = { createIndex: filterLabel(row.createType), formula: row }
  bus.emit('$createMethod', payload)
}

function refreshTagApi(row: GroupRow) {
  ElMessageBox.confirm('是否手动更新？', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    cancelButtonClass: 'custom-cancel-button',
    type: 'warning',
  })
    .then(() => {
      const params: Record<string, unknown> = {
        name: '',
        displayName: '',
        type: '',
        description: '',
        valueType: '',
        tagValue: '',
        updateType: '',
        frequency: '',
        frequencyTime: '',
        createType: '',
        formula: '',
        projectName: '',
        id: '',
      }
      const source = row as unknown as Record<string, unknown>
      for (const key in source) {
        if (key in params) {
          params[key] = source[key] // 如果存在，则赋值
        }
      }
      params.projectName = projectName.value
      void groupTagNow(params).then(() => {
        getpagelistApi(commonParams.value)
        ElMessage.success('更新成功')
      })
    })
    .catch(() => undefined)
}

function handleDetail(row: GroupRow) {
  groupDetailDialogRef.value?.openDialogEvent(row)
}

function showText(row: GroupRow) {
  row.showTextVisible = true
}

function hideText(row: GroupRow) {
  row.showTextVisible = false
}

function switchEvent(row: GroupRow) {
  const params = {
    id: row.id,
    status: row.status == '启用' ? '暂停' : '启用',
    projectName: projectName.value,
  }

  void status(params).then((res) => {
    if (res?.code == 200) {
      // 参数2  用于关闭loading
      getpagelistApi(commonParams.value, true)
    }
  })
}

function editTagEvent(row: GroupRow) {
  // 参数1 分群类型
  // 参数2 模型规则
  const payload: CreateMethodPayload = { createIndex: filterLabel(row.createType), formula: row }
  bus.emit('$createMethod', payload)
}

// 删除事件
function deleteTagList(row: GroupRow) {
  ElMessageBox.confirm('是否确认删除？', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    cancelButtonClass: 'custom-cancel-button',
    type: 'warning',
  })
    .then(() => {
      return deleteApi({ id: row.id, projectName: projectName.value }).then(() => {
        ElMessage({
          message: '删除成功',
          type: 'success',
        })
        getpagelistApi(commonParams.value)
      })
    })
    .catch(() => undefined)
}

function returnTagsPagess() {
  // 与 v2 一致：列表页不消费分类树
}

function setTopFilterParams(val: Record<string, unknown>) {
  topFilterParams.value = copyObj(val)
}

function getIndex(index: number) {
  return (pageNum.value - 1) * pageSize.value + index + 1
}

function newAddTags() {
  rulesDialogRef.value?.openEvent()
}

function handleSizeChange(val: number) {
  pageNum.value = 1
  pageSize.value = val
  getpagelistApi(commonParams.value)
}

function handleCurrentChange(val: number) {
  pageNum.value = val
  getpagelistApi(commonParams.value)
}

watch(commonParams, (val) => {
  pageNum.value = 1
  getpagelistApi(val)
})
</script>

<template>
  <div style="height: calc(100vh - 50px); overflow-y: auto">
    <filterBar
      @set-top-filter-params="setTopFilterParams"
      @return-tags-pagess="returnTagsPagess"
    />

    <div class="public-block table_contain" style="border-radius: 6px">
      <div class="block_online block-main public-hoverItem" style="min-height: 300px">
        <div class="Head">
          <div class="public-firstHead">分群管理</div>
          <el-button class="zc_btn" @click="newAddTags">新建分群</el-button>
        </div>
        <!-- table -->
        <div style="min-height: 300px; overflow: hidden; margin: 30px 0">
          <el-table
            v-loading="refreshTagList"
            :header-cell-style="headerCellStyle"
            :cell-style="tableHeaderColor"
            class="public-radius"
            :data="tagPageList"
            :border="true"
          >
            <el-table-column
              fixed
              prop="date"
              label="序号"
              type="index"
              :width="proxy?.$fixedWidth.FwIndex"
            >
              <template #default="scope">
                <span v-text="getIndex(scope.$index)" />
              </template>
            </el-table-column>
            <el-table-column fixed prop="displayName" width="255" label="分群名称">
              <template #default="{ row }">
                <div style="cursor: pointer" @click="handleDetail(row)">
                  <div style="margin-bottom: 7px; color: #2c7be5">
                    {{ row.name }}
                  </div>
                  <div>{{ row.displayName }}</div>
                </div>
              </template>
            </el-table-column>
            <!-- <el-table-column prop="name" width="220" label="分群标识">
              <template #default="{ row }">
                <div
                  style="color: #2c7be5; cursor: pointer"
                  @click="handleDetail(row)"
                >
                  {{ row.name }}
                </div>
              </template>
            </el-table-column> -->

            <el-table-column prop="status" label="分群状态" width="140">
              <template #default="{ row }">
                <el-switch
                  v-model="row.isOpen"
                  @change="switchEvent(row)"
                  @mouseenter="showText(row)"
                  @mouseleave="hideText(row)"
                />
                <div v-if="row.showTextVisible" class="switch-text">
                  {{ row.isOpen ? '启用' : '暂停' }}
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="createType" width="160" label="创建方式" />
            <el-table-column label="更新方式" width="240">
              <template #default="{ row }">
                <div>
                  <div style="text-align: center">{{ row.updateType }}</div>
                  <div
                    v-if="row.updateType == '例行'"
                    style="display: flex; padding-top: 5px; justify-content: center; color: #2c7be5"
                  >
                    每{{ filterUpdataDate(row) }} {{ row.frequencyTime }}
                  </div>
                </div>
              </template>
            </el-table-column>
            <!-- <el-table-column prop="" label="限制人数返回数量">
              <template #default="{ row }">
                {{
                  row.returnUserLimitSetting
                    ? JSON.parse(row.returnUserLimitSetting).limit
                    : 0
                }}</template
              >
            </el-table-column> -->

            <el-table-column prop="matchUserCount" label="分群覆盖人数">
              <template #default="{ row }">
                <div style="color: #2c7be5; cursor: pointer" @click="handleDetail(row)">
                  {{ row.matchUserCount }}
                </div>
              </template>
            </el-table-column>
            <el-table-column
              prop="lastExecuteStatus"
              width="120"
              show-overflow-tooltip
              align="center"
              label="最新版本计算状态"
            />

            <el-table-column
              width="155"
              show-overflow-tooltip
              prop="lastExecuteEndTime"
              label="最新版本计算时间"
            >
              <template #default="{ row }">{{ formatDateHMS(row.lastExecuteEndTime) }}</template>
            </el-table-column>

            <el-table-column prop="createBy" label="创建人" width="120" />
            <el-table-column
              prop="createTime"
              sortable="custom"
              width="155"
              show-overflow-tooltip
              label="创建时间"
            >
              <template #default="{ row }">{{ formatDateHMS(row.createTime) }}</template>
            </el-table-column>
            <el-table-column
              prop="updateTime"
              width="155"
              show-overflow-tooltip
              label="修改时间"
            >
              <template #default="{ row }">{{ formatDateHMS(row.updateTime) }}</template>
            </el-table-column>
            <el-table-column fixed="right" prop="" width="150" label="操作">
              <template #default="{ row }">
                <div class="operate">
                  <el-icon v-if="row.creator" class="edit_btn" @click="editTagEvent(row)">
                    <Edit />
                  </el-icon>
                  <el-icon v-if="row.creator" class="delete_btn" @click="deleteTagList(row)">
                    <Delete />
                  </el-icon>
                  <el-popover placement="top-start" :width="200" trigger="hover" content="手动更新">
                    <!-- v-if="row.updateType != '例行'" -->
                    <template #reference>
                      <el-icon
                        v-if="row.creator"
                        class="play_btn"
                        style="margin-right: 0"
                        @click="refreshTagApi(row)"
                      >
                        <VideoPlay />
                      </el-icon>
                    </template>
                  </el-popover>
                  <el-icon v-if="!row.creator" class="edit_btn" @click="viewHandle(row)">
                    <View />
                  </el-icon>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </div>
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
    <rulesDialog ref="rulesDialogRef" />
    <groupDetailDialog ref="groupDetailDialogRef" />
  </div>
</template>

<style lang="scss" scoped>
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

// 分页样式 el-pagination 已在 src/styles/index.scss 全局引入（sass 不允许 @use 出现在嵌套块里）
:deep() {
  .el-table--border .is-scrolling-right + .el-table__fixed-right {
    padding-left: 1px;
  }

  // 固定右列时，左边的右边框消失得bug
  .el-table__row td:not(.is-hidden):last-child {
    right: -1px;
  }

  .el-table__header th:not(.is-hidden):last-child {
    border-left: 1px solid #ebeef5;
  }
}

.table_contain {
  .Head {
    display: flex;
    justify-content: space-between;
  }

  .operate {
    display: flex;
    justify-content: center;

    .edit_btn {
      width: 20px;
      height: 20px;
      line-height: 20px;
      border-radius: 2px;
      margin: 0 5px;
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
      margin: 0 5px;
      cursor: pointer;
    }

    // v2 是 .el-icon-video-play，v3 换成 @element-plus/icons-vue 后用类名 play_btn
    .play_btn {
      width: 20px;
      height: 20px;
      line-height: 20px;
      border-radius: 2px;
      background: #dbf3d4;
      color: #5ae568;
      margin: 0 5px;
      box-sizing: border-box;
      cursor: pointer;
    }

    .refresh_btn {
      width: 20px;
      height: 20px;
      line-height: 20px;
      border-radius: 2px;
      background: #dbf3d4;
      color: #5ae568;
      margin: 0 5px;
      cursor: pointer;
    }
  }
}
</style>
