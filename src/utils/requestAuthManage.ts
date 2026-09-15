import { createBizService, wrapService } from '@/utils/http'
import { isProjectSwitching } from '@/utils/project-switching'

const service = createBizService({
  channel: 'authmanage',
  onHttpError() {
    return isProjectSwitching()
  },
})

export default wrapService(service)
