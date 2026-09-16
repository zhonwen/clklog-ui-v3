<script setup lang="ts">
/**
 * 用户画像弹窗（对应 v2 `src/layout/components/dialog/userPortrait.vue`）。
 *
 * 和同目录的 index.vue（访客详情弹窗）是两份不同的实现：
 *   index.vue      → trackingapi/visitor，左侧「访客信息」，用 distinctIds 做主键
 *   userPortrait   → upsapi/userportrait，左侧「用户信息」+「用户属性」，右侧多一个
 *                    「用户画像 / 访问历史」的 tab（用户标签 / 用户分群），用 userId 做主键
 * ups 的个人画像页（views/ups/personalPortrait）用的是这一份。
 *
 * 对外只有一个入口：defineExpose({ callMethod })，与 v2 的 $refs.child.callMethod 对齐。
 */
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Link } from '@element-plus/icons-vue'
import {
  getUserDetailInfo,
  getUserProp,
  getUserSessionList,
  getUserSessionUriList,
} from '@/api/upsapi/userportrait'
import { getTagValueList } from '@/api/upsapi/tagmanage'
import { formatTime } from '@/utils/format'
import { formatUserPropValueByKey, openNewTab } from '@/utils/index'
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
  visitTime?: number | string
  pv?: number
  rows?: { clientIp?: string; province?: string }[]
  httpList: SessionUri[][]
  allHttpList: SessionUri[][]
  clickMore?: number
}

