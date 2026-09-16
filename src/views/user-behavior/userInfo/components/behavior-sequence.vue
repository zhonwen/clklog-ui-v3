<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ArrowDown,
  ArrowRight,
  CaretBottom,
  CaretTop,
  Close,
  Loading,
} from '@element-plus/icons-vue'
import SeqFilters from './seq-filters.vue'
import {
  getEventNeighboursApi,
  pageGetUserEventDatesApi,
  pageGetUserEventsByDateGroupedApi,
} from '@/api/trackingapi/userreview'
import { copyObj } from '@/utils/copy'
import { queryToString } from '@/utils/index'
import { useLatestOnly } from '@/composables/useLatestOnly'
import type {
  EventGroup,
  PropertyItem,
  RawSeqEvent,
  SeqDatesPayload,
  SeqDay,
  SeqEvent,
  SeqEventMeta,
  SeqFilterParams,
  SeqFilterValue,
  SeqGroupedPayload,
  SeqHourGroup,
  SeqNeighboursPayload,
  SequenceCache,
  SequenceQueryParams,
} from '../types'

const props = withDefaults(
  defineProps<{
    projectName?: string | null
    userId?: string | null
    cacheData?: SequenceCache | null
  }>(),
  { projectName: null, userId: null, cacheData: null },
)

const emit = defineEmits<{ (e: 'update-cache', state: SequenceCache): void }>()

const route = useRoute()

/**
 * 日期列表接一套 useLatestOnly：筛选条一变就重发，谁后回来谁写入。
 *
 * 另外三处取数（单日事件、上下文前后翻页）没有接，只接了下面的 alive：
 * 它们本来就带自己的「谁是最新」判据——单日事件靠 dayRequestPromises + dayQueueToken 去重，
 * 上下文靠 logId 比对，而且上下文的「加载更多」是要把多次结果合并到一起的，
 * 套 latest-only 会把先发出的那次结果丢掉，改掉 v2 的行为。
 * alive 只负责「组件卸载后不要再回写」这一半。
 */
const { next: nextSeqDates, isLatest: isLatestSeqDates } = useLatestOnly()
let alive = true

const sequenceLoading = ref(false)
const queryParams = ref<SequenceQueryParams>({
  projectName: props.projectName || queryToString(route.query.projectName),
  userId: props.userId || queryToString(route.query.userId),
  startDate: '',
  endDate: '',
  dimension: 'day',
  events: [],
  keyWord: '',
  pageNum: 1,
  pageSize: 5,
  sortOrder: 'desc',
})
const seqFilter = ref<SeqFilterValue>({
  dateMode: 'latest',
  rangeTime: null,
  events: [],
  keyWord: '',
})
const seqDays = ref<SeqDay[]>([])
const expandedDays = ref<Record<string, boolean>>({})
const expandedHours = ref<Record<string, boolean>>({})
const selectedEvent = ref<SeqEvent | null>(null)
const contextAnchorEvent = ref<SeqEvent | null>(null)
const contextPanelVisible = ref(false)
const seqContextLoading = ref(false)
const seqDetailLoading = ref(false)
const detailDrawerVisible = ref(false)
const detailEvent = ref<SeqEvent | null>(null)
const contextEvents = ref<SeqEvent[]>([])
const contextInitStep = 5
const contextMoreStep = 10
let contextBeforeCursor = -6
let contextAfterCursor = 6
const contextHasMoreBefore = ref(true)
const contextHasMoreAfter = ref(true)
let contextPending = 0
let contextNeighboursProjectName = ''
let contextNeighboursLogId = ''
const seqPage = ref<{ page: number; size: number; total: number }>({ page: 1, size: 5, total: 0 }) // 查询日期分页
const seqOrder = ref('desc')
let isRestoring = false
let restoreTimer: ReturnType<typeof setTimeout> | null = null
const eventOptions = ref<EventGroup[]>([]) // 缓存的事件列表
const eventMeta = ref<SeqEventMeta | null>(null)
let dayQueueRunning = false
let dayQueueToken = 0
let dayQueueDates: string[] = []
// 存的是在途 Promise，不需要响应式
let dayRequestPromises: Record<string, Promise<SeqDay | undefined>> = {}

/* -------------------------------- computed -------------------------------- */

const groupedSeqDays = computed<SeqDay[]>(() =>
  seqDays.value.map((d) => {
    if (d.groups) {
      return d
    }
    return {
      date: d.date,
      total: d.total || d.count || 0,
      groups: [],
      loaded: false,
      loading: !!d.loading,
    }
  }),
)

const pagedSeqDays = computed<SeqDay[]>(() => groupedSeqDays.value)

const hasEventSelection = computed(
  () =>
    (Array.isArray(seqFilter.value.events) && seqFilter.value.events.length > 0) ||
    !!seqFilter.value.keyWord,
)

function hasMoreEvents(day: SeqDay) {
  if (!day.loaded) return false
  const loaded = day.loadedCount || (day.groups || []).reduce((acc, g) => acc + g.events.length, 0)
  return loaded < day.total
}

function isEventActive(ev: SeqEvent) {
  const eventId = ev && ev.id
  if (!eventId) return false
  if (
    contextPanelVisible.value &&
    contextAnchorEvent.value &&
    contextAnchorEvent.value.id === eventId
  ) {
    return true
  }
  if (detailDrawerVisible.value && detailEvent.value && detailEvent.value.id === eventId) {
    return true
  }
  return false
}

/**
 * 模板要用到的派生数据。
 * v2 在模板里反复调用 hasMoreEvents / isEventActive、反复拼 date + '|' + hour，
 * 这里一次算好，数据结构本身不动（只是外面套一层）。
 */
const displayDays = computed(() =>
  pagedSeqDays.value.map((day) => ({
    day,
    date: day.date,
    total: day.total,
    loading: day.loading,
    loadingMore: day.loadingMore,
    expanded: !!expandedDays.value[day.date],
    hasMore: hasMoreEvents(day),
    groups: (day.groups || []).map((grp) => ({
      hour: grp.hour,
      expanded: !!expandedHours.value[day.date + '|' + grp.hour],
      events: grp.events.map((ev) => ({ ev, active: isEventActive(ev) })),
    })),
  })),
)

/* --------------------------------- 属性显示名 --------------------------------- */

