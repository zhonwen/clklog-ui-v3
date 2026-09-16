<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Link, View } from '@element-plus/icons-vue'
import { formatTime } from '@/utils/format'
import { copyObj } from '@/utils/copy'
import { useLatestOnly } from '@/composables/useLatestOnly'
import {
  getVisitorSessionListApi,
  getVisitorSessionUriListApi,
} from '@/api/trackingapi/visitor'
import SeqFilters from './seq-filters.vue'
import type {
  SeqFilterParams,
  SeqFilterValue,
  VisitHistoryCache,
  VisitSessionRow,
  VisitUriRow,
} from '../types'

const props = withDefaults(
  defineProps<{
    projectName?: string | null
    userId?: string | null
    cacheData?: VisitHistoryCache | null
  }>(),
  { projectName: null, userId: null, cacheData: null },
)

const emit = defineEmits<{ (e: 'update-cache', state: VisitHistoryCache): void }>()

const { next: nextSessionList, isLatest: isLatestSessionList } = useLatestOnly()
const { next: nextSessionUri, isLatest: isLatestSessionUri } = useLatestOnly()

const sessionListLoading = ref(false)
const sessionUriListLoading = ref(false)
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(10)
const clickIndex = ref(-1)
const visitorSessionList = ref<VisitSessionRow[]>([])
const seqFilter = ref<SeqFilterValue>({ dateMode: 'latest', rangeTime: null, events: [] })
const commonParams = ref({ startDate: '', endDate: '' })
let isRestoring = false
let restoreTimer: ReturnType<typeof setTimeout> | null = null

