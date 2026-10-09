<script setup lang="ts">
/**
 * 标签新建 / 编辑页（对应 v2 src/views/ups/userTag/tag-creator.vue）。
 *
 * 顶部是基础信息表单，下面按 createIndex（1~6）切到六种创建方式之一，
 * 底部固定条是保存 / 取消 / 复制标签，以及分层过多时的标签值 tab 锚点。
 *
 * 父子约定（v2 是 $refs 直接读写，v3 全部换成 ref + 子组件 defineExpose）：
 *   customTagPage           → tagModelList / cascaderList / getSectionEl(refName)
 *   basicpointer            → modelObject / cascaderList
 *   firstLastFeature        → modelObject / cascaderList
 *   eventPreference         → modelObject / cascaderList
 *   behavioralDistribResult → modelObject / cascaderList
 *   sqlRules                → modelObject
 *   estimateDialog          → dialogEvent(data, type)
 *   rulesDialog             → openEvent('切换')
 *   ruleForm(el-form)       → validate(cb)
 *
 * element-plus 适配：
 *   @riophae/vue-treeselect（标签分类）→ el-tree-select
 *     :normalizer(id: node.id / label: node.name / children) → :props
 *     :disable-branch-nodes="true"                           → :props.disabled
 *   slot="prepend" / slot="header" / slot="label" → <template #prepend> / #header / #label
 *   el-icon-xxx  → <el-icon> + icons-vue（类名沿用 v2，样式不动）
 *   this.$set / this.$delete → 直接赋值 / delete
 *   this.$confirm → ElMessageBox.confirm；this.$message → ElMessage
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowRight, Close } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import filterBar from './components/filterBar.vue'
import rulesDialog from './components/rulesDialog.vue'
import customTagPage from './components/customTagPage/index.vue'
import basicpointer from './components/basicpointer/index.vue'
import firstLastFeature from './components/firstLastFeature/index.vue'
import eventPreference from './components/eventPreference/index.vue'
import behavioralDistribResult from './components/behavioralDistribResult/index.vue'
import sqlRules from './components/sqlRules/index.vue'
import estimateDialog from '@/views/ups/components/estimate-dialog.vue'
import { add, check, edit, estimate, get } from '@/api/upsapi/tagmanage'
// 接口
import {
  getCommonPropertyListApi,
  getGroupedPropertiesApi,
  getListNoGroupEventApi,
} from '@/api/sysmanage/manageEvent'
import { getlistpage } from '@/api/upsapi/usergroup'
import { getTreeList } from '@/api/upsapi/categorymanage'
import { copyObj } from '@/utils/copy'
import { estimateList, updateTimeList } from '@/utils/modelOptions/up-manage'
import type { ValueLabel } from '@/utils/modelOptions/up-manage'
import { mergeCommonPropertiesToEvents } from '@/utils/mergeEventProperties'
import { useTrackingStore } from '@/stores/tracking'
import { useLatestOnly } from '@/composables/useLatestOnly'
import { isEmptyParams, verificaRules, weekOrMonthRangeList } from './local-utils'
import type {
  CategoryNode,
  ConditionItem,
  MeasureItem,
  PointTypeList,
  PropertyListMap,
  PropertyNode,
  SequenceItem,
  TagFormula,
  TagRuleLayer,
} from './types'

/** 基础信息表单 */
interface RuleForm {
  displayName: string
  categoryId: string | null
  description: string
  name: string
  updateType: string
  frequency: string
  frequencyValue: number[]
  frequencyTime: string
  /** 保存时校验用的标识：false 未曾校验 / true 已估算 / 'empty' 估算结果为空 / 'edit' 模型变了要重估 */
  isEstimate?: boolean | string
}

/** 六种创建方式统一拼出来的保存模型（Object.assign 的结果） */
type SaveModel = Record<string, unknown> & {
  ruleList?: TagRuleLayer[]
  rules?: { measures: MeasureItem[]; relation?: string }
  frequencyValue?: number[] | string
  formula?: string
  isEstimate?: boolean | string
  displayName?: string
  name?: string
  categoryId?: string | null
}

// config.js 里没有声明 isDebug，不改公共的 env.d.ts，这里按可选字段读
const extraConfig = window.globalConfig as unknown as { isDebug?: boolean }

const route = useRoute()
const router = useRouter()
const trackingStore = useTrackingStore()

// 每个取数函数一套 useLatestOnly
const detailLatest = useLatestOnly()
const categoryLatest = useLatestOnly()
const groupLatest = useLatestOnly()
const commonPropertyLatest = useLatestOnly()
const eventPrototypeLatest = useLatestOnly()
const prototypeLatest = useLatestOnly()

const scollLayer = ref<{ isOpenMore: boolean; ruleList: TagRuleLayer[] }>({
  isOpenMore: false,
  ruleList: [],
})
const abchorPoint = ref('')
const layerListData = ref<TagRuleLayer[]>([])
const ruleSavingLoad = ref(false) //规则加载中
const isDebug = ref<boolean>(extraConfig.isDebug || false)
const allowSaving = ref(false) //是否开启估算
const fromPath = ref('')
const tagTree = ref<CategoryNode[]>([])
const createIndex = ref<string | number>('') //标签类型
const formula = ref<TagFormula>({}) //是否编辑模型
const estimateValue = ref('all')

// 规则
const ruleForm = ref<RuleForm>({
  displayName: '',
  categoryId: null,
  description: '',
  name: '',
  updateType: '例行',
  frequency: '天',
  frequencyValue: [1],
  frequencyTime: '00:00',
})
const dateRangeList = ref<ValueLabel<number>[]>([])

