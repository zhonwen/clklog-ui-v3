/**
 * 「正在切换项目」标志位。
 *
 * 切项目时会连续触发菜单、渠道等多个请求，中途的报错和路由跳转要静默掉。
 * 该标志位此前散落在守卫、三个请求拦截器和 Navbar 里各自读写，
 * 且 requestAuthManage 判断的是 'true'（写入的其实是 '1'），分支永远走不到。
 * 统一收口到这里，业务代码不要再出现裸 key。
 */
const PROJECT_SWITCHING_KEY = 'projectSwitching'

export function setProjectSwitching(on: boolean) {
  localStorage.setItem(PROJECT_SWITCHING_KEY, on ? '1' : '0')
}

export function isProjectSwitching() {
  return localStorage.getItem(PROJECT_SWITCHING_KEY) === '1'
}
