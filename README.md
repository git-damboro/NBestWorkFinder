# NBestWorkFinder

NBestWorkFinder 是一个面向求职者的 AI 求职工作台，目标是把“简历分析、岗位管理、辅助投递、模拟面试、知识库问答”串成一条可实际使用的求职闭环。

项目当前处于二次开发阶段，重点正在从通用面试系统演进为个人求职效率工具。当前主线是辅助投递：通过浏览器插件采集岗位信息，自动导入职位工作台，结合简历与“我的经历”生成可编辑、可复制的 BOSS 开场白，并在系统内记录投递准备、发送和跟进状态。

## 核心定位

| 方向 | 说明 |
| --- | --- |
| 目标用户 | 正在投递实习、校招或社招岗位的求职者 |
| 核心价值 | 降低岗位整理、开场白生成、投递跟进和面试准备的重复成本 |
| 当前重点 | 辅助投递闭环和职位工作台 |
| 边界 | 不做自动投递、不绕过平台登录、不自动发送消息，只做用户可控的辅助操作 |

## 功能模块

| 模块 | 当前能力 |
| --- | --- |
| 用户与登录 | 注册、登录、JWT access token + refresh token 登录态刷新 |
| 简历管理 | 上传简历、解析简历、AI 分析、重新分析、分析报告查看 |
| 我的经历 | 用户维护自己的项目、实习、竞赛、技能等补充经历，供开场白生成使用 |
| 职位草稿 | 从简历生成职位方向草稿，支持进入职位工作台继续维护 |
| 职位工作台 | 管理岗位、状态、标签、薪资、岗位描述、投递记录和跟进时间线 |
| 辅助投递 | 基于岗位、选中简历和启用经历生成 BOSS 开场白草稿，支持复制和标记已投递 |
| 浏览器插件 | Chrome/Edge 未打包插件，优先识别 BOSS 直聘岗位页，采集岗位并导入系统 |
| 模拟面试 | 基于简历和岗位发起定向面试，支持追问、评估和面试历史 |
| 知识库 | 文档上传、向量化、重向量化、RAG 问答、多会话管理 |
| 任务中心 | 查看 AI 生成类任务和异步任务进度 |

## 辅助投递流程

```text
打开 BOSS 岗位页
        ↓
浏览器插件采集岗位信息
        ↓
预览岗位标题、公司、薪资、描述和标签
        ↓
确认导入职位工作台
        ↓
选择简历和启用的“我的经历”
        ↓
生成可编辑的开场白草稿
        ↓
复制后回到原岗位页发送
        ↓
在系统中标记已投递并记录后续跟进
```

职位工作台会显示每个岗位的投递准备状态：

| 状态 | 含义 |
| --- | --- |
| 待发送 | 岗位已导入，有原岗位链接，建议准备并发送开场白 |
| 已准备 | 已复制开场白或已有沟通记录 |
| 待跟进 | 已设置下一次跟进时间 |
| 已进入流程 | 岗位已投递、面试中、Offer 或已拒绝 |
| 待完善 | 手动维护岗位且信息不足，建议补全后再投递 |

## 技术栈

### 后端

| 技术 | 说明 |
| --- | --- |
| Java 21 | 后端开发语言 |
| Spring Boot 4 | Web、Validation、JPA、Security |
| Spring AI 2 | OpenAI 兼容模型调用、pgvector 向量检索 |
| PostgreSQL + pgvector | 业务数据与向量数据存储 |
| Redis / Redisson | 缓存、异步任务和消息处理 |
| RustFS | S3 兼容对象存储 |
| Apache Tika | 简历和知识库文档解析 |
| iText | PDF 报告导出 |
| Gradle | 后端构建工具 |

### 前端

| 技术 | 说明 |
| --- | --- |
| React 18 | 前端 UI 框架 |
| TypeScript 5.6 | 类型系统 |
| Vite 5 | 开发和构建工具 |
| Tailwind CSS 4 | 样式系统 |
| React Router 7 | 前端路由 |
| Framer Motion | 动效 |
| Lucide React | 图标 |
| Recharts | 图表展示 |

