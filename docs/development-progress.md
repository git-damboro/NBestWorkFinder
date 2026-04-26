# 开发进度文档

> 本文档用于持续记录 `NBestWorkFinder` 当前开发阶段、模块完成度、最近验证结果、下一步优先级与待办事项。  
> 约定：每完成一个模块的小功能，都同步更新本文档，再进行提交与推送。

## 1. 当前阶段

| 项目 | 内容 |
|---|---|
| 项目名称 | `NBestWorkFinder` |
| 当前日期 | `2026-04-26` |
| 当前阶段 | 辅助投递闭环第一版已完成，页面手测回归进行中 |
| 本轮重点 | 已完成投递跟进数据模型、状态变化自动记录、手动跟进日志和前端时间线 |
| 当前主线 | 手测辅助投递闭环：职位导入/新增 → 标记已投递 → 添加沟通记录 → 设置下一步跟进 → 状态推进 |

## 2. 模块进度总览

| 模块 | 状态 | 说明 |
|---|---|---|
| `user` | 已完成 | 注册、登录、刷新令牌、退出登录、前端登录态与路由守卫已完成 |
| `resume` | 已完成 / 已隔离 | 简历上传、解析、分析、历史、详情、删除、导出、重分析已按 `userId` 隔离 |
| `job` | 已完成主链路 / 辅助投递闭环待手测 | 已支持职位工作台、职位详情弹窗、职位编辑、简历匹配、根据简历生成职位草稿、投递跟进时间线和手动跟进记录 |
| `interview` | 已完成主链路 / 已隔离 / 已支持职位定向 | 已支持会话创建、恢复、答题、报告、详情、导出、删除，并支持携带 `jobId` 生成定向面试题 |
| `knowledgebase` | 已完成 / 已隔离 | 知识库上传、列表、查询、下载、删除、分类、RAG 会话已接入 `userId` |
| `frontend` | 持续完善中 | 已补齐未完成面试续答、草稿导入前编辑、知识库下载/对话失败提示、职位详情弹窗、任务中心提示、重向量化入口和问答助手会话交互 |
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
| UX-002：职位详情弹窗 | `JobManagePage` 已将职位详情从页面右侧/底部区域改为大弹窗，职位列表改为多列卡片布局，弹窗内保留编辑、简历匹配、定向面试、删除入口 |
| 辅助投递闭环 | 新增职位投递跟进记录后端闭环、状态变化自动记录、手动跟进日志、职位详情时间线和快捷状态动作 |

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
| `2026-04-23` | `$env:JAVA_HOME='G:\\jdk'; .\\gradlew.bat :app:test --tests "com.nbwf.modules.interview.service.InterviewQuestionServiceTest" --tests "com.nbwf.modules.interview.service.InterviewSessionServiceTest"` | 通过，验证面试题数量与会话链路修复 |
| `2026-04-23` | `frontend -> npm.cmd run build`（草稿编辑、知识库下载/对话提示修复后） | 通过，仍存在既有 CSS minify warning 与大 chunk warning |
| `2026-04-23` | `$env:JAVA_HOME='G:\\jdk'; .\\gradlew.bat :app:compileJava` | 通过，验证 `bootRun` JVM 护栏与职位草稿导入日志改动可编译 |
| `2026-04-25` | `frontend -> npm.cmd run build`（职位详情弹窗第一版） | 通过，仍存在既有 CSS minify warning 与大 chunk warning |
| `2026-04-25` | `$env:JAVA_HOME='G:\\jdk'; .\\gradlew.bat :app:test --tests "com.nbwf.modules.aigeneration.config.AiGenerationTaskSchemaInitializerSqlTest"` | 通过，验证 AI 任务类型约束校准 SQL |
| `2026-04-25` | `$env:JAVA_HOME='G:\\jdk'; .\\gradlew.bat :app:test --tests "com.nbwf.modules.jobdraft.service.JobDraftServiceLatestBatchTest"` | 通过，验证职位草稿最近批次恢复无数据/多数据场景 |
| `2026-04-25` | `$env:JAVA_HOME='G:\\jdk'; .\\gradlew.bat :app:compileJava` | 通过，验证职位草稿最近批次查询改动可编译 |
| `2026-04-25` | `frontend -> npm.cmd run build`（BUG-011、BUG-012、BUG-013 三次前端小修复后） | 三次均通过，仍存在既有 CSS minify warning 与大 chunk warning |
| `2026-04-26` | `frontend -> npm.cmd run build`（品牌名称与 Logo 轻改后） | 通过，仍存在既有 CSS minify warning 与大 chunk warning |
| `2026-04-26` | `$env:JAVA_HOME='G:\\jdk'; .\\gradlew.bat :app:test --tests "com.nbwf.modules.jobdraft.service.JobDraftServiceUpdateItemTest"` | 红绿验证通过，确认职位草稿手动编辑不再创建 AI 生成任务 |
| `2026-04-26` | `$env:JAVA_HOME='G:\\jdk'; .\\gradlew.bat :app:test --tests "com.nbwf.modules.jobdraft.service.JobDraftServiceUpdateItemTest" --tests "com.nbwf.modules.jobdraft.service.JobDraftServiceLatestBatchTest" --tests "com.nbwf.modules.jobdraft.service.JobDraftServiceImportItemsTest"` | 通过，验证职位草稿编辑、最近批次、导入链路 |
| `2026-04-26` | `frontend -> npm.cmd run build`（职位草稿编辑接口切换后） | 通过，仍存在既有 CSS minify warning 与大 chunk warning |
| `2026-04-26` | `$env:JAVA_HOME='G:\\jdk'; .\\gradlew.bat :app:test --tests "com.nbwf.modules.job.service.JobFollowUpServiceTest" --tests "com.nbwf.modules.job.service.JobServiceFollowUpTest"` | 通过，验证投递跟进手动记录、状态变化自动记录和用户隔离 |
| `2026-04-26` | `frontend -> npm.cmd run build`（投递跟进时间线与操作入口后） | 通过，仍存在既有 CSS minify warning 与大 chunk warning |

