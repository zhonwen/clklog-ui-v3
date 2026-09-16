<script setup lang="ts">
/**
 * 群画像 - 「添加 / 编辑画像信息」弹窗
 * （对应 v2 `views/ups/userPortrait/components/portraitinfo-dialog.vue`）。
 *
 * 对外契约（父组件 portrait-analyze.vue 依赖）：
 *   - defineExpose({ openDialog })，openDialog(item?, portraitInfoList?)
 *   - emit('updatePortraitInfoAPi', { type, id })
 *
 * v2 → v3 主要适配点：
 *   - el-dialog 的 `:visible.sync` → `v-model`；Element UI 的 `:modal-append-to-body`
 *     在 element-plus 已不存在（遮罩固定随 dialog 一起 teleport），去掉。
 *   - `this.$refs.xxx.method()` → `defineExpose` + `ref<InstanceType<typeof Child>>`。
 *   - `this.$route` → `useRoute()`；`this.$store` → `useTrackingStore()`；
 *     `this.$message` → `ElMessage`。
 *   - `el-icon-check` → `<el-icon class="el-icon-check"><Check /></el-icon>`（保留原类名）。
 *   - v2 的「打印」按钮只在 `window.globalConfig.isDebug` 为真时渲染，而 v2 / v3 的
 *     public/config.js 都没有这个字段（恒为 undefined），按钮体也只是一句 console.log，
 *     因此连同 isDebug、handleSave 的 flag 参数一起不迁。
 *   - v2 里从未被使用的 radioOptions / handleCreateMet / userGroupList / filterTabBtn 不迁。
 */
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Check } from '@element-plus/icons-vue'
import {
  getCommonPropertyListApi,
  getGroupedPropertiesApi,
  getListNoGroupEventApi,
} from '@/api/sysmanage/manageEvent'
import { addportrait, editportrait } from '@/api/upsapi/groupportrait'
import { getlistpage } from '@/api/upsapi/usergroup'
import { getTreeList } from '@/api/upsapi/categorymanage'
import behaviorRules from './behaviorRules.vue'
import treeSelect from './tree-select.vue'
import { copyObj } from '@/utils/copy'
import { mergeCommonPropertiesToEvents } from '@/utils/mergeEventProperties'
import { useTrackingStore } from '@/stores/tracking'
import { useLatestOnly } from '@/composables/useLatestOnly'
import { cascaderList as cascaderListSource } from '../options'
import type {
  CascaderNode,
  EchoObj,
  EventGroup,
  PortraitInfoItem,
  PropertyListMap,
  PropertyNode,
} from '../types'
import type {
  CommonPropertyData,
  GroupedPropertiesData,
  PropertyItem,
} from '@/views/analysis-modules/custom-analysis/types'

/** 全部属性（用户 / 事件 / 分群），与 v2 的 pointTypeList 结构一致 */
interface PointTypeList {
  userProtoList: PropertyNode[]
  eventProtoList: PropertyNode[]
  userGroupList: PropertyNode[]
}

/** 标签分类树（getTreeList 返回的原始节点） */
interface CategoryTreeNode {
  id?: string
  tableName?: string
  displayName?: string
  valueType?: string
  tag?: unknown
  children?: CategoryTreeNode[]
}

/** 保存时提交的规则体：两类画像信息最终都是 `{ measures: [...] }` 的形状 */
interface PortraitFormula {
  measures: { echoObj?: EchoObj; [key: string]: unknown }[]
}

/** 提交给父组件的更新指令 */
interface PortraitUpdate {
  type: string
  id: (string | number)[]
}

const emit = defineEmits<{ updatePortraitInfoAPi: [payload: PortraitUpdate] }>()

const route = useRoute()
const trackingStore = useTrackingStore()
const projectName = computed(() => trackingStore.projectName)

const behaviorRulesRef = ref<InstanceType<typeof behaviorRules> | null>(null)
const treeSelectRef = ref<InstanceType<typeof treeSelect> | null>(null)

