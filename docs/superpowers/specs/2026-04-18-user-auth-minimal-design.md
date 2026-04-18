# 用户登录注册闭环设计方案

> **范围确认**：本方案对应“用户模块 A 档最小版 + A1 全业务页必须登录”的实现设计，先完成登录、注册、退出、登录态持久化、路由守卫、Token 注入与登录态展示；本期不实现自动刷新 Token、401 自动重试、个人中心、找回密码、修改密码。

## 1. 目标与边界

| 项目 | 说明 |
|---|---|
| 目标 | 建立前后端可用的最小认证闭环，让所有业务页都必须登录后才能访问 |
| 前端目标 | 登录页、注册页、退出登录、登录态持久化、受保护路由、请求自动注入 Bearer Token |
| 后端目标 | 保持现有 `AuthController` / `AuthService` 设计不变，收紧 `SecurityConfig` 的放行范围 |
| 不做内容 | 自动刷新 Token、401 自动重试、个人中心、修改密码、找回密码、邮箱验证码 |
| 数据库范围 | 本期不改数据库结构 |
| 后续衔接 | 下一阶段在本方案基础上继续做 `resume` / `interview` / `knowledgebase` 的用户隔离 |

## 2. 当前现状

| 维度 | 当前现状 | 结论 |
|---|---|---|
| 后端认证接口 | 已有 `/api/auth/register`、`/api/auth/login`、`/api/auth/refresh`、`/api/auth/logout` | 后端认证基础可直接复用 |
| 后端 Token 设计 | AccessToken + RefreshToken，RefreshToken 存 Redis | 满足 A 档需求 |
| 前端认证状态 | 当前没有统一认证状态管理 | 需要新增 |
| 前端请求层 | 当前 `request.ts` 只有响应处理，没有请求头注入 | 需要补 Bearer Token 注入 |
| 前端路由 | 当前业务路由默认可直接进入 | 需要补受保护路由 |
| 布局层 | 当前无用户信息展示与退出入口 | 需要补轻量用户区 |
| 安全配置 | 当前 `SecurityConfig` 还放行了 `/api/resumes/**` | 登录闭环完成后需要收口 |

## 3. 方案选择

| 方案 | 描述 | 优点 | 缺点 | 结论 |
|---|---|---|---|---|
| 方案 1 | 直接在页面中读写 `localStorage` + 简单路由判断 | 改动快 | 逻辑分散，后续难扩展 | 不选 |
| 方案 2 | `AuthContext + useAuth + localStorage + Axios 请求拦截器 + ProtectedRoute` | 结构清晰，和当前 React 项目匹配，后续可平滑升级到自动刷新 Token | 比方案 1 多一层封装 | **采用** |
| 方案 3 | 引入 Redux / Zustand 做全局认证状态 | 扩展性强 | 当前项目体量下属于过度设计 | 不选 |

## 4. 总体架构

| 层次 | 组件 | 职责 |
|---|---|---|
| 状态层 | `AuthProvider`、`useAuth` | 保存当前用户、Token、登录状态，提供登录/注册/退出动作 |
| 持久化层 | `auth-storage.ts` | 统一管理 `localStorage` 读写 |
| API 层 | `auth.ts`、`request.ts` | 封装认证接口，并自动注入 Bearer Token |
| 路由层 | `ProtectedRoute`、`PublicRoute` | 控制业务页是否可访问，以及登录/注册页是否应被重定向 |
| 页面层 | `LoginPage`、`RegisterPage` | 提供认证交互界面 |
| 布局层 | `Layout` | 显示当前用户邮箱和退出操作 |
| 安全层 | `SecurityConfig` | 后端仅放行认证与 Swagger，业务接口改为必须登录 |

## 5. 路由设计

### 5.1 公开路由

| 路径 | 行为 |
|---|---|
| `/login` | 未登录可访问；已登录跳转 `/upload` |
| `/register` | 未登录可访问；已登录跳转 `/upload` |

### 5.2 受保护路由

