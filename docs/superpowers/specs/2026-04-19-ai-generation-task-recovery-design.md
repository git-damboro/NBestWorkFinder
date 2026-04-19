# AI 生成任务后台化与自动恢复设计

## 1. 背景

当前项目已经打通了两条关键链路：

| 链路 | 当前状态 |
|---|---|
| 简历详情 → 生成职位草稿 → 保存到职位工作台 | 已完成，但生成结果只存在当前页面状态中 |
| 职位工作台 → 选择简历 → 生成定向面试题 | 已完成，但目标职位只参与出题上下文，没有稳定展示到后续记录中 |

用户发现的问题是：在生成职位草稿或生成面试题期间，如果切换到其他页面，回来后任务状态和结果很容易丢失。从用户体验看，生成动作像是“停止了”。

本设计要解决两个问题：

1. AI 生成任务离开页面后仍在后台继续执行。
2. 用户回到原页面后能自动恢复最近一次任务状态或结果。

同时，延续前一轮已确认的 B 方案：定向面试创建时保存目标职位快照，后续面试记录和详情能够展示“这次面试对应哪个职位”。

## 2. 目标

| 目标 | 说明 |
|---|---|
| 后台继续生成 | 职位草稿和面试题生成不再依赖当前 React 页面生命周期 |
| 自动恢复最近一次任务 | 不做独立任务中心，用户回到相关页面时自动看到最近一次任务的状态 |
| 结果可找回 | 职位草稿生成完成后可再次展示；面试题生成完成后可进入对应会话 |
| 目标职位可追踪 | 定向面试保存 `targetJobId + targetJobTitle + targetJobCompany` 快照 |
| 兼容现有流程 | 普通面试、已有职位工作台、已有简历详情页不被破坏 |

## 3. 非目标

| 不做 | 原因 |
|---|---|
| 不做“任务中心”页面 | 当前阶段先走自动恢复最近一次任务，交付更快 |
| 不保存完整职位 JSON 快照 | 只展示来源职位，`id/title/company` 足够 |
| 不做跨端实时 WebSocket/SSE 推送 | 轮询任务状态即可满足当前体验 |
| 不重构所有 AI 调用 | 只覆盖本轮暴露的问题：职位草稿生成、面试题生成 |

## 4. 核心方案

新增一个通用 AI 生成任务表，使用数据库保存任务状态和结果，使用现有 Redis Stream 异步消费模式执行耗时 AI 任务。

| 层 | 设计 |
|---|---|
| 数据库 | 新增 `ai_generation_tasks`，保存任务状态、请求上下文、结果 JSON、错误信息 |
| 后端任务入口 | 发起生成时立即创建任务并返回 `taskId/status` |
| Redis Stream | 入队任务，后台 Consumer 调用 AI 服务并回写任务结果 |
| 前端恢复 | 页面挂载时按 `type + sourceId + targetId` 查询最近一次任务 |
| 前端轮询 | `PENDING/PROCESSING` 时每 2-3 秒查询一次任务状态 |
| 前端结果 | `COMPLETED` 时恢复弹窗或进入面试会话；`FAILED` 时显示失败与重试 |

## 5. 数据模型

### 5.1 `AiGenerationTaskEntity`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `Long` | 数据库主键 |
| `taskId` | `String` | 对外任务 ID，UUID 风格短字符串 |
| `userId` | `Long` | 所属用户 |
| `type` | `AiGenerationTaskType` | 任务类型 |
| `sourceId` | `Long` | 来源资源 ID：职位草稿用 `resumeId`，面试题生成用 `resumeId` |
| `targetId` | `Long` | 目标资源 ID：面试题生成可存 `jobId`，职位草稿为空 |
| `status` | `AsyncTaskStatus` | `PENDING / PROCESSING / COMPLETED / FAILED` |
| `requestJson` | `TEXT` | 任务请求上下文 |
| `resultJson` | `TEXT` | 任务完成结果 |
| `errorMessage` | `String(500)` | 失败原因 |
| `createdAt` | `LocalDateTime` | 创建时间 |
| `updatedAt` | `LocalDateTime` | 更新时间 |
| `completedAt` | `LocalDateTime` | 完成时间 |

### 5.2 任务类型

