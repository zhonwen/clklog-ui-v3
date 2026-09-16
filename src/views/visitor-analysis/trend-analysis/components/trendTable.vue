<script setup lang="ts">
/**
 * 趋势分析-明细表（v2 views/visitor-analysis/trend-analysis/components/trendTable.vue）。
 * 父组件通过 ref 调 apiDetailList(data, commonParams, dateFlag)。
 */
import { computed, nextTick, ref } from 'vue'
import type { CSSProperties } from 'vue'
import flowPoint from '@/components/flowPoint/index.vue'
import { percentage, averageRules, averageRulesTable } from '@/utils/percent'
import { formatTime } from '@/utils/format'
import { formatDateToday } from '@/utils/date'
import { copyObj } from '@/utils/copy'

interface TrendRow {
  statTime?: string | number
  dateTime?: string
  pv?: number
  pvRate?: number
  visitCount?: number
  uv?: number
  newUv?: number
  newUvRate?: number
  ipCount?: number
  avgPv?: number
  avgVisitTime?: number
  bounceRate?: number
  children?: TrendRow
  [key: string]: unknown
}

/** 对比模式下接口返回的是数组，父组件又往数组上挂了一个 dateTime 属性 */
type TrendArray = TrendRow[] & { dateTime?: string }

/** 复刻 v2 src/filters/index.js 的 percenTable 过滤器（falsy 返回 0，不是 '--'） */
function percenTableFilter(s: unknown): string | number {
  if (s == 1) return '100%'
  if (s) return (Number(s) * 100).toFixed(2) + '%'
  return 0
}

/**
 * 复刻 v2 src/filters/index.js 的 formatTimeTable 过滤器：
 * Math.floor + 时分秒拼装，falsy 返回 0（不是 '--'）。
 */
function formatTimeTableFilter(seconds: unknown): string | number {
  if (seconds) {
    const total = Math.floor(Number(seconds))
    const hours = Math.floor(total / 3600)
    const minutes = Math.floor((total - hours * 3600) / 60)
    const rest = total - hours * 3600 - minutes * 60
    const pad = (n: number) => (n < 10 ? `0${n}` : String(n))
    return `${pad(hours)}:${pad(minutes)}:${pad(rest)}`
  }
  return 0
}

const emit = defineEmits<{
  (e: 'currentPage'): void
}>()

const flowTableList = ref<TrendRow[]>([])
const pv = ref(false)
const visitCount = ref(false)
const newUv = ref(false)
const uv = ref(false)
const ipCount = ref(false)
const avgPv = ref(false)
const avgVisitTime = ref(false)
const bounceRate = ref(false)
const pvRate = ref(false)
const newUvRate = ref(false)

const currentPage = ref(1)
const total = ref(0)
// 与 v2 一致：不对比时每页默认 30 条，对比时默认 10 条
const pageSize = ref(30)
// 分页2
const currentPageY = ref(1)
const totalY = ref(0)
const pageSizeY = ref(10)

const timeType = ref<string | null>(null)
const current = ref<{ sortName: string | null; sortOrder: string | null }>({
  sortName: '',
  sortOrder: '',
})
const dateFlag = ref<number | null>(null)
const constrastTableList = ref<TrendRow[]>([])

// 模板里不重复调用 slice，预算成 computed
const pagedFlowTableList = computed(() =>
  flowTableList.value.slice(
    (currentPage.value - 1) * pageSize.value,
    currentPage.value * pageSize.value,
  ),
)
const pagedConstrastTableList = computed(() =>
  constrastTableList.value.slice(
    (currentPageY.value - 1) * pageSizeY.value,
    currentPageY.value * pageSizeY.value,
  ),
)

function changeRateEvent(x: unknown, y: unknown) {
  if (x || y) {
    const a = ((Number(y) - Number(x)) / (Number(x) || 1)).toFixed(4)
    return (Number(a) * 100).toFixed(2)
  } else {
    return 0
  }
}

