<script setup lang="ts">
import { sharedText } from '@/components/pointFont'
import questionImg from '@/assets/images/question.png'

withDefaults(
  defineProps<{
    byFlowView?: boolean
    byChannel?: boolean
  }>(),
  { byFlowView: false, byChannel: false },
)

const metrics = [
  { key: 'pv', label: '浏览量' },
  { key: 'visitCount', label: '访问次数' },
  { key: 'uv', label: '访客数' },
  { key: 'ip', label: 'IP数' },
  { key: 'avgPv', label: '平均访问页数' },
  { key: 'avgVisitTime', label: '平均访问时长' },
  { key: 'bounceRate', label: '跳出率' },
] as const
</script>

<template>
  <div v-if="byFlowView || byChannel">
    <div class="bid-list-headed">
      <div v-if="!byChannel" class="header-name w156" />
      <div v-for="item in metrics" :key="item.key" class="header-name w156">
        {{ item.label }}
        <div class="parentPosition">
          <el-popover placement="bottom-start" :width="200" trigger="hover">
            <div style="padding: 5px; font-size: 12px" v-html="sharedText[item.key]" />
            <template #reference>
              <img class="icon-question" :src="questionImg" alt="" />
            </template>
          </el-popover>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.parentPosition {
  position: relative;
}

.bid-list-headed {
  padding-bottom: 10px;
  padding-top: 15px;
  display: flex;

  .header-name {
    width: 14%;
    justify-content: center;
    height: 30px;
    display: flex;
    align-items: center;
  }

  .w156 {
    font-size: 15px;
    font-weight: 400;
    line-height: 16px;
    color: #4d4d4d;
  }

  img {
    width: 11.44px;
    height: 11.44px;
    margin-left: 12px;
    cursor: pointer;
  }
}
</style>