| 类型 | 用途 | `sourceId` | `targetId` | `resultJson` |
|---|---|---|---|---|
| `RESUME_JOB_DRAFT` | 根据简历生成职位草稿 | `resumeId` | `null` | `{"drafts":[...]}` |
| `INTERVIEW_SESSION_CREATE` | 后台生成面试题并创建面试会话 | `resumeId` | `jobId` 或 `null` | `{"sessionId":"..."}` |

## 6. 后端接口设计

### 6.1 通用任务查询接口

| 接口 | 说明 |
|---|---|
| `GET /api/ai-generation-tasks/{taskId}` | 查询指定任务 |
| `GET /api/ai-generation-tasks/latest?type=...&sourceId=...&targetId=...` | 查询当前用户最近一次相关任务 |

返回 DTO：

```json
{
  "taskId": "agt_xxx",
  "type": "RESUME_JOB_DRAFT",
  "sourceId": 21,
  "targetId": null,
  "status": "COMPLETED",
  "result": {
    "drafts": []
  },
  "errorMessage": null,
  "createdAt": "2026-04-19T12:00:00",
  "updatedAt": "2026-04-19T12:00:10",
  "completedAt": "2026-04-19T12:00:10"
}
```

### 6.2 职位草稿任务接口

| 接口 | 说明 |
|---|---|
| `POST /api/jobs/draft-tasks/from-resume/{resumeId}` | 创建或复用当前简历正在运行的职位草稿任务 |

规则：

| 场景 | 行为 |
|---|---|
| 同一用户、同一简历已有 `PENDING/PROCESSING` 任务 | 直接返回该任务，避免重复生成 |
| 最近任务已 `COMPLETED/FAILED` | 点击生成时创建新任务 |
| 用户回到简历详情页 | 自动查询最近一次 `RESUME_JOB_DRAFT` 任务并恢复状态 |

原同步接口 `POST /api/jobs/drafts/from-resume/{resumeId}` 保留，用于兼容，但前端改用新异步任务接口。

### 6.3 面试题生成任务接口

| 接口 | 说明 |
|---|---|
| `POST /api/interview/session-tasks` | 创建或复用正在生成的面试会话任务 |

请求体复用现有 `CreateInterviewRequest` 的字段：

```json
{
  "resumeText": "...",
  "resumeId": 21,
  "questionCount": 8,
  "jobId": 10,
  "forceCreate": false
}
```

规则：

| 场景 | 行为 |
|---|---|
| 同一用户、同一简历、同一目标职位已有 `PENDING/PROCESSING` 任务 | 返回正在运行的任务 |
| 后台生成完成 | 创建真实面试会话并把 `sessionId` 写入任务结果 |
| 用户回到 `/interview/{resumeId}` | 自动查询最近一次 `INTERVIEW_SESSION_CREATE` 任务 |
| 任务已完成 | 前端根据 `sessionId` 调用现有 `GET /api/interview/sessions/{sessionId}` 恢复会话 |

现有 `POST /api/interview/sessions` 保留，避免破坏旧调用；前端开始面试按钮切换到新任务接口。

## 7. Redis Stream 设计

在 `AsyncTaskStreamConstants` 中新增：

| 常量 | 值 |
|---|---|
| `AI_GENERATION_STREAM_KEY` | `ai:generation:stream` |
| `AI_GENERATION_GROUP_NAME` | `ai-generation-group` |
| `AI_GENERATION_CONSUMER_PREFIX` | `ai-generation-consumer-` |
| `FIELD_TASK_ID` | `taskId` |

新增组件：

| 文件 | 责任 |
|---|---|
| `AiGenerationStreamProducer` | 任务创建后入队 |
| `AiGenerationStreamConsumer` | 根据任务类型分发到对应业务服务 |

处理逻辑：

| 任务类型 | Consumer 行为 |
|---|---|
| `RESUME_JOB_DRAFT` | 校验任务所属用户与简历归属，调用 `ResumeJobDraftService.generateDrafts`，写入 `resultJson` |
| `INTERVIEW_SESSION_CREATE` | 校验请求上下文，调用面试会话创建内部方法，写入 `sessionId` |

## 8. 面试目标职位快照

为 `InterviewSessionEntity` 补充字段：

| 字段 | 说明 |
|---|---|
| `targetJobId` | 目标职位 ID |
| `targetJobTitle` | 创建面试时的职位名称快照 |
| `targetJobCompany` | 创建面试时的公司名称快照 |

创建定向面试时：

