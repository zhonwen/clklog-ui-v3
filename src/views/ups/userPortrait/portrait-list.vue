<script setup lang="ts">
/**
 * 用户群画像管理列表页（对应 v2 `views/ups/userPortrait/portrait-list.vue`）。
 *
 * v2 里未搬运的遗留成员：
 * - `returnStatus`：写成了带形参的 computed，Vue 里根本不会这样求值，且模板无引用；
 * - `switchEvent` / `filterLabel` / `showText` / `hideText`：模板里没有开关列，全无调用点；
 * - `downloadPDF` / `lodashDownload` / `someEventFunction` / `allowDownPdf` 及 pdfDownloading、
 *   notifyInstance：操作列里的「下载 PDF」在 v2 就是注释状态（listPdfDownload 组件本身也是空壳），
 *   整条链路没有入口，故不搬运；`listPdfDownload` 组件仍按 v2 渲染。
 */
import { computed, getCurrentInstance, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Delete, Edit, Setting, VideoPlay, View } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import editRuleDialog from './components/edit-rule-dialog.vue'
import filterBar from './components/filterBar.vue'
import listPdfDownload from './components/list-pdf-download.vue'
import rulesDialog from './rules-dialog.vue'
import type { PortraitRow } from './types'
import { getlistpage, portraitListDelete, portraitTagNow } from '@/api/upsapi/groupportrait'
import { copyObj } from '@/utils/copy'
import { formatDateHMS } from '@/utils/date'
import { useTrackingStore } from '@/stores/tracking'
import { useLatestOnly } from '@/composables/useLatestOnly'

const proxy = getCurrentInstance()?.proxy
const router = useRouter()
const trackingStore = useTrackingStore()
const { next, isLatest } = useLatestOnly()

const refreshTagList = ref(false)
const topFilterParams = ref<Record<string, unknown>>({})
const pageSize = ref(10)
const pageNum = ref(1)
const tagPageList = ref<PortraitRow[]>([])
const total = ref(0)

const rulesDialogRef = ref<InstanceType<typeof rulesDialog> | null>(null)
const editRuleDialogRef = ref<InstanceType<typeof editRuleDialog> | null>(null)

const projectName = computed(() => trackingStore.projectName)

const commonParams = computed<Record<string, unknown>>(() =>
  Object.assign({ projectName: projectName.value }, topFilterParams.value),
)

function getpagelistApi(newval: Record<string, unknown>, loadClose?: boolean) {
  if (!loadClose) {
    refreshTagList.value = true
  }
  const token = next()
  const pageIndex = pageNum.value
  const params = Object.assign({ pageSize: pageSize.value, pageIndex }, newval)
  getlistpage(params)
    .then((res) => {
      if (!isLatest(token)) return
      refreshTagList.value = false
      const data = res?.data as { rows?: PortraitRow[]; total?: number } | undefined
      tagPageList.value = data?.rows || []
      tagPageList.value.map((item) => {
        if (item.status && item.status == '启用') {
          item.isOpen = true
        } else {
          item.isOpen = false
        }
      })
      total.value = Number(data?.total || 0)
    })
    .catch(() => {
      if (!isLatest(token)) return
      refreshTagList.value = false
    })
}

watch(commonParams, (val) => {
  pageNum.value = 1
  getpagelistApi(val)
})

