<script setup lang="ts">
/**
 * 用户复查（对应 v2 views/user-behavior/userReview/list.vue）。
 *
 * 与 v2 一致（v2 此处逻辑存疑，以下都是没被用到的死代码，这里不再搬运）：
 *   - methods 里的 getUserListNew（和 fetchList 重复，没有任何地方调它）
 *   - changeMode 里唯一的一行代码是注释掉的
 *   - fixAriaHiddenOnRadios / __onFocusIn：给 aria-hidden 的原生 radio 打补丁，
 *     element-plus 的 el-radio 不再渲染 aria-hidden="true" 的原生 input，这套补丁没有作用
 * 高级筛选（advanced）那一支在 v2 里整段被注释掉，这里同样保留为注释。
 */
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, RefreshRight } from '@element-plus/icons-vue'
import { getUserListNewApi } from '@/api/trackingapi/userreview'
import { getUserPageListNewApi, getlistpage } from '@/api/upsapi/usergroup'
import { getTreeList } from '@/api/upsapi/categorymanage'
import TypeRules from './components/typeRules/index.vue'
// import advancedRules from './components/typeRules/advancedRules.vue'
import IdListTable from './components/IdListTable.vue'
import SegmentListTable from './components/SegmentListTable.vue'
import { useTrackingStore } from '@/stores/tracking'
import { useLatestOnly } from '@/composables/useLatestOnly'
import type { ModelObject, PropertyListMap, PropertyNode } from './types'

/** 用户列表的一行 */
interface UserRow {
  userId?: string
  loginId?: string
  anonymousId?: string
  createTime?: string
  updateTime?: string
}

interface UserListData {
  rows?: UserRow[]
  total?: number
}

/** 后端标签分类树的节点 */
interface CategoryNode {
  id?: string
  tableName?: string
  displayName?: string
  valueType?: string
  tag?: unknown
  children?: CategoryNode[]
}

/** 分群列表的一行 */
interface GroupRow extends PropertyNode {
  tableName?: string
}

const trackingStore = useTrackingStore()
const listLatest = useLatestOnly()
const groupLatest = useLatestOnly()

const loading = ref(false)
const queryForm = ref<{ mode: string; idType: string; idValue?: string }>({
  mode: 'IdList',
  idType: 'user_Id',
})
const tableList = ref<UserRow[]>([])
/** 存储所有数据用于前端分页 */
const allTableList = ref<UserRow[]>([])
/** 总数据量 */
const sumTotal = ref(0)
const pageNum = ref(1)
const pageSize = ref(10)
const total = ref(0)
/** (事件 / 用户)  全局 */
const pointProtoList = ref<PropertyNode[]>([])
/** 公共 (事件 / 用户) 局部 */
const propertyList = ref<PropertyListMap>({
  commonPropertySum: [], // 共用事件属性
  userProperties: [], // 共用用户属性
  userGroupList: [], // 用户分群
  userTagList: [], // 用户标签
})
/** 几个按钮类型 */
const fieldTypeList = ref<unknown[]>([])
const modelObject = ref<ModelObject>({
  filters: [],
})

const projectName = computed(() => trackingStore.projectName)

const queryParams = ref<Record<string, unknown>>({
  projectName: projectName.value,
  sortName: '',
  sortOrder: '',
  pageNum: 1,
  pageSize: 10,
  userId: '',
  loginId: '',
  anonymousId: '',
})

const typeRulesRef = ref<{ gloabAddEvent: () => void } | null>(null)
const segmentListTableRef = ref<unknown>(null)

function handleQuery() {
  pageNum.value = 1
  queryParams.value.pageNum = 1
  if (queryForm.value.mode === 'segment') {
    console.log('模型OBJECT==》', modelObject.value)
    if (modelObject.value.filters.length == 0) {
      ElMessage({
        message: '请添加筛选条件',
        type: 'warning',
      })
      return
    }

    // console.log("模型JSON==》", JSON.stringify(this.modelObject));
    getGroupApiList()
  } else if (queryForm.value.mode === 'IdList') {
    if (queryForm.value.idType === 'user_Id') {
      queryParams.value.userId = queryForm.value.idValue
      queryParams.value.loginId = ''
      queryParams.value.anonymousId = ''
    } else if (queryForm.value.idType === 'login_id') {
      queryParams.value.loginId = queryForm.value.idValue
      queryParams.value.userId = ''
      queryParams.value.anonymousId = ''
    } else if (queryForm.value.idType === 'anonymous_id') {
      queryParams.value.anonymousId = queryForm.value.idValue
      queryParams.value.userId = ''
      queryParams.value.loginId = ''
    }
    fetchList()
  }
}

