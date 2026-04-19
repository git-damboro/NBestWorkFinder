# 开发进度文档

> 本文档用于持续记录 `NBestWorkFinder` 的当前开发阶段、模块完成情况、最近验证结果、后续优先级与待开发事项。  
> 约定：每完成一个模块的小功能，都同步更新本文档后再提交代码。

## 1. 当前阶段

| 项目 | 内容 |
|---|---|
| 项目名称 | `NBestWorkFinder` |
| 当前日期 | `2026-04-19` |
| 当前阶段 | 用户认证闭环已完成，核心业务进入“简历 → 职位 → 面试”的连续使用链路完善阶段 |
| 本轮重点 | 将 AI 生成型能力改造成后台任务，解决“切页后任务丢失、回来找不到结果”的体验问题 |
| 当前主线 | 完成“职位草稿后台生成 + 面试题后台生成 + 自动恢复最近任务 + 面试目标职位快照展示” |

## 2. 模块进度总览

| 模块 | 状态 | 说明 |
|---|---|---|
| `user` | 已完成 | 注册、登录、刷新令牌、退出登录、前端登录态与路由守卫已完成 |
| `resume` | 已完成 / 已隔离 | 简历上传、解析、分析、历史、详情、删除、导出、重分析已按 `userId` 隔离 |
| `job` | 已完成工作台主链路 | 已支持职位工作台、职位详情、职位编辑、简历匹配、根据简历生成职位草稿并保存到工作台 |
| `interview` | 已完成主链路 / 已隔离 / 已支持职位定向 | 已支持会话创建、恢复、答题、报告、详情、导出、删除，并支持携带 `jobId` 生成定向题目 |
| `knowledgebase` | 已完成 / 已隔离 | 知识库上传、列表、查询、下载、删除、分类、RAG 会话已接入 `userId` |
| `frontend` | 进行中 | 已打通“简历到职位”“职位到面试”两条联动链路，当前继续完善后台任务恢复体验 |
| `ai-generation` | 进行中 | 已完成通用任务基础设施与职位草稿后台任务，待继续接入面试题后台生成 |
| `security` | 进行中 | 核心资源需登录访问且已完成用户隔离，后续补更多跨用户拒绝场景测试 |

## 3. 本轮已完成内容

| 分类 | 已完成项 |
|---|---|
| 设计 | 新增 AI 生成任务后台化设计文档：`docs/superpowers/specs/2026-04-19-ai-generation-task-recovery-design.md` |
| 计划 | 新增 AI 生成任务实施计划：`docs/superpowers/plans/2026-04-19-ai-generation-task-recovery.md` |
| `ai-generation` 基础设施 | 新增 `AiGenerationTaskEntity`、`AiGenerationTaskType`、`AiGenerationTaskDTO`、`AiGenerationTaskRepository`、`AiGenerationTaskService`、`AiGenerationTaskController` |
| 通用常量 | 在 `AsyncTaskStreamConstants` 中补充 AI 生成任务相关字段常量与 Stream 常量 |
| 测试 | 新增 `AiGenerationTaskServiceTest`，覆盖运行中任务复用、新建 `PENDING` 任务、最近任务查询、`getTask` 用户范围查询、未找到任务抛错 |
| 质量修正 | 收窄任务 DTO 暴露字段，避免不必要返回 `userId/requestJson`；为任务创建增加业务键本地锁，降低同实例并发重复创建风险 |
| `job + ai-generation` 后台任务 | 新增 `AiGenerationStreamProducer` / `AiGenerationStreamConsumer`，职位草稿生成已改为 Redis Stream 后台消费并回写任务结果 |
| `job` 后端接口 | 新增 `/api/jobs/draft-tasks/from-resume/{resumeId}`，保留旧同步接口兼容 |
| `frontend` 职位草稿恢复 | 新增 AI 生成任务 API 与类型；简历详情页已支持创建职位草稿任务、轮询任务状态、切页回来自动恢复最近任务结果 |

## 4. AI 生成任务方案推进状态

| 任务 | 状态 | 说明 |
|---|---|---|
| Task1：通用 AI 生成任务基础设施 | 已完成 | 底座、查询接口、基础测试已落地 |
| Task2：职位草稿后台任务 | 已完成 | 已支持创建任务、后台执行、结果 JSON 回写、前端轮询与自动恢复 |
| Task3：面试题后台任务 + 目标职位快照 | 待开发 | 将“创建面试会话时同步出题”改为后台任务，并持久化目标职位轻量快照 |
| Task4：前端自动恢复 + 文档验证 | 部分完成 | 简历详情页职位草稿恢复已完成；面试页恢复待 Task3 接入后继续完成 |

