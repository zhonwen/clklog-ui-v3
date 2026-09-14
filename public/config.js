window.globalConfig = {
  // 演示环境配置（正式/线上）
  BASE_API: "https://pro.clklog.com/api", //clklog-api接口应用路径
  BASE_API_MANAGE: "https://pro.clklog.com/api/manage", //clklog-manage-api接口应用路径
  BASE_API_AUTHMANAGE: "https://pro.clklog.com/api/authmanage", //clklog-authmanage-api接口应用路径
  BASE_API_UPSAPI: "https://pro.clklog.com/api/ups-api", //clklog-ups-api接口应用路径

  // 测试环境配置
  // BASE_API: "http://10.10.220.188/proapi", //clklog-api接口应用路径
  // BASE_API_MANAGE: "http://10.10.220.188/manage", //clklog-manage-api接口应用路径
  // BASE_API_AUTHMANAGE: "http://10.10.220.188/authmanage", //clklog-authmanage-api接口应用路径
  // BASE_API_UPSAPI: "http://10.10.220.188/ups-api", //clklog-ups-api接口访问路径

  clklog_api_timeout: 120, //clklog-api接口应用超时时间配置参数/秒
  clklog_api_load_maxtime: 120, //漏斗分析数据量大时 接口请求轮询最大时间配置参数/秒
  copyRight: "ClkLog", //系统名称
  copyRightUrl: "https://clklog.com/#/introduce", //系统外链官网
};