function getGroupApiList() {
  const token = groupLatest.next()
  loading.value = true
  const groupParams = {
    projectName: projectName.value,
    filter: modelObject.value,
  }
  getUserPageListNewApi(groupParams)
    .then((res) => {
      if (!groupLatest.isLatest(token)) return
      loading.value = false
      if (res && res.code === 200) {
        const data = res.data as UserListData | null
        allTableList.value = data && data.rows ? data.rows : []
        sumTotal.value = data && data.total ? data.total : 0
      }
    })
    .finally(() => {
      if (!groupLatest.isLatest(token)) return
      loading.value = false
    })
}

function fetchList() {
  const token = listLatest.next()
  loading.value = true
  queryParams.value.pageNum = pageNum.value
  queryParams.value.pageSize = pageSize.value
  queryParams.value.projectName = projectName.value
  getUserListNewApi(queryParams.value)
    .then((res) => {
      if (!listLatest.isLatest(token)) return
      loading.value = false
      if (res && res.code === 200) {
        const data = res.data as UserListData | null
        tableList.value = data && data.rows ? data.rows : []
        total.value = data && data.total ? data.total : 0
      }
    })
    .catch(() => {
      // 保持静默，避免阻塞页面
    })
    .finally(() => {
      if (!listLatest.isLatest(token)) return
      loading.value = false
    })
}

function changeMode() {
  // this.modelObject.filters = [];
}

/** 将后端标签分类树转换为树选择组件使用的结构 */
function transformCategoryTree(arr?: CategoryNode[]): PropertyNode[] {
  return (arr || []).map((item) => {
    const node: PropertyNode = {
      name: item.tableName ? item.tableName : item.id,
      displayName: item.displayName,
      tableName: item.tableName,
      dataType: item.valueType,
    }
    if (!item.tag && item.children) {
      node.children = transformCategoryTree(item.children)
    }
    return node
  })
}

/** 初始化用户标签与用户分群数据，供树选择下拉使用 */
async function initTagAndGroup() {
  try {
    const catRes = await getTreeList({ projectName: projectName.value })
    if (catRes && catRes.data) {
      propertyList.value.userTagList = transformCategoryTree(catRes.data as CategoryNode[])
    }
  } catch {
    propertyList.value.userTagList = propertyList.value.userTagList || []
  }
  try {
    const params = {
      pageSize: 500,
      pageIndex: 1,
      projectName: projectName.value,
      updateType: '',
      status: '',
      endMatchTime: '',
      createType: '',
      search: '',
    }
    const groupRes = await getlistpage(params)
    if (groupRes && groupRes.code === 200) {
      const data = groupRes.data as { rows?: GroupRow[] } | null
      const rows = data && data.rows ? data.rows : []
      rows.forEach((item) => {
        item.name = item.tableName
      })
      propertyList.value.userGroupList = rows
    }
  } catch {
    propertyList.value.userGroupList = propertyList.value.userGroupList || []
  }
  // 将属性列表写入store，供通用tree-select优先读取
  trackingStore.setPropertyList(propertyList.value)
}

function refreshApiList() {
  if (queryForm.value.mode === 'segment') {
    getGroupApiList()
  } else {
    fetchList()
  }
}

function resetApiList() {
  queryParams.value.userId = ''
  queryForm.value.idValue = ''
  queryParams.value.loginId = ''
  queryParams.value.anonymousId = ''
  queryParams.value.pageNum = 1
  queryParams.value.pageSize = 10
  handleQuery()
}

function sortChange({ prop, order }: { prop: string; order: string | null }) {
  queryParams.value.sortName = prop
  queryParams.value.sortOrder =
    order === 'ascending' ? 'asc' : order === 'descending' ? 'desc' : null
  fetchList()
}

