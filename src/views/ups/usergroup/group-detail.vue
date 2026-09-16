<script setup lang="ts">
/**
 * 分群详情页（对应 v2 views/ups/usergroup/group-detail.vue）。
 *
 * 与 v2 一致（v2 此处逻辑存疑：这个页面里的柱状图、表格、人数「20001人」全是写死的 mock，
 * 只有顶部的 groupDetail 是真接口，实际入口在列表页的 group-detail-dialog）。
 */
import { computed, onMounted, ref } from 'vue'
import type { CSSProperties } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { EChartsOption } from 'echarts'
import { ArrowRight, UserFilled } from '@element-plus/icons-vue'
import usersDialog from './components/users-dialog.vue'
import { get } from '@/api/upsapi/usergroup'
import { formatDateHMS } from '@/utils/date'
import { useChart } from '@/composables/useChart'
import { useLatestOnly } from '@/composables/useLatestOnly'
import { useTrackingStore } from '@/stores/tracking'
import { siblingPath } from './utils'
import type { GroupRow } from './types'

interface MockRow {
  name: string
  rate: number
  num: number
}

const route = useRoute()
const router = useRouter()
const trackingStore = useTrackingStore()
const { elRef, chart, init } = useChart()
const { next: nextDetail, isLatest: isLatestDetail } = useLatestOnly()

const usersdialog = ref<{ openDialog: (obj: GroupRow) => void } | null>(null)

const historydate = ref<string[]>([])
const activePrototype = ref('history')
const groupDetail = ref<GroupRow>({})
const tableData = ref<MockRow[]>([
  {
    name: '全部',
    rate: 100,
    num: 660,
  },
  {
    name: '高度活跃',
    rate: 25,
    num: 220,
  },
  {
    name: '中度活跃',
    rate: 75,
    num: 120,
  },
  {
    name: '低度活跃',
    rate: 75,
    num: 320,
  },
])

const projectName = computed(() => trackingStore.projectName)

const headerCellStyle: CSSProperties = { textAlign: 'center', background: '#f7fafe  ' }
const cellStyle: CSSProperties = { textAlign: 'center' }

/** 图表 series 的 mock 数据，点击柱子时要按 dataIndex 回填表格 */
const seriesMock = [
  { name: '高活跃度', color: '#85dec8', data: [320, 302, 301, 334] },
  { name: '低活跃度', color: '#2c7be5', data: [120, 132, 101, 134] },
  { name: '中度跃度', color: '#ffde84', data: [220, 182, 191, 234, 290, 330, 310] },
]

function handleUsersDetail(obj: GroupRow) {
  usersdialog.value?.openDialog(obj)
}

function findGroupHandle() {
  void router.push({
    path: siblingPath(route.path, 'creator'),
    query: {
      from: 'detail',
      id: groupDetail.value.id,
      createIndex: 1,
    },
  })
}

function historyEchart() {
  const option: EChartsOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        lineStyle: {
          color: '#C0CADB',
          width: 1,
        },
      },
      formatter(params: unknown) {
        const list = (Array.isArray(params) ? params : [params]) as {
          name?: string
          value?: number
          color?: string
          seriesName?: string
        }[]
        let res = ''
        for (let i = 0; i < list.length; i++) {
          const p = list[i]
          if (!p) continue
          if (i == 0) {
            res += '<div>' + p.name + '</div>'
          }
          if (p.value) {
            res +=
              "<div style='display:flex;align-items:center;'>" +
              ` <div style=' width: 10px; height: 10px; border-radius: 50%;background-color: ${p.color};'>
                    </div>` +
              "<div style='margin-left:3px;'>" +
              p.seriesName +
              ' :' +
              p.value +
              '</div>' +
              '</div>'
          }
        }
        return res
      },
    },
    legend: {},
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      axisTick: {
        show: false,
      },
      type: 'category',
      data: ['10-14', '10-15', '10-16', '10-17'],
    },
    yAxis: {
      axisTick: {
        show: false,
      },
      axisLine: {
        show: false,
      },
      type: 'value',
    },
    // echarts 6：itemStyle.normal 已移除，直接展开到 itemStyle
    series: seriesMock.map((item) => ({
      name: item.name,
      type: 'bar' as const,
      stack: 'total',
      label: {
        show: true,
      },
      emphasis: {
        focus: 'series' as const,
      },
      itemStyle: {
        color: item.color,
      },
      barWidth: 40,
      data: item.data,
    })),
  }
  init(option)

  chart.value?.on('click', (params: unknown) => {
    // 检查点击的是不是柱状图
    const dataIndex = (params as { dataIndex: number }).dataIndex
    tableData.value = []
    seriesMock.forEach((item) => {
      tableData.value.push({
        name: item.name,
        num: item.data[dataIndex] ?? 0,
        rate: 30 + Number(Math.random().toFixed(1)) / 10,
      })
    })
  })
}