function findPropertyInfoByName(list: PropertyItem[] | undefined, name: string) {
  if (!Array.isArray(list) || !name) return null
  return list.find((item) => item && item.name === name) || null
}

function getEventPropertiesByEventName(eventName: string | null | undefined): PropertyItem[] {
  if (!eventName) return []
  const meta = eventMeta.value || ({} as SeqEventMeta)
  const groups = Array.isArray(meta.events) ? meta.events : []
  for (let i = 0; i < groups.length; i += 1) {
    const group = groups[i]
    const events = group && Array.isArray(group.events) ? group.events : []
    const match = events.find((ev) => ev && ev.name === eventName)
    if (match && Array.isArray(match.propertyList)) {
      return match.propertyList
    }
  }
  const fallbackGroups = Array.isArray(eventOptions.value) ? eventOptions.value : []
  for (let i = 0; i < fallbackGroups.length; i += 1) {
    const group = fallbackGroups[i]
    const events = group && Array.isArray(group.events) ? group.events : []
    const match = events.find((ev) => ev && ev.name === eventName)
    if (match && Array.isArray(match.propertyList)) {
      return match.propertyList
    }
  }
  return []
}

function formatPropertyLabel(info: PropertyItem | null) {
  const name = info && info.name ? info.name : ''
  const displayName = info && info.displayName ? info.displayName : ''
  if (displayName && name)
    return `<div>${displayName}</div><div style="font-size: 14px; color: #7b7a7b;">${name}</div>`
  if (displayName) return displayName
  return name || ''
}

function getDetailLabel(key: string) {
  if (!key) return ''
  const meta = eventMeta.value || ({} as SeqEventMeta)
  const commonList = [
    ...(Array.isArray(meta.commonProperties) ? meta.commonProperties : []),
    ...(Array.isArray(meta.commonPresetProperties) ? meta.commonPresetProperties : []),
  ]
  const fromCommon = findPropertyInfoByName(commonList, key)
  if (fromCommon) {
    return formatPropertyLabel(fromCommon)
  }
  const eventName = detailEvent.value && detailEvent.value.eventName
  const eventProps = getEventPropertiesByEventName(eventName)
  const fromEvent = findPropertyInfoByName(eventProps, key)
  if (fromEvent) {
    return formatPropertyLabel(fromEvent)
  }
  return key
}

/** 抽屉里的事件属性行：v2 在模板里 v-for 对象再调 getDetailLabel，这里一次算好 */
const detailRows = computed(() => {
  const ev = detailEvent.value
  if (!ev) return []
  return Object.entries(ev.details || {}).map(([key, value]) => ({
    key,
    label: getDetailLabel(key),
    value,
  }))
})

/* --------------------------------- 数据加载 --------------------------------- */

function getHotPropValues(hotProp: string | unknown[] | undefined) {
  try {
    const parsed = typeof hotProp === 'string' ? JSON.parse(hotProp) : hotProp
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => {
          if (item && (item as { value?: unknown }).value !== undefined) {
            const value = String((item as { value?: unknown }).value)
            // return value.length > 80 ? value.slice(0, 80) + "..." : value;
            return value
          }
          return null
        })
        .filter(Boolean)
        .join('，')
    }
  } catch {
    // Ignore parsing errors
  }
  return ''
}

function formatEvent(ev: RawSeqEvent, date: string | undefined, hour: string | undefined): SeqEvent {
  const fullTime = ev.logTime || ''
  const timeStr = fullTime.includes(' ') ? fullTime.split(' ')[1] || '' : hour || ''

  let detailsObj: Record<string, unknown> = {}
  const prop = ev.eventProp
  if (prop) {
    try {
      detailsObj = typeof prop === 'string' ? JSON.parse(prop) : prop
    } catch {
      detailsObj = { raw: prop }
    }
  }
  const hotPropText = getHotPropValues(ev.hotProp)
  return {
    id: ev.logId || null,
    date: date || '',
    hour: hour || '',
    name: ev.eventDisplayName || '',
    eventName: ev.eventName || '',
    time: timeStr,
    fullTime: ev.logTime,
    details: detailsObj,
    original: ev,
    hotProp: getHotPropValues(ev.hotProp),
    hotPropText,
  }
}

function loadDayEvents(dayDate: string, isLoadMore = false): Promise<SeqDay | undefined> {
  const dayIndex = seqDays.value.findIndex((d) => d.date === dayDate)
  if (dayIndex === -1) return Promise.reject(new Error('Day not found'))
  const existingPromise = dayRequestPromises[dayDate]
  if (!isLoadMore && existingPromise) {
    return existingPromise
  }
  const dayAtIndex = seqDays.value[dayIndex]
  if (!dayAtIndex) return Promise.reject(new Error('Day not found'))
  if (!isLoadMore && dayAtIndex.groups) {
    return Promise.resolve(dayAtIndex)
  }
  if (isLoadMore && dayAtIndex.loadingMore) {
    return Promise.resolve(dayAtIndex)
  }
  if (isLoadMore) {
    dayAtIndex.loadingMore = true
  } else {
    dayAtIndex.loading = true
  }
  const currentDay = dayAtIndex
  const pageNum = isLoadMore ? (currentDay.pageNum || 1) + 1 : 1
  const pageSize = 20 //日期维度下，每页最多50条数据

  const params = {
    ...queryParams.value,
    startDate: dayDate,
    endDate: dayDate,
    dimension: 'day',
    pageNum: pageNum,
    pageSize: pageSize,
    sortOrder: seqOrder.value,
  }
  const requestPromise = pageGetUserEventsByDateGroupedApi(params)
    .then((res) => {
      if (!alive) return undefined
      if (res?.code === 200) {
        const data = (res.data as SeqGroupedPayload) || {}
        const hours = data.hours || []

        const newGroups: SeqHourGroup[] = hours.map((h) => ({
          hour: h.hourDisplay || h.hour || '',
          events: (h.events || []).map((ev) => formatEvent(ev, dayDate, h.hour)),
        }))

        // Merge logic
        let mergedGroups: SeqHourGroup[] = []
        if (isLoadMore && currentDay.groups) {
          mergedGroups = [...currentDay.groups]
          newGroups.forEach((ng) => {
            const existingGroup = mergedGroups.find((g) => g.hour === ng.hour)
            if (existingGroup) {
              existingGroup.events.push(...ng.events)
            } else {
              mergedGroups.push(ng)
            }
          })
        } else {
          mergedGroups = newGroups
        }

        const totalEvents = data.total || currentDay.total
        const updatedDay: SeqDay = {
          ...currentDay,
          groups: mergedGroups,
          loaded: true,
          loading: false,
          loadingMore: false,
          pageNum: pageNum,
          pageSize: pageSize,
          total: totalEvents,
        }

        // Re-calculate total loaded count based on merged groups
        const currentLoadedCount = mergedGroups.reduce((acc, g) => acc + g.events.length, 0)
        updatedDay.loadedCount = currentLoadedCount

        seqDays.value[dayIndex] = updatedDay

        return updatedDay
      }
      return undefined
    })
    .finally(() => {
      if (!alive) return
      const d = seqDays.value[dayIndex]
      if (d) {
        d.loading = false
        d.loadingMore = false
      }
      if (!isLoadMore) {
        delete dayRequestPromises[dayDate]
      }
    })
  if (!isLoadMore) {
    dayRequestPromises[dayDate] = requestPromise
  }
  return requestPromise
}

