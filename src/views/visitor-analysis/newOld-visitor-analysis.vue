<script setup lang="ts">
/**
 * 新老访客分析（v2 views/visitor-analysis/newOld-visitor-analysis.vue）。
 *
 * v2 里还有一段 getVisitorTotal / totalApiEvent（调 getVisitorTotalApi 再写 $refs.originView），
 * 但模板里根本没有 originView 这个组件，watch 里也从未调用 getVisitorTotal —— 是死代码，
 * 真跑起来会在 this.$refs.originView.originEvent 处抛 TypeError。v3 未迁，详见迁移报告。
 */
import { computed, ref, watch } from 'vue'
import { FilterBar } from '@/layout/components'
import { getSourceWebsiteApi } from '@/api/trackingapi/sourcewebsite'
import { getVisitUriDetailApi } from '@/api/trackingapi/visituri'
import { copyObj } from '@/utils/copy'
import { makeTableCellCenterByIndex } from '@/utils/index'
import { useLatestOnly } from '@/composables/useLatestOnly'
import { useTrackingStore } from '@/stores/tracking'
import newOldAnalysis from './chart-component/newOld-visitor-analysisTable.vue'

interface SourceWebRow {
  sourcesite?: string
  pv?: number
}

interface FormPageRow {
  uri?: string
  title?: string
  pv?: number
}

const trackingStore = useTrackingStore()

const newOldAnalysisRef = ref<{
  getVisitorDetail: (params: Record<string, unknown>, flag: number | null) => void
} | null>(null)

const filterBarParams = ref<Record<string, unknown> | null>(null)
const dateFlag = ref<number | null>(null)

const sourceWebNewList = ref<SourceWebRow[]>([])
const sourceWebOldList = ref<SourceWebRow[]>([])
const formPageNewList = ref<FormPageRow[]>([])
const formPageOldList = ref<FormPageRow[]>([])
const loadingRefresh = ref(false)
const loadingSecond = ref(false)

// 每个取数函数一套 token
const { next: nextNewSource, isLatest: isLatestNewSource } = useLatestOnly()
const { next: nextNewUri, isLatest: isLatestNewUri } = useLatestOnly()
const { next: nextOldSource, isLatest: isLatestOldSource } = useLatestOnly()
const { next: nextOldUri, isLatest: isLatestOldUri } = useLatestOnly()

const commonParams = computed(() => ({
  projectName: trackingStore.projectName,
  ...(filterBarParams.value || {}),
}))

// v2: columnIndex == 1 走左对齐，其余居中
const tableHeaderColor = makeTableCellCenterByIndex([], [1])

function setFilterBarParams(val: Record<string, unknown>, flag: number | null) {
  dateFlag.value = flag
  filterBarParams.value = copyObj(val)
}

// 新老访客
function getVisitorDetail() {
  newOldAnalysisRef.value?.getVisitorDetail(commonParams.value, dateFlag.value)
}

function tableVisitApiEvent() {
  const params = copyObj(commonParams.value) as Record<string, unknown>
  delete params.contrastValue
  if (!dateFlag.value) {
    newVisitorEvent(params)
    oldVisitorEvent(params)
  }
}

function newVisitorEvent(rows: Record<string, unknown>) {
  const params = copyObj(rows)
  params.pageNum = 1
  params.pageSize = 5
  params.visitorType = '新访客'
  loadingRefresh.value = true
  loadingSecond.value = true

  const sourceToken = nextNewSource()
  getSourceWebsiteApi(params)
    .then((res) => {
      if (!isLatestNewSource(sourceToken)) return
      if (res?.code != 200) return
      sourceWebNewList.value = ((res.data as SourceWebRow[]) || []).slice(0, 5)
    })
    .catch(() => {
      /* 报错已由请求层统一提示 */
    })

  const uriToken = nextNewUri()
  getVisitUriDetailApi(params)
    .then((res) => {
      if (!isLatestNewUri(uriToken)) return
      if (res?.code != 200) return
      loadingRefresh.value = false
      loadingSecond.value = false
      const data = res.data as { rows?: FormPageRow[] } | undefined
      formPageNewList.value = (data?.rows || []).slice(0, 5)
    })
    .catch(() => {
      if (!isLatestNewUri(uriToken)) return
      loadingRefresh.value = false
      loadingSecond.value = false
    })
}

