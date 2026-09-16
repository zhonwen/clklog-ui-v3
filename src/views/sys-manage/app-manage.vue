<script setup lang="ts">
import { getCurrentInstance, onMounted, ref } from 'vue'
import type { CSSProperties } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { Delete, Edit, Lock, Plus, Unlock } from '@element-plus/icons-vue'
import {
  addApp,
  deleteApp,
  editApp,
  getApp,
  getAppList,
  getAppMyList,
} from '@/api/sysmanage/appmanage'
import type { AppDetail, AppRow } from '@/api/sysmanage/appmanage'
import type { ProjectItem } from '@/types/app'
import { getLocalStorage } from '@/utils/localStorage'
import { useLatestOnly } from '@/composables/useLatestOnly'
import { useTrackingStore } from '@/stores/tracking'
import DialogPage from './component/dialog.vue'

/** 表单用 type 而不是 interface：需要能直接当 Record<string, unknown> 传给请求层 */
type AppForm = AppDetail

const proxy = getCurrentInstance()?.proxy
const trackingStore = useTrackingStore()
const { next: nextList, isLatest: isLatestList } = useLatestOnly()
const { next: nextDetail, isLatest: isLatestDetail } = useLatestOnly()

const formRef = ref<FormInstance>()
const dialogPageRef = ref<{ dialogEvent: () => void } | null>(null)

const form = ref<AppForm>({
  id: '',
  projectDisplayName: '',
  projectName: '',
  excludedIp: '',
  excludedUa: '',
  excludedUrlParams: '',
  searchwordKey: '',
  searchwordCategoryKey: '',
  rootUrls: '',
})
const queryParams = ref<{ pageNum: number; pageSize: number }>({
  pageNum: 1,
  pageSize: 10,
})
const rules: FormRules = {
  projectDisplayName: [{ required: true, message: '项目名称不能为空', trigger: 'blur' }],
  projectName: [{ required: true, message: '项目编码不能为空', trigger: 'blur' }],
}
const centerDialogVisible = ref(false)
const appList = ref<AppRow[]>([])
const total = ref(0)
const title = ref('')

function updateProjectList(): Promise<ProjectItem[]> {
  return getAppMyList().then((res) => {
    let projectArray: ProjectItem[] = []
    if (res?.data) {
      projectArray = res.data
      // v2 里先 dispatch('tracking/setProjectArray')，再 localStorage.setItem('projectList')；
      // v3 的 setProjectArray 内部已经写了同一份 localStorage，所以这里只调一次
      trackingStore.setProjectArray(projectArray)
    }
    return projectArray
  })
}

function openDialogEvent() {
  dialogPageRef.value?.dialogEvent()
}

function headerCellStyle({ columnIndex }: { columnIndex: number }): CSSProperties {
  // 判断是否是第一个表头单元格
  // 必须返回对象：element-plus 会对返回值做 Object.assign，返回字符串会被拆成 {0:'t',1:'e'...}
  if (columnIndex === 1) {
    return {
      backgroundColor: '#f7fafe',
      paddingLeft: '20px',
      textAlign: 'left',
    }
  } else {
    return {
      backgroundColor: '#f7fafe',
      textAlign: 'center',
    }
  }
}

function getIndex($index: number) {
  return (queryParams.value.pageNum - 1) * queryParams.value.pageSize + $index + 1
}

function getList() {
  const token = nextList()
  getAppList({ ...queryParams.value })
    .then((response) => {
      if (!isLatestList(token)) return
      if (response?.data) {
        appList.value = response.data.rows || []
        total.value = Number(response.data.total || 0)
      }
    })
    .catch(() => {
      if (!isLatestList(token)) return
      /* 报错已由请求层统一提示 */
    })
}

async function submitSaveForm() {
  if (window.globalConfig.is_clklog_demo_environment) {
    return openDialogEvent()
  }
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  const params = { ...form.value }
  if (form.value.id) {
    void editApp(params).then(() => {
      ElMessage({ message: '保存成功', type: 'success', duration: 2000 })
      void updateProjectList()
      getList()
      centerDialogVisible.value = false
    })
  } else {
    void addApp(params).then(() => {
      ElMessage({ message: '保存成功', type: 'success', duration: 2000 })
      void updateProjectList()
      getList()
      centerDialogVisible.value = false
    })
  }
}

function handleSizeChange(val: number) {
  queryParams.value.pageSize = val
  getList()
}

function handleCurrentChange(val: number) {
  queryParams.value.pageNum = val
  getList()
}

