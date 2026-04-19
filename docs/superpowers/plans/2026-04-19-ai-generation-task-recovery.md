# AI 生成任务后台化与自动恢复 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让“职位草稿生成”和“面试题生成”在切换页面后继续后台执行，并在用户返回相关页面时自动恢复最近一次任务；同时为定向面试保存并展示目标职位快照。

**Architecture:** 新增一个通用 `ai_generation_tasks` 持久化层，复用现有 Redis Stream 生产/消费模板执行耗时 AI 任务。职位草稿与面试题生成统一改为“创建任务 → 后台消费 → 写回结果 → 前端轮询恢复”，其中定向面试在会话实体中额外保存 `targetJobId + targetJobTitle + targetJobCompany` 轻量快照，供历史列表、详情页和报告页展示。

**Tech Stack:** Spring Boot 4 / Java 21 / Spring Data JPA / Redis Stream / JUnit 5 / Mockito / React 18 / TypeScript / Vite

---

## File Map

| 文件 | 动作 | 责任 |
|---|---|---|
| `app/src/main/java/com/nbwf/modules/aigeneration/model/AiGenerationTaskEntity.java` | Create | 通用 AI 生成任务实体 |
| `app/src/main/java/com/nbwf/modules/aigeneration/model/AiGenerationTaskType.java` | Create | 任务类型枚举 |
| `app/src/main/java/com/nbwf/modules/aigeneration/model/AiGenerationTaskDTO.java` | Create | 前后端查询任务状态 DTO |
| `app/src/main/java/com/nbwf/modules/aigeneration/repository/AiGenerationTaskRepository.java` | Create | 任务查询与 latest 复用查询 |
| `app/src/main/java/com/nbwf/modules/aigeneration/service/AiGenerationTaskService.java` | Create | 任务创建、复用、查询、状态流转 |
| `app/src/main/java/com/nbwf/modules/aigeneration/AiGenerationTaskController.java` | Create | 通用任务查询接口 |
| `app/src/main/java/com/nbwf/modules/aigeneration/listener/AiGenerationStreamProducer.java` | Create | 任务统一入队 |
| `app/src/main/java/com/nbwf/modules/aigeneration/listener/AiGenerationStreamConsumer.java` | Create | 后台执行职位草稿 / 面试题生成 |
| `app/src/main/java/com/nbwf/common/constant/AsyncTaskStreamConstants.java` | Modify | 新增 AI 生成任务 stream 常量 |
| `app/src/main/java/com/nbwf/modules/job/JobController.java` | Modify | 新增职位草稿异步任务接口 |
| `app/src/main/java/com/nbwf/modules/interview/InterviewController.java` | Modify | 新增面试题异步任务接口 |
| `app/src/main/java/com/nbwf/modules/interview/model/InterviewSessionEntity.java` | Modify | 保存目标职位快照 |
| `app/src/main/java/com/nbwf/modules/interview/model/InterviewSessionDTO.java` | Modify | 增加目标职位信息 |
| `app/src/main/java/com/nbwf/modules/interview/model/InterviewReportDTO.java` | Modify | 增加目标职位信息 |
| `app/src/main/java/com/nbwf/modules/interview/model/InterviewDetailDTO.java` | Modify | 增加目标职位信息 |
| `app/src/main/java/com/nbwf/modules/interview/service/InterviewSessionService.java` | Modify | 拆出内部创建逻辑，支持后台任务创建会话 |
| `app/src/main/java/com/nbwf/modules/interview/service/InterviewHistoryService.java` | Modify | 详情 DTO 回填目标职位信息 |
| `app/src/main/java/com/nbwf/infrastructure/mapper/InterviewMapper.java` | Modify | 历史列表项补充目标职位信息 |
| `app/src/test/java/com/nbwf/modules/aigeneration/service/AiGenerationTaskServiceTest.java` | Create | 任务创建 / 复用 / 查询 latest 单测 |
| `app/src/test/java/com/nbwf/modules/aigeneration/listener/AiGenerationStreamConsumerTest.java` | Create | Consumer 回写职位草稿和面试会话结果 |
| `app/src/test/java/com/nbwf/modules/interview/service/InterviewSessionServiceTest.java` | Modify | 定向面试会话保存目标职位快照 |
| `app/src/test/java/com/nbwf/modules/interview/service/InterviewHistoryServiceTest.java` | Modify | 详情输出目标职位信息 |
| `frontend/src/types/ai-generation-task.ts` | Create | AI 任务类型、状态和结果 |
| `frontend/src/api/aiGenerationTasks.ts` | Create | 通用任务查询 API |
| `frontend/src/api/index.ts` | Modify | 导出新 API |
| `frontend/src/api/jobs.ts` | Modify | 创建职位草稿任务接口 |
| `frontend/src/api/interview.ts` | Modify | 创建面试题任务接口 |
| `frontend/src/api/history.ts` | Modify | 面试列表 / 详情补充目标职位信息字段 |
| `frontend/src/types/interview.ts` | Modify | 面试会话 / 报告补充目标职位信息 |
| `frontend/src/pages/ResumeDetailPage.tsx` | Modify | 自动恢复最近一次职位草稿任务 |
| `frontend/src/pages/InterviewPage.tsx` | Modify | 自动恢复最近一次面试题生成任务 |
| `frontend/src/components/InterviewConfigPanel.tsx` | Modify | 生成中提示改为“后台继续生成” |
| `frontend/src/pages/InterviewHistoryPage.tsx` | Modify | 列表展示目标职位信息 |
| `frontend/src/components/InterviewDetailPanel.tsx` | Modify | 详情页展示目标职位卡片与回跳入口 |
| `docs/development-progress.md` | Modify | 更新本轮进度、验证结果和下一优先级 |