## 6. 当前优先级

| 优先级 | 模块 | 任务 | 说明 |
|---:|---|---|---|
| P0 | `job / jobdraft` | 手测辅助投递闭环和 `BUG-010` | 投递跟进第一版已完成；仍需页面手测确认编辑、空态、时间线和快捷状态动作 |
| P1 | `knowledgebase / rag-chat` | 回归 `BUG-011` | `BUG-012`、`BUG-013` 已手测通过；剩余知识库问答发送链路待确认 |
| P1 | `backend` | 优先处理后端功能稳定性 | 前端大改暂停，仅保留品牌轻改；后续重心回到后端功能 |
| P1 | `tests` | 补更多跨用户隔离与恢复回归测试 | 强化权限与链路稳定性 |
| P2 | `frontend` | 分析大包与 chunk warning | 当前不阻塞交付，后续单独做性能优化 |

## 7. 下一最小目标

| 项目 | 内容 |
|---|---|
| 目标 | 完成辅助投递闭环手测 |
| 具体任务 | 跑通职位导入/新增、标记已投递、添加跟进记录、设置下一步跟进、状态推进 |
| 完成标准 | 时间线记录正确，职位快照时间正确，状态筛选和详情弹窗刷新正确 |

## 8. 已识别风险与注意点

| 类型 | 内容 | 当前结论 |
|---|---|---|
| 并发创建 | 同一简历短时间重复点击可能创建重复任务 | 当前通过业务键本地锁与运行中任务复用降低风险；多实例场景后续可补数据库约束或分布式锁 |
| DTO 暴露 | 任务 DTO 若返回请求体可能泄露不必要数据 | 已收窄，前端只拿到状态、结果、错误信息 |
| 历史数据兼容 | 旧面试会话没有目标职位快照字段 | 新字段统一按可空处理，兼容旧数据 |
| 轮询清理 | 页面切换或状态切换时若不清理轮询，容易污染状态 | 职位草稿页与面试页都已统一清理定时器 |
| 构建告警 | 仍存在 Gradle deprecated 提示、前端 CSS/chunk warning | 当前不影响功能交付，后续专项处理 |
| GitHub 推送 | 远端网络连接此前多次失败 | 最近一次重试显示 `Everything up-to-date`，后续仍可能因网络波动需要重试 |

## 9. 最近提交记录

| Commit | 类型 | 说明 |
|---|---|---|
| `031d5e3` | fix | 支持职位草稿导入前编辑 |
| `20f474e` | fix | 知识库下载增加反馈和下载中状态 |
| `577b9cc` | fix | 限制本地 `bootRun` 堆并补充草稿导入日志 |
| `9fabcb7` | fix | 知识库对话页显示请求失败提示 |
| `5a1985e` | feat | 职位详情改为大弹窗展示，并同步手测文档 |
| `52dd319` | fix | 校准 AI 生成任务类型数据库约束 |
| `529d502` | fix | 修复重新分析按钮和开始面试跳转空页兜底 |
| `c4f35e5` | fix | 修复问答会话和重向量化入口第一轮问题 |
| `1701547` | fix | 草稿生成接入任务状态提示，并修复最近批次恢复查询 |
| `3b697cd` | fix | 已有回答内容时忽略流关闭阶段的 network error |
| `90c5431` | fix | 重向量化入口改为明确文字按钮并补反馈 |
| `c4a09b3` | fix | 问答助手新增/切换/改名补交互状态 |
| `本次提交` | style | 前端品牌名称与 Logo 轻改 |
| `本次提交` | fix | 职位草稿手动编辑绕开 AI 生成任务 |
| `本轮提交` | feat | 新增投递跟进数据模型 |
| `本轮提交` | feat | 新增投递跟进记录后端闭环 |
| `本轮提交` | feat | 展示职位投递跟进时间线 |
| `本轮提交` | feat | 支持添加投递跟进记录 |

## 10. 文档维护规则

| 时机 | 必做动作 |
|---|---|
| 开始新任务前 | 更新“当前优先级”“下一最小目标”“AI 生成任务推进状态” |
| 完成一个小功能后 | 更新“本轮已完成内容”“最近验证结果”“最近提交记录” |
| 提交代码前 | 确认文档与当前代码状态一致 |
| 推送 GitHub 前 | 确认文档已随代码一起提交 |
