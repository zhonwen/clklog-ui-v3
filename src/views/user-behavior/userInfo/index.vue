<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { DocumentCopy } from '@element-plus/icons-vue'
import TabPaneType from './components/tab-pane-type.vue'
import {
  getUserPropApi,
  getVisitorDetailinfoApi,
} from '@/api/trackingapi/visitor'
import { getUserListNewApi } from '@/api/trackingapi/userreview'
import { getTagValueList } from '@/api/upsapi/tagmanage'
import { formatUserPropValueByKey } from '@/utils/index'
import { useLatestOnly } from '@/composables/useLatestOnly'
import type { TagGroupRow, TagValue, UserBaseInfo, UserObjInfo } from './types'

defineOptions({ name: 'UserInfoPage' })

const route = useRoute()

const { next: nextUserList, isLatest: isLatestUserList } = useLatestOnly()
const { next: nextDetailInfo, isLatest: isLatestDetailInfo } = useLatestOnly()
const { next: nextUserProp, isLatest: isLatestUserProp } = useLatestOnly()
const { next: nextTagValue, isLatest: isLatestTagValue } = useLatestOnly()

const rootRef = ref<HTMLDivElement | null>(null)

const userNotFound = ref(false)
const pageLoading = ref(false)
const userBaseInfo = ref<UserBaseInfo>({})
const visitorSessionList = ref<unknown[] | null>(null)
const userId = ref<string | null>(null)
const userObjInfo = ref<UserObjInfo>({})
const userTagList = ref<unknown[]>([])
const userInfoLoading = ref(false)
const userProfileLoading = ref(false)
const userPropList = ref<Record<string, unknown>>({})
const userPropLoad = ref(false)
const portraitObj = ref<{ groupList: TagValue[]; tagList: TagValue[] }>({
  groupList: [],
  tagList: [],
})
const labelColWidth = ref(100)
const tabType = ref(
  (typeof route.query.tabType === 'string' && route.query.tabType) || 'user-portrait',
)

const projectName = computed(() => {
  const name = route.query.projectName
  return (typeof name === 'string' && name) || null
})

/** 模板里 v-for 的用户属性：预先算好显示值，避免模板重复调 formatValue */
const userPropRows = computed(() =>
  Object.entries(userPropList.value).map(([key, value]) => ({
    key,
    text: formatUserPropValueByKey(key, value),
  })),
)

const userIdForCopy = computed(
  () => userObjInfo.value.userId || (userBaseInfo.value && userBaseInfo.value.userId),
)

function copyRowId(id: string | undefined) {
  const textarea = document.createElement('textarea')
  textarea.value = id || ''
  document.body.appendChild(textarea)
  textarea.select()
  try {
    document.execCommand('copy')
    ElMessage.success('复制成功')
  } catch {
    ElMessage.error('复制失败')
  }
  document.body.removeChild(textarea)
}

function isEmptyObject(list: Record<string, unknown>) {
  if (list && Object.keys(list).length === 0) {
    return false
  }
  return true
}

function filterTagType(sub: TagValue) {
  switch (sub.valueType) {
    case 'Datetime':
      return sub.valueDatetime
    case 'Number':
      return sub.valueNumber
    case 'String':
      return sub.valueString
    case 'Boolean':
      return sub.valueBoolean ? '是' : '否'
  }
  // 与 v2 一致（v2 此处逻辑存疑：switch 没有 default，未知 valueType 返回 undefined，模板渲染为空）
  return undefined
}

function clearUserInfo() {
  // 清空用户画像数据
  userObjInfo.value = {}
  userBaseInfo.value = {}
  portraitObj.value = { groupList: [], tagList: [] }
  visitorSessionList.value = []
  userPropList.value = {}
}

function updateUserPropLabelWidth() {
  nextTick(() => {
    try {
      const el = rootRef.value
      if (!el) {
        labelColWidth.value = 90
        return
      }
      const nodes = el.querySelectorAll<HTMLElement>('.user-prop-list .listItem p')
      let max = 0
      nodes.forEach((n) => {
        const prevWidth = n.style.width
        const prevWs = n.style.whiteSpace
        n.style.width = 'auto'
        n.style.whiteSpace = 'nowrap'
        const w = Math.ceil(n.scrollWidth || n.offsetWidth || 0)
        n.style.width = prevWidth || ''
        n.style.whiteSpace = prevWs || ''
        if (w > max) max = w
      })
      max = Math.min(130, Math.max(70, max || 0))
      labelColWidth.value = max
    } catch {
      labelColWidth.value = 90
    }
  })
}

