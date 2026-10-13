<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { ElMessage } from 'element-plus'
import { modifyPassword } from '@/api/user'
import { bus } from '@/utils/event-bus'
import { getPasswordError } from '@/utils/validate'
import { encryptPasswordWithCid, fetchEncryptContext } from '@/utils/rsaEncrypt'

const dialogVisible = ref(false)
const submitting = ref(false)
const formRef = ref<FormInstance>()
const oldPasswordRef = ref()
const newPasswordRef = ref()
const confirmPasswordRef = ref()

const modifyPswForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const passwordType = reactive({
  oldPassword: 'password' as 'password' | 'text',
  newPassword: 'password' as 'password' | 'text',
  confirmPassword: 'password' as 'password' | 'text',
})

const validateNewPassword = (_rule: unknown, value: string, callback: (error?: Error) => void) => {
  const error = getPasswordError(value, '请输入新密码')
  if (error) {
    callback(new Error(error))
  } else if (value === modifyPswForm.oldPassword) {
    callback(new Error('新密码不能与原密码相同'))
  } else {
    if (modifyPswForm.confirmPassword) {
      void formRef.value?.validateField('confirmPassword')
    }
    callback()
  }
}

const validateConfirmPassword = (_rule: unknown, value: string, callback: (error?: Error) => void) => {
  if (!value) {
    callback(new Error('请再次输入新密码'))
  } else if (value !== modifyPswForm.newPassword) {
    callback(new Error('两次密码不一致'))
  } else {
    callback()
  }
}

const rules: FormRules = {
  oldPassword: [{ required: true, message: '请输入原密码', trigger: 'blur' }],
  newPassword: [{ required: true, trigger: 'blur', validator: validateNewPassword }],
  confirmPassword: [{ required: true, trigger: 'blur', validator: validateConfirmPassword }],
}

function resetForm() {
  modifyPswForm.oldPassword = ''
  modifyPswForm.newPassword = ''
  modifyPswForm.confirmPassword = ''
  passwordType.oldPassword = 'password'
  passwordType.newPassword = 'password'
  passwordType.confirmPassword = 'password'
  nextTick(() => formRef.value?.clearValidate())
}

watch(dialogVisible, (val) => {
  if (val) resetForm()
})

function showPwd(field: 'oldPassword' | 'newPassword' | 'confirmPassword') {
  passwordType[field] = passwordType[field] === 'password' ? 'text' : 'password'
  const map = { oldPassword: oldPasswordRef, newPassword: newPasswordRef, confirmPassword: confirmPasswordRef }
  nextTick(() => map[field].value?.focus())
}

function open() {
  dialogVisible.value = true
}

function modifyPsw() {
  void formRef.value?.validate((valid) => {
    if (!valid) return
    submitting.value = true
    fetchEncryptContext()
      .then(({ cid, publicKey }) => {
        return modifyPassword({
          oldPassword: encryptPasswordWithCid(modifyPswForm.oldPassword, cid, publicKey),
          newPassword: encryptPasswordWithCid(modifyPswForm.newPassword, cid, publicKey),
          cid,
        })
      })
      .then((res) => {
        if (res.code === 200) {
          ElMessage.success('修改密码成功')
          dialogVisible.value = false
        } else {
          ElMessage.error(res.msg || res.message || '修改失败')
        }
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : ''
        if (msg && /公钥|加密|验证码标识/.test(msg)) {
          ElMessage.error(msg)
        }
      })
      .finally(() => {
        submitting.value = false
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
      autocomplete="off"
    >
      <el-form-item label="原密码" prop="oldPassword">
        <el-input
          ref="oldPasswordRef"
          v-model="modifyPswForm.oldPassword"
          :type="passwordType.oldPassword"
          autocomplete="off"
          clearable
          placeholder="请输入原密码"
        >
          <template #suffix>
            <el-icon class="pwd-toggle" @click.stop="showPwd('oldPassword')">
              <span class="el-icon-lock" />
            </el-icon>
          </template>
        </el-input>
      </el-form-item>
      <el-form-item label="新密码" prop="newPassword">
        <el-input
          ref="newPasswordRef"
          v-model="modifyPswForm.newPassword"
          :type="passwordType.newPassword"
          autocomplete="off"
          clearable
          maxlength="18"
          placeholder="请输入新密码"
        >
          <template #suffix>
            <el-icon class="pwd-toggle" @click.stop="showPwd('newPassword')">
              <span class="el-icon-lock" />
            </el-icon>
          </template>
        </el-input>
      </el-form-item>
      <el-form-item label="确认密码" prop="confirmPassword">
        <el-input
          ref="confirmPasswordRef"
          v-model="modifyPswForm.confirmPassword"
          :type="passwordType.confirmPassword"
          autocomplete="off"
          clearable
          maxlength="18"
          placeholder="请再次输入新密码"
        >
          <template #suffix>
            <el-icon class="pwd-toggle" @click.stop="showPwd('confirmPassword')">
              <span class="el-icon-lock" />
            </el-icon>
          </template>
        </el-input>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取 消</el-button>
      <el-button type="primary" :loading="submitting" @click="modifyPsw">确 定</el-button>
    </template>
  </el-dialog>
</template>

<style lang="scss" scoped>
:deep(.el-form-item__label) {
  text-align: left;
}

:deep(.el-form-item__error) {
  white-space: normal;
  line-height: 1.4;
}

:deep(.el-dialog) {
  border-radius: 6px;
}

:deep(.pwd-toggle) {
  cursor: pointer;
  color: #889aa4;
  font-size: 14px;
  padding: 0 4px;
  line-height: 32px;
  pointer-events: auto;
}
</style>