// 初始data
const pointProtoList = ref<PropertyNode[]>([]) //全部指标
const propertyList = ref<PropertyListMap>({
  //公用属性
  commonPropertySum: [], //共用事件属性
  userProperties: [], //共用用户属性
  userGroupList: [], //用户分群
  userTagList: [], //用户标签
})
const pointTypeList = ref<PointTypeList>({
  //全部属性
  //用户/事件
  userProtoList: [],
  eventProtoList: [],
})
const isEstimateText = {
  doneTitle: '为了保证标签的计算结果分布符合预期，请先预估人数。',
  doneBtn: '去估算',
  noDidTile: '没有符合该标签规则下的用户，确认保存吗？',
  noDidBtn: '保存',
}

const ruleFormRef = ref<FormInstance | null>(null)
const rulesDialogRef = ref<InstanceType<typeof rulesDialog> | null>(null)
const estimateDialogRef = ref<InstanceType<typeof estimateDialog> | null>(null)
const customTagPageRef = ref<InstanceType<typeof customTagPage> | null>(null)
const basicpointerRef = ref<InstanceType<typeof basicpointer> | null>(null)
const firstLastFeatureRef = ref<InstanceType<typeof firstLastFeature> | null>(null)
const eventPreferenceRef = ref<InstanceType<typeof eventPreference> | null>(null)
const behavioralDistribResultRef = ref<InstanceType<typeof behavioralDistribResult> | null>(null)
const sqlRulesRef = ref<InstanceType<typeof sqlRules> | null>(null)

const projectName = computed(() => trackingStore.projectName)

const hourOptions = computed<ValueLabel[]>(() => {
  const list: ValueLabel[] = []
  for (let i = 0; i < 24; i++) {
    const hour = String(i).padStart(2, '0') // 确保两位数
    const params = {
      // value: hour || 0,
      value: `${hour}:00`,
      label: `${hour}:00`,
    }
    list.push(params)
  }
  return list
})

/** el-tree-select 的字段映射（等价 v2 的 normalizer） */
const categoryTreeProps = {
  value: 'id',
  label: 'name',
  children: 'children',
}

/*
 * 这里**不能**把 v2 的 :disable-branch-nodes="true" 直译成 props.disabled。
 *
 * vue-treeselect 的该选项只是「父节点不可选」，点父节点依然展开/收起；
 * element-plus 的 el-tree-select 里，分支一旦 disabled，点击就彻底没反应 ——
 * 见 element-plus/es/components/tree-select/src/tree.mjs 的 onNodeClick：
 *     if (!showCheckbox && (checkStrictly || node.isLeaf)) {
 *       if (!disabled) { 选中 }            // ← 禁用：不选中
 *     } else if (expandOnClickNode) { 展开 } // ← 也走不到这里
 * 而且 expandOnClickNode 还被 computed(() => !checkStrictly && expandOnClickNode) 强制关掉，
 * 所以「check-strictly + disabled 分支」这对组合 = 父节点置灰且完全点不动，只能点那个很小的三角。
 *
 * 正确做法是**同时去掉 check-strictly 和 disabled**：
 * 此时 onNodeClick 的判断变成 (false || node.isLeaf) ——
 *   叶子 → 选中；分支 → 落到 else 分支展开/收起。
 * 这恰好就是 v2 vue-treeselect 的语义，且不需要任何额外代码。
 * 本组件没有用 checkbox（showCheckbox 为假），check-strictly 对其它行为无影响。
 */

function createMetFilter(index: string | number) {
  if (index == 1) {
    return '自定义标签值'
  } else if (index == 2) {
    return '基础指标值'
  } else if (index == 3) {
    return '首次末次特征'
  } else if (index == 4) {
    return '事件偏好属性'
  } else if (index == 5) {
    return '行为分布结果'
  } else if (index == 6) {
    return 'SQL计算结果'
  }
  return undefined
}

/** 模板里多处用到，抽成 computed */
const createMetLabel = computed(() => createMetFilter(createIndex.value))

const isReadonly = computed(() => !formula.value.creator && !route.query.createType)

const filterDisabled = computed(
  () => (!formula.value.creator && !route.query.createType) || !!formula.value.id,
)

/** 顶部「该标签正在计算中」提示 & 规则区的遮罩条件 */
const isCalculating = computed(
  () =>
    !!(
      formula.value.creator &&
      (formula.value.matchUserCount || formula.value.matchUserCount == 0) &&
      !route.query.createType
    ),
)
const ruleMaskVisible = computed(
  () =>
    !!(
      (!formula.value.creator ||
        formula.value.matchUserCount ||
        formula.value.matchUserCount == 0) &&
      !route.query.createType
    ),
)

function openLayerScroll(ruleList: TagRuleLayer[]) {
  scollLayer.value.ruleList = copyObj(ruleList)
  const layer_list = scollLayer.value.ruleList.map((item, index) => ({
    ...item,
    name: item.name || `第${index + 1}层`,
  }))
  layerListData.value = layer_list
}

function handleMore() {
  scollLayer.value.isOpenMore = !scollLayer.value.isOpenMore
}

function scrollToSection(refName: string) {
  void nextTick(() => {
    const element = customTagPageRef.value?.getSectionEl(refName)
    let elementPosition: number | undefined, offsetPosition: number | undefined
    if (element) {
      elementPosition = element.getBoundingClientRect().top + window.scrollY
      offsetPosition = elementPosition - 95 // 减去固定头部的高度
    }
    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth',
    })
  })
}

/**
 * 参数 1：scroll 分支传的是分层对象，tab 分支传的是 element-plus 的 TabsPaneContext
 * （v2 读的是 Element UI 的 `event._props.label` / `event.index`，
 *   element-plus 对应 `pane.props.label` / `pane.index`）
 */
function handleAbchorPoint(
  event: TagRuleLayer | { props: { label?: string }; index: string | null },
  index?: number,
  type?: string,
) {
  let refName: string
  if (type == 'scroll') {
    const layer = event as TagRuleLayer
    abchorPoint.value = layer.name
    refName = layer.name + String(index)
  } else {
    const pane = event as { props: { label?: string }; index: string | null }
    refName = String(pane.props.label ?? '') + String(pane.index ?? '')
    abchorPoint.value = String(pane.props.label ?? '')
  }
  void nextTick(() => {
    scrollToSection(refName)
  })
}