---

### Task 1: 搭建通用 AI 生成任务基础设施

**Files:**
- Create: `app/src/main/java/com/nbwf/modules/aigeneration/model/AiGenerationTaskEntity.java`
- Create: `app/src/main/java/com/nbwf/modules/aigeneration/model/AiGenerationTaskType.java`
- Create: `app/src/main/java/com/nbwf/modules/aigeneration/model/AiGenerationTaskDTO.java`
- Create: `app/src/main/java/com/nbwf/modules/aigeneration/repository/AiGenerationTaskRepository.java`
- Create: `app/src/main/java/com/nbwf/modules/aigeneration/service/AiGenerationTaskService.java`
- Create: `app/src/main/java/com/nbwf/modules/aigeneration/AiGenerationTaskController.java`
- Create: `app/src/test/java/com/nbwf/modules/aigeneration/service/AiGenerationTaskServiceTest.java`
- Modify: `app/src/main/java/com/nbwf/common/constant/AsyncTaskStreamConstants.java`

- [ ] **Step 1: 先写失败测试，锁定“同类运行中任务复用 + latest 查询”行为**

```java
package com.nbwf.modules.aigeneration.service;

import com.nbwf.common.model.AsyncTaskStatus;
import com.nbwf.modules.aigeneration.model.AiGenerationTaskDTO;
import com.nbwf.modules.aigeneration.model.AiGenerationTaskEntity;
import com.nbwf.modules.aigeneration.model.AiGenerationTaskType;
import com.nbwf.modules.aigeneration.repository.AiGenerationTaskRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AiGenerationTaskServiceTest {

    @Mock
    private AiGenerationTaskRepository repository;

    @InjectMocks
    private AiGenerationTaskService service;

    @Test
    void createOrReuseTaskShouldReturnExistingRunningTask() {
        AiGenerationTaskEntity existing = new AiGenerationTaskEntity();
        existing.setTaskId("agt_existing");
        existing.setUserId(7L);
        existing.setType(AiGenerationTaskType.RESUME_JOB_DRAFT);
        existing.setSourceId(21L);
        existing.setStatus(AsyncTaskStatus.PROCESSING);

        when(repository.findFirstByUserIdAndTypeAndSourceIdAndTargetIdAndStatusInOrderByCreatedAtDesc(
            7L,
            AiGenerationTaskType.RESUME_JOB_DRAFT,
            21L,
            null,
            java.util.List.of(AsyncTaskStatus.PENDING, AsyncTaskStatus.PROCESSING)
        )).thenReturn(Optional.of(existing));

        AiGenerationTaskDTO task = service.createOrReuseTask(
            7L,
            AiGenerationTaskType.RESUME_JOB_DRAFT,
            21L,
            null,
            "{\"resumeId\":21}"
        );

        assertEquals("agt_existing", task.taskId());
    }

    @Test
    void createOrReuseTaskShouldCreatePendingTaskWhenNoRunningTask() {
        when(repository.findFirstByUserIdAndTypeAndSourceIdAndTargetIdAndStatusInOrderByCreatedAtDesc(
            7L,
            AiGenerationTaskType.INTERVIEW_SESSION_CREATE,
            21L,
            31L,
            java.util.List.of(AsyncTaskStatus.PENDING, AsyncTaskStatus.PROCESSING)
        )).thenReturn(Optional.empty());
        when(repository.save(any(AiGenerationTaskEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AiGenerationTaskDTO task = service.createOrReuseTask(
            7L,
            AiGenerationTaskType.INTERVIEW_SESSION_CREATE,
            21L,
            31L,
            "{\"resumeId\":21,\"jobId\":31}"
        );

        ArgumentCaptor<AiGenerationTaskEntity> captor = ArgumentCaptor.forClass(AiGenerationTaskEntity.class);
        verify(repository).save(captor.capture());
        assertEquals(AsyncTaskStatus.PENDING, captor.getValue().getStatus());
        assertEquals("agt_", task.taskId().substring(0, 4));
    }
}
```

- [ ] **Step 2: 运行测试，确认先失败**

Run:

```powershell
$env:JAVA_HOME='G:\jdk'
$env:Path="$env:JAVA_HOME\bin;$env:Path"
.\gradlew.bat :app:test --tests "com.nbwf.modules.aigeneration.service.AiGenerationTaskServiceTest"
```

Expected:

```text
FAIL with "cannot find symbol AiGenerationTaskService / AiGenerationTaskEntity / AiGenerationTaskType"
```

- [ ] **Step 3: 写最小实现，先让任务实体、仓库、服务、查询接口成型**

```java
// app/src/main/java/com/nbwf/modules/aigeneration/model/AiGenerationTaskType.java
package com.nbwf.modules.aigeneration.model;

public enum AiGenerationTaskType {
    RESUME_JOB_DRAFT,
    INTERVIEW_SESSION_CREATE
}
```

