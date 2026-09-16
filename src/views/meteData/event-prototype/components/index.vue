<script setup lang="ts">
import { ref } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'

/**
 * v2 src/views/meteData/event-prototype/components/index.vue 的等价迁移。
 *
 * 说明：这个「新增属性」弹框在 v2 里没有被任何页面引用（event-prototype/index.vue 只引了
 * uploadDialog），保存按钮也只是关闭弹框、不调接口，选项数据还是示例数据（黄金糕/双皮奶…）。
 * 这里按原样迁移，未做任何功能补全。
 */

interface DemoRuleForm {
  statu: string
  grouping: string
  unit: string
  accuracy: string
  platform: string[]
  timing: string
  notes: string
  name: string
  region: string
  receive: string
  tags: string[]
  // 与 v2 一致（v2 此处逻辑存疑：模板里绑了 ruleForm.illustrate / ruleForm.radioType，
  // 但 data 里从未声明这两个字段，Vue2 下它们不是响应式的）
  illustrate?: string
  radioType?: string
}

const DialogVisible = ref(false)
const formRef = ref<FormInstance>()

const ruleForm = ref<DemoRuleForm>({
  statu: '1',
  grouping: '',
  unit: '',
  accuracy: '',
  platform: ['服务器', 'IOS'],
  timing: '',
  notes: '',
  name: '',
  region: '',
  receive: '3',
  tags: ['HTML', 'CSS'],
})

const options = [
  {
    value: '选项1',
    label: '黄金糕',
  },
  {
    value: '选项2',
    label: '双皮奶',
  },
  {
    value: '选项3',
    label: '蚵仔煎',
  },
]

const rules: FormRules = {
  name: [{ required: true, message: '属性显示名不能为空', trigger: 'blur' }],
  region: [{ required: true, message: '标识符不能为空', trigger: 'blur' }],
  platform: [{ required: true, message: '应用平台不能为空', trigger: 'blur' }],
  tags: [
    {
      required: true,
      message: '关联自定义属性不能为空',
      trigger: 'blur',
    },
  ],
}

async function saveForm() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (valid) {
    DialogVisible.value = false
  }
}

function cancleForm() {
  DialogVisible.value = false
}

function openDialog() {
  DialogVisible.value = true
}

// <script setup> 默认对外封闭，父组件通过 ref 调 openDialog() 必须先 expose
defineExpose({ openDialog })
</script>

<template>
  <div>
    <el-dialog
      v-model="DialogVisible"
      :modal-append-to-body="false"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      width="700px"
      title="新增属性"
      class="add_prototype"
    >
      <el-form
        ref="formRef"
        :model="ruleForm"
        :rules="rules"
        label-width="120px"
        class="demo-ruleForm"
      >
        <el-form-item label="属性显示名" prop="name">
          <el-input v-model="ruleForm.name" placeholder="请输入属性显示名" style="font-size: 12px" />
        </el-form-item>
        <el-form-item label="属性英文名" prop="region">
          <el-input
            v-model="ruleForm.region"
            style="font-size: 12px"
            placeholder="只支持英文、数字、下划线且必须以英文字母开头，不可以_结尾"
          />
        </el-form-item>
        <el-form-item label="属性事例或说明">
          <el-input
            v-model="ruleForm.illustrate"
            style="font-size: 12px"
            placeholder="属性事例或说明"
          />
        </el-form-item>
        <el-form-item label="属性值类型">
          <div style="display: flex; justify-content: space-between">
            <el-radio-group v-model="ruleForm.radioType">
              <el-radio-button value="文本">文本</el-radio-button>
              <el-radio-button value="数值">数值</el-radio-button>
              <el-radio-button value="时间">时间</el-radio-button>
              <el-radio-button value="是非">是非</el-radio-button>
            </el-radio-group>
          </div>
        </el-form-item>
        <el-form-item label="单位">
          <div style="display: flex">
            <el-input
              v-model="ruleForm.unit"
              style="font-size: 12px; width: 100px"
              placeholder="请填写单位"
            />
            <div style="display: flex">
              <div class="gp-item-title" style="margin-right: 15px">精度</div>
              <el-select v-model="ruleForm.accuracy" placeholder="请选择" style="width: 90px">
                <el-option
                  v-for="item in options"
                  :key="item.value"
                  :label="item.label"
                  :value="item.value"
                />
              </el-select>
            </div>
          </div>
        </el-form-item>
        <el-form-item label="显示状态">
          <el-radio v-model="ruleForm.statu" value="1">显示</el-radio>
          <el-radio v-model="ruleForm.statu" value="2">隐藏</el-radio>
        </el-form-item>
        <el-form-item label="属性分组">
          <el-input v-model="ruleForm.grouping" style="font-size: 12px" placeholder="必填" />
        </el-form-item>
        <div style="display: flex; justify-content: center; margin: 30px 0">
          <el-button class="custom_button" @click="saveForm">保存</el-button>
          <el-button class="custom_button" style="margin-left: 20px" @click="cancleForm">
            取消
          </el-button>
        </div>
      </el-form>
    </el-dialog>
  </div>
</template>

<style lang="scss" scoped>
:deep() {
  .el-dialog {
    border-radius: 6px;
  }

  .el-dialog__body {
    padding: 30px 50px;
  }

  .el-dialog__title {
    font-size: 15px;
    font-weight: 600;
    line-height: 25px;
    color: #4d4d4d;
  }

  .el-form-item__label {
    font-size: 15px;
    font-weight: 500;
    color: #4d4d4d;
  }
}

.ad-h1 {
  margin: 50px 0 30px 0;
  font-size: 15px;
  font-weight: 500;
  color: #4d4d4d;
}

.copy_button {
  height: 30px;
  color: #194580;
  font-size: 13px;
  background-color: #fff;
  margin-top: 20px;
  margin-bottom: 20px;
}

.add_prototype {
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
