<script setup lang="ts">
/**
 * 自定义标签值（对应 v2 src/views/ups/userTag/components/customTagPage/index.vue）。
 *
 * 一个标签可以有多「层」（ruleList），每层一套 attribute / behavior / sequence 规则。
 *
 * 父子约定（v2 里是 $refs 直接读写，v3 必须显式 defineExpose）：
 *   tag-creator 读 `tagModelList`（整份模型）、`cascaderList`（日历联级）
 *   tag-creator 调 `getSectionEl(refName)` 做分层锚点滚动
 *     —— v2 是 `this.$refs.customTagPage.$refs[refName]` 再取 `[0]`；
 *        Vue3 里 v-for 上的字符串 ref 不再自动聚合成数组，改成函数 ref 收进一个 Record，
 *        对外只暴露一个按名字取 DOM 的方法，调用点的语义不变。
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { ArrowDown, ArrowUp, Close, Plus } from '@element-plus/icons-vue'
import { useRoute } from 'vue-router'
import tagRules from './tagRules.vue'
import { makeCascaderList } from '@/utils/modelOptions/up-manage'
import type { CascaderOption } from '@/utils/modelOptions/up-manage'
import type {
  CustomTagModel,
  PointTypeList,
  PropertyListMap,
  PropertyNode,
  TagFormula,
  TagRuleLayer,
} from '../../types'

const props = withDefaults(
  defineProps<{
    formula?: TagFormula
    // (事件 / 用户)  全局
    pointTypeList?: PointTypeList
    // 公共 (事件 / 用户) 局部
    propertyList?: Partial<PropertyListMap>
    pointProtoList?: PropertyNode[]
  }>(),
  {
    formula: () => ({}),
    pointTypeList: () => ({ userProtoList: [], eventProtoList: [] }),
    propertyList: () => ({
      commonPropertySum: [], // 共用事件属性
      userProperties: [], // 共用用户属性
    }),
    pointProtoList: () => [],
  },
)

const emit = defineEmits<{
  reEstimate: []
  openLayerScroll: [ruleList: TagRuleLayer[]]
}>()

const route = useRoute()

const abchorPoint = ref('')
const tagModelList = ref<CustomTagModel>({
  valueType: 'STRING', //模型类型
  ruleList: [
    {
      rules: {
        attribute: { filters: [] },
        behavior: {
          relation: 'and',
          measures: [],
        },
        sequence: {
          sequences: [],
          relation: 'and',
        },
      },
      relation: 'and',
      name: '',
    },
  ],
})

/** 日历（取一份新的，basicRules 会往里 push 自定义时间段） */
const cascaderList = ref<CascaderOption[]>(makeCascaderList())

/** 分层锚点：key 与 v2 的 :ref 表达式完全一致 */
const sectionRefs = ref<Record<string, HTMLElement>>({})

function layerRefName(item: TagRuleLayer, index: number) {
  return item.name ? item.name + index : `第${index + 1}层${index}`
}

function layerDomId(item: TagRuleLayer, index: number) {
  // 与 v2 一致（v2 此处逻辑存疑：id 少拼了一个 index，和 ref 的 key 对不上）
  return item.name ? item.name + index : `第${index + 1}层`
}

function setSectionRef(el: unknown, item: TagRuleLayer, index: number) {
  if (el) sectionRefs.value[layerRefName(item, index)] = el as HTMLElement
}

/** 供 tag-creator 做锚点滚动 */
function getSectionEl(refName: string): HTMLElement | null {
  return sectionRefs.value[refName] ?? null
}

/** 模板里多处用到，抽成 computed，避免重复调用 */
const canEditLayer = computed(
  () =>
    !(
      (!props.formula.creator ||
        props.formula.matchUserCount ||
        props.formula.matchUserCount == 0) &&
      !route.query.createType
    ),
)

// 失去焦点更新分层列表
function openLayerScroll() {
  emit('openLayerScroll', tagModelList.value.ruleList)
}

function isCollapseEvent(item: TagRuleLayer, flag: boolean) {
  item.isCollapse = flag
}

function deleteLayer(index: number) {
  tagModelList.value.ruleList.splice(index, 1)
  emit('openLayerScroll', tagModelList.value.ruleList)
}

function addLevelEvent() {
  const params: TagRuleLayer = {
    rules: {
      attribute: { filters: [] },
      behavior: {
        relation: 'and',
        measures: [],
      },
      sequence: {
        sequences: [],
        relation: 'and',
      },
    },
    relation: 'and',
    name: '',
  }
  tagModelList.value.ruleList.push(params)
  setTimeout(() => {
    window.scrollTo(0, document.body.scrollHeight)
    emit('openLayerScroll', tagModelList.value.ruleList)
  }, 0)
}

// 用于监听模型变化-实现重新预估操作
watch(
  tagModelList,
  (newVal) => {
    void nextTick(() => {
      if (JSON.stringify(newVal.ruleList) != props.formula.formula) {
        if (route.query.id) {
          emit('reEstimate')
        }
      }
    })
  },
  { deep: true },
)

