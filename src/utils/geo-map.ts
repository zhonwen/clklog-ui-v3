import * as echarts from 'echarts'

/**
 * 地图 GeoJSON 的注册工具。
 *
 * 背景：echarts 4 自带 `echarts/map/json/china.json` 与 `echarts/map/js/world.js`，
 * v2 直接 import 即可；echarts 5 起**移除了内置地图数据**，必须自己 registerMap。
 *
 * 数据来源与 v2 完全一致 —— 取自 echarts 4.2.1 包内的那两份，放在 `public/map/` 下：
 * - `public/map/china.json`
 * - `public/map/world.json`（从 world.js 的 registerMap 调用里提取出的 GeoJSON）
 *
 * 放 public 而不是 import 进 bundle 的原因：
 * 1. ClkLog 以私有化/内网部署为主，不能依赖外网（如 datav 在线接口）；
 * 2. 两份加起来约 200KB，不进 bundle，按需 fetch；
 * 3. 部署后可直接替换 dist/map/*.json 更新行政区划，不必重新构建。
 *
 * 注：echarts 4 的地图带 `UTF8Encoding` 坐标压缩，echarts 6 的 parseGeoJson 仍然支持解码，
 * 可以直接喂给 registerMap。
 */

type MapName = 'china' | 'world'

/** 同一张图只注册一次；并发调用共用同一个 Promise，避免重复 fetch */
const pending = new Map<MapName, Promise<void>>()
const registered = new Set<MapName>()

export function isMapRegistered(name: MapName) {
  return registered.has(name)
}

export function ensureGeoMap(name: MapName): Promise<void> {
  if (registered.has(name)) return Promise.resolve()
  const running = pending.get(name)
  if (running) return running

  // base 用 import.meta.env.BASE_URL，兼容部署在子路径下的情况（vite 配置里 base 是 './'）
  const base = import.meta.env.BASE_URL || './'
  const url = `${base.endsWith('/') ? base : base + '/'}map/${name}.json`

  const task = fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`加载地图失败: ${url} (${res.status})`)
      return res.json()
    })
    .then((geoJson) => {
      echarts.registerMap(name, geoJson as Parameters<typeof echarts.registerMap>[1])
      registered.add(name)
    })
    .catch((err) => {
      // 注册失败不要让整页崩掉：图表区留空，其余（表格、榜单）照常工作
      console.error('[geo-map] 地图注册失败，地图区域将留空：', err)
    })
    .finally(() => {
      pending.delete(name)
    })

  pending.set(name, task)
  return task
}