const pointTypeList = ref<PointTypeList>({
  // 全部属性
  // 用户/事件/分群
  userProtoList: [],
  eventProtoList: [],
  userGroupList: [],
})
const pointProtoList = ref<EventGroup[]>([]) // 全部指标
const propertyList = ref<PropertyListMap>({
  // 公用属性
  commonPropertySum: [], // 共用事件属性
  userProperties: [], // 共用用户属性
  userGroupList: [], // 用户分群
  userTagList: [], // 用户标签
})

const tabChecked = ref(1)
const portraitName = ref('') // 画像名称
const dialogVisible = ref(false)
// 日历
// 与 v2 不同的是这里持有一份副本：v2 直接把 import 进来的模块级数组当 data 用，
// behaviorRules 往里 push 的自定义时间项会跨实例累积（options.ts 的注释也要求各自持有副本）
const cascaderList = ref<CascaderNode[]>(copyObj(cascaderListSource))
const portraitEditId = ref('') // 画像信息编辑id
const portrait_Id = ref<(string | number)[]>([])
const portraitInfoList = ref<PortraitInfoItem[]>([])

/**
 * 画像信息用的 tree-select 只从 propertyList 取数据源，并不消费 pointProtoList
 * （v2 的这一份 tree-select 同样如此），但它声明的类型是 PropertyNode[]，
 * 而这里实际传进去的是「事件分组」数组，所以在传参处收口一次类型。
 */
const pointProtoListForTree = computed(() => pointProtoList.value as unknown as PropertyNode[])

/* -------------------------------------------------------------------------- */
/* 取数（每个取数函数一套 useLatestOnly，避免乱序响应与卸载后回填）              */
/* -------------------------------------------------------------------------- */

const latestTreeList = useLatestOnly()
const latestUserGroup = useLatestOnly()
const latestEventProto = useLatestOnly()
const latestCommonProperty = useLatestOnly()
const latestPrototype = useLatestOnly()

function getTreeListApi() {
  const token = latestTreeList.next()
  void getTreeList({ projectName: projectName.value }).then((response) => {
    if (!latestTreeList.isLatest(token)) return
    const data = response?.data as CategoryTreeNode[] | undefined
    if (data) {
      const transform = (arr: CategoryTreeNode[]): PropertyNode[] => {
        return arr.map((item) => {
          const newItem: PropertyNode = {
            name: item.tableName ? item.tableName : item.id, // 把 id 改为 name
            displayName: item.displayName,
            tableName: item.tableName,
            dataType: item.valueType,
          }
          if (!item.tag && item.children) {
            newItem.children = transform(item.children)
          }
          return newItem
        })
      }
      // 转换结果
      const result = transform(data)
      propertyList.value.userTagList = result

      userGroupInit()
    }
  })
}

function userGroupInit() {
  const params = {
    pageSize: 100,
    pageIndex: 1,
    projectName: projectName.value,
    updateType: '',
    status: '',
    endMatchTime: '',
    createType: '',
    search: '',
  }
  const token = latestUserGroup.next()
  void getlistpage(params).then((res) => {
    if (!latestUserGroup.isLatest(token)) return
    if (res?.code == 200) {
      propertyList.value.userGroupList = res.data?.rows ?? []
      // 设置渲染名
      // （与 v2 一致：v2 这里是 `item.displayName = item.displayName`，空操作，迁移时省略）
      getCommonPropertyList()
      getListEventPrototype('事件') // 获取指标属性
    }
  })
}

