# clklog-ui-v3

ClkLog 管理端从 **Vue 2 + Element UI + Vue CLI** 升级到 **Vue 3 + TypeScript + Element Plus + Vite**。

对照代码在本地 `v2/`（已被 `.gitignore` 忽略，不提交）。v3 对齐 v2 的业务行为、接口、路由 path、运行时配置，不借升级改产品。

---

## 当前进度

| 阶段 | 状态 |
|------|------|
| 第 0 步：Vite + Vue 3 + TS 脚手架 | 已完成 |
| 第 1 步：工程骨架（代理、config、依赖） | 已完成 |
| 第 2 步：登录 / 布局 / 权限 / 动态菜单 | 已完成 |
| 第 3 步起：按模块接业务页 | 未开始 |

每完成一步，把上表对应行改成「进行中 / 已完成」。

---

## 技术版本（锁定）

开发机使用 **Node 24.21.x**（nvm：管理员执行 `nvm use 24.21.0`）。

| 包 | 目标版本 | 说明 |
|----|----------|------|
| Node.js | `^22.18.0 \|\| >=24.12.0` | 推荐 24 LTS，不要用 23 |
| Vue | **3.5.x**（当前脚手架约 3.5.40） | 不要上 3.6 RC |
| Vite | 8.x | 替代 Vue CLI |
| Vue Router | 5.x | 替代 vue-router 3 |
| Pinia | 4.x | 替代 Vuex 3 |
| TypeScript | 脚手架自带 | 组件用 `<script setup lang="ts">` |
| Element Plus | 2.14.x（第 1 步安装） | 替代 element-ui 2 |
| ECharts | 6.x（接图表时再装） | 替代 echarts 4；中国地图自备 GeoJSON |
| Axios | 1.x（第 1 步安装） | 请求封装对齐 v2 |

---

## 原则

1. **接口、路由 path、`public/config.js` 字段名与 v2 一致。** 发布后仍改 `config.js` 切换环境。
2. **菜单来自后端**，不是写死在前端。v2 用 `menuList` + `componentUri` 转路由；v3 同样处理，只是把 `require.context` 换成 `import.meta.glob`。
3. **新页面用 Vue 3 + TS + `<script setup>`**，不要再写 Options API。
4. **一次只接一个模块。** 模块能在真实菜单里点开、主路径跑通，再接下一个。
5. **先占位、再填肉。** 第 2 步让所有后端菜单都能打开占位页，避免后面缺 `componentUri` 白屏。

---

## 本地开发

```bash
# 确认 Node
node -v    # 应为 v24.21.x

npm install
npm run dev
```

生产构建：

```bash
npm run build
```

产物仍用 nginx 托管。接口地址改 `dist/config.js`（与 v2 的 `public/config.js` 相同字段）。

---

## 分步计划

### 第 1 步：工程骨架（先做这个）

目标：v3 能跑、能代理到现有后端，还不接业务页。

对照 v2：`vue.config.js`、`public/config.js`、`src/settings.js`。

要做：

1. 安装：`element-plus`、`@element-plus/icons-vue`、`axios`、`js-cookie`、`nprogress`、`sass`、`normalize.css`、`mitt`。
2. 复制并保留 `public/config.js`（字段与 v2 完全一致）：
   - `BASE_API` / `BASE_API_MANAGE` / `BASE_API_AUTHMANAGE` / `BASE_API_UPSAPI`
   - `clklog_api_timeout` / `clklog_api_load_maxtime`
   - `copyRight` / `copyRightUrl`
3. `index.html` 引入 `/config.js`。
4. `vite.config.ts`：
   - 代理 `/DEV-API`、`/DEV-API-MANAGE`、`/DEV-API-AUTHMANAGE`、`/DEV-API-UPSAPI`
   - `@` 指向 `src`
   - scss 全局注入 `src/styles/variables.scss`
5. `src/utils/request.ts`：按 v2 `utils/request.js` 迁 4 套 baseURL、Token、`code` 处理（200 / 403 / 423）。
6. 删掉脚手架演示：`HomeView.vue`、`AboutView.vue`、`HelloWorld`、`TheWelcome` 等。
7. 全局注册 Element Plus，默认尺寸用 `default`（对应 v2 的 `medium`）。