function loadMoreEvents(dayDate: string) {
  return loadDayEvents(dayDate, true).then((updatedDay) => {
    if (!updatedDay) return updatedDay
    expandedDays.value[dayDate] = true
    if (Array.isArray(updatedDay.groups)) {
      updatedDay.groups.forEach((grp) => {
        const key = dayDate + '|' + grp.hour
        expandedHours.value[key] = true
      })
    }
    return updatedDay
  })
}

function ensureFirstSelection() {
  const firstDay = seqDays.value[0]
  if (firstDay) {
    loadDayEvents(firstDay.date).then(() => {
      expandedDays.value[firstDay.date] = true
      const updatedFirstDay = seqDays.value[0]
      if (updatedFirstDay && updatedFirstDay.groups && updatedFirstDay.groups.length > 0) {
        updatedFirstDay.groups.forEach((grp) => {
          const key = updatedFirstDay.date + '|' + grp.hour
          expandedHours.value[key] = true
        })
      }
    })
  } else {
    selectedEvent.value = null
  }
}

function resetDayQueue() {
  dayQueueToken += 1
  dayQueueRunning = false
  dayQueueDates = []
  dayRequestPromises = {}
}

function isDayQueued(date: string) {
  return dayQueueRunning && dayQueueDates.includes(date)
}

function startDayQueueLoad(): Promise<void> {
  const dates = (seqDays.value || []).map((d) => d && d.date).filter(Boolean)
  if (!dates.length) return Promise.resolve()
  const token = dayQueueToken + 1
  dayQueueToken = token
  dayQueueRunning = true
  dayQueueDates = dates

  const runNext = (index: number): Promise<void> => {
    if (token !== dayQueueToken) return Promise.resolve()
    if (index >= dates.length) return Promise.resolve()
    const date = dates[index]
    if (!date) return runNext(index + 1)
    const day = seqDays.value.find((d) => d && d.date === date)
    if (!day || day.loaded || day.groups) {
      expandedDays.value[date] = true
      const updatedDay = seqDays.value.find((item) => item.date === date)
      if (updatedDay && Array.isArray(updatedDay.groups)) {
        updatedDay.groups.forEach((grp) => {
          const key = date + '|' + grp.hour
          expandedHours.value[key] = true
        })
      }
      //关闭加载完不展开1
      return runNext(index + 1)
    }
    //关闭加载完不展开2
    //  return this.loadDayEvents(date).finally(() => runNext(index + 1));
    return loadDayEvents(date)
      .then(() => {
        expandedDays.value[date] = true
        const updatedDay = seqDays.value.find((item) => item.date === date)
        if (updatedDay && Array.isArray(updatedDay.groups)) {
          updatedDay.groups.forEach((grp) => {
            const key = date + '|' + grp.hour
            expandedHours.value[key] = true
          })
        }
      })
      .finally(() => runNext(index + 1))
  }

  return runNext(0).finally(() => {
    if (token !== dayQueueToken) return
    dayQueueRunning = false
    dayQueueDates = []
  })
}

function initSeqSelection() {
  expandedDays.value = {} // Reset expansions
  expandedHours.value = {}
  selectedEvent.value = null
  // 关闭上下文面板
  contextPanelVisible.value = false
  contextAnchorEvent.value = null
  resetDayQueue()
  sequenceLoading.value = true
  const params = {
    ...queryParams.value,
    pageNum: seqPage.value.page,
    pageSize: seqPage.value.size,
    sortOrder: seqOrder.value,
  }

  const token = nextSeqDates()
  pageGetUserEventDatesApi(params)
    .then((res) => {
      if (!isLatestSeqDates(token)) return
      if (res?.code == 200) {
        const payload = (res.data as SeqDatesPayload) || {}
        seqDays.value = Array.isArray(payload.rows) ? payload.rows : []
        seqPage.value.total = payload.total || 0

        nextTick(() => {
          startDayQueueLoad()
          ensureFirstSelection()
        })
      }
    })
    .finally(() => {
      if (!isLatestSeqDates(token)) return
      sequenceLoading.value = false
      seqContextLoading.value = false
    })
}

function setTopFilterParams(params: SeqFilterParams) {
  if (!props.userId || !props.projectName) {
    seqFilter.value = {
      dateMode: 'latest',
      rangeTime: null,
      events: [],
      keyWord: '',
    }
    seqDays.value = []
    expandedDays.value = {} // Reset expansions
    expandedHours.value = {}
    selectedEvent.value = null
    contextPanelVisible.value = false
    contextAnchorEvent.value = null
    return
  }
  if (isRestoring) return
  queryParams.value.pageNum = 1
  seqPage.value.page = 1
  queryParams.value.startDate = params.rangeTime ? params.rangeTime[0] || '' : ''
  queryParams.value.endDate = params.rangeTime ? params.rangeTime[1] || '' : ''
  queryParams.value.events = params.events
  queryParams.value.keyWord = params.keyWord || ''
  // 关闭上下文面板
  contextPanelVisible.value = false
  contextAnchorEvent.value = null
  nextTick(() => {
    initSeqSelection()
  })
}

function toggleSeqOrder() {
  seqOrder.value = seqOrder.value === 'desc' ? 'asc' : 'desc'
  initSeqSelection()
}