function filterUpdataDate(row: PortraitRow) {
  if (row.updateType == '例行') {
    if (row.frequencyValue) {
      const days = row.frequencyValue.split(',').map(Number)
      const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

      const result: string[] = []
      if (row.frequency === '周') {
        days.forEach((day) => {
          result.push(dayNames[day - 1] || '')
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
  // 与 v2 一致（v2 此处逻辑存疑：非「例行」时没有 return，模板上渲染为空）
  return undefined
}

// 更新编辑状态
function updatePageList() {
  getpagelistApi(commonParams.value)
}

function handleDetail(row: PortraitRow) {
  router.push({
    path: 'analyze',
    query: {
      id: row.id,
      projectName: row.projectName,
    },
  })
}

function editTagEvent(row: PortraitRow) {
  editRuleDialogRef.value?.openDialogEvent(row)
}

function refreshTagApi(row: PortraitRow) {
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
        description: '',
        frequency: '',
        frequencyValue: '',
        frequencyTime: '',
        updateType: '',
        createType: '',
        formula: '',
        projectName: '',
        id: '',
      }
      for (const key in row) {
        if (key in params) {
          params[key] = row[key] // 如果存在，则赋值
        }
      }
      portraitTagNow(params).then(() => {
        ElMessage.success('更新成功')
      })
    })
    .catch(() => {})
}

// 删除事件
function deleteTagList(row: PortraitRow) {
  ElMessageBox.confirm('是否确认删除？', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    cancelButtonClass: 'custom-cancel-button',
    type: 'warning',
  })
    .then(() => {
      return portraitListDelete({ id: row.id, projectName: projectName.value }).then(() => {
        ElMessage({ message: '删除成功', type: 'success' })
        getpagelistApi(commonParams.value)
      })
    })
    .catch(() => {})
}

/** v2 的函数体全是注释，保留空实现以对齐 filterBar 的 @returnTagsPagess */
function returnTagsPagess() {}

function setTopFilterParams(val: Record<string, string>) {
  topFilterParams.value = copyObj(val)
}

function getIndex($index: number) {
  return (pageNum.value - 1) * pageSize.value + $index + 1
}

/**
 * 第 2 列（群画像名称）左对齐，其余居中。
 * v2 返回的是 "text-align:left" 字符串，element-plus 会对返回值做 Object.assign，
 * 字符串会被展开成 {0:'t',1:'e'...} 并报 Failed to set an indexed property on CSSStyleDeclaration，
 * 所以这里返回等价的对象。
 */
function tableHeaderColor({ columnIndex }: { columnIndex: number }) {
  if (columnIndex === 1) {
    return { textAlign: 'left' as const }
  } else {
    return { textAlign: 'center' as const }
  }
}

function addGroupPortrait() {
  rulesDialogRef.value?.openDialogEvent()
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
</script>

<template>
  <div style="position: relative; height: 100%; min-height: calc(100vh - 70px)">
    <!-- 列表页下载PDF -->
    <listPdfDownload />

    <filterBar
      @set-top-filter-params="setTopFilterParams"
      @return-tags-pagess="returnTagsPagess"
    />

    <div class="public-block table_contain" style="border-radius: 6px">
      <div class="block_online block-main public-hoverItem" style="min-height: 300px">
        <div class="Head">
          <div class="public-firstHead">用户群画像管理</div>
          <el-button class="zc_btn" @click="addGroupPortrait">新增群画像</el-button>
        </div>
        <!-- table -->
        <div style="min-height: 300px; overflow-x: auto; margin: 30px 0">
          <el-table
            v-loading="refreshTagList"
            :header-cell-style="{ textAlign: 'center', background: '#f7fafe  ' }"
            :cell-style="tableHeaderColor"
            class="public-radius"
            :data="tagPageList"
            :border="true"
          >
            <el-table-column
              prop="date"
              label="序号"
              fixed
              type="index"
              :width="proxy?.$fixedWidth.FwIndex"
            >
              <template #default="scope">
                <span v-text="getIndex(scope.$index)"> </span>
              </template>
            </el-table-column>
            <el-table-column
              fixed
              prop="name"
              :width="proxy?.$fixedWidth.FwDisplayName"
              label="群画像名称"
            >
              <template #default="{ row }">
                <div style="color: #2c7be5; cursor: pointer" @click="handleDetail(row)">
                  {{ row.displayName }}
                </div>
              </template>
            </el-table-column>

            <el-table-column label="更新方式" :width="proxy?.$fixedWidth.FwOperation">
              <template #default="{ row }">
                <div>
                  <div style="text-align: center">
                    {{ row.updateType || '手动' }}
                  </div>
                  <div
                    v-if="row.updateType == '例行'"
                    style="display: flex; padding-top: 5px; justify-content: center; color: #2c7be5"
                  >
                    每{{ filterUpdataDate(row) }} {{ row.frequencyTime }}
                  </div>
                </div>
              </template>
            </el-table-column>

            <el-table-column
              prop="lastExecuteStartTime"
              label="最新版本计算时间"
              :width="proxy?.$fixedWidth.FwTime"
            >
              <template #default="{ row }">{{ formatDateHMS(row.lastExecuteStartTime) }}</template>
            </el-table-column>

            <el-table-column
              prop="lastExecuteStartTime"
              label="创建时间"
              :width="proxy?.$fixedWidth.FwTime"
              show-overflow-tooltip
            >
              <template #default="{ row }">{{ formatDateHMS(row.createTime) }}</template>
            </el-table-column>
            <el-table-column
              prop="updateTime"
              label="更新时间"
              :width="proxy?.$fixedWidth.FwTime"
              show-overflow-tooltip
            >
              <template #default="{ row }">{{ formatDateHMS(row.updateTime) }}</template>
            </el-table-column>
            <el-table-column prop="createBy" label="创建人" />
            <el-table-column
              fixed="right"
              prop=""
              :width="proxy?.$fixedWidth.FwOperation"
              label="操作"
            >
              <template #default="{ row }">
                <div v-if="row.creator" class="operate">
                  <el-icon class="el-icon-edit btn_common" @click="handleDetail(row)">
                    <Edit />
                  </el-icon>
                  <el-popover
                    placement="top-start"
                    :width="200"
                    trigger="hover"
                    content="更新规则设置"
                  >
                    <template #reference>
                      <el-icon class="el-icon-setting btn_common" @click="editTagEvent(row)">
                        <Setting />
                      </el-icon>
                    </template>
                  </el-popover>
                  <el-icon class="el-icon-delete btn_common" @click="deleteTagList(row)">
                    <Delete />
                  </el-icon>
                  <el-popover placement="top-start" :width="200" trigger="hover" content="手动更新">
                    <template #reference>
                      <el-icon
                        class="el-icon-video-play btn_common"
                        style="margin-right: 0"
                        @click="refreshTagApi(row)"
                      >
                        <VideoPlay />
                      </el-icon>
                    </template>
                  </el-popover>
                </div>
                <div v-else class="operate" style="display: flex; justify-content: flex-start">
                  <el-icon
                    class="el-icon-view btn_common"
                    style="margin-right: 0"
                    @click="handleDetail(row)"
                  >
                    <View />
                  </el-icon>
                </div>
                <!-- <div
                  style="
                    line-height: 20px;
                    color: #2c7be5;
                    margin-top: 7px;
                    font-size: 13px;
                    cursor: pointer;
                  "
                  @click="downloadPDF(row)"
                >
                  下载 PDF
                </div> -->
              </template>
            </el-table-column>
          </el-table>
        </div>
        <el-pagination
          next-text="下一页"
          :current-page="pageNum"
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
    <editRuleDialog ref="editRuleDialogRef" @update-page-list="updatePageList" />
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

.table_contain {
  .Head {
    display: flex;
    justify-content: space-between;
  }

  .operate {
    display: flex;
    justify-content: flex-start;

    .btn_common {
      width: 20px;
      height: 20px;
      line-height: 20px;
      border-radius: 2px;
      margin-right: 15px;
      cursor: pointer;
    }

    .el-icon-edit {
      background: #dde4ed;
      color: #2c7be5;
    }

    .el-icon-setting {
      background: #c1e2df;
      color: #4da1ba;
    }

    .el-icon-delete {
      background: #f3e2d0;
      color: #de6210;
    }

    .el-icon-video-play {
      background: #dbf3d4;
      color: #5ae568;
    }

    .el-icon-view {
      background: #dde4ed;
      color: #2c7be5;
    }
  }
}
</style>
