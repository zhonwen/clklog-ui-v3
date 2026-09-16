<template>
  <div>
    <el-dialog
      v-model="prototypeVisible"
      :modal-append-to-body="false"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      width="1200px"
      center
      class="add_prototype"
      :title="title"
    >
      <div style="background: #fff; padding: 20px 30px; min-height: 500px; border-radius: 4px">
        <el-form
          ref="ruleFormRef"
          :model="ruleForm"
          :rules="rules"
          label-width="100px"
          class="demo-ruleForm"
        >
          <el-form-item label="漏斗名称" prop="name">
            <el-input
              v-model="ruleForm.name"
              :disabled="title != '新增漏斗'"
              style="font-size: 12px; width: 400px"
              placeholder="请输入漏斗名称"
            />
          </el-form-item>
          <div style="display: flex; justify-content: space-between; margin: 20px 0px">
            <div style="width: 100px; text-align: left; font-size: 15px">漏斗步骤</div>
            <div style="display: flex; align-items: center">
              设置关联属性
              <div class="parentPosition">
                <el-popover placement="bottom-start" :width="200" trigger="hover" class="popImg">
                  <div v-html="sharedText.relationProtoType" style="padding: 5px; font-size: 12px"></div>
                  <template #reference>
                    <img class="icon-question riseImg" src="@/assets/images/question.png" alt="" />
                  </template>
                </el-popover>
              </div>
              <div style="margin-left: 30px">
                <el-switch v-model="modelObject.isOpenRelation" />
              </div>
            </div>
          </div>

          <div style="min-height: 200px; max-height: 600px; overflow: auto">
            <stepPointCard
              ref="stepPointCardRef"
              :model-object="modelObject"
              :point-proto-list="pointProtoList"
              :point-type-list="pointTypeList"
              head-type="number"
            />
          </div>

          <el-form-item>
            <div style="display: flex; margin-left: -70px; margin-top: 40px">
              <el-button class="zc_btn" @click="saveForm">保存</el-button>
            </div>
          </el-form-item>
        </el-form>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { nextTick, reactive, ref } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { addsApi, editApi } from '@/api/sysmanage/funnelAnalysis'
import stepPointCard from '@/components/analysis-model/funnelStep.vue'
import { copyObj } from '@/utils/copy'
import { sharedText } from '@/components/pointFont'
import { useLatestOnly } from '@/composables/useLatestOnly'
import type { EventGroup, PointTypeList } from '@/components/analysis-model/types'
import type {
  FunnelDefinition,
  FunnelEditParams,
  FunnelListItem,
  FunnelModelObject,
} from '../types'

/**
 * 新增 / 编辑漏斗的弹窗。
 * 与 v2 的 src/views/funnel-analysis/components/dialog.vue 一一对应。
 */
const props = withDefaults(
  defineProps<{
    pointProtoList?: EventGroup[]
    pointTypeList?: PointTypeList
    funnelListName?: FunnelListItem[]
  }>(),
  {
    pointProtoList: () => [],
    pointTypeList: () => ({ userProtoList: [], eventProtoList: [] }),
    funnelListName: () => [],
  },
)

const emit = defineEmits<{
  (e: 'updateFunnelList', type: string, rules?: FunnelEditParams): void
  (e: 'stepModel', model: FunnelDefinition): void
}>()

const { next, isLatest } = useLatestOnly()

const ruleFormRef = ref<FormInstance>()
/** v2 里挂了 ref="stepPointCard" 但没有调用过它的任何方法，这里保留同名 ref */
const stepPointCardRef = ref<InstanceType<typeof stepPointCard> | null>(null)

const rowList = ref<FunnelListItem | null>(null)
const ruleForm = reactive<{ name: string }>({
  name: '',
})
const rules: FormRules<{ name: string }> = {
  name: [{ required: true, message: '漏斗名称不能为空', trigger: 'blur' }],
}
const title = ref('新增漏斗')
const prototypeVisible = ref(false)
const modelObject = ref<FunnelDefinition>(makeEmptyDefinition())
/** 父组件传递来的参数 */
const modelParams = ref<(FunnelModelObject & FunnelListItem) | null>(null)

function makeEmptyDefinition(): FunnelDefinition {
  return {
    name: '',
    isOpenRelation: false, // 开启关联性
    steps: [
      {
        customName: '',
        eventName: '',
        type: 'normal',
        filter: { relation: 'and', filters: [] },
        relevanceField: '',
        relevanceFieldType: '',
      },
    ],
  }
}

function clearFromEvent() {
  void nextTick(() => {
    ruleFormRef.value?.resetFields()
  })
  modelObject.value = makeEmptyDefinition()
}

/**
 * 打开弹窗。
 * v2 的签名是 openDialog(val, obj, model)，其中 obj 两个调用点传的都是 ""，函数体里从未使用，
 * 这里去掉了这个形参，其余行为完全一致。
 */