function toggleDay(d: string) {
  // d is the date string
  const isExpanding = !expandedDays.value[d]

  if (isExpanding) {
    // Check if we need to load data
    const day = seqDays.value.find((item) => item.date === d)
    if (day && !day.groups && !day.loaded) {
      if (isDayQueued(d)) {
        expandedDays.value[d] = true
        return
      }
      loadDayEvents(d).then(() => {
        expandedDays.value[d] = true
        const updatedDay = seqDays.value.find((item) => item.date === d)
        if (updatedDay && Array.isArray(updatedDay.groups)) {
          updatedDay.groups.forEach((grp) => {
            const key = d + '|' + grp.hour
            expandedHours.value[key] = true
          })
        }
      })
      return
    }
    if (day && Array.isArray(day.groups)) {
      day.groups.forEach((grp) => {
        const key = d + '|' + grp.hour
        expandedHours.value[key] = true
      })
    }
  }
  expandedDays.value[d] = isExpanding
}

function toggleHour(date: string, hour: string) {
  const key = date + '|' + hour
  expandedHours.value[key] = !expandedHours.value[key]
}

function selectEvent(ev: SeqEvent | null) {
  selectedEvent.value = ev
}

/* --------------------------------- 上下文 --------------------------------- */

function mergeUniqueFront(events: SeqEvent[]) {
  const seen = new Set((contextEvents.value || []).map((e) => e && e.id).filter(Boolean))
  const toAdd: SeqEvent[] = []
  ;(events || []).forEach((e) => {
    if (!e || !e.id || seen.has(e.id)) return
    seen.add(e.id)
    toAdd.push(e)
  })
  if (toAdd.length) contextEvents.value = [...toAdd, ...(contextEvents.value || [])]
}

function mergeUniqueBack(events: SeqEvent[]) {
  const seen = new Set((contextEvents.value || []).map((e) => e && e.id).filter(Boolean))
  const toAdd: SeqEvent[] = []
  ;(events || []).forEach((e) => {
    if (!e || !e.id || seen.has(e.id)) return
    seen.add(e.id)
    toAdd.push(e)
  })
  if (toAdd.length) contextEvents.value = [...(contextEvents.value || []), ...toAdd]
}

function normalizeContextEvents() {
  const anchor = contextAnchorEvent.value
  const selectedId = anchor && anchor.id
  if (!selectedId || !anchor) return
  const idx = (contextEvents.value || []).findIndex((e) => e && e.id === selectedId)
  if (idx < 0) return
  const before = (contextEvents.value || []).slice(0, idx).filter(Boolean)
  const after = (contextEvents.value || []).slice(idx + 1).filter(Boolean)
  before.sort((a, b) => String(a.fullTime || '').localeCompare(String(b.fullTime || '')))
  after.sort((a, b) => String(a.fullTime || '').localeCompare(String(b.fullTime || '')))
  contextEvents.value = [...before, anchor, ...after]
}

function loadMoreContextBefore() {
  if (!contextAnchorEvent.value || !contextHasMoreBefore.value) return
  const ceiling = contextBeforeCursor
  const floor = ceiling - contextMoreStep + 1
  const projectName = contextNeighboursProjectName
  const logId = contextNeighboursLogId
  contextPending += 1
  seqContextLoading.value = true
  const statDate = contextAnchorEvent.value.date
  getEventNeighboursApi({ projectName, logId, floor, ceiling, statDate })
    .then((res) => {
      if (!alive || logId !== contextNeighboursLogId) return
      if (!res || res.code !== 200) return
      const data = (res.data as SeqNeighboursPayload) || {}
      const raw = Array.isArray(data.eventsBefore) ? data.eventsBefore : []
      const events = raw.map((e) => formatEvent(e, e.date, e.hour))
      if (!events.length) {
        contextHasMoreBefore.value = false
        return
      }
      mergeUniqueFront(events)
      normalizeContextEvents()
      contextBeforeCursor = floor - 1
    })
    .finally(() => {
      if (!alive) return
      contextPending = Math.max(0, contextPending - 1)
      if (contextPending === 0) seqContextLoading.value = false
    })
}

function loadMoreContextAfter() {
  if (!contextAnchorEvent.value || !contextHasMoreAfter.value) return
  const floor = contextAfterCursor
  const ceiling = floor + contextMoreStep - 1
  const projectName = contextNeighboursProjectName
  const logId = contextNeighboursLogId
  contextPending += 1
  seqContextLoading.value = true
  const statDate = contextAnchorEvent.value.date
  getEventNeighboursApi({ projectName, logId, floor, ceiling, statDate })
    .then((res) => {
      if (!alive || logId !== contextNeighboursLogId) return
      if (!res || res.code !== 200) return
      const data = (res.data as SeqNeighboursPayload) || {}
      const raw = Array.isArray(data.eventsAfter) ? data.eventsAfter : []
      const events = raw.map((e) => formatEvent(e, e.date, e.hour))
      if (!events.length) {
        contextHasMoreAfter.value = false
        return
      }
      mergeUniqueBack(events)
      normalizeContextEvents()
      contextAfterCursor = ceiling + 1
    })
    .finally(() => {
      if (!alive) return
      contextPending = Math.max(0, contextPending - 1)
      if (contextPending === 0) seqContextLoading.value = false
    })
}

function loadContextEvents(ev: SeqEvent | null) {
  if (!ev) {
    contextEvents.value = []
    return
  }
  contextEvents.value = []
  const step = contextInitStep
  contextBeforeCursor = -step - 1
  contextAfterCursor = step + 1
  contextHasMoreBefore.value = true
  contextHasMoreAfter.value = true
  contextPending = 0
  seqContextLoading.value = true
  const projectName = contextNeighboursProjectName
  const logId = contextNeighboursLogId
  const floor = -step
  const ceiling = step
  contextPending += 1
  const statDate = contextAnchorEvent.value ? contextAnchorEvent.value.date : ''
  getEventNeighboursApi({ projectName, logId, floor, ceiling, statDate })
    .then((res) => {
      if (!alive || logId !== contextNeighboursLogId) return

      if (!res || res.code !== 200) {
        contextEvents.value = [ev]
        contextHasMoreBefore.value = false
        contextHasMoreAfter.value = false
        return
      }

      const data = (res.data as SeqNeighboursPayload) || {}
      const before = Array.isArray(data.eventsBefore) ? data.eventsBefore : []
      const after = Array.isArray(data.eventsAfter) ? data.eventsAfter : []
      const beforeEvents = before.map((e) => formatEvent(e, e.date, e.hour))
      const afterEvents = after.map((e) => formatEvent(e, e.date, e.hour))
      contextEvents.value = [...beforeEvents, ev, ...afterEvents]
      contextHasMoreBefore.value = beforeEvents.length > 0
      contextHasMoreAfter.value = afterEvents.length > 0
    })
    .catch(() => {
      if (!alive || logId !== contextNeighboursLogId) return
      contextEvents.value = [ev]
      contextHasMoreBefore.value = false
      contextHasMoreAfter.value = false
    })
    .finally(() => {
      if (!alive) return
      contextPending = Math.max(0, contextPending - 1)
      if (contextPending === 0) seqContextLoading.value = false
    })
}

