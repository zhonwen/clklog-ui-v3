<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import PieMarker from '@/components/Charts/PieMarker.vue'
import { getVisitorApi } from '@/api/trackingapi/visitor'
import { percentage } from '@/utils/percent'
import { formatTime } from '@/utils/format'
import arrowIcon from '@/assets/images/icon.png'

type VisitorMetrics = {
  pv?: number
  uv?: number
  bounceRate?: number
  avgVisitTime?: number
  avgPv?: number
}

const props = defineProps<{
  commonParams: Record<string, unknown>
}>()

const router = useRouter()
const loadingRefresh = ref(false)
const visitorList = ref<{ newVisitor?: VisitorMetrics; oldVisitor?: VisitorMetrics } | null>(null)
const newVistorPercent = ref('')
const oldVistorPercent = ref('')
const charts2 = ref<{ getPercentData: (val: Record<string, unknown>) => void } | null>(null)
let updateTimer: ReturnType<typeof setTimeout> | null = null

const newVisitor = computed(() => visitorList.value?.newVisitor || {})
const oldVisitor = computed(() => visitorList.value?.oldVisitor || {})

function formatTimeFun(val?: number) {
  return formatTime(Math.floor(Number(val || 0)))
}

function getVisitor() {
  loadingRefresh.value = true
  getVisitorApi({ ...props.commonParams })
    .then((res) => {
      loadingRefresh.value = false
      if (res.code == 200) visitorList.value = (res.data || null) as typeof visitorList.value
    })
    .catch(() => {
      loadingRefresh.value = false
    })
}

watch(visitorList, () => {
  if (updateTimer) clearTimeout(updateTimer)
  updateTimer = setTimeout(() => {
    const newUv = newVisitor.value.uv || 0
    const oldUv = oldVisitor.value.uv || 0
    const total = newUv + oldUv
    const newPercent = (newUv / total) * 100
    const oldPercent = (oldUv / total) * 100
    newVistorPercent.value =
      total > 0 ? (newPercent == 100 ? '100%' : newPercent == 0 ? '0%' : `${newPercent.toFixed(2)} %`) : ''
    oldVistorPercent.value =
      total > 0 ? (oldPercent == 100 ? '100%' : oldPercent == 0 ? '0%' : `${oldPercent.toFixed(2)} %`) : ''
    charts2.value?.getPercentData({
      newVistorPercent: newVistorPercent.value,
      oldVistorPercent: oldVistorPercent.value,
      newUvCount: newUv,
      oldUvCount: oldUv,
      ...props.commonParams,
    })
  }, 80)
})

defineExpose({ getVisitor })
</script>

<template>
  <div v-loading="loadingRefresh" class="NewOldVisitors block-main public-hoverItem">
    <div class="block-head" @click="router.push('/visitorAnalysis/newoldVisitor')">
      <div class="block-title">新老访客</div>
      <div class="block-head-icon">
        <img :src="arrowIcon" alt="" width="10" />
      </div>
    </div>
    <div class="pieShow">
      <div class="visitor">
        <div class="bid-list-page">
          <div class="bid-list-header" style="padding-bottom: 6px">
            <div class="header-name w157" />
            <div class="header-name w157">老访客</div>
            <div class="header-name w157">新访客</div>
          </div>
          <div class="bid-list-record">
            <div class="bid-list-item w157" />
            <div class="bid-list-item w158">
              <p class="setGrey">{{ oldVistorPercent || '--' }}</p>
            </div>
            <div class="bid-list-item w158">
              <p>{{ newVistorPercent || '--' }}</p>
            </div>
          </div>
          <div class="bid-list-record">
            <div class="bid-list-item w157 lettSpace"><p>浏览量</p></div>
            <div class="bid-list-item w159 lettSpace"><p class="setGrey">{{ oldVisitor.pv || '--' }}</p></div>
            <div class="bid-list-item w159 lettSpace"><p>{{ newVisitor.pv || '--' }}</p></div>
          </div>
          <div class="bid-list-record">
            <div class="bid-list-item w157 lettSpace"><p>访客数</p></div>
            <div class="bid-list-item w159 lettSpace"><p class="setGrey">{{ oldVisitor.uv || '--' }}</p></div>
            <div class="bid-list-item w159 lettSpace"><p>{{ newVisitor.uv || '--' }}</p></div>
          </div>
          <div class="bid-list-record">
            <div class="bid-list-item w157 lettSpace"><p>跳出率</p></div>
            <div class="bid-list-item w159 lettSpace">
              <p v-if="oldVisitor.bounceRate" class="setGrey">{{ percentage(oldVisitor.bounceRate) }}</p>
              <p v-else>--</p>
            </div>
            <div class="bid-list-item w159 lettSpace">
              <p v-if="newVisitor.bounceRate">{{ percentage(newVisitor.bounceRate) }}</p>
              <p v-else>--</p>
            </div>
          </div>
          <div class="bid-list-record">
            <div class="bid-list-item w157 lettSpace"><p>平均访问时长</p></div>
            <div class="bid-list-item w159 lettSpace"><p class="setGrey">{{ formatTimeFun(oldVisitor.avgVisitTime) || '--' }}</p></div>
            <div class="bid-list-item w159 lettSpace"><p>{{ formatTimeFun(newVisitor.avgVisitTime) || '--' }}</p></div>
          </div>
          <div class="bid-list-record">
            <div class="bid-list-item w157 lettSpace"><p>平均访问页数</p></div>
            <div class="bid-list-item w159 lettSpace"><p class="setGrey">{{ Math.floor(oldVisitor.avgPv || 0) || '--' }}</p></div>
            <div class="bid-list-item w159 lettSpace"><p>{{ Math.floor(newVisitor.avgPv || 0) || '--' }}</p></div>
          </div>
        </div>
      </div>
      <div class="pieIcon">
        <PieMarker ref="charts2" height="350px" width="100%" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.setGrey {
  color: #fd7e14;
}

.w158 {
  color: #2c7be5;
  font-size: 17px;
  line-height: 17px;
}

.NewOldVisitors {
  .pieShow {
    display: flex;
    width: 100%;
    height: calc(100% - 45px);

    .visitor {
      width: 60%;

      .bid-list-page {
        display: flex;
        flex-direction: column;

        .bid-list-header {
          display: flex;

          .header-name {
            color: #4d4d4d;
            width: 33%;
            justify-content: center;
            height: 30px;
            display: flex;
            align-items: center;
          }
        }

        .bid-list-record {
          display: flex;

          .lettSpace {
            margin-top: 10px;
          }

          .bid-list-item {
            width: 33%;
            justify-content: center;
            height: 30px;
            display: flex;
            align-items: center;
          }

          .w157 {
            color: #4d4d4d;
            font-size: 13px;
            line-height: 14px;
          }

          .w159 {
            font-size: 13px;
            line-height: 14px;
            color: #2c7be5;
          }
        }
      }
    }

    .pieIcon {
      width: 40%;
      height: 100%;
    }
  }
}
</style>
