import * as echarts from 'echarts'
import type { ECharts, EChartsOption } from 'echarts'
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { debounce } from '@/utils/index'

export function useChart() {
  const elRef = ref<HTMLDivElement | null>(null)
  const chart = shallowRef<ECharts | null>(null)

  function init(option?: EChartsOption) {
    if (!elRef.value) return
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

  onMounted(() => {
    window.addEventListener('resize', onResize)
    const sidebar = document.getElementsByClassName('sidebar-container')[0]
    sidebar?.addEventListener('transitionend', onResize)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', onResize)
    const sidebar = document.getElementsByClassName('sidebar-container')[0]
    sidebar?.removeEventListener('transitionend', onResize)
    chart.value?.dispose()
    chart.value = null
  })

  return { elRef, chart, init, setOption, resize }
}
