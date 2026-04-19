# 开发进度文档

> 本文档用于持续记录 `NBestWorkFinder` 当前开发阶段、模块完成度、最近验证结果、下一步优先级与待办事项。  
> 约定：每完成一个模块的小功能，都同步更新本文档，再进行提交与推送。

## 1. 当前阶段

| 项目 | 内容 |
|---|---|
| 项目名称 | `NBestWorkFinder` |
| 当前日期 | `2026-04-19` |
| 当前阶段 | 用户认证闭环已完成，核心业务进入“简历 → 职位 → 面试 → 记录/报告”的链路完善阶段 |
| 本轮重点 | 将 AI 长耗时能力改造成后台任务，解决“切页后任务中断、回到页面后找不到结果”的体验问题 |
| 当前主线 | 已完成“职位草稿后台生成 + 面试题后台生成 + 页面自动恢复最近任务 + 面试目标职位快照持久化” |

## 2. 模块进度总览

| 模块 | 状态 | 说明 |
|---|---|---|
| `user` | 已完成 | 注册、登录、刷新令牌、退出登录、前端登录态与路由守卫已完成 |
| `resume` | 已完成 / 已隔离 | 简历上传、解析、分析、历史、详情、删除、导出、重分析已按 `userId` 隔离 |
| `job` | 已完成主链路 | 已支持职位工作台、职位详情、职位编辑、简历匹配、根据简历生成职位草稿并保存到工作台 |
| `interview` | 已完成主链路 / 已隔离 / 已支持职位定向 | 已支持会话创建、恢复、答题、报告、详情、导出、删除，并支持携带 `jobId` 生成定向面试题 |
| `knowledgebase` | 已完成 / 已隔离 | 知识库上传、列表、查询、下载、删除、分类、RAG 会话已接入 `userId` |
| `frontend` | 持续完善中 | 简历详情页职位草稿自动恢复完成；面试页后台任务恢复完成 |
| `ai-generation` | 本轮核心已完成 | 通用任务基础设施、职位草稿后台任务、面试题后台任务、查询与恢复接口均已完成 |
| `security` | 持续完善中 | 核心资源需登录访问，主要用户数据隔离已完成，后续继续补跨用户拒绝场景测试 |

## 3. 本轮已完成内容

| 分类 | 已完成项 |
|---|---|
| 设计 | 新增 AI 生成任务后台化设计文档：`docs/superpowers/specs/2026-04-19-ai-generation-task-recovery-design.md` |
| 计划 | 新增 AI 生成任务实施计划：`docs/superpowers/plans/2026-04-19-ai-generation-task-recovery.md` |
| Task1：通用基础设施 | 新增 `AiGenerationTaskEntity`、`AiGenerationTaskType`、`AiGenerationTaskDTO`、`AiGenerationTaskRepository`、`AiGenerationTaskService`、`AiGenerationTaskController` |
| Task2：职位草稿后台任务 | 新增 `AiGenerationStreamProducer` / `AiGenerationStreamConsumer`，职位草稿生成已改为 Redis Stream 后台消费并回写任务结果 |
| Task2：前端恢复 | `ResumeDetailPage` 已支持创建职位草稿任务、轮询任务状态、切页后自动恢复最近任务结果 |
| Task3：面试题后台任务 | 新增 `/api/interview/session-tasks`，面试题生成已改为后台任务，消费者完成后回写 `sessionId` |
| Task3：目标职位快照 | `InterviewSessionEntity` 新增 `targetJobId / targetJobTitle / targetJobCompany`，并在创建会话时持久化 |
| Task3：面试报告透传 | `InterviewReportDTO`、`InterviewSessionDTO`、`InterviewDetailDTO` 已补充目标职位快照字段 |
| Task4：前端自动恢复 | `InterviewPage` 已支持创建后台任务、轮询任务状态、返回页面自动恢复最近面试题任务 |
| 前端体验优化 | 面试配置页已明确提示“后台生成中，可切换页面，回来自动恢复” |

## 4. AI 生成任务推进状态

| 任务 | 状态 | 说明 |
|---|---|---|
| Task1：通用 AI 生成任务基础设施 | 已完成 | 底座、查询接口、状态流转、测试均已完成 |
| Task2：职位草稿后台任务 | 已完成 | 已支持创建任务、后台执行、结果回写、前端轮询与自动恢复 |
| Task3：面试题后台任务 + 目标职位快照 | 已完成 | 面试题生成改为后台任务，目标职位快照已持久化并向 DTO 输出 |
| Task4：前端自动恢复 + 文档维护 | 已完成第一轮 | 简历详情页与面试页都已具备任务恢复能力，文档已同步维护 |

