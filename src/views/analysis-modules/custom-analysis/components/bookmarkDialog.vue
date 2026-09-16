<template>
  <div>
    <el-dialog
      v-model="prototypeVisible"
      :modal-append-to-body="false"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      width="800px"
      class="add_prototype"
      :title="title"
    >
      <div style="background: #fff; padding: 20px 20px; min-height: 500px; border-radius: 4px">
        <el-form
          ref="ruleFormRef"
          :model="ruleForm"
          :rules="rules"
          label-width="100px"
          class="demo-ruleForm"
          style="margin-top: 20px"
        >
          <el-form-item label="书签名称" prop="bookName">
            <el-input
              v-model="ruleForm.bookName"
              style="font-size: 12px; width: 400px"
              placeholder="请输入书签名称"
            />
          </el-form-item>
          <el-form-item label="书签备注">
            <el-input
              v-model="ruleForm.remark"
              :rows="4"
              type="textarea"
              style="font-size: 12px; width: 400px"
              placeholder=""
            />
          </el-form-item>
          <el-form-item>
            <div style="display: flex; margin-left: -70px; margin-top: 40px">
              <el-button class="zc_btn" @click="saveForm">保存</el-button>
              <!-- 与 v2 一致：取消按钮在 v2 里是注释掉的 -->
            </div>
          </el-form-item>
        </el-form>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import { addApi, editApi } from '@/api/sysmanage/bookMark'
import { copyObj } from '@/utils/copy'
import { bus } from '@/utils/event-bus'
import { CUSTOM_ANALYSIS_PATH } from '@/router/paths'
import { useLatestOnly } from '@/composables/useLatestOnly'
import { useTrackingStore } from '@/stores/tracking'
import type { BookmarkTag, ModelObject } from '../types'

interface RuleForm {
  bookName: string
  remark: string
  bookmarkId: string
  queryParams?: string
  timeSection?: string
}

const emit = defineEmits<{ (e: 'updatePageList'): void }>()

const route = useRoute()
const router = useRouter()
const { next, isLatest } = useLatestOnly()
const trackingStore = useTrackingStore()
const projectName = computed(() => trackingStore.projectName)

const ruleFormRef = ref<FormInstance>()
const ruleForm = reactive<RuleForm>({
  bookName: '',
  remark: '',
  bookmarkId: '',
})

const rules: FormRules<RuleForm> = {
  bookName: [{ required: true, message: '书签名称不能为空', trigger: 'blur' }],
  // 与 v2 一致：remark 的必填规则在 v2 里是注释掉的
}

const title = ref('')
const prototypeVisible = ref(false)
const modelObj = ref<ModelObject | null>(null)
const eventType = ref('事件分析')

/**
 * 打开弹窗。
 * 父级调用方式与 v2 一致：
 *  - 更新书签：openDialog('更新书签', tagObj, model)
 *  - 保存/存为新书签：openDialog(flag, model)  —— 此时第二个实参就是查询模型，第三个是 undefined
 */
function openDialog(
  val: string,
  obj: BookmarkTag | ModelObject | null,
  model?: ModelObject,
  type?: string,
) {
  eventType.value = type ? type : '事件分析'
  title.value = val
  modelObj.value = model ?? null // 更新进度
  const item = copyObj(obj)
  if (val == '更新书签') {
    // v2 里 tagObj 可能是空串（只点过「保存书签」还没回到带 tagObj 的路由时），
    // 那种情况下 item.name / item.bookmarkId 取到的是 undefined，这里兜成空串
    const tag = item as BookmarkTag | null
    ruleForm.bookName = tag?.name ?? ''
    ruleForm.remark = tag?.remark ?? ''
    ruleForm.bookmarkId = tag?.bookmarkId ?? ''
    ruleForm.queryParams = tag?.queryParams
    ruleForm.timeSection = tag?.timeSection
  } else {
    ruleForm.bookName = ''
    ruleForm.remark = ''
    modelObj.value = item as ModelObject
  }
  prototypeVisible.value = true
}

