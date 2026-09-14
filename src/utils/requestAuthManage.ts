import { createBizService, wrapService } from '@/utils/http'

const service = createBizService({
  channel: 'authmanage',
  onHttpError() {
    return localStorage.getItem('projectSwitching') === 'true'
  },
})

export default wrapService(service)
