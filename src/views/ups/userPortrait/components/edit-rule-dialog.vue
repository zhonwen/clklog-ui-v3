<script setup lang="ts">
/**
 * 群画像「设置更新规则」弹框（对应 v2 `views/ups/userPortrait/components/edit-rule-dialog.vue`）。
 *
 * v2 里的 `pickerOptions`（最近一周 / 一个月 / 三个月）在模板里没有任何日期选择器使用，属于遗留数据，不再搬运。
 */
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { editUpdateMet } from '@/api/upsapi/groupportrait'
import { useTrackingStore } from '@/stores/tracking'
import { useLatestOnly } from '@/composables/useLatestOnly'
import { latestVersionCountTime, updateTimeList } from '../options'
import { weekOrMonthRangeList } from '../types'
import type { PortraitRow } from '../types'

const emit = defineEmits<{ updatePageList: [] }>()

const trackingStore = useTrackingStore()
const { next, isLatest } = useLatestOnly()

const rowObj = ref<PortraitRow>({})
const dialogVisible = ref(false)
const updateType = ref('手动')
const frequency = ref('')
const frequencyValue = ref<number[]>([1])
const frequencyTime = ref('')
const dateRangeList = ref<{ value: number; label: string }[]>([])

const projectName = computed(() => trackingStore.projectName)
const hourList = computed(() => latestVersionCountTime())

function filterDateRange(val?: string) {
  if (val == '天') {
    frequencyValue.value = []
  }
  dateRangeList.value = weekOrMonthRangeList(val)
}

function openDialogEvent(row: PortraitRow) {
  dialogVisible.value = true
  rowObj.value = row
  if (row.updateType) {
    updateType.value = row.updateType
    frequency.value = row.frequency || ''
    frequencyTime.value = row.frequencyTime || ''
  } else {
    updateType.value = '手动'
    frequency.value = ''
    frequencyTime.value = ''
  }
  filterDateRange(row.frequency)
  if (row.frequencyValue) {
    frequencyValue.value = row.frequencyValue.split(',').map(Number).filter(Boolean)
  }
}

function handleRadio(val: string | number | boolean | undefined) {
  if (val == '手动') {
    frequency.value = ''
    frequencyTime.value = ''
  } else {
    frequency.value = '天'
    frequencyTime.value = '00:00'
  }
}

function saveHandle() {
  dialogVisible.value = false
  const params = {
    id: rowObj.value.id,
    updateType: updateType.value,
    frequency: frequency.value,
    frequencyValue: frequencyValue.value.join(','),
    frequencyTime: frequencyTime.value,
    returnUserLimitSetting: '',
    projectName: projectName.value,
  }
  const token = next()
  editUpdateMet(params).then(() => {
    if (!isLatest(token)) return
    ElMessage.success('保存成功')
    emit('updatePageList')
  })
}

defineExpose({ openDialogEvent })
</script>

<template>
  <div>
    <el-dialog
      v-model="dialogVisible"
      :modal-append-to-body="false"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      width="700px"
      class="prototype_dialog"
      title="设置更新规则"
    >
      <div>
        <div class="public-secondHead">更新方式</div>
        <el-radio-group
          v-model="updateType"
          size="small"
          style="height: 30px"
          @change="handleRadio"
        >
          <el-radio value="例行" border>例行</el-radio>
          <el-radio value="手动" border>手动</el-radio>
        </el-radio-group>
        <div style="min-height: 100px">
          <div v-if="updateType == '例行'" class="lixing">
            <p>每</p>
            <el-select
              v-model="frequency"
              style="width: 100px; margin-right: 10px"
              @change="filterDateRange"
            >
              <el-option v-for="x in updateTimeList" :key="x.value" :label="x.label" :value="x.value">
                <div>
                  {{ x.label }}
                </div>
              </el-option>
            </el-select>
            <el-select
              v-if="frequency != '天'"
              v-model="frequencyValue"
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
              v-model="frequencyTime"
              placeholder=""
              style="width: 100px; margin-right: 10px"
            >
              <el-option v-for="x in hourList" :key="x.value" :label="x.label" :value="x.value">
                <div>
                  {{ x.label }}
                </div>
              </el-option>
            </el-select>
            <p>开始计算</p>
          </div>
        </div>
        <div
          style="
            display: flex;
            justify-content: flex-end;
            border-top: 1px solid #e7e7e7;
            padding-top: 25px;
          "
        >
          <el-button class="zc_btn" @click="saveHandle">保存</el-button>
          <el-button class="zc_btn_default" @click="dialogVisible = false">取消</el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
:deep(.el-range-editor.el-input__inner) {
  height: 30px;
  width: 250px;
}

:deep(.el-range-editor .el-range-input) {
  font-size: 13px;
}

:deep(.el-input__inner) {
  height: 30px;
  line-height: 30px;
  font-size: 13px;
}

:deep(.el-radio) {
  margin-right: 10px;
}

:deep(.el-dialog) {
  border-radius: 6px;
}

:deep(.el-dialog__header) {
  border-bottom: 1px solid #e7e7e7;
}

:deep(.el-dialog__footer) {
  margin-left: 0 !important;
  width: 100%;
  display: flex;
  justify-content: center;
}

:deep(.el-dialog__body) {
  font-size: 13px;
  padding: 20px;
}

.public-secondHead {
  margin: 15px 0;
}

.lixing {
  display: flex;
  margin: 20px 0;
  align-items: center;

  p {
    margin-right: 15px;
    font-size: 13px;
    color: #4d4d4d;
  }
}
</style>