```java
// app/src/main/java/com/nbwf/modules/aigeneration/model/AiGenerationTaskDTO.java
package com.nbwf.modules.aigeneration.model;

import com.nbwf.common.model.AsyncTaskStatus;

import java.time.LocalDateTime;

public record AiGenerationTaskDTO(
    String taskId,
    AiGenerationTaskType type,
    Long sourceId,
    Long targetId,
    AsyncTaskStatus status,
    String resultJson,
    String errorMessage,
    LocalDateTime createdAt,
    LocalDateTime updatedAt,
    LocalDateTime completedAt
) {}
```

```java
// app/src/main/java/com/nbwf/modules/aigeneration/model/AiGenerationTaskEntity.java
@Entity
@Table(name = "ai_generation_tasks", indexes = {
    @Index(name = "idx_ai_generation_user_type_created", columnList = "user_id,type,created_at"),
    @Index(name = "idx_ai_generation_task_id", columnList = "task_id", unique = true)
})
public class AiGenerationTaskEntity {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "task_id", nullable = false, unique = true, length = 40)
    private String taskId;
    @Column(name = "user_id", nullable = false)
    private Long userId;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private AiGenerationTaskType type;
    @Column(name = "source_id", nullable = false)
    private Long sourceId;
    @Column(name = "target_id")
    private Long targetId;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AsyncTaskStatus status = AsyncTaskStatus.PENDING;
    @Column(name = "request_json", columnDefinition = "TEXT", nullable = false)
    private String requestJson;
    @Column(name = "result_json", columnDefinition = "TEXT")
    private String resultJson;
    @Column(name = "error_message", length = 500)
    private String errorMessage;
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
    @Column(name = "completed_at")
    private LocalDateTime completedAt;
    @PrePersist void onCreate() { createdAt = LocalDateTime.now(); updatedAt = createdAt; }
    @PreUpdate void onUpdate() { updatedAt = LocalDateTime.now(); }
}
```

```java
// app/src/main/java/com/nbwf/modules/aigeneration/repository/AiGenerationTaskRepository.java
package com.nbwf.modules.aigeneration.repository;

public interface AiGenerationTaskRepository extends JpaRepository<AiGenerationTaskEntity, Long> {
    Optional<AiGenerationTaskEntity> findByTaskIdAndUserId(String taskId, Long userId);
    Optional<AiGenerationTaskEntity> findFirstByUserIdAndTypeAndSourceIdAndTargetIdAndStatusInOrderByCreatedAtDesc(
        Long userId, AiGenerationTaskType type, Long sourceId, Long targetId, List<AsyncTaskStatus> statuses
    );
    Optional<AiGenerationTaskEntity> findFirstByUserIdAndTypeAndSourceIdOrderByCreatedAtDesc(
        Long userId, AiGenerationTaskType type, Long sourceId
    );
}
```

```java
// app/src/main/java/com/nbwf/modules/aigeneration/service/AiGenerationTaskService.java
package com.nbwf.modules.aigeneration.service;

@Service
@RequiredArgsConstructor
public class AiGenerationTaskService {

    private static final List<AsyncTaskStatus> RUNNING_STATUSES = List.of(AsyncTaskStatus.PENDING, AsyncTaskStatus.PROCESSING);
    private final AiGenerationTaskRepository repository;

    public AiGenerationTaskDTO createOrReuseTask(Long userId, AiGenerationTaskType type, Long sourceId, Long targetId, String requestJson) {
        Optional<AiGenerationTaskEntity> existing = repository
            .findFirstByUserIdAndTypeAndSourceIdAndTargetIdAndStatusInOrderByCreatedAtDesc(userId, type, sourceId, targetId, RUNNING_STATUSES);
        if (existing.isPresent()) {
            return toDTO(existing.get());
        }
        AiGenerationTaskEntity entity = new AiGenerationTaskEntity();
        entity.setTaskId("agt_" + java.util.UUID.randomUUID().toString().replace("-", "").substring(0, 16));
        entity.setUserId(userId);
        entity.setType(type);
        entity.setSourceId(sourceId);
        entity.setTargetId(targetId);
        entity.setRequestJson(requestJson);
        return toDTO(repository.save(entity));
    }

    public Optional<AiGenerationTaskDTO> findLatest(Long userId, AiGenerationTaskType type, Long sourceId) {
        return repository.findFirstByUserIdAndTypeAndSourceIdOrderByCreatedAtDesc(userId, type, sourceId).map(this::toDTO);
    }

    public AiGenerationTaskDTO getTask(String taskId, Long userId) {
        return repository.findByTaskIdAndUserId(taskId, userId).map(this::toDTO).orElseThrow();
    }

    private AiGenerationTaskDTO toDTO(AiGenerationTaskEntity entity) {
        return new AiGenerationTaskDTO(
            entity.getTaskId(), entity.getType(), entity.getSourceId(), entity.getTargetId(),
            entity.getStatus(), entity.getResultJson(), entity.getErrorMessage(),
            entity.getCreatedAt(), entity.getUpdatedAt(), entity.getCompletedAt()
        );
    }
}
```

