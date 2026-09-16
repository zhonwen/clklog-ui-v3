import type { GroupedPropertiesData, PropertyItem } from '@/views/analysis-modules/custom-analysis/types'

/**
 * 合并 commonProperties 到每个 group 的 events 里的 propertyList，并把 groupName 复制成 displayName / name。
 * 与 v2 的 src/utils/mergeEventProperties.js 完全一致（就地修改入参并原样返回）。
 */
export function mergeCommonPropertiesToEvents(
  data: GroupedPropertiesData | null | undefined,
): GroupedPropertiesData | null | undefined {
  if (!data || !Array.isArray(data.events) || !Array.isArray(data.commonProperties)) {
    return data
  }
  // 属性名直接取 property.name
  const getPropertyName = (property: PropertyItem) => property.name

  data.events.forEach((group) => {
    // groupName => displayName
    if (group.groupName) {
      group.displayName = group.groupName
      group.name = group.displayName
      // 与 v2 一致：这里不 delete group.groupName
    }
    if (Array.isArray(group.events)) {
      group.events.forEach((event) => {
        if (!Array.isArray(event.propertyList)) {
          event.propertyList = []
        }
        // 现有属性名集合
        const existNames = new Set(event.propertyList.map((p) => getPropertyName(p)))
        // 需要合并的属性
        const toAdd = data.commonProperties.filter((cp) => !existNames.has(getPropertyName(cp)))
        // 合并
        event.propertyList = event.propertyList.concat(toAdd)
      })
    }
  })
  return data
}
