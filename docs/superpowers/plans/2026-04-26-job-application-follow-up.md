# Job Application Follow-Up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete job application follow-up loop with automatic status-change records, manual follow-up notes, job-level follow-up timestamps, and a frontend timeline.

**Architecture:** Add a focused `job follow-up` backend slice under the existing `job` module. `JobService` remains responsible for job lifecycle changes, while a new `JobFollowUpService` owns timeline records and follow-up timestamp updates. The frontend extends `JobManagePage` with follow-up API calls, a timeline section, quick status actions, and a follow-up dialog.

**Tech Stack:** Spring Boot, JPA/Hibernate, PostgreSQL, JUnit 5, Mockito, React, TypeScript, Vite, Tailwind CSS, lucide-react.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `app/src/main/java/com/nbwf/modules/job/model/JobEntity.java` | Modify | Add `appliedAt`, `lastFollowUpAt`, `nextFollowUpAt` snapshot fields |
| `app/src/main/java/com/nbwf/modules/job/model/JobDetailDTO.java` | Modify | Expose follow-up timestamp snapshots to frontend |
| `app/src/main/java/com/nbwf/modules/job/model/JobListItemDTO.java` | Modify | Expose follow-up timestamp snapshots in list cards |
| `app/src/main/java/com/nbwf/modules/job/model/JobFollowUpType.java` | Create | Enum for timeline record type |
| `app/src/main/java/com/nbwf/modules/job/model/JobFollowUpRecordEntity.java` | Create | JPA entity for `job_follow_up_records` |
| `app/src/main/java/com/nbwf/modules/job/model/JobFollowUpRecordDTO.java` | Create | API response DTO for timeline records |
| `app/src/main/java/com/nbwf/modules/job/model/CreateJobFollowUpRequest.java` | Create | API request DTO for manual records |
| `app/src/main/java/com/nbwf/modules/job/repository/JobFollowUpRecordRepository.java` | Create | Query records by `jobId` and `userId` |
| `app/src/main/java/com/nbwf/modules/job/service/JobFollowUpService.java` | Create | Manual record creation, status-change record creation, timestamp updates |
| `app/src/main/java/com/nbwf/modules/job/service/JobService.java` | Modify | Detect status changes and call `JobFollowUpService` |
| `app/src/main/java/com/nbwf/modules/job/JobController.java` | Modify | Add follow-up list/create endpoints |
| `app/src/test/java/com/nbwf/modules/job/service/JobFollowUpServiceTest.java` | Create | Unit tests for manual records and access isolation |
| `app/src/test/java/com/nbwf/modules/job/service/JobServiceFollowUpTest.java` | Create | Unit tests for automatic status-change records |
| `frontend/src/types/job.ts` | Modify | Add follow-up timestamp fields to `JobListItem` and `JobDetail` |
| `frontend/src/types/job-follow-up.ts` | Create | Follow-up record types and labels |
| `frontend/src/api/jobFollowUps.ts` | Create | Follow-up list/create API |
| `frontend/src/api/index.ts` | Modify | Export `jobFollowUpApi` |
| `frontend/src/components/JobFollowUpDialog.tsx` | Create | Add manual follow-up record dialog |
| `frontend/src/pages/JobManagePage.tsx` | Modify | Load/display timeline, add quick status actions, open follow-up dialog |
| `docs/2026-04-21-投递辅助闭环-手动联调清单.md` | Modify | Add follow-up timeline checks |
| `docs/development-progress.md` | Modify | Update progress, validation, and next target |

---

### Task 1: Backend Follow-Up Data Model

**Files:**
- Modify: `app/src/main/java/com/nbwf/modules/job/model/JobEntity.java`
- Modify: `app/src/main/java/com/nbwf/modules/job/model/JobDetailDTO.java`
- Modify: `app/src/main/java/com/nbwf/modules/job/model/JobListItemDTO.java`
- Create: `app/src/main/java/com/nbwf/modules/job/model/JobFollowUpType.java`
- Create: `app/src/main/java/com/nbwf/modules/job/model/JobFollowUpRecordEntity.java`
- Create: `app/src/main/java/com/nbwf/modules/job/model/JobFollowUpRecordDTO.java`
- Create: `app/src/main/java/com/nbwf/modules/job/model/CreateJobFollowUpRequest.java`
- Create: `app/src/main/java/com/nbwf/modules/job/repository/JobFollowUpRecordRepository.java`
- Modify: `app/src/main/java/com/nbwf/modules/job/service/JobService.java`

