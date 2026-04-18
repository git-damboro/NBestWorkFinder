# 用户登录注册闭环 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 A 档最小版用户登录注册闭环，让所有业务页面必须登录后才能访问。

**Architecture:** 前端使用 `AuthContext + useAuth + localStorage + Axios interceptor + ProtectedRoute` 管理认证状态、路由访问和请求 Token 注入。后端保持现有认证接口，收紧 `SecurityConfig`，仅放行认证接口、Swagger 和浏览器预检请求。

**Tech Stack:** React 18、TypeScript、React Router 7、Axios、Spring Boot 4、Spring Security 6、JWT、Redis Refresh Token。

---

## 0. 实施约束

| 约束 | 说明 |
|---|---|
| 本期范围 | 登录、注册、退出、登录态持久化、路由守卫、Token 注入、登录态展示 |
| 不实现 | 自动刷新 Token、401 自动重试、个人中心、找回密码、修改密码、邮箱验证码 |
| 数据库 | 本期不改数据库结构 |
| 权限粒度 | 本期只要求“必须登录”，用户数据隔离放到下一阶段 |
| 文档维护 | 每完成一个可用小功能，都同步更新 `docs/development-progress.md` |

## 1. 文件结构

### 新增文件

| 文件 | 职责 |
|---|---|
| `frontend/src/types/auth.ts` | 认证请求、响应、用户、会话类型 |
| `frontend/src/api/auth.ts` | 登录、注册、退出接口封装 |
| `frontend/src/auth/auth-storage.ts` | 统一管理本地认证状态读写 |
| `frontend/src/auth/AuthContext.tsx` | 认证上下文、登录/注册/退出动作、`useAuth` Hook |
| `frontend/src/auth/ProtectedRoute.tsx` | 未登录时阻止访问业务页面 |
| `frontend/src/auth/PublicRoute.tsx` | 已登录时阻止访问登录/注册页面 |
| `frontend/src/pages/LoginPage.tsx` | 登录页面 |
| `frontend/src/pages/RegisterPage.tsx` | 注册页面 |

### 修改文件

| 文件 | 改动 |
|---|---|
| `frontend/src/api/request.ts` | 增加请求拦截器、Bearer Token 注入、401 本地失效处理 |
| `frontend/src/main.tsx` | 注入 `AuthProvider` |
| `frontend/src/App.tsx` | 重构公开路由和受保护路由 |
| `frontend/src/components/Layout.tsx` | 增加当前用户信息和退出登录入口 |
| `app/src/main/java/com/nbwf/modules/user/config/SecurityConfig.java` | 移除 `/api/resumes/**` 放行，业务接口统一要求登录 |
| `app/src/test/java/com/nbwf/modules/user/config/SecurityCorsTest.java` | 保留并确认预检请求仍可通过 |
| `docs/development-progress.md` | 更新当前迭代状态、已完成项、下一个目标、最近提交 |

---

## Task 1: 前端认证类型与本地存储

**Files:**
- Create: `frontend/src/types/auth.ts`
- Create: `frontend/src/auth/auth-storage.ts`
- Modify: `docs/development-progress.md`

- [ ] **Step 1: 新增认证类型文件**

Create `frontend/src/types/auth.ts`:

```ts
export interface AuthUser {
  userId: number;
  email: string;
  role: string;
}

export interface AuthSession extends AuthUser {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  userId: number;
  email: string;
  role: string;
}
```

- [ ] **Step 2: 新增认证本地存储工具**

Create `frontend/src/auth/auth-storage.ts`:

```ts
import type { AuthResponse, AuthSession } from '../types/auth';

const AUTH_STORAGE_KEY = 'nbwf_auth_session';

export function toAuthSession(response: AuthResponse): AuthSession {
  return {
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
    userId: response.userId,
    email: response.email,
    role: response.role,
  };
}

export function loadAuthSession(): AuthSession | null {
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (
      typeof parsed.accessToken !== 'string' ||
      typeof parsed.refreshToken !== 'string' ||
      typeof parsed.userId !== 'number' ||
      typeof parsed.email !== 'string' ||
      typeof parsed.role !== 'string'
    ) {
      clearAuthSession();
      return null;
    }
    return parsed as AuthSession;
  } catch {
    clearAuthSession();
    return null;
  }
}

export function saveAuthSession(session: AuthSession): void {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function clearAuthSession(): void {
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

export function getAccessToken(): string | null {
  return loadAuthSession()?.accessToken ?? null;
}
```

