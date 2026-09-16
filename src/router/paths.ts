/**
 * 散落在守卫和请求层里的硬编码业务路径，收口到这里。
 * 取值与 v2 保持一致（v2 src/permission.js:37,79 与 src/utils/request.js）。
 */
/** 移动端强制落地页（领导驾驶舱） */
export const SUMMARY_PATH = '/record/summary'
/** 自定义分析：进度条自管，不走全局 NProgress */
export const CUSTOM_ANALYSIS_PATH = '/mete/customAnalysis'
/** 漏斗分析：接口报错不弹框，进度条自管 */
export const FUNNEL_ANALYSIS_PATH = '/mete/funnelAnalysis'