### 浏览器插件

| 技术 | 说明 |
| --- | --- |
| Chrome Extension Manifest V3 | 插件基础能力 |
| Content Script | 岗位页面信息采集 |
| Popup | 配置后端地址、读取登录态、预览并导入岗位 |
| 目标浏览器 | Chrome、Edge |

## 项目结构

```text
NBestWorkFinder/
├── app/                         # Spring Boot 后端
│   └── src/main/
│       ├── java/com/nbwf/
│       │   ├── common/          # 通用配置、异常、响应、安全等
│       │   ├── infrastructure/  # 文件、对象存储、Redis、PDF 等基础设施
│       │   └── modules/         # 业务模块
│       │       ├── aigeneration # AI 生成任务
│       │       ├── interview    # 模拟面试
│       │       ├── job          # 职位工作台与投递跟进
│       │       ├── jobdraft     # 职位草稿
│       │       ├── knowledgebase# 知识库与 RAG
│       │       ├── profile      # 用户画像/经历
│       │       ├── resume       # 简历上传与分析
│       │       └── user         # 用户与认证
│       └── resources/
│           ├── application.yml  # 应用配置
│           └── prompts/         # AI 提示词模板
├── frontend/                    # React 前端
│   ├── src/
│   │   ├── api/                 # 请求封装和接口
│   │   ├── components/          # 公共组件
│   │   ├── pages/               # 页面
│   │   ├── types/               # TypeScript 类型
│   │   └── utils/               # 工具函数
│   └── package.json
├── browser-extension/           # Chrome/Edge 辅助投递插件
├── docker/                      # 本地基础设施初始化脚本
├── docs/                        # 开发文档、测试清单和进度记录
├── docker-compose.dev.yml       # 本地开发依赖服务
├── docker-compose.yml           # 容器化部署编排
└── README.md
```

## 本地开发

### 环境要求

| 依赖 | 建议版本 | 必需 |
| --- | --- | --- |
| JDK | 21+ | 是 |
| Node.js | 18+ | 是 |
| npm 或 pnpm | 与前端项目兼容即可 | 是 |
| Docker Desktop | 支持 Docker Compose | 推荐 |
| PostgreSQL + pgvector | 16 或兼容版本 | 是 |
| Redis | 7 或兼容版本 | 是 |
| RustFS 或其他 S3 兼容存储 | 最新稳定版 | 是 |

### 1. 启动开发依赖

推荐使用项目提供的开发编排启动 PostgreSQL、Redis 和 RustFS：

```powershell
docker compose -f docker-compose.dev.yml up -d
```

首次启动 RustFS 后，访问 `http://localhost:9001`，使用 `.env` 或默认账号登录，并创建 bucket：

```text
nbwf
```

### 2. 配置环境变量

复制配置模板：

```powershell
Copy-Item .env.example .env
```

至少需要配置：

| 变量 | 说明 |
| --- | --- |
| `AI_BAILIAN_API_KEY` | 阿里云百炼 DashScope API Key |
| `AI_MODEL` | 可选，默认 `qwen-plus` |
| `POSTGRES_USER` | 可选，默认 `postgres` |
| `POSTGRES_PASSWORD` | 可选，默认 `123456` |
| `POSTGRES_DB` | 可选，默认使用当前配置中的数据库名 |
| `APP_STORAGE_BUCKET` | 可选，默认 `nbwf` |
| `JWT_SECRET` | 生产环境必须替换 |

### 3. 启动后端

Windows PowerShell：

```powershell
.\gradlew.bat :app:bootRun
```

如果本机需要显式指定 JDK：

```powershell
$env:JAVA_HOME='G:\jdk'
.\gradlew.bat :app:bootRun
```

后端默认地址：

```text
http://localhost:8080
```

接口文档：

```text
http://localhost:8080/swagger-ui.html
```

### 4. 启动前端

注意：前端命令需要在 `frontend/` 目录下执行。

```powershell
cd frontend
npm install
npm run dev
```

前端默认地址：

```text
http://localhost:5173
```