function openContext(ev: SeqEvent) {
  selectedEvent.value = ev
  contextAnchorEvent.value = ev
  contextPanelVisible.value = true

  // 真实ID和projectName ；
  if (ev && ev.id) contextNeighboursLogId = ev.id
  if (queryParams.value && queryParams.value.projectName)
    contextNeighboursProjectName = String(queryParams.value.projectName)
  // 与 v2 一致（v2 此处逻辑存疑：contextFloor / contextCeiling 只赋值、从来没被读过，
  // 实际上下文范围用的是 contextInitStep，这两个字段已去掉）
  loadContextEvents(ev)
}

function openDetail(ev: SeqEvent) {
  selectedEvent.value = ev
  detailEvent.value = ev
  detailDrawerVisible.value = true
  if (
    contextPanelVisible.value &&
    contextAnchorEvent.value &&
    contextAnchorEvent.value.id !== ev.id
  ) {
    contextPanelVisible.value = false
  }
}

function openContextDetail(ev: SeqEvent) {
  selectedEvent.value = ev
  detailEvent.value = ev
  detailDrawerVisible.value = true
}

function closeContextPanel() {
  contextPanelVisible.value = false
  contextAnchorEvent.value = null
  if (!detailDrawerVisible.value) {
    selectedEvent.value = null
  }
}

function closeDetailDrawer() {
  detailDrawerVisible.value = false
  detailEvent.value = null
  if (!contextPanelVisible.value) {
    selectedEvent.value = null
  }
}

/* --------------------------------- 分页 --------------------------------- */

function changeSeqPage(p: number) {
  if (dayQueueRunning) {
    ElMessage.warning('数据加载中，请稍候再尝试翻页操作')
    return
  }
  seqPage.value.page = p
  initSeqSelection()
}

function onSeqSizeChange(size: number) {
  if (dayQueueRunning) {
    ElMessage.warning('数据加载中，请稍候再尝试翻页操作')
    return
  }
  seqPage.value.page = 1
  seqPage.value.size = size
  initSeqSelection()
}

/* -------------------------------- 生命周期 -------------------------------- */

// v2 的 created()
if (props.cacheData) {
  isRestoring = true
  const cache = props.cacheData

  seqFilter.value = cache.seqFilter ? copyObj(cache.seqFilter) : seqFilter.value
  queryParams.value = cache.queryParams ? copyObj(cache.queryParams) : queryParams.value
  seqDays.value = cache.seqDays ? copyObj(cache.seqDays) : []
  seqPage.value = cache.seqPage ? copyObj(cache.seqPage) : seqPage.value
  seqOrder.value = cache.seqOrder
  expandedDays.value = cache.expandedDays || {}
  expandedHours.value = cache.expandedHours || {}
  selectedEvent.value = cache.selectedEvent
  eventOptions.value = cache.eventOptions || []
  eventMeta.value = cache.eventMeta || null

  restoreTimer = setTimeout(() => {
    isRestoring = false
    if (selectedEvent.value) selectEvent(selectedEvent.value)
  }, 500)
}

onBeforeUnmount(() => {
  alive = false
  if (restoreTimer) {
    clearTimeout(restoreTimer)
    restoreTimer = null
  }
  // 队列里还没跑完的那一轮不要再回写已卸载组件的状态
  resetDayQueue()
  emit('update-cache', {
    seqFilter: seqFilter.value,
    queryParams: queryParams.value,
    seqDays: seqDays.value,
    seqPage: seqPage.value,
    seqOrder: seqOrder.value,
    expandedDays: expandedDays.value,
    expandedHours: expandedHours.value,
    selectedEvent: selectedEvent.value,
    eventOptions: eventOptions.value,
    eventMeta: eventMeta.value,
  })
})
</script>

