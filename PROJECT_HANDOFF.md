# NBestWorkFinder 项目交接文档

> 生成时间：2026-04-17
> 用途：AI 开发助手交接，保证开发上下文连续性

---

## 一、项目概况

**定位**：面向求职者的 AI 求职助手平台。用户可以上传简历、收录感兴趣的职位 JD、进行 AI 模拟面试、获取简历与职位的匹配分析。

**GitHub**：https://github.com/git-damboro/NBestWorkFinder.git  
**本地路径**：`E:\Desktop\Work\Java_ALL\projects\AI-FindGoodWork\NBestWorkFinder`  
**分支**：master

---

## 二、技术栈

| 层次 | 技术 |
|------|------|
| 语言 | Java 21 |
| 框架 | Spring Boot 4.0 |
| AI | Spring AI 2.0 + 阿里云百炼（DashScope，OpenAI 兼容模式） |
| AI 模型 | qwen-plus（默认），text-embedding-v3（向量） |
| 数据库 | PostgreSQL 16 + pgvector 插件 |
| 缓存/消息队列 | Redis 7（Redisson 客户端，Redis Stream 做异步任务） |
| 对象存储 | RustFS（兼容 S3 协议，本地开发替代云 OSS） |
| 构建工具 | Gradle（Java 21 toolchain） |
| 包名 | com.nbwf |
| 启动类 | com.nbwf.App |
| 端口 | 8080 |
| 接口文档 | Swagger UI：http://localhost:8080/swagger-ui.html |

---

## 三、本地开发环境

### 3.1 Docker 容器（dev 模式）

```bash
cd NBestWorkFinder
docker-compose -f docker-compose.dev.yml up -d
```

启动三个容器：
- `interview-postgres`：PostgreSQL 16 + pgvector，端口 5432，数据库名 `interview_guide`，密码 `password`
- `interview-redis`：Redis 7，端口 6379
- `interview-rustfs`：RustFS 对象存储，API 端口 9000，控制台端口 9001

**首次启动需要**：浏览器打开 http://localhost:9001，用 `rustfsadmin/rustfsadmin` 登录，手动创建名为 `nbwf` 的 bucket。

### 3.2 IDEA 运行配置

- 主类：`com.nbwf.App`
- JDK：Java 21
- Environment variables（直接粘贴）：

```
AI_BAILIAN_API_KEY=你的阿里云百炼Key;POSTGRES_PASSWORD=password;APP_STORAGE_ACCESS_KEY=rustfsadmin;APP_STORAGE_SECRET_KEY=rustfsadmin
```

### 3.3 application.yml 关键默认值

- DB：`localhost:5432/interview_guide`，用户 `postgres`
- Redis：`localhost:6379`
- RustFS：`http://localhost:9000`，bucket `nbwf`
- AI：`https://dashscope.aliyuncs.com/compatible-mode`，模型 `qwen-plus`

---

## 四、模块结构

```
com.nbwf
├── common/                      # 公共基础设施
│   ├── ai/StructuredOutputInvoker   # AI 结构化输出统一调用（含重试）
│   ├── annotation/RateLimit         # 限流注解
│   ├── aspect/RateLimitAspect       # 限流切面（Redis Lua 脚本）
│   ├── async/                       # Redis Stream 异步任务基类
│   ├── config/                      # CORS、S3、OpenAPI 配置
│   ├── exception/                   # 全局异常处理、BusinessException、ErrorCode
│   └── result/Result                # 统一响应体 {code, message, data}
│
├── infrastructure/
│   ├── export/PdfExportService      # iText8 PDF 导出
│   ├── file/                        # 文件解析、存储、校验、哈希
│   ├── mapper/                      # MapStruct 对象映射
│   └── redis/                       # Redis 缓存工具
│
└── modules/
    ├── user/        # 用户认证模块 ✅
    ├── resume/      # 简历模块 ✅
    ├── interview/   # 模拟面试模块 ✅
    ├── knowledgebase/ # 知识库/RAG 模块 ✅
    └── job/         # 职位管理模块 ✅（新增）
```

---

## 五、各模块详情

### 5.1 user 模块 ✅

**功能**：注册、登录、Token 刷新、登出

**数据表**：`users`（id, email, password, role, created_at, updated_at）

**角色**：`ROLE_USER`（求职者）、`ROLE_ADMIN`（管理员）

