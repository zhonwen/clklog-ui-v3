const sessionEventUrl =
  'https://github.com/sensorsdata/sa-sdk-javascript/tree/master/dist/web/plugin/session-event'

export const sharedText = {
  pv: '选定时间段内访客访问应用的页面总次数。<div style="margin-top:5px">访客每打开一个页面被记录一次，同一页面打开多次浏览量值累计计算。</div>',
  visitCount:
    '选定时间段内访客访问应用的总次数。<div style="margin-top:5px">访客首次访问或距离上次访问超过30分钟再次访问会被记录为一个新的访问。</div>',
  uv: '一天之内访问应用的独立访客数（以Cookie或设备ID为依据），一天内同一访客多次访问应用只计算为一个访客。<div style="margin-top:5px"> 选定时间段内的访客数为时间段内的每一天访问应用的独立访客数的累计值。</div>',
  ip: '一天之内访问应用的独立IP数，一天内同一IP多次访问应用只计算为一个IP。<div style="margin-top:5px">选定时间段内的IP数为时间段内的每一天访问应用的独立IP数的累计值。</div>',
  bounceRate:
    '只浏览一个页面就离开或关闭应用的访问次数占总访问次数的百分比。<div style="margin-top:5px"></div><div style="margin-top:5px">跳出次数 / 总访问次数 * 100%</div>',
  avgPv:
    '选定时间段内访客访问页面数的平均值。<div style="margin-top:5px">访客的单次访问中，每打开一个页面被记录一次，同一页面打开多次访问页面数累计计算。</div> <div style="margin-top:5px">浏览量 / 访问次数</div>',
  avgVisitTime:
    '选定时间段内访客访问应用的平均时长。<div style="margin-top:5px">访客的单次访问中，访问的总时长为打开第一个页面到退出或关闭最后一个页面的时间差。</div><div style="margin-top:5px">访问总时长 / 访问次数</div>',
  avgPageBrowseTime:
    '选定时间段内访客访问单个页面的平均浏览时长。<div style="margin-top:5px">访客的单次访问中，页面浏览的总时长为所有访问页面浏览时长的总和。</div><div style="margin-top:5px">页面浏览总时长 / 页面浏览总量</div>',
  newUv: '首次访问应用的时间在选定时间段内的访客总数。',
  newUvRate:
    '选定时间段内的新访客在访客总数中的占比。<div style="margin-top:5px"></div><div style="margin-top:5px">新访客数 / 访客总数 * 100%</div>',
  oldUv: '首次访问应用的时间不在选定时间段内的访客总数。',
  oldUvRate:
    '选定时间段内的老访客在访客总数中的占比。	<div style="margin-top:5px">老访客数 / 访客总数 * 100%</div>',
  exitCount:
    '指定页面作为退出页的访问次数。<div style="margin-top:5px">访客的单次访问中，退出应用时访问的最后一个页面为退出页。</div><div style="margin-top:5px">页面退出次数 / 页面总访问次数 * 100%</div>',
  entryCount:
    '指定页面作为进入页的访问次数。<div style="margin-top:5px">访客的单次访问中，进入应用时访问的第一个页面为进入页。</div>',
  downPvCount: '选定时间段内的受访页面给站内其他页面直接带去的浏览量。',
  conversionCycle:
    '转化周期是以漏斗的第一步步骤为起始时间点来计算完成整个漏斗路径的最大时间范围。 <div style="margin-top:5px"> 用户触发第一个步骤后，在指定转化周期内完成整个漏斗，即算作完成了一次转化。</div>',
  relationProtoType: '至少选择 2 个属性，且所选类型必须一致。',
  sessionEvent: `系统监测到您尚未集成神策session-event插件，所以会话相关数据（访问次数、平均访问页数、平均访问时长、跳出率）没有数据显示。
  <a href="${sessionEventUrl}" style="color:#2c7be5;" target="_blank" rel="noopener noreferrer">webjs sdk session-event参考</a>`,
  allUserRate: '全部用户：当前用户列表全量用户',
}
