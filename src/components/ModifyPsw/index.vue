<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { modifyPassword } from '@/api/user'
import { bus } from '@/utils/event-bus'

const dialogVisible = ref(false)
const formRef = ref<FormInstance>()
const modifyPswForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const rules: FormRules = {
  oldPassword: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  newPassword: [{ required: true, message: '请输入新密码', trigger: 'blur' }],
  confirmPassword: [{ required: true, message: '请再次输入新密码', trigger: 'blur' }],
}

function open() {
  dialogVisible.value = true
}

function modifyPsw() {
  void formRef.value?.validate((valid) => {
    if (!valid) return
    void modifyPassword(modifyPswForm).then((res) => {
      if (res.code === 200) {
        ElMessage.success('修改密码成功')
        dialogVisible.value = false
      } else {
        ElMessage.error(res.msg || res.message || '修改失败')
      }
    })
  })
}

onMounted(() => {
  bus.on('$modifyPsw', open)
})

onUnmounted(() => {
  bus.off('$modifyPsw', open)
})
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    title="修改密码"
    width="800px"
    top="20vh"
    :close-on-click-modal="false"
    :close-on-press-escape="false"
    class="custom_warry"
  >
    <el-form
      ref="formRef"
      class="dialog-form"
      :model="modifyPswForm"
      :rules="rules"
      label-width="100px"
      size="small"
      style="min-height: 330px"
    >
      <el-form-item label="原密码" prop="oldPassword">
        <el-input v-model="modifyPswForm.oldPassword" type="password" autocomplete="off" clearable placeholder="请输入原密码" />
      </el-form-item>
      <el-form-item label="新密码" prop="newPassword">
        <el-input v-model="modifyPswForm.newPassword" type="password" autocomplete="off" clearable placeholder="请输入新密码" />
      </el-form-item>
      <el-form-item label="确认密码" prop="confirmPassword">
        <el-input v-model="modifyPswForm.confirmPassword" type="password" autocomplete="off" clearable placeholder="请再次输入新密码" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取 消</el-button>
      <el-button type="primary" @click="modifyPsw">确 定</el-button>
    </template>
  </el-dialog>
</template>
