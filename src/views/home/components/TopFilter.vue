<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Refresh, RefreshRight } from '@element-plus/icons-vue'
import { formatDate } from '@/utils/format'
import { useUserStore } from '@/stores/user'

const emit = defineEmits<{
  setTopFilterParams: [val: Record<string, unknown>]
  timeTypeCheck: [val: string]
}>()

const userStore = useUserStore()
const timeType = ref('day')
const channelValue = ref('')
const loadingApi = ref(false)

const allChaneList = computed(() => userStore.channelList)
const channel = computed(() => [channelValue.value])

function formData(val: Date) {
  return formatDate(val)
}

function getWeek() {
  const date = new Date()
  const day = date.getDate()
  const week = date.getDay()
  const month = date.getMonth()
  const year = date.getFullYear()
  return {
    weekStart: formData(new Date(year, month, day - week + 1)),
    weekEnd: formData(new Date(year, month, day)),
  }
}

const startTime = computed(() => {
  if (timeType.value === 'week') return getWeek().weekStart
  if (timeType.value === 'month') {
    const monthStart = new Date()
    monthStart.setDate(1)
    return formData(monthStart)
  }
  return formatDate(new Date())
})

const endTime = computed(() => {
  if (timeType.value === 'week') return getWeek().weekEnd
  if (timeType.value === 'month') {
    const monthStart = new Date()
    monthStart.setDate(1)
    const monthEnd = new Date(monthStart)
    monthEnd.setMonth(monthEnd.getMonth() + 1)
    monthEnd.setDate(0)
    return formData(monthEnd)
  }
  return formatDate(new Date())
})

const filterParams = computed(() => ({
  timeType: timeType.value,
  channel: channel.value,
}))

function setTopFilterParams(val: Record<string, unknown>) {
  emit('setTopFilterParams', { ...val, startTime: startTime.value, endTime: endTime.value })
  emit('timeTypeCheck', timeType.value)
}

function resetApiList() {
  timeType.value = 'day'
  channelValue.value = ''
}

function refreshApiList() {
  loadingApi.value = true
  setTopFilterParams(filterParams.value)
  setTimeout(() => {
    loadingApi.value = false
  }, 500)
}

watch(filterParams, (val) => setTopFilterParams(val), { immediate: true })
</script>

<template>
  <div class="TopFilter">
    <div class="radio-com public_border_color filterbar-tab-right">
      <span class="radio-com-label">时间:</span>
      <el-radio-group v-model="timeType" class="radio-com-el">
        <el-radio value="day">今日</el-radio>
        <el-radio value="week">本周</el-radio>
        <el-radio value="month">本月</el-radio>
      </el-radio-group>
    </div>
    <div
      v-if="allChaneList.length > 0"
      class="radio-com public_border_color"
      style="max-width: 1000px; overflow-x: auto; overflow-y: hidden"
    >
      <span class="radio-com-label">渠道：</span>
      <el-radio-group v-model="channelValue" class="radio-com-el">
        <el-radio v-for="item in allChaneList" :key="item.id" :value="item.id">
          {{ item.displayName }}
        </el-radio>
      </el-radio-group>
    </div>
    <div class="tabBarBtn">
      <el-button
        class="zc_btn refresh"
        :loading="loadingApi"
        :icon="RefreshRight"
        @click="refreshApiList"
      >
        刷新
      </el-button>
      <el-button class="zc_btn_default reset" :icon="Refresh" @click="resetApiList">重置</el-button>
    </div>
  </div>
</template>

<style lang="scss" scoped>
@use '@/styles/components/TopFilter.scss';
</style>
