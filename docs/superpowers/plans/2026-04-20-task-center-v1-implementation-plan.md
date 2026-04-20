# 任务中心 V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增统一任务中心页面，并把职位草稿生成、面试会话生成、BOSS 当前页同步、JD 补全统一纳入一套任务记录、列表查看、结果跳转与失败重试流程。

**Architecture:** 后端继续复用现有 `AiGenerationTaskEntity` / `AiGenerationTaskService`，扩展任务类型、列表查询和重试能力；同步型任务（当前页同步、JD 补全）在原业务接口内创建并更新任务记录，异步型任务（职位草稿生成、面试会话生成）继续沿用现有 Stream 机制。前端新增 `/tasks` 页面，统一展示任务列表，并提供筛选、查看结果、重试失败任务与刷新能力。

**Tech Stack:** Java 21、Spring Boot、Spring Data JPA、React、TypeScript、Vite、Tailwind CSS、Chrome Extension（现有 `browser-extension` 仅保持兼容）。

---

## 代码结构与职责

| 文件 | 操作 | 职责 |
|---|---|---|
| `app/src/main/java/com/nbwf/modules/aigeneration/model/AiGenerationTaskType.java` | 修改 | 新增任务类型枚举 |
| `app/src/main/java/com/nbwf/modules/aigeneration/model/AiGenerationTaskDTO.java` | 可选修改 | 若需要补充前端显示字段则扩展 DTO |
| `app/src/main/java/com/nbwf/modules/aigeneration/repository/AiGenerationTaskRepository.java` | 修改 | 新增最近任务列表查询 |
| `app/src/main/java/com/nbwf/modules/aigeneration/service/AiGenerationTaskService.java` | 修改 | 新增任务列表查询、重置重试基础能力 |
| `app/src/main/java/com/nbwf/modules/aigeneration/service/AiGenerationTaskRetryService.java` | 新建 | 统一封装重试执行逻辑，避免 `AiGenerationTaskService` 与业务服务形成循环依赖 |
| `app/src/main/java/com/nbwf/modules/aigeneration/AiGenerationTaskController.java` | 修改 | 暴露任务列表与重试接口 |
| `app/src/main/java/com/nbwf/modules/jobdraft/service/JobDraftService.java` | 修改 | 为当前页同步、草稿 JD 补全接入任务记录 |
| `app/src/main/java/com/nbwf/modules/job/service/JobService.java` | 修改 | 为正式职位 JD 补全接入任务记录 |
| `app/src/main/java/com/nbwf/modules/interview/service/InterviewSessionService.java` | 可能修改 | 若重试需要复用内部任务创建/发送逻辑，则补充可复用入口 |
| `app/src/test/java/com/nbwf/modules/aigeneration/service/AiGenerationTaskServiceTest.java` | 修改 | 覆盖列表查询和重试基础逻辑 |
| `app/src/test/java/com/nbwf/modules/aigeneration/service/AiGenerationTaskRetryServiceTest.java` | 新建 | 覆盖不同任务类型重试行为 |
| `frontend/src/types/ai-generation-task.ts` | 修改 | 扩展任务类型枚举，声明任务中心筛选类型 |
| `frontend/src/api/aiGenerationTasks.ts` | 修改 | 新增任务列表、重试接口 |
| `frontend/src/api/index.ts` | 修改 | 导出任务中心 API |
| `frontend/src/pages/TaskCenterPage.tsx` | 新建 | 任务中心主页面 |
| `frontend/src/App.tsx` | 修改 | 注册 `/tasks` 路由 |
| `frontend/src/components/Layout.tsx` | 修改 | 侧边栏新增“任务中心”入口 |
| `docs/DEVELOPMENT_PROGRESS.md` | 修改 | 记录任务中心 V1 进度 |

---

## Task 1：补齐后端任务中心基础能力

**Files:**
- Modify: `app/src/main/java/com/nbwf/modules/aigeneration/model/AiGenerationTaskType.java`
- Modify: `app/src/main/java/com/nbwf/modules/aigeneration/repository/AiGenerationTaskRepository.java`
- Modify: `app/src/main/java/com/nbwf/modules/aigeneration/service/AiGenerationTaskService.java`
- Modify: `app/src/main/java/com/nbwf/modules/aigeneration/AiGenerationTaskController.java`
- Modify: `app/src/test/java/com/nbwf/modules/aigeneration/service/AiGenerationTaskServiceTest.java`

