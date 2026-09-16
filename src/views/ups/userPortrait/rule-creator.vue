<script setup lang="ts">
/**
 * 画像人群规则创建器（对应 v2 `views/ups/userPortrait/rule-creator.vue`）。
 * 负责拉取属性 / 分群 / 标签数据源，做规则校验，然后走「预估 → 保存」。
 *
 * v2 未搬运的遗留成员（模板里只有 customTagPage 和一层遮罩，其余全无引用，也无外部调用）：
 * import 的 filterBar / estimateDialog 组件、group-limit 的 propertyTypeList / conditionList / sortList、
 * estimateList、data 里的 ruleForm / hourOptions / updateTimeList / estimate / description / typeLable /
 * checked / tagTree / createIndex / finishFlag / copyShowFlag / fromPath，
 * methods 里的 checkAndPrint / handleMethod / handleInput / generateRandomKey / estimateEvent /
 * createMetFilter / filterLabel / cancleEvent / returnTagsPagess / getLetterByIndex / isCollapseEvent。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import customTagPage from './components/customTagPage/index.vue'
import { isEmptyParams, verificaRules } from './types'
import type {
  EventGroup,
  GropPortraitInfo,
  PortraitInfoItem,
  PortraitRuleItem,
  PropertyListMap,
  PropertyNode,
} from './types'
import { add, estimate, update } from '@/api/upsapi/groupportrait'
import { getlistpage } from '@/api/upsapi/usergroup'
import { getTreeList } from '@/api/upsapi/categorymanage'
import {
  getCommonPropertyListApi,
  getGroupedPropertiesApi,
  getListNoGroupEventApi,
} from '@/api/sysmanage/manageEvent'
import { copyObj } from '@/utils/copy'
import { mergeCommonPropertiesToEvents } from '@/utils/mergeEventProperties'
import { getLocalStorage } from '@/utils/localStorage'
import { useTrackingStore } from '@/stores/tracking'
import { useLatestOnly } from '@/composables/useLatestOnly'
import type { CommonPropertyData, GroupedPropertiesData } from '@/views/analysis-modules/custom-analysis/types'

const props = withDefaults(defineProps<{ portraitInfo?: PortraitInfoItem }>(), {
  portraitInfo: () => ({}),
})

const emit = defineEmits<{
  groupPortrait: [res: { id?: string }, type?: string]
  loadingEvent: []
  resetEstimatingState: []
}>()

const route = useRoute()
const trackingStore = useTrackingStore()

// 每个取数函数一套 useLatestOnly
const { next: nextTree, isLatest: isLatestTree } = useLatestOnly()
const { next: nextGroup, isLatest: isLatestGroup } = useLatestOnly()
const { next: nextCommon, isLatest: isLatestCommon } = useLatestOnly()
const { next: nextProto, isLatest: isLatestProto } = useLatestOnly()
const { next: nextEvent, isLatest: isLatestEvent } = useLatestOnly()

const projectName = computed(() => trackingStore.projectName)

const customTagPageRef = ref<InstanceType<typeof customTagPage> | null>(null)

const getPortraitList = ref<{ formula?: string } | '' | null | undefined>(null)
/** 是否编辑模型 */
const formula = ref<{ formula?: string } | '' | null | undefined>(null)

/** 全部指标（事件分组列表） */
const pointProtoList = ref<EventGroup[]>([])
/** 公用属性 */
const propertyList = ref<PropertyListMap>({
  commonPropertySum: [], // 共用事件属性
  userProperties: [], // 共用用户属性
  userGroupList: [], // 用户分群
  userTagList: [], // 用户标签
})
/** 属性的全部 list：用户属性-事件属性 */
const pointTypeList = ref<{ userProtoList: PropertyNode[]; eventProtoList: PropertyNode[] }>({
  userProtoList: [],
  eventProtoList: [],
})
const allowSaving = ref(false)