function reset() {
  form.value = {
    id: undefined,
    projectName: undefined,
    projectDisplayName: undefined,
    excludedIp: undefined,
    excludedUa: undefined,
    excludedUrlParams: undefined,
    searchwordCategoryKey: undefined,
    rootUrls: undefined,
    searchwordKey: undefined,
  }
}

function addAppEvent() {
  reset()
  centerDialogVisible.value = true
  title.value = '新增项目'
}

function handleUpdate(row: AppRow) {
  reset()
  const appId = row.id
  const token = nextDetail()
  void getApp({ id: appId })
    .then((response) => {
      if (!isLatestDetail(token)) return
      form.value = response?.data || {}
      centerDialogVisible.value = true
      title.value = '修改项目'
    })
    .catch(() => {
      if (!isLatestDetail(token)) return
      /* 报错已由请求层统一提示 */
    })
}

function handleDelete(row: AppRow) {
  if (window.globalConfig.is_clklog_demo_environment) {
    return openDialogEvent()
  }
  const appId = row.id
  const deletedProjectName = row.projectName
  void ElMessageBox.confirm('是否确认删除？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    cancelButtonClass: 'custom-cancel-button',
    type: 'warning',
  })
    .then(() => {
      return deleteApp({ id: appId })
    })
    .then(async () => {
      // 删掉的是当前正在看的项目时，刷新项目列表并切到第一个项目；否则只刷新列表
      const currentProject = getLocalStorage<string>('prejectCode')
      if (currentProject && deletedProjectName && currentProject === deletedProjectName) {
        const projectArray = await updateProjectList()
        if (Array.isArray(projectArray) && projectArray.length > 0) {
          const newProjectName = projectArray[0]?.projectName
          if (newProjectName) {
            trackingStore.setProject(newProjectName)
          }
        }
        return
      }
      await updateProjectList()
    })
    .then(() => {
      getList()
      ElMessage({ message: '删除成功', type: 'success' })
    })
    .catch(() => {
      // v2 这条链路没有 catch：点「取消」时 ElMessageBox 抛 'cancel'，控制台会留一条未处理的 rejection
    })
}

/** 掩码串，长度与 v2 模板里写死的星号完全一致（52 个 *） */
const TOKEN_MASK = '****************************************************'
const showTokenMap = ref<Record<string, boolean>>({})

function tokenText(row: AppRow) {
  const key = row.projectName
  return key && showTokenMap.value[key] ? row.token || '' : TOKEN_MASK
}

/**
 * Token 的明文/掩码切换。
 * v2 是直接 document.getElementById 改 innerHTML、并把图标的 class 在
 * el-icon-lock / el-icon-unlock 之间换；EP2 已经没有这套字体图标类，
 * 所以改成等价的数据驱动实现（掩码 <-> 明文、锁 <-> 开锁，表现与 v2 一致）。
 */
function setPassword(row: AppRow) {
  const key = row.projectName
  if (!key) return
  showTokenMap.value = { ...showTokenMap.value, [key]: !showTokenMap.value[key] }
}

onMounted(() => {
  getList()
})
</script>