- [ ] **Step 1: 扩展任务类型枚举**

将 `AiGenerationTaskType` 从两个类型扩展为四个：

```java
public enum AiGenerationTaskType {
    RESUME_JOB_DRAFT,
    INTERVIEW_SESSION_CREATE,
    JOB_DRAFT_PAGE_SYNC,
    JOB_DRAFT_DETAIL_SYNC
}
```

- [ ] **Step 2: 新增最近任务列表查询仓库方法**

在 `AiGenerationTaskRepository` 中新增按用户查询最近任务的方法，保持 V1 简单，不做复杂分页：

```java
List<AiGenerationTaskEntity> findTop50ByUserIdOrderByUpdatedAtDesc(Long userId);

List<AiGenerationTaskEntity> findTop50ByUserIdAndTypeInAndStatusInOrderByUpdatedAtDesc(
    Long userId,
    List<AiGenerationTaskType> types,
    List<AsyncTaskStatus> statuses
);
```

如果不想同时支持双筛选组合，可以先退一步，做两层内存过滤：

```java
List<AiGenerationTaskEntity> findTop50ByUserIdOrderByUpdatedAtDesc(Long userId);
```

然后在 service 里用 Java Stream 过滤类型与状态。

- [ ] **Step 3: 在 `AiGenerationTaskService` 中新增任务列表与重试准备能力**

新增三个方法：

```java
@Transactional(readOnly = true)
public List<AiGenerationTaskDTO> listRecentTasks(Long userId) {
    return aiGenerationTaskRepository.findTop50ByUserIdOrderByUpdatedAtDesc(userId)
        .stream()
        .map(this::toDTO)
        .toList();
}

@Transactional
public AiGenerationTaskEntity resetForRetry(String taskId, Long userId) {
    AiGenerationTaskEntity task = findTaskOrThrow(taskId, userId);
    task.setStatus(AsyncTaskStatus.PENDING);
    task.setErrorMessage(null);
    task.setCompletedAt(null);
    task.setResultJson(null);
    return aiGenerationTaskRepository.save(task);
}

@Transactional(readOnly = true)
public String getRequestJson(String taskId, Long userId) {
    return findTaskOrThrow(taskId, userId).getRequestJson();
}
```

`resetForRetry` 是后续重试服务的基础，不在这里直接注入 `JobDraftService` / `InterviewSessionService`，避免循环依赖。

- [ ] **Step 4: 扩展控制器，新增列表接口**

在 `AiGenerationTaskController` 中新增：

```java
@GetMapping
@Operation(summary = "查询最近任务列表")
public Result<List<AiGenerationTaskDTO>> listTasks(@AuthenticationPrincipal Long userId) {
    return Result.success(aiGenerationTaskService.listRecentTasks(userId));
}
```

V1 先不做复杂查询参数；如实现顺手，可加可选参数：

```java
@RequestParam(required = false) AiGenerationTaskType type,
@RequestParam(required = false) AsyncTaskStatus status
```

但前端也可先拉全量 50 条，再本地筛选。

- [ ] **Step 5: 扩展控制器，预留重试入口**

先把控制器入口立起来，具体实现留给 Task 2 的重试服务：

```java
private final AiGenerationTaskRetryService aiGenerationTaskRetryService;

@PostMapping("/{taskId}/retry")
@Operation(summary = "重试失败任务")
public Result<AiGenerationTaskDTO> retryTask(@PathVariable String taskId,
                                             @AuthenticationPrincipal Long userId) {
    return Result.success(aiGenerationTaskRetryService.retry(taskId, userId));
}
```

- [ ] **Step 6: 为 `AiGenerationTaskServiceTest` 补充基础测试**

新增两个单测：