function oldVisitorEvent(rows: Record<string, unknown>) {
  const params = copyObj(rows)
  params.pageNum = 1
  params.pageSize = 5
  params.visitorType = '老访客'

  const sourceToken = nextOldSource()
  getSourceWebsiteApi(params)
    .then((res) => {
      if (!isLatestOldSource(sourceToken)) return
      if (res?.code != 200) return
      sourceWebOldList.value = ((res.data as SourceWebRow[]) || []).slice(0, 5)
    })
    .catch(() => {
      /* 报错已由请求层统一提示 */
    })

  const uriToken = nextOldUri()
  getVisitUriDetailApi(params)
    .then((res) => {
      if (!isLatestOldUri(uriToken)) return
      if (res?.code != 200) return
      const data = res.data as { rows?: FormPageRow[] } | undefined
      formPageOldList.value = (data?.rows || []).slice(0, 5)
    })
    .catch(() => {
      /* 报错已由请求层统一提示 */
    })
}

watch(commonParams, () => {
  getVisitorDetail()
  tableVisitApiEvent()
})
</script>

<template>
  <div>
    <FilterBar ByContrast :ByVisitor="false" @set-filter-bar-params="setFilterBarParams" />
    <newOldAnalysis ref="newOldAnalysisRef" />
    <div class="public-block">
      <div class="visitorAll">
        <div v-loading="loadingRefresh" class="newVisitor public-hoverItem block-main">
          <div class="block-head">
            <div class="block-title">新访客</div>
            <div class="block-head-icon"></div>
          </div>
          <div class="public-secondHead">访问来源网站 TOP 5</div>
          <div
            style="width: 100%"
            :style="{
              minHeight:
                sourceWebNewList.length > 0 || sourceWebOldList.length > 0 ? '220px' : 'auto',
            }"
          >
            <el-table
              :data="sourceWebNewList"
              class="public-radius"
              :header-cell-style="{
                textAlign: 'center',
                background: '#f7fafe ',
              }"
              :cell-style="tableHeaderColor"
              style="width: 100%"
              border
              min-height="220px"
            >
              <el-table-column type="index" label="排名" min-width="20%" show-overflow-tooltip />
              <el-table-column
                prop="sourcesite"
                min-width="50%"
                show-overflow-tooltip
                label="来源网站"
              >
                <template #default="scope">
                  {{ scope.row.sourcesite }}
                </template>
              </el-table-column>
              <el-table-column prop="pv" label="浏览量" min-width="30%" show-overflow-tooltip />
            </el-table>
          </div>
          <div class="public-secondHead" style="margin-top: 25px">访问入口页 TOP 5</div>
          <div style="width: 100%; height: 220px">
            <el-table
              :data="formPageNewList"
              class="public-radius"
              :header-cell-style="{
                textAlign: 'center',
                background: '#f7fafe ',
              }"
              :cell-style="tableHeaderColor"
              style="width: 100%"
              border
            >
              <el-table-column type="index" label="排名" min-width="20%" show-overflow-tooltip />
              <el-table-column prop="uri" min-width="50%" show-overflow-tooltip label="页面URL">
                <template #default="scope">
                  <div v-if="scope.row.title" class="text-ellipsis">{{ scope.row.title }}</div>
                  <div class="text-ellipsis">{{ scope.row.uri }}</div>
                </template>
              </el-table-column>
              <el-table-column prop="pv" label="浏览量" min-width="30%" show-overflow-tooltip />
            </el-table>
          </div>
        </div>

        <div v-loading="loadingSecond" class="oldVisitor public-hoverItem block-main">
          <div class="block-head">
            <div class="block-title">老访客</div>
            <div class="block-head-icon"></div>
          </div>
          <div class="public-secondHead">访问来源网站 TOP 5</div>
          <div
            style="width: 100%"
            :style="{
              minHeight:
                sourceWebNewList.length > 0 || sourceWebOldList.length > 0 ? '220px' : 'auto',
            }"
          >
            <el-table
              :data="sourceWebOldList"
              class="public-radius"
              :header-cell-style="{
                textAlign: 'center',
                background: '#f7fafe ',
              }"
              :cell-style="tableHeaderColor"
              style="width: 100%"
              border
            >
              <el-table-column type="index" label="排名" min-width="20%" show-overflow-tooltip />
              <el-table-column
                prop="sourcesite"
                min-width="50%"
                show-overflow-tooltip
                label="来源网站"
              >
                <template #default="scope">
                  {{ scope.row.sourcesite }}
                </template>
              </el-table-column>
              <el-table-column prop="pv" label="浏览量" min-width="30%" show-overflow-tooltip />
            </el-table>
          </div>
          <div class="public-secondHead" style="margin-top: 25px">访问入口页 TOP 5</div>
          <div style="width: 100%; min-height: 220px">
            <el-table
              :data="formPageOldList"
              class="public-radius"
              :header-cell-style="{
                textAlign: 'center',
                background: '#f7fafe ',
              }"
              :cell-style="tableHeaderColor"
              style="width: 100%"
              border
            >
              <el-table-column type="index" label="排名" min-width="20%" show-overflow-tooltip />
              <el-table-column prop="uri" min-width="50%" show-overflow-tooltip label="页面URL">
                <template #default="scope">
                  <div v-if="scope.row.title" class="text-ellipsis">{{ scope.row.title }}</div>
                  <div class="text-ellipsis">{{ scope.row.uri }}</div>
                </template>
              </el-table-column>
              <el-table-column prop="pv" label="浏览量" min-width="30%" show-overflow-tooltip />
            </el-table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.public-secondHead {
  margin-bottom: 15px;
}

