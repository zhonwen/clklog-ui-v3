<script setup lang="ts">
/**
 * 标签列表页（对应 v2 src/views/ups/userTag/tag-list.vue）。
 *
 * element-plus 适配要点：
 *   slot-scope / slot="reference"          → #default / <template #reference>
 *   :current-page                          → v-model:current-page
 *   el-icon-xxx                            → @element-plus/icons-vue 组件
 *   过滤器 | filterText / | formatDateHMS   → 直接调 utils 函数
 *   cell-style 回调必须返回**对象**（返回字符串会被 element-plus Object.assign 展开成
 *   {0:'t',1:'e',...}，抛 Failed to set an indexed property 并打断整条路由导航）
 */
import { computed, onBeforeUnmount, onMounted, ref, watch, getCurrentInstance } from 'vue'
import type { CSSProperties } from 'vue'
import { Delete, Edit, VideoPlay, View } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import filterBar from './components/filterBar.vue'
import rulesDialog from './components/rulesDialog.vue'
import tagDetailDialog from './components/tag-detail-dialog.vue'
import { getlistpage, tagDelete, tagstatus, tagNow } from '@/api/upsapi/tagmanage'
import { copyObj } from '@/utils/copy'
import { bus } from '@/utils/event-bus'
import { useTrackingStore } from '@/stores/tracking'
import { useLatestOnly } from '@/composables/useLatestOnly'
import { filterText } from '@/utils/format'
import { formatDateHMS } from '@/utils/date'
import { CATEGORY_LIST, CREATE_METHOD, type CreateMethodPayload } from './bus-events'
import { tagLabelIndex } from '@/utils/modelOptions/up-manage'
import type { CategoryNode, TagFormula } from './types'

const proxy = getCurrentInstance()?.proxy
const trackingStore = useTrackingStore()
const { next, isLatest } = useLatestOnly()

const refreshTagList = ref(false)
const topFilterParams = ref<Record<string, string>>({})
const pageSize = ref(10)
const pageNum = ref(1)
const tagPageList = ref<TagFormula[]>([])
const total = ref(0)
const categoryList = ref<CategoryNode[]>([])

const rulesDialogRef = ref<InstanceType<typeof rulesDialog> | null>(null)
const tagDetailDialogRef = ref<InstanceType<typeof tagDetailDialog> | null>(null)

const projectName = computed(() => trackingStore.projectName)

const commonParams = computed<Record<string, string>>(() =>
  Object.assign({ projectName: projectName.value }, topFilterParams.value),
)

function filterUpdataDate(row: TagFormula) {
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

/**
 * 必须返回对象；v2 返回的是 'text-align:left' 字符串。
 * 返回值显式标成 CSSProperties，否则字面量会被推断成 { textAlign: string }，
 * 和 element-plus 的 CellStyle 对不上。
 */
function tableHeaderColor({ columnIndex }: { columnIndex: number }): CSSProperties {
  if (columnIndex === 1) {
    return { textAlign: 'left' }
  } else {
    return { textAlign: 'center' }
  }
}

function emitCreateMethod(row: TagFormula) {
  const payload: CreateMethodPayload = {
    // 参数1 标签类型；参数2 模型规则
    createIndex: tagLabelIndex(row.createType),
    formula: row,
  }
  bus.emit(CREATE_METHOD, payload)
}

function viewHandle(row: TagFormula) {
  emitCreateMethod(row)
}

function editTagEvent(row: TagFormula) {
  emitCreateMethod(row)
}

function filterCategoryId(categoryId?: string | number | null) {
  let tagType = ''
  for (let i = 0; i < categoryList.value.length; i++) {
    if (categoryList.value[i]?.id == categoryId) {
      tagType = categoryList.value[i]?.name ?? ''
      break
    }
  }
  if (tagType) {
    return tagType
  }
  return undefined
}

function handleDetail(row: TagFormula) {
  tagDetailDialogRef.value?.openDialogEvent(row)
}

function showText(row: TagFormula) {
  row.showTextVisible = true
}

function hideText(row: TagFormula) {
  row.showTextVisible = false
}

function switchEvent(row: TagFormula) {
  const params = {
    id: row.id,
    status: row.status == '启用' ? '暂停' : '启用',
    projectName: projectName.value,
  }

  void tagstatus(params).then((res) => {
    if (res?.code == 200) {
      // 参数2  用于关闭loading
      getpagelistApi(commonParams.value, true)
    }
  })
}

function refreshTagApi(row: TagFormula) {
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
      void tagNow(params).then(() => {
        getpagelistApi(commonParams.value)
        ElMessage.success('更新成功')
      })
    })
    .catch(() => undefined)
}

// 删除事件
function deleteTagList(row: TagFormula) {
  ElMessageBox.confirm('是否确认删除？', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    cancelButtonClass: 'custom-cancel-button',
    type: 'warning',
  })
    .then(() => {
      return tagDelete({ id: row.id, projectName: projectName.value }).then(() => {
        ElMessage({
          message: '删除成功',
          type: 'success',
        })
        // 重新调用
        getpagelistApi(commonParams.value)
      })
    })
    .catch(() => undefined)
}

// 与 v2 一致：filterBar 会 emit 分类树，但列表页并不使用
function returnTagsPagess() {}

function setTopFilterParams(val: Record<string, string>) {
  topFilterParams.value = copyObj(val)
}

interface TagPageResult {
  rows?: TagFormula[]
  total?: number
}

