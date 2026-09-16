import * as echarts from 'echarts'
import type { ECharts, EChartsOption } from 'echarts'
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { debounce } from '@/utils/index'

export function useChart() {
  const elRef = ref<HTMLDivElement | null>(null)
  const chart = shallowRef<ECharts | null>(null)

  function init(option?: EChartsOption) {
    if (!elRef.value) return
    chart.value?.dispose()
    chart.value = echarts.init(elRef.value)
    if (option) chart.value.setOption(option)
  }

  function setOption(option: EChartsOption, notMerge = false) {
    chart.value?.setOption(option, notMerge)
  }

  function resize() {
    chart.value?.resize()
  }

  const onResize = debounce(() => resize(), 100)

  // 与 v2 的 mixins/resize.js 一致：只认宽度过渡。
  // 不过滤的话，侧栏里任意一个颜色/背景过渡都会触发页面上所有图表 resize。
  const onSidebarTransitionEnd = (e: Event) => {
    if ((e as TransitionEvent).propertyName === 'width') onResize()
  }

  onMounted(() => {
    window.addEventListener('resize', onResize)
    const sidebar = document.getElementsByClassName('sidebar-container')[0]
    sidebar?.addEventListener('transitionend', onSidebarTransitionEnd)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', onResize)
    const sidebar = document.getElementsByClassName('sidebar-container')[0]
    sidebar?.removeEventListener('transitionend', onSidebarTransitionEnd)
    chart.value?.dispose()
    chart.value = null
  })

  return { elRef, chart, init, setOption, resize }
}