<template>
  <div class="public-block">
    <div class="Overview public-hoverItem" style="padding: 25px">
      <div class="public-firstHead">项目设置</div>
      <br />
      <el-button class="addProject" @click="addAppEvent">
        <el-icon><Plus /></el-icon>新建项目
      </el-button>
      <br />
      <el-table
        border
        :data="appList"
        :header-cell-style="headerCellStyle"
        class="public-radius"
        :cell-style="{ textAlign: 'center' }"
        style="width: 100%; min-height: 500px"
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
        <el-table-column label="项目信息">
          <template #default="scope">
            <div class="app-table">
              <div style="text-align: left">
                <p>
                  <label style="font-weight: 400">项目名称</label>：&nbsp;{{
                    scope.row.projectDisplayName
                  }}
                </p>
                <p>
                  <label style="font-weight: 400">项目编码</label>：&nbsp;{{
                    scope.row.projectName
                  }}
                </p>
                <div style="display: flex; white-space: nowrap">
                  <label style="font-weight: 400">Token&nbsp;</label>：
                  <div style="min-width: 300px">
                    <span :id="'hide' + scope.row.projectName">{{ tokenText(scope.row) }}</span>
                  </div>

                  <el-icon
                    :id="'i' + scope.row.projectName"
                    class="icon-style"
                    style="cursor: pointer"
                    @click="setPassword(scope.row)"
                  >
                    <Unlock v-if="scope.row.projectName && showTokenMap[scope.row.projectName]" />
                    <Lock v-else />
                  </el-icon>
                </div>
              </div>

              <div style="text-align: left">
                <p>创建时间：&nbsp;{{ scope.row.createTime }}</p>
                <p>修改时间：&nbsp;{{ scope.row.updateTime }}</p>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="操作" align="left" width="230">
          <template #default="scope">
            <div style="display: flex; justify-content: center">
              <el-icon class="edit_btn" @click="handleUpdate(scope.row)"><Edit /></el-icon>
              <el-icon class="delete_btn" @click="handleDelete(scope.row)"><Delete /></el-icon>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <div class="block">
        <el-pagination
          v-model:current-page="queryParams.pageNum"
          :page-sizes="[10, 20, 30, 40]"
          :page-size="queryParams.pageSize"
          layout="total,sizes, prev, pager, next, jumper"
          :total="total"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </div>
    <el-dialog
      v-model="centerDialogVisible"
      :modal-append-to-body="false"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      width="80%"
      top="5vh"
      :title="title"
    >
      <el-form ref="formRef" :model="form" size="small" :rules="rules">
        <el-row>
          <el-col :span="11">
            <div class="gm-left-header">
              <el-form-item
                label="项目名称"
                prop="projectDisplayName"
                class="gp-item-01"
                size="default"
              >
                <el-input
                  v-model="form.projectDisplayName"
                  class="gm-input-01"
                  placeholder="请输入项目名称"
                />
              </el-form-item>
            </div>
          </el-col>
          <el-col :span="13">&nbsp;</el-col>
        </el-row>
        <el-row>
          <el-col :span="11">
            <div class="gm-left-header">
              <el-form-item
                label="项目编码"
                style="font-weight: 400"
                prop="projectName"
                class="gp-item-01"
              >
                <el-input
                  v-model="form.projectName"
                  class="gm-input-01"
                  placeholder="请输入项目编码"
                />
              </el-form-item>
            </div>
          </el-col>
          <el-col :span="13"> </el-col>
        </el-row>
        <!-- 新增域名 -->
        <el-row>
          <el-col :span="11">
            <div class="gm-left-header">
              <p class="gm-h1">项目访问域名</p>
              <p class="gm-h2">请输入访问该项目的所有域名</p>

              <el-form-item prop="rootUrls" class="gp-item-01">
                <el-input
                  v-model="form.rootUrls"
                  type="textarea"
                  :rows="3"
                  class="gm-input-01"
                  placeholder=""
                />
              </el-form-item>
            </div>
          </el-col>
          <el-col :span="13">
            <div class="gm-right">
              <div class="gm-right-prompt">
                该配置用于受访页面结构化统计分析的数据展示配置，如果是WEB项目埋点必须配置该项，否则无法正常加载结构化受访页面访问统计相关数据。<br /><br />
                请输入访问该项目的所有域名(每行一个)。需包含http或https,例如:https:/kwww.a.com,http:/192.168.1.10。
              </div>
            </div>
          </el-col>
        </el-row>
        <!-- end -->

        <el-row>
          <el-col :span="11">
            <div class="gm-left-header">
              <p class="gm-h1">排除的IP地址</p>
              <p class="gm-h2">以下IP地址将被排除在本项目统计数据外。</p>

              <el-form-item prop="excludedIp" class="gp-item-01">
                <el-input
                  v-model="form.excludedIp"
                  type="textarea"
                  :rows="3"
                  class="gm-input-01"
                  placeholder=""
                />
              </el-form-item>
            </div>
          </el-col>
          <el-col :span="13">
            <div class="gm-right">
              <div class="gm-right-prompt">
                输入您要排除在系统统计之外的IP列表(每行一个)。您可以使用CIDR表示法,例如1.2.3.4/24,也可以使用通配符,例如1.2.3.*或1.2.*.*。
                <br /><br />
                <!-- 您的IP位址是 -->
              </div>
            </div>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="11">
            <div class="gm-left-header">
              <p class="gm-h1">排除的用户代理列表</p>
              <p class="gm-h2">以下用户代理将被排除在本项目统计外。</p>

              <el-form-item prop="excludedUa" class="gp-item-01">
                <el-input
                  v-model="form.excludedUa"
                  type="textarea"
                  :rows="3"
                  class="gm-input-01"
                  placeholder=""
                />
              </el-form-item>
            </div>
          </el-col>
          <el-col :span="13">
            <div class="gm-right">
              <div class="gm-right-prompt">
                输入不需要加入系统统计的用户代理列表 (每行一个)，支持正则表达式。
                如果访客的用户代理字串包含指定的字符，访问将不被 统计。 <br /><br />您可以用它排除统计机器人。例如/bot
                spiderlcrawlscanner/i。
              </div>
            </div>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="11">
            <div class="gm-left-header">
              <p class="gm-h1">排除的URL参数列表</p>
              <p class="gm-h2">以下URL参数将从本项目的受访页面分析统计中排除。</p>

              <el-form-item prop="excludedUrlParams" class="gp-item-01">
                <el-input
                  v-model="form.excludedUrlParams"
                  type="textarea"
                  :rows="3"
                  class="gm-input-01"
                  placeholder=""
                />
              </el-form-item>
            </div>
          </el-col>
          <el-col :span="13">
            <div class="gm-right">
              <div class="gm-right-prompt">
                输入要排除的URL查询参数列表
                (每行一个)，以便从受访页面分析报告中排除因无效参数产生的页面。支持普通参数、正则表达式。
              </div>
            </div>
          </el-col>
        </el-row>
        <el-row>
          <el-col :span="11">
            <div class="gm-left-header">
              <p class="gm-h1">站内搜索关键词参数</p>
              <p class="gm-h2">以下参数将作为本项目的站内搜索关键词参数。</p>

              <el-form-item prop="searchwordKey" class="gp-item-01">
                <el-input
                  v-model="form.searchwordKey"
                  type="textarea"
                  :rows="3"
                  class="gm-input-01"
                  placeholder=""
                />
              </el-form-item>
            </div>
          </el-col>
          <el-col :span="13">
            <div class="gm-right">
              <div class="gm-right-prompt">
                该配置作为WEB项目站内搜索的搜索词提取依据，配置该项后，站内搜索才会有相关数据的统计。<br /><br />
                输入用逗号分开的包含站内搜索关键字的所有搜索参数名称的列表。
              </div>
            </div>
          </el-col>
        </el-row>
        <!-- v2 此处注释掉了「站内搜索关键词分类参数」一栏，保持一致不迁移 -->
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-row>
            <el-col :span="20">&nbsp;&nbsp;</el-col>
            <el-col :span="4">
              <el-button type="primary" @click="submitSaveForm">保存</el-button>
            </el-col>
          </el-row>
        </div>
      </template>
    </el-dialog>

    <DialogPage ref="dialogPageRef" />
  </div>
