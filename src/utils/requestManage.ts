import { createBizService, wrapService } from '@/utils/http'

const service = createBizService({
  channel: 'manage',
  // 书签不存在时不弹错误：v2 里这段在 423 判断之前
  beforeBizError(res, url) {
    if (url.includes('/bookmark/get')) {
      return res
    }
    return false
  },
})

export default wrapService(service)