function getTagValueListApi() {
  userProfileLoading.value = true
  const params = { projectName: projectName.value, userId: userId.value }
  userTagList.value = []
  const token = nextTagValue()
  getTagValueList(params)
    .then((res) => {
      if (!isLatestTagValue(token)) return
      if (res?.data) {
        const rows = res.data as TagGroupRow[]
        const tagList = rows.filter((item) => item.type === 'tag')
        const groupList = rows.filter((item) => item.type === 'group')
        portraitObj.value.tagList = []
        tagList.forEach((item) => {
          item.tagValues.forEach((tagValue) => {
            const newTagValue = {
              ...tagValue,
              tableName: item.tableName,
              displayName: item.displayName,
            }
            portraitObj.value.tagList.push(newTagValue)
          })
        })
        portraitObj.value.groupList = []
        groupList.forEach((item) => {
          item.tagValues.forEach((tagValue) => {
            const newTagValue = {
              ...tagValue,
              tableName: item.tableName,
              displayName: item.displayName,
            }
            portraitObj.value.groupList.push(newTagValue)
          })
        })
        userProfileLoading.value = false
      }
    })
    .catch(() => {
      if (!isLatestTagValue(token)) return
      userProfileLoading.value = false
    })
}

// 左侧内容
function getVisitorDetailinfo() {
  const params = { projectName: projectName.value, userId: userId.value }
  userInfoLoading.value = true
  userPropLoad.value = true
  const token = nextDetailInfo()
  getVisitorDetailinfoApi(params)
    .then((res) => {
      if (!isLatestDetailInfo(token)) return
      userInfoLoading.value = false
      if (res?.code == 200 && res.data) {
        const data = res.data as UserBaseInfo

        if (!data || !data.userId) {
          clearUserInfo()
          userPropLoad.value = false
          // 是否开启校验，默认不开启;存在中间表未计算成功的用户，所以未完善之前不开启；
          // userNotFound.value = true;//开启细查校验
          // return
        }
        userNotFound.value = false
        userBaseInfo.value = data
        userBaseInfo.value.avgPv = Math.floor(Number(userBaseInfo.value.avgPv))
        const propToken = nextUserProp()
        getUserPropApi(params)
          .then((r) => {
            if (!isLatestUserProp(propToken)) return
            if (r?.data) {
              userPropLoad.value = false
              userPropList.value = r.data as Record<string, unknown>
              updateUserPropLabelWidth()
            }
          })
          .catch(() => {
            if (!isLatestUserProp(propToken)) return
            userPropLoad.value = false
          })
      }
    })
    .catch(() => {
      if (!isLatestDetailInfo(token)) return
      userInfoLoading.value = false
      userPropLoad.value = false
    })
}

function bootstrap() {
  pageLoading.value = true
  getVisitorDetailinfo()
  getTagValueListApi()
  pageLoading.value = false
}

function getUserListNewApiEvent() {
  const token = nextUserList()
  getUserListNewApi({
    sortName: '',
    sortOrder: 'desc',
    pageNum: 1,
    pageSize: 1,
    projectName: projectName.value,
    // 与 v2 一致：v2 的对象字面量里 userId 写了两遍，后一个覆盖前一个，值相同
    userId: userId.value,
    loginId: '',
    anonymousId: '',
  }).then((res) => {
    if (!isLatestUserList(token)) return
    if (res?.data) {
      const data = res.data as { rows?: UserObjInfo[] }
      // 与 v2 一致（v2 此处逻辑存疑：「用户不存在」的校验整段被注释掉了，
      // 查不到用户时不会置 userNotFound，页面继续按空数据渲染）
      userObjInfo.value = (data.rows && data.rows[0]) || {}
      bootstrap()
    }
  })
}

watch(tabType, (val) => {
  if (val === 'user-portrait') {
    updateUserPropLabelWidth()
  }
})