1. 根据 `jobId + userId` 查询职位。
2. 保存 `targetJobId/title/company` 到面试会话。
3. 继续把完整 JD 和标签拼入出题上下文。

展示时：

| 页面 | 展示 |
|---|---|
| 面试记录页 | 表格“关联简历”下方显示目标职位 |
| 简历详情 → 面试详情 | 顶部显示“目标职位：xxx · xxx”卡片 |
| 面试报告详情 | 同用 `InterviewDetailPanel` 展示目标职位 |
| 回跳职位工作台 | 点击按钮跳转 `/jobs`，路由 state 带 `selectedJobId` |

## 9. 前端交互设计

### 9.1 简历详情页生成职位草稿

页面：`frontend/src/pages/ResumeDetailPage.tsx`

| 状态 | UI |
|---|---|
| 无任务 | 按钮显示“生成职位草稿” |
| `PENDING/PROCESSING` | 显示“职位草稿生成中，可先浏览其他页面” |
| `COMPLETED` | 自动恢复草稿弹窗，用户可选择一个保存 |
| `FAILED` | 显示失败原因和“重新生成”按钮 |

恢复规则：

1. 页面挂载时调用 latest task。
2. 如果有运行中任务，开始轮询。
3. 如果任务完成且结果里有草稿，打开 `ResumeJobDraftDialog`。

### 9.2 面试页生成题目

页面：`frontend/src/pages/InterviewPage.tsx`

| 状态 | UI |
|---|---|
| 无任务 | 显示原配置面板 |
| `PENDING/PROCESSING` | 显示“面试题生成中，可切换页面，回来后自动恢复” |
| `COMPLETED` | 根据 `sessionId` 恢复真实面试会话并进入答题页 |
| `FAILED` | 显示失败原因和“重新生成”按钮 |

恢复规则：

1. 页面挂载时根据 `resumeId + jobTarget?.jobId` 查询 latest task。
2. 若任务完成，调用现有 `getSession(sessionId)`。
3. 若任务运行中，轮询直到完成。

### 9.3 非定向面试兼容

| 场景 | 行为 |
|---|---|
| 普通简历面试 | `targetId=null`，仍可后台生成并恢复 |
| 定向职位面试 | `targetId=jobId`，恢复时只恢复对应职位的任务 |
| 没有目标职位信息 | 前端不展示职位来源卡片 |

## 10. 错误处理

| 错误 | 行为 |
|---|---|
| AI 调用失败 | 任务置为 `FAILED`，保存错误信息 |
| Redis 入队失败 | 任务置为 `FAILED` |
| 简历不存在或不属于当前用户 | 任务创建失败，不入队 |
| 职位不存在或不属于当前用户 | 定向面试任务创建失败，不入队 |
| 任务结果 JSON 解析失败 | 前端显示“结果解析失败，请重新生成” |

## 11. 测试策略

| 层 | 测试 |
|---|---|
| 后端任务服务 | 创建任务、复用运行中任务、查询 latest、写入完成结果 |
| 职位草稿后台任务 | Consumer 调用 `ResumeJobDraftService` 后保存草稿结果 |
| 面试题后台任务 | Consumer 创建面试会话后保存 `sessionId`，并写入目标职位快照 |
| 目标职位展示 | `InterviewHistoryService` / `InterviewMapper` 输出目标职位字段 |
| 前端构建 | `npm.cmd run build` |

## 12. 交付顺序

| 顺序 | 内容 | 原因 |
|---:|---|---|
| 1 | 通用 AI 生成任务实体、仓库、服务、查询接口 | 后续两个任务共用 |
| 2 | 职位草稿异步化和自动恢复 | 范围较小，先打通完整闭环 |
| 3 | 面试题生成异步化和自动恢复 | 复用任务基础设施 |
| 4 | 目标职位快照持久化与展示 | 与面试任务完成后保存会话一起落地 |
| 5 | 更新开发进度文档、验证、提交推送 | 保持项目进度可追踪 |

## 13. 自检

| 检查项 | 结果 |
|---|---|
| 是否解决切页面任务丢失 | 是，任务状态和结果进入数据库 |
| 是否避免重复生成 | 是，运行中任务复用 |
| 是否保留历史稳定性 | 是，定向面试保存职位轻量快照 |
| 是否过度设计任务中心 | 否，不新增任务中心页面 |
| 是否兼容已有流程 | 是，旧同步接口保留，前端逐步切换 |