function formatTimestamp(timestamp: string | number | null | undefined) {
  if (!timestamp) return null
  const pad = (n: number) => String(n).padStart(2, '0')
  let ts: string | number = timestamp
  if (typeof ts === 'string') {
    const s = ts.trim()
    if (/^\d+$/.test(s)) {
      ts = Number(s)
    } else {
      const d = new Date(s)
      if (!isNaN(d.getTime())) {
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
          d.getHours(),
        )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
      }
      return ''
    }
  }
  if (typeof ts === 'number' && ts < 1e12) {
    ts = ts * 1000
  }
  const date = new Date(ts)
  if (isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function filterUrl(uri: string | undefined) {
  const regExp = /^(http:\/\/|https:\/\/|www\.)/
  return regExp.test(uri || '')
}

function getIndex(index: number) {
  return total.value - ((currentPage.value - 1) * pageSize.value + index)
}

/**
 * 模板要用到的派生数据（与 v2 的模板表达式一一对应）。
 * v2 直接在模板里写 item.httpList[0].length 这类下标访问，
 * 开了 noUncheckedIndexedAccess 之后必须先落成变量再判空。
 */
const visitRows = computed(() =>
  visitorSessionList.value.map((item, index) => {
    const pages = item.httpList[0]
    return {
      item,
      index,
      indexLabel: getIndex(index),
      firstTimeText: formatTimestamp(item.firstTime) || '',
      ips: item.rows || [],
      // v2: v-if="item.httpList.length > 0"
      showPages: item.httpList.length > 0,
      pages: pages || [],
      // v2: item.httpList.length > 0 && item.pv > item.httpList[0].length
      hasMore: item.httpList.length > 0 && (item.pv ?? 0) > (pages?.length ?? 0),
      // v2: index > 0 && item.httpList.length === 0
      showTrigger: index > 0 && item.httpList.length === 0,
    }
  }),
)

function getVisitorSessionUriList(val: VisitSessionRow, index: number) {
  sessionUriListLoading.value = true
  const params = {
    pageNum: 1,
    pageSize: val.pv,
    userId: val.userId,
    eventSessionId: val.eventSessionId,
    projectName: props.projectName,
    firstTime: val.firstTime,
  }
  const token = nextSessionUri()
  getVisitorSessionUriListApi(params)
    .then((res) => {
      if (!isLatestSessionUri(token)) return
      sessionUriListLoading.value = false
      if (res?.code == 200) {
        const data = res.data as { rows?: VisitUriRow[] } | undefined
        const visitListUrl = data?.rows || []
        const target = visitorSessionList.value[index]
        if (target) {
          const pageList = copyObj(visitListUrl.slice(0, 10))
          const allList = copyObj(visitListUrl)
          target.httpList = pageList.length > 0 ? [pageList] : []
          target.allHttpList = allList.length > 0 ? [allList] : []
        }
      }
    })
    .catch(() => {
      if (!isLatestSessionUri(token)) return
      sessionUriListLoading.value = false
    })
}

function toVisitHttp(item: VisitSessionRow, index: number) {
  clickIndex.value = index
  getVisitorSessionUriList(item, index)
}

function getVisitorSessionList() {
  if (!props.userId || !props.projectName) {
    visitorSessionList.value = []
    seqFilter.value = { dateMode: 'latest', rangeTime: null, events: [] }
    return
  }
  sessionListLoading.value = true
  const params = {
    userId: props.userId,
    pageNum: currentPage.value,
    pageSize: pageSize.value,
    projectName: props.projectName,
    startDate: commonParams.value.startDate,
    endDate: commonParams.value.endDate,
  }
  const token = nextSessionList()
  getVisitorSessionListApi(params)
    .then((res) => {
      if (!isLatestSessionList(token)) return
      sessionListLoading.value = false
      if (res?.code == 200) {
        const data = res.data as { total?: number; rows?: VisitSessionRow[] } | undefined
        total.value = data?.total || 0
        const rows = data?.rows || []
        rows.forEach((item) => {
          item.httpList = []
          item.allHttpList = []
          item.visitTime = formatTime(Math.floor(Number(item.visitTime)))
        })
        visitorSessionList.value = rows
        const first = visitorSessionList.value[0]
        if (first) {
          toVisitHttp(first, 0)
        }
      }
    })
    .catch(() => {
      if (!isLatestSessionList(token)) return
      sessionListLoading.value = false
    })
}

function setTopFilterParams(params: SeqFilterParams) {
  if (isRestoring) return
  commonParams.value.startDate =
    params.rangeTime && params.rangeTime.length > 0 ? params.rangeTime[0] || '' : ''
  commonParams.value.endDate =
    params.rangeTime && params.rangeTime.length > 0 ? params.rangeTime[1] || '' : ''
  getVisitorSessionList()
}

function tomoreEvent(item: VisitSessionRow, index: number) {
  if (item.clickMore) {
    if (item.clickMore + 10 > (item.pv ?? 0)) {
      item.clickMore = item.pv
    } else {
      item.clickMore = item.clickMore + 10
    }
  } else {
    item.clickMore = 20
  }
  const copyArray = copyObj(visitorSessionList.value)
  const all = item.allHttpList[0] || []
  const abc = copyObj(all.slice(0, item.clickMore))
  const target = copyArray[index]
  if (target) target.httpList = [abc]
  visitorSessionList.value = copyArray
}

function handleSizeChange(val: number) {
  currentPage.value = 1
  pageSize.value = val
  getVisitorSessionList()
}

function handleCurrentChange(val: number) {
  currentPage.value = val
  getVisitorSessionList()
}

onMounted(() => {
  if (props.cacheData) {
    isRestoring = true
    const cache = props.cacheData

    seqFilter.value = cache.seqFilter ? copyObj(cache.seqFilter) : seqFilter.value
    commonParams.value = cache.commonParams ? copyObj(cache.commonParams) : commonParams.value
    visitorSessionList.value = cache.visitorSessionList ? copyObj(cache.visitorSessionList) : []
    total.value = cache.total
    currentPage.value = cache.currentPage
    pageSize.value = cache.pageSize
    clickIndex.value = cache.clickIndex

    restoreTimer = setTimeout(() => {
      isRestoring = false
    }, 500)
  }
})

onBeforeUnmount(() => {
  if (restoreTimer) {
    clearTimeout(restoreTimer)
    restoreTimer = null
  }
  emit('update-cache', {
    seqFilter: seqFilter.value,
    commonParams: commonParams.value,
    visitorSessionList: visitorSessionList.value,
    total: total.value,
    currentPage: currentPage.value,
    pageSize: pageSize.value,
    clickIndex: clickIndex.value,
  })
})
</script>

<template>
  <el-row class="box-history">
    <seq-filters v-model="seqFilter" by-cursor-time @set-filter-bar-params="setTopFilterParams" />
    <div class="content-block">
      <div v-loading="sessionListLoading" class="history-box">
        <div class="right-head"></div>
        <div v-if="visitRows.length > 0" class="warry-body">
          <div v-for="row in visitRows" :key="row.index" class="right-body">
            <div
              class="right_body-con"
              :style="row.index == visitRows.length - 1 ? 'margin-bottom:0' : ''"
            >
              <div class="right_body_title">
                <div class="body-left">
                  <div class="common-title">访问#{{ row.indexLabel }}</div>
                  <div class="left-time">最后访问时间：{{ row.firstTimeText }}， &nbsp;&nbsp;</div>
                </div>
                <div class="body-right" style="display: flex; align-items: center; cursor: default">
                  访问时长：{{ row.item.visitTime }}， &nbsp;&nbsp; 访问页面数：{{ row.item.pv }}
                </div>
              </div>
              <div class="line"></div>
              <div class="right_body_http">
                <div class="ip-row">
                  <div class="right_ip">IP：</div>
                  <div class="ip-list">
                    <div
                      v-for="(ipItem, ip_idx) in row.ips"
                      :key="ip_idx"
                      class="ip-item"
                    >
                      <span class="right_single_font">{{ ipItem.clientIp }}</span>
                      <span class="right_single_font">{{ ipItem.province }}；</span>
                    </div>
                  </div>
                </div>
                <div
                  v-if="row.showTrigger"
                  v-loading="clickIndex == row.index && sessionUriListLoading"
                  class="view-history-trigger"
                  @click="toVisitHttp(row.item, row.index)"
                >
                  <el-icon><View /></el-icon>&nbsp;&nbsp;查看页面浏览记录
                </div>
                <div
                  v-if="row.showPages"
                  style="text-align: left; max-height: 500px; overflow-y: auto; overflow-x: hidden"
                >
                  <div v-for="(val, val_idx) in row.pages" :key="val_idx">
                    <div class="visit-item-row">
                      <div class="visit-item-left">
                        <el-icon style="font-size: 16px"><Link /></el-icon>
                        <div class="visit-item-divider"></div>
                      </div>
                      <div class="visit-item-header">
                        <div class="visit-item-time">{{ val.logTime }}</div>
                        <div class="visit-item-content">
                          <div class="visit-item-title">{{ val.title }}</div>
                          <div
                            style="
                              box-sizing: border-box;
                              min-height: 15px;
                              line-height: 18px;
                              margin-bottom: 5px;
                              font-size: 13px;
                            "
                          >
                            <a
                              v-if="filterUrl(val.uri)"
                              :href="val.uri"
                              target="_blank"
                              style="color: #2c7be5"
                              >{{ val.uri }}</a
                            >
                            <div v-else style="color: #4d4d4d">{{ val.uri }}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div v-if="row.hasMore" class="loadMore" @click="tomoreEvent(row.item, row.index)">
                    <span style="color: #2c7be5">加载更多...</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="no-data">
          <div>暂无数据</div>
        </div>
        <div class="block" style="margin: 15px">
          <el-pagination
            v-if="visitorSessionList && visitorSessionList.length > 0"
            v-model:current-page="currentPage"
            next-text="下一页"
            :pager-count="5"
            :page-size="pageSize"
            :total="total"
            @size-change="handleSizeChange"
            @current-change="handleCurrentChange"
          />
        </div>
      </div>
    </div>
  </el-row>
</template>

<style scoped lang="scss">
.el-icon-s-comment {
  color: #6c9ee0;
}

.box-history {
  height: 100%;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  flex: 1;
  min-height: 0;
}

.content-block {
  background-color: #fff;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;

  // 访问历史列表最大宽度
  .history-box {
    //max-width: 2000px;
    width: 100%;
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
  }
}

.commonBackgrond {
  background-color: #fff;
}

.no-data {
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #fff;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  color: #4d4d4d;
  min-height: 500px;
  border-radius: 6px;
}

.common-title {
  font-size: 14px;
  font-weight: 600;
  line-height: 31px;
  color: #4d4d4d !important;
}

.right-head {
  display: flex;
  justify-content: space-between;

  .name {
    font-size: 13px;
    font-weight: 500;
    line-height: 31px;
    color: #4d4d4d;
  }

  .btnEvent {
    cursor: pointer;
    width: 54px;
    height: 21px;
    border: 1px solid #2c7be5;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 400;
    line-height: 21px;
    text-align: center;
    color: #656d92;
  }
}

.warry-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  width: 100%;
  margin: 0 auto;
  background: #fff;
  border-radius: 6px;
  //scrollbar-width: thin;
  // scrollbar-color: #c1c1c1 #f1f1f1;
  min-height: 0;
}