验收：

- `npm run dev` 无报错
- 浏览器能打开空白壳
- 代理能打到 clklog-api（可用 Network 看 `/DEV-API` 是否转发）

---

### 第 2 步：登录、布局、权限、动态菜单

目标：能登录、出侧边栏、按后端菜单跳转。业务页可以是「模块建设中」占位。

对照 v2：

- `src/views/login/`
- `src/layout/`（Navbar / Sidebar / AppMain / TagsView / filterBar）
- `src/permission.js`
- `src/store/modules/{user,app,permission,settings,tagsView,tracking,filterBar}`
- `src/router/index.js` 的 `constantRoutes` + `resetRouter`

要做：

1. Pinia 拆 store，对应原 Vuex 模块，getter 名称尽量不变，少改页面调用。
2. 常量路由先接：`/login`、`/auth-redirect`、`/NoPermission`、`/Unauthorized`、`/NoProjectPermission`、`/PermissionDenied`、`/redirect`。
3. 权限守卫对齐 v2：白名单、token、移动端 `summary`、无菜单/无项目跳转。
4. 动态路由：`componentUri === 'Layout'` 用布局组件；其它用 `import.meta.glob('@/views/**/*.vue')` 匹配。
5. 登出重置路由：不要用 v2 的 `router.matcher`，改为记录动态路由名再 `removeRoute`。
6. 动态菜单找不到对应 vue 时回落到占位页（`src/views/placeholder/index.vue`），避免白屏。

验收：

- 登录 / 退出
- 侧边栏菜单与 v2 一致（数据来自同一套后端）
- 点每个菜单能进占位页，不再 404
- 无权限、无项目页跳转正确
- 顶栏项目切换可用

说明：

- 开发代理在 `vite.config.ts` 的 `PROXY_ENV: 'demo' | 'test'` 切换。演示环境本地代理对齐 v2：`/manage`、`/authmanage`、`/ups-api`（不要加 `/api`）。`public/config.js` 仍用正式发布地址 `https://pro.clklog.com/api/...`。测试环境是 `http://10.10.220.188`。
- 找不到对应 `componentUri` 的页面时，`loadView` 回落到 `src/views/placeholder/index.vue`，不必预先建 200+ 空文件。
- v2 的 layout 实际没有挂载 TagsView；store 已迁，标签页 UI、filterBar、改密、下载放到第 3 步。

---

### 第 3 步：公共能力（所有业务页都依赖）

目标：后面每个模块都复用，不在业务里重复造。

对照 v2：`layout/components/filterBar`、`components/`、`directive/`、`filters/`、`icons/`、`utils/`。

要做：

| 能力 | v2 | v3 |
|------|----|----|
| 时间/项目筛选条 | `filterBar` | 迁到 Vue 3，行为不变 |
| 全局过滤器 | `src/filters`、`$options.filters` | 改成 `src/utils` 函数 |
| 事件总线 `$bus` | `Vue.prototype.$bus` | `mitt` |
| 指令 | `v-permission`、`v-loadmore` 等 | Vue 3 指令钩子 |
| Svg 图标 | `src/icons` | `vite-svg-loader` 或 sprite |
| 表格列宽 | `$fixedWidth` | `app.config.globalProperties` 或 composable |
| 文案 | `$sharedText` | 同上 |
| 导出 PDF/截图 | `htmlToPdf`、html2canvas、jspdf | 保留能力，API 对齐 |
| ECharts 封装 | 各页直接 `import echarts` | 统一 init / dispose / resize；地图用自有 GeoJSON |

验收：登录后布局里筛选条能选项目/时间；指令、图标在占位页可点验证。

---

### 第 4 步：先接「首页」

登录后的落地页，验证筛选条 + 图表 + 请求通。

对照：`v2/src/views/home/`

页面：

- 首页总览（流量、新老访客、来源、搜索词、地域分布等块）

验收：与 v2 首页数据、筛选项、图表趋势一致（地图可先占位，第 6 步再补）。

