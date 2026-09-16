<script setup lang="ts">
/**
 * 用户群画像分析页（对应 v2 `views/ups/userPortrait/portrait-analyze.vue`）。
 *
 * 负责：目标人群 / 对比人群的展示与增删改、开始计算（轮询直到「计算成功」）、
 * 画像信息图表（普通视图 portrait-echart / 合并视图 merge-echart）、以及整页导出 PDF（pdf-echart 离屏渲染）。
 *
 * v2 未搬运的遗留成员（模板无引用、也无外部调用）：`btnPermission`、`handleRefresh` 与 `rotateFlag`、
 * `removeElementAtIndex`、`contrastFinish`、`gropPortraitInfo`（同名数据只走 localStorage）。
 */
import { computed, getCurrentInstance, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus'
import type { NotificationHandle } from 'element-plus'
import rulesDialog from './rules-dialog.vue'
import portraitinfoDialog from './components/portraitinfo-dialog.vue'
import portraitEchart from './portrait-echart.vue'
import mergeEchart from './merge-echart.vue'
import pdfEchart from './pdf-echart.vue'
import type { PortraitInfoItem, PortraitRow, PortraitRuleItem } from './types'
import {
  get,
  getComparison,
  getlistportrait,
  groupPortraitCopy,
  portraitTagNow,
  update,
} from '@/api/upsapi/groupportrait'
import { copyObj } from '@/utils/copy'
import { useTrackingStore } from '@/stores/tracking'
import { useLatestOnly } from '@/composables/useLatestOnly'

/** 群画像对比接口返回的一条人群统计 */
interface ComparisonItem {
  name?: string
  count?: number
  timestamp?: string
  totalUser?: number
  totalTagged?: number
  distributions?: unknown[]
  /** 索引签名：pdf-echart 以松散对象读它，保证可互相赋值 */
  [key: string]: unknown
}

const proxy = getCurrentInstance()?.proxy
const route = useRoute()
const router = useRouter()
const trackingStore = useTrackingStore()

// 每个取数函数一套 useLatestOnly
const { next: nextList, isLatest: isLatestList } = useLatestOnly()
const { next: nextGet, isLatest: isLatestGet } = useLatestOnly()
const { next: nextCompare, isLatest: isLatestCompare } = useLatestOnly()
const { next: nextInfo, isLatest: isLatestInfo } = useLatestOnly()

const projectName = computed(() => trackingStore.projectName)

const isMergeBtnloadFnish = ref(false)
const compute_loading = ref(false)
const compute_status = ref('待计算')
const comparisonList = ref<{ targetUser: ComparisonItem; contrastUser: ComparisonItem[] }>({
  targetUser: {},
  contrastUser: [],
})
const targetCrowd = ref<PortraitRow>({})
const mergeOpen = ref(false)
const isMergeViews = ref(false)
/** 对比人群 */
const contrastCrowdList = ref<PortraitRuleItem[]>([])
const portraitInfoList = ref<PortraitInfoItem[]>([])
/** 用于加载是否存在对比图表 */
const loadingContrast = ref(false)
const pdfDownloading = ref(false)
let notifyInstance: NotificationHandle | null = null
let polling: ReturnType<typeof setInterval> | null = null

const pdfEchartRef = ref<InstanceType<typeof pdfEchart> | null>(null)
const portraitEchartRef = ref<InstanceType<typeof portraitEchart> | null>(null)
const mergeEchartRef = ref<InstanceType<typeof mergeEchart> | null>(null)
const portraitinfoDialogRef = ref<InstanceType<typeof portraitinfoDialog> | null>(null)
const rulesDialogRef = ref<InstanceType<typeof rulesDialog> | null>(null)

function getTargetName(index?: number) {
  try {
    const raw = localStorage.getItem('gropPortraitInfo')
    const info = raw ? (JSON.parse(raw) as { formula?: PortraitRuleItem[] }) : {}
    if (info.formula && info.formula.length > 0) {
      return info.formula[index ? index : 0]?.name || ''
    }
  } catch {
    /* ignore */
  }
  return ''
}

function getOriginList(): PortraitRuleItem[] {
  try {
    const raw = localStorage.getItem('gropPortraitInfo')
    const info = raw ? (JSON.parse(raw) as { formula?: PortraitRuleItem[] } | null) : null
    return (info && info.formula) || []
  } catch {
    return []
  }
}

/** 参数1：原始数据，参数2：对比数据 */
function processList(originList: PortraitRuleItem[], compareList: ComparisonItem[]) {
  const result: ComparisonItem[] = []
  originList.forEach((compareItem) => {
    const originItem = compareList.find((item) => item.name === compareItem.name)
    if (originItem) {
      result.push(originItem)
    } else {
      result.push({
        name: compareItem.name,
        count: 0,
        timestamp: '',
        totalUser: 0,
        totalTagged: 0,
        distributions: [],
      })
    }
  })
  return result
}

function handleComputeStatus(status: string) {
  if (status == '计算成功') {
    compute_status.value = status
    const token = nextCompare()
    getComparison({ id: route.query.id, projectName: projectName.value }).then((res) => {
      if (!isLatestCompare(token)) return
      if (res?.data) {
        comparisonList.value.contrastUser = []
        const originList = getOriginList()
        // ******** 参数1：原始数据，参数2：对比数据 *******
        const dataList = processList(originList, res.data as ComparisonItem[])
        dataList.forEach((item) => {
          if (item.name == getTargetName()) {
            comparisonList.value.targetUser = item
          } else {
            comparisonList.value.contrastUser.push(item)
          }
        })
      }
    })
  }
}

function useCopareEvent() {
  if (portraitInfoList.value.length == 0 && targetCrowd.value.lastExecuteStatus == '计算成功') {
    handleComputeStatus(String(targetCrowd.value.lastExecuteStatus))
    compute_status.value = String(targetCrowd.value.lastExecuteStatus)
  }
}

function getPortraitApi() {
  const query = route.query
  const token = nextGet()
  get({ id: query.id, projectName: projectName.value })
    .then((res) => {
      if (!isLatestGet(token)) return
      const data = (res?.data || {}) as PortraitRow
      localStorage.setItem(
        'gropPortraitInfo',
        JSON.stringify({
          id: data.id,
          displayName: data.displayName,
          formula: (() => {
            try {
              return (JSON.parse(String(data.formula)) as PortraitRuleItem[]) || []
            } catch {
              return []
            }
          })(),
        }),
      )
      if (res?.code == 200 && res.data) {
        targetCrowd.value = data
        useCopareEvent()
        let portraitDataList: PortraitRuleItem[] = []
        try {
          portraitDataList = (JSON.parse(String(data.formula)) as PortraitRuleItem[]) || []
        } catch {
          portraitDataList = []
        }
        if (!Array.isArray(portraitDataList)) {
          portraitDataList = []
        }
        if (portraitDataList.length > 1) {
          contrastCrowdList.value = portraitDataList.slice(1)
        } else {
          contrastCrowdList.value = []
        }
        if (!isMergeViews.value) {
          if (portraitInfoList.value.length > 0) {
            portraitEchartRef.value?.initApiList(
              portraitInfoList.value,
              contrastCrowdList.value,
              targetCrowd.value,
            )
          }
        }
        loadingContrast.value = false
      }
    })
    .catch(() => {
      if (!isLatestGet(token)) return
      loadingContrast.value = false
    })
}

function portraitInfoListApi() {
  loadingContrast.value = true
  const query = route.query
  const token = nextList()
  getlistportrait({ id: query.id, projectName: projectName.value }).then((res) => {
    if (!isLatestList(token)) return
    if (res?.code == 200) {
      if (res.data) {
        portraitInfoList.value = res.data as PortraitInfoItem[]
      }
      getPortraitApi()
    }
  })
}

function openMergeEcharts() {
  isMergeBtnloadFnish.value = true
}

function copyGroupPortrait() {
  ElMessageBox.prompt('添加报告名称', '复制', {
    cancelButtonText: '取消',
    confirmButtonText: '确定',
    inputPattern: /^.+$/,
    inputErrorMessage: '报告名称不能为空',
  })
    .then(({ value }) => {
      groupPortraitCopy({
        id: targetCrowd.value.id,
        name: value,
        projectName: projectName.value,
      }).then((res) => {
        compute_status.value = '待计算'
        router.replace({
          path: 'analyze',
          query: {
            product: 'newlys',
            id: (res?.data as string) || '',
            projectName: projectName.value,
          },
        })
        mergeOpen.value = false
        isMergeViews.value = false
        portraitEchartRef.value?.copyPortraitList()
        portraitInfoListApi()
      })
    })
    .catch(() => {
      ElMessage({
        type: 'info',
        message: '取消输入',
      })
    })
}

function portraitTagNowExecute() {
  let title: string
  if (targetCrowd.value.lastExecuteStatus) {
    title = '是否重新计算？'
  } else {
    title =
      '“开始计算”后，将无法修改目标人群和对比人群的规则也无法新增更多对比人群，确认要“开始计算”吗？'
  }
  ElMessageBox.confirm(title, {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    cancelButtonClass: 'custom-cancel-button',
    type: 'warning',
  })
    .then(() => {
      isMergeBtnloadFnish.value = false // 接口加载完成才可以合并视图
      portraitEchartRef.value?.loadingEvent(true)
      compute_status.value = '计算中'
      portraitEchartRef.value?.updateComputeStatus('', '计算中')
      compute_loading.value = true
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
      for (const key in targetCrowd.value) {
        if (key in params) {
          params[key] = targetCrowd.value[key] // 如果存在，则赋值
        }
      }
      setTimeout(() => {
        portraitTagNow(params)
          .then(() => {
            ElMessage.success('计算成功')
            compute_loading.value = false
          })
          .catch(() => {
            compute_loading.value = false
          })
      }, 1000)

      polling = setInterval(() => {
        get({ id: route.query.id, projectName: projectName.value })
          .then((res) => {
            if (res?.code == 200 && res.data) {
              targetCrowd.value = res.data as PortraitRow
              compute_status.value = String(targetCrowd.value.lastExecuteStatus)
              // if (portraitInfoList.length > 0 && !isMergeViews) {
              if (!isMergeViews.value) {
                if (targetCrowd.value.lastExecuteStatus == '计算成功') {
                  if (polling) {
                    clearInterval(polling)
                    polling = null
                    portraitEchartRef.value?.updateComputeStatus(
                      res.data as PortraitRow,
                      '计算成功',
                      portraitInfoList.value,
                    )
                  }
                }
              } else {
                if (targetCrowd.value.lastExecuteStatus == '计算成功') {
                  if (polling) {
                    clearInterval(polling)
                    polling = null
                    mergeEchartRef.value?.updateComputeStatus(
                      res.data as PortraitRow,
                      '计算成功',
                      portraitInfoList.value,
                    )
                  }
                }
              }
            }
          })
          .catch((error) => {
            console.error('请求出错:', error) // 添加错误捕获
            if (polling) clearInterval(polling) // 请求出错时停止轮询
            polling = null
          })
      }, 3000)
    })
    .catch(() => {})
}

function handleComputeEvent() {
  if (!compute_loading.value) {
    portraitTagNowExecute()
  }
}

/**
 * 子组件 portrait-echart 发上来的是它自己的图表行对象（结构比 PortraitInfoItem 更宽），
 * 这里按松散对象接收，转交 dialog 时再收窄。
 */
function editPortraitInfo(item: { [key: string]: unknown }) {
  portraitinfoDialogRef.value?.openDialog(item as PortraitInfoItem)
}

/** 画像信息保存后的回调负载（portraitinfo-dialog emit 上来的 { type, id }） */
interface PortraitUpdatePayload {
  type: string
  id: (string | number)[]
}

// 刷新接口事件
function updatePortraitInfoAPi(object: PortraitUpdatePayload) {
  const token = nextInfo()
  getlistportrait({ id: route.query.id, projectName: projectName.value }).then((res) => {
    if (!isLatestInfo(token)) return
    if (res?.data) {
      portraitInfoList.value = res.data as PortraitInfoItem[]
      if (portraitInfoList.value.length > 0) {
        // v2 这里包了一层 $nextTick，v3 的子组件方法同样需要等模板更新完再调
        void Promise.resolve().then(() => {
          portraitEchartRef.value?.update_portrait_list(
            { type: object.type, id: object.id.map((v) => String(v)) },
            res.data as PortraitInfoItem[],
            contrastCrowdList.value,
            targetCrowd.value,
          )
        })
      }
    }
  })
}

function allRateFormate(item?: ComparisonItem) {
  if (!targetCrowd.value.lastExecuteStartTime) return 0

  if (item && item.count) {
    if (item.totalUser === 0) {
      return 0
    }
    return ((item.count / Number(item.totalUser)) * 100).toFixed(2)
  } else {
    return 0
  }
}

function handleMerge(type: string | number | boolean | undefined) {
  // v2 读的是 this.$refs.portraitEchartRef._data.portraitInfoList
  const infoList = (portraitEchartRef.value?.portraitInfoList || []) as PortraitInfoItem[]
  mergeOpen.value = isMergeViews.value
  if (type && portraitInfoList.value.length > 0) {
    mergeEchartRef.value?.initApiList(infoList, contrastCrowdList.value, targetCrowd.value)
  } else {
    portraitEchartRef.value?.updateEcharts()
  }
}

// 编辑源代码用于刷新页面操作
function refreshApi() {
  portraitInfoListApi()
}

function someEventFunction() {
  if (notifyInstance) {
    notifyInstance.close()
  }
}

function lodashDownload() {
  const run = proxy?.$htmlToPdf
  if (!run) return
  run('contentToConvert', String(targetCrowd.value.displayName || '用户群画像下载报告'))
    .then((result) => {
      if (result) {
        someEventFunction()

        pdfDownloading.value = false
        setTimeout(() => {
          ElMessage.success('PDF文件下载成功')
        }, 500)
      } else {
        pdfDownloading.value = false
        someEventFunction()
        setTimeout(() => {
          ElMessage.error('下载失败')
        }, 500)
      }
    })
    .catch(() => {
      pdfDownloading.value = false
      someEventFunction()
      ElMessage.error('下载失败')
    })
}

function downloadPDF() {
  if (!isMergeBtnloadFnish.value) {
    ElMessage.error('请计算完成后再下载')
    return
  }
  // 当前方案二
  const infoList = copyObj(portraitEchartRef.value?.portraitInfoList || [])
  if (!pdfDownloading.value) {
    pdfEchartRef.value?.initApiList(
      infoList,
      contrastCrowdList.value,
      targetCrowd.value,
      comparisonList.value,
    )
    notifyInstance = ElNotification({
      message: '下载中，请勿离开此页面',
      duration: 0,
      customClass: 'notify_custom',
    })
  }
  pdfDownloading.value = true
}

// pdf-html是否渲染完成
function allowDownPdf() {
  lodashDownload()
}

function toBackPath(flag?: string) {
  let title = '离开将丢失已编辑的内容，是否离开？'
  let tip1 = '确认离开？'
  if (flag == '保存') {
    title = '确认保存'
    tip1 = ''
  }
  ElMessageBox.confirm(title, tip1, {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    cancelButtonClass: 'custom-cancel-button',
    type: 'warning',
  })
    .then(() => {
      router.push({ path: 'list' })
    })
    .catch(() => {})
}

/**
 * 详情操作。
 * 参数一：更新详情；参数二：接口获取目标人群的数据
 */
function handleDetail(type: string, index?: number) {
  if (type == '更新目标人群') {
    rulesDialogRef.value?.openDialogEvent(type, index, targetCrowd.value)
  } else if (type == '更新对比人群') {
    rulesDialogRef.value?.openDialogEvent(type, Number(index) + 1, targetCrowd.value)
  } else {
    rulesDialogRef.value?.openDialogEvent(type, '', targetCrowd.value)
  }
}

function handleDelete(_item: PortraitRuleItem, index: number) {
  const formula = copyObj(JSON.parse(String(targetCrowd.value.formula)) as PortraitRuleItem[])
  const newArry = formula.filter((_row, idx) => idx != index + 1)
  update({
    id: targetCrowd.value.id,
    displayName: targetCrowd.value.displayName,
    formula: JSON.stringify(newArry),
    createType: '群画像规则',
    projectName: projectName.value,
  }).then((res) => {
    if (res?.code === 200) {
      portraitInfoListApi()
    }
  })
}

function addPortraitInfo() {
  portraitinfoDialogRef.value?.openDialog('', portraitInfoList.value)
}

function updatePortrait() {
  // v2 的两个分支体是一样的，保留原样
  getPortraitApi()
}

onMounted(() => {
  // 画像信息-图表接口
  portraitInfoListApi()
})

onBeforeUnmount(() => {
  // v2 没有清理这个轮询（离开页面后仍会每 3s 请求一次），v3 必须清掉
  if (polling) {
    clearInterval(polling)
    polling = null
  }
  someEventFunction()
})
</script>

<template>
  <div style="position: relative; height: 100%; min-height: calc(100vh - 70px)">
    <!--******** PDF下载页HTML *********-->
    <div id="contentToConvert" style="position: absolute; top: 100%; width: 100%">
      <pdfEchart ref="pdfEchartRef" @allow-down-pdf="allowDownPdf" />
    </div>
    <!--********** html *********-->
    <div>
      <div class="block_online block-main public-hoverItem" style="min-height: 300px; margin: 20px">
        <div style="display: flex; justify-content: space-between; margin-bottom: 20px">
          <p class="public-firstHead">用户群画像分析</p>
          <div style="display: flex; align-items: center">
            <el-button
              v-if="targetCrowd.creator"
              v-loading="compute_loading"
              style="float: right"
              class="zc_btn"
              @click="handleComputeEvent"
            >
              {{ !targetCrowd.lastExecuteStatus ? '开始计算' : '重新计算' }}
            </el-button>
            <el-button class="zc_btn_default" @click="refreshApi"> 刷新 </el-button>
            <el-button v-if="!route.query.product" class="zc_btn_default" @click="copyGroupPortrait">
              复制
            </el-button>
            <div v-if="targetCrowd.lastExecuteStatus" style="position: relative; margin: 0 10px">
              <el-button v-loading="pdfDownloading" class="zc_btn_default" @click="downloadPDF">
                下载 PDF
              </el-button>
            </div>

            <el-button class="zc_btn_default" @click="toBackPath()">返回</el-button>
          </div>
        </div>

        <p class="public-secondHead" style="margin-top: 35px; width: 100px">
          <!-- 画像人群 -->
          {{ targetCrowd.displayName }}
        </p>
        <!-- 目标对象 -->
        <div class="portrait_block">
          <div class="targer_corwd">
            <div class="inner">
              <div class="targetPerson">目标人群</div>
              <div class="portraitName">目标人群</div>
              <div style="display: flex">
                <p class="portraitNum">
                  {{
                    compute_status === '计算成功'
                      ? (comparisonList.targetUser.count || 0) + '人'
                      : compute_status
                  }}
                </p>
              </div>
              <div style="display: flex; margin-left: 30px">
                <p>占用全部用户：</p>
                {{ allRateFormate(comparisonList.targetUser) }}%
              </div>

              <div
                style="position: absolute; color: #2c7be5; right: 20px; cursor: pointer"
                @click="handleDetail('更新目标人群', 0)"
              >
                详情
              </div>
            </div>
          </div>
          <el-button
            v-if="
              contrastCrowdList.length < 1 &&
              targetCrowd.creator &&
              !targetCrowd.lastExecuteStartTime
            "
            class="zc_btn"
            @click="handleDetail('添加对比人群', 1)"
          >
            添加对比人群
          </el-button>
        </div>
        <!--  对比人群-->
        <div v-for="(item, index) in contrastCrowdList" :key="index" class="portrait_block">
          <div class="targer_corwd">
            <div class="inner">
              <div class="contrastPerson">对比人群</div>
              <div class="portraitName">{{ item.name }}</div>
              <div style="display: flex">
                <p class="portraitNum">
                  {{
                    compute_status === '计算成功'
                      ? ((comparisonList.contrastUser[index] &&
                          comparisonList.contrastUser[index].count) ||
                          0) + '人'
                      : compute_status
                  }}
                </p>
              </div>
              <div style="display: flex; margin-left: 30px">
                <p>占用全部用户：</p>
                {{ allRateFormate(comparisonList.contrastUser[index]) }}%
              </div>
              <div
                style="
                  position: absolute;
                  color: #2c7be5;
                  right: 20px;
                  cursor: pointer;
                  display: flex;
                "
              >
                <div @click="handleDetail('更新对比人群', index)">详情</div>
                <div
                  v-if="targetCrowd.creator && !targetCrowd.lastExecuteStartTime"
                  style="margin-left: 10px"
                  @click="handleDelete(item, index)"
                >
                  删除
                </div>
              </div>
            </div>
          </div>
          <!-- contrastCrowdList.length < 5   限制对比条数5条 -->
          <el-button
            v-if="
              index == 0 &&
              targetCrowd.creator &&
              !targetCrowd.lastExecuteStartTime &&
              contrastCrowdList.length < 5
            "
            class="zc_btn"
            @click="handleDetail('添加对比人群')"
          >
            添加对比人群
          </el-button>
        </div>
      </div>
      <!-- 画像信息 -->
      <div class="block_online block-main public-hoverItem" style="min-height: 400px; margin: 20px">
        <p class="public-firstHead">画像信息</p>
        <div style="width: 100%; display: flex; justify-content: right; align-items: center">
          <el-checkbox
            v-if="portraitInfoList.length > 0 && isMergeBtnloadFnish && targetCrowd.lastExecuteStatus"
            v-model="isMergeViews"
            style="margin-right: 15px; font-size: 13px"
            @change="handleMerge"
          >
            合并视图
          </el-checkbox>
          <el-button v-if="targetCrowd.creator" class="zc_btn" @click="addPortraitInfo">
            添加画像信息
          </el-button>
        </div>
        <!-- echarts表格内容 -->
        <div v-show="portraitInfoList.length > 0">
          <portraitEchart
            v-show="!mergeOpen"
            ref="portraitEchartRef"
            @edit-portrait-info="editPortraitInfo"
            @handle-compute-status="handleComputeStatus"
            @clear-portrait-info="portraitInfoList = []"
            @open-merge-echarts="openMergeEcharts"
          />
          <mergeEchart v-show="mergeOpen" ref="mergeEchartRef" />
        </div>
        <div
          v-if="loadingContrast && portraitInfoList.length == 0"
          v-loading="loadingContrast"
          element-loading-text="加载中"
          style="display: flex; justify-content: center; align-items: center; min-height: 300px"
        ></div>
        <div
          v-if="portraitInfoList.length == 0 && !loadingContrast"
          style="display: flex; justify-content: center; align-items: center; min-height: 300px"
        >
          <div class="info">
            <p>暂无画像信息</p>
            <p>请添加画像信息</p>
          </div>
        </div>
      </div>
      <portraitinfoDialog
        ref="portraitinfoDialogRef"
        @updatePortraitInfoAPi="updatePortraitInfoAPi"
      />
      <rulesDialog ref="rulesDialogRef" @update-portrait="updatePortrait" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
/* 动态旋转图标 */
@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.rotating {
  animation: spin 1s linear infinite;
  font-size: 24px;
}

:deep(.el-message-box__header) {
  font-size: 13px !important;
}

:deep(.el-checkbox__label) {
  font-size: 12px;
}

:deep(.el-loading-spinner .circular) {
  height: 20px;
  margin-top: 12px;
}

@keyframes rotate {
  0% {
    -webkit-transform: rotate(0deg);
  }

  25% {
    -webkit-transform: rotate(90deg);
  }

  50% {
    -webkit-transform: rotate(180deg);
  }

  75% {
    -webkit-transform: rotate(270deg);
  }

  100% {
    -webkit-transform: rotate(360deg);
  }
}

.el-icon-refresh-right:active {
  // transform: rotate(360deg); /* 点击时旋转到360度 */
  animation: rotate 0.1s linear infinite;
}

.el-icon-refresh-right:hover {
  color: #2c7be5;
}

.portrait_block {
  display: flex;
  align-items: center;
  margin-top: 20px;

  .targer_corwd {
    width: 80%;
    min-height: 40px;
    border: 1px solid #e8e8e9;
    border-radius: 2px;
    box-sizing: border-box;
    display: flex;
    align-items: center;

    .inner {
      position: relative;
      display: flex;
      padding: 0 10px;
      height: 25px;
      line-height: 25px;
      color: #4d4d4d;
      font-size: 12px;
      width: 100%;

      .targetPerson {
        height: 25px;
        padding: 0 3px;
        color: #2c7be5;
        border-radius: 2px;
        background: #a6c9f7;
      }

      .contrastPerson {
        height: 25px;
        padding: 0 3px;
        color: #168126;
        border-radius: 2px;
        background: #d2f8d8;
      }

      .portraitName {
        margin: 0 10px;
        width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .portraitNum {
        padding: 0 2px;
        border-bottom: 1px solid #2c7be5;
        cursor: pointer;
      }

      .portraitNum:hover {
        color: #2c7be5;
      }
    }
  }

  .zc_btn {
    margin-left: 20px;
  }
}

// <!-- 画像信息 -->
.info {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-top: 40px;
  width: 400px;
  min-height: 150px;
  border-radius: 6px;
  background: #eaf2fc;

  p {
    height: 100%;
    font-size: 16px;
    color: #4d4d4d;
    font-weight: 600;
    line-height: 40px;
  }
}
</style>