### 5. 加载浏览器插件

Chrome：

```text
chrome://extensions/
```

Edge：

```text
edge://extensions/
```

操作步骤：

1. 打开开发者模式。
2. 点击“加载已解压的扩展程序”。
3. 选择项目下的 `browser-extension/` 目录。
4. 确认本地前端和后端都已启动。
5. 登录前端后，在插件中点击“从已登录前端读取 Token”。
6. 打开 BOSS 岗位页，点击“采集当前岗位”，预览无误后导入。

## 常用命令

| 场景 | 命令 |
| --- | --- |
| 启动开发依赖 | `docker compose -f docker-compose.dev.yml up -d` |
| 停止开发依赖 | `docker compose -f docker-compose.dev.yml down` |
| 清理开发依赖数据 | `docker compose -f docker-compose.dev.yml down -v` |
| 后端编译 | `.\gradlew.bat :app:compileJava` |
| 后端测试 | `.\gradlew.bat :app:test` |
| 后端启动 | `.\gradlew.bat :app:bootRun` |
| 前端启动 | `npm --prefix frontend run dev` |
| 前端构建 | `npm --prefix frontend run build` |

## 开发进度文档

| 文档 | 说明 |
| --- | --- |
| `docs/development-progress.md` | 当前开发进度与近期变更 |
| `docs/2026-04-21-投递辅助闭环-手动联调清单.md` | 辅助投递闭环手动测试清单 |
| `docs/2026-04-22-手动测试清单与样本数据.md` | 手动测试入口与样本数据 |
| `docs/2026-04-22-手动测试问题记录.md` | 测试问题记录 |
| `PROJECT_HANDOFF.md` | 项目交接说明 |

## 当前开发重点

| 优先级 | 内容 |
| --- | --- |
| P0 | 稳定辅助投递闭环：插件采集、岗位预览、导入、开场白生成、复制和标记投递 |
| P0 | 优化职位工作台：投递准备状态、筛选、统计入口、跟进时间线 |
| P1 | 强化“我的经历”与简历内容对开场白质量的影响 |
| P1 | 完善知识库问答和会话管理体验 |
| P2 | 整理前端视觉风格，使其与原始项目形成区分 |

## 设计原则

| 原则 | 说明 |
| --- | --- |
| 用户可控 | 系统辅助生成和复制，不替用户自动发送消息 |
| 信息可信 | 开场白不得编造经历，不夸大简历内容 |
| 越用越顺手 | 用户维护的经历、简历和投递记录会逐步提升后续生成质量 |
| 小步迭代 | 优先保证主链路稳定，再逐步增强自动化和体验 |
| 可回滚 | 重要功能按小任务提交，便于定位和回退 |

## 常见问题

### 前端无法启动，提示找不到 `package.json`

前端项目在 `frontend/` 目录下，不能在仓库根目录直接执行 `npm run dev`。

```powershell
cd frontend
npm run dev
```

### 插件导入岗位返回 403

通常是登录 Token 过期或插件没有读取到最新登录态。处理方式：

1. 在前端重新登录。
2. 打开插件，点击“从已登录前端读取 Token”。
3. 再次导入岗位。

### 知识库问答没有检索到内容

优先确认：

| 检查项 | 说明 |
| --- | --- |
| 文档是否上传成功 | 知识库中应能看到文档 |
| 是否完成向量化 | 未向量化或向量化失败会影响检索 |
| 查询是否过短 | 过短关键词可能无法命中，需要补充上下文 |
| Embedding 配置是否正常 | `AI_BAILIAN_API_KEY` 和模型配置需要可用 |

### 简历分析或 AI 生成失败

优先检查：

| 检查项 | 说明 |
| --- | --- |
| API Key | `AI_BAILIAN_API_KEY` 是否配置正确 |
| 后端日志 | 查看模型调用、结构化输出解析或文件解析错误 |
| Redis | 异步任务消费是否正常 |
| PostgreSQL | 任务和分析结果是否写入成功 |

## 许可证

本项目沿用仓库中的 `LICENSE` 文件。
