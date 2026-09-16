/**
 * 用户标签（ups / userTag）模块用到的选项常量。
 *
 * 来源：
 *   - v2 `src/utils/modelOptions/up-manage.js`（tagLabelIndex）
 *   - v2 `src/utils/modelOptions/custom.js` 里「***** 用户标签模块下新增类型 *****」以下那一段
 *     （v3 的 `src/utils/modelOptions/custom.ts` 只迁了自定义分析用到的部分，
 *      这些用户标签专属常量没有迁，custom.ts 又是只读文件，所以落在这里）
 *   - v2 `src/utils/options.js` 的 dataTypeList
 *
 * 取值与 v2 逐条一致，注释掉的选项同样保留注释（后端/产品随时会再打开）。
 */

/** 选项项：{ displayName, name } —— 与 custom.ts 的 OptionDef 同形 */
export interface OptionDef {
  displayName: string
  name: string
}

/** 带 dataType 的选项项（首末特征 / 事件偏好用） */
export interface TypedOptionDef extends OptionDef {
  dataType: string
}

/** 值-标签型选项（下拉框用） */
export interface ValueLabel<T = string> {
  value: T
  label: string
}

/** 日历联级选项 */
export interface CascaderOption {
  value: string
  label: string
  /** 自定义相对时间段标记（v2 datePickerOptions 里打的） */
  custom?: boolean
  children?: CascaderOption[]
}

/** 「创建方式」文案 → createIndex，与 v2 up-manage.js 完全一致 */
export function tagLabelIndex(label?: string | null): number {
  switch (label) {
    case '自定义标签值':
      return 1
    case '基础指标值':
      return 2
    case '首次末次特征':
      return 3
    case '事件偏好属性':
      return 4
    case '行为分布结果':
      return 5
    case 'SQL 计算结果':
      return 6

    default:
      return 1
  }
}

/** 数据类型筛选项（v2 utils/options.js dataTypeList） */
export const dataTypeList: ValueLabel[] = [
  { value: '', label: '全部' },
  { value: 'STRING', label: '文本' },
  { value: 'NUMBER', label: '数值' },
  { value: 'DATETIME', label: '时间' },
  { value: 'BOOL', label: '是非' },
  { value: 'LIST', label: 'LIST' },
]

/** 最新版本计算时间（整点列表）。isAll 时最前面补一个「全部」 */
export const latestVersionCountTime = (isAll?: boolean): ValueLabel[] => {
  const hourOptions: ValueLabel[] = []
  for (let i = 0; i < 24; i++) {
    const hour = String(i).padStart(2, '0') // 确保两位数
    const params = {
      value: `${hour}:00`,
      label: `${hour}:00`,
    }
    hourOptions.push(params)
  }
  if (isAll) {
    hourOptions.unshift({
      value: '',
      label: `全部`,
    })
  }
  return hourOptions
}

/** 全量估算选择项 */
export const estimateList: ValueLabel[] = [
  {
    value: 'all',
    label: '按全量估算',
  },
  // {
  //   value: "1/2",
  //   label: "按1/2抽样计算",
  // },
  // {
  //   value: "1/8",
  //   label: "按1/8抽样计算",
  // },
  // {
  //   value: "1/16",
  //   label: "按1/16抽样计算",
  // },
  // {
  //   value: "1/32",
  //   label: "按1/32抽样计算",
  // },
  // {
  //   value: "1/64",
  //   label: "按1/64抽样计算",
  // },
]

/** 首次末次特征的默认标签值类型 */
export const firstLastDefaultType: TypedOptionDef[] = [
  {
    displayName: '具体时间点',
    name: '具体时间点',
    dataType: 'DATETIME',
  },
  {
    displayName: '距离当前日期天数',
    name: '距离当前日期天数',
    dataType: 'NUMBER',
  },
]