| 路径 | 行为 |
|---|---|
| `/upload` | 必须登录 |
| `/history` | 必须登录 |
| `/history/:resumeId` | 必须登录 |
| `/interviews` | 必须登录 |
| `/interview/:resumeId` | 必须登录 |
| `/knowledgebase` | 必须登录 |
| `/knowledgebase/upload` | 必须登录 |
| `/knowledgebase/chat` | 必须登录 |

### 5.3 首页重定向规则

| 用户状态 | `/` 跳转目标 |
|---|---|
| 未登录 | `/login` |
| 已登录 | `/upload` |

## 6. 认证状态设计

### 6.1 状态结构

| 字段 | 含义 |
|---|---|
| `userId` | 当前用户 ID |
| `email` | 当前用户邮箱 |
| `role` | 当前用户角色 |
| `accessToken` | 访问业务接口时使用的 Token |
| `refreshToken` | 暂存，为后续 B 档做准备 |
| `isAuthenticated` | 是否已登录 |

### 6.2 状态行为

| 场景 | 行为 |
|---|---|
| 页面初次加载 | 从 `localStorage` 恢复认证状态 |
| 注册成功 | 直接视为登录成功，保存状态并跳转 `/upload` |
| 登录成功 | 保存状态并跳转 `/upload` |
| 点击退出 | 调用 `/api/auth/logout`，无论接口是否成功都清空本地状态并跳转 `/login` |
| 访问受保护路由且未登录 | 重定向 `/login` |
| 已登录访问 `/login` 或 `/register` | 重定向 `/upload` |
| 收到 401 | 本地状态失效并跳转 `/login` |

## 7. 页面设计

### 7.1 登录页

| 项目 | 设计 |
|---|---|
| 路径 | `/login` |
| 字段 | 邮箱、密码 |
| 校验 | 邮箱格式合法、密码非空 |
| 成功行为 | 保存认证状态并跳转 `/upload` |
| 失败行为 | 显示后端返回的错误信息 |
| 辅助入口 | “没有账号？去注册” |

### 7.2 注册页

| 项目 | 设计 |
|---|---|
| 路径 | `/register` |
| 字段 | 邮箱、密码、确认密码 |
| 校验 | 邮箱格式合法、密码非空、两次密码一致 |
| 成功行为 | 直接视为登录成功并跳转 `/upload` |
| 失败行为 | 显示后端返回的错误信息 |
| 辅助入口 | “已有账号？去登录” |

### 7.3 布局层用户区

| 位置 | 内容 |
|---|---|
| 侧边栏底部或顶部轻量区域 | 当前邮箱、已登录状态文案、退出按钮 |

## 8. API 设计

### 8.1 前端新增认证 API 封装

| 方法 | 请求 | 响应 |
|---|---|---|
| `register` | `POST /api/auth/register` | `AuthResponse` |
| `login` | `POST /api/auth/login` | `AuthResponse` |
| `logout` | `POST /api/auth/logout` | `void` |

### 8.2 请求层行为

| 场景 | 行为 |
|---|---|
| 发起请求前 | 若存在 `accessToken`，自动追加 `Authorization: Bearer <token>` |
| 接口返回业务错误 | 保留现有 `Result` 解析逻辑 |
| 接口返回 HTTP 401 | 清空本地认证状态并跳转 `/login` |
| 文件上传 | 保持现有上传逻辑，仅新增认证请求头 |

## 9. 后端安全配置设计

### 9.1 放行范围

| 放行路径 | 原因 |
|---|---|
| `/api/auth/**` | 登录、注册、刷新、退出 |
| `OPTIONS /**` | 浏览器预检请求 |
| `/swagger-ui/**`、`/swagger-ui.html`、`/v3/api-docs/**` | 开发调试与 API 文档 |

### 9.2 需要鉴权的业务接口

| 路径前缀 | 结论 |
|---|---|
| `/api/resumes/**` | 需要登录 |
| `/api/interview/**` | 需要登录 |
| `/api/knowledgebase/**` | 需要登录 |
| `/api/jobs/**` | 需要登录 |

> 说明：本期只要求“必须登录”；不在这一轮解决“只能访问自己的数据”问题。

## 10. 文件改动设计

### 10.1 前端新增文件