onMounted(() => {
  // 规则模型数据回显
  void nextTick(() => {
    if (props.formula) {
      if (props.formula.createType == '自定义标签值' && props.formula.formula) {
        const modelRules = JSON.parse(props.formula.formula) as TagRuleLayer[]
        tagModelList.value.ruleList = modelRules
        abchorPoint.value = modelRules[0]?.name ?? ''
        // 日历自定义列表
        const rules = modelRules[0]?.rules
        if (!rules) return
        if (rules.behavior.measures.length > 0 && rules.behavior.measures[0]?.echoObj.cascaderList) {
          cascaderList.value = rules.behavior.measures[0].echoObj.cascaderList
        } else if (
          rules.sequence.sequences.length > 0 &&
          rules.sequence.sequences[0]?.echoObj.cascaderList
        ) {
          cascaderList.value = rules.sequence.sequences[0].echoObj.cascaderList
        }
      }
    }
  })
})

defineExpose({ tagModelList, cascaderList, getSectionEl })
</script>

<template>
  <div>
    <div style="overflow-y: auto; z-index: 9999">
      <div
        v-for="(item, index) in tagModelList.ruleList"
        :id="layerDomId(item, index)"
        :key="index"
        :ref="(el: unknown) => setSectionRef(el, item, index)"
        class="modelOptions"
      >
        <div class="rules_zc_th">
          <div style="display: flex">
            <div class="eg_letters number_letters">{{ index + 1 }}</div>
            <div class="rules_zc_lable">第{{ index + 1 }}层</div>
            <el-input
              v-model="item.name"
              style="width: 400px"
              placeholder="请输入分层名称"
              @blur="openLayerScroll"
            ></el-input>
          </div>
          <!-- 删除按钮 -->
          <div style="display: flex">
            <el-icon
              v-if="tagModelList.ruleList.length > 1"
              class="custom_icon el-icon-close"
              @click="deleteLayer(index)"
            >
              <Close />
            </el-icon>
            <!-- 点击展开 -->
            <el-icon
              v-show="item.isCollapse"
              class="custom_icon el-icon-arrow-down"
              style="margin-left: 15px"
              @click="isCollapseEvent(item, false)"
            >
              <ArrowDown />
            </el-icon>
          </div>
        </div>
        <!-- 主内容 -->
        <div v-show="!item.isCollapse" style="display: flex; padding-top: 10px">
          <div class="public-threeHead createTitle">创建规则:</div>
          <tagRules
            :model-object="item"
            :cascader-list="cascaderList"
            :point-proto-list="pointProtoList"
            :point-type-list="pointTypeList"
            :property-list="propertyList"
          ></tagRules>
        </div>
        <!-- 点击折叠 -->
        <el-icon
          v-show="!item.isCollapse"
          class="custom_icon el-icon-arrow-up"
          style="width: 30px; float: right"
          @click="isCollapseEvent(item, true)"
        >
          <ArrowUp />
        </el-icon>
      </div>
      <div
        v-if="tagModelList.ruleList.length > 2"
        style="position: fixed; bottom: 74px; left: 240px; height: 30px; z-index: 990"
      >
        <div
          v-if="!canEditLayer"
          class="addLamination"
          style="cursor: not-allowed; font-size: 16px"
        >
          <el-icon class="el-icon-plus"><Plus /></el-icon>
          新建分层
        </div>
        <div v-else class="addLamination" @click="addLevelEvent">
          <el-icon class="el-icon-plus"><Plus /></el-icon>
          新建分层
        </div>
      </div>
      <div v-else>
        <div
          v-if="!canEditLayer"
          class="addLamination"
          style="cursor: not-allowed; font-size: 16px"
        >
          <el-icon class="el-icon-plus"><Plus /></el-icon>
          新建分层
        </div>
        <div v-else class="addLamination" @click="addLevelEvent">
          <el-icon class="el-icon-plus"><Plus /></el-icon>
          新建分层
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.el-form-item) {
  margin-bottom: 20px;
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

.modelOptions {
  margin-top: 5px;
  padding: 15px;
  border-radius: 6px;
  box-sizing: border-box;
  overflow-y: auto;
  border: 1px solid #ede9e9;

  .custom_icon {
    font-size: 25px;
    font-weight: 500;
    cursor: pointer;
    display: flex;
    justify-content: flex-end;
  }

  .rules_zc_th {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 10px 0;
    margin-bottom: 10px;
    line-height: 30px;

    .rules_zc_lable {
      color: #2c7be5;
      font-size: 15px;
      font-weight: 600;
      padding: 0 50px 0 15px;
    }

    .number_letters {
      width: 25px;
      height: 25px;
      border-radius: 50%;
      background-color: #2c7be5;
      color: #fff !important;
      display: flex;
      justify-content: center;
      align-items: center;
      line-height: 30px;
      font-size: 15px;
      font-weight: 400;
    }

    .eg_letters {
      color: rgb(101, 100, 100);
      margin-top: 2px;
      width: 25px;
      height: 25px;
      font-size: 14px;
      display: flex;
      justify-content: center;
      align-items: center;
      font-weight: 400;
    }
  }
}

// 新建分层
.addLamination {
  cursor: pointer;
  display: flex;
  font-size: 16px;
  font-weight: 600;
  color: rgb(48, 49, 51);
  width: 100px;
  margin: 30px 0 0 0;
  padding-bottom: 20px;

  .el-icon-plus {
    font-weight: 600;
    margin-right: 10px;
  }
}
</style>