</template>

<style lang="scss" scoped>
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

.addProject.el-button {
  color: #2c7be5;
  border: 1px solid #2c7be5;
  margin-bottom: 25px;
}

// 分页样式 el-pagination 已在 src/styles/index.scss 全局引入（sass 不允许 @use 出现在嵌套块里）
:deep() {
  .el-form-item.is-error .el-input__inner,
  .el-form-item.is-error .el-input__inner:focus,
  .el-form-item.is-error .el-textarea__inner,
  .el-form-item.is-error .el-textarea__inner:focus {
    border-color: #fff;
    border-bottom: 1px solid #ff4949;
  }

  .el-form-item__label {
    font-weight: 400;
  }

  .el-dialog {
    border-radius: 6px;
  }

  .el-dialog__footer {
    text-align: left;
    margin-left: 30px;
  }

  .el-textarea__inner {
    border: 1px solid #fff;
    border-bottom: 1px solid #dcdfe6;
  }

  .el-textarea__inner {
    resize: none;
  }

  .el-input__inner {
    border: 1px solid #fff;
    border-bottom: 1px solid #dcdfe6;
  }
}

.gm {
  width: 100%;
}

.gm li {
  float: left;
  width: 100%;
}

.gm-left-header {
  width: 100%;
  padding-left: 20px;
  font-weight: 400px !important;
}

.gm-right {
  width: 100%;
  margin-left: 20px;
}

.gm-h1 {
  font-size: 14px;
  color: #606266;
}

.gm-h2 {
  font-size: 13px;
  color: #888;
  padding-left: 5px;
}

.gm-right-prompt {
  font-size: 13px;
  background-color: #f7f9fe;
  padding: 10px;
  color: #808080;
  margin-right: 20px;
  position: absolute;
  bottom: 10px;
  line-height: 28px;
}

.gm-input-01 {
  border: none !important;
  border-bottom: 1px solid #aaa;
}

.gp-item-01 {
  font-weight: 400px !important;
  width: 100%;
}

.gp-item-01 .el-form-item__content {
  width: 100%;
}

.gm-input-01 textarea {
  border: none !important;
}

.el-form-item__label {
  font-size: 20px;
}

.app-table {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 50px;
  width: 100%;
  border: none;
  color: #888;
}

.app-table tr td {
  border: none;
  padding: 0 20px;
}

.app-table .app-table-left {
  width: 45%;
}

.app-table-left span {
  display: inline-block;
}

.app-table-left label {
  color: #888;
  width: 70px !important;
  display: inline-block;
}
</style>
