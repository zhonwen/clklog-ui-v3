import { createBizService } from '@/utils/http'

const service = createBizService({
  channel: 'manage',
  onBizError(res, url) {
    if (url.includes('/bookmark/get')) {
      return res
    }
    return false
  },
})

export default service