**认证机制**：
- Spring Security 6 + JWT（JJWT）
- AccessToken 有效期：15 分钟
- RefreshToken 有效期：7 天，存 Redis
- JWT Filter 提取 userId 作为 principal（`Long` 类型），其他模块通过 `@AuthenticationPrincipal Long userId` 获取

**接口**：
```
POST /api/auth/register   # 注册，body: {email, password}
POST /api/auth/login      # 登录，body: {email, password}
POST /api/auth/refresh    # 刷新，param: refreshToken
POST /api/auth/logout     # 登出（需 Bearer Token）
```

**注意**：`/api/auth/**`、`/swagger-ui/**`、`/v3/api-docs/**` 免认证，其余全部需要 Bearer Token。

---

### 5.2 resume 模块 ✅

**功能**：简历上传、AI 评分分析、历史查询、PDF 导出、删除

**数据表**：`resumes`（含 user_id 字段，但接口层未做 userId 过滤，是待完善项）

**关键流程**：
1. 上传文件（PDF/DOCX/TXT）→ RustFS 存储 → 解析文本
2. 异步（Redis Stream）触发 AI 分析 → 存 `resume_analyses` 表
3. 相同文件（SHA-256 哈希去重）直接返回历史结果

**接口**：
```
POST /api/resumes/upload          # 上传简历（multipart）
GET  /api/resumes                 # 所有简历列表
GET  /api/resumes/{id}/detail     # 简历详情+分析历史
GET  /api/resumes/{id}/export     # 导出 PDF 报告
POST /api/resumes/{id}/reanalyze  # 重新分析
DELETE /api/resumes/{id}          # 删除
```

**待完善**：接口层加 userId 过滤（每个用户只看自己的简历）

---

### 5.3 interview 模块 ✅

**功能**：创建模拟面试会话、AI 出题、提交答案、AI 评估、生成报告、导出 PDF

**数据表**：`interview_sessions`、`interview_answers`（含 user_id 字段，待完善过滤）

**关键流程**：
1. 传入 resumeText + questionCount → AI 生成面试题 → 存 Redis Session
2. 用户逐题作答 → 异步 AI 评估
3. 全部完成 → 生成综合报告

**当前限制**：出题仅基于简历，尚未支持传入 JD 做定向面试（计划改造）

**接口**：
```
POST   /api/interview/sessions               # 创建会话
GET    /api/interview/sessions/{id}          # 会话信息
GET    /api/interview/sessions/{id}/question # 当前题目
POST   /api/interview/sessions/{id}/answers  # 提交答案
PUT    /api/interview/sessions/{id}/answers  # 暂存答案
POST   /api/interview/sessions/{id}/complete # 提前交卷
GET    /api/interview/sessions/{id}/report   # 生成报告
GET    /api/interview/sessions/{id}/details  # 详情
GET    /api/interview/sessions/{id}/export   # 导出 PDF
DELETE /api/interview/sessions/{id}          # 删除
GET    /api/interview/sessions/unfinished/{resumeId}  # 查未完成会话
```

**待完善**：支持传入 JD（jobDescription）字段，出针对该职位的定向面试题

---

### 5.4 knowledgebase 模块 ✅

**功能**：上传文档、向量化（pgvector）、RAG 问答

**数据表**：`knowledge_bases`、`vector_store`、`rag_chat_sessions`、`rag_chat_messages`

**接口**：见 `KnowledgeBaseController`、`RagChatController`

---

### 5.5 job 模块 ✅（本次新增，核心模块）

**定位**：用户私有职位收录。用户把在 Boss直聘等平台看到的职位 JD 粘贴进来保存，围绕 JD 做求职准备。后续自动投递功能投递成功后也直接写入此模块。

**数据表**：`jobs`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | bigint | 主键 |
| user_id | bigint | 所属用户，数据完全隔离 |
| title | varchar(200) | 职位名称 |
| company | varchar(200) | 公司名称 |
| description | text | JD 原文 |
| location | varchar(100) | 地点 |
| salary_min | integer | 最低薪资（元/月） |
| salary_max | integer | 最高薪资（元/月） |
| tech_tags | text | AI 提取的技术标签，逗号分隔 |
| application_status | varchar(20) | 求职状态（见下） |
| notes | text | 用户备注 |
| created_at | timestamp | 创建时间 |
| updated_at | timestamp | 更新时间 |

