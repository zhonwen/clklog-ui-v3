import request from '@/utils/requestManage'
import type { ProjectItem } from '@/types/app'

export function getAppMyList() {
  return request<ProjectItem[]>({
    url: '/project/getMyList',
    method: 'post',
    data: {},
  })
}