function validateProjectName(eventName?: string) {
  if (eventName && eventName != projectName.value) {
    void router.push({
      name: 'userTag',
    })
    return true
  }
  return false
}

function filterDateRange(val?: string) {
  if (val == '天') {
    ruleForm.value.frequencyValue = []
  } else {
    if (ruleForm.value.frequencyValue.length == 0) {
      ruleForm.value.frequencyValue = [1]
    }
  }
  dateRangeList.value = weekOrMonthRangeList(val)
}

function initBaseInfo() {
  if (formula.value) {
    const source = formula.value as unknown as Record<string, unknown>
    const target = ruleForm.value as unknown as Record<string, unknown>
    Object.keys(ruleForm.value).forEach((key) => {
      target[key] = source[key]
    })
    // 初始调取周/月的列表
    filterDateRange(formula.value.frequency)
    if (formula.value.frequencyValue) {
      ruleForm.value.frequencyValue = formula.value.frequencyValue
        .split(',')
        .map(Number)
        .filter(Boolean)
    }
  }
}

// 是否重新预估
function reEstimate() {
  ruleForm.value.isEstimate = 'edit'
}

function checkAndPrint(str?: string) {
  if (!str) {
    return ''
  }
  const regex = /_10[0-9]/g // 正则表达式匹配以 _10 开头的数字

  const matches = str.match(regex)
  if (matches) {
    const lastMatch = matches[matches.length - 1]
    return lastMatch?.match(/_(\d+)/)?.[1]
  }
  // 与 v2 一致：没匹配到时 v2 的 else 分支是空的，返回 undefined
  return undefined
}

function copyNewNameEvent() {
  const matchNum = checkAndPrint(formula.value.name)
  if (!matchNum) {
    ruleForm.value.name = (formula.value.name ?? '') + '_101'
    ruleForm.value.name = (formula.value.name ?? '') + '_101'
    ruleForm.value.displayName = (formula.value.displayName ?? '') + '_101'
  } else {
    ruleForm.value.name = (formula.value.name ?? '') + '_' + (Number(matchNum) + 1)
    ruleForm.value.name = (formula.value.name ?? '') + '_' + (Number(matchNum) + 1)
    ruleForm.value.displayName = (formula.value.displayName ?? '') + '_' + (Number(matchNum) + 1)
  }
}

function copyRules() {
  void router.push({
    path: '/ups/userTag/create',
    query: {
      createIndex: String(createIndex.value),
      createType: 'custom',
    },
  })
  copyNewNameEvent()
}

// 通用属性
function getCommonPropertyList() {
  const token = commonPropertyLatest.next()
  void getCommonPropertyListApi({
    projectName: projectName.value,
  }).then((res) => {
    if (!commonPropertyLatest.isLatest(token)) return
    if (res?.code == 200) {
      const data = res.data as {
        commonProperties: PropertyNode[]
        commonPresetProperties: PropertyNode[]
        userProperties: PropertyNode[]
      }
      propertyList.value.commonPropertySum = [
        ...data.commonProperties,
        ...data.commonPresetProperties,
      ]
      propertyList.value.userProperties = data.userProperties
    }
  })
}