```java
@Test
void listRecentTasksShouldReturnDtosOrderedByUpdatedAtDesc() {
    when(aiGenerationTaskRepository.findTop50ByUserIdOrderByUpdatedAtDesc(7L))
        .thenReturn(List.of(laterTask, earlierTask));

    var actual = aiGenerationTaskService.listRecentTasks(7L);

    assertEquals(2, actual.size());
    assertEquals("agt_later", actual.get(0).taskId());
}

@Test
void resetForRetryShouldClearResultAndFailureState() {
    when(aiGenerationTaskRepository.findByTaskIdAndUserId("agt_retry", 7L))
        .thenReturn(Optional.of(failedTask));
    when(aiGenerationTaskRepository.save(any(AiGenerationTaskEntity.class)))
        .thenAnswer(invocation -> invocation.getArgument(0));

    var actual = aiGenerationTaskService.resetForRetry("agt_retry", 7L);

    assertEquals(AsyncTaskStatus.PENDING, actual.getStatus());
    assertNull(actual.getErrorMessage());
    assertNull(actual.getResultJson());
    assertNull(actual.getCompletedAt());
}
```

- [ ] **Step 7: 运行后端单测验证基础任务服务**

Run:

```powershell
$env:JAVA_HOME='G:\jdk'; .\gradlew.bat :app:test --tests "com.nbwf.modules.aigeneration.service.AiGenerationTaskServiceTest"
```

Expected: 相关测试通过。

- [ ] **Step 8: Commit**

```bash
git add app/src/main/java/com/nbwf/modules/aigeneration app/src/test/java/com/nbwf/modules/aigeneration/service/AiGenerationTaskServiceTest.java
git commit -m "feat: 补齐任务中心后端基础能力"
```

---

## Task 2：接入扩展同步、JD 补全与统一重试

**Files:**
- Create: `app/src/main/java/com/nbwf/modules/aigeneration/service/AiGenerationTaskRetryService.java`
- Modify: `app/src/main/java/com/nbwf/modules/jobdraft/service/JobDraftService.java`
- Modify: `app/src/main/java/com/nbwf/modules/job/service/JobService.java`
- Modify: `app/src/main/java/com/nbwf/modules/interview/service/InterviewSessionService.java`（仅当需要暴露可复用重试入口）
- Create: `app/src/test/java/com/nbwf/modules/aigeneration/service/AiGenerationTaskRetryServiceTest.java`

- [ ] **Step 1: 新建统一重试服务，避免循环依赖**

创建 `AiGenerationTaskRetryService`，注入：

```java
private final AiGenerationTaskService aiGenerationTaskService;
private final AiGenerationStreamProducer aiGenerationStreamProducer;
private final JobDraftService jobDraftService;
private final JobService jobService;
private final InterviewSessionService interviewSessionService;
private final ObjectMapper objectMapper;
```

主方法：

```java
@Transactional
public AiGenerationTaskDTO retry(String taskId, Long userId) {
    AiGenerationTaskEntity task = aiGenerationTaskService.resetForRetry(taskId, userId);
    return switch (task.getType()) {
        case RESUME_JOB_DRAFT -> retryResumeJobDraft(task, userId);
        case INTERVIEW_SESSION_CREATE -> retryInterviewSessionCreate(task, userId);
        case JOB_DRAFT_PAGE_SYNC -> retryPageSync(task, userId);
        case JOB_DRAFT_DETAIL_SYNC -> retryDetailSync(task, userId);
    };
}
```

异步任务重试时继续复用原 `taskId`：

```java
private AiGenerationTaskDTO retryResumeJobDraft(AiGenerationTaskEntity task, Long userId) {
    aiGenerationStreamProducer.sendTask(task);
    return aiGenerationTaskService.getTask(task.getTaskId(), userId);
}
```

- [ ] **Step 2: 在 `JobDraftService` 为“当前页同步”接入任务记录**

将现有：

```java
public JobDraftBatchCreatedDTO createBatchFromPageSync(CreateDraftBatchFromPageSyncRequest req, Long userId)
```

改造成内部先创建任务、再执行原逻辑、最后回写任务状态。推荐结构：