<template>
  <div class="seq-container">
    <seq-filters
      v-model="seqFilter"
      v-model:cached-event-options="eventOptions"
      v-model:cached-event-meta="eventMeta"
      by-cursor-time
      by-select-event
      show-key-word
      @set-filter-bar-params="setTopFilterParams"
    />
    <div
      v-if="displayDays && displayDays.length > 0"
      v-loading="sequenceLoading"
      class="seq-body public-hoverItem"
      :class="{ 'context-hidden': !contextPanelVisible }"
    >
      <div class="seq-left commonBackgrond">
        <div class="seq-left-header">
          <div class="common-title">用户行为轨迹</div>
          <div class="seq-left-toggle" @click="toggleSeqOrder">
            {{ seqOrder === 'desc' ? '按时间倒序' : '按时间正序' }}
            <el-icon>
              <CaretBottom v-if="seqOrder === 'desc'" />
              <CaretTop v-else />
            </el-icon>
          </div>
        </div>
        <div v-if="displayDays && displayDays.length > 0" class="seq-left-content">
          <div v-for="(day, di) in displayDays" :key="di" class="seq-day">
            <div class="seq-day-header" @click="toggleDay(day.date)">
              <div class="seq-day-title">
                <el-icon>
                  <Loading v-if="day.loading" />
                  <ArrowDown v-else-if="day.expanded" />
                  <ArrowRight v-else />
                </el-icon>
                <span>{{ day.date }}</span>
              </div>
              <div class="seq-day-meta">，共{{ day.total }}个事件</div>
            </div>
            <div v-show="day.expanded" class="seq-day-groups">
              <div v-for="(grp, gi) in day.groups" :key="gi" class="seq-hour">
                <div class="seq-hour-header" @click="toggleHour(day.date, grp.hour)">
                  <el-icon>
                    <ArrowDown v-if="grp.expanded" />
                    <ArrowRight v-else />
                  </el-icon>
                  <span>{{ grp.hour }}</span>
                </div>
                <div v-show="grp.expanded" class="seq-events">
                  <div
                    v-for="(item, ei) in grp.events"
                    :key="ei"
                    class="seq-event-item"
                    :class="{
                      active: item.active,
                      'pay-success': item.ev.name === '支付成功',
                    }"
                  >
                    <!-- @click="selectEvent(ev)"  点击切换树形选中样式 -->
                    <div class="seq-event-time">{{ item.ev.time }}</div>
                    <div class="seq-event-line">
                      <div class="line-dot"></div>
                      <div class="line-bar"></div>
                    </div>
                    <div class="seq-event-name" :class="{ 'has-hot': item.ev.hotPropText }">
                      <div class="seq-event-top">
                        <div class="seq-event-title">
                          <span class="seq-event-display">{{ item.ev.name }}</span>
                          <span v-if="item.ev.eventName" class="seq-event-code">
                            {{ '( ' + item.ev.eventName + ' )' }}
                          </span>
                        </div>
                        <div class="seq-event-actions">
                          <span
                            v-if="hasEventSelection"
                            class="seq-event-action"
                            @click.stop="openContext(item.ev)"
                            >上下文</span
                          >
                          <span v-if="hasEventSelection" class="seq-event-action-sep">|</span>
                          <span class="seq-event-action" @click.stop="openDetail(item.ev)">
                            详情
                          </span>
                        </div>
                      </div>
                      <div v-if="item.ev.hotPropText" class="seq-event-hot">
                        {{ item.ev.hotPropText }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div v-if="day.hasMore" class="load-more-container">
                <div @click.stop="loadMoreEvents(day.date)">
                  {{ day.loadingMore ? '加载中' : '加载更多...' }}
                  <el-icon v-if="day.loadingMore" style="margin-right: 4px"><Loading /></el-icon>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-if="displayDays && displayDays.length > 0" class="seq-pagination">
          <el-pagination
            v-model:current-page="seqPage.page"
            next-text="下一页"
            :page-size="seqPage.size"
            :page-sizes="[10, 20, 30, 40]"
            :total="seqPage.total"
            @size-change="onSeqSizeChange"
            @current-change="changeSeqPage"
          />
        </div>
      </div>
      <div v-loading="seqContextLoading" class="seq-right commonBackgrond">
        <template v-if="contextPanelVisible">
          <div class="seq-detail-header">
            <div class="seq-detail-title" style="display: flex; align-items: center">
              上下文 - [
              {{ contextAnchorEvent ? contextAnchorEvent.fullTime : '' }}
              {{ contextAnchorEvent && contextAnchorEvent.name }}
              <div style="margin-left: 4px">
                {{ contextAnchorEvent ? ' | ' + contextAnchorEvent.eventName : '' }}
                ]
              </div>
            </div>
            <div class="seq-detail-time">
              <el-icon class="seq-context-close" @click="closeContextPanel"><Close /></el-icon>
            </div>
          </div>
          <div v-if="contextAnchorEvent" class="seq-context-list">
            <div class="seq-context-content">
              <div
                v-if="contextHasMoreBefore"
                class="seq-context-load"
                @click.stop="loadMoreContextBefore"
              >
                加载更多...
              </div>
              <div class="seq-context-items">
                <div
                  v-for="(ev, idx) in contextEvents"
                  :key="ev.id || idx"
                  class="seq-context-item"
                  :class="{
                    active: contextAnchorEvent && contextAnchorEvent.id === ev.id,
                    'has-hot': !!ev.hotPropText,
                  }"
                >
                  <div class="seq-context-time">{{ ev.fullTime }}</div>
                  <div class="seq-context-info">
                    <div class="seq-context-title">
                      <div class="seq-context-main">
                        <span class="seq-context-display">{{ ev.name }}</span>
                        <span v-if="ev.eventName" class="seq-context-code">
                          {{ '( ' + ev.eventName + ' )' }}
                        </span>
                      </div>
                      <!-- 详情 -->
                      <div class="seq-context-detail" @click.stop="openContextDetail(ev)">
                        详情
                      </div>
                    </div>
                    <div v-if="ev.hotPropText" class="seq-context-hot">
                      {{ ev.hotPropText }}
                    </div>
                  </div>
                </div>
              </div>
              <div
                v-if="contextHasMoreAfter"
                class="seq-context-load"
                @click.stop="loadMoreContextAfter"
              >
                加载更多...
              </div>
            </div>
          </div>
          <div v-else class="seq-context-empty">请选择事件</div>
        </template>
        <div v-else class="seq-context-blank"></div>
      </div>
    </div>
    <div v-else class="seq-no-data seq-body public-hoverItem">
      <div v-loading="sequenceLoading" style="height: 100%">
        <div class="common-title">用户行为轨迹</div>
        <div class="seq-no-data-text">暂无数据</div>
      </div>
    </div>
    <el-drawer
      v-model="detailDrawerVisible"
      direction="rtl"
      size="800px"
      :with-header="false"
      :append-to-body="true"
      :show-close="false"
      :destroy-on-close="true"
      class="seq-detail-drawer"
    >
      <div v-loading="seqDetailLoading" class="seq-drawer">
        <div class="seq-detail-header">
          <div class="seq-detail-title" style="display: flex; align-items: center">
            {{ detailEvent && detailEvent.name }}
            <div style="color: #4d4d4d; margin-left: 4px">
              {{ detailEvent && detailEvent.eventName ? '( ' + detailEvent.eventName + ' )' : '' }}
            </div>
          </div>
          <div class="seq-detail-time">
            {{ detailEvent ? detailEvent.fullTime : '' }}
            <el-icon class="seq-drawer-close" @click="closeDetailDrawer"><Close /></el-icon>
          </div>
        </div>
        <div v-if="detailEvent" class="seq-detail-list">
          <div class="seq-header-title">
            <span class="seq-header-label">事件属性</span>
            <span class="seq-header-value">属性值</span>
          </div>
          <div class="seq-detail-content">
            <div v-for="row in detailRows" :key="row.key" class="seq-detail-row">
              <div class="seq-detail-key" v-html="row.label"></div>
              <div class="seq-detail-val">{{ row.value }}</div>
            </div>
          </div>
        </div>
        <div v-else class="seq-context-empty">请选择事件</div>
      </div>
    </el-drawer>
  </div>
</template>

