import { createBizService, showErrorOnce } from '@/utils/http'

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
    return localStorage.getItem('projectSwitching') == '1'
  },
})

export default service