function tableHeaderColor({ columnIndex }: { columnIndex: number }): CSSProperties {
  // 回调必须返回对象，element-plus 会对返回值做 Object.assign，返回字符串会炸
  if (columnIndex === 0) {
    return { textAlign: 'left' }
  } else {
    return { textAlign: 'center' }
  }
}

function ascDscEvent() {
  const nameAttr = current.value.sortName
  if (nameAttr && current.value.sortOrder === 'ascending') {
    flowTableList.value = flowTableList.value.sort(function (a, b) {
      return Number(a[nameAttr]) - Number(b[nameAttr])
    })
  } else if (nameAttr && current.value.sortOrder === 'descending') {
    flowTableList.value = flowTableList.value.sort(function (a, b) {
      return Number(b[nameAttr]) - Number(a[nameAttr])
    })
  }
}

// 处理 table 接口对比事件
function apiDetailList(val: unknown, commonParams: Record<string, unknown>, flag?: number | null) {
  dateFlag.value = flag ?? null
  timeType.value = String(commonParams.timeType ?? '')
  const time = commonParams.timeType
  if (flag) {
    const list = val as TrendArray[]
    const listZero = list[0]
    const listOne = list[1]
    if (!listZero || !listOne) return
    if (listZero.length > listOne.length) {
      listOne.push({ statTime: 0, pv: 0, uv: 0, visitCount: 0, ipCount: 0, bounceRate: 0 })
    } else if (listZero.length < listOne.length) {
      listZero.push({ statTime: 0, pv: 0, uv: 0, visitCount: 0, ipCount: 0, bounceRate: 0 })
    }
    const dateTime = (listZero.dateTime ?? '').split('~')
    const dateTime2 = (listOne.dateTime ?? '').split('~')
    const a = new Date(dateTime[0] ?? '').getTime()
    const b = new Date(dateTime2[0] ?? '').getTime()
    let ordered = list
    if (a >= b) {
      ordered = list.slice().reverse()
    }
    const first = ordered[0]
    const second = ordered[1]
    if (!first || !second) return
    for (let i = 0; i < first.length; i++) {
      for (let j = 0; j < second.length; j++) {
        if (i == j) {
          const row = first[i]
          const child = second[j]
          if (row && child) row.children = child
        }
      }
    }
    constrastTableList.value = copyObj(first as TrendRow[]).reverse()
    totalY.value = constrastTableList.value.length
  } else {
    currentPage.value = 1
    void nextTick(() => {
      const rows = (val as TrendRow[]) || []
      const toDateTime = formatDateToday()

      if (
        time == 'hour' &&
        commonParams.endTime == commonParams.startTime &&
        commonParams.startTime == toDateTime
      ) {
        // 与 v2 一致（v2 此处逻辑存疑：原本按当前小时截断的那段已被注释掉，
        // 这个分支和 else 分支的结果一样，都是倒序整份数据）
        const newArray = copyObj(rows).reverse()
        flowTableList.value = newArray
      } else {
        flowTableList.value = rows.reverse()
      }
      if (current.value.sortName && current.value.sortName == 'statTime') {
        if (current.value.sortOrder == 'descending') {
          flowTableList.value = flowTableList.value.reverse()
        }
      }
      total.value = flowTableList.value.length

      ascDscEvent()
    })
  }
}

function avgTimeEvent(val: unknown) {
  return formatTime(Math.floor(Number(val)))
}

function sortChange(e: { prop?: string | null; order?: string | null }) {
  if (e.order && e.order == 'ascending') {
    // 降序
    current.value.sortName = e.prop ?? null
    current.value.sortOrder = 'ascending'
  } else if (e.order && e.order == 'descending') {
    // 升序
    current.value.sortName = e.prop ?? null
    current.value.sortOrder = 'descending'
  } else {
    current.value.sortName = null
    current.value.sortOrder = null
    emit('currentPage')
  }
  if (current.value.sortName == 'statTime') {
    emit('currentPage')
  }
  ascDscEvent()
}

