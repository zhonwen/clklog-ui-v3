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
/** 日期重算种子：点刷新时自增，强制 startTime / endTime 重新取当前时间 */
const dateSeed = ref(0)

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
  // 与 v2 的差异（有意修复）：v2 写的是 day - week + 1，getDay() 周日返回 0，
  // 于是每个周日算出来的「本周起始日」是明天，startTime > endTime，首页当天全部查不到数据。
  // 这里按「周一为一周起点」算偏移，周一~周六与 v2 完全一致，只有周日不同。
  const diffToMonday = (week + 6) % 7
  return {
    weekStart: formData(new Date(year, month, day - diffToMonday)),
    weekEnd: formData(new Date(year, month, day)),
  }
}

const startTime = computed(() => {
  void dateSeed.value
  if (timeType.value === 'week') return getWeek().weekStart
  if (timeType.value === 'month') {
    const monthStart = new Date()
    monthStart.setDate(1)
    return formData(monthStart)
  }
  return formatDate(new Date())
})

const endTime = computed(() => {
  void dateSeed.value
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
  // startTime / endTime 是 computed，只依赖 timeType，new Date() 会被缓存住。
  // 页面跨过零点后不动这个种子的话，点刷新查的还是昨天的区间。
  dateSeed.value++
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