/** 事件偏好属性的排序方式 */
export const eventPreferenceList: TypedOptionDef[] = [
  {
    displayName: '出现次数最多',
    name: 'general',
    dataType: 'LIST',
  },
  {
    displayName: '数值最大',
    name: 'rank_desc',
    dataType: 'LIST',
  },
]

/** 基础指标 / 行为分布的聚合方式 */
export const defaultUserType: OptionDef[] = [
  {
    displayName: '总次数',
    name: 'general',
  },
  {
    displayName: '分布天数',
    name: 'distribution',
  },
]

/** 用户行为的判断区间 */
export const intervalList: OptionDef[] = [
  // { displayName: ">", name: ">" },
  // { displayName: "<", name: "<" },
  // { displayName: "=", name: "=" },
  // { displayName: "≥", name: ">=" },
  // { displayName: "≤", name: "<=" },
  // { displayName: "≠", name: "!=" },
  { displayName: '等于', name: 'equal' },
  { displayName: '不等于', name: 'notEqual' },
  { displayName: '大于', name: 'greater' },
  { displayName: '小于', name: 'less' },
  { displayName: '区间', name: 'between' },
]

/**
 * 日历联级默认项。
 * 注意：v2 各处都是把这份常量直接挂到 data 上再就地 push 自定义项（datePickerOptions /
 * checkDateEvent），也就是说**会被改**。v3 里同样如此，所以取用方必须 copyObj 一份，
 * 不要直接引用这个数组 —— 用 makeCascaderList() 拿一份新的。
 */
export const cascaderList: CascaderOption[] = [
  {
    value: 'absolute_time',
    label: '绝对时间',
    children: [
      {
        value: 'time_scope',
        label: '选择范围',
      },
    ],
  },
  {
    value: 'relative_time',
    label: '相对时间',
    children: [
      {
        value: '0day',
        label: '当天',
      },
      {
        value: '-1day',
        label: '前1天',
      },
      {
        value: '-3day',
        label: '前3天',
      },
      {
        value: '-7day',
        label: '前7天',
      },
      {
        value: '-14day',
        label: '前14天',
      },
      {
        value: '-30day',
        label: '前30天',
      },
      {
        value: 'custom',
        label: '自定义',
      },
    ],
  },
]

/** 取一份全新的日历联级选项（避免多个组件共享同一个可变数组） */
export function makeCascaderList(): CascaderOption[] {
  return JSON.parse(JSON.stringify(cascaderList)) as CascaderOption[]
}

/** 与 v2 一致：v2 此处已被整体注释掉，保留空数组 */
export const isDoneList: OptionDef[] = [
  // { displayName: "做过", name: true },
  // { displayName: "未做过", name: false },
]

/** 标签值区间划分方式 */
export const divideList: OptionDef[] = [
  {
    displayName: '百分比区间划分',
    name: '百分比区间划分',
  },
  {
    displayName: '数值区间划分',
    name: '数值区间划分',
  },
  // {
  //   displayName: "离散数值划分",
  //   name: "离散数值划分",
  // },
]

/** 首次 / 末次 */
export const firstOrLastList: OptionDef[] = [
  {
    displayName: '首次发生',
    name: '首次发生',
  },
  {
    displayName: '末次发生',
    name: '末次发生',
  },
]

/** 行为分布结果：天数 / 小时数（name 是布尔值，与 v2 一致） */
export interface BoolOptionDef {
  displayName: string
  name: boolean
}
export const distributList: BoolOptionDef[] = [
  {
    displayName: '天数',
    name: true,
  },
  {
    displayName: '小时数',
    name: false,
  },
]

/** 用户分群-值类型 */
export const groupValueType: OptionDef[] = [
  {
    displayName: '存在',
    name: 'isSet',
  },
  // {
  //   displayName: "不存在",
  //   name: "notSet",
  // },
]

/** 更新周期 */
export const updateTimeList: ValueLabel[] = [
  {
    value: '天',
    label: '天',
  },
  {
    value: '周',
    label: '周',
  },
  {
    value: '月',
    label: '月',
  },
]