---

### 第 5 步：访问分析（先接菜单模块）

表格为主，规则相对清晰，适合作为第一个完整业务模块。

对照：`v2/src/views/access-analysis/`

| 菜单 | 页面 | v2 路径 |
|------|------|---------|
| 受访页面 | 受访页面分析 | `InterviewedPage/visitedpage` |
| | 结构化页面分析 | `InterviewedPage/treePage` |
| | 入口页分析 | `InterviewedPage/portalpage` |
| | 退出页分析 | `InterviewedPage/exitpage` |
| 搜索词 | 站内搜索 | `searchTerm/siteonSearch` |
| | 站外搜索 | `searchTerm/siteoutSearch` |

验收：筛选、表格、下钻/弹窗与 v2 一致。

---

### 第 6 步：访客分析

对照：`v2/src/views/visitor-analysis/`

**先接（无中国地图）：**

| 菜单 | v2 文件 |
|------|---------|
| 趋势分析 | `trend-analysis` |
| 新老访客 | `newOld-visitor-analysis` |
| 来源网站 | `sourceWeb-analysis` |
| 渠道分析 | `channel-analysis` |
| 设备分析 | `equipment-analysis` |

**后接（依赖地图 GeoJSON）：**

| 菜单 | v2 文件 | 说明 |
|------|---------|------|
| 地域分析 | `regional-analysis` | v2 用 `echarts/map/json/china.json`，5+ 已删除，需自备地图 |

验收：先通 5 个非地图页；地域分析单独验收地图下钻。

---

### 第 7 步：实时访问

对照：`v2/src/views/realtimeAccess/`

- 实时访问（访问日志 + 地域分布）

地域分布同样依赖中国地图，和第 6 步地图方案一起做。

---

### 第 8 步：用户分析

对照：`v2/src/views/user-behavior/`

**先接：**

- 活跃用户分析 `activeUsers`
- 忠诚度分析 `loyaltyAnalysis`
- 流失/留存用户 `retainedUsers`
- 回流/沉默用户 `silentUsers`

**后接（页面更重）：**

- 用户画像 `behaviorAnalysis`
- 用户细查 `userInfo`（访问历史、行为序列）
- 分群/审核类 `userReview`（若菜单仍在用）

---

### 第 9 步：元数据管理

对照：`v2/src/views/meteData/`

事件分析、分群规则都依赖这套数据，必须在复杂分析之前完成。

| 菜单 | v2 |
|------|-----|
| 元事件 | `manage` |
| 事件属性 | `event-prototype` |
| 用户属性 | `user-prototype` |
| 公共属性 | `public-attribute` |

验收：增删改、启用停用与 v2 一致。

---

### 第 10 步：事件分析（统计 / 日志 / 书签）

对照：`v2/src/views/analysis-modules/`

**先接：**

- 数据统计 `event-analysis`
- 日志查询 `log-analysis`
- 书签 `bookMark`

**后接：**

- 自定义分析 `custom-analysis`（条件构造器复杂，放到第 11 步一起）

---

### 第 11 步：行为分析（漏斗 / 路径 / 自定义）

规则编辑器和轮询多，放在元数据、事件统计之后。

对照：

- `v2/src/views/funnel-analysis/` 漏斗分析
- `v2/src/views/collapse-analysis/` 路径/转化（留存路径类）
- `v2/src/views/analysis-modules/custom-analysis/` 自定义分析

注意：漏斗在 v2 里对接口错误有特殊处理（`request.js` 不弹框），v3 要保留；`clklog_api_load_maxtime` 轮询逻辑对齐。

---

### 第 12 步：UPS（用户标签 / 分群 / 画像）

最复杂，规则组件大量复制，最后集中迁，避免中途改公共规则组件。

对照：`v2/src/views/ups/`

**先接列表和详情：**

- 用户标签：列表、详情
- 用户分群：列表、详情
- 用户画像：列表、详情

**后接创建/规则编辑器：**

- 标签创建（属性 / 行为 / 序列 / SQL / 首次末次特征等）
- 分群创建
- 画像规则、PDF 导出