watch(projectName, (newVal, oldVal) => {
  if (newVal !== oldVal) {
    initTagAndGroup()
    modelObject.value = {
      filters: [],
    }
    queryParams.value.pageNum = 1
    fetchList()
  }
})

onMounted(() => {
  fetchList()
  // 初始化分群与标签数据，修复切换后“无可用选项”问题
  initTagAndGroup()
})
</script>

<template>
  <div class="public-block user-review">
    <el-card class="public-hoverItem public-radius">
      <template #header>
        <div>
          <div class="card-container">
            <div class="card-item-left">
              <span class="public-threeHead" style="margin-right: 20px">用户筛选</span>
              <el-radio-group v-model="queryForm.mode" @change="changeMode">
                <el-radio value="IdList">按ID筛选</el-radio>
                <el-radio value="segment">按分群筛选</el-radio>
                <!-- <el-radio value="advanced">高级筛选</el-radio> -->
              </el-radio-group>
            </div>

            <div class="card-item-right">
              <el-button :icon="RefreshRight" class="zc_btn refresh" @click="refreshApiList"
                >刷新</el-button
              >
              <el-button :icon="Refresh" class="zc_btn_default reset" @click="resetApiList"
                >重置</el-button
              >
            </div>
          </div>
          <!-- 筛选表单 -->
          <div v-if="queryForm.mode == 'IdList'" class="card-form setMarginTop">
            <el-select v-model="queryForm.idType" placeholder='请选择类型"' style="width: 140px">
              <el-option label="用户ID为" value="user_Id" />
              <el-option label="业务ID为" value="login_id" />
              <el-option label="匿名ID为" value="anonymous_id" />
            </el-select>
            <el-input
              v-model="queryForm.idValue"
              class="setMarginLeft"
              clearable
              placeholder='请输入"ID"'
              style="width: 200px"
            />
          </div>
          <!-- 按分群筛选 -->
          <div v-else-if="queryForm.mode == 'segment'" class="card-form setMarginTop">
            <TypeRules
              ref="typeRulesRef"
              :fieldTypeList="fieldTypeList"
              :propertyList="propertyList"
              :pointProtoList="pointProtoList"
              :modelObject="modelObject"
            />
          </div>
          <!-- 高级筛选 -->
          <!-- <div v-else-if="queryForm.mode == 'advanced'" class="card-form setMarginTop">
            <advancedRules ref="advancedRulesRef" :fieldTypeList="fieldTypeList" :propertyList="propertyList"
              :pointProtoList="pointProtoList" :modelObject="modelObject">
            </advancedRules>
          </div> -->

          <el-button class="setMarginTop" type="primary" size="small" @click="handleQuery"
            >开始查询</el-button
          >
        </div>
      </template>
    </el-card>

    <IdListTable
      v-if="queryForm.mode == 'IdList'"
      v-model:pageNum="pageNum"
      v-model:pageSize="pageSize"
      :loading="loading"
      :tableList="tableList"
      :total="total"
      @sort-change="sortChange"
      @change="fetchList"
    />

    <SegmentListTable
      v-else-if="queryForm.mode == 'segment'"
      ref="segmentListTableRef"
      :loading="loading"
      :sumTotal="sumTotal"
      :allTableData="allTableList"
    />
  </div>
</template>

<style lang="scss" scoped>
// v2 这里是 ::v-deep { @import "~@/styles/components/el-pagination.scss"; }，
// v3 已在 styles/index.scss 全局 @use，组件内不再重复引入

:deep(.el-input__wrapper) {
  min-height: 30px;
}

:deep(.el-input__inner) {
  height: 30px;
  line-height: 30px;
  font-size: 13px;
}

:deep(.el-input__icon) {
  line-height: 30px;
}

:deep(.el-radio__label) {
  font-size: 13px;
}

.user-review {
  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .card-container {
    display: flex;
    align-self: start;
    justify-content: space-between;

    .card-item-left {
      display: flex;
      align-items: center;
      border: 1px solid #efefef;
      padding: 0 15px;
      border-radius: 4px;
    }

    .card-item-right {
      display: flex;
    }
  }

  .query-form {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
  }
}
</style>
