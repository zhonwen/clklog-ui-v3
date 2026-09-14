import router from '@/router'
import { createBizService, showErrorOnce, type ApiResult } from '@/utils/http'

const service = createBizService({
  channel: 'api',
  attachXToken: true,
  onBizError(res, url) {
    if (router.currentRoute.value.path === '/mete/funnelAnalysis') {
      if (res.code != 200) return res
    }
    if (url.includes('/eventanalysis/customAnalysis')) {
      showErrorOnce(
        res.message ||
          res.msg ||
          '自定义分析查询模型错误，请检查并修改查询模型后重新进行分析。',
      )
      return true
    }
    return false
  },
  onHttpError() {
    if (router.currentRoute.value.path === '/mete/funnelAnalysis') {
      console.log('漏斗接口报错')
      return true
    }
    return false
  },
})

export type { ApiResult }
export default service