.Overview {
  margin: 20px;
  min-height: 118px;
  background-color: #fff;

  img {
    width: 11.44px;
    height: 11.44px;
    margin-left: 12px;
    cursor: pointer;
  }

  .trafficHead {
    font-size: 16px;
    font-weight: 600;
    line-height: 16px;
    color: #4d4d4d;
    padding: 15px 30px 15px;
    padding-left: 0;
  }

  .bid-list-page {
    // 与 v2 一致（v2 此处逻辑存疑：clas(100% -20px) 不是合法的 sass 函数，编译后原样输出、浏览器忽略）
    width: clas(100% -20px);
    display: flex;
    flex-direction: column;

    .bid-list-header {
      display: flex;

      .header-name {
        width: 14%;
        justify-content: center;
        height: 30px;
        display: flex;
        align-items: center;
      }

      .w156 {
        font-size: 13px;
        font-weight: 400;
        line-height: 14px;
        color: #4d4d4d;
      }
    }

    .bid-list-record {
      display: flex;

      .bid-list-item {
        width: 14%;
        justify-content: center;
        height: 30px;
        display: flex;
        align-items: center;
      }

      .w157 {
        font-size: 12px;
        font-weight: 400;
        line-height: 14px;
        color: #4d4d4d;
      }

      .w158 {
        font-size: 16px;
        font-weight: bold;
        color: #2c7be5;
        line-height: 17px;
      }
    }
  }
}

.visitLog {
  min-height: 311px;
  background-color: #fff;
  border-radius: 6px;
  padding: 60px;
  box-sizing: border-box;
  display: flex;

  .contrast {
    text-align: center;
    font-size: 18px;
    font-weight: bold;
    line-height: 33px;
    color: #6ba3ed;
  }

  .pointItem {
    display: flex;
    margin-left: 54px;

    .pointTh {
      width: 150px;
      text-align: right;
      margin-right: 10px;
    }

    .pointFornt {
      font-size: 13px;
      font-weight: 400;
      line-height: 33px;
      color: #4d4d4d;
    }
  }

  .visitLeft {
    width: 50%;
    display: flex;
  }

  .visitRight {
    width: 50%;
    display: flex;
  }
}

.visitorAll {
  display: flex;
  min-height: 654px;
  justify-content: space-between;

  .newVisitor {
    width: calc(50% - 10px);
    background-color: #fff;
  }

  .oldVisitor {
    width: calc(50% - 10px);
    background-color: #fff;
  }
}

.text-ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  line-height: 1.4;
  margin-bottom: 2px;
}
</style>