```java
// app/src/main/java/com/nbwf/modules/aigeneration/AiGenerationTaskController.java
@RestController
@RequestMapping("/api/ai-generation-tasks")
@RequiredArgsConstructor
public class AiGenerationTaskController {
    private final AiGenerationTaskService taskService;

    @GetMapping("/{taskId}")
    public Result<AiGenerationTaskDTO> getTask(@PathVariable String taskId, @AuthenticationPrincipal Long userId) {
        return Result.success(taskService.getTask(taskId, userId));
    }

    @GetMapping("/latest")
    public Result<AiGenerationTaskDTO> getLatest(
        @RequestParam AiGenerationTaskType type,
        @RequestParam Long sourceId,
        @AuthenticationPrincipal Long userId
    ) {
        return Result.success(taskService.findLatest(userId, type, sourceId).orElse(null));
    }
}
```

```java
// app/src/main/java/com/nbwf/common/constant/AsyncTaskStreamConstants.java
public static final String AI_GENERATION_STREAM_KEY = "ai:generation:stream";
public static final String AI_GENERATION_GROUP_NAME = "ai-generation-group";
public static final String AI_GENERATION_CONSUMER_PREFIX = "ai-generation-consumer-";
public static final String FIELD_TASK_ID = "taskId";
```

- [ ] **Step 4: 重新运行测试，确认通过**

Run:

```powershell
$env:JAVA_HOME='G:\jdk'
$env:Path="$env:JAVA_HOME\bin;$env:Path"
.\gradlew.bat :app:test --tests "com.nbwf.modules.aigeneration.service.AiGenerationTaskServiceTest"
```

Expected:

```text
BUILD SUCCESSFUL
```

- [ ] **Step 5: 提交这一小步**

```powershell
git add app/src/main/java/com/nbwf/common/constant/AsyncTaskStreamConstants.java app/src/main/java/com/nbwf/modules/aigeneration app/src/test/java/com/nbwf/modules/aigeneration/service/AiGenerationTaskServiceTest.java
git commit -m "feat(ai): add generation task infrastructure"
```

---

### Task 2: 将职位草稿生成改为后台任务并支持恢复

**Files:**
- Create: `app/src/main/java/com/nbwf/modules/aigeneration/listener/AiGenerationStreamProducer.java`
- Create: `app/src/main/java/com/nbwf/modules/aigeneration/listener/AiGenerationStreamConsumer.java`
- Modify: `app/src/main/java/com/nbwf/modules/aigeneration/service/AiGenerationTaskService.java`
- Modify: `app/src/main/java/com/nbwf/modules/job/JobController.java`
- Test: `app/src/test/java/com/nbwf/modules/aigeneration/listener/AiGenerationStreamConsumerTest.java`

- [ ] **Step 1: 写失败测试，锁定“职位草稿任务完成后写回 drafts 结果”**

```java
@ExtendWith(MockitoExtension.class)
class AiGenerationStreamConsumerTest {

    @Mock private RedisService redisService;
    @Mock private AiGenerationTaskRepository taskRepository;
    @Mock private ResumeRepository resumeRepository;
    @Mock private ResumeJobDraftService resumeJobDraftService;
    @Mock private InterviewSessionService interviewSessionService;

    private AiGenerationStreamConsumer consumer;

    @BeforeEach
    void setUp() {
        consumer = new AiGenerationStreamConsumer(
            redisService, taskRepository, resumeRepository, resumeJobDraftService, interviewSessionService, new ObjectMapper()
        );
    }

    @Test
    void processBusinessShouldCompleteResumeDraftTask() {
        AiGenerationTaskEntity task = new AiGenerationTaskEntity();
        task.setTaskId("agt_resume");
        task.setUserId(7L);
        task.setType(AiGenerationTaskType.RESUME_JOB_DRAFT);
        task.setSourceId(21L);
        task.setRequestJson("{\"resumeId\":21}");

        ResumeEntity resume = new ResumeEntity();
        resume.setId(21L);
        resume.setUserId(7L);
        resume.setResumeText("Java Spring Boot Redis");

        when(taskRepository.findByTaskIdAndUserId("agt_resume", 7L)).thenReturn(Optional.of(task));
        when(resumeRepository.findByIdAndUserId(21L, 7L)).thenReturn(Optional.of(resume));
        when(resumeJobDraftService.generateDrafts("Java Spring Boot Redis"))
            .thenReturn(List.of(new ResumeJobDraftDTO("Java 后端开发工程师", "后端方向", "经验匹配", List.of("Java"), "描述", "备注")));

        consumer.processBusiness(new AiGenerationStreamConsumer.TaskPayload("agt_resume", 7L, 0));
        consumer.markCompleted(new AiGenerationStreamConsumer.TaskPayload("agt_resume", 7L, 0));

        assertTrue(task.getResultJson().contains("Java 后端开发工程师"));
    }
}
```

- [ ] **Step 2: 运行测试，确认先失败**

Run:

```powershell
$env:JAVA_HOME='G:\jdk'
$env:Path="$env:JAVA_HOME\bin;$env:Path"
.\gradlew.bat :app:test --tests "com.nbwf.modules.aigeneration.listener.AiGenerationStreamConsumerTest"
```

Expected:

```text
FAIL with "cannot find symbol AiGenerationStreamConsumer / processBusiness"
```

