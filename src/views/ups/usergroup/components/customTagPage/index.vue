<script setup lang="ts">
/**
 * 自定义分群值（对应 v2 views/ups/usergroup/components/customTagPage/index.vue）。
 *
 * 维护整个 tagModelList（分层列表），并在编辑模式下把 formula 里的 JSON 还原成模型。
 * v2 的「新建分层」入口是注释掉的，所以 ruleList 恒定只有一层。
 */
import { nextTick, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowDown, Close } from '@element-plus/icons-vue'
import tagRules from './tagRules.vue'
import { createCascaderList } from '../../constants'
import type {
  CascaderNode,
  GroupRow,
  PropertyListMap,
  PropertyNode,
  RuleListItem,
  TagModelList,
} from '../../types'

const props = withDefaults(
  defineProps<{
    formula?: GroupRow
    // 公共 (事件 / 用户) 局部
    propertyList?: Partial<PropertyListMap>
    pointProtoList?: PropertyNode[]
  }>(),
  {
    formula: () => ({}),
    propertyList: () => ({
      commonPropertySum: [], // 共用事件属性
      userProperties: [], // 共用用户属性
    }),
    pointProtoList: () => [],
  },
)

const emit = defineEmits<{ reEstimate: [] }>()

const route = useRoute()

const tagModelList = ref<TagModelList>({
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
      name: true,
    },
  ],
})

//日历
const cascaderList = ref<CascaderNode[]>(createCascaderList())

function isCollapseEvent(item: RuleListItem, flag: boolean) {
  item.isCollapse = flag
}

/** v2 的「新建分层」按钮被注释掉了，方法保留 */
function addLevelEvent() {
  tagModelList.value.ruleList.push({
    rules: {
      // 与 v2 一致（v2 此处逻辑存疑：新增分层时 attribute 写的是 { measures: [] }，
      // 和初始值的 { filters: [] } 对不上，attributeRules 会读不到 filters）
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
  })
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
      if (
        props.formula.createType == '规则创建' ||
        props.formula.createType == '自定义规则'
      ) {
        const modelRules = JSON.parse(props.formula.formula || '[]') as RuleListItem[]
        tagModelList.value.ruleList = modelRules
        // 日历自定义列表
        const rules = modelRules[0]?.rules
        if (!rules) return
        if (rules.behavior.measures.length > 0 && rules.behavior.measures[0]?.echoObj.cascaderList) {
          cascaderList.value = rules.behavior.measures[0]?.echoObj.cascaderList ?? cascaderList.value
        } else if (
          rules.sequence.sequences.length > 0 &&
          // 与 v2 一致（v2 此处逻辑存疑：这里写的是 rules.sequence.measures[0]，
          // sequence 下根本没有 measures 字段，命中这条分支会直接抛 TypeError；
          // 按显然的意图改成 sequences[0]，行为差异见迁移报告）
          rules.sequence.sequences[0]?.echoObj.cascaderList
        ) {
          cascaderList.value =
            rules.sequence.sequences[0]?.echoObj.cascaderList ?? cascaderList.value
        }
      }
    }
  })
})

defineExpose({ tagModelList, cascaderList, isCollapseEvent, addLevelEvent })
</script>

<template>
  <div>
    <!-- max-height: calc(100vh - 670px); -->
    <div style="overflow: auto">
      <div v-for="(item, index) in tagModelList.ruleList" :key="index" class="modelOptions">
        <div class="rules_zc_th">
          <!-- <div style="display: flex">
            <div class="eg_letters number_letters">{{ index + 1 }}</div>
            <div class="rules_zc_lable">第{{ index + 1 }}层</div>
            <el-input
              v-model="item.name"
              style="width: 400px"
              placeholder="请输入分层名称"
            ></el-input>
          </div> -->
          <!-- 删除按钮 -->
          <div style="display: flex">
            <el-icon
              v-if="tagModelList.ruleList.length > 1"
              class="custom_icon"
              @click="tagModelList.ruleList.splice(index, 1)"
            >
              <Close />
            </el-icon>
            <!-- 点击展开 -->
            <el-icon
              v-show="item.isCollapse"
              class="custom_icon"
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
            :property-list="propertyList"
          />
        </div>
        <!-- 点击折叠 -->
        <!-- <el-icon
          v-show="!item.isCollapse"
          class="custom_icon"
          @click="isCollapseEvent(item, true)"
        ><ArrowUp /></el-icon> -->
      </div>
    </div>
    <!-- <div class="addLamination" @click="addLevelEvent">
      <el-icon><Plus /></el-icon>
      新建分层
    </div> -->
  </div>
</template>

<style lang="scss" scoped>
:deep() {
  .el-form-item {
    margin-bottom: 20px;
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
  margin: 15px 0;
  border-radius: 6px;
  box-sizing: border-box;
  overflow-y: auto;

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
  color: #2c7be5;
  width: 100px;
  margin: 30px 0;
}
</style>
