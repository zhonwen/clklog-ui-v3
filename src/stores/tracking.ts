import { defineStore } from 'pinia'
import { getLocalStorage, setLocalStorage } from '@/utils/localStorage'
import type { ProjectItem } from '@/types/app'

const defaultProjects: ProjectItem[] = [
  {
    projectName: 'clklogapp',
    projectDisplayName: 'clklog',
  },
]

function readProjects(): ProjectItem[] {
  // 与 v2 一致：只有 projectList 不存在时才用默认项目。
  // 空数组要原样保留 —— 守卫靠它区分「无项目」(/Unauthorized) 和「有项目无菜单」(/NoProjectPermission)，
  // Navbar 也靠它做「项目列表为空则强制登出」的兜底。
  const list = getLocalStorage<ProjectItem[]>('projectList')
  return Array.isArray(list) ? list : defaultProjects
}

export const useTrackingStore = defineStore('tracking', {
  state: () => {
    const projectArray = readProjects()
    const saved = getLocalStorage<string>('prejectCode')
    return {
      projectArray,
      projectName:
        (typeof saved === 'string' && saved) ||
        projectArray[0]?.projectName ||
        'clklogapp',
      equipmentFlag: 1,
      propertyList: getLocalStorage('propertyList') || {},
    }
  },
  actions: {
    setProject(projectName: string) {
      this.projectName = projectName
      setLocalStorage('prejectCode', projectName)
    },
    setProjectArray(value: ProjectItem[]) {
      this.projectArray = value
      setLocalStorage('projectList', value)
    },
    // v2 的 SET_EQUIPMENT / SET_PROPERTY，UPS 与元数据模块会用到
    setEquipment(value: number) {
      this.equipmentFlag = value
    },
    setPropertyList(value: unknown) {
      this.propertyList = value as typeof this.propertyList
      setLocalStorage('propertyList', value)
    },
  },
})