watch(
  () => route.query,
  (newQuery, oldQuery) => {
    tabType.value =
      (newQuery && typeof newQuery.tabType === 'string' && newQuery.tabType) || 'user-portrait'
    const newUserId = newQuery ? newQuery.userId : null
    const oldUserId = oldQuery ? oldQuery.userId : null
    const newProjectName = newQuery ? newQuery.projectName : null
    const oldProjectName = oldQuery ? oldQuery.projectName : null
    if (!newProjectName) {
      clearUserInfo()
      // 与 v2 一致（v2 此处逻辑存疑：return 之后还写了
      // this.$message.error("缺少项目名称，无法加载画像")，是永远执行不到的死代码）
      return
    }
    if (!oldQuery || newUserId !== oldUserId || newProjectName !== oldProjectName) {
      userId.value = (typeof newUserId === 'string' && newUserId) || null
      if (!userId.value) {
        clearUserInfo()
        // 与 v2 一致：同上，后面那句 $message.error 是死代码
        return
      }
      getUserListNewApiEvent()
    }
  },
  { immediate: true },
)
</script>

<template>
  <div ref="rootRef" class="page-container">
    <div v-loading="pageLoading" class="user-portrait-page public-block">
      <div
        v-if="route.query.projectName && route.query.userId && !userNotFound"
        class="portrait-layout"
      >
        <div
          v-if="tabType === 'user-portrait'"
          v-loading="userInfoLoading || userPropLoad"
          style="margin-bottom: 20px"
          class="profile-card commonBackgrond public-hoverItem"
          :style="{ '--label-col-width': labelColWidth + 'px' }"
        >
          <!-- 用户ID、业务ID、匿名ID -->
          <div class="head-info">
            <div class="portrait-header-actions">
              <div v-if="userIdForCopy" class="portrait-action-item">
                <span class="portrait-action-text">用户ID</span>
                <el-icon class="portrait-copy-icon" title="复制用户ID" @click="copyRowId(userIdForCopy)">
                  <DocumentCopy />
                </el-icon>
              </div>
              <div v-if="userObjInfo.loginId" class="portrait-action-item">
                <span class="portrait-action-text">业务ID</span>
                <el-icon
                  class="portrait-copy-icon"
                  title="复制业务ID"
                  @click="copyRowId(userObjInfo.loginId)"
                >
                  <DocumentCopy />
                </el-icon>
              </div>
              <div v-if="userObjInfo.anonymousId" class="portrait-action-item">
                <span class="portrait-action-text">匿名ID</span>
                <el-icon
                  class="portrait-copy-icon"
                  title="复制匿名ID"
                  @click="copyRowId(userObjInfo.anonymousId)"
                >
                  <DocumentCopy />
                </el-icon>
              </div>
            </div>
          </div>
          <div class="setImg">
            <img src="@/assets/images/avator.png" alt="" />
          </div>
          <div class="profile-props">
            <div class="common-title" style="margin-bottom: 10px">用户属性</div>
            <div v-if="isEmptyObject(userPropList)" class="prop-list user-prop-list">
              <div v-for="row in userPropRows" :key="row.key" class="listItem">
                <div class="prop-row">
                  <p class="prop-key">{{ row.key }}:</p>
                  <span class="prop-value">{{ row.text }}</span>
                </div>
              </div>
            </div>
            <div v-else class="empty-tips">暂无数据</div>
          </div>
        </div>

        <div class="tabs-area">
          <tab-pane-type
            :user-base-info="userBaseInfo"
            :project-name="projectName"
            :user-id="userId"
            @tab-change="tabType = $event"
          >
            <template #user-portrait>
              <div class="portrait-tab">
                <div class="portrait-cards">
                  <div class="tagBlock commonBackgrond public-hoverItem">
                    <div class="common-title">用户标签</div>
                    <div
                      v-if="portraitObj.tagList && portraitObj.tagList.length > 0"
                      class="tagList"
                    >
                      <div
                        v-for="(item, index) in portraitObj.tagList"
                        :key="index"
                        class="listItem"
                      >
                        <div class="tag-row">
                          <div class="tag-name">
                            {{ item.displayName + ' : ' || '--' }}
                          </div>
                          <p class="tag-type">
                            {{ filterTagType(item) }}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div v-else class="empty-tips">暂无数据</div>
                  </div>

                  <div class="tagBlock commonBackgrond public-hoverItem">
                    <div class="common-title">用户分群</div>
                    <div
                      v-if="portraitObj.groupList && portraitObj.groupList.length > 0"
                      class="tagList"
                    >
                      <div
                        v-for="(item, index) in portraitObj.groupList"
                        :key="index"
                        class="listItem"
                      >
                        <div class="group-name">
                          {{ item.displayName }}
                        </div>
                      </div>
                    </div>
                    <div v-else class="empty-tips">暂无数据</div>
                  </div>
                </div>
              </div>
            </template>
          </tab-pane-type>
        </div>
      </div>
      <div v-else class="nopermission-page">
        <div class="wscn-http404-pc nopermission-pc">
          <img class="no-able-img" src="@/assets/permission_imgs/nopermission2.png" alt="" />
          <div class="bullshit base-info">
            <div class="bullshit__oops">Oops!</div>
          </div>
          <div class="tips-list">
            <div v-if="!route.query.projectName || !route.query.userId">
              访问路径错误，无法正常加载用户画像信息！
            </div>
            <div v-else>用户画像信息加载失败，请检查您的访问路径中的参数值是否正确！</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.page-container {
  box-sizing: border-box;
  height: calc(100vh - 50px);
  min-height: 0;
  display: flex;
  flex-direction: column;
  background-color: #edf2f9;
  padding: 0;
  gap: 0;
  overflow: hidden;
}