- [ ] **Step 3: 实现职位草稿任务入队、消费与状态写回**

```java
// app/src/main/java/com/nbwf/modules/aigeneration/listener/AiGenerationStreamProducer.java
@Component
public class AiGenerationStreamProducer extends AbstractStreamProducer<AiGenerationStreamProducer.TaskPayload> {
    public record TaskPayload(String taskId, Long userId, int retryCount) {}
    // buildMessage -> taskId/userId/retryCount
}
```

```java
// app/src/main/java/com/nbwf/modules/aigeneration/listener/AiGenerationStreamConsumer.java
@Component
public class AiGenerationStreamConsumer extends AbstractStreamConsumer<AiGenerationStreamConsumer.TaskPayload> {

    public record TaskPayload(String taskId, Long userId, int retryCount) {}

    @Override
    protected void processBusiness(TaskPayload payload) {
        AiGenerationTaskEntity task = taskRepository.findByTaskIdAndUserId(payload.taskId(), payload.userId()).orElseThrow();
        if (task.getType() == AiGenerationTaskType.RESUME_JOB_DRAFT) {
            ResumeEntity resume = resumeRepository.findByIdAndUserId(task.getSourceId(), payload.userId()).orElseThrow();
            List<ResumeJobDraftDTO> drafts = resumeJobDraftService.generateDrafts(resume.getResumeText());
            task.setResultJson(objectMapper.writeValueAsString(Map.of("drafts", drafts)));
        } else {
            // Task 3 再补 interview 分支
        }
        taskRepository.save(task);
    }

    @Override
    protected void markProcessing(TaskPayload payload) { taskService.updateStatus(payload.taskId(), payload.userId(), AsyncTaskStatus.PROCESSING, null, null); }
    @Override
    protected void markCompleted(TaskPayload payload) { taskService.updateCompleted(payload.taskId(), payload.userId()); }
    @Override
    protected void markFailed(TaskPayload payload, String error) { taskService.updateFailed(payload.taskId(), payload.userId(), error); }
}
```

```java
// app/src/main/java/com/nbwf/modules/aigeneration/service/AiGenerationTaskService.java
public AiGenerationTaskDTO createResumeDraftTask(Long resumeId, Long userId) {
    AiGenerationTaskDTO task = createOrReuseTask(userId, AiGenerationTaskType.RESUME_JOB_DRAFT, resumeId, null, "{\"resumeId\":" + resumeId + "}");
    if (task.status() == AsyncTaskStatus.PENDING) {
        producer.sendGenerateTask(task.taskId(), userId);
    }
    return task;
}
```

```java
// app/src/main/java/com/nbwf/modules/job/JobController.java
@PostMapping("/draft-tasks/from-resume/{resumeId}")
public Result<AiGenerationTaskDTO> createDraftTask(@PathVariable Long resumeId, @AuthenticationPrincipal Long userId) {
    return Result.success(aiGenerationTaskService.createResumeDraftTask(resumeId, userId));
}
```

- [ ] **Step 4: 重新运行测试，确认通过**

Run:

```powershell
$env:JAVA_HOME='G:\jdk'
$env:Path="$env:JAVA_HOME\bin;$env:Path"
.\gradlew.bat :app:test --tests "com.nbwf.modules.aigeneration.listener.AiGenerationStreamConsumerTest" --tests "com.nbwf.modules.aigeneration.service.AiGenerationTaskServiceTest"
```

Expected:

```text
BUILD SUCCESSFUL
```

- [ ] **Step 5: 提交这一小步**

```powershell
git add app/src/main/java/com/nbwf/modules/aigeneration app/src/main/java/com/nbwf/modules/job/JobController.java app/src/test/java/com/nbwf/modules/aigeneration/listener/AiGenerationStreamConsumerTest.java
git commit -m "feat(job): add async resume draft tasks"
```

---

### Task 3: 将面试题生成改为后台任务，并保存目标职位快照

**Files:**
- Modify: `app/src/main/java/com/nbwf/modules/interview/model/InterviewSessionEntity.java`
- Modify: `app/src/main/java/com/nbwf/modules/interview/model/InterviewSessionDTO.java`
- Modify: `app/src/main/java/com/nbwf/modules/interview/model/InterviewReportDTO.java`
- Modify: `app/src/main/java/com/nbwf/modules/interview/model/InterviewDetailDTO.java`
- Modify: `app/src/main/java/com/nbwf/modules/interview/service/InterviewSessionService.java`
- Modify: `app/src/main/java/com/nbwf/modules/interview/InterviewController.java`
- Modify: `app/src/main/java/com/nbwf/modules/interview/service/InterviewHistoryService.java`
- Modify: `app/src/main/java/com/nbwf/infrastructure/mapper/InterviewMapper.java`
- Modify: `app/src/main/java/com/nbwf/modules/aigeneration/listener/AiGenerationStreamConsumer.java`
- Modify: `app/src/test/java/com/nbwf/modules/interview/service/InterviewSessionServiceTest.java`
- Modify: `app/src/test/java/com/nbwf/modules/interview/service/InterviewHistoryServiceTest.java`

- [ ] **Step 1: 先写失败测试，锁定“保存面试会话时持久化目标职位快照”**