onMounted(() => {
  historyEchart()
  const token = nextDetail()
  void get({ id: route.query.id, projectName: projectName.value }).then((res) => {
    if (!isLatestDetail(token)) return
    groupDetail.value = res?.data || {}
  })
})
</script>

<template>
  <div>
    <div class="public-block table_contain" style="border-radius: 6px">
      <div class="block_online block-main public-hoverItem" style="min-height: 300px">
        <el-row>
          <div class="public-firstHead"></div>
          <span class="public_firstHead">分群详情</span>
          <div style="margin: 15px 15px 15px">
            <div class="public-secondHead" style="display: flex">
              {{ groupDetail.name }}
              <div class="public-threeHead" style="margin-left: 30px; color: #2c7be5">
                {{ groupDetail.status }}
              </div>
            </div>
            <div
              class="public-threeHead"
              style="color: #a5a5a5; margin: 10px; height: 15px"
            >
              {{ groupDetail.description }}
            </div>

            <div
              class="public-threeHead"
              style="
                color: #2c7be5;
                margin: 10px;
                height: 15px;
                font-weight: 600;
                align-items: baseline;
                display: flex;
              "
            >
              <div style="cursor: pointer" @click="handleUsersDetail(groupDetail)">
                <!-- v2 这里的人数是写死的 -->
                20001人
              </div>
              <div
                style="margin-left: 15px; color: #a5a5a5; font-weight: 500; font-size: 12px"
              >
                {{ formatDateHMS(groupDetail.updateTime) }}
              </div>
            </div>
            <div
              class="public-threeHead"
              style="
                color: #2c7be5;
                margin: 10px;
                height: 15px;
                cursor: pointer;
                display: flex;
                font-size: 12px;
              "
              @click="findGroupHandle()"
            >
              查看分群规则 <el-icon><ArrowRight /></el-icon>
            </div>
            <!-- tabs -->
            <div ref="elRef" style="width: 100%; height: 300px; margin-top: 15px"></div>
            <el-table
              class="public-radius"
              :header-cell-style="headerCellStyle"
              border
              :cell-style="cellStyle"
              :data="tableData"
              style="width: 90%; margin: 30px"
            >
              <el-table-column prop="name" label="计算基准时间" />
              <el-table-column prop="rate" :label="'计算详情'">
                <template #default>
                  <div style="display: flex; justify-content: center; padding: 5px 0">
                    <div>成功</div>
                    <div style="margin-left: 10px">2024-9-09 12:09:28</div>
                  </div>
                </template>
              </el-table-column>
              <el-table-column :label="'分群人数'" />
              <el-table-column :label="'操作'">
                <template #default>
                  <el-icon
                    style="
                      background-color: #27b927;
                      color: #0d782e;
                      cursor: pointer;
                      font-size: 18px;
                      border-radius: 2px;
                    "
                  >
                    <UserFilled />
                  </el-icon>
                </template>
              </el-table-column>
            </el-table>
            <!--
              与 v2 一致（v2 此处逻辑存疑：属性名写成了 :picker-tagOptions，
              element-ui 不认这个 prop，所以快捷选项从来没生效过；这里同样不绑）
            -->
            <el-date-picker
              v-if="activePrototype == 'history'"
              v-model="historydate"
              style="position: absolute; right: 16px; top: 70px; height: 30px"
              type="daterange"
              unlink-panels
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
            />
          </div>
        </el-row>
      </div>
    </div>
    <usersDialog ref="usersdialog" />
  </div>
</template>

<style lang="scss" scoped>
:deep() {
  .el-dialog__header {
    text-align: left;
  }

  .el-dialog__headerbtn .el-dialog__close {
    font-size: 20px;
  }

  .el-dialog {
    border-radius: 6px;
  }

  .el-dialog--center .el-dialog__body {
    padding: 15px;
    padding-top: 0px;
  }

  .el-dialog__footer {
    margin-left: 0 !important;
    width: 100%;
    display: flex;
    justify-content: center;
  }
}

.public-secondHead {
  line-height: 30px;
}
</style>