## 5. 最近验证结果

| 时间 | 验证项 | 结果 |
|---|---|---|
| `2026-04-19` | `:app:test --tests "com.nbwf.modules.interview.service.InterviewSessionServiceTest" --tests "com.nbwf.modules.aigeneration.listener.AiGenerationStreamConsumerTest"` 红灯验证 | 通过，确认缺少面试异步任务接口、目标职位快照字段、消费者接入 |
| `2026-04-19` | `:app:test --tests "com.nbwf.modules.interview.service.InterviewSessionServiceTest" --tests "com.nbwf.modules.aigeneration.listener.AiGenerationStreamConsumerTest" --tests "com.nbwf.modules.interview.service.InterviewPersistenceServiceTest"` | 通过 |
| `2026-04-19` | `frontend -> npm.cmd run build`（面试页后台任务改造后） | 通过，仍存在既有 CSS minify warning 与大 chunk warning，不影响本次交付 |

## 6. 当前优先级

| 优先级 | 模块 | 任务 | 说明 |
|---:|---|---|---|
| P0 | `history / report` | 前端展示目标职位快照 | 让“职位 → 面试 → 历史/报告”链路在 UI 上完整可见 |
| P0 | `interview` | 完善任务恢复边界处理 | 补充更多失败提示、重复恢复、异常结果解析场景 |
| P1 | `job + interview` | 继续打磨职位工作台到面试链路 | 例如从职位卡片直接跳转历史、回看对应面试记录 |
| P1 | `tests` | 补更多跨用户隔离与恢复回归测试 | 强化权限与链路稳定性 |
| P2 | `frontend` | 分析大包与 chunk warning | 当前不阻塞交付，后续单独做性能优化 |

## 7. 下一最小目标

| 项目 | 内容 |
|---|---|
| 目标 | 完成历史页 / 详情页 / 报告页的目标职位信息展示 |
| 具体任务 | 补充前端 `InterviewHistoryPage`、`InterviewDetailPanel` 等页面的目标职位卡片与跳转入口 |
| 完成标准 | 用户能在面试历史、详情、报告中明确看到该次面试对应的目标职位 |

## 8. 已识别风险与注意点

| 类型 | 内容 | 当前结论 |
|---|---|---|
| 并发创建 | 同一简历短时间重复点击可能创建重复任务 | 当前通过业务键本地锁与运行中任务复用降低风险；多实例场景后续可补数据库约束或分布式锁 |
| DTO 暴露 | 任务 DTO 若返回请求体可能泄露不必要数据 | 已收窄，前端只拿到状态、结果、错误信息 |
| 历史数据兼容 | 旧面试会话没有目标职位快照字段 | 新字段统一按可空处理，兼容旧数据 |
| 轮询清理 | 页面切换或状态切换时若不清理轮询，容易污染状态 | 职位草稿页与面试页都已统一清理定时器 |
| 构建告警 | 仍存在 Gradle deprecated 提示、前端 CSS/chunk warning | 当前不影响功能交付，后续专项处理 |
| GitHub 推送 | 远端网络连接此前多次失败 | 本地提交正常，推送时需重试 `git push origin master` |

## 9. 最近提交记录

| Commit | 类型 | 说明 |
|---|---|---|
| `d58a425` | docs | 新增 AI 生成任务后台化设计文档 |
| `d5d40d2` | docs | 新增 AI 生成任务实施计划文档 |
| `e39ab94` | feat | 通用 AI 生成任务基础设施（Task1） |
| `198b7a9` | feat | 职位草稿后台任务与简历详情页自动恢复（Task2） |
| `当前提交` | feat | 面试题后台任务、目标职位快照、面试页自动恢复（Task3 / Task4） |

## 10. 文档维护规则

| 时机 | 必做动作 |
|---|---|
| 开始新任务前 | 更新“当前优先级”“下一最小目标”“AI 生成任务推进状态” |
| 完成一个小功能后 | 更新“本轮已完成内容”“最近验证结果”“最近提交记录” |
| 提交代码前 | 确认文档与当前代码状态一致 |
| 推送 GitHub 前 | 确认文档已随代码一起提交 |