```java
@Test
void createSessionShouldPersistTargetJobSnapshot() {
    LocalDateTime now = LocalDateTime.of(2026, 4, 19, 9, 0);
    JobDetailDTO job = new JobDetailDTO(
        31L, "Java 后端开发工程师", "示例科技", "职位描述", "上海",
        18000, 28000, List.of("Java"), JobApplicationStatus.SAVED, "备注", now, now
    );
    List<InterviewQuestionDTO> generatedQuestions = List.of(
        InterviewQuestionDTO.create(0, "请介绍你的项目。", InterviewQuestionDTO.QuestionType.PROJECT, "项目经历")
    );

    when(jobService.getDetail(31L, 7L)).thenReturn(job);
    when(questionService.generateQuestions(eq("候选人简历文本"), eq(3), eq(null), any())).thenReturn(generatedQuestions);

    interviewSessionService.createSession(new CreateInterviewRequest("候选人简历文本", 3, 21L, 31L, true), 7L);

    verify(persistenceService).saveSession(
        anyString(),
        eq(21L),
        eq(7L),
        eq(1),
        eq(generatedQuestions),
        eq(31L),
        eq("Java 后端开发工程师"),
        eq("示例科技")
    );
}
```

- [ ] **Step 2: 运行测试，确认失败**

Run:

```powershell
$env:JAVA_HOME='G:\jdk'
$env:Path="$env:JAVA_HOME\bin;$env:Path"
.\gradlew.bat :app:test --tests "com.nbwf.modules.interview.service.InterviewSessionServiceTest"
```

Expected:

```text
FAIL with "saveSession(...) cannot be applied to given types"
```

- [ ] **Step 3: 实现目标职位快照字段、后台任务创建会话和 DTO 展示**

```java
// app/src/main/java/com/nbwf/modules/interview/model/InterviewSessionEntity.java
@Column(name = "target_job_id")
private Long targetJobId;
@Column(name = "target_job_title", length = 200)
private String targetJobTitle;
@Column(name = "target_job_company", length = 200)
private String targetJobCompany;
```

```java
// app/src/main/java/com/nbwf/modules/interview/model/InterviewSessionDTO.java
public record InterviewSessionDTO(
    String sessionId,
    String resumeText,
    int totalQuestions,
    int currentQuestionIndex,
    List<InterviewQuestionDTO> questions,
    SessionStatus status,
    Long targetJobId,
    String targetJobTitle,
    String targetJobCompany
) { ... }
```

```java
// app/src/main/java/com/nbwf/modules/interview/model/InterviewReportDTO.java
public record InterviewReportDTO(
    String sessionId,
    int totalQuestions,
    int overallScore,
    List<CategoryScore> categoryScores,
    List<QuestionEvaluation> questionDetails,
    String overallFeedback,
    List<String> strengths,
    List<String> improvements,
    List<ReferenceAnswer> referenceAnswers,
    Long targetJobId,
    String targetJobTitle,
    String targetJobCompany
) { ... }
```

```java
// app/src/main/java/com/nbwf/modules/interview/service/InterviewSessionService.java
private record TargetJobSnapshot(Long jobId, String title, String company, String context) {}

private TargetJobSnapshot buildTargetJobSnapshot(Long jobId, Long userId) {
    if (jobId == null) return null;
    JobDetailDTO job = jobService.getDetail(jobId, userId);
    String tags = job.techTags() == null || job.techTags().isEmpty() ? "暂无标签" : String.join("、", job.techTags());
    String notes = job.notes() == null || job.notes().isBlank() ? "暂无备注" : job.notes();
    String context = String.format(
        """
        目标职位信息：
        - 职位名称：%s
        - 公司：%s
        - 工作地点：%s
        - 技术标签：%s
        - 职位描述：
        %s
        - 用户备注：%s
        """,
        job.title(),
        job.company(),
        job.location() == null || job.location().isBlank() ? "未填写" : job.location(),
        tags,
        job.description(),
        notes
    ).trim();
    return new TargetJobSnapshot(job.id(), job.title(), job.company(), context);
}

public InterviewSessionDTO createSession(CreateInterviewRequest request, Long userId) {
    return createSessionInternal(request, userId, true);
}

public InterviewSessionDTO createSessionFromTask(CreateInterviewRequest request, Long userId) {
    return createSessionInternal(request, userId, false);
}
```

```java
// app/src/main/java/com/nbwf/modules/interview/InterviewController.java
@PostMapping("/api/interview/session-tasks")
public Result<AiGenerationTaskDTO> createSessionTask(@RequestBody CreateInterviewRequest request,
                                                     @AuthenticationPrincipal Long userId) {
    return Result.success(aiGenerationTaskService.createInterviewSessionTask(request, userId));
}
```

```java
// app/src/main/java/com/nbwf/modules/aigeneration/listener/AiGenerationStreamConsumer.java
if (task.getType() == AiGenerationTaskType.INTERVIEW_SESSION_CREATE) {
    CreateInterviewRequest request = objectMapper.readValue(task.getRequestJson(), CreateInterviewRequest.class);
    InterviewSessionDTO session = interviewSessionService.createSessionFromTask(request, payload.userId());
    task.setResultJson(objectMapper.writeValueAsString(Map.of("sessionId", session.sessionId())));
}
```