`vue-treeselect`、`vuedraggable` 换成 Vue 3 版本或 Element Plus `el-tree-select`。

---

### 第 13 步：系统管理、权限管理

对照：

- `v2/src/views/sys-manage/` 全局设置、项目管理、日志汇总
- `v2/src/views/auth-manage/` 门户、用户、角色、菜单

权限管理会影响菜单数据，放到业务分析稳定之后，改的时候好回归。

---

### 第 14 步：领导驾驶舱

对照：`v2/src/views/leader-cockpit/`（桌面 + 移动）

大屏布局、图表多，依赖前面图表封装和地图。最后做。

移动端 `summary` 权限在第 2 步守卫里已有，本步把真实页面补上。

---

### 第 15 步：回归与发布

按 v2 功能走主路径：

- 登录、权限、项目切换、动态菜单
- 筛选条、导出、截图/PDF
- 漏斗轮询、无权限页
- `npm run build`，改 `dist/config.js` 连测试/生产
- Docker / nginx 与 v2 一致（静态目录即可）

---

## 建议顺序（一览）

```text
1 工程骨架
2 登录 + 布局 + 权限 + 菜单占位
3 筛选条 / 请求 / 指令 / 图标 / 图表底座
4 首页
5 访问分析          ← 第一个完整业务模块
6 访客分析（地域地图稍后）
7 实时访问
8 用户分析（细查、画像稍后）
9 元数据管理
10 事件统计 / 日志 / 书签
11 漏斗 / 路径 / 自定义分析
12 UPS 标签 / 分群 / 画像
13 系统管理 / 权限管理
14 领导驾驶舱
15 全量回归
```

**先接：** 框架 → 登录菜单 → 首页 → 访问分析 → 访客（无地图）→ 用户分析列表页 → 元数据  
**后接：** 中国地图、自定义/漏斗规则器、UPS 规则编辑器、驾驶舱、权限管理后台

---

## 单个页面怎么迁

1. 打开 v2 对应 `.vue`，看模板、接口、筛选依赖。
2. 在 v3 建同路径文件（`componentUri` 不能改）。
3. 模板：`slot-scope` 改为 `#default="{ row }"`；`slot="xxx"` 改为 `#xxx`。
4. 逻辑：Options API 改为 `<script setup lang="ts">`；`$set` 改为直接赋值；`$bus` 改为 mitt。
5. UI：`el-*` 按 [Element Plus 从 Element UI 升级](https://element-plus.org/zh-CN/guide/migration.html) 改（尺寸、事件名、表单、表格）。
6. 图表：`import echarts from 'echarts'` 改为按需 import；组件卸载时 `dispose`。
7. 对照 v2 点一遍：进入、筛选、分页、导出、权限。

---

## 目录约定（目标）

```text
clklog-ui-v3/
  public/config.js          # 运行时接口配置，与 v2 字段一致
  src/
    api/                    # 按模块拆接口
    assets/
    components/             # 跨模块公共组件
    directive/
    icons/
    layout/                 # 壳子：侧边栏、顶栏、主区、筛选条
    permission.ts           # 路由守卫
    router/
    stores/                 # Pinia：user / app / permission / ...
    styles/
    utils/                  # request、auth、filters 改造后的工具函数
    views/                  # 与 v2 同相对路径，保证 componentUri
  vite.config.ts
  v2/                       # 仅本地对照，不提交
```

---

## 环境与常见问题

- **`node` 不是内部命令**：管理员终端执行 `nvm use 24.21.0`，关掉旧窗口再开。
- **nvm 装不上 Node 24**：nvm-windows 1.1.9 太旧，且直连 nodejs.org 易超时。用 `24.21.0`，镜像：
  `nvm node_mirror https://npmmirror.com/mirrors/node/`
- **不要把 v2 拷进 `src` 直接跑**：Vue 2 语法在 Vue 3 下编译不过，必须按页改写。

---

## 下一步

第 2 步进行中：登录、布局、权限和动态菜单。菜单点开后为占位页，业务内容从第 3 步起按模块迁入。