// 事件属性
function getListEventPrototype(type: string) {
  const params = {
    projectName: projectName.value,
    type: type,
  }
  const token = latestEventProto.next()
  void getListNoGroupEventApi(params).then((res) => {
    if (!latestEventProto.isLatest(token)) return
    // 共用的 manageEvent api 没有开泛型（其它模块也在用），这里在调用点收口类型
    const data = res.data as PropertyItem[] | undefined
    if (res?.code == 200) {
      if (type == '用户') {
        pointTypeList.value.userProtoList = data ?? []
      } else {
        pointTypeList.value.eventProtoList = data ?? []
      }
      // 设置treeSelect 渲染数据源
      const setDataList = {
        commonPropertySum: pointTypeList.value.eventProtoList || [],
        userGroupList: propertyList.value.userGroupList,
        userProperties: propertyList.value.userProperties,
        userTagList: propertyList.value.userTagList,
      }
      // v2 这里是 dispatch("tracking/setPropertyList") + 再手写一次 localStorage.setItem，
      // v3 的 store action 里已经带了 setLocalStorage('propertyList', value)，不再重复写
      trackingStore.setPropertyList(setDataList)
    }
  })
}

// 通用属性
function getCommonPropertyList() {
  const token = latestCommonProperty.next()
  void getCommonPropertyListApi({
    projectName: projectName.value,
  }).then((res) => {
    if (!latestCommonProperty.isLatest(token)) return
    const data = res.data as CommonPropertyData | undefined
    if (res?.code == 200 && data) {
      propertyList.value.commonPropertySum = [
        ...data.commonProperties,
        ...data.commonPresetProperties,
      ]
      propertyList.value.userProperties = data.userProperties
    }
  })
}

// 指标联级事件
function getPrototype() {
  const token = latestPrototype.next()
  void getGroupedPropertiesApi({
    projectName: projectName.value,
  }).then((res) => {
    if (!latestPrototype.isLatest(token)) return
    const data = res.data as GroupedPropertiesData | undefined
    if (res?.code == 200) {
      if (data) {
        const mergedData = mergeCommonPropertiesToEvents(data)
        pointProtoList.value = mergedData ? mergedData.events : []
      }
    }
  })
}
// end

/* -------------------------------------------------------------------------- */
/* 交互                                                                        */
/* -------------------------------------------------------------------------- */

function openDialog(updateItem?: PortraitInfoItem | '', list?: PortraitInfoItem[]) {
  portraitInfoList.value = list || []
  dialogVisible.value = true
  if (updateItem) {
    portraitName.value = updateItem.name ?? ''
    portraitEditId.value = updateItem.id ?? ''
    // 编辑
    if (updateItem.type == '用户行为分布') {
      tabChecked.value = 2
      void nextTick(() => {
        behaviorRulesRef.value?.editPortraitEvent(updateItem)
      })
    } else {
      tabChecked.value = 1
      void nextTick(() => {
        treeSelectRef.value?.editPortraitEvent(updateItem)
      })
    }
  } else {
    portraitEditId.value = ''
    // 新增-- 清空历史值
    portraitName.value = ''
    void nextTick(() => {
      if (tabChecked.value == 1) {
        treeSelectRef.value?.editPortraitEvent()
      } else {
        behaviorRulesRef.value?.editPortraitEvent()
      }
    })
  }
}

function handleSave() {
  // 清空历史画像ID
  // if (this.portraitInfoList.length > 3)
  //   return this.$message.error("画像信息个数目前只支持添加10个");

  portrait_Id.value = []
  const query = route.query
  let JosnItem: PortraitFormula | undefined
  let typeName: string
  if (tabChecked.value == 1) {
    // 两个子组件的 modelObject 形状不同，但提交时都只按 `{ measures: [...] }` 使用，
    // 这里统一在取值处收口成 PortraitFormula
    JosnItem = copyObj(treeSelectRef.value?.modelObject) as unknown as PortraitFormula | undefined
    typeName = '标签属性分布'
  } else {
    JosnItem = copyObj(behaviorRulesRef.value?.modelObject.behavior) as unknown as
      | PortraitFormula
      | undefined
    typeName = '用户行为分布'
    if (JosnItem && JosnItem.measures.length > 0) {
      // v2 取的是 `this.$refs.behaviorRulesRef._props.cascaderList`，
      // Vue3 拿不到子组件的 _props；由于 cascaderList 就是本组件传下去的同一个对象
      // （子组件里的自定义时间项也是就地 push 到它上面的），这里直接用自己的那份
      const firstEcho = JosnItem.measures[0]?.echoObj
      if (firstEcho) {
        firstEcho.cascaderList = copyObj(cascaderList.value) || []
      }
    }
  }

  // v2 没有这层保护：拿不到子组件实例时会直接抛错，这里按 v3 的 ref 语义提前返回
  if (!JosnItem) return

  if (JosnItem.measures.length > 0) {
    const params: Record<string, unknown> = {
      id: query.id,
      type: typeName,
      name: portraitName.value || true, // 和标签规则区分
      formula: JosnItem,
      projectName: projectName.value,
    }
    if (portraitEditId.value) {
      // 编辑
      params.id = portraitEditId.value
      params.formula = JSON.stringify(JosnItem)
      void editportrait(params)
        .then(() => {
          const portrait_update: PortraitUpdate = {
            type: 'edit',
            id: [portraitEditId.value],
          }
          emit('updatePortraitInfoAPi', portrait_update)
          dialogVisible.value = false
        })
        .catch(() => {
          // 与 v2 一致：v2 这里只 console.log 了报错信息
        })
    } else {
      // 批量新增
      multipleIssue(JosnItem.measures, params, '新增')
    }
  } else {
    ElMessage.error('请添加画像内容')
  }
}