```java
// app/src/main/java/com/nbwf/infrastructure/mapper/InterviewMapper.java
map.put("targetJobId", session.getTargetJobId());
map.put("targetJobTitle", session.getTargetJobTitle());
map.put("targetJobCompany", session.getTargetJobCompany());
```

- [ ] **Step 4: 追加详情映射失败测试，锁定“面试详情带目标职位信息”**

```java
@Test
void getInterviewDetailShouldExposeTargetJobSnapshot() {
    InterviewSessionEntity session = new InterviewSessionEntity();
    session.setSessionId("sess_1");
    session.setTargetJobId(31L);
    session.setTargetJobTitle("Java 后端开发工程师");
    session.setTargetJobCompany("示例科技");

    when(interviewPersistenceService.findBySessionId("sess_1", 7L)).thenReturn(Optional.of(session));

    InterviewDetailDTO detail = historyService.getInterviewDetail("sess_1", 7L);

    assertEquals(31L, detail.targetJobId());
    assertEquals("Java 后端开发工程师", detail.targetJobTitle());
    assertEquals("示例科技", detail.targetJobCompany());
}
```

- [ ] **Step 5: 运行相关测试，确认通过**

Run:

```powershell
$env:JAVA_HOME='G:\jdk'
$env:Path="$env:JAVA_HOME\bin;$env:Path"
.\gradlew.bat :app:test --tests "com.nbwf.modules.interview.service.InterviewSessionServiceTest" --tests "com.nbwf.modules.interview.service.InterviewHistoryServiceTest" --tests "com.nbwf.modules.aigeneration.listener.AiGenerationStreamConsumerTest"
```

Expected:

```text
BUILD SUCCESSFUL
```

- [ ] **Step 6: 提交这一小步**

```powershell
git add app/src/main/java/com/nbwf/modules/interview app/src/main/java/com/nbwf/infrastructure/mapper/InterviewMapper.java app/src/test/java/com/nbwf/modules/interview/service/InterviewSessionServiceTest.java app/src/test/java/com/nbwf/modules/interview/service/InterviewHistoryServiceTest.java app/src/main/java/com/nbwf/modules/aigeneration/listener/AiGenerationStreamConsumer.java
git commit -m "feat(interview): persist target job for async sessions"
```

---

### Task 4: 前端接入后台任务恢复，并展示目标职位信息

**Files:**
- Create: `frontend/src/types/ai-generation-task.ts`
- Create: `frontend/src/api/aiGenerationTasks.ts`
- Modify: `frontend/src/api/index.ts`
- Modify: `frontend/src/api/jobs.ts`
- Modify: `frontend/src/api/interview.ts`
- Modify: `frontend/src/api/history.ts`
- Modify: `frontend/src/types/interview.ts`
- Modify: `frontend/src/pages/ResumeDetailPage.tsx`
- Modify: `frontend/src/pages/InterviewPage.tsx`
- Modify: `frontend/src/components/InterviewConfigPanel.tsx`
- Modify: `frontend/src/pages/InterviewHistoryPage.tsx`
- Modify: `frontend/src/components/InterviewDetailPanel.tsx`
- Modify: `docs/development-progress.md`

- [ ] **Step 1: 先在前端写出失败调用，让构建准确暴露缺口**

```ts
// frontend/src/pages/InterviewPage.tsx
const [creatingTask, setCreatingTask] = useState<AiGenerationTask | null>(null);

const startInterview = async () => {
  const task = await interviewApi.createSessionTask({
    resumeText,
    questionCount,
    resumeId,
    jobId: jobTarget?.jobId,
    forceCreate: forceCreateNew,
  });
  setCreatingTask(task);
};
```

```tsx
// frontend/src/pages/ResumeDetailPage.tsx
const task = await jobApi.createDraftTask(resumeId);
setDraftTask(task);
```

- [ ] **Step 2: 运行前端构建，确认先失败**

Run:

```powershell
Set-Location frontend
npm.cmd run build
```

Expected:

```text
FAIL with "Property 'createSessionTask' does not exist" / "Cannot find name 'AiGenerationTask'"
```

- [ ] **Step 3: 写最小前端实现，完成自动恢复和展示**

```ts
// frontend/src/types/ai-generation-task.ts
export type AiGenerationTaskType = 'RESUME_JOB_DRAFT' | 'INTERVIEW_SESSION_CREATE';
export type AiGenerationTaskStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface AiGenerationTask {
  taskId: string;
  type: AiGenerationTaskType;
  sourceId: number;
  targetId: number | null;
  status: AiGenerationTaskStatus;
  resultJson: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}
```

```ts
// frontend/src/api/aiGenerationTasks.ts
export const aiGenerationTaskApi = {
  async getTask(taskId: string): Promise<AiGenerationTask> {
    return request.get<AiGenerationTask>(`/api/ai-generation-tasks/${taskId}`);
  },
  async getLatest(type: AiGenerationTaskType, sourceId: number): Promise<AiGenerationTask | null> {
    return request.get<AiGenerationTask | null>('/api/ai-generation-tasks/latest', {
      params: { type, sourceId },
    });
  },
};
```

```ts
// frontend/src/api/jobs.ts
async createDraftTask(resumeId: number): Promise<AiGenerationTask> {
  return request.post<AiGenerationTask>(`/api/jobs/draft-tasks/from-resume/${resumeId}`);
}
```