function getpagelistApi(newval: Record<string, string>, loadClose?: boolean) {
  if (!loadClose) {
    refreshTagList.value = true
  }

  const pageIndex = pageNum.value
  const params = Object.assign({ pageSize: pageSize.value, pageIndex }, newval)
  const token = next()
  getlistpage<TagPageResult>(params)
    .then((res) => {
      if (!isLatest(token)) return
      refreshTagList.value = false
      const rows = res?.data?.rows || []
      tagPageList.value = rows
      tagPageList.value.map((item) => {
        if (item.status && item.status == '启用') {
          item.isOpen = true
        } else {
          item.isOpen = false
        }
      })
      total.value = res?.data?.total || 0
    })
    .catch(() => {
      if (!isLatest(token)) return
      refreshTagList.value = false
    })
}

function getIndex($index: number) {
  return (pageNum.value - 1) * pageSize.value + $index + 1
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

function onCategoryList(res: unknown) {
  categoryList.value = res as CategoryNode[]
}

watch(commonParams, (val) => {
  pageNum.value = 1
  getpagelistApi(val)
})

onMounted(() => {
  bus.on(CATEGORY_LIST, onCategoryList)
})

onBeforeUnmount(() => {
  bus.off(CATEGORY_LIST, onCategoryList)
})
</script>

<template>
  <div style="height: calc(100vh - 50px); overflow-y: auto">
    <filterBar
      @set-top-filter-params="setTopFilterParams"
      @return-tags-pagess="returnTagsPagess"
    ></filterBar>

    <div class="public-block table_contain" style="border-radius: 6px">
      <div class="block_online block-main public-hoverItem" style="min-height: 300px">
        <div class="Head">
          <div class="public-firstHead">标签管理</div>
          <el-button class="zc_btn" @click="newAddTags">新建标签</el-button>
        </div>
        <!-- table -->
        <div style="min-height: 300px; overflow: hidden; margin: 30px 0">
          <el-table
            v-loading="refreshTagList"
            :header-cell-style="{
              textAlign: 'center',
              background: '#f7fafe  ',
            }"
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
                <span v-text="getIndex(scope.$index)"> </span>
              </template>
            </el-table-column>
            <el-table-column fixed prop="displayName" width="255" label="标签名称">
              <template #default="{ row }">
                <div style="cursor: pointer" @click="handleDetail(row)">
                  <div style="margin-bottom: 7px; color: #2c7be5">{{ row.name }}</div>
                  <div>{{ row.displayName }}</div>
                </div>
              </template>
            </el-table-column>
            <!-- <el-table-column prop="name" width="220" label="标签标识">
              <template #default="{ row }">
                <div
                  @click="handleDetail(row)"
                  style="color: #2c7be5; cursor: pointer"
                >
                  {{ row.name }}
                </div>
              </template>
            </el-table-column> -->

            <el-table-column prop="status" label="标签状态" width="140">
              <template #default="{ row }">
                <el-switch
                  v-model="row.isOpen"
                  @change="switchEvent(row)"
                  @mouseenter="showText(row)"
                  @mouseleave="hideText(row)"
                >
                  <!-- active-text="启用"
                inactive-text="暂停" -->
                </el-switch>
                <div v-if="row.showTextVisible" class="switch-text">
                  {{ row.isOpen ? '启用' : '暂停' }}
                </div>
              </template>
            </el-table-column>
            <el-table-column prop="categoryId" width="140" label="标签分类" show-overflow-tooltip>
              <template #default="{ row }">
                {{ filterCategoryId(row.categoryId) }}
              </template>
            </el-table-column>
            <el-table-column prop="createType" width="160" label="创建方式"> </el-table-column>
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
            <el-table-column prop="valueType" label="标签类型" width="120">
              <template #default="{ row }">{{ filterText(row.valueType) }}</template>
            </el-table-column>

            <el-table-column prop="matchUserCount" label="标签覆盖人数">
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
            >
            </el-table-column>
            <el-table-column
              width="155"
              show-overflow-tooltip
              prop="lastExecuteEndTime"
              label="最新版本计算时间"
            >
              <template #default="{ row }">{{ formatDateHMS(row.lastExecuteEndTime) }}</template>
            </el-table-column>

            <el-table-column prop="createBy" label="创建人" width="120"> </el-table-column>
            <el-table-column sortable="custom" label="创建时间" width="155" show-overflow-tooltip>
              <template #default="{ row }">
                {{ formatDateHMS(row.createTime) }}
              </template>
            </el-table-column>
            <el-table-column prop="updateTime" show-overflow-tooltip width="155" label="修改时间">
              <template #default="{ row }">
                {{ formatDateHMS(row.updateTime) }}
              </template>
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
                    <template #reference>
                      <!-- 图标换成了 @element-plus/icons-vue 组件，但类名沿用 v2 的
                           el-icon-video-play，样式规则才不用动 -->
                      <el-icon
                        v-if="row.creator"
                        class="el-icon-video-play"
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
    <rulesDialog ref="rulesDialogRef"></rulesDialog>
    <tag-detail-dialog ref="tagDetailDialogRef"></tag-detail-dialog>
  </div>
</template>

<style lang="scss" scoped>
// v2 这里是在 ::v-deep {} 里 @import el-pagination.scss，v3 已在 styles/index.scss 全局引入，不再重复引
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

:deep(.el-table--border .is-scrolling-right + .el-table__fixed-right) {
  padding-left: 1px;
}

// 固定右列时，左边的右边框消失得bug
:deep(.el-table__row td:not(.is-hidden):last-child) {
  right: -1px;
}

:deep(.el-table__header th:not(.is-hidden):last-child) {
  border-left: 1px solid #ebeef5;
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
      // margin-left: 20px;
      margin: 0 5px;
      cursor: pointer;
    }

    .el-icon-video-play {
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