- [ ] **Step 1: Add follow-up fields to `JobEntity`**

Add imports and fields:

```java
@Column(name = "applied_at")
private LocalDateTime appliedAt;

@Column(name = "last_follow_up_at")
private LocalDateTime lastFollowUpAt;

@Column(name = "next_follow_up_at")
private LocalDateTime nextFollowUpAt;
```

Add getters and setters:

```java
public LocalDateTime getAppliedAt() { return appliedAt; }
public void setAppliedAt(LocalDateTime appliedAt) { this.appliedAt = appliedAt; }

public LocalDateTime getLastFollowUpAt() { return lastFollowUpAt; }
public void setLastFollowUpAt(LocalDateTime lastFollowUpAt) { this.lastFollowUpAt = lastFollowUpAt; }

public LocalDateTime getNextFollowUpAt() { return nextFollowUpAt; }
public void setNextFollowUpAt(LocalDateTime nextFollowUpAt) { this.nextFollowUpAt = nextFollowUpAt; }
```

- [ ] **Step 2: Extend job DTO records**

Update `JobDetailDTO` to include:

```java
LocalDateTime appliedAt,
LocalDateTime lastFollowUpAt,
LocalDateTime nextFollowUpAt
```

Update `JobListItemDTO` to include the same three fields after `createdAt`.

- [ ] **Step 3: Update `JobService` DTO mapping**

In `toListItemDTO`, append:

```java
job.getAppliedAt(),
job.getLastFollowUpAt(),
job.getNextFollowUpAt()
```

In `toDetailDTO`, append:

```java
job.getAppliedAt(),
job.getLastFollowUpAt(),
job.getNextFollowUpAt()
```

- [ ] **Step 4: Create `JobFollowUpType`**

Create `app/src/main/java/com/nbwf/modules/job/model/JobFollowUpType.java`:

```java
package com.nbwf.modules.job.model;

public enum JobFollowUpType {
    STATUS_CHANGE,
    MANUAL_NOTE,
    CONTACT,
    INTERVIEW,
    OFFER,
    REJECTION
}
```

- [ ] **Step 5: Create `JobFollowUpRecordEntity`**

Create `app/src/main/java/com/nbwf/modules/job/model/JobFollowUpRecordEntity.java`:

```java
package com.nbwf.modules.job.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "job_follow_up_records", indexes = {
    @Index(name = "idx_job_follow_up_job_id", columnList = "job_id"),
    @Index(name = "idx_job_follow_up_user_id", columnList = "user_id"),
    @Index(name = "idx_job_follow_up_created_at", columnList = "created_at")
})
public class JobFollowUpRecordEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "job_id", nullable = false)
    private Long jobId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private JobFollowUpType type;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String content;

    @Enumerated(EnumType.STRING)
    @Column(name = "from_status", length = 20)
    private JobApplicationStatus fromStatus;

    @Enumerated(EnumType.STRING)
    @Column(name = "to_status", length = 20)
    private JobApplicationStatus toStatus;

    @Column(name = "contact_method", length = 80)
    private String contactMethod;

    @Column(name = "next_follow_up_at")
    private LocalDateTime nextFollowUpAt;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getJobId() { return jobId; }
    public void setJobId(Long jobId) { this.jobId = jobId; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public JobFollowUpType getType() { return type; }
    public void setType(JobFollowUpType type) { this.type = type; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public JobApplicationStatus getFromStatus() { return fromStatus; }
    public void setFromStatus(JobApplicationStatus fromStatus) { this.fromStatus = fromStatus; }
    public JobApplicationStatus getToStatus() { return toStatus; }
    public void setToStatus(JobApplicationStatus toStatus) { this.toStatus = toStatus; }
    public String getContactMethod() { return contactMethod; }
    public void setContactMethod(String contactMethod) { this.contactMethod = contactMethod; }
    public LocalDateTime getNextFollowUpAt() { return nextFollowUpAt; }
    public void setNextFollowUpAt(LocalDateTime nextFollowUpAt) { this.nextFollowUpAt = nextFollowUpAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
```

