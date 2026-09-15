import { createBizService, showErrorOnce, wrapService } from '@/utils/http'
import { isProjectSwitching } from '@/utils/project-switching'

const service = createBizService({
  channel: 'ups',
  timeout: 10000,
  onBizError(res) {
    const data = res.data as { id?: unknown } | undefined
    if (data && data.id == null) {
      showErrorOnce('唯一标识重复，请修改后在保存')
      return true
    }
    return false
  },
  onHttpError() {
    return isProjectSwitching()
  },
})

export default wrapService(service)