//事件属性
function getListEventPrototype(type: string) {
  const params = {
    projectName: projectName.value,
    type: type,
  }
  const token = eventPrototypeLatest.next()
  void getListNoGroupEventApi(params).then((res) => {
    if (!eventPrototypeLatest.isLatest(token)) return
    if (res?.code == 200) {
      const data = (res.data as PropertyNode[]) || []
      if (type == '用户') {
        pointTypeList.value.userProtoList = data
      } else {
        pointTypeList.value.eventProtoList = data
      }
      // 设置treeSelect 渲染数据源
      const setDataList = {
        commonPropertySum: pointTypeList.value.eventProtoList || [],
        userGroupList: propertyList.value.userGroupList,
        userProperties: propertyList.value.userProperties,
        userTagList: propertyList.value.userTagList,
      }

      // setPropertyList 内部已经写了 localStorage，v2 额外那句 localStorage.setItem 不用再写
      trackingStore.setPropertyList(setDataList)
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
  const token = groupLatest.next()
  void getlistpage(params).then((res) => {
    if (!groupLatest.isLatest(token)) return
    if (res?.code == 200) {
      const data = res.data as { rows?: (PropertyNode & { tableName?: string })[] }
      propertyList.value.userGroupList = data.rows || []
      // 设置渲染名
      propertyList.value.userGroupList.map((item) => {
        item.name = item.tableName ?? ''
      })
      getCommonPropertyList()
      getListEventPrototype('事件') //获取指标属性
      // this.getListEventPrototype("用户"); //获取指标属性
    }
  })
}

/** getTreeList 返回的原始节点 */
interface TagCategoryTreeNode {
  id: string
  displayName?: string
  tableName?: string
  valueType?: string
  tag?: boolean
  children?: TagCategoryTreeNode[]
}

function getCategoryApi() {
  const token = categoryLatest.next()
  void getTreeList({ projectName: projectName.value }).then((response) => {
    if (!categoryLatest.isLatest(token)) return
    const data = response?.data as TagCategoryTreeNode[] | undefined
    if (data) {
      const transform = (arr: TagCategoryTreeNode[]): PropertyNode[] => {
        return arr.map((item) => {
          // 创建新对象，修改字段名
          const newItem: PropertyNode = {
            name: item.tableName ? item.tableName : item.id, // 把 id 改为 name
            displayName: item.displayName ?? '',
            tableName: item.tableName,
            dataType: item.valueType,
            // 带上接口的 tag 标记：只有标签可选，分类（含空分类）不可选
            tag: item.tag,
          }
          // 递归处理 children，并且如果 children 是空数组则删除
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

// 指标联级事件
function getPrototype() {
  const token = prototypeLatest.next()
  void getGroupedPropertiesApi({
    projectName: projectName.value,
  }).then((res) => {
    if (!prototypeLatest.isLatest(token)) return
    if (res?.code == 200) {
      if (res.data) {
        const mergedData = mergeCommonPropertiesToEvents(
          res.data as Parameters<typeof mergeCommonPropertiesToEvents>[0],
        )
        pointProtoList.value = (mergedData && (mergedData.events as PropertyNode[])) || []
      }
    }
  })
}

/** 把各创建方式的模型和基础信息合成一份保存参数（v2 的 Object.assign 写法，会就地改子组件模型） */
function buildModel(): SaveModel | undefined {
  let obj: SaveModel | undefined
  if (createIndex.value == 1) {
    const page = customTagPageRef.value
    if (!page) return undefined
    obj = Object.assign(page.tagModelList as unknown as SaveModel, ruleForm.value)
    const rules = obj.ruleList?.[0]?.rules
    if (!rules) return obj
    if (rules.behavior.measures.length > 0) {
      const measure = rules.behavior.measures[0]
      if (measure) measure.echoObj.cascaderList = page.cascaderList
    } else if (rules.sequence.sequences.length > 0) {
      const seq = rules.sequence.sequences[0]
      if (seq) seq.echoObj.cascaderList = page.cascaderList
    }
  } else if (createIndex.value == 2) {
    const page = basicpointerRef.value
    if (!page) return undefined
    obj = Object.assign(page.modelObject as unknown as SaveModel, ruleForm.value)
    const measure = obj.rules?.measures[0]
    if (measure) measure.echoObj.cascaderList = page.cascaderList
  } else if (createIndex.value == 3) {
    const page = firstLastFeatureRef.value
    if (!page) return undefined
    obj = Object.assign(page.modelObject as unknown as SaveModel, ruleForm.value)
    const measure = obj.rules?.measures[0]
    if (measure) measure.echoObj.cascaderList = page.cascaderList
  } else if (createIndex.value == 4) {
    const page = eventPreferenceRef.value
    if (!page) return undefined
    obj = Object.assign(page.modelObject as unknown as SaveModel, ruleForm.value)
    const measure = obj.rules?.measures[0]
    if (measure) measure.echoObj.cascaderList = page.cascaderList
  } else if (createIndex.value == 5) {
    const page = behavioralDistribResultRef.value
    if (!page) return undefined
    obj = Object.assign(page.modelObject as unknown as SaveModel, ruleForm.value)
    const measure = obj.rules?.measures[0]
    if (measure) measure.echoObj.cascaderList = page.cascaderList
  } else {
    const page = sqlRulesRef.value
    if (!page) return undefined
    obj = Object.assign(page.modelObject as unknown as SaveModel, ruleForm.value)
  }
  return obj
}

// 打印 console 结果
function handleConsole() {
  const obj = buildModel()
  console.log('JSON总模型---->', JSON.stringify(obj))
  console.log('规则对象模型', obj)
}

function isExecute(params: SaveModel) {
  //3. delete isEstimate 字段标识
  ruleSavingLoad.value = true
  delete params.isEstimate
  // 编辑接口
  if (formula.value && formula.value.id) {
    params.createType = formula.value.createType
    params.id = formula.value.id
    edit(params)
      .then((res) => {
        ruleSavingLoad.value = false
        if (res?.code == 200) {
          void router.push({
            name: 'userTag',
          })
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
          void router.push({
            name: 'userTag',
          })
        }
      })
      .catch(() => {
        ruleSavingLoad.value = false
      })
  }
}

/**
 * 估算结果行（estimate-dialog 的入参）。
 * 用 type 而不是 interface：estimate-dialog 的 EstimateRow 带 `[key: string]: unknown`
 * 索引签名，只有类型别名才有隐式索引签名，写成 interface 传参处会报缺索引签名。
 */
type EstimateRow = {
  name?: string
  count?: number
  totalTagged?: number
  totalUser?: number
}

/**
 * noValid 用 unknown 而不是 boolean：模板上绑的是 `@click="estimateEvent"`，
 * 点击时实际传进来的是 MouseEvent（只取其真值性），与 v2 一致。
 * 保存流程里则是显式 estimateEvent(true)。
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
    frequencyValue: [],
    frequencyTime: '',
    createType: '',
    formula: '',
    projectName: projectName.value,
    id: '',
  }
  let obj: SaveModel | undefined

  // 与 v2 一致：编辑态和新增态的分支体其实一模一样
  if (createIndex.value == 1) {
    const page = customTagPageRef.value
    if (!page) return
    obj = Object.assign(page.tagModelList as unknown as SaveModel, ruleForm.value)
    obj.formula = JSON.stringify(obj.ruleList)
  }

  if (obj) {
    for (const key in obj) {
      if (key in params) {
        params[key] = obj[key] // 如果存在，则赋值
      }
    }
  }
  params.createType = createMetFilter(createIndex.value)

  ruleSavingLoad.value = true

  estimate<EstimateRow[]>(params)
    .then((res) => {
      if (res?.code == 200) {
        ruleSavingLoad.value = false
        estimateDialogRef.value?.dialogEvent(res.data || [], {
          typeName: '用户分层',
        })
        if (res.data) {
          if (res.data.length > 1) {
            ruleForm.value.isEstimate = true
          } else {
            ruleForm.value.isEstimate = 'empty'
          }
        }
      }
    })
    .catch(() => {
      ruleSavingLoad.value = false
    })
}

/** 校验单条 condition 的 params 是否合法（v2 里到处重复的那段） */
function isConditionEmpty(fn: string | undefined, params: unknown[]): boolean {
  const paramsLength = verificaRules(fn)
  // 提前判断 params 是否为空或长度不匹配
  if (paramsLength > 0) {
    // 判断时间区间-多个选择事件是否为空
    if (paramsLength > 1 && params.length !== paramsLength) {
      return true
    }
    // 判断条件是否为空值
    if (isEmptyParams(params)) {
      return true
    }
  }
  return false
}

// 保存
function submitSaveForm(event?: string) {
  let obj: SaveModel | undefined
  let isEmpty = false
  let isPass: number | null = null
  if (createIndex.value == 1) {
    const page = customTagPageRef.value
    if (!page) return undefined
    page.tagModelList.ruleList.map((item) => {
      item.rules.isValid = true
    })

    obj = Object.assign(copyObj(page.tagModelList) as unknown as SaveModel, ruleForm.value)

    const rules = obj.ruleList?.[0]?.rules
    if (rules) {
      if (rules.behavior.measures.length > 0) {
        const measure = rules.behavior.measures[0]
        if (measure) measure.echoObj.cascaderList = page.cascaderList
      } else if (rules.sequence.sequences.length > 0) {
        const seq = rules.sequence.sequences[0]
        if (seq) seq.echoObj.cascaderList = page.cascaderList
      }
    }
    //校验一: 检验分层数据是否为空
    const ruleList = obj.ruleList ?? []
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
          const conditions = itemJ[j]?.conditions ?? []
          // 遍历 conditions 数组
          for (let k = 0; k < conditions.length; k++) {
            const singCondition = conditions[k] as ConditionItem
            if (isConditionEmpty(singCondition.function, singCondition.params)) {
              isEmpty = true
              break
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
          const measure = itemM[m] as MeasureItem
          if (isConditionEmpty(measure.function, measure.params ?? [])) {
            isEmpty = true
            break
          }
          if (!isEmpty) {
            const itemN = measure.filter.filters
            for (let n = 0; n < itemN.length; n++) {
              const group = itemN[n]
              if (group?.conditions) {
                for (let o = 0; o < group.conditions.length; o++) {
                  const itemO = group.conditions[o] as ConditionItem
                  // 校验空值
                  if (isConditionEmpty(itemO.function, itemO.params)) {
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
        }
      }
      // 行为序列
      if (!isEmpty && item.rules.sequence.sequences.length > 0) {
        const itemM = item.rules.sequence.sequences
        for (let m = 0; m < itemM.length; m++) {
          const stepsM = (itemM[m] as SequenceItem).steps
          for (let n = 0; n < stepsM.length; n++) {
            const step = stepsM[n]
            if (step && step.filter.filters.length > 0) {
              const itemN = step.filter.filters
              for (let o = 0; o < itemN.length; o++) {
                const conditions = itemN[o]?.conditions ?? []
                for (let p = 0; p < conditions.length; p++) {
                  const itemP = conditions[p] as ConditionItem
                  // 提前判断 params 是否为空或长度不匹配
                  if (isConditionEmpty(itemP.function, itemP.params)) {
                    isEmpty = true
                    break
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
      } else if (isPass != null) {
        // 走到这里 isEmpty 为 false，由上面的条件可知 isPass 必不为 null，
        // 这里再判一次只是为了满足类型收窄（不改变 v2 行为）
        ElMessage.error(`分层${isPass + 1}:规则不合法`)
      }
    } else {
      allowSaving.value = true
    }
    //校验二: 检查字段是否为空
  } else {
    obj = buildModel()
    // 校验规则
    allowSaving.value = true
  }
  // 估算调用结果
  if (event == '估算') return isPass != null || isEmpty

  const model = obj
  void ruleFormRef.value?.validate((valid) => {
    if (valid) {
      if (!allowSaving.value) return
      if (!model) return
      //**** 处理组件模型 - 父子组件参数传递处理 -start    ****
      const params = copyObj(model)
      params.frequencyValue = (params.frequencyValue as number[]).join(',')
      if (createIndex.value == 1) {
        // 清空保存后校验标识
        model.ruleList?.map((item) => {
          delete item.rules.isValid
        })
        params.formula = JSON.stringify(model.ruleList)
        delete params.ruleList
      } else {
        params.formula = JSON.stringify(model.rules)
        delete params.rules
      }
      // ****    end      ****
      params.projectName = projectName.value
      let content: string, btnType: string
      // 保存时校验-是否需要估算   ***新增标签 false:未曾校验；empty:估算数据为空，提示无意义内容；编辑标签：edit模型改变需要重新进行估算操作；
      if (createIndex.value == 1) {
        if (!formula.value.id) {
          if (!params.isEstimate || params.isEstimate == 'edit') {
            content = isEstimateText.doneTitle
            btnType = isEstimateText.doneBtn
          } else if (params.isEstimate == 'empty') {
            content = isEstimateText.noDidTile
            btnType = isEstimateText.noDidBtn
          } else {
            content = '确定保存?'
            btnType = '保存'
          }
        } else {
          // 如果编辑条件下模型变化了-需重新进行估算
          if (params.isEstimate && params.isEstimate == 'edit') {
            content = isEstimateText.doneTitle
            btnType = isEstimateText.doneBtn
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
        customClass: 'my-confirm', // 添加自定义样式类
        closeOnClickModal: false, // 点击遮罩不关闭
      })
        .then(() => {
          /*
           * createIndex 来自路由 query，本文件里统一用 `String(route.query.createIndex ?? '')` 存成**字符串**，
           * 所以这里不能用 `=== 1` 和数字字面量比 —— `'1' === 1` 恒为 false，
           * 点「确定」后既不会去估算也不会保存（本文件其它判断用的都是 `==`，只有这里漏了）。
           *
           * v2 写的也是 `this.createIndex === 1`，但它没有强制 String()：
           * 应用内 router.push({ query: { createIndex: 数字 } }) 时 vue-router 会保留数字，
           * 于是 v2 走应用内跳转能命中、刷新页面后同样会失效 —— 属于 v2 的潜在缺陷。
           * 这里统一转成数字再比，两种入口都正确。
           *
           * 另：只处理 createIndex=1 是 v2 的既有设计（原注释「目前支持index=1自定义指标」），
           * 其余五种创建方式点确定后确实什么都不做，保持不变。
           */
          if (Number(createIndex.value) === 1) {
            const shouldEstimate =
              (!formula.value.id && !params.isEstimate) ||
              (formula.value.id && params.isEstimate === 'edit')
            if (shouldEstimate) {
              return estimateEvent(true)
            } else {
              isExecute(params)
            }
          }
          return undefined
        })
        .catch(() => undefined)
    } else {
      if (!model?.displayName || !model?.name || !model?.categoryId) {
        window.scrollTo({
          top: 0,
          behavior: 'smooth',
        })
      }
    }
  })
  return undefined
}

function cancleEvent() {
  ElMessageBox.confirm('离开将丢失已编辑的内容，是否离开？', '确认离开?', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    cancelButtonClass: 'custom-cancel-button',
    type: 'warning',
  })
    .then(() => {
      void router.push({
        name: 'userTag',
      })
    })
    .catch(() => undefined)
}

function returnTagsPagess(list: CategoryNode[]) {
  tagTree.value = list || []
}

function rulesDialogEvent() {
  rulesDialogRef.value?.openEvent('切换')
}

/** 标签标识校验：格式 + 唯一性 */
function validatePass(
  rule: unknown,
  value: string,
  callback: (error?: Error) => void,
) {
  function isValid(str: string) {
    return /^[a-zA-Z][a-zA-Z0-9_]*$/.test(str)
  }
  if (value === '') {
    callback(new Error('标签标识不能为空'))
  } else if (!isValid(value)) {
    callback(new Error('以字母开头, 可包含数字和下划线'))
  } else {
    // 标识校验唯一性
    if (formula.value.id) {
      callback()
    } else {
      check<boolean>({
        name: value,
        projectName: projectName.value,
      })
        .then((res) => {
          if (res?.data == false) {
            callback()
          } else {
            // 与 v2 一致：这里的文案写的是「分群标识重复」
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
  displayName: [{ required: true, message: '标签名称不能为空', trigger: 'blur' }],
  categoryId: [{ required: true, message: '标签分类不能为空', trigger: 'blur' }],
  name: [
    {
      required: true,
      validator: validatePass,
      trigger: 'blur',
    },
  ],
}

watch(
  () => route.fullPath,
  () => {
    if (!route.query.id) {
      createIndex.value = String(route.query.createIndex ?? '')
    }
    formula.value.id = route.query.id ? String(route.query.id) : undefined
  },
)

// 1.切换项目 / 项目和标签模型不匹配则跳到list page
watch(projectName, () => {
  void router.push({
    name: 'userTag',
  })
})

onMounted(() => {
  // 2.切换项目 / 项目和标签模型不匹配则跳到list page
  if (validateProjectName(route.query.projectName ? String(route.query.projectName) : undefined)) {
    return
  }
  const routeQuery = route.query
  fromPath.value = routeQuery.from ? String(routeQuery.from) : '' //来源页
  if (routeQuery.id) {
    // 编辑回显操作
    const token = detailLatest.next()
    void get<TagFormula>({ id: routeQuery.id, projectName: projectName.value }).then((res) => {
      if (!detailLatest.isLatest(token)) return
      if (res?.code == 200 && res.data) {
        formula.value = res.data
        layerListData.value = (JSON.parse(formula.value.formula ?? '[]') ||
          []) as TagRuleLayer[]
        abchorPoint.value =
          layerListData.value.length > 0 ? (layerListData.value[0]?.name ?? '') : ''
        void nextTick(() => {
          createIndex.value = String(routeQuery.createIndex ?? '')
        })
        // 编辑页基础信息回显操作
        initBaseInfo()
      }
    })
  } else {
    // 新增标签事件
    createIndex.value = routeQuery.createIndex ? String(routeQuery.createIndex) : 1
  }
  // 初始调用
  getPrototype()
  getCategoryApi()
})

onBeforeUnmount(() => {
  localStorage.removeItem('propertyList')
})
</script>

<template>
  <div
    style="position: relative; min-height: calc(100vh - 45px); overflow: auto; user-select: none"
  >
    <filterBar :by-tag-rules="true" @return-tags-pagess="returnTagsPagess"></filterBar>
    <div class="public-block" style="border-radius: 6px; box-sizing: border-box">
      <div
        class="block_online block-main public-hoverItem"
        style="min-height: 140px; margin-bottom: 20px; padding: 15px"
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
            <!-- v2 这里注释掉的三元判断保持注释状态 -->
            "该标签正在计算中，暂时无法修改标签规则"
          </div>
          <el-form
            ref="ruleFormRef"
            :model="ruleForm"
            :rules="rules"
            label-width="100px"
            class="demo-ruleForm"
          >
            <div style="display: flex; flex-wrap: wrap; margin-top: 0px">
              <div style="margin-right: 100px; margin-top: 10px">
                <el-form-item label="标签名称" prop="displayName">
                  <el-input
                    v-model="ruleForm.displayName"
                    style="width: 400px"
                    placeholder="请输入标签名称"
                    :disabled="isReadonly"
                  ></el-input>
                </el-form-item>
                <el-form-item label="标签分类" prop="categoryId">
                  <el-tree-select
                    v-model="ruleForm.categoryId"
                    style="font-size: 13px; width: 400px; color: #606266; font-weight: 400px"
                    :disabled="isReadonly"
                    placeholder="请选择"
                    :data="tagTree"
                    :props="categoryTreeProps"
                    :render-after-expand="false"
                    filterable
                  />
                </el-form-item>
                <el-form-item label="备注" prop="description" style="margin-bottom: 0">
                  <el-input
                    v-model="ruleForm.description"
                    :disabled="isReadonly"
                    type="textarea"
                    maxlength="1000"
                    show-word-limit
                    style="width: 400px"
                    placeholder="请输入备注"
                    :rows="3"
                  ></el-input>
                </el-form-item>
              </div>
              <div style="margin-top: 10px">
                <el-form-item label="标签标识" prop="name">
                  <el-input
                    v-model="ruleForm.name"
                    :disabled="filterDisabled"
                    style="width: 400px"
                    placeholder="请输入标签标识"
                  >
                    <template #prepend>user_tag_{{ projectName + '_' }}</template>
                  </el-input>
                </el-form-item>
                <el-form-item label="更新方式" prop="updateType">
                  <!-- :disabled="isReadonly" -->
                  <el-radio-group
                    v-model="ruleForm.updateType"
                    :disabled="filterDisabled"
                    size="small"
                    style="height: 30px"
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
                      :disabled="isReadonly"
                      style="width: 90px; height: 30px; margin: 0 15px"
                      @change="filterDateRange"
                    >
                      <el-option
                        v-for="item in updateTimeList"
                        :key="item.value"
                        :label="item.label"
                        :value="item.value"
                      >
                      </el-option>
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
                      >
                      </el-option>
                    </el-select>

                    <el-select
                      v-model="ruleForm.frequencyTime"
                      :disabled="isReadonly"
                      style="width: 90px; height: 30px; margin-right: 15px"
                    >
                      <el-option
                        v-for="item in hourOptions"
                        :key="item.value"
                        :label="item.label"
                        :value="item.value"
                      >
                      </el-option>
                    </el-select>
                    <span>开始计算</span>
                  </div>
                </el-form-item>
              </div>
            </div>
          </el-form>
        </div>
      </div>
      <!-- 标签规则 -->
      <div
        v-loading="ruleSavingLoad"
        style="min-height: 600px; margin-bottom: 105px; overflow: auto; padding: 15px"
        class="block_online block-main public-hoverItem"
        element-loading-text="加载中"
      >
        <div class="tags_rules">
          <div class="infoTitle" style="position: relative">
            <span class="public-firstHead">标签规则</span>
            <!-- 设置预估人数 -->
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
                v-model="estimateValue"
                :disabled="isReadonly"
                style="width: 150px; height: 30px; margin: 0 15px"
              >
                <el-option
                  v-for="item in estimateList"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                >
                </el-option>
              </el-select>
              <!--
                这里**不能**写成 estimateEvent()：v2 绑的是 `@click="estimateEvent"`（不带括号），
                回调拿到的是 MouseEvent（恒为真值），于是 noValid 为真 —— 点「估算」会先跑一遍
                submitSaveForm('估算') 做规则校验，不合法时直接提示并中断。
                写成 estimateEvent() 会让 noValid 变成 undefined，校验被整个跳过，
                带着空/非法规则直接打估算接口。群画像的同名按钮保留了 v2 写法，这里对齐。
              -->
              <el-button class="zc_btn" :disabled="isReadonly" @click="estimateEvent"
                >估算</el-button
              >
            </div>
            <!-- end -->
            <estimateDialog ref="estimateDialogRef"></estimateDialog>
          </div>
          <div style="display: flex; margin-top: 5px; padding: 0 5px; align-items: center">
            <div class="public-threeHead createTitle">创建方式:</div>
            <div v-if="!route.query.id" class="customTitle" @click="rulesDialogEvent">
              {{ createMetLabel }}
            </div>
            <div v-else class="customTitle" style="color: #acaeaf; cursor: auto">
              {{ createMetLabel }}
            </div>
          </div>
          <!-- 规则是否可编辑 -->
          <div style="position: relative; padding: 0 5px">
            <!-- 自定义标签值 -->
            <customTagPage
              v-if="createIndex == 1"
              ref="customTagPageRef"
              :formula="formula"
              :point-proto-list="pointProtoList"
              :point-type-list="pointTypeList"
              :property-list="propertyList"
              @re-estimate="reEstimate"
              @open-layer-scroll="openLayerScroll"
            ></customTagPage>
            <!-- 基础指标值 -->
            <basicpointer
              v-if="createIndex == 2"
              ref="basicpointerRef"
              :formula="formula"
              :point-proto-list="pointProtoList"
              :point-type-list="pointTypeList"
              :property-list="propertyList"
            ></basicpointer>
            <firstLastFeature
              v-if="createIndex == 3"
              ref="firstLastFeatureRef"
              :point-proto-list="pointProtoList"
              :property-list="propertyList"
              :point-type-list="pointTypeList"
              :formula="formula"
            ></firstLastFeature>
            <eventPreference
              v-if="createIndex == 4"
              ref="eventPreferenceRef"
              :formula="formula"
              :point-proto-list="pointProtoList"
              :property-list="propertyList"
              :point-type-list="pointTypeList"
            ></eventPreference>
            <behavioralDistribResult
              v-if="createIndex == 5"
              ref="behavioralDistribResultRef"
              :formula="formula"
              :point-proto-list="pointProtoList"
              :property-list="propertyList"
              :point-type-list="pointTypeList"
            >
            </behavioralDistribResult>
            <sqlRules v-show="createIndex == 6" ref="sqlRulesRef"></sqlRules>
            <!-- end -->

            <div
              v-if="ruleMaskVisible"
              style="
                position: absolute;
                width: 100%;
                height: calc(100% - 10px);
                top: 5px;
                z-index: 888;
                cursor: not-allowed;
                background: #f5f7fa;
                opacity: 0.3;
              "
            ></div>
          </div>
        </div>
      </div>
    </div>
    <!-- custom card layer  -->
    <el-card v-if="scollLayer.isOpenMore" class="box-card">
      <template #header>
        <div class="clearfix">
          <span>标签值</span>
          <el-icon class="el-icon-close" @click="scollLayer.isOpenMore = false">
            <Close />
          </el-icon>
        </div>
      </template>
      <div style="max-height: 300px; overflow-y: scroll; overflow-x: hidden">
        <div
          v-for="(item, index) in layerListData"
          :key="index"
          :style="item.name == abchorPoint ? 'color : #2c7be5;background: #ecf5ff;' : ''"
          class="text_item"
          @click="handleAbchorPoint(item, index, 'scroll')"
        >
          <div class="tab_custom" style="justify-content: flex-start">
            <div
              class="tab_icon scroll_icon"
              :style="item.name == abchorPoint ? 'color : #fff;background: #2c7be5!important;' : ''"
            >
              {{ index + 1 }}
            </div>
            {{ item.name }}
          </div>
        </div>
      </div>
    </el-card>
    <!-- 分层过多-tab切换 -->
    <div
      class="footer_con"
      style="
        background: #fff;
        width: calc(100% - 210px);
        position: fixed;
        bottom: 45px;
        left: -20;
        box-shadow: 0 1px 4px rgba(0, 21, 41, 0.15);
        z-index: 889;
      "
    >
      <div
        v-if="layerListData.length > 2"
        style="
          display: flex;
          align-items: center;
          justify-content: flex-end;
          background: rgb(218 232 248);
        "
      >
        <span style="color: #303133; font-size: 14px; font-weight: 600; margin-right: 20px"
          >标签值：</span
        >
        <!-- d8e2ef  fbfcfe-->
        <el-tabs
          v-model="abchorPoint"
          style="width: calc(50% - 80px)"
          @tab-click="handleAbchorPoint($event)"
        >
          <el-tab-pane
            v-for="(layer_item, layer_index) in layerListData"
            :key="layer_index"
            :name="layer_item.name"
            :label="layer_item.name"
          >
            <template #label>
              <div class="tab_custom">
                <div
                  class="tab_icon"
                  :style="
                    layer_item.name == abchorPoint
                      ? 'color : #fff;background: #2c7be5!important;'
                      : ''
                  "
                >
                  {{ layer_index + 1 }}
                </div>
                {{ layer_item.name }}
              </div>
            </template>
          </el-tab-pane>
        </el-tabs>
        <div
          v-if="layerListData.length > 5"
          style="
            font-size: 13px;
            display: flex;
            width: 80px;
            justify-content: center;
            color: #2c7be5;
            cursor: pointer;
            align-items: center;
            font-weight: 600;
            user-select: none;
          "
          @click="handleMore()"
        >
          更多<el-icon class="el-icon-arrow-right"><ArrowRight /></el-icon>
        </div>
      </div>
    </div>
    <div
      class="footer_con"
      style="background: #fff; width: 100%; position: fixed; bottom: 0; left: -20; z-index: 991"
    >
      <div
        style="display: flex; align-items: center; box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1)"
      >
        <div
          v-if="formula.creator || route.query.createType"
          style="display: flex; align-items: center; height: 45px; margin-left: 60px"
        >
          <el-button class="zc_btn" @click="submitSaveForm()">保存</el-button>
          <el-button class="zc_btn_default" style="margin-left: 40px" @click="cancleEvent"
            >取消</el-button
          >
        </div>
        <div
          v-if="!route.query.createType"
          style="display: flex; align-items: center; height: 45px; margin-left: 35px"
        >
          <el-button class="zc_btn" style="margin-left: 0px" @click="copyRules">复制标签</el-button>
        </div>
        <el-button
          v-if="isDebug"
          class="zc_btn_default"
          style="margin-left: 35px"
          @click="handleConsole"
          >打印模型</el-button
        >
      </div>
    </div>
    <!-- end -->
    <rulesDialog ref="rulesDialogRef"></rulesDialog>
  </div>
</template>

<style>
.el-message-box__message p {
  white-space: pre-wrap !important;
}

.el-message-box__content {
  font-size: 13px;
}
</style>

<style lang="scss" scoped>
.tab_custom {
  display: flex;
  justify-content: center;
  align-items: center;

  .tab_icon {
    width: 15px;
    height: 15px;
    // background: #2c7be5;
    background: #b8b9bb;
    line-height: 15px;
    text-align: center;
    border-radius: 50%;
    color: #fff;
    font-size: 11px;
    margin-right: 5px;
  }

  .scroll_icon {
    background: #b8b9bb !important;
  }
}

.box-card {
  position: fixed;
  bottom: 90px;
  right: 25px;
  z-index: 999;
  width: 300px;
  border: 1px solid #2c7be5;

  .clearfix {
    color: #303133;
    font-size: 14px;
    display: flex;
    justify-content: space-between;

    span {
      width: 350px;
      font-weight: 700;
    }

    .el-icon-close:hover {
      color: #2c7be5;
      cursor: pointer;
    }
  }

  .text_item {
    font-size: 13px;
    color: #303133;
    line-height: 30px;
    width: 100%;
    padding: 0 10px;
    cursor: pointer;
  }

  .text_item:hover {
    background: #ecf5ff;
  }

  :deep(.el-card__body) {
    padding: 0px;
  }

  :deep(.el-card__header) {
    padding: 10px;
  }
}

:deep(.el-form-item) {
  margin-bottom: 15px;
}

:deep(.el-tabs__header) {
  margin: 0;
}

:deep(.el-tabs__nav-wrap::after) {
  background-color: #fff;
}

:deep(.el-loading-spinner) {
  top: 30%;
}

// v2 这里是 vue-treeselect 的一套覆盖样式，v3 换成 el-tree-select 后按同样的数值重写
:deep(.el-select__wrapper) {
  min-height: 32px;
  line-height: 32px;
}

:deep(.el-select__placeholder) {
  font-size: 14px;
  font-weight: 400 !important;
  color: #4d4d4d;
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

:deep(.el-input__wrapper) {
  font-size: 13px;
  height: 30px;
  line-height: 30px;
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

  // 标签规则
  .tags_rules {
    overflow: auto;
    min-height: 400px;

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