- [ ] **Step 6: Create DTO records**

Create `JobFollowUpRecordDTO`:

```java
package com.nbwf.modules.job.model;

import java.time.LocalDateTime;

public record JobFollowUpRecordDTO(
    Long id,
    Long jobId,
    JobFollowUpType type,
    String title,
    String content,
    JobApplicationStatus fromStatus,
    JobApplicationStatus toStatus,
    String contactMethod,
    LocalDateTime nextFollowUpAt,
    LocalDateTime createdAt
) {}
```

Create `CreateJobFollowUpRequest`:

```java
package com.nbwf.modules.job.model;

import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;

public record CreateJobFollowUpRequest(
    JobFollowUpType type,
    @Size(max = 200) String title,
    @Size(max = 12000) String content,
    @Size(max = 80) String contactMethod,
    LocalDateTime nextFollowUpAt
) {}
```

- [ ] **Step 7: Create repository**

Create `JobFollowUpRecordRepository`:

```java
package com.nbwf.modules.job.repository;

import com.nbwf.modules.job.model.JobFollowUpRecordEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface JobFollowUpRecordRepository extends JpaRepository<JobFollowUpRecordEntity, Long> {

    List<JobFollowUpRecordEntity> findByJobIdAndUserIdOrderByCreatedAtDesc(Long jobId, Long userId);
}
```

- [ ] **Step 8: Run compilation**

Run:

```powershell
$env:JAVA_HOME='G:\jdk'; .\gradlew.bat :app:compileJava
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 9: Commit data model**

Run:

```powershell
git add app/src/main/java/com/nbwf/modules/job/model app/src/main/java/com/nbwf/modules/job/repository/JobFollowUpRecordRepository.java app/src/main/java/com/nbwf/modules/job/service/JobService.java
git commit -m "feat(job): 新增投递跟进数据模型"
```

---

### Task 2: Backend Follow-Up Service and Status Automation

**Files:**
- Create: `app/src/main/java/com/nbwf/modules/job/service/JobFollowUpService.java`
- Modify: `app/src/main/java/com/nbwf/modules/job/service/JobService.java`
- Modify: `app/src/main/java/com/nbwf/modules/job/JobController.java`
- Test: `app/src/test/java/com/nbwf/modules/job/service/JobFollowUpServiceTest.java`
- Test: `app/src/test/java/com/nbwf/modules/job/service/JobServiceFollowUpTest.java`

- [ ] **Step 1: Write failing test for manual follow-up creation**

Create `JobFollowUpServiceTest` with this test:

```java
@Test
void createManualShouldSaveRecordAndUpdateJobFollowUpSnapshots() {
    JobEntity job = new JobEntity();
    job.setId(10L);
    job.setUserId(7L);
    job.setTitle("Java 后端");
    job.setCompany("示例公司");
    job.setDescription("负责后端开发");
    job.setApplicationStatus(JobApplicationStatus.APPLIED);

    LocalDateTime nextTime = LocalDateTime.of(2026, 4, 28, 10, 30);

    when(jobRepository.findByIdAndUserId(10L, 7L)).thenReturn(Optional.of(job));
    when(recordRepository.save(any(JobFollowUpRecordEntity.class))).thenAnswer(invocation -> {
        JobFollowUpRecordEntity record = invocation.getArgument(0);
        record.setId(101L);
        record.setCreatedAt(LocalDateTime.of(2026, 4, 26, 9, 0));
        return record;
    });

    JobFollowUpRecordDTO actual = service.createManual(10L, new CreateJobFollowUpRequest(
        JobFollowUpType.CONTACT,
        "已联系 HR",
        "通过 BOSS 发送开场话术，等待回复。",
        "BOSS",
        nextTime
    ), 7L);

    assertEquals(101L, actual.id());
    assertEquals(JobFollowUpType.CONTACT, actual.type());
    assertEquals("已联系 HR", actual.title());
    assertEquals(nextTime, actual.nextFollowUpAt());
    assertEquals(nextTime, job.getNextFollowUpAt());
    assertEquals(LocalDateTime.of(2026, 4, 26, 9, 0), job.getLastFollowUpAt());
    verify(jobRepository).save(job);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
$env:JAVA_HOME='G:\jdk'; .\gradlew.bat :app:test --tests "com.nbwf.modules.job.service.JobFollowUpServiceTest"
```

Expected: FAIL because `JobFollowUpService` does not exist or methods are missing.

- [ ] **Step 3: Implement `JobFollowUpService`**

Create service with methods:

```java
@Service
@RequiredArgsConstructor
public class JobFollowUpService {

    private final JobRepository jobRepository;
    private final JobFollowUpRecordRepository recordRepository;

    @Transactional(readOnly = true)
    public List<JobFollowUpRecordDTO> list(Long jobId, Long userId) {
        ensureJobVisible(jobId, userId);
        return recordRepository.findByJobIdAndUserIdOrderByCreatedAtDesc(jobId, userId)
            .stream()
            .map(this::toDTO)
            .toList();
    }

    @Transactional
    public JobFollowUpRecordDTO createManual(Long jobId, CreateJobFollowUpRequest req, Long userId) {
        JobEntity job = findJob(jobId, userId);
        JobFollowUpRecordEntity record = new JobFollowUpRecordEntity();
        record.setJobId(jobId);
        record.setUserId(userId);
        record.setType(req.type() == null ? JobFollowUpType.MANUAL_NOTE : req.type());
        record.setTitle(resolveManualTitle(record.getType(), req.title()));
        record.setContent(trimToNull(req.content()));
        record.setContactMethod(trimToNull(req.contactMethod()));
        record.setNextFollowUpAt(req.nextFollowUpAt());

        JobFollowUpRecordEntity saved = recordRepository.save(record);
        updateJobSnapshots(job, saved);
        jobRepository.save(job);
        return toDTO(saved);
    }

    @Transactional
    public void recordStatusChange(JobEntity job, JobApplicationStatus fromStatus, JobApplicationStatus toStatus) {
        if (fromStatus == toStatus) {
            return;
        }
        JobFollowUpRecordEntity record = new JobFollowUpRecordEntity();
        record.setJobId(job.getId());
        record.setUserId(job.getUserId());
        record.setType(JobFollowUpType.STATUS_CHANGE);
        record.setTitle("状态变更：" + statusLabel(fromStatus) + " → " + statusLabel(toStatus));
        record.setContent("职位状态从「" + statusLabel(fromStatus) + "」更新为「" + statusLabel(toStatus) + "」。");
        record.setFromStatus(fromStatus);
        record.setToStatus(toStatus);
        JobFollowUpRecordEntity saved = recordRepository.save(record);
        if (toStatus == JobApplicationStatus.APPLIED && job.getAppliedAt() == null) {
            job.setAppliedAt(saved.getCreatedAt());
        }
        updateJobSnapshots(job, saved);
    }

    private JobEntity findJob(Long jobId, Long userId) {
        return jobRepository.findByIdAndUserId(jobId, userId)
            .orElseThrow(() -> new BusinessException(ErrorCode.JOB_NOT_FOUND));
    }

    private void ensureJobVisible(Long jobId, Long userId) {
        findJob(jobId, userId);
    }

    private void updateJobSnapshots(JobEntity job, JobFollowUpRecordEntity record) {
        job.setLastFollowUpAt(record.getCreatedAt());
        if (record.getNextFollowUpAt() != null) {
            job.setNextFollowUpAt(record.getNextFollowUpAt());
        }
    }
}
```

Add private helpers `trimToNull`, `resolveManualTitle`, `statusLabel`, and `toDTO` in the same service.

- [ ] **Step 4: Wire status automation in `JobService`**

Add constructor dependency:

```java
private final JobFollowUpService jobFollowUpService;
```

In `update`, before applying request:

```java
JobApplicationStatus previousStatus = job.getApplicationStatus();
```

After applying request and before saving:

```java
if (req.getApplicationStatus() != null && req.getApplicationStatus() != previousStatus) {
    jobFollowUpService.recordStatusChange(job, previousStatus, req.getApplicationStatus());
}
```

- [ ] **Step 5: Add controller endpoints**

In `JobController`, add dependency:

```java
private final JobFollowUpService jobFollowUpService;
```

Add endpoints:

```java
@Operation(summary = "查询职位投递跟进记录")
@GetMapping("/{id}/follow-ups")
public Result<List<JobFollowUpRecordDTO>> listFollowUps(@PathVariable Long id,
                                                        @AuthenticationPrincipal Long userId) {
    return Result.success(jobFollowUpService.list(id, userId));
}

@Operation(summary = "新增职位投递跟进记录")
@PostMapping("/{id}/follow-ups")
public Result<JobFollowUpRecordDTO> createFollowUp(@PathVariable Long id,
                                                   @Valid @RequestBody CreateJobFollowUpRequest req,
                                                   @AuthenticationPrincipal Long userId) {
    return Result.success(jobFollowUpService.createManual(id, req, userId));
}
```

- [ ] **Step 6: Run backend tests**

Run:

```powershell
$env:JAVA_HOME='G:\jdk'; .\gradlew.bat :app:test --tests "com.nbwf.modules.job.service.JobFollowUpServiceTest" --tests "com.nbwf.modules.job.service.JobServiceFollowUpTest"
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 7: Commit backend service**

Run:

```powershell
git add app/src/main/java/com/nbwf/modules/job app/src/test/java/com/nbwf/modules/job/service
git commit -m "feat(job): 新增投递跟进记录后端闭环"
```

---

### Task 3: Frontend Timeline Display

**Files:**
- Modify: `frontend/src/types/job.ts`
- Create: `frontend/src/types/job-follow-up.ts`
- Create: `frontend/src/api/jobFollowUps.ts`
- Modify: `frontend/src/api/index.ts`
- Modify: `frontend/src/pages/JobManagePage.tsx`

- [ ] **Step 1: Add frontend follow-up types**

Create `frontend/src/types/job-follow-up.ts`:

```ts
import type { JobApplicationStatus } from './job';

export type JobFollowUpType =
  | 'STATUS_CHANGE'
  | 'MANUAL_NOTE'
  | 'CONTACT'
  | 'INTERVIEW'
  | 'OFFER'
  | 'REJECTION';

export interface JobFollowUpRecord {
  id: number;
  jobId: number;
  type: JobFollowUpType;
  title: string;
  content: string | null;
  fromStatus: JobApplicationStatus | null;
  toStatus: JobApplicationStatus | null;
  contactMethod: string | null;
  nextFollowUpAt: string | null;
  createdAt: string;
}

export interface CreateJobFollowUpForm {
  type?: JobFollowUpType;
  title?: string;
  content?: string;
  contactMethod?: string;
  nextFollowUpAt?: string;
}

export const jobFollowUpTypeLabelMap: Record<JobFollowUpType, string> = {
  STATUS_CHANGE: '状态变化',
  MANUAL_NOTE: '备注',
  CONTACT: '沟通',
  INTERVIEW: '面试',
  OFFER: 'Offer',
  REJECTION: '拒绝',
};
```

- [ ] **Step 2: Extend job types**

Add to both `JobListItem` and `JobDetail`:

```ts
appliedAt: string | null;
lastFollowUpAt: string | null;
nextFollowUpAt: string | null;
```

- [ ] **Step 3: Add API**

Create `frontend/src/api/jobFollowUps.ts`:

```ts
import { request } from './request';
import type { CreateJobFollowUpForm, JobFollowUpRecord } from '../types/job-follow-up';

export const jobFollowUpApi = {
  async list(jobId: number): Promise<JobFollowUpRecord[]> {
    return request.get<JobFollowUpRecord[]>(`/api/jobs/${jobId}/follow-ups`);
  },

  async create(jobId: number, data: CreateJobFollowUpForm): Promise<JobFollowUpRecord> {
    return request.post<JobFollowUpRecord>(`/api/jobs/${jobId}/follow-ups`, data);
  },
};
```

Export it from `frontend/src/api/index.ts`:

```ts
export { jobFollowUpApi } from './jobFollowUps';
```

- [ ] **Step 4: Load follow-ups in `JobManagePage`**

Add state:

```ts
const [followUps, setFollowUps] = useState<JobFollowUpRecord[]>([]);
const [loadingFollowUps, setLoadingFollowUps] = useState(false);
const [followUpError, setFollowUpError] = useState<string | null>(null);
```

Add loader:

```ts
const loadFollowUps = useCallback(async (jobId: number) => {
  setLoadingFollowUps(true);
  setFollowUpError(null);
  try {
    const data = await jobFollowUpApi.list(jobId);
    setFollowUps(data);
  } catch (error) {
    setFollowUps([]);
    setFollowUpError(getErrorMessage(error));
  } finally {
    setLoadingFollowUps(false);
  }
}, []);
```

Call after successful `loadJobDetail(jobId)`:

```ts
void loadFollowUps(jobId);
```

- [ ] **Step 5: Pass timeline props into `JobDetailModal`**

Extend `JobDetailModalProps`:

```ts
followUps: JobFollowUpRecord[];
loadingFollowUps: boolean;
followUpError: string | null;
onRetryFollowUps: () => void;
```

Pass from `JobManagePage`:

```tsx
followUps={followUps}
loadingFollowUps={loadingFollowUps}
followUpError={followUpError}
onRetryFollowUps={() => {
  if (selectedJobId !== null) {
    void loadFollowUps(selectedJobId);
  }
}}
```

- [ ] **Step 6: Render timeline section**

Inside `JobDetailModal`, below “跟进备注”, render:

```tsx
<div className="mt-6 rounded-2xl border border-slate-100 p-5 dark:border-slate-700">
  <div className="mb-4 flex items-center justify-between gap-3">
    <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">投递跟进时间线</h3>
    {job.nextFollowUpAt && (
      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
        下次跟进：{formatDateTime(job.nextFollowUpAt)}
      </span>
    )}
  </div>
  {loadingFollowUps && <p className="text-sm text-slate-400">正在加载跟进记录...</p>}
  {!loadingFollowUps && followUpError && (
    <button type="button" onClick={onRetryFollowUps} className="text-sm text-red-500">
      {followUpError}，点击重试
    </button>
  )}
  {!loadingFollowUps && !followUpError && followUps.length === 0 && (
    <p className="text-sm text-slate-400">还没有跟进记录，标记投递或添加备注后会出现在这里。</p>
  )}
  {!loadingFollowUps && !followUpError && followUps.length > 0 && (
    <div className="space-y-3">
      {followUps.map((record) => (
        <div key={record.id} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{record.title}</p>
            <span className="text-xs text-slate-400">{formatDateTime(record.createdAt)}</span>
          </div>
          {record.content && (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-500 dark:text-slate-300">
              {record.content}
            </p>
          )}
        </div>
      ))}
    </div>
  )}
</div>
```

- [ ] **Step 7: Run frontend build**

Run:

```powershell
Push-Location frontend; npm.cmd run build; Pop-Location
```

Expected: `✓ built`.

- [ ] **Step 8: Commit timeline display**

Run:

```powershell
git add frontend/src/types/job.ts frontend/src/types/job-follow-up.ts frontend/src/api/jobFollowUps.ts frontend/src/api/index.ts frontend/src/pages/JobManagePage.tsx
git commit -m "feat(job): 展示职位投递跟进时间线"
```

---

### Task 4: Frontend Manual Follow-Up and Quick Status Actions

**Files:**
- Create: `frontend/src/components/JobFollowUpDialog.tsx`
- Modify: `frontend/src/pages/JobManagePage.tsx`

- [ ] **Step 1: Create `JobFollowUpDialog`**

Create component:

```tsx
import { useEffect, useState } from 'react';
import ConfirmDialog from './ConfirmDialog';
import type { CreateJobFollowUpForm, JobFollowUpType } from '../types/job-follow-up';

interface JobFollowUpDialogProps {
  open: boolean;
  loading?: boolean;
  onCancel: () => void;
  onSubmit: (data: CreateJobFollowUpForm) => void;
}

const typeOptions: Array<{ value: JobFollowUpType; label: string }> = [
  { value: 'MANUAL_NOTE', label: '备注' },
  { value: 'CONTACT', label: '沟通' },
  { value: 'INTERVIEW', label: '面试' },
  { value: 'OFFER', label: 'Offer' },
  { value: 'REJECTION', label: '拒绝' },
];

export default function JobFollowUpDialog({ open, loading = false, onCancel, onSubmit }: JobFollowUpDialogProps) {
  const [type, setType] = useState<JobFollowUpType>('CONTACT');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [contactMethod, setContactMethod] = useState('BOSS');
  const [nextFollowUpAt, setNextFollowUpAt] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setType('CONTACT');
    setTitle('');
    setContent('');
    setContactMethod('BOSS');
    setNextFollowUpAt('');
    setError('');
  }, [open]);

  const handleConfirm = () => {
    if (!content.trim()) {
      setError('请输入跟进内容');
      return;
    }
    onSubmit({
      type,
      title: title.trim() || undefined,
      content: content.trim(),
      contactMethod: contactMethod.trim() || undefined,
      nextFollowUpAt: nextFollowUpAt || undefined,
    });
  };

  return (
    <ConfirmDialog
      open={open}
      title="添加投递跟进"
      message=""
      confirmText="保存跟进"
      cancelText="取消"
      loading={loading}
      onConfirm={handleConfirm}
      onCancel={onCancel}
      customContent={
        <div className="space-y-4">
          <select value={type} onChange={(event) => setType(event.target.value as JobFollowUpType)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
            {typeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <input value={title} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="标题，可不填" />
          <input value={contactMethod} onChange={(event) => setContactMethod(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="沟通方式，例如 BOSS / 微信 / 电话" />
          <textarea value={content} onChange={(event) => { setContent(event.target.value); setError(''); }} className="min-h-32 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" placeholder="记录沟通内容、反馈或下一步计划" />
          <input type="datetime-local" value={nextFollowUpAt} onChange={(event) => setNextFollowUpAt(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" />
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
      }
    />
  );
}
```

- [ ] **Step 2: Add dialog state in `JobManagePage`**

Add:

```ts
const [followUpDialogOpen, setFollowUpDialogOpen] = useState(false);
const [savingFollowUp, setSavingFollowUp] = useState(false);
```

- [ ] **Step 3: Add manual save handler**

Add:

```ts
const handleCreateFollowUp = async (data: CreateJobFollowUpForm) => {
  if (!selectedJob) return;
  setSavingFollowUp(true);
  setActionError(null);
  try {
    await jobFollowUpApi.create(selectedJob.id, data);
    setFollowUpDialogOpen(false);
    await loadJobDetail(selectedJob.id);
    await loadFollowUps(selectedJob.id);
    await loadJobs(selectedJob.id);
  } catch (error) {
    setActionError(getErrorMessage(error));
  } finally {
    setSavingFollowUp(false);
  }
};
```

- [ ] **Step 4: Add quick status action handler**

Add:

```ts
const updateSelectedJobStatus = async (status: JobApplicationStatus) => {
  if (!selectedJob || selectedJob.applicationStatus === status) return;
  setActionError(null);
  try {
    await jobApi.updateJob(selectedJob.id, { applicationStatus: status });
    await loadJobDetail(selectedJob.id);
    await loadFollowUps(selectedJob.id);
    await loadJobs(selectedJob.id);
  } catch (error) {
    setActionError(getErrorMessage(error));
  }
};
```

- [ ] **Step 5: Add buttons to `JobDetailModal` props and UI**

Add props:

```ts
onAddFollowUp: () => void;
onChangeStatus: (status: JobApplicationStatus) => void;
```

Render buttons near existing action buttons:

```tsx
<button type="button" onClick={onAddFollowUp} className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
  添加跟进
</button>
<button type="button" onClick={() => onChangeStatus('APPLIED')} className="rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-medium text-white">标记已投递</button>
<button type="button" onClick={() => onChangeStatus('INTERVIEWING')} className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-medium text-white">进入面试中</button>
```

Keep existing “编辑职位”“简历匹配”“定向面试” buttons.

- [ ] **Step 6: Mount `JobFollowUpDialog`**

Add below existing dialogs:

```tsx
<JobFollowUpDialog
  open={followUpDialogOpen}
  loading={savingFollowUp}
  onCancel={() => setFollowUpDialogOpen(false)}
  onSubmit={(data) => void handleCreateFollowUp(data)}
/>
```

- [ ] **Step 7: Run frontend build**

Run:

```powershell
Push-Location frontend; npm.cmd run build; Pop-Location
```

Expected: `✓ built`.

- [ ] **Step 8: Commit follow-up actions**

Run:

```powershell
git add frontend/src/components/JobFollowUpDialog.tsx frontend/src/pages/JobManagePage.tsx
git commit -m "feat(job): 支持添加投递跟进记录"
```

---

### Task 5: Documentation and Final Verification

**Files:**
- Modify: `docs/2026-04-21-投递辅助闭环-手动联调清单.md`
- Modify: `docs/2026-04-22-手动测试清单与样本数据.md`
- Modify: `docs/development-progress.md`

- [ ] **Step 1: Update manual integration checklist**

Add checks:

```markdown
| 11 | 标记已投递 | 在职位详情中点击“标记已投递” | 状态变为已投递，时间线出现状态变化记录 |
| 12 | 添加跟进记录 | 添加一条 BOSS 沟通记录并设置下一步跟进时间 | 时间线出现记录，职位详情显示下一步跟进时间 |
| 13 | 状态推进 | 将职位改为面试中 / Offer / 拒绝 | 每次状态变化都进入时间线 |
```

- [ ] **Step 2: Update broad manual test checklist**

Add under 职位管理:

```markdown
| 投递跟进 | 标记已投递、添加沟通记录、设置下一步跟进时间 | 职位详情显示完整时间线 |
```

- [ ] **Step 3: Update development progress**

Add validation rows:

```markdown
| `2026-04-26` | `JobFollowUpServiceTest` / `JobServiceFollowUpTest` | 通过，验证投递跟进后端闭环 |
| `2026-04-26` | `frontend -> npm.cmd run build`（投递跟进前端改造后） | 通过，仍存在既有 CSS/chunk warning |
```

Update current priority to indicate auxiliary application follow-up is ready for manual regression.

- [ ] **Step 4: Run final backend verification**

Run:

```powershell
$env:JAVA_HOME='G:\jdk'; .\gradlew.bat :app:test --tests "com.nbwf.modules.job.service.JobFollowUpServiceTest" --tests "com.nbwf.modules.job.service.JobServiceFollowUpTest"
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 5: Run final frontend verification**

Run:

```powershell
Push-Location frontend; npm.cmd run build; Pop-Location
```

Expected: `✓ built`.

- [ ] **Step 6: Commit docs**

Run:

```powershell
git add -f docs/2026-04-21-投递辅助闭环-手动联调清单.md docs/2026-04-22-手动测试清单与样本数据.md docs/development-progress.md
git commit -m "docs(job): 同步辅助投递闭环测试清单"
```

- [ ] **Step 7: Push all commits**

Run:

```powershell
git push origin master
```

Expected: remote accepts all local commits. If GitHub connection resets, report `git status --short --branch` and ask the user to retry manually.

---

## Self-Review

| Check | Result |
|---|---|
| Spec coverage | Covered data model, automatic status records, manual records, frontend timeline, quick status actions, docs, validation |
| Placeholder scan | No incomplete placeholder wording or undefined future-only requirements |
| Type consistency | Backend uses `JobFollowUpType`, `JobFollowUpRecordDTO`, `CreateJobFollowUpRequest`; frontend mirrors with `JobFollowUpType`, `JobFollowUpRecord`, `CreateJobFollowUpForm` |
| Scope control | Contact/company CRM, reminders, deletion, and extension-side direct apply actions remain out of scope |