<style scoped lang="scss">
// v2 里这两条是 .el-icon-arrow-down / .el-icon-arrow-right（element-ui 的字体图标类），
// v3 换成了 el-icon 组件，等价地挂到日期头 / 小时头里的图标上
.seq-day-title .el-icon,
.seq-hour-header .el-icon {
  cursor: pointer;
}

.seq-no-data {
  background-color: #fff;
  display: flex;
  flex-direction: column;
  height: 100%;

  .seq-no-data-text {
    font-size: 13px !important;
    color: #828181;
    padding: 13px;
    display: flex;
    justify-content: center;
    align-items: center;
    text-align: center;
    padding: 50px;
    height: 100%;
  }
}

.commonBackgrond {
  background-color: #fff;
}

.load-more-container {
  display: flex;
  margin-left: 40px;
  font-size: 13px !important;
  color: #2c7be5;
  padding: 12px;
  cursor: pointer;
}

.common-title {
  font-size: 14px;
  font-weight: 600;
  line-height: 26px;
  color: #4d4d4d !important;
}

.seq-container {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;

  .seq-body {
    flex: 1;
    overflow-y: hidden;
    display: flex;
    background-color: #fff;
    padding: 10px 15px;
    border-radius: 6px;
    min-height: 0;

    .seq-left-header {
      margin-bottom: 10px;
      display: flex;
      justify-content: flex-start;
      align-items: center;
    }

    .seq-left-toggle {
      display: flex;
      align-items: center;
      font-size: 13px;
      color: #2c7be5;
      cursor: pointer;
      margin-left: 20px;
    }

    .seq-left {
      width: 50%;
      border-right: 1px solid #dfe5ed;
      padding-right: 15px;
      display: flex;
      flex-direction: column;
    }

    .seq-left-content {
      flex: 1;
      overflow: visible;
      overflow-y: auto;
    }

    .seq-pagination {
      flex: 0 0 auto;
      padding-top: 10px;
    }

    .seq-right {
      width: 50%;
      padding-left: 15px;
      //overflow-y: auto;
      overflow-y: hidden;
    }

    &.context-hidden {
      .seq-left {
        width: 100%;
        padding-right: 0;
        border-right: 0;
      }

      .seq-right {
        width: 0;
        padding-left: 0;
        border-left: 0;
        display: none;
      }
    }

    .seq-day {
      margin-bottom: 12px;
      border: 1px solid #dce3ec;
      border-radius: 6px;
    }

    .seq-day-header {
      display: flex;
      //justify-content: space-between;
      align-items: center;
      height: 36px;
      line-height: 36px;
      border-bottom: 1px solid #dce3ec;
      background-color: #f7fafe;
      padding: 0 10px;
      font-size: 14px;
      cursor: pointer;
      color: #333;
    }

    .seq-day-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
    }

    .seq-day-meta {
      font-size: 13px;
    }

    .seq-day-groups {
      margin: 6px 0;
      max-height: 500px;
      overflow-y: auto;
    }

    .seq-events {
      // height: 100%;
      //max-height: 400px;
      height: auto;
      overflow-y: auto;
      overflow-x: hidden;
    }

    .seq-hour-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 15px;
      color: #333;
      background: #fff;
      font-size: 13px;
      font-weight: 500;
      border-radius: 6px;
    }

    .seq-event-item {
      cursor: default;
      display: flex;
      align-items: stretch;
      box-sizing: border-box;
      margin-left: 75px;
      font-size: 13px;

      .seq-event-time {
        width: 70px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        padding-right: 10px;
        cursor: pointer;
        display: flex;
        align-items: center;
        color: #333;
      }

      .seq-event-line {
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        align-items: center;
        // flex: 1;

        .line-dot {
          width: 4px;
          height: 4px;
          background-color: #6f6f70;
          border-radius: 50%;
        }

        .line-bar {
          width: 1px;
          flex: 1;
          background-color: #c6cccc;
        }
      }

      .seq-event-name {
        background-color: #f7fafe;
        //width: calc(100% - 130px);
        flex: 1;
        min-width: 0;
        margin-right: 15px;
        padding: 0 10px;
        border-radius: 6px;
        margin-left: 15px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        margin-bottom: 10px;
      }

      .seq-event-top {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        gap: 8px;
        min-width: 0;
        line-height: 30px;
        height: 30px;
      }

      .seq-event-title {
        // flex: 1;
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        color: #333;
      }

      .seq-event-code {
        margin-left: 4px;
        font-size: 14px;
      }

      .seq-event-actions {
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-left: 40px;
        font-size: 13px;
        line-height: 18px;
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        transition: opacity 0.15s ease;
      }

      &:hover .seq-event-actions {
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
      }

      // 选中事件时，显示操作按钮
      &.active .seq-event-actions {
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
      }

      .seq-event-action {
        color: #2c7be5;
        cursor: pointer;
        border: solid 1px #2c7be5;
        border-radius: 9px;
        padding: 0px 3px;
        background: lightblue;
      }

      .seq-event-action-sep {
        color: #a0a7b4;
      }

      .seq-event-hot {
        color: #7b7a7b;
        font-size: 13px;
        line-height: 16px;
        margin-top: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .seq-event-name.has-hot {
        padding: 6px 10px;
        justify-content: flex-start;
        margin-bottom: 10px;

        .seq-event-top {
          height: auto;
          line-height: 16px;
          align-items: flex-start;
          font-size: 14px;
        }
      }
    }

    .seq-event-item.active .seq-event-name {
      background-color: #e8f0fe;
      font-weight: 500;
      border: 1px solid #2c7be5;
    }

    .seq-event-item.active .line-dot,
    .seq-event-item.active .line-bar {
      background-color: #2c7be5 !important;
    }

    .seq-pagination {
      display: flex;
      justify-content: center;
      padding: 10px 0;
      overflow-x: auto;
    }

    .seq-detail-header {
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 0 10px;
    }

    .seq-detail-title {
      font-size: 14px;
      font-weight: 600;
      color: #4d4d4d;
    }

    .seq-detail-time {
      font-size: 13px;
      color: #656d92;
      display: inline-flex;
      align-items: center;
      gap: 10px;
    }

    .seq-context-close,
    .seq-drawer-close {
      cursor: pointer;
      font-size: 14px;
      color: #a0a7b4;
    }

    .seq-detail-list {
      border-radius: 6px;
      border: 1px solid #dfe5ed;
      height: calc(100% - 40px);

      .seq-header-title {
        font-size: 14px;
        background-color: #f7fafe;
        line-height: 25px;
        font-weight: 600;
        color: #4d4d4d;
        padding: 6px 10px;
      }

      .seq-detail-content {
        height: calc(100% - 40px);
        overflow: auto;
      }
    }

    .seq-context-list {
      border-radius: 6px;
      border: 1px solid #dfe5ed;
      height: calc(100% - 40px);

      .seq-header-title {
        font-size: 14px;
        background-color: #f7fafe;
        line-height: 25px;
        font-weight: 600;
        color: #4d4d4d;
        padding: 6px 10px;
      }
    }

    .seq-context-content {
      height: calc(100% - 40px);
      overflow: auto;
    }

    .seq-context-load {
      display: flex;
      justify-content: center;
      font-size: 13px;
      color: #2c7be5;
      padding: 10px 0;
      cursor: pointer;
      user-select: none;
    }

    .seq-context-items {
      border-radius: 6px;
      overflow: hidden;
    }

    .seq-context-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 10px;
      min-height: 50px;
      font-size: 13px;
      cursor: default;
      color: #4d4d4d;
    }

    .seq-context-items .seq-context-item:nth-child(odd) {
      background-color: #fff;
    }

    .seq-context-items .seq-context-item:nth-child(even) {
      background-color: #f7fafe;
    }

    .seq-context-item.active {
      background-color: rgb(148, 172, 233, 0.5) !important;
      border-left: 3px solid #2c7be5;
    }

    .seq-context-code .active {
      background-color: #031c48 !important;
    }

    .seq-context-time {
      display: inline-block;
      width: 125px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex-shrink: 0;
      min-height: 30px;
      display: flex;
      align-items: flex-start;
      color: #333;
    }

    .seq-context-info {
      //flex: 1;
      min-width: 0;
      min-height: 30px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      //padding: 5px 10px;
      //margin: 3px 0;
      white-space: nowrap;
    }

    .seq-context-title {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      min-width: 0;
      font-size: 14px;
    }

    .seq-context-main {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: flex-start;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .seq-context-code {
      margin-left: 4px;
      font-size: 13px;
    }

    .seq-context-hot {
      color: #7b7a7b;
      font-size: 13px;
      line-height: 16px;
      margin-top: 2px;
      // white-space: nowrap;
      // overflow: hidden;
      // text-overflow: ellipsis;
    }

    .seq-context-detail {
      flex: 0 0 auto;
      color: #2c7be5;
      cursor: pointer;
      border: solid 1px #2c7be5;
      border-radius: 9px;
      padding: 0 3px;
      background: lightblue;
      opacity: 0;
      //margin-top: 2px;
      margin-left: 40px;
      transition: opacity 0.2s;
    }

    //左侧行为轨迹
    .seq-event-name:hover {
      background: #e5edfa;
    }

    //右侧上下文
    .seq-context-item:hover {
      background: #e5edfa !important;
    }

    .seq-context-item:hover .seq-context-detail {
      opacity: 1;
    }

    .seq-context-item.has-hot {
      align-items: flex-start;
    }

    .seq-context-empty {
      font-size: 13px;
      color: #828181;
      padding: 50px 0;
      text-align: center;
    }

    .seq-context-blank {
      height: 100%;
      min-height: 300px;
    }

    .seq-detail-row {
      display: flex;
      font-size: 13px;
      align-items: center;
      padding: 5px 10px;
      border-radius: 6px;
      min-height: 30px;
      box-sizing: border-box;
      width: 100%;
    }

    .seq-detail-row:nth-child(odd) {
      background-color: #fff;
    }

    .seq-detail-row:nth-child(even) {
      background-color: #f7fafe;
    }
  }
}