.portrait-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  box-sizing: border-box;
  padding: 0 20px;
  height: 46px;
  border-radius: 0;
}

.portrait-header-title {
  font-size: 14px;
  font-weight: 600;
  color: #4d4d4d;
  line-height: 46px;
}

.portrait-header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.portrait-action-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.portrait-action-text {
  font-size: 12px;
  color: #4d4d4d;
  white-space: nowrap;
}

.portrait-copy-icon {
  color: #2c7be5;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
}

.profile-card {
  width: 100%;
  border-radius: 6px;
  display: flex;
  padding: 15px;
  box-sizing: border-box;
  min-height: 137px;
  gap: 20px;
  position: relative;

  .setImg {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;

    img {
      width: 89px;
      height: 90px;
      object-fit: cover;
      background: rgba(0, 0, 0, 0);
      border-radius: 50%;
    }
  }

  .profile-props {
    flex: 3;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .prop-list {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0 20px;
    width: 100%;
    box-sizing: border-box;
    padding-top: 2px;
    max-height: 110px;
    overflow-y: auto;
  }

  .listItem {
    box-sizing: border-box;
    padding-right: 0;
    margin-bottom: 15px;
    min-width: 0;
  }

  .prop-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
  }

  .prop-key {
    font-size: $font-size-medium;
    color: $light-black;
    margin-right: 5px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .prop-value {
    font-size: $font-size-medium;
    color: $blue;
    word-break: break-all;
  }

  .prop-list.user-prop-list {
    .prop-row {
      display: grid;
      grid-template-columns: var(--label-col-width) minmax(0, 1fr);
      align-items: start;
      column-gap: 8px;
    }

    .prop-key {
      width: var(--label-col-width);
      margin-right: 0;
      white-space: normal;
      word-break: break-all;
    }

    .prop-value {
      min-width: 0;
      word-break: break-all;
      white-space: normal;
    }
  }
}

@media (max-width: 1199px) {
  .profile-card {
    .prop-list.user-prop-list {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
}

@media (min-width: 1600px) {
  .profile-card {
    .prop-list.user-prop-list {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
}

@media (min-width: 2000px) {
  .profile-card {
    .prop-list.user-prop-list {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }
}

.id-popover {
  font-size: $font-size-medium;
  color: $light-black;
}

.overItem {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: $font-size-medium;
  color: #363636;
  min-width: 0;
}

.block-gap-top {
  margin-bottom: 20px;
}

.setFont {
  font-size: 12px;
}

.commonBackgrond {
  background-color: #fff;
}

.head-info {
  position: absolute;
  right: 25px;
  top: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.common-title {
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
  color: #4d4d4d !important;
}

.user-portrait-page {
  box-sizing: border-box;
  flex: 1;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  background-color: transparent;
  padding: 20px 20px 0;

  &.public-block {
    margin: 0;
  }

  .portrait-layout {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    height: 100%;
    min-height: 0;
  }

  .tabs-area {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding-bottom: 40px;
    box-sizing: border-box;
    overflow: hidden;

    .portrait-tab {
      margin-top: 20px;
    }

    .portrait-cards {
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
      width: 100%;
      box-sizing: border-box;
    }

    .portrait-cards .tagBlock {
      flex: 1 1 calc(50% - 10px);
      min-width: 0;
      min-height: 380px;
      display: flex;
      flex-direction: column;
    }

    .portrait-cards .tagList {
      flex: 1;
      overflow: auto;
      margin-top: 5px;
    }

    .portrait-cards .tag-row {
      display: flex;
      margin-right: 50px;
    }

    .tagBlock {
      padding: 10px 15px;
      box-sizing: border-box;
      min-height: 170px;
      font-size: 12px;
      font-weight: 500;

      .tagList {
        display: flex;
        flex-wrap: wrap;
        align-content: flex-start;
        align-items: flex-start;
        box-sizing: border-box;
        width: 100%;

        .listItem {
          box-sizing: border-box;
          padding-right: 10px;
          font-size: 12px;
          line-height: 15px;
          margin-bottom: 15px;

          .tag-name {
            font-size: $font-size-medium;
            color: $light-black;
          }

          .tag-type {
            font-size: $font-size-medium;
            color: $blue;
          }

          p {
            color: $light-black;
            font-size: $font-size-medium;
            margin-left: 5px;
          }

          span {
            font-size: $font-size-medium;
            color: $light-black;
          }
        }

        .group-name {
          font-size: $font-size-medium;
          color: $light-black;
        }
      }

      .user-prop-list {
        .listItem {
          display: flex;
          min-width: 50%;
          align-items: center;
        }

        .listItem p {
          width: var(--label-col-width);
          flex-shrink: 0;
          white-space: normal;
          word-break: break-all;
          text-align: left;
        }

        .listItem span {
          flex: 1;
          min-width: 0;
          white-space: normal;
          word-break: break-all;
          text-align: left;
          padding-left: 8px;
        }
      }
    }
  }

  .empty-tips {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: $font-size-medium;
    color: $black;
    height: 100%;
  }

  .nopermission-page {
    background: rgb(247, 250, 255);
    width: 100%;
    height: calc(100vh - 50px);
    box-sizing: border-box;
    display: flex;
    justify-content: center;
    align-items: center;
    overflow-y: auto;

    .tips-list {
      font-size: 15px;
      color: #333;
      line-height: 30px;
      text-align: center;
    }

    .no-able-img {
      width: 350px;
      height: auto;
      object-fit: contain;
      flex-shrink: 0;
    }

    .wscn-http404-pc {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 80%;
      max-width: 870px;
      height: 530px;
      padding: 0 50px;

      .bullshit {
        width: 300px;
        text-align: center;

        &__oops {
          font-size: 32px;
          font-weight: bold;
          line-height: 40px;
          color: #1482f0;
          opacity: 0;
          margin-bottom: 20px;
          animation-name: slideUp;
          animation-duration: 0.5s;
          animation-fill-mode: forwards;
        }

        &__headline {
          font-size: 20px;
          line-height: 24px;
          color: #222;
          font-weight: bold;
          opacity: 0;
          margin-bottom: 10px;
          animation-name: slideUp;
          animation-duration: 0.5s;
          animation-delay: 0.1s;
          animation-fill-mode: forwards;
        }

        &__info {
          font-size: 13px;
          line-height: 21px;
          color: grey;
          opacity: 0;
          margin-bottom: 30px;
          animation-name: slideUp;
          animation-duration: 0.5s;
          animation-delay: 0.2s;
          animation-fill-mode: forwards;
        }

        &__return-home {
          display: block;
          float: left;
          width: 110px;
          height: 36px;
          background: #1482f0;
          border-radius: 100px;
          text-align: center;
          color: #ffffff;
          opacity: 0;
          font-size: 14px;
          line-height: 36px;
          cursor: pointer;
          animation-name: slideUp;
          animation-duration: 0.5s;
          animation-delay: 0.3s;
          animation-fill-mode: forwards;
        }

        @keyframes slideUp {
          0% {
            transform: translateY(60px);
            opacity: 0;
          }

          100% {
            transform: translateY(0);
            opacity: 1;
          }
        }
      }
    }
  }
}
</style>