interface UserBaseInfo {
  userId?: string
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

/** 一条标签值 / 分群值 */
interface TagValue {
  valueType?: string
  valueDatetime?: string
  valueNumber?: number
  valueString?: string
  valueBoolean?: boolean
  tableName?: string
  displayName?: string
}

/** getTagValueList 返回的一组（type: 'tag' | 'group'） */
interface TagGroupRow {
  type?: string
  tableName?: string
  displayName?: string
  tagValues?: TagValue[]
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
const userId = ref<string | null>(null)
const clickIndex = ref(-1)
const visitListUrl = ref<SessionUri[] | null>(null)
/** 后端画像数据还在处理时为 true，弹窗显示「处理中，请稍后重试」 */
const refreshFlag = ref(false)
const activeTab = ref('userTag')
const userInfoLoading = ref(false)
const sessionListLoading = ref(false)
const sessionUriListLoading = ref(false)
const userProfileLoading = ref(false)
const userPropList = ref<Record<string, unknown>>({})
const userPropLoad = ref(false)
const portraitObj = ref<{ groupList: TagValue[]; tagList: TagValue[] }>({
  groupList: [],
  tagList: [],
})

/** 模板里 v-for 的用户属性：预先算好显示值，避免模板重复调 formatValue */
const userPropRows = computed(() =>
  Object.entries(userPropList.value).map(([key, value]) => ({
    key,
    text: formatUserPropValueByKey(key, value),
  })),
)

/**
 * 用户标签：模板里每行都要算一次展示值，这里一次算好。
 * label 对应 v2 模板的 `{{ item.displayName + " : " || "--" }}`
 * （与 v2 一致：拼接结果永远是非空串，所以 `|| "--"` 那一支永远走不到）。
 */
const tagRows = computed(() =>
  portraitObj.value.tagList.map((item) => ({
    label: `${item.displayName} : `,
    text: filterTagType(item),
  })),
)

/** 位置：v2 模板里的 country/province 拼接，提前算好避免模板里做字符串运算 */
const areaRows = computed(() =>
  (userBaseInfo.value.areaList || []).map((item) => ({
    head: item.country == '中国' ? '' : `${item.country}${item.province}`,
    province: item.province,
    city: item.city == item.province ? '' : item.city,
  })),
)

/**
 * 与 v2 一致（v2 此处逻辑存疑：方法名叫 isEmptyObject，返回值却是「非空」：
 * 空对象返回 false、非空返回 true，模板上是 v-if="isEmptyObject(userPropList)" 展示列表）。
 */
const hasUserProp = computed(() => Object.keys(userPropList.value).length !== 0)

function filterTagType(sub: TagValue) {
  switch (sub.valueType) {
    case 'Datetime':
      return sub.valueDatetime
    case 'Number':
      return sub.valueNumber
    case 'String':
      // v2 这里注释掉了 true/isSet -> 存在、false/notSet -> 不存在的映射，直接返回原值
      return sub.valueString
    case 'Boolean':
      return sub.valueBoolean ? '是' : '否'
  }
  // 与 v2 一致（v2 此处逻辑存疑：switch 没有 default，未知 valueType 返回 undefined）
  return undefined
}

function filterUrl(uri?: string) {
  const regExp = /^(http:\/\/|https:\/\/|www\.)/
  return regExp.test(uri || '')
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
 * 外部调用入口（v2 是 `this.$refs.child.callMethod(val, "个人画像")`）。
 * 第二个参数 v2 就没有用到，这里不再声明。
 *
 * 实时访问和用户行为页在弹窗里看详情，其它页面跳到独立的用户详情页。
 */
function callMethod(val: string) {
  // 点击用户ID跳转用户详情页
  if (route.name === 'access' || route.name === 'userBehavior') {
    userPropList.value = {}
    userId.value = val
    activeTab.value = 'userTag'
    getVisitorDetailinfo()
    getTagValueListApi() // 用户标签模块列表
    centerDialogVisible.value = true
    currentPage.value = 1
    visitListUrl.value = null
  } else {
    openNewTab({
      name: 'userInfo',
      query: { projectName: projectName.value, userId: val },
    })
  }
}

/**
 * el-tabs 的 tab-click。参数结构上兼容 element-plus 的 TabsPaneContext，
 * 但这里把 index 放宽成 string | number —— v2 用的是 `val.index == 1` 这种宽松比较，
 * 直接用 TabsPaneContext（index: string | undefined）会让这行编译不过。
 */
function handleTabEvent(pane: { index?: string | number }) {
  if (pane.index == 1) {
    getVisitorSessionList()
  } else {
    getTagValueListApi() // 用户标签模块列表
  }
}

function getTagValueListApi() {
  userProfileLoading.value = true
  const params = { projectName: projectName.value, userId: userId.value }
  getTagValueList(params)
    .then((res) => {
      if (res?.data) {
        const list = (res.data as TagGroupRow[]) || []
        const tagList = list.filter((item) => item.type === 'tag')
        const groupList = list.filter((item) => item.type === 'group')
        portraitObj.value.tagList = []
        tagList.forEach((item) => {
          ;(item.tagValues || []).forEach((tagValue) => {
            portraitObj.value.tagList.push({
              ...tagValue,
              tableName: item.tableName,
              displayName: item.displayName,
            })
          })
        })
        portraitObj.value.groupList = []
        groupList.forEach((item) => {
          ;(item.tagValues || []).forEach((tagValue) => {
            portraitObj.value.groupList.push({
              ...tagValue,
              tableName: item.tableName,
              displayName: item.displayName,
            })
          })
        })
        userProfileLoading.value = false
      }
    })
    .catch(() => {
      userProfileLoading.value = false
    })
}

// 左侧内容
function getVisitorDetailinfo() {
  const params = { projectName: projectName.value, userId: userId.value }
  userInfoLoading.value = true
  userPropLoad.value = true
  getUserDetailInfo(params)
    .then((res) => {
      refreshFlag.value = false
      userInfoLoading.value = false
      if (res?.code == 200) {
        const data = res.data as UserBaseInfo | null
        if (data) {
          userBaseInfo.value = { ...data, avgPv: Math.floor(Number(data.avgPv)) }

          getUserProp(params)
            .then((propRes) => {
              if (propRes?.data) {
                userPropLoad.value = false
                userPropList.value = (propRes.data as Record<string, unknown>) || {}
              }
            })
            .catch(() => {
              userPropLoad.value = false
            })
        } else {
          refreshFlag.value = true
        }
      }
    })
    .catch(() => {
      userInfoLoading.value = false
      userPropLoad.value = false
    })
}

// 右侧内容
function getVisitorSessionList() {
  sessionListLoading.value = true
  const params = {
    userId: userId.value,
    pageNum: currentPage.value,
    pageSize: pageSize.value,
    projectName: projectName.value,
  }
  getUserSessionList(params)
    .then((res) => {
      sessionListLoading.value = false
      if (res?.code == 200) {
        const data = res.data as { total?: number; rows?: VisitorSession[] } | null
        total.value = Number(data?.total || 0)
        visitorSessionList.value = (data?.rows || []).map((item) => ({
          ...item,
          httpList: [],
          allHttpList: [],
          visitTime: formatTime(Math.floor(Number(item.visitTime))),
        }))
        // 初始加载第一页
        const first = visitorSessionList.value[0]
        if (first) {
          toVisitHttp(first, 0)
        }
      }
    })
    .catch(() => {
      sessionListLoading.value = false
    })
}

// 点击事件调用接口数据
// firstTime  yyyy-MM-dd HH:mm:ss
function getVisitorSessionUriList(val: VisitorSession) {
  sessionUriListLoading.value = true
  const params = {
    pageNum: 1,
    pageSize: val.pv,
    userId: val.userId,
    eventSessionId: val.eventSessionId,
    projectName: projectName.value,
    firstTime: val.firstTime,
  }
  getUserSessionUriList(params)
    .then((res) => {
      sessionUriListLoading.value = false
      if (res?.code == 200) {
        const rows = (res.data as { rows?: SessionUri[] } | null)?.rows || []
        visitListUrl.value = rows
        const firstRow = rows[0]
        if (!firstRow) return
        visitorSessionList.value?.forEach((i) => {
          if (i.eventSessionId == firstRow.eventSessionId) {
            // v2 这里分了 httpList.length > 0 先清空再 push 两种写法，结果等价于直接覆盖
            i.httpList = [JSON.parse(JSON.stringify(rows.slice(0, 10))) as SessionUri[]]
            i.allHttpList = [JSON.parse(JSON.stringify(rows)) as SessionUri[]]
          }
        })
      }
    })
    .catch(() => {
      sessionUriListLoading.value = false
    })
}

// 触发点击接口事件内容
function toVisitHttp(val: VisitorSession, index: number) {
  visitListUrl.value = null // 重新赋值
  getVisitorSessionUriList(val)
  clickIndex.value = index
}

function tomoreEvent(item: VisitorSession, index: number) {
  if (item.clickMore) {
    if (item.clickMore + 10 > Number(item.pv)) {
      item.clickMore = Number(item.pv)
    } else {
      item.clickMore = item.clickMore + 10
    }
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
          <div v-loading="userInfoLoading" class="visitorInfo commonBackgrond public-hoverItem">
            <div class="setImg">
              <img :src="avatorImg" alt="" />
            </div>
            <div class="visitDetail">
              <div class="title common-title">用户信息</div>
              <div style="display: flex">
                <div class="gap" style="width: 100%">
                  <div style="display: flex">
                    <div
                      v-if="userBaseInfo && userBaseInfo.userId"
                      class="lable setFont"
                      style="width: 50%; padding-right: 10px"
                    >
                      ID:
                      <el-popover
                        v-if="userBaseInfo.userId.length > 23"
                        placement="top-start"
                        trigger="hover"
                      >
                        <template #reference>
                          <div class="overItem" style="cursor: pointer">
                            {{ userBaseInfo.userId || '--' }}
                          </div>
                        </template>
                        <div style="font-size: 12px">
                          {{ userBaseInfo.userId }}
                        </div>
                      </el-popover>
                      <div v-else class="overItem">
                        {{ userBaseInfo.userId || '--' }}
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

          <div v-loading="userInfoLoading" class="total commonBackgrond public-hoverItem">
            <div class="total_lable common-title">总计</div>
            <div class="total-head setFont">
              此用户在{{ userBaseInfo.visitCount }}次的访问中，共访问了{{ userBaseInfo.pv }}个页面，
              访问总耗时为{{ formatTimeData(userBaseInfo.visitTime) }}。
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

          <div
            v-loading="userPropLoad"
            class="tagBlock commonBackgrond public-hoverItem"
            style="margin-top: 20px"
          >
            <span class="device-label common-title"> 用户属性 </span>
            <div style="max-height: 400px; overflow: auto">
              <div
                v-if="hasUserProp"
                class="tagList"
                style="margin-top: 10px; display: flex; width: 100%; box-sizing: border-box"
              >
                <div
                  v-for="item in userPropRows"
                  :key="item.key"
                  class="listItem"
                  style="display: flex; min-width: 50%"
                >
                  <div style="display: flex; min-width: 50%">
                    <p>{{ item.key }}:</p>
                    <span style="margin-left: 5px">{{ item.text }}</span>
                  </div>
                </div>
              </div>
              <div v-else style="height: 100px; width: 100%; text-align: center; line-height: 70px">
                暂无数据
              </div>
            </div>
          </div>

          <div v-loading="userInfoLoading" class="device commonBackgrond public-hoverItem">
            <span class="device-label common-title">设备</span>
            <div class="describe setFont">
              {{ userBaseInfo.manufacturer }}
            </div>
          </div>
          <div v-loading="userInfoLoading" class="whereFrom commonBackgrond public-hoverItem">
            <span class="device-label common-title"> 位置 </span>
            <div
              class="describe setFont"
              style="display: flex; flex-direction: column; line-height: 20px; margin-top: 5px"
            >
              <div style="display: flex; flex-wrap: wrap">
                <div
                  v-for="(item, index) in areaRows"
                  :key="index"
                  style="display: flex; margin-right: 10px; margin-top: 5px; box-sizing: border-box"
                >
                  {{ item.head }}
                  {{ item.province }}
                  <div class="number" style="white-space: nowrap">
                    {{ item.city }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div
          class="right-item commonBackgrond"
          :style="activeTab == 'userTag' ? 'min-height:500px' : 'min-height:900px'"
        >
          <el-tabs v-model="activeTab" @tab-click="handleTabEvent">
            <el-tab-pane label="用户画像" name="userTag">
              <div v-loading="userProfileLoading">
                <!-- 用户标签 -->
                <div class="tagBlock commonBackgrond public-hoverItem">
                  <div class="common-title">用户标签</div>
                  <div
                    class="tagList"
                    style="display: flex; margin-top: 5px; max-height: 300px; overflow-y: auto"
                  >
                    <div
                      v-for="(item, index) in tagRows"
                      :key="index"
                      style="
                        display: flex;
                        flex-wrap: wrap;
                        overflow-y: auto;
                        margin-bottom: 15px;
                      "
                    >
                      <div style="display: flex; margin-right: 50px">
                        <div>
                          {{ item.label }}
                        </div>
                        <p style="color: #2c7be5; margin-left: 5px">
                          {{ item.text }}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div
                    v-show="portraitObj.tagList.length == 0"
                    style="display: flex; align-items: center; justify-content: center; height: 80px"
                  >
                    暂无数据
                  </div>
                </div>
                <!-- 用户分群 -->
                <div class="tagBlock commonBackgrond public-hoverItem" style="margin-top: 20px">
                  <div class="common-title">用户分群</div>
                  <div
                    class="tagList"
                    style="display: flex; margin-top: 5px; max-height: 300px; overflow-y: auto"
                  >
                    <div
                      v-for="(item, index) in portraitObj.groupList"
                      :key="index"
                      style="display: flex; flex-wrap: wrap; overflow-y: auto"
                      :style="index == 0 ? '' : 'margin-bottom:15px'"
                    >
                      <div style="display: flex; margin-right: 50px">
                        {{ item.displayName }}
                      </div>
                    </div>
                  </div>
                  <div
                    v-show="portraitObj.groupList.length == 0"
                    style="display: flex; align-items: center; justify-content: center; height: 80px"
                  >
                    暂无数据
                  </div>
                </div>
              </div>
            </el-tab-pane>
            <el-tab-pane label="访问历史" name="visitHistory" />

            <el-row v-if="activeTab == 'visitHistory'">
              <div v-loading="sessionListLoading">
                <div class="right-head"></div>
                <div class="warry-body">
                  <div
                    v-for="(item, index) in visitorSessionList"
                    :key="index"
                    class="right-body"
                  >
                    <div class="right_body-con public-hoverItem">
                      <div class="right_body_title">
                        <div class="body-left common-title">访问#{{ getIndex(index) }}</div>
                        <div class="body-right">{{ item.firstTime }} &nbsp;&nbsp;</div>
                      </div>
                      <div class="line"></div>
                      <div class="right_body_http">
                        <div class="right_ip">IP：</div>
                        <div v-for="(ipItem, ip_idx) in item.rows" :key="ip_idx">
                          <div
                            style="
                              display: flex;
                              align-items: center;
                              height: 28px;
                              padding-left: 23px;
                            "
                          >
                            <span class="right_single_font">{{ ipItem.clientIp }}</span>
                            <span class="right_single_font">{{ ipItem.province }}</span>
                          </div>
                        </div>
                        <div
                          v-loading="clickIndex == index && sessionUriListLoading"
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
                          <div v-for="(val, val_idx) in item.httpList[0] ?? []" :key="val_idx">
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
                                    border-left: 1px solid #b8b8b8;
                                    margin-top: 3px;
                                  "
                                ></div>
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
                                  <a v-if="filterUrl(val.uri)" :href="val.uri" target="_blank">{{
                                    val.uri
                                  }}</a>
                                  <div v-else style="color: #4d4d4d">
                                    {{ val.uri }}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div
                            v-if="
                              item.httpList.length > 0 &&
                              Number(item.pv) > (item.httpList[0]?.length ?? 0)
                            "
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
            </el-row>
          </el-tabs>
        </div>
      </div>
      <div
        v-else
        style="height: 700px; text-align: center; margin-top: 400px; cursor: pointer"
      >
        用户访问详细画像数据处理中，请稍后重试
        <div>点击刷新</div>
      </div>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
// v2 这里是 @import "~@/styles/components/el-pagination.scss"，v3 已全局引入，不再重复

:deep(.el-tabs__item) {
  font-size: 15px;
  font-weight: bold !important;
}

:deep(.el-tabs__header) {
  padding: 0 15px;
  background: #fff;
  border-radius: 6px;
}

:deep(.el-tabs__nav-wrap::after) {
  background: #fff;
}

:deep(.el-dialog__header) {
  background-color: #edf2f9;
}

:deep(.el-dialog__body) {
  background-color: #edf2f9;
  padding: 15px 15px;
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
        color: rgb(77, 77, 77);
        white-space: nowrap;
        align-items: center;
        text-overflow: ellipsis;
        box-sizing: border-box;
        overflow: hidden;

        span {
          box-sizing: border-box;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 26px;
          color: rgb(77, 77, 77);
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
        color: rgb(77, 77, 77);
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
      color: rgb(77, 77, 77);

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

  .tagBlock {
    padding: 15px;
    min-height: 170px;

    .tagList {
      display: flex;
      flex-wrap: wrap;
      box-sizing: border-box;
      width: 100%;

      .listItem {
        box-sizing: border-box;
        padding-right: 10px;
        font-size: 14px;
        line-height: 22px;
        margin-bottom: 10px;

        p {
          color: rgb(77, 77, 77);
        }

        span {
          color: #9b9b9b;
        }
      }
    }
  }

  .right-item {
    min-height: 500px;
    width: 50%;
    background-color: #edf2f9;
    padding-right: 20px;

    .device-label {
      font-size: 14px;
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
            font-weight: 500px;
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
