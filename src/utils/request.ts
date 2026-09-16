import router from '@/router'
import { FUNNEL_ANALYSIS_PATH } from '@/router/paths'
import { createBizService, showErrorOnce, wrapService, type ApiResult } from '@/utils/http'

const service = createBizService({
  channel: 'api',
  attachXToken: true,
  // 漏斗分析页的报错静默：v2 里这段在 423 判断之前
  beforeBizError(res) {
    if (router.currentRoute.value.path === FUNNEL_ANALYSIS_PATH) {
      if (res.code != 200) return res
    }
    return false
  },
  // 自定义分析模型报错：v2 里这段在 423 判断之后
  onBizError(res, url) {
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
    if (router.currentRoute.value.path === FUNNEL_ANALYSIS_PATH) {
      console.log('漏斗接口报错')
      return true
    }
    return false
  },
})

export type { ApiResult }
export default wrapService(service)