/** 按 timeFlag 回写展示用的时间区间文案，与 v2 的分支一一对应 */
function timeSectionByFlag(queryParams: string): string | undefined {
  const queryObj = JSON.parse(queryParams) as {
    timeFlag?: string
    startDate?: string
    endDate?: string
  }
  const timeFlag = queryObj.timeFlag
  if (timeFlag) {
    if (timeFlag == 'day') return '今日'
    if (timeFlag == 'previous') return '昨日'
    if (timeFlag == 'week') return '过去7天'
    if (timeFlag == 'month') return '过去30天'
    // 与 v2 一致：timeFlag 是别的值时不改 timeSection
    return undefined
  }
  return queryObj.startDate + ' 至 ' + queryObj.endDate
}

async function saveForm() {
  const valid = await ruleFormRef.value?.validate().catch(() => false)
  if (!valid) return
  if (title.value == '更新书签') {
    const params: Record<string, unknown> = {
      projectName: projectName.value,
      bookmarkId: ruleForm.bookmarkId,
      name: ruleForm.bookName,
      remark: ruleForm.remark,
      queryParams: ruleForm.queryParams,
      timeSection: ruleForm.timeSection,
    }
    if (route.query.tagObj) {
      params.queryParams = JSON.stringify(modelObj.value)
    }
    // 增加时间区间
    if (params.queryParams) {
      const section = timeSectionByFlag(params.queryParams as string)
      if (section !== undefined) params.timeSection = section
    }
    const token = next()
    const res = await editApi(params).catch(() => null)
    if (!isLatest(token)) return
    if (res?.code == 200) {
      prototypeVisible.value = false
      ElMessage.success('更新成功')
      if (route.query.tagObj) {
        void router.push({
          path: CUSTOM_ANALYSIS_PATH,
          query: {
            query: route.query.query,
            tagObj: JSON.stringify(params),
          },
        })
        // v2: $bus.$emit('$tagIsUpdate', true, { query, tagObj })
        // mitt 只能传一个参数，第一个实参 true 对应 flag，第二个对象对应 obj
        bus.emit('$tagIsUpdate', {
          flag: true,
          obj: {
            query: route.query.query as string,
            tagObj: JSON.stringify(params),
          },
        })
      }
      emit('updatePageList')
    }
  } else {
    await addTagList()
  }
}

async function addTagList() {
  const model = modelObj.value
  const params: Record<string, unknown> = {
    name: ruleForm.bookName,
    remark: ruleForm.remark,
    bookmarkId: '',
    projectName: model?.projectName,
    // 与 v2 一致：v2 把写死的 "事件分析" 注释掉了，改用 eventType
    category: eventType.value,
    timeSection: model?.startDate + ' 至 ' + model?.endDate,
    queryParams: JSON.stringify(model),
    creator: '',
    createTime: '',
    updateTime: '',
  }

  // 与 v2 一致（v2 此处逻辑存疑：else 分支引用了块外并不存在的 queryObj，真走到会 ReferenceError；
  // 因为 queryParams 恒为 JSON.stringify(...) 不为空，该分支实际不可达，这里直接省掉）
  if (params.queryParams) {
    const queryObj = JSON.parse(params.queryParams as string) as { timeFlag?: string }
    const timeFlag = queryObj.timeFlag
    if (timeFlag == 'day') {
      params.timeSection = '今日'
    } else if (timeFlag == 'previous') {
      params.timeSection = '昨日'
    } else if (timeFlag == 'week') {
      params.timeSection = '过去7天'
    } else if (timeFlag == 'month') {
      params.timeSection = '过去30天'
    }
  }

  const token = next()
  const res = await addApi(params).catch(() => null)
  if (!isLatest(token)) return
  if (res?.code == 200) {
    const tagObj = {
      bookmarkId: (res.data as { bookmarkId?: string } | undefined)?.bookmarkId,
      name: params.name,
      remark: params.remark,
      timeSection: params.timeSection,
    }
    const obj = {
      tagObj: JSON.stringify(tagObj),
      query: params.queryParams as string,
    }

    // v2: $bus.$emit('$tagIsUpdate', true, obj)
    bus.emit('$tagIsUpdate', { flag: true, obj })
    ElMessage.success('添加成功')
    prototypeVisible.value = false
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
  font-size: 15px;
  font-weight: 500;
  color: #4d4d4d;
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