.right-body {
  .right_body-con {
    margin: 15px;
    box-sizing: border-box;
    background-color: #fff;
    min-height: 101px;
    border-radius: 5px;
    border: 1px solid #dce3ec;

    .right_body_title {
      padding: 0 10px;
      min-height: 36px;
      line-height: 36px;
      display: flex;
      //justify-content: space-between;
      background-color: #f7fafe;
      border-bottom: 1px solid #edf2f9;

      .body-left {
        font-size: 14px;
        font-weight: 500px;
        color: #4d4d4d;
        line-height: 36px;
        display: flex;
        align-items: center;

        .left-time {
          margin-left: 15px;
          font-size: 13px;
          color: #4d4d4d;
          font-weight: 400px !important;
        }
      }

      .body-right {
        // margin-left: 15px;
        font-size: 13px;
        color: #4d4d4d;
      }
    }

    .line {
      border-bottom: 1px solid #edf2f9;
      width: 100%;
    }

    .right_body_http {
      padding: 8px 15px;
      min-height: 50px;
      line-height: 13px;
      color: #2c7be5;
      font-size: 13px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      position: relative;
      margin-bottom: 10px;

      .ip-row {
        display: flex;
        align-items: flex-start;
        margin-bottom: 5px;
      }

      .ip-list {
        display: flex;
        //flex-direction: column;
        flex-wrap: wrap;
        gap: 2px;
      }

      .ip-item {
        display: flex;
        align-items: flex-start;
        gap: 8px;
      }

      .right_ip {
        color: #4d4d4d;
        font-size: 13px;
        line-height: 20px;
      }

      .right_single_font {
        box-sizing: border-box;
        font-size: 13px;
        line-height: 20px;
        color: #4d4d4d;
      }

      .view-history-trigger {
        margin-top: 4px;
        cursor: pointer;
        text-align: left;
        font-size: 12px;
      }

      .loadMore {
        box-sizing: border-box;
        cursor: pointer;
        font-size: 12px;
        color: #2c7be5;
        text-align: left;
        margin: 10px 0 0px 5px;
        display: flex;
        align-content: center;
      }
    }

    .right_body_http .ip-row {
      margin-bottom: 10px;
      border-bottom: 1px solid #edf2f9;
      /* line-height: 30px; */
      min-height: 25px;
    }
  }
}

.visit-item-header {
  box-sizing: border-box;
  min-height: 15px;
  line-height: 18px;
  color: #4d4d4d;
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.visit-item-row {
  display: flex;
  box-sizing: border-box;
  align-items: stretch;
}

.visit-item-left {
  box-sizing: border-box;
  margin-right: 5px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.visit-item-divider {
  width: 1px;
  flex: 1;
  //background-color: #b8b8b8;
  background-color: #bbd6f9;
  margin-top: 3px;
}

.visit-item-time {
  flex: 0 0 120px;
  white-space: nowrap;
}

.visit-item-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  word-break: break-all;
}

.visit-item-title {
  min-width: 0;
  //white-space: nowrap;
  //overflow: hidden;
  //text-overflow: ellipsis;
}

.icon-circle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border: 1px solid #2c7be5;
  border-radius: 50%;
  font-size: 12px;
  color: #2c7be5;
  margin-right: 5px;
}
</style>
