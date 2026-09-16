<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Link } from '@element-plus/icons-vue'
import {
  getVisitorDetailinfoApi,
  getVisitorSessionListApi,
  getVisitorSessionUriListApi,
} from '@/api/trackingapi/visitor'
import { formatTime } from '@/utils/format'
import { openNewTab } from '@/utils/index'
import { useTrackingStore } from '@/stores/tracking'
import avatorImg from '@/assets/images/avator.png'

/** 访问明细里的单个页面 */
interface SessionUri {
  eventSessionId?: string
  logTime?: string
  title?: string
  uri?: string
}

/** 一次访问（session） */
interface VisitorSession {
  eventSessionId?: string
  userId?: string
  firstTime?: string
  visitTime?: string
  pv?: number
  rows?: { clientIp?: string; province?: string }[]
  httpList: SessionUri[][]
  allHttpList: SessionUri[][]
  clickMore?: number
}

interface UserBaseInfo {
  distinctIds?: string
  visitorType?: string
  country?: string
  city?: string
  channel?: string
  client_ip?: string
  visitCount?: number
  pv?: number
  visitTime?: number
  avgVisitTime?: number
  avgPv?: number
  firstTime?: string
  latestTime?: string
  manufacturer?: string
  areaList?: { country?: string; province?: string; city?: string }[]
}

const route = useRoute()
const trackingStore = useTrackingStore()
const projectName = computed(() => trackingStore.projectName)

const total = ref(0)
const pageSize = ref(10)
const currentPage = ref(1)
const centerDialogVisible = ref(false)
const userBaseInfo = ref<UserBaseInfo>({})
const visitorSessionList = ref<VisitorSession[] | null>(null)
const currentDistinctId = ref<string | null>(null)
const loading = ref(false)
const detailLoading = ref(false)
const sessionListLoading = ref(false)
const clickIndex = ref(-1)
const visitListUrl = ref<SessionUri[] | null>(null)
/** 后端画像数据还在处理时为 true，弹窗显示提示文案 */
const refreshFlag = ref(false)

function filterUrl(uri?: string) {
  return /^(http:\/\/|https:\/\/|www\.)/.test(uri || '')
}

function formatTimeData(val?: number) {
  return formatTime(Math.floor(Number(val || 0)))
}

/** 右侧访问序号是倒序的：总数减去已翻过的页数 */
function getIndex(index: number) {
  return total.value - ((currentPage.value - 1) * pageSize.value + index)
}

function resetForm() {
  userBaseInfo.value = {}
}

/**
 * 外部调用入口（v2 是 this.$refs.child.callMethod(distinctId)）。
 * 实时访问和用户行为页在弹窗里看详情，其它页面跳转到独立的用户详情页。
 */
function callMethod(val: string) {
  if (route.name === 'access' || route.name === 'userBehavior') {
    currentDistinctId.value = val
    currentPage.value = 1
    visitListUrl.value = null
    centerDialogVisible.value = true
    getVisitorDetailinfo()
    getVisitorSessionList()
  } else {
    openNewTab({
      name: 'userInfo',
      query: { projectName: projectName.value, userId: val },
    })
  }
}

// 左侧：用户基本信息
function getVisitorDetailinfo() {
  detailLoading.value = true
  getVisitorDetailinfoApi({ projectName: projectName.value, userId: currentDistinctId.value })
    .then((res) => {
      detailLoading.value = false
      if (res?.code == 200) {
        const data = res.data as UserBaseInfo | null
        if (data && data.distinctIds) {
          refreshFlag.value = false
          userBaseInfo.value = { ...data, avgPv: Math.floor(Number(data.avgPv || 0)) }
        } else {
          refreshFlag.value = true
        }
      }
    })
    .catch(() => {
      detailLoading.value = false
    })
}

// 右侧：访问列表
function getVisitorSessionList() {
  sessionListLoading.value = true
  getVisitorSessionListApi({
    userId: currentDistinctId.value,
    pageNum: currentPage.value,
    pageSize: pageSize.value,
    projectName: projectName.value,
  })
    .then((res) => {
      sessionListLoading.value = false
      if (res?.code == 200) {
        const data = res.data as { total?: number; rows?: VisitorSession[] }
        total.value = Number(data?.total || 0)
        visitorSessionList.value = (data?.rows || []).map((item) => ({
          ...item,
          httpList: [],
          allHttpList: [],
          visitTime: formatTime(Math.floor(Number(item.visitTime || 0))),
        }))
        // 默认展开第一次访问
        if (visitorSessionList.value.length > 0) {
          toVisitHttp(visitorSessionList.value[0]!, 0)
        }
      }
    })
    .catch(() => {
      sessionListLoading.value = false
    })
}

