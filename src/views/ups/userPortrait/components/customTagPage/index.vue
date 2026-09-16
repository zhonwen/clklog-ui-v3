<script setup lang="ts">
/**
 * 画像人群规则编辑器（对应 v2 `views/ups/userPortrait/components/customTagPage/index.vue`）。
 *
 * 注意：`customTagPage/` 在 v2 里 userPortrait / userTag / usergroup 各有一份独立副本，
 * 这一份严格以 userPortrait 的为准，不与另外两份合并。
 *
 * v2 未搬运的遗留成员：`formula`（只在 updateModelTransfer 里当临时变量用，已改成局部变量）、
 * `getLetterByIndex`（模板无引用）。
 */
import { nextTick, ref } from 'vue'
import { ArrowDown, Close, Plus } from '@element-plus/icons-vue'
import tagRules from './tagRules.vue'
import { computedStyle as computedStyleRaw } from '../../types'
import type { CascaderNode, EventGroup, PortraitRuleItem, PropertyListMap } from '../../types'

withDefaults(
  defineProps<{
    /** 用户画像来源 */
    byPortrait?: boolean
    propertyList?: Partial<PropertyListMap>
    pointProtoList?: EventGroup[]
  }>(),
  {
    byPortrait: false,
    propertyList: () => ({
      commonPropertySum: [], // 共用事件属性
      userProperties: [], // 共用用户属性
      userGroupList: [], // 用户分群
      userTagList: [], // 用户标签
    }),
    pointProtoList: () => [],
  },
)

function createDefaultRule(): PortraitRuleItem {
  return {
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
}

const tagModelList = ref<{ ruleList: PortraitRuleItem[] }>({
  ruleList: [createDefaultRule()],
})

// 日历
const cascaderList = ref<CascaderNode[]>([
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
      { value: '0day', label: '当天' },
      { value: '-1day', label: '前1天' },
      { value: '-3day', label: '前3天' },
      { value: '-7day', label: '前7天' },
      { value: '-14day', label: '前14天' },
      { value: '-30day', label: '前30天' },
      { value: 'custom', label: '自定义' },
    ],
  },
])

/** 校验样式。v2 固定拿第 0 层的 rules 当校验开关，这里照搬 */
function computedStyle(value: unknown) {
  return computedStyleRaw(value, tagModelList.value.ruleList[0]?.rules)
}

/**
 * 更新详情 / 添加对比人群时回填模型。
 * res 为空值时恢复默认值。
 */
function updateModelTransfer(res: { formula?: string } | '' | null | undefined, index?: number) {
  nextTick(() => {
    const formula = res
    const first = tagModelList.value.ruleList[0]
    if (formula && first) {
      const modelRules = JSON.parse(formula.formula || '[]') as PortraitRuleItem[]
      const target = modelRules[Number(index ?? 0)]
      if (!target) return
      first.rules = target.rules
      first.name = target.name
      // 日历自定义列表
      const rules = first.rules
      if (rules.behavior.measures.length > 0 && rules.behavior.measures[0]?.echoObj.cascaderList) {
        cascaderList.value = rules.behavior.measures[0].echoObj.cascaderList
      } else if (
        rules.sequence.sequences.length > 0 &&
        rules.sequence.sequences[0]?.echoObj.cascaderList
      ) {
        cascaderList.value = rules.sequence.sequences[0].echoObj.cascaderList
      }
    } else {
      tagModelList.value = { ruleList: [createDefaultRule()] }
    }
  })
}

function isCollapseEvent(item: PortraitRuleItem, flag: boolean) {
  item.isCollapse = flag
}

function addLevelEvent() {
  // 与 v2 一致（v2 此处逻辑存疑：新建分层时 attribute 建的是 `{ measures: [] }`，
  // 而默认值和 attributeRules 读的都是 `attribute.filters`，导致新分层的属性规则区会报错/无法添加）
  const params = {
    rules: {
      attribute: { measures: [] },
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
  } as unknown as PortraitRuleItem
  tagModelList.value.ruleList.push(params)
}

defineExpose({ tagModelList, cascaderList, updateModelTransfer })
</script>

<template>
  <div>
    <div style="max-height: 1200px; overflow-y: auto">
      <div
        v-for="(item, index) in tagModelList.ruleList"
        :key="index"
        class="modelOptions"
        :style="byPortrait ? '' : 'border: 1px solid #ede9e9;'"
      >
        <div class="rules_zc_th">
          <div style="display: flex">
            <div v-if="!byPortrait" class="eg_letters number_letters">
              {{ index + 1 }}
            </div>
            <div v-if="!byPortrait" class="rules_zc_lable">第{{ index + 1 }}层</div>
            <div v-else class="public-secondHead" style="width: 130px">画像人群名称</div>
            <el-input
              v-model="item.name"
              style="width: 400px"
              :style="computedStyle(item.name)"
              placeholder="请输入画像人群名称"
            />
          </div>
          <!-- 删除按钮 -->
          <div style="display: flex">
            <el-icon
              v-if="tagModelList.ruleList.length > 1"
              class="custom_icon el-icon-close"
              @click="tagModelList.ruleList.splice(index, 1)"
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
        <!-- 用户画像模块设置规则弹框滚动 -->
        <div
          :style="byPortrait ? 'min-height: 600px; max-height: 650px; overflow: auto' : ''"
        >
          <!-- 主内容 -->
          <div v-show="!item.isCollapse" style="display: flex; padding-top: 20px">
            <div v-if="!byPortrait" class="public-threeHead createTitle">创建规则:</div>
            <div v-else style="width: 130px" class="public-secondHead">规则:</div>
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
            class="custom_icon el-icon-arrow-up"
            @click="isCollapseEvent(item, true)"
          ><ArrowUp /></el-icon> -->
        </div>
      </div>
    </div>
    <div v-if="!byPortrait" class="addLamination" @click="addLevelEvent">
      <el-icon class="el-icon-plus"><Plus /></el-icon>
      新建分层
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
  // margin: 15px 0;
  padding: 0 35px;
  border-radius: 6px;
  box-sizing: border-box;

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

  .el-icon-plus {
    font-weight: 600;
    margin-right: 10px;
  }
}
</style>