| 文件 | 作用 |
|---|---|
| `frontend/src/types/auth.ts` | 认证相关类型定义 |
| `frontend/src/api/auth.ts` | 登录、注册、退出接口封装 |
| `frontend/src/auth/auth-storage.ts` | 统一的本地存储读写工具 |
| `frontend/src/auth/AuthContext.tsx` | 认证上下文与 `useAuth` Hook |
| `frontend/src/auth/ProtectedRoute.tsx` | 受保护路由 |
| `frontend/src/auth/PublicRoute.tsx` | 公开路由保护 |
| `frontend/src/pages/LoginPage.tsx` | 登录页 |
| `frontend/src/pages/RegisterPage.tsx` | 注册页 |

### 10.2 前端修改文件

| 文件 | 改动 |
|---|---|
| `frontend/src/api/request.ts` | 增加请求拦截器与 401 处理 |
| `frontend/src/App.tsx` | 重构路由结构，加入公开路由与受保护路由 |
| `frontend/src/components/Layout.tsx` | 增加当前用户显示与退出操作 |
| `frontend/src/main.tsx` | 注入 `AuthProvider` |

### 10.3 后端修改文件

| 文件 | 改动 |
|---|---|
| `app/src/main/java/com/nbwf/modules/user/config/SecurityConfig.java` | 收紧业务接口放行范围 |

## 11. 错误处理设计

| 错误类型 | 处理方式 |
|---|---|
| 登录失败 | 页面展示后端 message |
| 注册失败 | 页面展示后端 message |
| 本地 Token 缺失或损坏 | 视为未登录，清理本地状态 |
| 业务接口 401 | 清空状态并跳转 `/login` |
| 退出接口失败 | 仍然执行本地退出，避免用户卡死在错误状态 |

## 12. 测试与验收设计

### 12.1 手工验收点

| 编号 | 验收项 | 预期结果 |
|---:|---|---|
| 1 | 未登录访问 `/upload` | 跳转 `/login` |
| 2 | 注册成功 | 自动进入 `/upload` |
| 3 | 登录成功 | 自动进入 `/upload` |
| 4 | 已登录访问 `/login` | 跳转 `/upload` |
| 5 | 刷新页面 | 登录态保持 |
| 6 | 点击退出 | 清空登录态并回到 `/login` |
| 7 | 访问业务接口 | 自动携带 `Authorization` 请求头 |
| 8 | 未携带 Token 请求业务接口 | 后端拒绝访问 |

### 12.2 建议补充的验证

| 类型 | 目标 |
|---|---|
| 前端构建验证 | 确认新增路由、认证状态和类型定义无编译错误 |
| 后端测试验证 | 确认 `SecurityConfig` 调整后认证接口与预检请求仍正常 |

## 13. 风险与后续事项

| 风险/事项 | 说明 |
|---|---|
| `refreshToken` 暂未自动使用 | 属于有意延后，不影响 A 档目标 |
| 当前只做“必须登录” | 数据隔离问题将在下一阶段解决 |
| `knowledgebase` 用户隔离后续可能涉及结构调整 | 本期不处理 |
| 布局与登录页样式 | 以复用现有设计体系为主，避免额外 UI 重构 |

## 14. 开发进度文档机制

| 项目 | 规则 |
|---|---|
| 主文档 | `docs/development-progress.md` |
| 更新时机 | 开始新功能前、完成功能后、提交前 |
| 当前迭代记录 | “用户模块 - 登录注册闭环（A 档）” |
| 每次记录内容 | 已完成、进行中、待开发、技术债、最近提交、下一个目标 |

## 15. 实施顺序

| 顺序 | 任务 |
|---:|---|
| 1 | 创建开发进度文档并初始化当前迭代 |
| 2 | 新增认证类型与本地存储工具 |
| 3 | 新增认证 API 与 `AuthContext` |
| 4 | 修改 `request.ts` 注入 Bearer Token |
| 5 | 新增登录页与注册页 |
| 6 | 修改 `App.tsx` 建立公开/私有路由结构 |
| 7 | 修改 `Layout.tsx` 增加用户区与退出按钮 |
| 8 | 收紧 `SecurityConfig` |
| 9 | 完成构建/测试验证 |
| 10 | 更新进度文档并提交推送 |