function openDialog(val: string, model: FunnelModelObject | FunnelListItem) {
  prototypeVisible.value = true
  clearFromEvent()
  title.value = val
  modelParams.value = copyObj(model) as FunnelModelObject & FunnelListItem

  if (val == '编辑漏斗') {
    const row = model as FunnelListItem
    rowList.value = row
    const modelObj = JSON.parse(row.queryParams) as FunnelDefinition
    // 组件模型
    modelObject.value.name = row.name
    modelObject.value.steps = modelObj.steps
    modelObject.value.isOpenRelation = modelObj.isOpenRelation
    void nextTick(() => {
      ruleForm.name = row.name
    })
    return
  } else {
    ruleForm.name = ''
  }
  // 初始 steps 默认值
  void nextTick(() => {
    props.pointProtoList.forEach((item, index) => {
      item.displayName = item.groupName ?? ''
      item.name = item.groupName ?? ''
      item.events.forEach((sub, sub_index) => {
        if (sub_index == 0 && index == 0) {
          const first = modelObject.value.steps[0]
          if (first) first.eventName = sub.name
        }
      })
    })
    const firstStep = modelObject.value.steps[0]
    if (firstStep) {
      firstStep.customName = props.pointProtoList[0]?.events[0]?.displayName ?? ''
    }
  })
}

async function saveForm() {
  // 新增：校验名称重复
  const isDuplicate = props.funnelListName.some((item) => item.name === ruleForm.name)
  if (isDuplicate && title.value == '新增漏斗') {
    ElMessage({
      message: '漏斗名称已存在',
      type: 'error',
    })
    return
  }
  modelObject.value.name = ruleForm.name
  const valid = await ruleFormRef.value?.validate().catch(() => false)
  if (!valid) return

  if (title.value == '新增漏斗') {
    // 关联属性校验功能；
    const flag = relationProtoTypeSave()
    if (!flag) {
      return
    }
    const params = {
      funnelId: '',
      projectName: modelParams.value?.projectName,
      name: ruleForm.name,
      funnelWindow: '',
      queryParams: JSON.stringify(modelObject.value),
      remark: '',
      creator: '',
      createTime: '',
      updateTime: '',
    }

    const token = next()
    const res = await addsApi(params).catch(() => null)
    if (!isLatest(token)) return
    if (res && res.code == 200) {
      emit('stepModel', modelObject.value)
      prototypeVisible.value = false
      emit('updateFunnelList', '新增')
      ElMessage({
        message: '保存成功',
        type: 'success',
      })
    }
  } else {
    await editForm()
  }
}

function relationProtoTypeSave() {
  // 关联属性逻辑编写
  if (modelObject.value.isOpenRelation) {
    // 开启关联  大于2个 并且是同属性
    const count = modelObject.value.steps.reduce((acc, obj) => {
      if (obj.relevanceField !== '') {
        return acc + 1
      } else {
        return acc
      }
    }, 0)
    if (count < 2) {
      ElMessage({
        message: '请至少关联两个属性',
        type: 'error',
      })
      return false
    }
    const filteredFields = modelObject.value.steps
      .filter((obj) => obj.relevanceFieldType !== '')
      .map((obj) => obj.relevanceFieldType)
    const isAllEqual =
      filteredFields.length > 0 && filteredFields.every((value, index, arr) => value === arr[0])
    if (!isAllEqual) {
      ElMessage({
        message: '关联属性类型必须一致',
        type: 'error',
      })
      return false
    } else {
      return true
    }
  } else {
    // 关闭关联属性  清空 relevanceField
    modelObject.value.steps.forEach((item) => {
      item.relevanceField = ''
      item.relevanceFieldType = ''
    })
    return true
  }
}

async function editForm() {
  const flag = relationProtoTypeSave()
  if (!flag) {
    return
  }
  if (!rowList.value?.owner) {
    ElMessage({
      message: '没有权限修改该漏斗',
      type: 'error',
    })
    return
  }
  const params: FunnelEditParams = {
    projectName: modelParams.value?.projectName,
    funnelId: modelParams.value?.funnelId,
    name: ruleForm.name,
    remark: modelParams.value?.remark || '',
    queryParams: JSON.stringify(modelObject.value),
    funnelWindow: modelParams.value?.funnelWindow || '',
  }
  const token = next()
  const res = await editApi(params as unknown as Record<string, unknown>).catch(() => null)
  if (!isLatest(token)) return
  if (res && res.code == 200) {
    prototypeVisible.value = false
    emit('updateFunnelList', '编辑', params)
    ElMessage({
      message: '编辑成功',
      type: 'success',
    })
  }
}

defineExpose({ openDialog })
</script>

<style lang="scss" scoped>
:deep(.el-dialog) {
  border-radius: 6px;
}

:deep(.el-dialog__headerbtn .el-dialog__close) {
  font-size: 21px;
}

:deep(.el-dialog__title) {
  margin-left: 16px;
  font-size: 15px;
  color: #4d4d4d;
  font-weight: bold;
}

:deep(.el-dialog__body) {
  padding: 20px;
  background-color: #eef4fd;
  border-radius: 6px;
}

:deep(.el-form-item__label) {
  font-size: 13px;
  font-weight: 500;
  text-align: left;
  color: #4d4d4d;
}

.parentPosition {
  position: relative;

  .popImg {
    position: absolute;
    left: 0;
    transform: translate(0, -50%); //左右上下
  }
}

.riseImg {
  cursor: pointer;
  width: 12px;
  height: 12px;
  margin-left: 7px;
  margin-top: 3px;
}

.add_prototype {
  min-height: 500px;

  .custom_button {
    height: 30px;
    color: #fff;
    font-size: 13px;
    background-color: #2c7be5;
  }

  .gp-item-title {
    font-size: 15px;
    font-weight: 500;
    color: #4d4d4d;
  }
}
</style>