/** 标签分类树（含标签） */
function getTreeListApi() {
  const token = nextTree()
  getTreeList({ projectName: projectName.value }).then((response) => {
    if (!isLatestTree(token)) return
    if (response?.data) {
      interface TagTreeNode {
        id?: string
        tableName?: string
        displayName?: string
        valueType?: string
        tag?: unknown
        children?: TagTreeNode[]
      }
      const transform = (arr: TagTreeNode[]): PropertyNode[] => {
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
      const result = transform(response.data as TagTreeNode[])
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
  const token = nextGroup()
  getlistpage(params).then((res) => {
    if (!isLatestGroup(token)) return
    if (res?.code == 200) {
      const data = res.data as { rows?: (PropertyNode & { tableName?: string })[] } | undefined
      propertyList.value.userGroupList = data?.rows || []
      // 设置渲染名
      propertyList.value.userGroupList.map((item) => {
        item.name = item.tableName
      })
      getCommonPropertyList()
      getListEventPrototype('事件') // 获取指标属性
    }
  })
}

// 更新详情和添加对比事件触发
function updatePropTransfer(res: { formula?: string } | '' | null | undefined, index?: number | string) {
  getPortraitList.value = res
  parseEvent(index)
}

function parseEvent(index?: number | string) {
  formula.value = getPortraitList.value
  customTagPageRef.value?.updateModelTransfer(formula.value, Number(index ?? 0))
}

function consoModelEvent(type?: string, index?: number | string, flag?: string) {
  const gropPortraitInfo = getLocalStorage<GropPortraitInfo>(
    'gropPortraitInfo',
  ) as GropPortraitInfo | null
  let portraitNameList: string[] = []
  if (gropPortraitInfo && gropPortraitInfo.formula) {
    portraitNameList = gropPortraitInfo.formula.map((item) => item.name)
  }
  const modelList = customTagPageRef.value?.tagModelList
  if (!modelList) return
  if (flag == '打印模型') {
    const ruleList = copyObj(modelList.ruleList)
    console.log('打印模型-->', JSON.stringify(ruleList[0]))
    return
  }

  const ruleList = copyObj(modelList.ruleList)
  const first = ruleList[0]
  if (!first) return

  // 数据源设置cascaderList;
  if (first.rules.behavior.measures.length > 0) {
    const measure = first.rules.behavior.measures[0]
    if (measure) measure.echoObj.cascaderList = customTagPageRef.value?.cascaderList
  } else if (first.rules.sequence.sequences.length > 0) {
    const seq = first.rules.sequence.sequences[0]
    if (seq) seq.echoObj.cascaderList = customTagPageRef.value?.cascaderList
  }

  // ***** 设置校验规则 *****
  modelList.ruleList.map((item) => {
    item.rules.isValid = true
  })
  let isEmpty = false
  let isPass: number | null = null
  let isName = false
  for (let i = 0; i < ruleList.length; i++) {
    const item = ruleList[i]
    if (!item) break
    // if (!item.displayName) {
    if (!item.name) {
      isName = false
      break
    } else {
      isName = true
    }
    // 判断条件合并到一个表达式中，避免重复代码
    const isItemInvalid =
      item.rules.attribute.filters.length === 0 &&
      item.rules.behavior.measures.length === 0 &&
      item.rules.sequence.sequences.length === 0
    if (isItemInvalid) {
      isPass = i
      break // 找到第一个无效项时跳出循环
    }
    // 属性判断
    if (item.rules.attribute.filters.length > 0) {
      const itemJ = item.rules.attribute.filters
      for (let j = 0; j < itemJ.length; j++) {
        const conditions = itemJ[j]?.conditions || []
        for (let k = 0; k < conditions.length; k++) {
          const singCondition = conditions[k]
          if (!singCondition) continue
          const paramsLength = verificaRules(singCondition.function)
          if (paramsLength > 0) {
            // 判断时间区间-多个选择事件是否为空
            if (paramsLength > 1 && (singCondition.params?.length ?? 0) !== paramsLength) {
              isEmpty = true
              break
            }
            // 判断条件是否为空值
            if (isEmptyParams(singCondition.params)) {
              isEmpty = true
              break
            }
          }
        }
        // 如果 isEmpty 已经被设置为 true，可以跳出外层循环
        if (isEmpty) {
          break
        }
      }
    }
    // 行为判断
    if (!isEmpty && item.rules.behavior.measures.length > 0) {
      const itemM = item.rules.behavior.measures
      for (let m = 0; m < itemM.length; m++) {
        const measure = itemM[m]
        if (!measure) continue
        const params = measure.params
        const paramsLength = verificaRules(measure.function)
        // 提前判断 params 是否为空或长度不匹配
        if (paramsLength > 0) {
          if (paramsLength > 1 && params.length !== paramsLength) {
            isEmpty = true
            break
          }
          // 判断条件是否为空值
          if (isEmptyParams(params)) {
            isEmpty = true
            break
          }
        }
        if (!isEmpty) {
          const itemN = measure.filter.filters
          for (let n = 0; n < itemN.length; n++) {
            const group = itemN[n]
            if (group?.conditions) {
              for (let o = 0; o < group.conditions.length; o++) {
                const itemO = group.conditions[o]
                if (!itemO) continue
                const innerLength = verificaRules(itemO.function)
                const innerParams = itemO.params
                // 校验空值
                if (innerLength > 0) {
                  if (innerLength > 1 && (innerParams?.length ?? 0) !== innerLength) {
                    isEmpty = true
                    break
                  }
                  if (isEmptyParams(innerParams)) {
                    isEmpty = true
                    break
                  }
                }
              }
            }
            if (isEmpty) {
              break
            }
          }
        }
      }
    }
    // 行为序列
    if (!isEmpty && item.rules.sequence.sequences.length > 0) {
      const itemM = item.rules.sequence.sequences
      for (let m = 0; m < itemM.length; m++) {
        const stepsM = itemM[m]?.steps || []
        for (let n = 0; n < stepsM.length; n++) {
          const step = stepsM[n]
          if (step && step.filter.filters.length > 0) {
            const itemN = step.filter.filters
            for (let o = 0; o < itemN.length; o++) {
              const conditions = itemN[o]?.conditions || []
              for (let p = 0; p < conditions.length; p++) {
                const itemP = conditions[p]
                if (!itemP) continue
                const paramsLength = verificaRules(itemP.function)
                const params = itemP.params
                // 提前判断 params 是否为空或长度不匹配
                if (paramsLength > 0) {
                  if (paramsLength > 1 && (params?.length ?? 0) !== paramsLength) {
                    isEmpty = true
                    break
                  }
                  if (isEmptyParams(params)) {
                    isEmpty = true
                    break
                  }
                }
              }
            }
          }
        }
        if (isEmpty) {
          break
        }
      }
    }
  }
  // 输出结果，若无符合条件的项则是 null
  if (isPass != null || isEmpty) {
    allowSaving.value = false
    if (isEmpty) {
      ElMessage.error(`规则条件不能为空`)
    } else {
      ElMessage.error(`规则不合法`)
    }
  } else if (!isName) {
    allowSaving.value = false
    ElMessage.error(`画像人群名称不能为空`)
  } else {
    allowSaving.value = true
  }
  // 不满足条件终止
  if (!allowSaving.value) return
  // 增加预估loading事件
  emit('loadingEvent')

  if (type == '添加对比人群' || type == '添加目标人群') {
    if (portraitNameList.includes(first.name)) {
      ElMessage.error('画像人群名称不能重复，请修改后在进行保存')
      return
    } else {
      estimateApiEvent(type, index, ruleList, gropPortraitInfo)
    }
  } else {
    if (portraitNameList[Number(index)] == first.name) {
      estimateApiEvent(type, index, ruleList, gropPortraitInfo)
    } else {
      if (portraitNameList.includes(first.name)) {
        ElMessage.error('画像人群名称不能重复，请修改后在进行保存')
        return
      } else {
        estimateApiEvent(type, index, ruleList, gropPortraitInfo)
      }
    }
  }
}

function estimateApiEvent(
  type: string | undefined,
  index: number | string | undefined,
  ruleList: PortraitRuleItem[],
  gropPortraitInfo: GropPortraitInfo | null,
) {
  estimate({
    projectName: projectName.value,
    formula: JSON.stringify(ruleList),
    createType: '群画像规则',
  })
    .then((res) => {
      // 重置父组件的预估状态
      emit('resetEstimatingState')

      const list = res?.data as { count?: number }[] | undefined
      const isEmpty = (list && list[0] && list[0].count) || ''
      if (!isEmpty) {
        return ElMessageBox.confirm('该规则下的用户人群数量为0，请调整规则后再保存！', '提示', {
          confirmButtonText: '确认',
          cancelButtonText: '取消',
          cancelButtonClass: 'custom-cancel-button',
          type: 'warning',
          customClass: 'my-confirm',
          closeOnClickModal: false,
        })
          .then(() => {
            savePortraitCompare(type, index, ruleList, gropPortraitInfo)
          })
          .catch(() => {})
      } else {
        savePortraitCompare(type, index, ruleList, gropPortraitInfo)
      }
    })
    .catch((error) => {
      // 接口请求失败时也要重置状态
      emit('resetEstimatingState')
      console.error('预估接口请求失败:', error)
    })
}

function savePortraitCompare(
  type: string | undefined,
  index: number | string | undefined,
  ruleList: PortraitRuleItem[],
  gropPortraitInfo: GropPortraitInfo | null,
) {
  const first = ruleList[0]
  if (!first) return
  if (route.query.id) {
    if (!gropPortraitInfo) return
    if (type == '更新目标人群') {
      gropPortraitInfo.formula[Number(index)] = first
      const params = {
        createType: '群画像规则',
        id: gropPortraitInfo.id,
        displayName: first.name,
        formula: JSON.stringify(gropPortraitInfo.formula),
        projectName: projectName.value,
      }
      update(params).then((res) => {
        if (res?.code == 200) {
          emit('groupPortrait', (res.data || {}) as { id?: string }, type)
          ElMessage.success('更新成功')
        }
        // 确保保存完成后重置状态
        emit('resetEstimatingState')
      })
    } else if (type == '更新对比人群') {
      gropPortraitInfo.formula[Number(index)] = first
      const params = {
        id: gropPortraitInfo.id,
        displayName: gropPortraitInfo.displayName,
        formula: JSON.stringify(gropPortraitInfo.formula),
        createType: '群画像规则',
        projectName: projectName.value,
      }
      update(params).then((res) => {
        if (res?.code == 200) {
          emit('groupPortrait', (res.data || {}) as { id?: string }, type)
          ElMessage.success('更新成功')
        }
        // 确保保存完成后重置状态
        emit('resetEstimatingState')
      })
    } else if (type == '添加对比人群') {
      gropPortraitInfo.formula.push(first)
      const params = {
        id: gropPortraitInfo.id,
        displayName: gropPortraitInfo.displayName,
        formula: JSON.stringify(gropPortraitInfo.formula),
        createType: '群画像规则',
        projectName: projectName.value,
      }
      update(params).then((res) => {
        if (res?.code == 200) {
          emit('groupPortrait', (res.data || {}) as { id?: string }, type)
          ElMessage.success('添加成功')
        }
        // 确保保存完成后重置状态
        emit('resetEstimatingState')
      })
    }
  } else {
    // 默认添加目标人群
    const params = {
      projectName: projectName.value,
      displayName: first.name,
      formula: JSON.stringify(ruleList),
      createType: '群画像规则',
    }
    add(params).then((res) => {
      if (res?.code == 200) {
        emit('groupPortrait', (res.data || {}) as { id?: string })
        ElMessage.success('添加成功')
      }
      // 确保保存完成后重置状态
      // v2 这里走的是 `this.$parent.resetEstimatingState()`（父组件就是 rules-dialog），
      // v3 统一改成 emit，效果一致
      emit('resetEstimatingState')
    })
  }
}

// 接口值
// 事件属性
function getListEventPrototype(type: string) {
  const params = {
    projectName: projectName.value,
    type: type,
  }
  const token = nextEvent()
  getListNoGroupEventApi(params).then((res) => {
    if (!isLatestEvent(token)) return
    if (res?.code == 200) {
      if (type == '用户') {
        pointTypeList.value.userProtoList = (res.data || []) as PropertyNode[]
      } else {
        pointTypeList.value.eventProtoList = (res.data || []) as PropertyNode[]
      }
      const setDataList = {
        commonPropertySum: pointTypeList.value.eventProtoList || [],
        userGroupList: propertyList.value.userGroupList,
        userProperties: propertyList.value.userProperties,
        userTagList: propertyList.value.userTagList,
      }
      // v3 的 setPropertyList 内部已经写了 localStorage('propertyList')，等价于 v2 的两步
      trackingStore.setPropertyList(setDataList)
    }
  })
}

// 通用属性
function getCommonPropertyList() {
  const token = nextCommon()
  getCommonPropertyListApi({ projectName: projectName.value }).then((res) => {
    if (!isLatestCommon(token)) return
    if (res?.code == 200) {
      const data = res.data as CommonPropertyData | undefined
      propertyList.value.commonPropertySum = [
        ...((data?.commonProperties || []) as PropertyNode[]),
        ...((data?.commonPresetProperties || []) as PropertyNode[]),
      ]
      propertyList.value.userProperties = (data?.userProperties || []) as PropertyNode[]
    }
  })
}

// 指标联级事件
function getPrototype() {
  const token = nextProto()
  getGroupedPropertiesApi({ projectName: projectName.value }).then((res) => {
    if (!isLatestProto(token)) return
    if (res?.code == 200) {
      if (res.data) {
        const mergedData = mergeCommonPropertiesToEvents(res.data as GroupedPropertiesData)
        pointProtoList.value = (mergedData && mergedData.events
          ? mergedData.events
          : []) as unknown as EventGroup[]
      }
    }
  })
}

onMounted(() => {
  getPrototype()
  getTreeListApi()
})

onBeforeUnmount(() => {
  localStorage.removeItem('propertyList')
})

defineExpose({ updatePropTransfer, consoModelEvent })
</script>

<template>
  <div style="position: relative">
    <customTagPage
      ref="customTagPageRef"
      :point-proto-list="pointProtoList"
      :property-list="propertyList"
      by-portrait
    />
    <div
      v-if="props.portraitInfo.lastExecuteEndTime"
      style="
        position: absolute;
        width: calc(100% - 50px);
        height: calc(100% - 5px);
        top: 0px;
        z-index: 888;
        cursor: not-allowed;
        background: rgb(200, 202, 203);
        border-radius: 6px;
        opacity: 0.2;
      "
    ></div>
  </div>
</template>

<style lang="scss" scoped>
p {
  margin: 0;
}

.text_box {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);

  .title {
    font-size: 11px;
  }

  .text {
    font-size: 11px;
  }
}

:deep(.el-checkbox__label) {
  font-size: 12px;
}

:deep(.el-input-group__append),
:deep(.el-input-group__prepend) {
  padding: 0 10px;
}

:deep(.el-form-item__label) {
  font-size: 13px;
  font-weight: 500;
  text-align: right;
  color: #4d4d4d;
  padding-right: 30px;
}

:deep(.el-textarea__inner) {
  font-size: 13px;
}

:deep(.el-input__inner) {
  font-size: 13px;
  height: 30px;
  line-height: 30px;
}

:deep(.el-select .el-input.is-disabled .el-input__inner) {
  height: 30px;
}

:deep(.el-radio) {
  margin-right: 10px;
}

.custom_icon:hover {
  color: #2c7be5;
}

.block_online {
  border-radius: 6px;

  // 基础信息
  .infoTitle {
    display: flex;

    .infoIcon {
      width: 5px;
      height: 20px;
      background: #2c7be5;
      margin-right: 10px;
    }
  }

  // 分群规则
  .tags_rules {
    .updataFunction {
      display: flex;
      margin-top: 20px;
      align-items: center;
      color: rgb(145, 146, 147);

      span {
        font-size: 13px;
      }
    }

    .createTitle {
      line-height: 30px;
      margin-right: 30px;
    }

    .customTitle {
      color: #2c7be5;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
  }
}
</style>
