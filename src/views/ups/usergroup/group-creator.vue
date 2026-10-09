<script setup lang="ts">
/**
 * 分群创建 / 编辑页（对应 v2 views/ups/usergroup/group-creator.vue）。
 *
 * 上半部分是基础信息表单（名称 / 标识 / 更新方式 / 人数限制 / 备注），
 * 下半部分是分群规则（customTagPage），底部是保存 / 取消 / 复制分群。
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import filterBar from './components/filterBar.vue'
import rulesDialog from './components/rulesDialog.vue'
import estimateDialog from '@/views/ups/components/estimate-dialog.vue'
import customTagPage from './components/customTagPage/index.vue'
import leadingCreate from './components/leadingCreate/index.vue'
import {
  add,
  check,
  edit,
  get,
  getlistpage,
  groupEstimate,
} from '@/api/upsapi/usergroup'
import type { EstimateFromType, EstimateRow } from '@/views/ups/components/types'
import { getTreeList } from '@/api/upsapi/categorymanage'
import {
  getCommonPropertyListApi,
  getGroupedPropertiesApi,
  getListNoGroupEventApi,
} from '@/api/sysmanage/manageEvent'
import { mergeCommonPropertiesToEvents } from '@/utils/mergeEventProperties'
import { copyObj } from '@/utils/copy'
import { setLocalStorage } from '@/utils/localStorage'
import { useLatestOnly } from '@/composables/useLatestOnly'
import { useTrackingStore } from '@/stores/tracking'
import {
  estimateList,
  latestVersionCountTime,
  propertyTypeList,
  sortList,
  updateTimeList,
} from './constants'
import {
  isEmptyParams,
  siblingPath,
  verificaRules,
  weekOrMonthRangeList,
} from './utils'
import type {
  CascaderNode,
  GroupRow,
  GroupRuleForm,
  LabelValue,
  PropertyListMap,
  PropertyNode,
  RuleListItem,
  TagModelList,
} from './types'

/** Object.assign(tagModelList, ruleForm) 之后的形状 */
type SaveModel = TagModelList &
  GroupRuleForm & {
    formula?: string
    createType?: string
    id?: string
    projectName?: string
  }

const route = useRoute()
const router = useRouter()
const trackingStore = useTrackingStore()
const { next: nextDetail, isLatest: isLatestDetail } = useLatestOnly()
const { next: nextCategory, isLatest: isLatestCategory } = useLatestOnly()
const { next: nextGroupList, isLatest: isLatestGroupList } = useLatestOnly()
const { next: nextCommonProp, isLatest: isLatestCommonProp } = useLatestOnly()
const { next: nextNoGroupEvent, isLatest: isLatestNoGroupEvent } = useLatestOnly()
const { next: nextPrototype, isLatest: isLatestPrototype } = useLatestOnly()

/* --------------------------------- ref ---------------------------------- */

const ruleFormRef = ref<FormInstance | null>(null)
const rulesDialogRef = ref<{ openEvent: (val?: string) => void } | null>(null)
const estimateDialogRef = ref<{
  dialogEvent: (data?: EstimateRow[], fromType?: EstimateFromType) => void
} | null>(null)
const customTagPageRef = ref<{
  tagModelList: TagModelList
  cascaderList: CascaderNode[]
} | null>(null)
// v2 还挂了一个 ref="leadingCreateRef"，但从没有人通过它调过方法，这里不再保留

/* -------------------------------- 状态 ---------------------------------- */

// v2 是 window.globalConfig.isDebug；v3 的 GlobalConfig 里还没有这个字段（见迁移报告）
const isDebug = Boolean((window.globalConfig as unknown as { isDebug?: boolean }).isDebug)
const ruleSavingLoad = ref(false) //规则加载中
const isSaveClose = ref(false)
const fromPath = ref<string | undefined>(undefined)
let allowSaving = false
const checked = ref(false)
const tagTree = ref<PropertyNode[]>([])
const createIndex = ref<string | number>('') //分群类型
const formula = ref<GroupRow>({}) //是否编辑模型
const estimate = ref('all')
const dateRangeList = ref<LabelValue<number>[]>([])

// 规则
const ruleForm = reactive<GroupRuleForm>({
  displayName: '',
  description: '',
  name: '',
  updateType: '例行',
  frequency: '天',
  frequencyValue: [1],
  frequencyTime: '00:00',
  returnUserLimitSetting: {
    source_type: '随机',
    sort_profile: '',
    sort_asc: '',
    limit: '',
  },
})