- [ ] **Step 3: 运行前端类型检查构建**

Run from `frontend/`:

```bash
npm run build
```

Expected: TypeScript build reaches the current project baseline. If existing unrelated errors appear, record them without changing unrelated code.

- [ ] **Step 4: 更新开发进度文档**

Modify `docs/development-progress.md`:

```markdown
| 当前目标 | 完成前端认证基础类型与本地存储工具 |
```

Add an entry under “当前进行中”:

```markdown
| P0 | 前端认证基础类型与本地存储工具 | 已完成 |
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/auth.ts frontend/src/auth/auth-storage.ts docs/development-progress.md
git commit -m "feat(auth): add frontend auth session storage"
```

---

## Task 2: 认证 API 与 AuthContext

**Files:**
- Create: `frontend/src/api/auth.ts`
- Create: `frontend/src/auth/AuthContext.tsx`
- Modify: `docs/development-progress.md`

- [ ] **Step 1: 新增认证 API 封装**

Create `frontend/src/api/auth.ts`:

```ts
import request from './request';
import type { AuthResponse, LoginRequest, RegisterRequest } from '../types/auth';

export const authApi = {
  register(data: RegisterRequest): Promise<AuthResponse> {
    return request.post<AuthResponse>('/api/auth/register', data);
  },

  login(data: LoginRequest): Promise<AuthResponse> {
    return request.post<AuthResponse>('/api/auth/login', data);
  },

  logout(): Promise<void> {
    return request.post<void>('/api/auth/logout');
  },
};
```

- [ ] **Step 2: 新增 AuthContext**

Create `frontend/src/auth/AuthContext.tsx`:

```tsx
import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { authApi } from '../api/auth';
import type { AuthSession, AuthUser, LoginRequest, RegisterRequest } from '../types/auth';
import { clearAuthSession, loadAuthSession, saveAuthSession, toAuthSession } from './auth-storage';

interface AuthContextValue {
  session: AuthSession | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  clearSession: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<AuthSession | null>(() => loadAuthSession());

  const applySession = useCallback((nextSession: AuthSession) => {
    saveAuthSession(nextSession);
    setSession(nextSession);
  }, []);

  const clearSession = useCallback(() => {
    clearAuthSession();
    setSession(null);
  }, []);

  const login = useCallback(async (data: LoginRequest) => {
    const response = await authApi.login(data);
    applySession(toAuthSession(response));
  }, [applySession]);

  const register = useCallback(async (data: RegisterRequest) => {
    const response = await authApi.register(data);
    applySession(toAuthSession(response));
  }, [applySession]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const user = useMemo<AuthUser | null>(() => {
    if (!session) {
      return null;
    }
    return {
      userId: session.userId,
      email: session.email,
      role: session.role,
    };
  }, [session]);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user,
    isAuthenticated: Boolean(session?.accessToken),
    login,
    register,
    logout,
    clearSession,
  }), [session, user, login, register, logout, clearSession]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

- [ ] **Step 3: 运行前端构建**

Run from `frontend/`:

```bash
npm run build
```

Expected: Build succeeds or only reports unrelated pre-existing issues.

- [ ] **Step 4: 更新开发进度文档**

Add under “已完成内容”:

```markdown
| 前端认证 | 已新增认证 API 封装与 `AuthContext` 登录态管理 |
```

Update “下一个最小目标”:

```markdown
| 目标 | 完成请求层 Token 注入与路由守卫 |
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/auth.ts frontend/src/auth/AuthContext.tsx docs/development-progress.md
git commit -m "feat(auth): add auth api and context"
```

---

## Task 3: 请求层 Token 注入与 401 处理

**Files:**
- Modify: `frontend/src/api/request.ts`
- Modify: `docs/development-progress.md`

- [ ] **Step 1: 在请求层导入认证存储工具**

Modify the top of `frontend/src/api/request.ts`:

```ts
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { clearAuthSession, getAccessToken } from '../auth/auth-storage';
```

- [ ] **Step 2: 在响应拦截器前增加请求拦截器**

Insert before `instance.interceptors.response.use(...)`:

```ts
instance.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

- [ ] **Step 3: 在 HTTP 错误分支处理 401**