```java
public JobDraftBatchCreatedDTO createBatchFromPageSync(CreateDraftBatchFromPageSyncRequest req, Long userId) {
    AiGenerationTaskEntity task = aiGenerationTaskService.createOrReuseTask(
        userId,
        AiGenerationTaskType.JOB_DRAFT_PAGE_SYNC,
        req.resumeId() != null ? req.resumeId() : 0L,
        null,
        toJson(req)
    );

    aiGenerationTaskService.markProcessing(task.getTaskId(), userId);
    try {
        JobDraftBatchCreatedDTO result = doCreateBatchFromPageSync(req, userId);
        aiGenerationTaskService.markCompleted(task.getTaskId(), userId, toJson(Map.of(
            "batchId", result.batchId(),
            "resumeId", result.resumeId(),
            "taskId", task.getTaskId(),
            "sourcePlatform", req.sourcePlatform()
        )));
        return result;
    } catch (Exception error) {
        aiGenerationTaskService.markFailed(task.getTaskId(), userId, limitError(error.getMessage()));
        throw error;
    }
}
```

把原有业务主体迁移为私有方法：

```java
private JobDraftBatchCreatedDTO doCreateBatchFromPageSync(CreateDraftBatchFromPageSyncRequest req, Long userId)
```

- [ ] **Step 3: 在 `JobDraftService` 为“草稿 JD 补全”接入任务记录**

将现有：

```java
public JobDraftItemDTO syncItemDetail(String draftItemId, JobDraftDetailSyncRequest req, Long userId)
```

改造成：

```java
public JobDraftItemDTO syncItemDetail(String draftItemId, JobDraftDetailSyncRequest req, Long userId) {
    JobDraftItemEntity item = itemRepository.findByDraftItemIdAndUserId(draftItemId, userId)
        .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "职位草稿不存在"));

    AiGenerationTaskEntity task = aiGenerationTaskService.createOrReuseTask(
        userId,
        AiGenerationTaskType.JOB_DRAFT_DETAIL_SYNC,
        item.getId(),
        item.getImportedJobId(),
        toJson(Map.of("draftItemId", draftItemId, "request", req))
    );

    aiGenerationTaskService.markProcessing(task.getTaskId(), userId);
    try {
        JobDraftItemDTO result = doSyncItemDetail(item, req, userId);
        aiGenerationTaskService.markCompleted(task.getTaskId(), userId, toJson(Map.of(
            "batchId", result.batchId(),
            "draftItemId", result.draftItemId(),
            "jobId", result.importedJobId(),
            "targetKind", result.importedJobId() != null ? "JOB" : "DRAFT"
        )));
        return result;
    } catch (Exception error) {
        aiGenerationTaskService.markFailed(task.getTaskId(), userId, limitError(error.getMessage()));
        throw error;
    }
}
```

- [ ] **Step 4: 在 `JobService` 为“正式职位 JD 补全”接入任务记录**

现有 `syncDetail` 已经是正式职位补全入口，可以在内部包装任务：

```java
public JobDetailDTO syncDetail(Long id, JobDetailSyncRequest req, Long userId) {
    AiGenerationTaskEntity task = aiGenerationTaskService.createOrReuseTask(
        userId,
        AiGenerationTaskType.JOB_DRAFT_DETAIL_SYNC,
        id,
        id,
        objectMapper.writeValueAsString(req)
    );

    aiGenerationTaskService.markProcessing(task.getTaskId(), userId);
    try {
        JobDetailDTO result = doSyncDetail(id, req, userId);
        aiGenerationTaskService.markCompleted(task.getTaskId(), userId, objectMapper.writeValueAsString(Map.of(
            "jobId", result.id(),
            "targetKind", "JOB"
        )));
        return result;
    } catch (Exception error) {
        aiGenerationTaskService.markFailed(task.getTaskId(), userId, limitError(error.getMessage()));
        throw error;
    }
}
```

把原补全逻辑拆成私有 `doSyncDetail(...)`，这样 retry 时也能复用。

- [ ] **Step 5: 在重试服务中实现四类任务的重试**

同步任务使用 `requestJson` 重新执行；异步任务重新入 Stream。

参考实现：