// 批量下发
function multipleIssue(
  arr: PortraitFormula['measures'],
  params: Record<string, unknown>,
  method: string,
) {
  function callPromise(item: PortraitFormula['measures'][number]) {
    // 与 v2 一致（v2 此处逻辑存疑：只有 code == 200 才 resolve，
    // 接口返回非 200 或直接报错时这个 Promise 永远挂着，后续的批量新增就停在这一条上）
    return new Promise<void>((resolve) => {
      const newParams = copyObj(params)
      newParams.projectName = projectName.value
      if (method == '新增') {
        const formula = newParams.formula as PortraitFormula
        formula.measures = [item]
        newParams.formula = JSON.stringify(formula)
        void addportrait(newParams)
          .then((res) => {
            if (res?.code == 200) {
              const data = res.data as { id?: string | number } | undefined
              portrait_Id.value.push(data?.id ?? '')
              resolve()
            }
          })
          .catch(() => {})
      }
    })
  }

  const result = arr.reduce((accumulatorPromise, next) => {
    return accumulatorPromise.then(() => {
      // 上一个接口执行完毕再执行下一个
      return callPromise(next)
    })
  }, Promise.resolve())

  // 1.批量增加
  void result.then(() => {
    void nextTick(() => {
      setTimeout(() => {
        dialogVisible.value = false
        // 与 v2 一致：v2 写的是 `a - b`，字符串 id 会被隐式转成数字比较
        const sortedIds = [...portrait_Id.value].sort((a, b) => Number(a) - Number(b))
        const portrait_update: PortraitUpdate = {
          type: 'add',
          id: sortedIds,
        }
        emit('updatePortraitInfoAPi', portrait_update)
      })
    })
  })
}

function handleCancle() {
  dialogVisible.value = false
  portraitEditId.value = ''
}

function createTagType(val: number) {
  tabChecked.value = val
}

onMounted(() => {
  // 初始调用
  getTreeListApi()
  getPrototype()
})

defineExpose({ openDialog })
</script>