// 单次访问的页面明细
function getVisitorSessionUriList(val: VisitorSession) {
  getVisitorSessionUriListApi({
    pageNum: 1,
    pageSize: val.pv,
    eventSessionId: val.eventSessionId,
    userId: val.userId,
    projectName: projectName.value,
    firstTime: val.firstTime,
  })
    .then((res) => {
      loading.value = false
      if (res?.code != 200) return
      const rows = (res.data as { rows?: SessionUri[] })?.rows || []
      visitListUrl.value = rows
      if (rows.length === 0) return
      // 先展示前 10 条，其余留给「加载更多」
      visitorSessionList.value?.forEach((i) => {
        if (i.eventSessionId == rows[0]?.eventSessionId) {
          i.httpList = [JSON.parse(JSON.stringify(rows.slice(0, 10))) as SessionUri[]]
          i.allHttpList = [JSON.parse(JSON.stringify(rows)) as SessionUri[]]
        }
      })
    })
    .catch(() => {
      loading.value = false
    })
}

function toVisitHttp(val: VisitorSession, index: number) {
  visitListUrl.value = null
  clickIndex.value = index
  loading.value = true
  getVisitorSessionUriList(val)
}

function tomoreEvent(item: VisitorSession, index: number) {
  if (item.clickMore) {
    item.clickMore = item.clickMore + 10 > Number(item.pv) ? Number(item.pv) : item.clickMore + 10
  } else {
    item.clickMore = 20
  }
  const copyArray = JSON.parse(JSON.stringify(visitorSessionList.value)) as VisitorSession[]
  const next = JSON.parse(
    JSON.stringify((item.allHttpList[0] || []).slice(0, item.clickMore)),
  ) as SessionUri[]
  const target = copyArray[index]
  if (target) target.httpList = [next]
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

defineExpose({ callMethod })
</script>

<template>
  <div>
    <el-dialog
      v-model="centerDialogVisible"
      :modal-append-to-body="false"
      width="80%"
      top="8vh"
      @close="resetForm"
    >
      <div v-if="!refreshFlag" class="el-dialog-div">
        <div class="left-item">
          <div v-loading="detailLoading" class="visitorInfo commonBackgrond public-hoverItem">
            <div class="setImg">
              <img :src="avatorImg" alt="" />
            </div>
            <div class="visitDetail">
              <div class="title common-title">访客信息</div>
              <div style="display: flex">
                <div class="gap" style="width: 100%">
                  <div style="display: flex">
                    <div
                      v-if="userBaseInfo && userBaseInfo.distinctIds"
                      class="lable setFont"
                      style="width: 50%; padding-right: 10px"
                    >
                      ID:
                      <el-popover
                        v-if="userBaseInfo.distinctIds.length > 23"
                        placement="top-start"
                        trigger="hover"
                      >
                        <template #reference>
                          <div class="overItem" style="cursor: pointer">
                            {{ userBaseInfo.distinctIds || '--' }}
                          </div>
                        </template>
                        <div style="font-size: 12px">{{ userBaseInfo.distinctIds }}</div>
                      </el-popover>
                      <div v-else class="overItem">
                        {{ userBaseInfo.distinctIds || '--' }}
                      </div>
                    </div>
                    <div
                      v-if="userBaseInfo.visitorType"
                      class="lable"
                      style="width: 50%; text-align: right; padding-left: 10px"
                    >
                      类型：
                      <span>{{ userBaseInfo.visitorType }}</span>
                    </div>
                  </div>

                  <div style="display: flex; justify-content: space-between">
                    <div
                      v-if="userBaseInfo.country || userBaseInfo.city"
                      class="lable"
                      style="width: 50%; text-align: left"
                    >
                      地域：
                      <span>{{ userBaseInfo.country }} {{ userBaseInfo.city }}</span>
                    </div>
                  </div>
                  <div v-if="userBaseInfo.channel" class="lable">
                    渠道：
                    <span>{{ userBaseInfo.channel }}</span>
                  </div>
                </div>
              </div>
              <div
                v-if="userBaseInfo.client_ip"
                style="
                  width: 100%;
                  overflow: hidden;
                  white-space: nowrap;
                  text-overflow: ellipsis;
                  padding-top: 7px;
                "
              >
                IP：
                <span>{{ userBaseInfo.client_ip }}</span>
              </div>
            </div>
          </div>

          <div v-loading="detailLoading" class="total commonBackgrond public-hoverItem">
            <div class="total_lable common-title">总计</div>
            <div class="total-head setFont">
              此用户在{{ userBaseInfo.visitCount }}次的访问中，共访问了{{ userBaseInfo.pv }}个页面，
              访问总耗时为 {{ formatTimeData(userBaseInfo.visitTime) }}。
              <br />每次访问的平均访问时长为{{ formatTimeData(userBaseInfo.avgVisitTime) }}，
              平均访问页数为{{ userBaseInfo.avgPv }} 页。
            </div>
            <div class="visit_Time">
              <div class="firstTime">
                <span>首次访问时间</span>
                <div class="detailTime">{{ userBaseInfo.firstTime }}</div>
              </div>
              <div class="lastTime">
                <span>最后访问时间</span>
                <div class="detailTime">{{ userBaseInfo.latestTime }}</div>
              </div>
            </div>
          </div>

          <div v-loading="detailLoading" class="device commonBackgrond public-hoverItem">
            <span class="device-label common-title">设备</span>
            <div class="describe setFont">{{ userBaseInfo.manufacturer }}</div>
          </div>
          <div v-loading="detailLoading" class="whereFrom commonBackgrond public-hoverItem">
            <span class="device-label common-title">位置</span>
            <div
              class="describe setFont"
              style="display: flex; flex-direction: column; line-height: 20px; margin-top: 5px"
            >
              <div style="display: flex; flex-wrap: wrap">
                <div
                  v-for="(item, index) in userBaseInfo.areaList"
                  :key="index"
                  style="display: flex; margin-right: 10px; margin-top: 5px; box-sizing: border-box"
                >
                  {{ item.country == '中国' ? '' : (item.country || '') + (item.province || '') }}
                  {{ item.province }}
                  <div class="number" style="white-space: nowrap">
                    {{ item.city == item.province ? '' : item.city }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="right-item commonBackgrond">
          <div class="right-head" />
          <div v-loading="sessionListLoading" class="warry-body">
            <div v-for="(item, index) in visitorSessionList" :key="index" class="right-body">
              <div class="right_body-con public-hoverItem">
                <div class="right_body_title">
                  <div class="body-left common-title">访问#{{ getIndex(index) }}</div>
                  <div class="body-right">{{ item.firstTime }} &nbsp;&nbsp;</div>
                </div>
                <div class="line" />
                <div class="right_body_http">
                  <div class="right_ip">IP：</div>
                  <div v-for="(ipItem, ip_idx) in item.rows" :key="ip_idx">
                    <div
                      style="display: flex; align-items: center; height: 28px; padding-left: 23px"
                    >
                      <span class="right_single_font">{{ ipItem.clientIp }}</span>
                      <span class="right_single_font">{{ ipItem.province }}</span>
                    </div>
                  </div>
                  <div
                    v-loading="clickIndex == index && loading"
                    style="
                      line-height: 20px;
                      box-sizing: border-box;
                      padding-bottom: 20px;
                      cursor: pointer;
                    "
                    @click="toVisitHttp(item, index)"
                  >
                    {{ item.visitTime }}中的{{ item.pv }}个页面
                  </div>

                  <div
                    v-if="item.httpList.length > 0"
                    style="
                      text-align: left;
                      max-height: 500px;
                      overflow-y: auto;
                      overflow-x: hidden;
                    "
                  >
                    <div v-for="(val, val_idx) in item.httpList[0]" :key="val_idx">
                      <div style="display: flex; box-sizing: border-box">
                        <div
                          style="
                            box-sizing: border-box;
                            margin-right: 25px;
                            height: 100%;
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                          "
                        >
                          <el-icon style="font-size: 16px"><Link /></el-icon>
                          <div
                            style="
                              width: 1px;
                              min-height: 30px;
                              margin-top: 3px;
                              border-left: 1px solid #b8b8b8;
                            "
                          />
                        </div>
                        <div>
                          <div
                            style="
                              box-sizing: border-box;
                              min-height: 15px;
                              line-height: 18px;
                              color: #4d4d4d;
                            "
                          >
                            <div>{{ val.logTime }}</div>
                            <div>{{ val.title }}</div>
                          </div>
                          <div
                            style="
                              box-sizing: border-box;
                              min-height: 15px;
                              line-height: 18px;
                              margin-bottom: 10px;
                            "
                          >
                            <a v-if="filterUrl(val.uri)" :href="val.uri" target="_blank">
                              {{ val.uri }}
                            </a>
                            <div v-else style="color: #4d4d4d">{{ val.uri }}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div
                      v-if="item.httpList.length > 0 && Number(item.pv) > (item.httpList[0]?.length || 0)"
                      class="loadMore"
                      @click="tomoreEvent(item, index)"
                    >
                      加载更多
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="block">
            <el-pagination
              v-if="visitorSessionList && visitorSessionList.length > 0"
              next-text="下一页"
              :pager-count="5"
              :current-page="currentPage"
              :page-size="pageSize"
              :total="total"
              @size-change="handleSizeChange"
              @current-change="handleCurrentChange"
            />
          </div>
        </div>
      </div>
      <div
        v-else
        style="height: 700px; text-align: center; margin-top: 400px; cursor: pointer"
      >
        用户访问详细画像数据处理中，请稍后重试
      </div>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
// 分页样式在 src/styles/index.scss 全局引入一次（sass 不允许 @use 出现在嵌套块里）
:deep() {
  .el-dialog__header {
    background-color: #edf2f9;
  }

  .el-dialog__body {
    background-color: #edf2f9;
    padding: 15px 15px;
  }
}

.setFont {
  font-size: 14px;
}

.commonBackgrond {
  background-color: #fff;
}

.common-title {
  font-size: 15px;
  font-weight: 600;
  line-height: 31px;
  color: #4d4d4d !important;
}

.el-dialog-div {
  display: flex;
  justify-content: center;

  .left-item {
    min-height: 900px;
    width: 50%;
    padding: 0 20px;
    box-sizing: border-box;

    .visitorInfo {
      width: 100%;
      overflow: hidden;
      min-height: 100px;
      border-radius: 6px;
      display: flex;
      padding: 15px;
      box-sizing: border-box;

      .setImg {
        width: 90px;
        height: 100%;
        display: flex;
        margin-top: 7px;
        box-sizing: border-box;

        img {
          width: 89px;
          height: 90px;
          object-fit: cover;
          background: rgba(0, 0, 0, 0);
          border-radius: 50%;
        }
      }

      .visitDetail {
        box-sizing: border-box;
        overflow: hidden;
        min-height: 100px;
        margin-left: 20px;
      }

      .lable {
        display: flex;
        line-height: 26px;
        font-weight: 500;
        color: #5a607f;
        align-items: center;
        text-overflow: ellipsis;
        box-sizing: border-box;
        overflow: hidden;
        white-space: nowrap;

        span {
          box-sizing: border-box;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 26px;
          color: #5a607f;
        }
      }
    }

    .total {
      margin-top: 20px;
      min-height: 140px;
      border-radius: 6px;
      padding: 15px;

      .visit_Time {
        display: flex;
        padding-top: 15px;
        font-size: 13px;
        font-weight: 500;
        line-height: 20px;
        color: #2c7be5;

        .firstTime {
          width: 100%;
          text-align: left;
        }

        .lastTime {
          width: 100%;
          text-align: left;
        }

        .detailTime {
          padding-top: 5px;
        }
      }

      .total-head {
        line-height: 20px;
        color: #5a607f;
      }
    }

    .device {
      height: 76px;
      border-radius: 6px;
      padding: 15px;
      margin-top: 20px;
    }

    .describe {
      box-sizing: border-box;
      display: flex;
      line-height: 27px;
      color: #5a607f;

      .number {
        font-size: 18px;
        color: #2c7be5;
        font-weight: 500;
      }
    }

    .whereFrom {
      padding: 15px;
      box-sizing: border-box;
      margin-top: 20px;
      min-height: 50px;
      border-radius: 6px;
      display: flex;
      flex-direction: column;
    }
  }

  .right-item {
    min-height: 900px;
    width: 50%;
    background-color: #edf2f9;
    padding-right: 20px;

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
      height: 830px;
      overflow-y: auto;
      overflow-x: hidden;
    }

    .right-body {
      .right_body-con {
        padding: 5px 15px;
        box-sizing: border-box;
        width: 100%;
        background-color: #fff;
        min-height: 101px;
        margin-bottom: 20px;
        border-radius: 5px;

        .right_body_title {
          min-height: 50px;
          line-height: 50px;
          display: flex;
          justify-content: space-between;

          .body-left {
            font-size: 15px;
            color: #4d4d4d;
            line-height: 50px;
          }

          .body-right {
            font-size: 13px;
            color: #4d4d4d;
          }
        }

        .line {
          border-bottom: 1px solid #edf2f9;
          width: 100%;
        }

        .right_body_http {
          min-height: 50px;
          line-height: 13px;
          color: #2c7be5;
          font-size: 13px;
          text-align: right;
          position: relative;

          .right_ip {
            position: absolute;
            top: 10px;
            color: #4d4d4d;
            font-size: 13px;
          }

          .right_single_font {
            box-sizing: border-box;
            font-size: 13px;
            line-height: 28px;
            color: #4d4d4d;
            margin-top: 5px;
            margin-right: 5px;
          }

          .loadMore {
            box-sizing: border-box;
            padding-bottom: 20px;
            cursor: pointer;
            font-size: 12px;
            color: #4d4d4d;
            text-align: center;
          }
        }
      }
    }
  }
}
</style>
