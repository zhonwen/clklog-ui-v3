window.globalConfig = {
  // 接口地址配置（与 v2 public/config.js 字段一致）
  // 注意：这里是随包发布的「模板」，部署后改 dist/config.js 即可切环境，不需要重新构建。
  // 默认保持 localhost，不要提交演示站或内网地址 —— 私有化部署若忘记修改，
  // 登录请求（含账号密码）会直接发到默认地址上。
  BASE_API: "http://localhost/api", //clklog-api接口应用路径
  BASE_API_MANAGE: "http://localhost/api/manage", //clklog-manage-api接口应用路径
  BASE_API_AUTHMANAGE: "http://localhost/api/authmanage", //clklog-authmanage-api接口应用路径
  BASE_API_UPSAPI: "http://localhost/api/ups-api", //clklog-ups-api接口访问路径

  clklog_api_timeout: 120, //clklog-api接口应用超时时间配置参数/秒
  clklog_api_load_maxtime: 120, //漏斗分析数据量大时 接口请求轮询最大时间配置参数/秒
  copyRight: "ClkLog", //系统名称
  copyRightUrl: "https://clklog.com/#/introduce", //系统外链官网
};