function flowPointEvent(val: string[]) {
  if (val.length > 0) {
    pv.value = val.includes('pv')
    visitCount.value = val.includes('visitCount')
    newUv.value = val.includes('newUv')
    uv.value = val.includes('uv')
    ipCount.value = val.includes('ipCount')
    avgPv.value = val.includes('avgPv')
    avgVisitTime.value = val.includes('avgVisitTime')
    bounceRate.value = val.includes('bounceRate')
    pvRate.value = val.includes('pvRate')
    newUvRate.value = val.includes('newUvRate')
  }
}

function averageRulesEvent(num: number | undefined) {
  return averageRules(num)
}

function percentageFun(val: unknown) {
  if (val == 0) {
    return 0
  } else {
    return percentage(val as number)
  }
}

function handleSizeChange(val: number) {
  currentPage.value = 1
  pageSize.value = val
}

function handleCurrentChange(val: number) {
  currentPage.value = val
}

function handleSizeChangeY(val: number) {
  currentPageY.value = 1
  pageSizeY.value = val
}

function handleCurrentChangeY(val: number) {
  currentPageY.value = val
}

defineExpose({ apiDetailList })
</script>

<template>
  <div class="chartsIcon public-table-block public-hoverItem">
    <div class="public-firstHead">趋势分析</div>
    <flowPoint @flow-point="flowPointEvent" />
    <div>
      <div v-show="!dateFlag" class="public-Table-minHeight">
        <el-table
          class="public-radius"
          :header-cell-style="{ textAlign: 'center', background: '#f7fafe ' }"
          :cell-style="{ textAlign: 'center' }"
          :data="pagedFlowTableList"
          border
          style="width: 100%"
          @sort-change="sortChange($event)"
        >
          <el-table-column label="时间" sortable="custom" prop="statTime">
            <template #default="scope">
              <div style="display: flex; justify-content: center">
                {{ scope.row.statTime }}
                <div v-if="scope.row.statTime">
                  {{ timeType == 'hour' ? '时' : '' }}
                </div>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="date" label="流量基础指标" width="150">
            <el-table-column v-if="pv" prop="pv" label="浏览量" sortable="custom" />
            <el-table-column v-if="pvRate" prop="pvRate" label="浏览量占比" sortable="custom">
              <template #default="scope">
                {{ percentageFun(scope.row.pvRate) }}
              </template>
            </el-table-column>
            <el-table-column
              v-if="visitCount"
              prop="visitCount"
              label="访问次数"
              sortable="custom"
            />
            <el-table-column v-if="uv" prop="uv" label="访客数" sortable="custom" />
            <el-table-column v-if="newUv" prop="newUv" label="新访客数" sortable="custom" />
            <el-table-column
              v-if="newUvRate"
              prop="newUvRate"
              label="新访客数占比"
              sortable="custom"
            >
              <template #default="scope">
                {{ percentageFun(scope.row.newUvRate) }}
              </template>
            </el-table-column>

            <el-table-column v-if="ipCount" prop="ipCount" label="IP数" sortable="custom" />
          </el-table-column>
          <el-table-column prop="date" label="流量质量指标" width="150">
            <el-table-column
              v-if="bounceRate"
              prop="bounceRate"
              label="跳出率"
              sortable="custom"
            >
              <template #default="scope">
                {{ percentageFun(scope.row.bounceRate) }}
              </template>
            </el-table-column>
            <el-table-column
              v-if="avgVisitTime"
              label="平均访问时长"
              sortable="custom"
              prop="avgVisitTime"
            >
              <template #default="scope">
                {{ avgTimeEvent(scope.row.avgVisitTime) }}
              </template>
            </el-table-column>
            <el-table-column v-if="avgPv" prop="avgPv" label="平均访问页数" sortable="custom">
              <template #default="scope">
                {{ averageRulesEvent(scope.row.avgPv) }}
              </template>
            </el-table-column>
          </el-table-column>
        </el-table>
      </div>
      <!-- 对比状态 -->
      <div v-show="dateFlag" class="public-Table-minHeight">
        <el-table
          class="public-radius"
          :header-cell-style="{ textAlign: 'center', background: '#f7fafe ' }"
          :cell-style="tableHeaderColor"
          :data="pagedConstrastTableList"
          border
          style="width: 100%"
          @sort-change="sortChange($event)"
        >
          <el-table-column label="时间" width="300px">
            <template #default="scope">
              <div v-if="timeType == 'hour'">
                <div class="setSpace" style="display: flex">
                  {{ scope.row.dateTime }}
                  <div style="margin-left: 15px">
                    {{ scope.row.statTime || 0 }}
                    {{ timeType == 'hour' ? '时' : '' }}
                  </div>
                </div>
                <div class="setSpace" style="display: flex">
                  {{ scope.row.children.dateTime }}
                  <div style="margin-left: 15px">
                    {{ scope.row.statTime || 0 }}
                    {{ timeType == 'hour' ? '时' : '' }}
                  </div>
                </div>
                <div class="setSpace" style="margin-bottom: 0">变化率</div>
              </div>
              <div v-else>
                <div class="setSpace">
                  {{ scope.row.statTime || 0 }}
                  {{ timeType == 'hour' ? '时' : '' }}
                </div>
                <div class="setSpace">
                  {{ scope.row.children.statTime || 0 }}
                  {{ timeType == 'hour' ? '时' : '' }}
                </div>
                <div class="setSpace" style="margin-bottom: 0">变化率</div>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="date" label="流量基础指标">
            <el-table-column v-if="pv" label="浏览量">
              <template #default="scope">
                <div class="setBody setTr">{{ scope.row.pv || 0 }}</div>
                <div class="setBody">{{ scope.row.children.pv || 0 }}</div>
                <div class="setBody">
                  {{ changeRateEvent(scope.row.pv, scope.row.children.pv) }}%
                </div>
              </template>
            </el-table-column>
            <el-table-column v-if="pvRate" prop="pvRate" label="浏览量占比">
              <template #default="scope">
                <div class="setBody setTr">
                  {{ percenTableFilter(scope.row.pvRate) }}
                </div>
                <div class="setBody">
                  {{ percenTableFilter(scope.row.children.pvRate) }}
                </div>
                <div class="setBody">
                  {{ changeRateEvent(scope.row.pvRate, scope.row.children.pvRate) }}%
                </div>
              </template>
            </el-table-column>
            <el-table-column v-if="visitCount" prop="visitCount" label="访问次数">
              <template #default="scope">
                <div class="setBody setTr">{{ scope.row.visitCount }}</div>
                <div class="setBody">{{ scope.row.children.visitCount }}</div>
                <div class="setBody">
                  {{ changeRateEvent(scope.row.visitCount, scope.row.children.visitCount) }}%
                </div>
              </template>
            </el-table-column>
            <el-table-column v-if="uv" prop="uv" label="访客数">
              <template #default="scope">
                <div class="setBody setTr">{{ scope.row.uv }}</div>
                <div class="setBody">{{ scope.row.children.uv }}</div>
                <div class="setBody">
                  {{ changeRateEvent(scope.row.uv, scope.row.children.uv) }}%
                </div>
              </template>
            </el-table-column>
            <el-table-column v-if="newUv" prop="newUv" label="新访客数">
              <template #default="scope">
                <div class="setBody setTr">{{ scope.row.newUv }}</div>
                <div class="setBody">{{ scope.row.children.newUv }}</div>
                <div class="setBody">
                  {{ changeRateEvent(scope.row.newUv, scope.row.children.newUv) }}%
                </div>
              </template>
            </el-table-column>
            <el-table-column v-if="newUvRate" prop="newUvRate" label="新访客数占比">
              <template #default="scope">
                <div class="setBody setTr">
                  {{ percenTableFilter(scope.row.newUvRate) }}
                </div>
                <div class="setBody">
                  {{ percenTableFilter(scope.row.children.newUvRate) }}
                </div>
                <div class="setBody">
                  {{ changeRateEvent(scope.row.newUvRate, scope.row.children.newUvRate) }}%
                </div>
              </template>
            </el-table-column>

            <el-table-column v-if="ipCount" prop="ipCount" label="IP数">
              <template #default="scope">
                <div class="setBody setTr">{{ scope.row.ipCount }}</div>
                <div class="setBody">{{ scope.row.children.ipCount }}</div>
                <div class="setBody">
                  {{ changeRateEvent(scope.row.ipCount, scope.row.children.ipCount) }}%
                </div>
              </template>
            </el-table-column>
          </el-table-column>
          <el-table-column prop="date" label="流量质量指标">
            <el-table-column v-if="bounceRate" prop="bounceRate" label="跳出率">
              <template #default="scope">
                <div class="setBody setTr">
                  {{ percenTableFilter(scope.row.bounceRate) }}
                </div>
                <div class="setBody">
                  {{ percenTableFilter(scope.row.children.bounceRate) }}
                </div>
                <div class="setBody">
                  {{ changeRateEvent(scope.row.bounceRate, scope.row.children.bounceRate) }}%
                </div>
              </template>
            </el-table-column>
            <el-table-column v-if="avgVisitTime" label="平均访问时长" prop="avgVisitTime">
              <template #default="scope">
                <div class="setBody setTr">
                  {{ formatTimeTableFilter(scope.row.avgVisitTime) }}
                </div>
                <div class="setBody">
                  {{ formatTimeTableFilter(scope.row.children.avgVisitTime) }}
                </div>
                <div class="setBody">
                  {{
                    changeRateEvent(scope.row.avgVisitTime, scope.row.children.avgVisitTime)
                  }}%
                </div>
              </template>
            </el-table-column>
            <el-table-column v-if="avgPv" label="平均访问页数">
              <template #default="scope">
                <div class="setBody setTr">
                  {{ averageRulesTable(scope.row.avgPv) }}
                </div>
                <div class="setBody">
                  {{ averageRulesTable(scope.row.children.avgPv) }}
                </div>
                <div class="setBody">
                  {{ changeRateEvent(scope.row.avgPv, scope.row.children.avgPv) }}%
                </div>
              </template>
            </el-table-column>
          </el-table-column>
        </el-table>
      </div>
    </div>
    <div v-if="!dateFlag" class="block">
      <el-pagination
        next-text="下一页"
        :current-page="currentPage"
        :page-sizes="[10, 20, 30, 40]"
        :page-size="pageSize"
        layout="total, sizes, prev, pager, next, jumper"
        :total="total"
        @size-change="handleSizeChange"
        @current-change="handleCurrentChange"
      />
    </div>
    <div v-if="dateFlag" class="block">
      <el-pagination
        next-text="下一页"
        :current-page="currentPageY"
        :page-sizes="[10, 20, 30, 40]"
        :page-size="pageSizeY"
        layout="total, sizes, prev, pager, next, jumper"
        :total="totalY"
        @size-change="handleSizeChangeY"
        @current-change="handleCurrentChangeY"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
// v2 这里是 ::v-deep { @import el-checkbox.scss; @import el-pagination.scss }
// el-checkbox.scss 在 v3 里每条规则已写成 :deep(...)，只能在 scoped 块顶部 @use；
// el-pagination.scss 已全局引入，不再重复
@use '@/styles/components/el-checkbox.scss';

.setSpace {
  margin-bottom: 8px;
  margin-left: 25px;
}

.setBody {
  margin-bottom: 8px;
}
</style>