<template>
  <div>
    <el-dialog
      v-model="dialogVisible"
      style="z-index: 1000"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      width="1100px"
      class="prototype_dialog"
      :title="portraitEditId ? '编辑画像信息' : '添加画像信息'"
      top="4vh"
    >
      <div
        style="
          background: #fff;
          border-radius: 6px;
          min-height: 460px;
          padding: 25px;
          box-sizing: border-box;
        "
      >
        <div class="public-firstHead">选择画像信息类型</div>

        <div style="display: flex; margin-top: 20px; justify-content: space-between">
          <div
            class="tagsItem public-hoverItem"
            :style="tabChecked == 1 ? { border: '1px solid #2c7be5' } : {}"
            @click="createTagType(1)"
          >
            <div class="title">
              用户属性分布
              <el-icon v-if="tabChecked == 1" class="el-icon-check" style="color: #2c7be5">
                <Check />
              </el-icon>
            </div>
            <div class="content">
              举例：用户属性选择「性别」，则可以分析画像人群中“男”、“女”的比例
            </div>
          </div>

          <div
            class="tagsItem public-hoverItem"
            :style="tabChecked == 2 ? { border: '1px solid #2c7be5' } : {}"
            @click="createTagType(2)"
          >
            <div class="title">
              用户行为分布
              <el-icon v-if="tabChecked == 2" class="el-icon-check" style="color: #2c7be5">
                <Check />
              </el-icon>
            </div>
            <div class="content">
              举例：可以分析画像人群「在双十一期间，支付订单总次数」的人数分布
            </div>
          </div>
        </div>

        <div class="public-firstHead" style="margin: 25px 0">设置画像信息</div>
        <div class="rules_block">
          <p style="margin-top: 15px">画像内容</p>
          <!-- 新增 -->
          <behaviorRules
            v-show="tabChecked == 2"
            ref="behaviorRulesRef"
            :pointProtoList="pointProtoList"
            :cascaderList="cascaderList"
            :pointTypeList="pointTypeList"
            :propertyList="propertyList"
          />
          <div v-show="tabChecked == 1">
            <treeSelect
              ref="treeSelectRef"
              :pointProtoList="pointProtoListForTree"
              :pointTypeList="pointTypeList"
              :propertyList="propertyList"
              style="margin-top: 10px"
            />
          </div>
        </div>

        <div style="display: flex; justify-content: right; margin-top: 60px">
          <el-button class="zc_btn" @click="handleSave()">保存</el-button>
          <el-button class="zc_btn_default" @click="handleCancle">取消</el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style>
.el-dialog {
  border-radius: 6px;
  z-index: 1111 !important;
  position: relative;
}
</style>

<style lang="scss" scoped>
// 设置卡片单独hover样式
.public-hoverItem {
  box-shadow: 0 0 0 0;
}

.public-hoverItem:hover {
  // border: 1px solid #d8e2ef !important;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.2);
}

// v2 的 `::v-deep { ... }` 整块，这里逐条拆成 :deep(...)。
// 其中 .el-input--medium 是 Element UI 2 的类名，element-plus 已不再输出，
// 但样式数值按要求与 v2 保持一致，原样保留。
:deep(.prototype_dialog .el-dialog__body) {
  min-height: 500px;
  padding-top: 20px;
}

:deep(.el-dialog) {
  border-radius: 6px;
  z-index: 1111 !important;
  position: relative;
}

:deep(.el-dialog__headerbtn) {
  top: 15px;
}

:deep(.el-dialog__header) {
  padding: 0 !important;
  border-radius: 6px;
  height: 60px;
  line-height: 60px;
  background: #fbfcfe;
}

:deep(.el-dialog__title) {
  margin-left: 16px;
  font-size: 15px;
  line-height: 30px;
  color: #4d4d4d;
  font-weight: 600px;
}

:deep(.el-dialog__body) {
  padding: 20px;
  background-color: #eef4fd;
  border-radius: 6px;
}

:deep(.el-dialog__headerbtn .el-dialog__close) {
  margin-top: 10px;
  font-size: 18px;
}

:deep(.el-input--medium .el-input__inner) {
  height: 30px;
  line-height: 30px;
}

.tagsItem {
  background: #fbfcfe;
  border: 1px solid #d8e2ef;
  width: calc(50% - 10px); //2 * ?
  min-height: 100px;
  border-radius: 6px;
  padding: 20px;
  cursor: pointer;

  .title {
    display: flex;
    justify-content: space-between;
  }

  .content {
    margin-top: 20px;
    font-size: 15px;
    font-weight: 500;
    line-height: 20px;
    color: #4d4d4d;
  }
}

.rules_block {
  display: flex;
  // align-items: center;
  margin-top: 20px;

  p {
    width: 80px;
  }
}
</style>