// 初始data
const pointProtoList = ref<PropertyNode[]>([]) //全部指标
const propertyList = reactive<PropertyListMap>({
  //公用属性
  commonPropertySum: [], //共用事件属性
  userProperties: [], //共用用户属性
  userGroupList: [], //用户分群
  userTagList: [], //用户标签
})
const pointTypeList = reactive<{
  //全部属性
  //用户/事件
  userProtoList: PropertyNode[]
  eventProtoList: PropertyNode[]
}>({
  userProtoList: [],
  eventProtoList: [],
})
const apiLoading = ref(false)
const isEstimate = {
  doneTitle: '为了保证分群的计算结果分布符合预期，请先预估人数。',
  doneBtn: '去估算',
  noDidTile: '没有符合该分群规则下的用户，确认保存吗？',
  noDidBtn: '保存',
}

/* ------------------------------- computed ------------------------------- */

const hourOptions = computed(() => latestVersionCountTime())
const projectName = computed(() => trackingStore.projectName)

function createMetFilter(index: string | number) {
  if (index == 1) {
    // return "规则创建";
    return '自定义规则'
  } else if (index == 2) {
    return '导入创建'
  }
  return undefined
}

/** 模板里 v2 调了两次 createMetFilter(createIndex)，这里提成 computed */
const createMetLabel = computed(() => createMetFilter(createIndex.value))

/** v2 的 `!formula.creator && !$route.query.createType`，模板里出现十余次 */
const baseDisabled = computed(() => !formula.value.creator && !route.query.createType)

/** v2 的 filterDisabled() */
const filterDisabled = computed(() => {
  if ((!formula.value.creator && !route.query.createType) || formula.value.id) {
    return true
  }
  return false
})

/** 「该分群正在计算中」提示条 / 规则区遮罩的显示条件 */
const isCalculating = computed(
  () =>
    formula.value.creator &&
    (formula.value.matchUserCount || formula.value.matchUserCount == 0) &&
    !route.query.createType,
)

const ruleMaskVisible = computed(
  () =>
    (!formula.value.creator ||
      formula.value.matchUserCount ||
      formula.value.matchUserCount == 0) &&
    !route.query.createType,
)

/* ------------------------------ 表单校验 -------------------------------- */

const validatePass = (
  _rule: unknown,
  value: string,
  callback: (err?: Error) => void,
) => {
  function isValid(str: string) {
    return /^[a-zA-Z][a-zA-Z0-9_]*$/.test(str)
  }
  if (value === '') {
    callback(new Error('分群标识不能为空'))
  } else if (!isValid(value)) {
    callback(new Error('以字母开头, 可包含数字和下划线'))
  } else {
    // 标识校验唯一性
    if (formula.value.id) {
      callback()
    } else {
      check({
        name: value,
        projectName: projectName.value,
      })
        .then((res) => {
          if (res?.data == false) {
            callback()
          } else {
            callback(new Error('分群标识重复,请修改后在保存'))
          }
        })
        .catch(() => {
          callback()
        })
    }
  }
}

const rules: FormRules = {
  displayName: [{ required: true, message: '分群名称不能为空', trigger: 'blur' }],
  name: [{ validator: validatePass, trigger: 'blur' }],
}

/* ------------------------------ 基础信息 -------------------------------- */

function validateProjectName(eventName?: string) {
  if (eventName && eventName != projectName.value) {
    void router.push({ path: siblingPath(route.path, 'list') })
  }
}

// 是否重新预估
function reEstimate() {
  ruleForm.isEstimate = 'edit'
}

function filterDateRange(val?: string | number | boolean) {
  dateRangeList.value = weekOrMonthRangeList(typeof val === 'string' ? val : undefined)
  if (val == '天') {
    ruleForm.frequencyValue = []
  } else {
    if (ruleForm.frequencyValue.length == 0) {
      ruleForm.frequencyValue = [1]
    }
  }
}

function handleCheckBox(val: string | number | boolean) {
  if (val) {
    if (!ruleForm.returnUserLimitSetting.limit) {
      isSaveClose.value = true
    }
  } else {
    isSaveClose.value = false
  }
}

function handleMethod(val: string | number | boolean | undefined) {
  checked.value = false
  if (val == '例行') {
    ruleForm.frequency = 'day'
    ruleForm.frequencyTime = '00:00'
    isSaveClose.value = false
    ruleForm.returnUserLimitSetting.sort_asc = ''
    ruleForm.returnUserLimitSetting.sort_profile = ''
    ruleForm.returnUserLimitSetting.source_type = ''
    ruleForm.returnUserLimitSetting.limit = ''
  } else {
    ruleForm.returnUserLimitSetting.source_type = '随机'
  }
}

function handleProperty(val: string | number | boolean | undefined) {
  if (val == '随机') {
    ruleForm.returnUserLimitSetting.sort_asc = '' //数值排序
    ruleForm.returnUserLimitSetting.sort_profile = ''
  } else {
    ruleForm.returnUserLimitSetting.sort_asc = '数值从小到大' //数值排序
    // 与 v2 一致（v2 此处逻辑存疑：直接取 userProperties[0].name，列表为空时会抛 TypeError）
    ruleForm.returnUserLimitSetting.sort_profile = propertyList.userProperties?.[0]?.name ?? ''
  }
}