```java
private AiGenerationTaskDTO retryPageSync(AiGenerationTaskEntity task, Long userId) {
    CreateDraftBatchFromPageSyncRequest request = objectMapper.readValue(
        task.getRequestJson(),
        CreateDraftBatchFromPageSyncRequest.class
    );
    jobDraftService.createBatchFromPageSync(request, userId);
    return aiGenerationTaskService.getTask(task.getTaskId(), userId);
}

private AiGenerationTaskDTO retryDetailSync(AiGenerationTaskEntity task, Long userId) {
    JsonNode root = objectMapper.readTree(task.getRequestJson());
    if (task.getTargetId() != null) {
        JobDetailSyncRequest request = objectMapper.treeToValue(root, JobDetailSyncRequest.class);
        jobService.syncDetail(task.getSourceId(), request, userId);
    } else {
        String draftItemId = root.get("draftItemId").asText();
        JobDraftDetailSyncRequest request = objectMapper.treeToValue(root.get("request"), JobDraftDetailSyncRequest.class);
        jobDraftService.syncItemDetail(draftItemId, request, userId);
    }
    return aiGenerationTaskService.getTask(task.getTaskId(), userId);
}
```

如果“正式职位补全”和“草稿补全”都使用 `JOB_DRAFT_DETAIL_SYNC` 容易混淆，可在 `requestJson/resultJson` 中额外写入 `targetKind`。

- [ ] **Step 6: 为重试服务补充单测**

创建 `AiGenerationTaskRetryServiceTest`，至少覆盖：

```java
@Test
void retryResumeJobDraftShouldResetAndResendToStream() { ... }

@Test
void retryPageSyncShouldReplayOriginalRequest() { ... }

@Test
void retryDetailSyncShouldReplayDraftRequest() { ... }
```

重点校验：

- `resetForRetry` 被调用
- 正确分发到对应业务服务
- 返回的是更新后的 `AiGenerationTaskDTO`

- [ ] **Step 7: 运行后端任务中心相关测试**

Run:

```powershell
$env:JAVA_HOME='G:\jdk'; .\gradlew.bat :app:test --tests "com.nbwf.modules.aigeneration.service.AiGenerationTaskServiceTest" --tests "com.nbwf.modules.aigeneration.service.AiGenerationTaskRetryServiceTest"
```

Expected: 新增和扩展的任务中心服务测试通过。

- [ ] **Step 8: Commit**

```bash
git add app/src/main/java/com/nbwf/modules/aigeneration app/src/main/java/com/nbwf/modules/job app/src/main/java/com/nbwf/modules/jobdraft app/src/main/java/com/nbwf/modules/interview app/src/test/java/com/nbwf/modules/aigeneration
git commit -m "feat: 接入统一任务中心后端任务追踪"
```

---

## Task 3：新增前端任务中心页面与 API

**Files:**
- Modify: `frontend/src/types/ai-generation-task.ts`
- Modify: `frontend/src/api/aiGenerationTasks.ts`
- Modify: `frontend/src/api/index.ts`
- Create: `frontend/src/pages/TaskCenterPage.tsx`

- [ ] **Step 1: 扩展前端任务类型**

在 `frontend/src/types/ai-generation-task.ts` 中补齐任务类型：

```ts
export type AiGenerationTaskType =
  | 'RESUME_JOB_DRAFT'
  | 'INTERVIEW_SESSION_CREATE'
  | 'JOB_DRAFT_PAGE_SYNC'
  | 'JOB_DRAFT_DETAIL_SYNC';
```

如需前端筛选选项，可同时声明：

```ts
export type TaskFilterStatus = 'ALL' | AiGenerationTaskStatus;
export type TaskFilterType = 'ALL' | AiGenerationTaskType;
```

- [ ] **Step 2: 扩展任务 API**

在 `frontend/src/api/aiGenerationTasks.ts` 中新增：

```ts
async listTasks(): Promise<AiGenerationTask[]> {
  return request.get<AiGenerationTask[]>('/api/ai-generation/tasks');
},

async retryTask(taskId: string): Promise<AiGenerationTask> {
  return request.post<AiGenerationTask>(`/api/ai-generation/tasks/${taskId}/retry`);
},
```

- [ ] **Step 3: 新建 `TaskCenterPage.tsx`**

页面状态建议：