.seq-drawer {
  padding: 15px;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;

  .seq-detail-header {
    margin-bottom: 10px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0 10px;
  }

  .seq-detail-title {
    font-size: 14px;
    font-weight: 600;
    color: #4d4d4d;
  }

  .seq-detail-time {
    font-size: 13px;
    color: #656d92;
    display: inline-flex;
    align-items: center;
    gap: 10px;
  }

  .seq-context-empty {
    font-size: 13px;
    color: #828181;
    padding: 50px 0;
    text-align: center;
  }

  .seq-detail-list {
    border-radius: 6px;
    border: 1px solid #dfe5ed;
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;

    .seq-header-title {
      font-size: 14px;
      background-color: #f7fafe;
      line-height: 25px;
      font-weight: 600;
      color: #4d4d4d;
      padding: 6px 10px;
      flex: 0 0 auto;
      display: flex;
      align-items: center;

      .seq-header-label {
        flex: 0 0 200px;
        margin-right: 12px;
      }

      .seq-header-value {
        flex: 1;
        color: #4d4d4d;
      }
    }

    .seq-detail-content {
      flex: 1;
      min-height: 0;
      overflow: auto;
    }
  }

  .seq-detail-row {
    display: flex;
    font-size: 13px;
    align-items: center;
    padding: 5px 10px;
    border-radius: 6px;
    min-height: 30px;
    box-sizing: border-box;
    width: 100%;
  }

  .seq-detail-row:nth-child(odd) {
    background-color: #fff;
  }

  .seq-detail-row:nth-child(even) {
    background-color: #f7fafe;
  }

  .seq-detail-key {
    flex: 0 0 200px;
    font-size: 14px;
    width: 200px;
    //white-space: normal;
    //word-break: break-all;
    font-weight: 400;
    line-height: 20px;
    color: #333333;
    margin-right: 12px;
    box-sizing: border-box;
  }

  .seq-detail-val {
    flex: 1;
    color: #2c7be5;
    font-size: 14px;
    font-weight: 500;
    box-sizing: border-box;
    //white-space: normal;
    //word-break: break-all;
    line-height: 20px;
  }
}

// v2 里写的是 ::v-deep .seq-detail-drawer .el-drawer__body。
// 抽屉是 append-to-body 的，scoped 的 :deep 选择器带着本组件的 data-v，
// 匹配不到挂在 body 上的抽屉，这条规则在 v2 里同样是不生效的。
// 真要生效需要把它提到全局样式（见迁移报告）。
:deep(.seq-detail-drawer .el-drawer__body) {
  height: 100%;
  padding: 0;
  overflow: hidden;
}
</style>