function handleInput(val: string) {
  // 确保输入的值不低于1
  if (
    ruleForm.returnUserLimitSetting.limit &&
    Number(ruleForm.returnUserLimitSetting.limit) < 1
  ) {
    ruleForm.returnUserLimitSetting.limit = 1
  }
  if (val) {
    isSaveClose.value = false
  } else {
    isSaveClose.value = true
  }
}

/* ------------------------------- 回显 ----------------------------------- */

function parseEvent() {
  const query = route.query
  fromPath.value = typeof query.from === 'string' ? query.from : undefined
  createIndex.value = String(query.createIndex ?? '')
  if (query.id) {
    // 编辑模式
    const token = nextDetail()
    void get({ id: query.id, projectName: projectName.value }).then((res) => {
      if (!isLatestDetail(token)) return
      if (res?.code == 200) {
        apiLoading.value = true
        formula.value = res.data || {}
        const data = formula.value
        ruleForm.displayName = data.displayName ?? ''
        ruleForm.description = data.description ?? ''
        ruleForm.name = data.name ?? ''
        ruleForm.updateType = data.updateType ?? ''
        ruleForm.frequency = data.frequency ?? ''
        ruleForm.frequencyTime = data.frequencyTime ?? ''
        // 转化周月多选格式
        filterDateRange(data.frequency)
        if (data.frequencyValue) {
          ruleForm.frequencyValue = data.frequencyValue
            .split(',')
            .map(Number)
            .filter(Boolean)
        }

        if (ruleForm.updateType == '手动') {
          checked.value = true
          ruleForm.returnUserLimitSetting = JSON.parse(
            data.returnUserLimitSetting || '{}',
          ) as GroupRuleForm['returnUserLimitSetting']
        }
        // 与 v2 一致（v2 此处逻辑存疑：v2 是把 formula 里的每个同名字段直接抄到 ruleForm 上，
        // 「例行」时 ruleForm.returnUserLimitSetting 会变成后端返回的 JSON 字符串；
        // 但保存时「例行」分支又会把它整体覆盖成 {}，所以这里保留默认对象，结果等价）

        // 复制清空id进行创建新模型
        if (query.name == 'creator') {
          formula.value.id = ''
        }
      }
    })
  } else {
    // 新增
    apiLoading.value = true
  }
}

/* --------------------------------- 接口 --------------------------------- */