```ts
const [tasks, setTasks] = useState<AiGenerationTask[]>([]);
const [loading, setLoading] = useState(true);
const [actionLoadingTaskId, setActionLoadingTaskId] = useState<string | null>(null);
const [typeFilter, setTypeFilter] = useState<'ALL' | AiGenerationTaskType>('ALL');
const [statusFilter, setStatusFilter] = useState<'ALL' | AiGenerationTaskStatus>('ALL');
const [error, setError] = useState<string | null>(null);
```

核心加载逻辑：

```ts
const loadTasks = useCallback(async () => {
  setLoading(true);
  setError(null);
  try {
    const data = await aiGenerationTaskApi.listTasks();
    setTasks(data);
  } catch (requestError) {
    setError(getErrorMessage(requestError));
  } finally {
    setLoading(false);
  }
}, []);
```

建议在页面内实现以下辅助函数：

```ts
function getTaskTypeLabel(type: AiGenerationTaskType): string { ... }
function getTaskStatusLabel(status: AiGenerationTaskStatus): string { ... }
function parseTaskResult(task: AiGenerationTask): Record<string, unknown> | null { ... }
function getTaskResultPath(task: AiGenerationTask): string | null { ... }
```

页面 UI 参考 `JobDraftPage.tsx` 的卡片 + 列表风格，包含：

- 顶部统计卡：全部、进行中、失败、已完成
- 筛选区：任务类型 / 状态
- 列表区：任务类型、来源对象、状态、更新时间、错误信息、操作按钮
- 行内按钮：`查看结果`、`重试`

- [ ] **Step 4: 为“查看结果”实现路径映射**

页面中集中做路径映射，不分散在多个组件：

```ts
function getTaskResultPath(task: AiGenerationTask): string | null {
  const result = parseTaskResult(task);
  if (!result) return null;

  switch (task.type) {
    case 'RESUME_JOB_DRAFT':
    case 'JOB_DRAFT_PAGE_SYNC':
      return typeof result.batchId === 'string' ? `/jobs/drafts?batchId=${encodeURIComponent(result.batchId)}` : null;
    case 'JOB_DRAFT_DETAIL_SYNC':
      if (typeof result.batchId === 'string') {
        return `/jobs/drafts?batchId=${encodeURIComponent(result.batchId)}`;
      }
      if (typeof result.jobId === 'number') {
        return '/jobs';
      }
      return null;
    case 'INTERVIEW_SESSION_CREATE':
      return '/interviews';
    default:
      return null;
  }
}
```

V1 不强制支持 `/jobs?selectedJobId=` 精准高亮；如果现有职位页已经支持 `location.state.selectedJobId`，可以在点击“查看结果”时用 `navigate('/jobs', { state: { selectedJobId: result.jobId } })`。

- [ ] **Step 5: 为“重试”实现行内动作**

```ts
const handleRetry = async (taskId: string) => {
  setActionLoadingTaskId(taskId);
  setError(null);
  try {
    await aiGenerationTaskApi.retryTask(taskId);
    await loadTasks();
  } catch (requestError) {
    setError(getErrorMessage(requestError));
  } finally {
    setActionLoadingTaskId(null);
  }
};
```

V1 建议只允许 `FAILED` 任务显示重试按钮。

- [ ] **Step 6: 运行前端构建验证页面与类型**

Run:

```powershell
cd frontend
npm.cmd run build
```

Expected: TypeScript 与 Vite 构建通过。

- [ ] **Step 7: Commit**

```bash
git add frontend/src/types/ai-generation-task.ts frontend/src/api/aiGenerationTasks.ts frontend/src/api/index.ts frontend/src/pages/TaskCenterPage.tsx
git commit -m "feat: 新增任务中心页面与前端接口"
```

---

