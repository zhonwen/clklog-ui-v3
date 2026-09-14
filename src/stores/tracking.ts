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
  const list = getLocalStorage<ProjectItem[]>('projectList')
  return Array.isArray(list) && list.length ? list : defaultProjects
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
  },
})