// 临时调试分群接口
function getCategoryApi() {
  const token = nextCategory()
  void getTreeList({ projectName: projectName.value }).then((response) => {
    if (!isLatestCategory(token)) return
    if (response?.data) {
      const transform = (arr: Record<string, unknown>[]): PropertyNode[] => {
        return arr.map((item) => {
          const newItem: PropertyNode = {
            name: (item.tableName ? item.tableName : item.id) as string, // 把 id 改为 name
            displayName: item.displayName as string,
            tableName: item.tableName as string,
            dataType: item.valueType as string,
            // 带上接口的 tag 标记：只有标签可选，分类（含空分类）不可选
            tag: item.tag as boolean | undefined,
          }
          if (!item.tag && item.children) {
            newItem.children = transform(item.children as Record<string, unknown>[])
          }
          return newItem
        })
      }
      // 转换结果
      propertyList.userTagList = transform(response.data as Record<string, unknown>[])
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
  const token = nextGroupList()
  void getlistpage(params).then((res) => {
    if (!isLatestGroupList(token)) return
    if (res?.code == 200) {
      propertyList.userGroupList = (res.data?.rows || []) as PropertyNode[]
      // 设置渲染名
      propertyList.userGroupList.forEach((item) => {
        item.name = item.tableName
      })
      getCommonPropertyList()
      getListEventPrototype('事件') //获取指标属性
    }
  })
}

//事件属性
function getListEventPrototype(type: string) {
  const params = {
    projectName: projectName.value,
    type: type,
  }
  const token = nextNoGroupEvent()
  void getListNoGroupEventApi(params).then((res) => {
    if (!isLatestNoGroupEvent(token)) return
    if (res?.code == 200) {
      if (type == '用户') {
        pointTypeList.userProtoList = (res.data || []) as PropertyNode[]
      } else {
        pointTypeList.eventProtoList = (res.data || []) as PropertyNode[]
      }
      const setDataList = {
        commonPropertySum: pointTypeList.eventProtoList || [],
        userGroupList: propertyList.userGroupList,
        userProperties: propertyList.userProperties,
        userTagList: propertyList.userTagList,
      }

      trackingStore.setPropertyList(setDataList)
      setLocalStorage('propertyList', setDataList)
    }
  })
}

// 通用属性
function getCommonPropertyList() {
  const token = nextCommonProp()
  void getCommonPropertyListApi({
    projectName: projectName.value,
  }).then((res) => {
    if (!isLatestCommonProp(token)) return
    if (res?.code == 200) {
      const data = (res.data || {}) as {
        commonProperties?: PropertyNode[]
        commonPresetProperties?: PropertyNode[]
        userProperties?: PropertyNode[]
      }
      propertyList.commonPropertySum = [
        ...(data.commonProperties || []),
        ...(data.commonPresetProperties || []),
      ]
      propertyList.userProperties = data.userProperties || []
    }
  })
}

// 指标联级事件
function getPrototype() {
  const token = nextPrototype()
  void getGroupedPropertiesApi({
    projectName: projectName.value,
  }).then((res) => {
    if (!isLatestPrototype(token)) return
    if (res?.code == 200) {
      if (res.data) {
        const mergedData = mergeCommonPropertiesToEvents(
          res.data as Parameters<typeof mergeCommonPropertiesToEvents>[0],
        )
        pointProtoList.value = (mergedData?.events || []) as unknown as PropertyNode[]
      }
    }
  })
}

/* ------------------------------ 复制 / 调试 ------------------------------ */

function checkAndPrint(str?: string) {
  if (!str) {
    return ''
  }
  const regex = /_10[0-9]/g // 正则表达式匹配以 _10 开头的数字

  const matches = str.match(regex)
  if (matches) {
    const lastMatch = matches[matches.length - 1] ?? ''
    return lastMatch.match(/_(\d+)/)?.[1] ?? ''
  }
  return undefined
}

function copyNewNameEvent() {
  const matchNum = checkAndPrint(formula.value.name)
  if (!ruleForm.returnUserLimitSetting.source_type) {
    ruleForm.returnUserLimitSetting = {
      source_type: '随机',
      sort_profile: '',
      sort_asc: '',
      limit: '',
    }
  }
  if (!matchNum) {
    ruleForm.name = formula.value.name + '_101'
    ruleForm.displayName = formula.value.displayName + '_101'
  } else {
    ruleForm.name = formula.value.name + '_' + (Number(matchNum) + 1)
    ruleForm.displayName = formula.value.displayName + '_' + (Number(matchNum) + 1)
  }
}

// 复制规则
function copyRules() {
  void router.push({
    path: siblingPath(route.path, 'creator'),
    query: {
      createIndex: createIndex.value,
      createType: 'custom',
    },
  })
  copyNewNameEvent()
}

/** 合并 tagModelList 与 ruleForm（v2 各处都是 Object.assign(tagModelList, ruleForm)） */
function buildSaveObject(): SaveModel | undefined {
  const model = customTagPageRef.value?.tagModelList
  if (!model) return undefined
  return Object.assign(model, { ...ruleForm }) as SaveModel
}

/** 把当前的日历级联选项写进模型，编辑回显时再取出来 */
function attachCascaderList(obj: SaveModel) {
  const rules0 = obj.ruleList[0]?.rules
  if (!rules0) return
  if (rules0.behavior.measures.length > 0) {
    const m = rules0.behavior.measures[0]
    if (m) m.echoObj.cascaderList = customTagPageRef.value?.cascaderList
  } else if (rules0.sequence.sequences.length > 0) {
    const s = rules0.sequence.sequences[0]
    if (s) s.echoObj.cascaderList = customTagPageRef.value?.cascaderList
  }
}

function handleConsole() {
  const obj = buildSaveObject()
  if (!obj) return
  if (createIndex.value == 1) {
    attachCascaderList(obj)
  }
  // 与 v2 一致（v2 此处逻辑存疑：createIndex == 2 的分支里读的是 this.$refs.basicpointer，
  // 这个 ref 在本组件里根本不存在，一旦走到必然抛错；导入创建入口本身也被注释掉了，这里省略该分支）
  console.log('模型-对象---->', obj)
  console.log('JSON总模型---->', JSON.stringify(obj))
}

/* -------------------------------- 估算 ---------------------------------- */

/**
 * 与 v2 一致：模板上写的是 `@click="estimateEvent"`（不是 `estimateEvent()`），
 * 所以点「估算」时 noValid 拿到的是 MouseEvent —— 恒为真值，会先走一遍保存校验。
 * 这里保持同样的绑定和判断。
 */
function estimateEvent(noValid?: unknown) {
  if (noValid) {
    const isEmpty = submitSaveForm('估算')
    if (isEmpty) return
  }
  const params: Record<string, unknown> = {
    name: '',
    displayName: '',
    categoryId: '',
    description: '',
    valueType: '',
    tagValue: '',
    updateType: '',
    frequency: '',
    frequencyTime: '',
    createType: '',
    formula: '',
    projectName: '',
    id: '',
  }
  let obj: SaveModel | undefined

  // 与 v2 一致：v2 这里 if (this.formula && this.formula.id) 与 else 两个分支的代码完全相同
  if (createIndex.value == 1) {
    obj = buildSaveObject()
    if (obj) obj.formula = JSON.stringify(obj.ruleList)
  }
  if (obj) {
    const source = obj as unknown as Record<string, unknown>
    for (const key in source) {
      if (key in params) {
        params[key] = source[key] // 如果存在，则赋值
      }
    }
  }
  params.createType = createMetFilter(createIndex.value)
  params.projectName = projectName.value

  ruleSavingLoad.value = true

  groupEstimate(params)
    .then((res) => {
      if (res?.code == 200) {
        ruleSavingLoad.value = false
        estimateDialogRef.value?.dialogEvent(res.data || [], {
          typeName: '用户分群',
        })
        if (res.data) {
          if (res.data.length > 0) {
            ruleForm.isEstimate = true
          } else {
            ruleForm.isEstimate = 'empty'
          }
        }
      }
    })
    .catch(() => {
      ruleSavingLoad.value = false
    })
}

/* -------------------------------- 保存 ---------------------------------- */

/** 校验一: 检验分层数据是否为空。返回 { isPass, isEmpty }，语义与 v2 完全一致 */
function validateRuleList(ruleList: RuleListItem[]) {
  let isEmpty = false
  let isPass: number | null = null

  for (let i = 0; i < ruleList.length; i++) {
    const item = ruleList[i]
    if (!item) continue
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
      // 遍历 filters 数组
      for (let j = 0; j < itemJ.length; j++) {
        const conditions = itemJ[j]?.conditions || []
        // 遍历 conditions 数组
        for (let k = 0; k < conditions.length; k++) {
          const singCondition = conditions[k]
          if (!singCondition) continue
          const paramsLength = verificaRules(singCondition.function)
          // 提前判断 params 是否为空或长度不匹配
          if (paramsLength > 0) {
            // 判断时间区间-多个选择事件是否为空
            if (paramsLength > 1 && singCondition.params.length !== paramsLength) {
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
            const conditions = itemN[n]?.conditions
            if (conditions) {
              for (let o = 0; o < conditions.length; o++) {
                const itemO = conditions[o]
                if (!itemO) continue
                const innerLength = verificaRules(itemO.function)
                const innerParams = itemO.params
                // 校验空值
                if (innerLength > 0) {
                  if (innerLength > 1 && innerParams.length !== innerLength) {
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
          const stepFilters = stepsM[n]?.filter.filters || []
          if (stepFilters.length > 0) {
            for (let o = 0; o < stepFilters.length; o++) {
              const conditions = stepFilters[o]?.conditions || []
              for (let p = 0; p < conditions.length; p++) {
                const itemP = conditions[p]
                if (!itemP) continue
                const innerLength = verificaRules(itemP.function)
                const innerParams = itemP.params
                // 提前判断 params 是否为空或长度不匹配
                if (innerLength > 0) {
                  if (innerLength > 1 && innerParams.length !== innerLength) {
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
          }
        }
        if (isEmpty) {
          break
        }
      }
    }
  }

  return { isPass, isEmpty }
}

// 保存
function submitSaveForm(event?: string): boolean | undefined {
  let obj: SaveModel | undefined
  let isEmpty = false
  let isPass: number | null = null

  if (createIndex.value == 1) {
    const model = customTagPageRef.value?.tagModelList
    model?.ruleList.forEach((item) => {
      item.rules.isValid = true
    })

    obj = buildSaveObject()
    if (!obj) return undefined
    attachCascaderList(obj)

    const result = validateRuleList(obj.ruleList)
    isPass = result.isPass
    isEmpty = result.isEmpty

    // 输出结果，若无符合条件的项则是 null
    if (isPass != null || isEmpty) {
      allowSaving = false
      if (isEmpty) {
        ElMessage.error(`规则条件不能为空`)
      } else {
        ElMessage.error(`规则不合法`)
      }
    } else {
      allowSaving = true
    }
  } else if (createIndex.value == 2) {
    obj = { ...ruleForm } as unknown as SaveModel
  }

  if (event == '估算') return isPass != null || isEmpty

  const target = obj
  if (!target) return undefined

  void ruleFormRef.value?.validate((valid) => {
    if (!valid) return
    if (!allowSaving && createIndex.value == 1) return
    const params = copyObj(target) as unknown as Record<string, unknown>
    params.frequencyValue = (target.frequencyValue || []).join(',')
    // 更新方式 切换值清空
    // 与 v2 一致：v2 是把 obj.returnUserLimitSetting 就地改成 {} 再 stringify；
    // obj 就是 tagModelList，改它没有别的用处，这里换成局部变量，结果完全一样
    let limitSetting: unknown = target.returnUserLimitSetting
    if (params.updateType == '例行') {
      limitSetting = {}
    } else {
      params.frequencyTime = ''
      params.frequency = ''
    }
    // 转义成JSON
    params.returnUserLimitSetting = JSON.stringify(limitSetting)
    if (createIndex.value == 1) {
      // 清空保存后校验标识
      target.ruleList.forEach((item) => {
        delete item.rules.isValid
      })
      params.formula = JSON.stringify(target.ruleList)
      delete params.ruleList
    }
    params.projectName = projectName.value

    // 设置提示内容
    let content: string
    let btnType: string
    // 保存时校验-是否需要估算   ***新增分群 false:未曾校验；empty:估算数据为空，提示无意义内容；编辑分群：edit模型改变需要重新进行估算操作；
    if (createIndex.value == 1) {
      if (!formula.value.id) {
        if (!params.isEstimate) {
          content = isEstimate.doneTitle
          btnType = isEstimate.doneBtn
        } else if (params.isEstimate == 'empty') {
          content = isEstimate.noDidTile
          btnType = isEstimate.noDidBtn
        } else {
          content = '确定保存?'
          btnType = '保存'
        }
      } else {
        // 如果编辑条件下模型变化了-需重新进行估算
        if (params.isEstimate && params.isEstimate == 'edit') {
          content = isEstimate.doneTitle
          btnType = isEstimate.doneBtn
        } else {
          content = '确定保存?'
          btnType = '保存'
        }
      }
    } else {
      content = '确定保存?'
      btnType = '保存'
    }

    ElMessageBox.confirm(content, '提示', {
      confirmButtonText: btnType,
      cancelButtonText: '取消',
      cancelButtonClass: 'custom-cancel-button',
      type: 'warning',
      customClass: 'my-confirm',
      closeOnClickModal: false,
    })
      .then(() => {
        if (createIndex.value == 1) {
          const shouldEstimate =
            (!formula.value.id && !params.isEstimate) ||
            (formula.value.id && params.isEstimate === 'edit')
          if (shouldEstimate) {
            return estimateEvent(true)
          } else {
            isExecute(params)
          }
        }
      })
      .catch(() => undefined)
  })
  return undefined
}

function isExecute(params: Record<string, unknown>) {
  delete params.isEstimate
  ruleSavingLoad.value = true
  if (formula.value && formula.value.id) {
    params.createType = formula.value.createType
    params.id = formula.value.id
    edit(params)
      .then((res) => {
        ruleSavingLoad.value = false
        if (res?.code == 200) {
          void router.push({ path: siblingPath(route.path, 'list') })
          ElMessage.success('修改成功')
        }
      })
      .catch(() => {
        ruleSavingLoad.value = false
      })
  } else {
    // 新增接口
    params.createType = createMetFilter(createIndex.value)
    add(params)
      .then((res) => {
        ruleSavingLoad.value = false
        if (res?.code == 200) {
          ElMessage.success('新增成功')
          void router.push({ path: siblingPath(route.path, 'list') })
        }
      })
      .catch(() => {
        ruleSavingLoad.value = false
      })
  }
}

/* -------------------------------- 其它 ---------------------------------- */

function cancleEvent() {
  ElMessageBox.confirm('离开将丢失已编辑的内容，是否离开？', '确认离开?', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    cancelButtonClass: 'custom-cancel-button',
    type: 'warning',
  })
    .then(() => {
      void router.push({ path: siblingPath(route.path, 'list') })
    })
    .catch(() => undefined)
}

function returnTagsPagess(list: PropertyNode[]) {
  tagTree.value = list || []
}

function rulesDialogEvent() {
  rulesDialogRef.value?.openEvent('切换')
}

/* ------------------------------- 生命周期 ------------------------------- */

watch(
  () => route.fullPath,
  () => {
    if (!route.query.id) {
      createIndex.value = String(route.query.createIndex ?? '')
    }
    formula.value.id = typeof route.query.id === 'string' ? route.query.id : undefined
  },
)

// 1.切换项目 / 项目和标签模型不匹配则跳到list page
watch(projectName, () => {
  void router.push({ path: siblingPath(route.path, 'list') })
})

onMounted(() => {
  // 2.切换项目 / 项目和标签模型不匹配则跳到list page
  validateProjectName(
    typeof route.query.projectName === 'string' ? route.query.projectName : undefined,
  )
  // 初始调用
  getCategoryApi()
  getPrototype()
  parseEvent()
})

onBeforeUnmount(() => {
  localStorage.removeItem('propertyList')
})
</script>

<template>
  <div style="position: relative; min-height: calc(100vh - 50px)">
    <filterBar :by-tag-rules="true" @return-tags-pagess="returnTagsPagess" />
    <div class="public-block" style="border-radius: 6px; position: relative">
      <div
        class="block_online block-main public-hoverItem"
        style="min-height: 140px; margin-bottom: 20px; position: relative"
      >
        <div class="base_info">
          <div class="infoTitle">
            <span class="public-firstHead">基础信息</span>
          </div>
          <div
            v-if="isCalculating"
            style="
              width: 100%;
              height: 30px;
              background: #2c7be5;
              color: #fff;
              line-height: 30px;
              font-size: 13px;
              margin-top: 15px;
              padding: 0 15px;
              border-radius: 3px;
            "
          >
            "该分群正在计算中，暂时无法修改分群规则"
          </div>
          <el-form
            ref="ruleFormRef"
            style="margin-top: 20px"
            :model="ruleForm"
            :rules="rules"
            label-width="100px"
            class="demo-ruleForm"
          >
            <div style="display: flex; flex-wrap: wrap; margin-top: -5px">
              <div style="min-width: 600px">
                <el-form-item label="分群名称" prop="displayName">
                  <el-input
                    v-model="ruleForm.displayName"
                    :disabled="baseDisabled"
                    style="width: 400px"
                    placeholder="请输入分群名称"
                  />
                </el-form-item>
                <el-form-item label="更新方式" prop="updateType">
                  <el-radio-group
                    v-model="ruleForm.updateType"
                    :disabled="filterDisabled"
                    size="small"
                    style="height: 30px"
                    @change="handleMethod"
                  >
                    <el-radio value="例行" border>例行</el-radio>
                    <el-radio value="手动" border>手动</el-radio>
                  </el-radio-group>
                </el-form-item>
                <el-form-item v-if="ruleForm.updateType == '例行'" label="更新时间">
                  <div style="display: flex; font-size: 13px">
                    <span>每</span>
                    <el-select
                      v-model="ruleForm.frequency"
                      :disabled="baseDisabled"
                      style="width: 90px; height: 30px; margin: 0 15px"
                      @change="filterDateRange"
                    >
                      <el-option
                        v-for="item in updateTimeList"
                        :key="item.value"
                        :label="item.label"
                        :value="item.value"
                      />
                    </el-select>
                    <el-select
                      v-if="ruleForm.frequency != '天'"
                      v-model="ruleForm.frequencyValue"
                      multiple
                      collapse-tags
                      style="margin-right: 15px; width: 180px"
                      placeholder="请选择"
                    >
                      <el-option
                        v-for="item in dateRangeList"
                        :key="item.value"
                        :label="item.label"
                        :value="item.value"
                      />
                    </el-select>
                    <el-select
                      v-model="ruleForm.frequencyTime"
                      :disabled="baseDisabled"
                      style="width: 90px; height: 30px; margin-right: 15px"
                    >
                      <el-option
                        v-for="item in hourOptions"
                        :key="item.value"
                        :label="item.label"
                        :value="item.value"
                      />
                    </el-select>
                    <span>开始计算</span>
                  </div>
                </el-form-item>
                <el-form-item v-else label="人数限制">
                  <el-checkbox
                    v-model="checked"
                    :disabled="baseDisabled"
                    @change="handleCheckBox"
                  >
                    限制人群返回数量
                  </el-checkbox>
                  <div v-if="checked" style="display: flex; font-size: 13px">
                    <span>按</span>
                    <el-select
                      v-model="ruleForm.returnUserLimitSetting.source_type"
                      :disabled="baseDisabled"
                      style="width: 90px; height: 30px; margin-left: 15px"
                      @change="handleProperty"
                    >
                      <el-option
                        v-for="item in propertyTypeList"
                        :key="item.value"
                        :label="item.label"
                        :value="item.value"
                      />
                    </el-select>
                    <el-select
                      v-if="ruleForm.returnUserLimitSetting.source_type == '属性'"
                      v-model="ruleForm.returnUserLimitSetting.sort_profile"
                      :disabled="baseDisabled"
                      style="width: 140px; height: 30px; margin-left: 15px"
                    >
                      <el-option
                        v-for="item in propertyList.userProperties"
                        :key="item.name"
                        :label="item.displayName"
                        :value="item.name"
                      />
                    </el-select>
                    <el-select
                      v-if="ruleForm.returnUserLimitSetting.source_type == '属性'"
                      v-model="ruleForm.returnUserLimitSetting.sort_asc"
                      :disabled="baseDisabled"
                      style="width: 130px; height: 30px; margin-left: 15px"
                    >
                      <el-option
                        v-for="item in sortList"
                        :key="item.value"
                        :label="item.label"
                        :value="item.value"
                      />
                    </el-select>
                    <span style="margin-left: 15px; white-space: nowrap">返回</span>
                    <el-input
                      v-model="ruleForm.returnUserLimitSetting.limit"
                      :disabled="baseDisabled"
                      type="number"
                      min="1"
                      style="width: 80px; height: 30px; margin: 0 15px"
                      @input="handleInput"
                    />
                    <div>人</div>
                  </div>
                </el-form-item>
              </div>
              <!-- 第二行 -->
              <div>
                <el-form-item label="分群标识" prop="name">
                  <el-input
                    v-model="ruleForm.name"
                    style="width: 400px"
                    placeholder="请输入分群标识"
                    :disabled="filterDisabled"
                  >
                    <template #prepend>user_group_{{ projectName + '_' }}</template>
                  </el-input>
                </el-form-item>
                <el-form-item label="备注" prop="description" style="margin-bottom: 0">
                  <el-input
                    v-model="ruleForm.description"
                    :disabled="baseDisabled"
                    type="textarea"
                    maxlength="1000"
                    show-word-limit
                    style="width: 400px"
                    placeholder="请输入备注"
                    rows="3"
                  />
                </el-form-item>
              </div>
            </div>
          </el-form>
        </div>
      </div>

      <div
        v-loading="ruleSavingLoad"
        style="min-height: 700px; margin-bottom: 120px; overflow: auto"
        class="block_online block-main public-hoverItem"
        element-loading-text="加载中"
      >
        <!-- 分群-规则创建 -->
        <div class="tags_rules">
          <div class="infoTitle" style="position: relative">
            <span class="public-firstHead">分群规则</span>
            <div
              style="
                position: absolute;
                right: 20px;
                display: flex;
                align-items: center;
                font-size: 16px;
              "
            >
              <div class="public-threeHead" style="margin-top: 0px; line-height: 30px">
                预估人数
              </div>
              <el-select
                v-model="estimate"
                :disabled="baseDisabled"
                style="width: 150px; height: 30px; margin: 0 15px"
              >
                <el-option
                  v-for="item in estimateList"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
              <el-button
                :style="formula.creator ? 'z-index:889' : ''"
                class="zc_btn"
                :disabled="baseDisabled"
                @click="estimateEvent"
              >
                估算
              </el-button>
            </div>
            <estimateDialog ref="estimateDialogRef" />
          </div>
          <div style="display: flex; margin-top: 50px; align-items: center">
            <div class="public-threeHead createTitle">创建方式:</div>
            <div v-if="!route.query.id" class="customTitle" @click="rulesDialogEvent">
              {{ createMetLabel }}
            </div>
            <div v-else class="customTitle" style="color: #acaeaf; cursor: auto">
              {{ createMetLabel }}
            </div>
          </div>

          <!-- 自定义分群值 -->
          <div v-if="apiLoading" style="position: relative">
            <customTagPage
              v-show="createIndex == 1"
              ref="customTagPageRef"
              :formula="formula"
              :point-proto-list="pointProtoList"
              :property-list="propertyList"
              @re-estimate="reEstimate"
            />
            <leadingCreate v-show="createIndex == 2" :property-list="propertyList" />
            <div
              v-if="ruleMaskVisible"
              style="
                position: absolute;
                width: 100%;
                height: calc(100% - 15px);
                top: 15px;
                z-index: 888;
                cursor: not-allowed;
                background: rgb(200 202 203);
                opacity: 0.1;
              "
            ></div>
          </div>

          <!-- end -->
        </div>
      </div>
    </div>

    <div
      class="footer_con"
      style="
        background: #fff;
        height: 60px;
        width: 100%;
        position: fixed;
        bottom: 0;
        left: -20;
        z-index: 999;
        box-shadow: 0 1px 4px rgba(0, 21, 41, 0.15);
      "
    >
      <div style="display: flex; align-items: center">
        <div
          v-if="formula.creator || route.query.createType"
          style="display: flex; align-items: center; height: 60px; margin-left: 60px"
        >
          <el-button
            :disabled="isSaveClose"
            class="zc_btn"
            :style="isSaveClose ? 'background : rgb(230 230 230) !important' : ''"
            @click="submitSaveForm()"
          >
            保存
          </el-button>
          <el-button class="zc_btn_default" style="margin-left: 40px" @click="cancleEvent">
            取消
          </el-button>
        </div>
        <div
          v-if="!route.query.createType"
          style="display: flex; align-items: center; height: 60px; margin-left: 35px"
        >
          <el-button class="zc_btn" style="margin-left: 0px" @click="copyRules">
            复制分群
          </el-button>
        </div>
        <el-button
          v-if="isDebug"
          class="zc_btn_default"
          style="margin-left: 35px"
          @click="handleConsole"
        >
          打印模型
        </el-button>
      </div>
    </div>
    <!-- end -->
    <rulesDialog ref="rulesDialogRef" />
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

:deep() {
  .el-dialog__header {
    text-align: left;
  }

  .el-checkbox__label {
    font-size: 12px;
  }

  .el-input-group__append,
  .el-input-group__prepend {
    padding: 0 10px;
  }

  .el-form-item__label {
    font-size: 13px;
    font-weight: 500;
    text-align: right;
    color: #4d4d4d;
    padding-right: 30px;
  }

  .el-textarea__inner {
    font-size: 13px;
  }

  .el-input__wrapper {
    font-size: 13px;
  }

  .el-radio {
    margin-right: 10px;
  }
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