## Task 4：接通任务中心路由、侧边栏入口与最小恢复体验

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Layout.tsx`
- Modify: `docs/DEVELOPMENT_PROGRESS.md`

- [ ] **Step 1: 在路由中注册任务中心页面**

在 `frontend/src/App.tsx` 中新增懒加载：

```ts
const TaskCenterPage = lazy(() => import('./pages/TaskCenterPage'));
```

并注册受保护路由：

```tsx
<Route path="tasks" element={<TaskCenterPage />} />
```

- [ ] **Step 2: 在侧边栏新增“任务中心”入口**

在 `Layout.tsx` 的“简历与面试”导航组或新增“系统”导航组中加入：

```ts
{
  id: 'tasks',
  path: '/tasks',
  label: '任务中心',
  icon: ClipboardList,
  description: '统一查看后台任务状态'
}
```

如果 `ClipboardList` 已被“职位草稿”占用，也可以改用 `ListChecks` / `Activity` 等现有图标。

- [ ] **Step 3: 为任务中心加最小自动刷新**

在 `TaskCenterPage.tsx` 中加一个轻量轮询，只在存在 `PENDING` / `PROCESSING` 任务时启用：

```ts
useEffect(() => {
  if (!tasks.some(task => task.status === 'PENDING' || task.status === 'PROCESSING')) {
    return;
  }
  const timer = window.setInterval(() => {
    void loadTasks();
  }, 5000);
  return () => window.clearInterval(timer);
}, [tasks, loadTasks]);
```

这能让用户不必手动频繁刷新，但也不会把所有页面都改成持续轮询。

- [ ] **Step 4: 更新开发进度文档**

在 `docs/DEVELOPMENT_PROGRESS.md` 中把“任务中心”状态更新为：

```md
| 2026-04-20 | 任务中心 V1 | 已完成 / 进行中 | 已统一展示职位草稿生成、面试生成、当前页同步、JD 补全任务 |
```

同时调整“当前重点”优先级，把后续工作切换到：

- 扩展状态增强
- 职位草稿页补全状态筛选
- 任务中心体验增强（通知、批量操作放到后续）

- [ ] **Step 5: 做最小集成验证**

Run:

```powershell
$env:JAVA_HOME='G:\jdk'; .\gradlew.bat :app:compileJava
cd frontend
npm.cmd run build
```

Expected:

- 后端编译成功
- 前端构建成功
- 任务中心页面可访问

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/Layout.tsx docs/DEVELOPMENT_PROGRESS.md
git commit -m "feat: 接通任务中心入口与页面路由"
```

---

## Task 5：收尾验证与回归检查

**Files:**
- Verify only

- [ ] **Step 1: 回归已有任务发起流程**

人工验证以下链路没有被破坏：

1. 简历详情页生成职位草稿仍可正常跳到职位草稿页
2. 面试页生成面试会话仍可正常恢复
3. 扩展同步当前页职位仍可成功创建草稿批次
4. 扩展补全当前 JD 仍可成功更新草稿项

- [ ] **Step 2: 验证任务中心展示四类任务**

人工检查任务中心至少能看到：

- `RESUME_JOB_DRAFT`
- `INTERVIEW_SESSION_CREATE`
- `JOB_DRAFT_PAGE_SYNC`
- `JOB_DRAFT_DETAIL_SYNC`

- [ ] **Step 3: 验证失败任务重试**

选择一个失败任务，点击“重试”，确认：

- 状态从 `FAILED` 变成 `PENDING/PROCESSING`
- 完成后可进入结果页

- [ ] **Step 4: 运行最终校验命令**

Run:

```powershell
git diff --check
$env:JAVA_HOME='G:\jdk'; .\gradlew.bat :app:compileJava
cd frontend
npm.cmd run build
```

Expected: 全部通过，仅允许 LF/CRLF 提示，不应有真正的 diff 格式错误。

- [ ] **Step 5: Final Commit**

```bash
git add app frontend docs
git commit -m "feat: 新增统一任务中心V1"
```

---

## 风险与实现注意点

| 风险 | 处理建议 |
|---|---|
| `AiGenerationTaskService` 与业务服务循环依赖 | 用独立的 `AiGenerationTaskRetryService` 承接重试分发 |
| 同步接口内部创建任务后又被 retry 调回自己 | 通过 `requestJson` + 私有 `doXxx()` 方法拆开“记录任务”和“执行业务” |
| `sourceId` 非空约束与页面同步任务不天然匹配 | 对“未选简历”的页面同步先用 `0L` 占位，结果跳转以 `resultJson` 为准 |
| 老任务没有 `resultJson` 上下文 | 前端兼容展示，但不强制支持“查看结果” |
| 扩展仍保留本地 `lastTask` 状态 | V1 允许并存，不要求本轮移除；以后再逐步改为读取系统任务中心 |