## 5. 最近验证结果

| 时间 | 验证项 | 结果 |
|---|---|---|
| `2026-04-19` | `:app:test --tests "com.nbwf.modules.aigeneration.service.AiGenerationTaskServiceTest"` 红灯验证 | 通过，确认缺少 `AiGenerationTaskEntity / Repository / Service` 等实现 |
| `2026-04-19` | `:app:test --tests "com.nbwf.modules.aigeneration.service.AiGenerationTaskServiceTest"` 绿灯验证 | 通过 |
| `2026-04-19` | `AiGenerationTaskServiceTest` 质量修正后二次回归 | 通过 |
| `2026-04-19` | 规格审查（Task1） | 通过 |
| `2026-04-19` | 代码质量审查（Task1） | 发现 2 个 Important 问题，均已修复并回归 |
| `2026-04-19` | `:app:test --tests "com.nbwf.modules.job.service.JobServiceDraftsTest" --tests "com.nbwf.modules.aigeneration.listener.AiGenerationStreamConsumerTest" --tests "com.nbwf.modules.aigeneration.service.AiGenerationTaskServiceTest"` | 通过 |
| `2026-04-19` | `frontend -> npm.cmd run build`（职位草稿后台任务接入后） | 通过；仍有既有 CSS minify 与大 chunk 警告 |
| `2026-04-19` | `ResumeJobDraftServiceTest` | 通过 |
| `2026-04-19` | `JobServiceDraftsTest` | 通过 |
| `2026-04-19` | `frontend -> npm.cmd run build` | 通过 |

## 6. 当前优先级

| 优先级 | 模块 | 任务 | 说明 |
|---:|---|---|---|
| P0 | `interview + ai-generation` | 把面试题生成切成后台任务 | 当前同步出题耗时长，且切页后体验像任务停止 |
| P0 | `interview` | 持久化 `targetJobId + targetJobTitle + targetJobCompany` | 让面试记录、详情、报告能明确知道这次面试对应哪个职位 |
| P1 | `frontend` | 自动恢复最近一次任务 | 简历详情页职位草稿已完成，下一步完成面试页最近面试题生成任务恢复 |
| P1 | `history / report` | 展示目标职位来源信息 | 完善“职位 → 面试 → 记录/报告”的结果追踪链路 |
| P2 | `tests` | 补更多跨用户拒绝和链路回归测试 | 在现有隔离基础上继续补稳 |

## 7. 下一最小目标

| 项目 | 内容 |
|---|---|
| 目标 | 完成 Task3：面试题后台任务 + 目标职位快照 |
| 具体任务 | 新增面试题生成任务创建接口、后台创建会话、任务结果回写 `sessionId`，并持久化目标职位轻量快照 |
| 完成标准 | 用户发起面试题生成后，即使切换页面，后台也继续执行；返回面试页后可恢复最近任务，并在记录/详情中看到目标职位 |

## 8. 已识别风险与注意点

| 类型 | 内容 | 当前结论 |
|---|---|---|
| 并发创建 | 同一简历短时间重复点击可能创建重复任务 | Task1 已通过串行化事务降低风险，Task2 接入时还需结合业务层幂等复用继续验证 |
| DTO 暴露 | 任务 DTO 若返回请求体，可能暴露不必要数据 | Task1 已收窄，只保留前端真正需要的状态与结果字段 |
| 历史数据兼容 | 后续面试会话新增目标职位快照字段，历史数据为空 | 统一按可选字段处理，避免前端渲染异常 |
| 前端轮询泄漏 | 页面切换或弹窗关闭时若不清理轮询，容易产生状态污染 | Task2 / Task4 实现时必须统一清理定时器 |
| 构建告警 | 现有构建仍有 Gradle deprecated 提示 | 当前不影响功能交付，后续单独处理 |

## 9. 最近提交记录

| Commit | 类型 | 说明 |
|---|---|---|
| `d58a425` | docs | 新增 AI 生成任务后台化设计文档 |
| `d5d40d2` | docs | 新增 AI 生成任务实施计划文档 |
| `e39ab94` | feat | 通用 AI 生成任务基础设施（Task1） |
| `待本次提交` | feat | 职位草稿后台任务与简历详情页自动恢复（Task2 / Task4 部分） |

## 10. 文档维护规则

| 时机 | 必做动作 |
|---|---|
| 开始新任务前 | 更新“当前优先级”“下一最小目标”“AI 生成任务推进状态” |
| 完成一个小功能后 | 更新“本轮已完成内容”“最近验证结果”“最近提交记录” |
| 提交代码前 | 确认文档与当前代码状态一致 |
| 推送 GitHub 前 | 确认文档已随代码一起提交 |