**求职状态枚举 JobApplicationStatus**：
- `SAVED`：已收藏（默认）
- `APPLIED`：已投递
- `INTERVIEWING`：面试中
- `OFFERED`：已拿 Offer
- `REJECTED`：已拒绝

**接口**：
```
POST   /api/jobs              # 收录职位（粘贴 JD），AI 自动提取技术标签
GET    /api/jobs              # 我的职位列表，?status=SAVED 按状态筛选
GET    /api/jobs/{id}         # 职位详情
PUT    /api/jobs/{id}         # 更新（支持改状态、加备注、改 JD）
DELETE /api/jobs/{id}         # 删除
POST   /api/jobs/{id}/match   # AI 简历匹配分析，?resumeId=xxx
```

**AI 功能**：
- 创建/更新 JD 时自动提取技术标签（`JobTagExtractService`），失败降级为空标签
- `POST /api/jobs/{id}/match?resumeId=xxx`：AI 分析简历与 JD 的匹配度，返回：
  - `overallScore`：匹配分数（0-100）
  - `matchedSkills`：已匹配技术栈
  - `missingSkills`：缺少的技术栈
  - `suggestions`：改进建议列表
  - `summary`：总结

**重要实现注意事项**：
1. **ChatClient 注入方式**：不能直接注入 `ChatClient`，必须注入 `ChatClient.Builder` 并在构造器里 `.build()`：
   ```java
   public XxxService(ChatClient.Builder chatClientBuilder, ...) {
       this.chatClient = chatClientBuilder.build();
   }
   ```
2. **私有 record 不能跨类访问**：如果 Service 返回内部私有 record，调用方拿不到字段。应直接返回公开 DTO 类。
3. **curl 测试中文**：Windows 终端 curl 发中文会用 GBK，服务器 UTF-8 解析失败报 `Invalid UTF-8 start byte`。解决方案：把请求体写成文件再 `-d @file.json`。

---

## 六、ErrorCode 体系

```
1xxx  通用（400/401/403/404/500）
2xxx  简历模块
3xxx  面试模块
4xxx  存储模块
5xxx  导出模块
6xxx  知识库模块
7xxx  AI 服务
8xxx  限流
9xxx  用户模块（9001 邮箱已注册，9002 用户不存在，9003 密码错误，9004/9005 Token 无效）
10xxx 职位模块（10001 职位不存在，10002 职位创建失败）
```

---

## 七、Git 提交历史

```
39d9cb2 fix(job): use ChatClient.Builder constructor instead of direct ChatClient injection
4d3fe86 fix(job): JobMatchService returns JobMatchDTO directly to fix inaccessible private record
69cb766 feat(job): redesign job module as user-private job tracker
611df44 chore: rename project from interview-guide to NBestWorkFinder
5025391 feat(job): add job module with AI tech tag extraction
85fc728 feat(user): add user auth system with Spring Security 6 + JWT
23fce5f init: interview-guide 初始代码
```

---

## 八、下一步开发计划（优先级排序）

### 高优先级
1. **resume 模块改造**：接口层加 userId 过滤，每个用户只能查看/操作自己的简历
2. **interview 模块改造**：`CreateInterviewRequest` 增加可选字段 `jobDescription`，AI 出题时结合 JD 生成定向面试题

### 中优先级
3. **job 模块扩展**：pgvector 语义匹配（比关键词匹配更精准的简历-职位相似度）
4. **自动投递对接**：Boss直聘自动投递成功后，调用 `POST /api/jobs` 直接写入记录，状态设为 `APPLIED`

### 低优先级（第三阶段）
5. XXL-Job 定时任务
6. Kafka 或 RabbitMQ
7. Elasticsearch 职位搜索

---

## 九、代码规范

- **Entity 类**：不用 Lombok，手写 getter/setter，`@PrePersist`/`@PreUpdate` 处理时间
- **Service/Controller**：用 `@RequiredArgsConstructor`（但注入 ChatClient 时例外，见上）
- **DTO**：优先用 Java record
- **AI 调用**：统一走 `StructuredOutputInvoker`，支持重试和错误提示
- **异步任务**：继承 `AbstractStreamConsumer`/`AbstractStreamProducer`，基于 Redis Stream
- **统一响应**：`Result<T>` 包装，始终返回 HTTP 200，用 code 区分业务状态
- **每个小功能完成后立即 commit + push**，不要攒着一起提交