```ts
// frontend/src/api/interview.ts
async createSessionTask(req: CreateInterviewRequest): Promise<AiGenerationTask> {
  return request.post<AiGenerationTask>('/api/interview/session-tasks', req);
}
```

```tsx
// frontend/src/pages/ResumeDetailPage.tsx
useEffect(() => {
  aiGenerationTaskApi.getLatest('RESUME_JOB_DRAFT', resumeId).then((task) => {
    if (!task) return;
    setDraftTask(task);
    if (task.status === 'COMPLETED' && task.resultJson) {
      const parsed = JSON.parse(task.resultJson) as { drafts: ResumeJobDraft[] };
      setJobDrafts(parsed.drafts ?? []);
      setJobDraftDialogOpen(true);
    }
  });
}, [resumeId]);
```

```tsx
// frontend/src/pages/InterviewPage.tsx
useEffect(() => {
  if (!resumeId) return;
  aiGenerationTaskApi.getLatest('INTERVIEW_SESSION_CREATE', resumeId).then(async (task) => {
    if (!task) return;
    setCreatingTask(task);
    if (task.status === 'COMPLETED' && task.resultJson) {
      const parsed = JSON.parse(task.resultJson) as { sessionId: string };
      const restored = await interviewApi.getSession(parsed.sessionId);
      restoreSession(restored);
    }
  });
}, [resumeId]);
```

```tsx
// frontend/src/pages/InterviewHistoryPage.tsx
<p className="text-xs text-slate-400 dark:text-slate-500">
  {interview.targetJobTitle ? `目标职位：${interview.targetJobTitle} · ${interview.targetJobCompany}` : `#${interview.sessionId.slice(-8)}`}
</p>
```

```tsx
// frontend/src/components/InterviewDetailPanel.tsx
{interview.targetJobTitle && (
  <div className="rounded-2xl border border-primary-200 bg-primary-50/70 p-4 dark:border-primary-800 dark:bg-primary-900/20">
    <p className="text-sm font-semibold text-primary-700 dark:text-primary-300">目标职位</p>
    <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{interview.targetJobTitle} · {interview.targetJobCompany}</p>
  </div>
)}
```

- [ ] **Step 4: 更新开发进度文档**

```md
| `ai-generation` | 已完成第一版后台任务恢复 | 职位草稿生成和面试题生成支持后台继续执行，并可在页面返回后自动恢复最近一次任务 |
| `interview + report` | 已完成职位来源展示 | 定向面试会话保存目标职位轻量快照，记录页和详情页可展示来源职位 |
| `2026-04-19` | 后端：`AiGenerationTaskServiceTest` / `AiGenerationStreamConsumerTest` | 通过 |
```

- [ ] **Step 5: 运行最终验证**

Run:

```powershell
$env:JAVA_HOME='G:\jdk'
$env:Path="$env:JAVA_HOME\bin;$env:Path"
.\gradlew.bat :app:test --tests "com.nbwf.modules.aigeneration.service.AiGenerationTaskServiceTest" --tests "com.nbwf.modules.aigeneration.listener.AiGenerationStreamConsumerTest" --tests "com.nbwf.modules.interview.service.InterviewSessionServiceTest" --tests "com.nbwf.modules.interview.service.InterviewHistoryServiceTest"
```

Expected:

```text
BUILD SUCCESSFUL
```

Run:

```powershell
Set-Location frontend
npm.cmd run build
```

Expected:

```text
vite build ... built
```

- [ ] **Step 6: 提交这一小步**

```powershell
git add frontend/src/types/ai-generation-task.ts frontend/src/api/aiGenerationTasks.ts frontend/src/api/index.ts frontend/src/api/jobs.ts frontend/src/api/interview.ts frontend/src/api/history.ts frontend/src/types/interview.ts frontend/src/pages/ResumeDetailPage.tsx frontend/src/pages/InterviewPage.tsx frontend/src/components/InterviewConfigPanel.tsx frontend/src/pages/InterviewHistoryPage.tsx frontend/src/components/InterviewDetailPanel.tsx docs/development-progress.md
git commit -m "feat(ai): recover generation tasks across pages"
```

---

## Self-Review

### Spec coverage

| Spec 要求 | 对应任务 |
|---|---|
| 职位草稿后台继续生成 | Task 2 |
| 面试题后台继续生成 | Task 3 + Task 4 |
| 自动恢复最近一次任务 | Task 1 + Task 4 |
| 不做任务中心页面 | Task 4（只做页面内恢复） |
| 目标职位快照稳定展示 | Task 3 + Task 4 |
| 更新开发进度文档 | Task 4 |

### Placeholder scan

已检查本计划，不包含 `TBD`、`TODO`、`类似 Task N`、`后续补充` 等占位描述。

### Type consistency

| 类型/方法 | 计划中的统一命名 |
|---|---|
| 后端任务类型 | `AiGenerationTaskType` |
| 后端任务 DTO | `AiGenerationTaskDTO` |
| 后端任务服务 | `AiGenerationTaskService` |
| 前端任务类型 | `AiGenerationTask` |
| 前端任务 API | `aiGenerationTaskApi` |
| 职位草稿任务接口 | `createDraftTask` |
| 面试题任务接口 | `createSessionTask` |