In the `error.response` branch of `frontend/src/api/request.ts`, add this before parsing `data`:

```ts
if (error.response.status === 401) {
  clearAuthSession();
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
  return Promise.reject(new Error('登录状态已失效，请重新登录'));
}
```

The resulting branch should keep existing `Result` message parsing for non-401 errors.

- [ ] **Step 4: 运行前端构建**

Run from `frontend/`:

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 5: 更新开发进度文档**

Add under “已完成内容”:

```markdown
| 前端认证 | 请求层已支持自动注入 Bearer Token，并在 401 时清理本地登录态 |
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/request.ts docs/development-progress.md
git commit -m "feat(auth): inject bearer token in requests"
```

---

## Task 4: 路由守卫组件

**Files:**
- Create: `frontend/src/auth/ProtectedRoute.tsx`
- Create: `frontend/src/auth/PublicRoute.tsx`
- Modify: `docs/development-progress.md`

- [ ] **Step 1: 新增受保护路由组件**

Create `frontend/src/auth/ProtectedRoute.tsx`:

```tsx
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
```

- [ ] **Step 2: 新增公开路由组件**

Create `frontend/src/auth/PublicRoute.tsx`:

```tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function PublicRoute() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/upload" replace />;
  }

  return <Outlet />;
}
```

- [ ] **Step 3: 运行前端构建**

Run from `frontend/`:

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: 更新开发进度文档**

Update “当前进行中”:

```markdown
| P0 | 前端路由守卫组件 | 已完成 |
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/auth/ProtectedRoute.tsx frontend/src/auth/PublicRoute.tsx docs/development-progress.md
git commit -m "feat(auth): add protected and public routes"
```

---

## Task 5: 登录页与注册页

**Files:**
- Create: `frontend/src/pages/LoginPage.tsx`
- Create: `frontend/src/pages/RegisterPage.tsx`
- Modify: `docs/development-progress.md`

- [ ] **Step 1: 新增登录页**

Create `frontend/src/pages/LoginPage.tsx`:

```tsx
import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Lock, Mail, Sparkles } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { getErrorMessage } from '../api/request';

interface LocationState {
  from?: {
    pathname?: string;
  };
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as LocationState | null)?.from?.pathname ?? '/upload';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('请输入邮箱');
      return;
    }
    if (!password) {
      setError('请输入密码');
      return;
    }

    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      navigate(from, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto mb-4 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary-500/30">
            <Sparkles className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">登录 NBestWorkFinder</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">继续管理你的简历、面试和知识库</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">邮箱</label>
            <div className="relative">
              <Mail className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">密码</label>
            <div className="relative">
              <Lock className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="请输入密码"
                autoComplete="current-password"
              />
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold transition-colors"
          >
            {submitting ? '登录中...' : '登录'}
          </button>

          <p className="text-center text-sm text-slate-500 dark:text-slate-400">
            没有账号？
            <Link to="/register" className="text-primary-600 dark:text-primary-400 font-medium hover:underline ml-1">
              去注册
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 新增注册页**

Create `frontend/src/pages/RegisterPage.tsx`:

```tsx
import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail, Sparkles } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { getErrorMessage } from '../api/request';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('请输入邮箱');
      return;
    }
    if (!password) {
      setError('请输入密码');
      return;
    }
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setSubmitting(true);
    try {
      await register({ email: email.trim(), password });
      navigate('/upload', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto mb-4 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-primary-500/30">
            <Sparkles className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">注册 NBestWorkFinder</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">创建账号后即可开始使用 AI 求职助手</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">邮箱</label>
            <div className="relative">
              <Mail className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">密码</label>
            <div className="relative">
              <Lock className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="请输入密码"
                autoComplete="new-password"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">确认密码</label>
            <div className="relative">
              <Lock className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="请再次输入密码"
                autoComplete="new-password"
              />
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900 rounded-xl px-3 py-2">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold transition-colors"
          >
            {submitting ? '注册中...' : '注册并进入系统'}
          </button>

          <p className="text-center text-sm text-slate-500 dark:text-slate-400">
            已有账号？
            <Link to="/login" className="text-primary-600 dark:text-primary-400 font-medium hover:underline ml-1">
              去登录
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 运行前端构建**

Run from `frontend/`:

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: 更新开发进度文档**

Add under “已完成内容”:

```markdown
| 前端认证 | 已新增登录页与注册页 |
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/LoginPage.tsx frontend/src/pages/RegisterPage.tsx docs/development-progress.md
git commit -m "feat(auth): add login and register pages"
```

---

## Task 6: 注入 AuthProvider 并重构路由

**Files:**
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `docs/development-progress.md`

- [ ] **Step 1: 在入口注入 AuthProvider**

Modify `frontend/src/main.tsx` so the app is wrapped with `AuthProvider`:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { AuthProvider } from './auth/AuthContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
);
```

- [ ] **Step 2: 在 App 中引入新页面和路由守卫**

Modify imports and lazy declarations in `frontend/src/App.tsx`:

```tsx
import ProtectedRoute from './auth/ProtectedRoute';
import PublicRoute from './auth/PublicRoute';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
```

- [ ] **Step 3: 重构 Routes 结构**

Replace the current `<Routes>` block in `frontend/src/App.tsx` with this structure while preserving the existing wrapper components:

```tsx
<Routes>
  <Route element={<PublicRoute />}>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
  </Route>

  <Route element={<ProtectedRoute />}>
    <Route path="/" element={<Layout />}>
      <Route index element={<Navigate to="/upload" replace />} />
      <Route path="upload" element={<UploadPageWrapper />} />
      <Route path="history" element={<HistoryListWrapper />} />
      <Route path="history/:resumeId" element={<ResumeDetailWrapper />} />
      <Route path="interviews" element={<InterviewHistoryWrapper />} />
      <Route path="interview/:resumeId" element={<InterviewWrapper />} />
      <Route path="knowledgebase" element={<KnowledgeBaseManagePageWrapper />} />
      <Route path="knowledgebase/upload" element={<KnowledgeBaseUploadPageWrapper />} />
      <Route path="knowledgebase/chat" element={<KnowledgeBaseQueryPageWrapper />} />
    </Route>
  </Route>

  <Route path="*" element={<Navigate to="/" replace />} />
</Routes>
```

- [ ] **Step 4: 运行前端构建**

Run from `frontend/`:

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 5: 更新开发进度文档**

Add under “已完成内容”:

```markdown
| 前端认证 | 已接入 `AuthProvider` 并完成公开/受保护路由结构 |
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/main.tsx frontend/src/App.tsx docs/development-progress.md
git commit -m "feat(auth): protect business routes"
```

---

## Task 7: 布局层用户展示与退出登录

**Files:**
- Modify: `frontend/src/components/Layout.tsx`
- Modify: `docs/development-progress.md`

- [ ] **Step 1: 增加 Auth 与退出图标导入**

Modify `frontend/src/components/Layout.tsx` imports:

```tsx
import { ChevronRight, Database, FileStack, LogOut, MessageSquare, Moon, Sparkles, Sun, Upload, Users } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
```

- [ ] **Step 2: 在 Layout 中获取当前用户与退出动作**

Inside `Layout()` after theme hook:

```tsx
const { user, logout } = useAuth();
```

- [ ] **Step 3: 替换侧边栏底部信息区**

Replace the current footer block in `frontend/src/components/Layout.tsx` with:

```tsx
<div className="p-4 border-t border-slate-100 dark:border-slate-700 space-y-3">
  <div className="px-3 py-2 bg-gradient-to-r from-primary-50 to-indigo-50 dark:from-primary-900/30 dark:to-slate-800 rounded-xl">
    <p className="text-xs text-primary-600 dark:text-primary-400 font-medium">AI 面试助手 v1.0</p>
    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Powered by AI</p>
  </div>

  {user && (
    <div className="px-3 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
      <p className="text-xs text-slate-400 dark:text-slate-500">当前用户</p>
      <p className="text-sm text-slate-700 dark:text-slate-200 font-medium truncate mt-1">{user.email}</p>
      <button
        type="button"
        onClick={() => void logout()}
        className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700"
      >
        <LogOut className="w-4 h-4" />
        <span className="text-sm font-medium">退出登录</span>
      </button>
    </div>
  )}
</div>
```

- [ ] **Step 4: 运行前端构建**

Run from `frontend/`:

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 5: 更新开发进度文档**

Add under “已完成内容”:

```markdown
| 前端认证 | 布局层已显示当前用户邮箱并支持退出登录 |
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/Layout.tsx docs/development-progress.md
git commit -m "feat(auth): show current user in layout"
```

---

## Task 8: 后端安全配置收口

**Files:**
- Modify: `app/src/main/java/com/nbwf/modules/user/config/SecurityConfig.java`
- Modify: `docs/development-progress.md`

- [ ] **Step 1: 移除 Resume 接口匿名放行**

Modify `app/src/main/java/com/nbwf/modules/user/config/SecurityConfig.java` by removing this entry from `requestMatchers(...)`:

```java
"/api/resumes/**",
```

The allowed matcher block should be:

```java
.requestMatchers(
    "/api/auth/**",
    "/swagger-ui/**",
    "/swagger-ui.html",
    "/v3/api-docs/**"
).permitAll()
```

Keep:

```java
.requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
```

- [ ] **Step 2: 运行后端测试**

Run from project root:

```bash
$env:JAVA_HOME='G:\jdk'; .\gradlew.bat :app:test
```

Expected: `BUILD SUCCESSFUL`. The existing `SecurityCorsTest` must still pass because `OPTIONS /**` remains permitted.

- [ ] **Step 3: 更新开发进度文档**

Add under “已完成内容”:

```markdown
| 后端安全 | 已收紧业务接口匿名访问，业务页面请求必须携带登录 Token |
```

Update “技术债与风险”:

```markdown
| 权限技术债 | 登录保护已接入，细粒度用户数据隔离将在下一阶段实现 |
```

- [ ] **Step 4: Commit**

```bash
git add app/src/main/java/com/nbwf/modules/user/config/SecurityConfig.java docs/development-progress.md
git commit -m "fix(security): require authentication for business APIs"
```

---

## Task 9: 端到端验证与最终文档更新

**Files:**
- Modify: `docs/development-progress.md`

- [ ] **Step 1: 运行完整验证命令**

Run backend tests:

```bash
$env:JAVA_HOME='G:\jdk'; .\gradlew.bat :app:test
```

Expected: `BUILD SUCCESSFUL`.

Run frontend build from `frontend/`:

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 2: 手工验证登录注册闭环**

Start backend and frontend using the project’s existing dev commands. Verify:

| 编号 | 操作 | 预期 |
|---:|---|---|
| 1 | 未登录打开 `/upload` | 跳转 `/login` |
| 2 | 在 `/register` 注册新账号 | 保存登录态并进入 `/upload` |
| 3 | 刷新页面 | 仍保持登录状态 |
| 4 | 退出登录 | 清空登录态并跳转 `/login` |
| 5 | 使用已有账号登录 | 进入 `/upload` |
| 6 | 打开简历上传页并调用接口 | 请求头携带 `Authorization: Bearer <token>` |
| 7 | 清空本地存储后访问业务页 | 跳转 `/login` |

- [ ] **Step 3: 更新开发进度文档为完成状态**

Modify `docs/development-progress.md`:

```markdown
| 当前阶段 | 用户模块登录注册闭环已完成，准备进入用户数据隔离阶段 |
| 当前目标 | 推进 `resume / interview / knowledgebase` 用户隔离 |
```

Update current iteration:

```markdown
| 实现状态 | 已完成 |
```

Add recent commits after implementation:

```markdown
| `<new-commit>` | feat | 完成用户登录注册闭环 |
```

Update next smallest target:

```markdown
| 目标 | 开始 `resume` 模块用户数据隔离 |
| 具体任务 | 上传、列表、详情、删除、导出、重分析接口全部接入当前登录用户 |
```

- [ ] **Step 4: Final Commit**

```bash
git add docs/development-progress.md
git commit -m "docs(auth): mark login flow complete"
```

- [ ] **Step 5: Push**

```bash
git push origin master
```

Expected: GitHub `master` receives all authentication implementation commits and the updated progress document.

---

## 验收标准

| 验收点 | 标准 |
|---|---|
| 未登录访问业务页 | 跳转到 `/login` |
| 登录成功 | 进入 `/upload` |
| 注册成功 | 直接登录并进入 `/upload` |
| 刷新页面 | 登录态保持 |
| 退出登录 | 本地状态清空并回到 `/login` |
| 业务请求 | 自动携带 `Authorization: Bearer <token>` |
| 后端业务接口 | 未携带 Token 时被拒绝 |
| 构建验证 | 前端 build 和后端 test 均通过 |
| 文档维护 | `docs/development-progress.md` 与实际开发状态一致 |

