# Job Draft Pool P0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建 P0 版本的统一职位草稿池，让“简历生成职位草稿”和“BOSS 当前页同步职位”都进入同一个可恢复、可多选、可批量导入职位工作台的流程。

**Architecture:** 后端新增 `jobdraft` 子模块，负责草稿批次、草稿项、选择状态、批量导入与最近批次恢复；现有 `jobs` 模块保留正式职位工作台职责。前端新增 `职位草稿` 页面和 `jobDrafts` API/types，职位工作台只保留正式职位管理，简历生成草稿入口改为跳转草稿批次。

**Tech Stack:** Java 21、Spring Boot、Spring Data JPA、Hibernate `ddl-auto=update`、JUnit 5、Mockito、React、TypeScript、Vite、Tailwind CSS。

---

## 提交规范

| 类型 | 示例 | 说明 |
|---|---|---|
| 新功能 | `feat: 新增职位草稿池批次接口` | 英文类型 + 中文说明 |
| 修复 | `fix: 修复职位草稿导入重复保存问题` | 英文类型 + 中文说明 |
| 文档 | `docs: 补充职位草稿池实现计划` | 英文类型 + 中文说明 |
| 测试 | `test: 增加职位草稿批量导入测试` | 英文类型 + 中文说明 |
| 重构 | `refactor: 拆分职位草稿状态映射逻辑` | 英文类型 + 中文说明 |

## 范围切分

| 范围 | 本计划是否包含 | 说明 |
|---|---:|---|
| 后端草稿池数据模型 | 是 | P0 必须完成 |
| 后端草稿批次接口 | 是 | P0 必须完成 |
| 后端批量导入职位工作台 | 是 | P0 必须完成 |
| 简历生成草稿统一承接 | 是 | P0 必须完成 |
| BOSS 当前页同步承接接口 | 是 | 接收扩展提交的数据，但不实现扩展本体 |
| 前端职位草稿页面 | 是 | P0 必须完成 |
| 浏览器扩展工程 | 否 | 作为独立子项目处理，本计划只提供系统侧接口 |
| JD 详情页自动补全 | 否 | P1 处理，本计划保留状态字段和接口扩展位置 |
| SSE/WebSocket | 否 | P1 处理，P0 使用轮询/刷新 |

## 文件结构

| 文件 | 操作 | 职责 |
|---|---|---|
| `app/src/main/java/com/nbwf/modules/jobdraft/model/JobDraftBatchStatus.java` | 新建 | 定义批次状态 |
| `app/src/main/java/com/nbwf/modules/jobdraft/model/JobDraftDetailSyncStatus.java` | 新建 | 定义详情补全状态 |
| `app/src/main/java/com/nbwf/modules/jobdraft/model/JobDraftSourceType.java` | 新建 | 定义草稿来源 |
| `app/src/main/java/com/nbwf/modules/jobdraft/model/JobDraftBatchEntity.java` | 新建 | 草稿批次实体 |
| `app/src/main/java/com/nbwf/modules/jobdraft/model/JobDraftItemEntity.java` | 新建 | 草稿项实体 |
| `app/src/main/java/com/nbwf/modules/jobdraft/model/*.java` | 新建 | 请求与响应 DTO |
| `app/src/main/java/com/nbwf/modules/jobdraft/repository/JobDraftBatchRepository.java` | 新建 | 批次查询 |
| `app/src/main/java/com/nbwf/modules/jobdraft/repository/JobDraftItemRepository.java` | 新建 | 草稿项查询 |
| `app/src/main/java/com/nbwf/modules/jobdraft/service/JobDraftFingerprintService.java` | 新建 | 生成 `sourceFingerprint` |
| `app/src/main/java/com/nbwf/modules/jobdraft/service/JobDraftService.java` | 新建 | 批次创建、选择、导入、恢复 |
| `app/src/main/java/com/nbwf/modules/jobdraft/JobDraftController.java` | 新建 | `/api/job-drafts` 接口 |
| `app/src/main/java/com/nbwf/modules/job/model/JobEntity.java` | 修改 | 增加来源字段与 JD 完整度 |
| `app/src/main/java/com/nbwf/modules/job/repository/JobRepository.java` | 修改 | 增加来源指纹查询 |
| `app/src/main/java/com/nbwf/modules/job/JobController.java` | 修改 | 保留旧接口，新增兼容跳转用批次接口 |
| `app/src/main/java/com/nbwf/modules/job/service/JobService.java` | 修改 | 新增从草稿导入正式职位的受控方法 |
| `frontend/src/types/job-draft.ts` | 新建 | 草稿池前端类型 |
| `frontend/src/api/jobDrafts.ts` | 新建 | 草稿池 API |
| `frontend/src/api/index.ts` | 修改 | 导出 `jobDraftApi` |
| `frontend/src/pages/JobDraftPage.tsx` | 新建 | 职位草稿页面 |
| `frontend/src/App.tsx` | 修改 | 注册 `/jobs/drafts` 路由 |
| `frontend/src/components/Layout.tsx` | 修改 | 增加“职位草稿”导航 |
| `frontend/src/pages/ResumeDetailPage.tsx` | 修改 | 简历生成草稿后跳转职位草稿页 |
| `frontend/src/pages/JobManagePage.tsx` | 修改 | 增加“查看职位草稿”入口 |
| `docs/DEVELOPMENT_PROGRESS.md` | 修改 | 记录本次模块进度 |

---

## Task 1: 后端草稿实体与仓库

**Files:**
- Create: `app/src/main/java/com/nbwf/modules/jobdraft/model/JobDraftBatchStatus.java`
- Create: `app/src/main/java/com/nbwf/modules/jobdraft/model/JobDraftDetailSyncStatus.java`
- Create: `app/src/main/java/com/nbwf/modules/jobdraft/model/JobDraftSourceType.java`
- Create: `app/src/main/java/com/nbwf/modules/jobdraft/model/JobDraftBatchEntity.java`
- Create: `app/src/main/java/com/nbwf/modules/jobdraft/model/JobDraftItemEntity.java`
- Create: `app/src/main/java/com/nbwf/modules/jobdraft/repository/JobDraftBatchRepository.java`
- Create: `app/src/main/java/com/nbwf/modules/jobdraft/repository/JobDraftItemRepository.java`
- Modify: `app/src/main/java/com/nbwf/modules/job/model/JobEntity.java`
- Modify: `app/src/main/java/com/nbwf/modules/job/repository/JobRepository.java`
- Test: `app/src/test/java/com/nbwf/modules/jobdraft/service/JobDraftFingerprintServiceTest.java`

- [ ] **Step 1: 新建草稿状态枚举**

Create `app/src/main/java/com/nbwf/modules/jobdraft/model/JobDraftBatchStatus.java`:

```java
package com.nbwf.modules.jobdraft.model;

public enum JobDraftBatchStatus {
    CREATED,
    ANALYZING,
    READY,
    PARTIAL_IMPORTED,
    COMPLETED,
    FAILED
}
```

Create `app/src/main/java/com/nbwf/modules/jobdraft/model/JobDraftDetailSyncStatus.java`:

```java
package com.nbwf.modules.jobdraft.model;

public enum JobDraftDetailSyncStatus {
    UNSYNCED,
    PARTIAL,
    COMPLETED,
    FAILED
}
```

Create `app/src/main/java/com/nbwf/modules/jobdraft/model/JobDraftSourceType.java`:

```java
package com.nbwf.modules.jobdraft.model;

public enum JobDraftSourceType {
    RESUME_GENERATION,
    PAGE_SYNC
}
```

- [ ] **Step 2: 新建批次实体**

Create `app/src/main/java/com/nbwf/modules/jobdraft/model/JobDraftBatchEntity.java`:

```java
package com.nbwf.modules.jobdraft.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "job_draft_batches", indexes = {
    @Index(name = "idx_job_draft_batch_user_id", columnList = "user_id"),
    @Index(name = "idx_job_draft_batch_batch_id", columnList = "batch_id", unique = true),
    @Index(name = "idx_job_draft_batch_status", columnList = "status")
})
public class JobDraftBatchEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "batch_id", nullable = false, unique = true, length = 40)
    private String batchId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", nullable = false, length = 40)
    private JobDraftSourceType sourceType;

    @Column(name = "resume_id")
    private Long resumeId;

    @Column(name = "source_platform", length = 40)
    private String sourcePlatform;

    @Column(name = "source_page_url", columnDefinition = "TEXT")
    private String sourcePageUrl;

    @Column(name = "source_page_title", length = 300)
    private String sourcePageTitle;

    @Column(name = "total_count", nullable = false)
    private int totalCount;

    @Column(name = "selected_count", nullable = false)
    private int selectedCount;

    @Column(name = "imported_count", nullable = false)
    private int importedCount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private JobDraftBatchStatus status = JobDraftBatchStatus.CREATED;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
        if (expiresAt == null) {
            expiresAt = now.plusDays(30);
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getBatchId() { return batchId; }
    public void setBatchId(String batchId) { this.batchId = batchId; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public JobDraftSourceType getSourceType() { return sourceType; }
    public void setSourceType(JobDraftSourceType sourceType) { this.sourceType = sourceType; }
    public Long getResumeId() { return resumeId; }
    public void setResumeId(Long resumeId) { this.resumeId = resumeId; }
    public String getSourcePlatform() { return sourcePlatform; }
    public void setSourcePlatform(String sourcePlatform) { this.sourcePlatform = sourcePlatform; }
    public String getSourcePageUrl() { return sourcePageUrl; }
    public void setSourcePageUrl(String sourcePageUrl) { this.sourcePageUrl = sourcePageUrl; }
    public String getSourcePageTitle() { return sourcePageTitle; }
    public void setSourcePageTitle(String sourcePageTitle) { this.sourcePageTitle = sourcePageTitle; }
    public int getTotalCount() { return totalCount; }
    public void setTotalCount(int totalCount) { this.totalCount = totalCount; }
    public int getSelectedCount() { return selectedCount; }
    public void setSelectedCount(int selectedCount) { this.selectedCount = selectedCount; }
    public int getImportedCount() { return importedCount; }
    public void setImportedCount(int importedCount) { this.importedCount = importedCount; }
    public JobDraftBatchStatus getStatus() { return status; }
    public void setStatus(JobDraftBatchStatus status) { this.status = status; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public LocalDateTime getExpiresAt() { return expiresAt; }
    public void setExpiresAt(LocalDateTime expiresAt) { this.expiresAt = expiresAt; }
}
```

- [ ] **Step 3: 新建草稿项实体**

Create `app/src/main/java/com/nbwf/modules/jobdraft/model/JobDraftItemEntity.java`:

```java
package com.nbwf.modules.jobdraft.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "job_draft_items", indexes = {
    @Index(name = "idx_job_draft_item_batch_id", columnList = "batch_id"),
    @Index(name = "idx_job_draft_item_user_id", columnList = "user_id"),
    @Index(name = "idx_job_draft_item_draft_item_id", columnList = "draft_item_id", unique = true),
    @Index(name = "idx_job_draft_item_source_fingerprint", columnList = "source_fingerprint")
})
public class JobDraftItemEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "draft_item_id", nullable = false, unique = true, length = 40)
    private String draftItemId;

    @Column(name = "batch_id", nullable = false, length = 40)
    private String batchId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", nullable = false, length = 40)
    private JobDraftSourceType sourceType;

    @Column(name = "source_platform", length = 40)
    private String sourcePlatform;

    @Column(name = "external_job_id", length = 120)
    private String externalJobId;

    @Column(name = "source_url", columnDefinition = "TEXT")
    private String sourceUrl;

    @Column(name = "source_fingerprint", nullable = false, length = 160)
    private String sourceFingerprint;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, length = 200)
    private String company;

    @Column(name = "description_preview", columnDefinition = "TEXT")
    private String descriptionPreview;

    @Column(name = "description_full", columnDefinition = "TEXT")
    private String descriptionFull;

    @Column(length = 100)
    private String location;

    @Column(name = "salary_min")
    private Integer salaryMin;

    @Column(name = "salary_max")
    private Integer salaryMax;

    @Column(name = "salary_text_raw", length = 100)
    private String salaryTextRaw;

    @Column(name = "experience_text_raw", length = 100)
    private String experienceTextRaw;

    @Column(name = "education_text_raw", length = 100)
    private String educationTextRaw;

    @Column(name = "tech_tags_json", columnDefinition = "TEXT")
    private String techTagsJson;

    @Column(name = "benefits_json", columnDefinition = "TEXT")
    private String benefitsJson;

    @Column(name = "recruiter_name", length = 100)
    private String recruiterName;

    @Column(name = "raw_payload_json", columnDefinition = "TEXT")
    private String rawPayloadJson;

    @Column(name = "is_selected", nullable = false)
    private boolean selected;

    @Column(name = "selected_at")
    private LocalDateTime selectedAt;

    @Column(name = "is_imported", nullable = false)
    private boolean imported;

    @Column(name = "imported_job_id")
    private Long importedJobId;

    @Enumerated(EnumType.STRING)
    @Column(name = "detail_sync_status", nullable = false, length = 40)
    private JobDraftDetailSyncStatus detailSyncStatus = JobDraftDetailSyncStatus.UNSYNCED;

    @Column(name = "coarse_match_score")
    private Integer coarseMatchScore;

    @Column(name = "precise_match_score")
    private Integer preciseMatchScore;

    @Column(name = "match_summary", columnDefinition = "TEXT")
    private String matchSummary;

    @Column(name = "opener_text", columnDefinition = "TEXT")
    private String openerText;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getDraftItemId() { return draftItemId; }
    public void setDraftItemId(String draftItemId) { this.draftItemId = draftItemId; }
    public String getBatchId() { return batchId; }
    public void setBatchId(String batchId) { this.batchId = batchId; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public JobDraftSourceType getSourceType() { return sourceType; }
    public void setSourceType(JobDraftSourceType sourceType) { this.sourceType = sourceType; }
    public String getSourcePlatform() { return sourcePlatform; }
    public void setSourcePlatform(String sourcePlatform) { this.sourcePlatform = sourcePlatform; }
    public String getExternalJobId() { return externalJobId; }
    public void setExternalJobId(String externalJobId) { this.externalJobId = externalJobId; }
    public String getSourceUrl() { return sourceUrl; }
    public void setSourceUrl(String sourceUrl) { this.sourceUrl = sourceUrl; }
    public String getSourceFingerprint() { return sourceFingerprint; }
    public void setSourceFingerprint(String sourceFingerprint) { this.sourceFingerprint = sourceFingerprint; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getCompany() { return company; }
    public void setCompany(String company) { this.company = company; }
    public String getDescriptionPreview() { return descriptionPreview; }
    public void setDescriptionPreview(String descriptionPreview) { this.descriptionPreview = descriptionPreview; }
    public String getDescriptionFull() { return descriptionFull; }
    public void setDescriptionFull(String descriptionFull) { this.descriptionFull = descriptionFull; }
    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }
    public Integer getSalaryMin() { return salaryMin; }
    public void setSalaryMin(Integer salaryMin) { this.salaryMin = salaryMin; }
    public Integer getSalaryMax() { return salaryMax; }
    public void setSalaryMax(Integer salaryMax) { this.salaryMax = salaryMax; }
    public String getSalaryTextRaw() { return salaryTextRaw; }
    public void setSalaryTextRaw(String salaryTextRaw) { this.salaryTextRaw = salaryTextRaw; }
    public String getExperienceTextRaw() { return experienceTextRaw; }
    public void setExperienceTextRaw(String experienceTextRaw) { this.experienceTextRaw = experienceTextRaw; }
    public String getEducationTextRaw() { return educationTextRaw; }
    public void setEducationTextRaw(String educationTextRaw) { this.educationTextRaw = educationTextRaw; }
    public String getTechTagsJson() { return techTagsJson; }
    public void setTechTagsJson(String techTagsJson) { this.techTagsJson = techTagsJson; }
    public String getBenefitsJson() { return benefitsJson; }
    public void setBenefitsJson(String benefitsJson) { this.benefitsJson = benefitsJson; }
    public String getRecruiterName() { return recruiterName; }
    public void setRecruiterName(String recruiterName) { this.recruiterName = recruiterName; }
    public String getRawPayloadJson() { return rawPayloadJson; }
    public void setRawPayloadJson(String rawPayloadJson) { this.rawPayloadJson = rawPayloadJson; }
    public boolean isSelected() { return selected; }
    public void setSelected(boolean selected) { this.selected = selected; }
    public LocalDateTime getSelectedAt() { return selectedAt; }
    public void setSelectedAt(LocalDateTime selectedAt) { this.selectedAt = selectedAt; }
    public boolean isImported() { return imported; }
    public void setImported(boolean imported) { this.imported = imported; }
    public Long getImportedJobId() { return importedJobId; }
    public void setImportedJobId(Long importedJobId) { this.importedJobId = importedJobId; }
    public JobDraftDetailSyncStatus getDetailSyncStatus() { return detailSyncStatus; }
    public void setDetailSyncStatus(JobDraftDetailSyncStatus detailSyncStatus) { this.detailSyncStatus = detailSyncStatus; }
    public Integer getCoarseMatchScore() { return coarseMatchScore; }
    public void setCoarseMatchScore(Integer coarseMatchScore) { this.coarseMatchScore = coarseMatchScore; }
    public Integer getPreciseMatchScore() { return preciseMatchScore; }
    public void setPreciseMatchScore(Integer preciseMatchScore) { this.preciseMatchScore = preciseMatchScore; }
    public String getMatchSummary() { return matchSummary; }
    public void setMatchSummary(String matchSummary) { this.matchSummary = matchSummary; }
    public String getOpenerText() { return openerText; }
    public void setOpenerText(String openerText) { this.openerText = openerText; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
```

- [ ] **Step 4: 新建仓库接口**

Create `app/src/main/java/com/nbwf/modules/jobdraft/repository/JobDraftBatchRepository.java`:

```java
package com.nbwf.modules.jobdraft.repository;

import com.nbwf.modules.jobdraft.model.JobDraftBatchEntity;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface JobDraftBatchRepository extends JpaRepository<JobDraftBatchEntity, Long> {
    Optional<JobDraftBatchEntity> findByBatchIdAndUserId(String batchId, Long userId);
    Optional<JobDraftBatchEntity> findFirstByUserIdOrderByUpdatedAtDesc(Long userId);
}
```

Create `app/src/main/java/com/nbwf/modules/jobdraft/repository/JobDraftItemRepository.java`:

```java
package com.nbwf.modules.jobdraft.repository;

import com.nbwf.modules.jobdraft.model.JobDraftItemEntity;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface JobDraftItemRepository extends JpaRepository<JobDraftItemEntity, Long> {
    List<JobDraftItemEntity> findByBatchIdAndUserIdOrderByCoarseMatchScoreDescCreatedAtDesc(String batchId, Long userId);
    List<JobDraftItemEntity> findByBatchIdAndUserIdAndDraftItemIdIn(String batchId, Long userId, Collection<String> draftItemIds);
    Optional<JobDraftItemEntity> findByDraftItemIdAndUserId(String draftItemId, Long userId);
    boolean existsByUserIdAndSourceFingerprintAndImportedTrue(Long userId, String sourceFingerprint);
}
```

- [ ] **Step 5: 扩展正式职位来源字段**

Modify `app/src/main/java/com/nbwf/modules/job/model/JobEntity.java`:

```java
@Column(name = "source_platform", length = 40)
private String sourcePlatform;

@Column(name = "source_url", columnDefinition = "TEXT")
private String sourceUrl;

@Column(name = "external_job_id", length = 120)
private String externalJobId;

@Column(name = "source_fingerprint", length = 160)
private String sourceFingerprint;

@Column(name = "draft_item_id", length = 40)
private String draftItemId;

@Column(name = "jd_completeness", length = 40)
private String jdCompleteness;
```

Add getters/setters for all six fields in the same style as existing properties.

Modify `@Table` indexes:

```java
@Table(name = "jobs", indexes = {
    @Index(name = "idx_job_user_id", columnList = "user_id"),
    @Index(name = "idx_job_application_status", columnList = "application_status"),
    @Index(name = "idx_job_source_fingerprint", columnList = "source_fingerprint")
})
```

- [ ] **Step 6: 增加正式职位去重查询**

Modify `app/src/main/java/com/nbwf/modules/job/repository/JobRepository.java`:

```java
Optional<JobEntity> findFirstByUserIdAndSourceFingerprint(Long userId, String sourceFingerprint);
boolean existsByUserIdAndSourceFingerprint(Long userId, String sourceFingerprint);
```

- [ ] **Step 7: 提交实体与仓库**

Run:

```bash
.\gradlew.bat :app:test --tests com.nbwf.modules.job.service.JobServiceDraftsTest
```

Expected: PASS.

Commit:

```bash
git add app/src/main/java/com/nbwf/modules/jobdraft app/src/main/java/com/nbwf/modules/job/model/JobEntity.java app/src/main/java/com/nbwf/modules/job/repository/JobRepository.java
git commit -m "feat: 新增职位草稿池实体与仓库"
```

---

## Task 2: 后端草稿服务与批次创建

**Files:**
- Create: `app/src/main/java/com/nbwf/modules/jobdraft/model/CreateDraftBatchFromPageSyncRequest.java`
- Create: `app/src/main/java/com/nbwf/modules/jobdraft/model/PageSyncJobDraftRequest.java`
- Create: `app/src/main/java/com/nbwf/modules/jobdraft/model/JobDraftBatchDTO.java`
- Create: `app/src/main/java/com/nbwf/modules/jobdraft/model/JobDraftItemDTO.java`
- Create: `app/src/main/java/com/nbwf/modules/jobdraft/model/JobDraftBatchCreatedDTO.java`
- Create: `app/src/main/java/com/nbwf/modules/jobdraft/service/JobDraftFingerprintService.java`
- Create: `app/src/main/java/com/nbwf/modules/jobdraft/service/JobDraftService.java`
- Test: `app/src/test/java/com/nbwf/modules/jobdraft/service/JobDraftFingerprintServiceTest.java`
- Test: `app/src/test/java/com/nbwf/modules/jobdraft/service/JobDraftServiceTest.java`

- [ ] **Step 1: 先写指纹服务测试**

Create `app/src/test/java/com/nbwf/modules/jobdraft/service/JobDraftFingerprintServiceTest.java`:

```java
package com.nbwf.modules.jobdraft.service;

import com.nbwf.modules.jobdraft.model.PageSyncJobDraftRequest;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JobDraftFingerprintServiceTest {

    private final JobDraftFingerprintService service = new JobDraftFingerprintService();

    @Test
    void buildShouldPreferExternalJobId() {
        PageSyncJobDraftRequest req = new PageSyncJobDraftRequest(
            "boss_123",
            "https://www.zhipin.com/job_detail/abc.html",
            "Java 后端开发",
            "测试科技",
            "上海",
            "15-25K",
            15000,
            25000,
            "3-5年",
            "本科",
            "负责 Java 服务开发",
            List.of("Java", "Spring Boot"),
            List.of("五险一金"),
            "张先生",
            Map.of("source", "unit-test")
        );

        assertEquals("BOSS:external:boss_123", service.build("BOSS", req));
    }

    @Test
    void buildShouldUseUrlWhenExternalJobIdMissing() {
        PageSyncJobDraftRequest req = new PageSyncJobDraftRequest(
            null,
            " https://www.zhipin.com/job_detail/abc.html ",
            "Java 后端开发",
            "测试科技",
            "上海",
            "15-25K",
            15000,
            25000,
            "3-5年",
            "本科",
            "负责 Java 服务开发",
            List.of("Java"),
            List.of(),
            null,
            Map.of()
        );

        assertEquals("BOSS:url:https://www.zhipin.com/job_detail/abc.html", service.build("BOSS", req));
    }

    @Test
    void buildShouldFallbackToStableHash() {
        PageSyncJobDraftRequest req = new PageSyncJobDraftRequest(
            null,
            null,
            " Java 后端开发 ",
            " 测试科技 ",
            " 上海 ",
            "15-25K",
            15000,
            25000,
            "3-5年",
            "本科",
            "负责 Java 服务开发",
            List.of("Java"),
            List.of(),
            null,
            Map.of()
        );

        String fingerprint = service.build("BOSS", req);

        assertTrue(fingerprint.startsWith("BOSS:hash:"));
        assertEquals(fingerprint, service.build("BOSS", req));
    }
}
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
.\gradlew.bat :app:test --tests com.nbwf.modules.jobdraft.service.JobDraftFingerprintServiceTest
```

Expected: FAIL because `JobDraftFingerprintService` and `PageSyncJobDraftRequest` do not exist.

- [ ] **Step 3: 新建请求 DTO**

Create `app/src/main/java/com/nbwf/modules/jobdraft/model/PageSyncJobDraftRequest.java`:

```java
package com.nbwf.modules.jobdraft.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;

public record PageSyncJobDraftRequest(
    @Size(max = 120) String externalJobId,
    String sourceUrl,
    @NotBlank @Size(max = 200) String title,
    @NotBlank @Size(max = 200) String company,
    @Size(max = 100) String location,
    @Size(max = 100) String salaryTextRaw,
    Integer salaryMin,
    Integer salaryMax,
    @Size(max = 100) String experienceTextRaw,
    @Size(max = 100) String educationTextRaw,
    String descriptionPreview,
    List<String> techTags,
    List<String> benefits,
    @Size(max = 100) String recruiterName,
    Map<String, Object> rawPayload
) {
}
```

Create `app/src/main/java/com/nbwf/modules/jobdraft/model/CreateDraftBatchFromPageSyncRequest.java`:

```java
package com.nbwf.modules.jobdraft.model;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import java.util.List;

public record CreateDraftBatchFromPageSyncRequest(
    Long resumeId,
    @NotBlank @Size(max = 40) String sourcePlatform,
    String sourcePageUrl,
    @Size(max = 300) String sourcePageTitle,
    @Size(max = 160) String pageFingerprint,
    @NotEmpty List<@Valid PageSyncJobDraftRequest> jobs
) {
}
```

- [ ] **Step 4: 新建响应 DTO**

Create `app/src/main/java/com/nbwf/modules/jobdraft/model/JobDraftBatchDTO.java`:

```java
package com.nbwf.modules.jobdraft.model;

import java.time.LocalDateTime;

public record JobDraftBatchDTO(
    String batchId,
    JobDraftSourceType sourceType,
    Long resumeId,
    String sourcePlatform,
    String sourcePageUrl,
    String sourcePageTitle,
    int totalCount,
    int selectedCount,
    int importedCount,
    JobDraftBatchStatus status,
    LocalDateTime createdAt,
    LocalDateTime updatedAt,
    LocalDateTime expiresAt
) {
}
```

Create `app/src/main/java/com/nbwf/modules/jobdraft/model/JobDraftItemDTO.java`:

```java
package com.nbwf.modules.jobdraft.model;

import java.time.LocalDateTime;
import java.util.List;

public record JobDraftItemDTO(
    String draftItemId,
    String batchId,
    JobDraftSourceType sourceType,
    String sourcePlatform,
    String externalJobId,
    String sourceUrl,
    String sourceFingerprint,
    String title,
    String company,
    String descriptionPreview,
    String descriptionFull,
    String location,
    Integer salaryMin,
    Integer salaryMax,
    String salaryTextRaw,
    String experienceTextRaw,
    String educationTextRaw,
    List<String> techTags,
    List<String> benefits,
    String recruiterName,
    boolean selected,
    boolean imported,
    Long importedJobId,
    JobDraftDetailSyncStatus detailSyncStatus,
    Integer coarseMatchScore,
    Integer preciseMatchScore,
    String matchSummary,
    String openerText,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {
}
```

Create `app/src/main/java/com/nbwf/modules/jobdraft/model/JobDraftBatchCreatedDTO.java`:

```java
package com.nbwf.modules.jobdraft.model;

public record JobDraftBatchCreatedDTO(
    String batchId,
    JobDraftBatchStatus status,
    int totalCount,
    Long resumeId,
    String taskId,
    boolean needResumeSelection
) {
}
```

- [ ] **Step 5: 实现指纹服务**

Create `app/src/main/java/com/nbwf/modules/jobdraft/service/JobDraftFingerprintService.java`:

```java
package com.nbwf.modules.jobdraft.service;

import com.nbwf.modules.jobdraft.model.PageSyncJobDraftRequest;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Locale;
import java.util.StringJoiner;

@Service
public class JobDraftFingerprintService {

    public String build(String sourcePlatform, PageSyncJobDraftRequest req) {
        String platform = normalizePlatform(sourcePlatform);
        String externalJobId = trimToNull(req.externalJobId());
        if (externalJobId != null) {
            return platform + ":external:" + externalJobId;
        }

        String sourceUrl = trimToNull(req.sourceUrl());
        if (sourceUrl != null) {
            return platform + ":url:" + sourceUrl;
        }

        StringJoiner joiner = new StringJoiner("|");
        joiner.add(normalizeText(req.company()));
        joiner.add(normalizeText(req.title()));
        joiner.add(normalizeText(req.salaryTextRaw()));
        joiner.add(normalizeText(req.location()));
        return platform + ":hash:" + sha256(joiner.toString()).substring(0, 32);
    }

    private String normalizePlatform(String value) {
        String normalized = trimToNull(value);
        return normalized == null ? "UNKNOWN" : normalized.toUpperCase(Locale.ROOT);
    }

    private String normalizeText(String value) {
        String normalized = trimToNull(value);
        return normalized == null ? "" : normalized.toLowerCase(Locale.ROOT);
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 algorithm is not available", e);
        }
    }
}
```

- [ ] **Step 6: 运行指纹测试确认通过**

Run:

```bash
.\gradlew.bat :app:test --tests com.nbwf.modules.jobdraft.service.JobDraftFingerprintServiceTest
```

Expected: PASS.

- [ ] **Step 7: 新建服务测试覆盖批次创建**

Create `app/src/test/java/com/nbwf/modules/jobdraft/service/JobDraftServiceTest.java`:

```java
package com.nbwf.modules.jobdraft.service;

import com.nbwf.modules.job.repository.JobRepository;
import com.nbwf.modules.jobdraft.model.*;
import com.nbwf.modules.jobdraft.repository.JobDraftBatchRepository;
import com.nbwf.modules.jobdraft.repository.JobDraftItemRepository;
import com.nbwf.modules.resume.repository.ResumeRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JobDraftServiceTest {

    @Mock
    private JobDraftBatchRepository batchRepository;

    @Mock
    private JobDraftItemRepository itemRepository;

    @Mock
    private ResumeRepository resumeRepository;

    @Mock
    private JobRepository jobRepository;

    @Mock
    private JobDraftFingerprintService fingerprintService;

    @InjectMocks
    private JobDraftService jobDraftService;

    @Test
    void createBatchFromPageSyncShouldSaveBatchAndItems() {
        PageSyncJobDraftRequest job = new PageSyncJobDraftRequest(
            "boss_123",
            "https://www.zhipin.com/job_detail/abc.html",
            "Java 后端开发",
            "测试科技",
            "上海",
            "15-25K",
            15000,
            25000,
            "3-5年",
            "本科",
            "负责 Java 服务开发",
            List.of("Java", "Spring Boot"),
            List.of("五险一金"),
            "张先生",
            Map.of("source", "unit-test")
        );
        CreateDraftBatchFromPageSyncRequest req = new CreateDraftBatchFromPageSyncRequest(
            21L,
            "BOSS",
            "https://www.zhipin.com/web/geek/job",
            "BOSS直聘",
            "page-a",
            List.of(job)
        );

        when(fingerprintService.build("BOSS", job)).thenReturn("BOSS:external:boss_123");
        when(jobRepository.existsByUserIdAndSourceFingerprint(7L, "BOSS:external:boss_123")).thenReturn(false);
        when(batchRepository.save(any(JobDraftBatchEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(itemRepository.saveAll(any())).thenAnswer(invocation -> invocation.getArgument(0));

        JobDraftBatchCreatedDTO actual = jobDraftService.createBatchFromPageSync(req, 7L);

        assertEquals(1, actual.totalCount());
        assertEquals(JobDraftBatchStatus.READY, actual.status());
        assertEquals(21L, actual.resumeId());
        assertFalse(actual.needResumeSelection());

        ArgumentCaptor<JobDraftBatchEntity> batchCaptor = ArgumentCaptor.forClass(JobDraftBatchEntity.class);
        verify(batchRepository).save(batchCaptor.capture());
        assertEquals(JobDraftSourceType.PAGE_SYNC, batchCaptor.getValue().getSourceType());
        assertEquals("BOSS", batchCaptor.getValue().getSourcePlatform());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<JobDraftItemEntity>> itemsCaptor = ArgumentCaptor.forClass(List.class);
        verify(itemRepository).saveAll(itemsCaptor.capture());
        assertEquals("Java 后端开发", itemsCaptor.getValue().get(0).getTitle());
        assertEquals("测试科技", itemsCaptor.getValue().get(0).getCompany());
        assertEquals("BOSS:external:boss_123", itemsCaptor.getValue().get(0).getSourceFingerprint());
        assertFalse(itemsCaptor.getValue().get(0).isSelected());
        assertFalse(itemsCaptor.getValue().get(0).isImported());
    }

    @Test
    void createBatchFromPageSyncShouldMarkAlreadyImportedItems() {
        PageSyncJobDraftRequest job = new PageSyncJobDraftRequest(
            "boss_456",
            null,
            "前端开发",
            "测试科技",
            "杭州",
            "12-20K",
            12000,
            20000,
            "1-3年",
            "本科",
            "负责 React 开发",
            List.of("React"),
            List.of(),
            null,
            Map.of()
        );
        CreateDraftBatchFromPageSyncRequest req = new CreateDraftBatchFromPageSyncRequest(
            null,
            "BOSS",
            null,
            null,
            null,
            List.of(job)
        );

        when(fingerprintService.build("BOSS", job)).thenReturn("BOSS:external:boss_456");
        when(jobRepository.existsByUserIdAndSourceFingerprint(7L, "BOSS:external:boss_456")).thenReturn(true);
        when(batchRepository.save(any(JobDraftBatchEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(itemRepository.saveAll(any())).thenAnswer(invocation -> invocation.getArgument(0));

        JobDraftBatchCreatedDTO actual = jobDraftService.createBatchFromPageSync(req, 7L);

        assertTrue(actual.needResumeSelection());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<JobDraftItemEntity>> itemsCaptor = ArgumentCaptor.forClass(List.class);
        verify(itemRepository).saveAll(itemsCaptor.capture());
        assertTrue(itemsCaptor.getValue().get(0).isImported());
        assertFalse(itemsCaptor.getValue().get(0).isSelected());
    }
}
```

- [ ] **Step 8: 运行服务测试确认失败**

Run:

```bash
.\gradlew.bat :app:test --tests com.nbwf.modules.jobdraft.service.JobDraftServiceTest
```

Expected: FAIL because `JobDraftService` does not exist.

- [ ] **Step 9: 实现草稿服务基础能力**

Create `app/src/main/java/com/nbwf/modules/jobdraft/service/JobDraftService.java`:

```java
package com.nbwf.modules.jobdraft.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nbwf.common.exception.BusinessException;
import com.nbwf.common.exception.ErrorCode;
import com.nbwf.modules.job.repository.JobRepository;
import com.nbwf.modules.jobdraft.model.*;
import com.nbwf.modules.jobdraft.repository.JobDraftBatchRepository;
import com.nbwf.modules.jobdraft.repository.JobDraftItemRepository;
import com.nbwf.modules.resume.repository.ResumeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class JobDraftService {

    private final JobDraftBatchRepository batchRepository;
    private final JobDraftItemRepository itemRepository;
    private final ResumeRepository resumeRepository;
    private final JobRepository jobRepository;
    private final JobDraftFingerprintService fingerprintService;
    private final ObjectMapper objectMapper;

    @Transactional
    public JobDraftBatchCreatedDTO createBatchFromPageSync(CreateDraftBatchFromPageSyncRequest req, Long userId) {
        if (req.resumeId() != null) {
            resumeRepository.findByIdAndUserId(req.resumeId(), userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESUME_NOT_FOUND));
        }

        JobDraftBatchEntity batch = new JobDraftBatchEntity();
        batch.setBatchId(generateBatchId());
        batch.setUserId(userId);
        batch.setSourceType(JobDraftSourceType.PAGE_SYNC);
        batch.setResumeId(req.resumeId());
        batch.setSourcePlatform(req.sourcePlatform());
        batch.setSourcePageUrl(req.sourcePageUrl());
        batch.setSourcePageTitle(req.sourcePageTitle());
        batch.setTotalCount(req.jobs().size());
        batch.setSelectedCount(0);
        batch.setImportedCount(0);
        batch.setStatus(JobDraftBatchStatus.READY);
        batchRepository.save(batch);

        List<JobDraftItemEntity> items = req.jobs().stream()
            .map(job -> buildPageSyncItem(batch, job, userId, req.sourcePlatform()))
            .toList();
        itemRepository.saveAll(items);

        return new JobDraftBatchCreatedDTO(
            batch.getBatchId(),
            batch.getStatus(),
            batch.getTotalCount(),
            batch.getResumeId(),
            null,
            batch.getResumeId() == null
        );
    }

    @Transactional(readOnly = true)
    public JobDraftBatchDTO getBatch(String batchId, Long userId) {
        return toBatchDTO(findBatchOrThrow(batchId, userId));
    }

    @Transactional(readOnly = true)
    public List<JobDraftItemDTO> getItems(String batchId, Long userId) {
        findBatchOrThrow(batchId, userId);
        return itemRepository
            .findByBatchIdAndUserIdOrderByCoarseMatchScoreDescCreatedAtDesc(batchId, userId)
            .stream()
            .map(this::toItemDTO)
            .toList();
    }

    @Transactional(readOnly = true)
    public JobDraftBatchDTO getLatestBatch(Long userId) {
        return batchRepository.findFirstByUserIdOrderByUpdatedAtDesc(userId)
            .map(this::toBatchDTO)
            .orElse(null);
    }

    JobDraftBatchEntity findBatchOrThrow(String batchId, Long userId) {
        return batchRepository.findByBatchIdAndUserId(batchId, userId)
            .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "职位草稿批次不存在"));
    }

    private JobDraftItemEntity buildPageSyncItem(JobDraftBatchEntity batch,
                                                 PageSyncJobDraftRequest job,
                                                 Long userId,
                                                 String sourcePlatform) {
        String fingerprint = fingerprintService.build(sourcePlatform, job);

        JobDraftItemEntity item = new JobDraftItemEntity();
        item.setDraftItemId(generateDraftItemId());
        item.setBatchId(batch.getBatchId());
        item.setUserId(userId);
        item.setSourceType(JobDraftSourceType.PAGE_SYNC);
        item.setSourcePlatform(sourcePlatform);
        item.setExternalJobId(trimToNull(job.externalJobId()));
        item.setSourceUrl(trimToNull(job.sourceUrl()));
        item.setSourceFingerprint(fingerprint);
        item.setTitle(job.title().trim());
        item.setCompany(job.company().trim());
        item.setDescriptionPreview(trimToNull(job.descriptionPreview()));
        item.setDescriptionFull(null);
        item.setLocation(trimToNull(job.location()));
        item.setSalaryMin(job.salaryMin());
        item.setSalaryMax(job.salaryMax());
        item.setSalaryTextRaw(trimToNull(job.salaryTextRaw()));
        item.setExperienceTextRaw(trimToNull(job.experienceTextRaw()));
        item.setEducationTextRaw(trimToNull(job.educationTextRaw()));
        item.setTechTagsJson(toJson(job.techTags()));
        item.setBenefitsJson(toJson(job.benefits()));
        item.setRecruiterName(trimToNull(job.recruiterName()));
        item.setRawPayloadJson(toJson(job.rawPayload()));
        item.setSelected(false);
        item.setImported(jobRepository.existsByUserIdAndSourceFingerprint(userId, fingerprint));
        item.setDetailSyncStatus(JobDraftDetailSyncStatus.UNSYNCED);
        item.setCoarseMatchScore(calculateSimpleScore(job));
        item.setMatchSummary("根据当前页职位卡片生成的粗略排序，打开职位详情后可获得更准确分析。");
        return item;
    }

    private Integer calculateSimpleScore(PageSyncJobDraftRequest job) {
        int score = 50;
        if (job.techTags() != null && !job.techTags().isEmpty()) {
            score += Math.min(20, job.techTags().size() * 5);
        }
        if (trimToNull(job.descriptionPreview()) != null) {
            score += 10;
        }
        if (job.salaryMin() != null || job.salaryMax() != null) {
            score += 5;
        }
        return Math.min(score, 90);
    }

    private JobDraftBatchDTO toBatchDTO(JobDraftBatchEntity batch) {
        return new JobDraftBatchDTO(
            batch.getBatchId(),
            batch.getSourceType(),
            batch.getResumeId(),
            batch.getSourcePlatform(),
            batch.getSourcePageUrl(),
            batch.getSourcePageTitle(),
            batch.getTotalCount(),
            batch.getSelectedCount(),
            batch.getImportedCount(),
            batch.getStatus(),
            batch.getCreatedAt(),
            batch.getUpdatedAt(),
            batch.getExpiresAt()
        );
    }

    private JobDraftItemDTO toItemDTO(JobDraftItemEntity item) {
        return new JobDraftItemDTO(
            item.getDraftItemId(),
            item.getBatchId(),
            item.getSourceType(),
            item.getSourcePlatform(),
            item.getExternalJobId(),
            item.getSourceUrl(),
            item.getSourceFingerprint(),
            item.getTitle(),
            item.getCompany(),
            item.getDescriptionPreview(),
            item.getDescriptionFull(),
            item.getLocation(),
            item.getSalaryMin(),
            item.getSalaryMax(),
            item.getSalaryTextRaw(),
            item.getExperienceTextRaw(),
            item.getEducationTextRaw(),
            fromJsonList(item.getTechTagsJson()),
            fromJsonList(item.getBenefitsJson()),
            item.getRecruiterName(),
            item.isSelected(),
            item.isImported(),
            item.getImportedJobId(),
            item.getDetailSyncStatus(),
            item.getCoarseMatchScore(),
            item.getPreciseMatchScore(),
            item.getMatchSummary(),
            item.getOpenerText(),
            item.getCreatedAt(),
            item.getUpdatedAt()
        );
    }

    private String toJson(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "职位草稿 JSON 序列化失败");
        }
    }

    private List<String> fromJsonList(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(value, objectMapper.getTypeFactory().constructCollectionType(List.class, String.class));
        } catch (JsonProcessingException e) {
            return List.of();
        }
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String generateBatchId() {
        return "jdb_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }

    private String generateDraftItemId() {
        return "jdi_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }
}
```

- [ ] **Step 10: 运行 Task 2 测试**

Run:

```bash
.\gradlew.bat :app:test --tests com.nbwf.modules.jobdraft.service.JobDraftFingerprintServiceTest --tests com.nbwf.modules.jobdraft.service.JobDraftServiceTest
```

Expected: PASS.

- [ ] **Step 11: 提交批次创建能力**

Commit:

```bash
git add app/src/main/java/com/nbwf/modules/jobdraft app/src/test/java/com/nbwf/modules/jobdraft
git commit -m "feat: 新增职位草稿批次创建服务"
```

---

## Task 3: 后端选择状态与批量导入

**Files:**
- Create: `app/src/main/java/com/nbwf/modules/jobdraft/model/UpdateJobDraftSelectionRequest.java`
- Create: `app/src/main/java/com/nbwf/modules/jobdraft/model/ImportJobDraftItemsRequest.java`
- Create: `app/src/main/java/com/nbwf/modules/jobdraft/model/ImportJobDraftItemsResultDTO.java`
- Modify: `app/src/main/java/com/nbwf/modules/jobdraft/service/JobDraftService.java`
- Modify: `app/src/main/java/com/nbwf/modules/job/service/JobService.java`
- Test: `app/src/test/java/com/nbwf/modules/jobdraft/service/JobDraftImportServiceTest.java`

- [ ] **Step 1: 写导入服务测试**

Create `app/src/test/java/com/nbwf/modules/jobdraft/service/JobDraftImportServiceTest.java`:

```java
package com.nbwf.modules.jobdraft.service;

import com.nbwf.modules.job.model.JobEntity;
import com.nbwf.modules.job.repository.JobRepository;
import com.nbwf.modules.jobdraft.model.*;
import com.nbwf.modules.jobdraft.repository.JobDraftBatchRepository;
import com.nbwf.modules.jobdraft.repository.JobDraftItemRepository;
import com.nbwf.modules.resume.repository.ResumeRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JobDraftImportServiceTest {

    @Mock
    private JobDraftBatchRepository batchRepository;

    @Mock
    private JobDraftItemRepository itemRepository;

    @Mock
    private ResumeRepository resumeRepository;

    @Mock
    private JobRepository jobRepository;

    @Mock
    private JobDraftFingerprintService fingerprintService;

    @InjectMocks
    private JobDraftService jobDraftService;

    @Test
    void updateSelectionShouldOverwriteCurrentBatchSelection() {
        JobDraftBatchEntity batch = batch("jdb_1", 7L);
        JobDraftItemEntity first = item("jdi_1", "jdb_1", 7L, false, false);
        JobDraftItemEntity second = item("jdi_2", "jdb_1", 7L, true, false);

        when(batchRepository.findByBatchIdAndUserId("jdb_1", 7L)).thenReturn(Optional.of(batch));
        when(itemRepository.findByBatchIdAndUserIdOrderByCoarseMatchScoreDescCreatedAtDesc("jdb_1", 7L))
            .thenReturn(List.of(first, second));

        jobDraftService.updateSelection("jdb_1", new UpdateJobDraftSelectionRequest(List.of("jdi_1")), 7L);

        assertTrue(first.isSelected());
        assertFalse(second.isSelected());
        assertEquals(1, batch.getSelectedCount());
        verify(itemRepository).saveAll(List.of(first, second));
        verify(batchRepository).save(batch);
    }

    @Test
    void importSelectedItemsShouldCreateJobsAndSkipImportedItems() {
        JobDraftBatchEntity batch = batch("jdb_1", 7L);
        JobDraftItemEntity fresh = item("jdi_1", "jdb_1", 7L, true, false);
        fresh.setTitle("Java 后端开发");
        fresh.setCompany("测试科技");
        fresh.setDescriptionPreview("负责 Java 服务开发");
        fresh.setLocation("上海");
        fresh.setSalaryMin(15000);
        fresh.setSalaryMax(25000);
        fresh.setTechTagsJson("[\"Java\",\"Spring Boot\"]");
        fresh.setSourcePlatform("BOSS");
        fresh.setSourceUrl("https://www.zhipin.com/job_detail/abc.html");
        fresh.setExternalJobId("boss_123");
        fresh.setSourceFingerprint("BOSS:external:boss_123");
        JobDraftItemEntity imported = item("jdi_2", "jdb_1", 7L, true, true);

        JobEntity saved = new JobEntity();
        saved.setId(100L);

        when(batchRepository.findByBatchIdAndUserId("jdb_1", 7L)).thenReturn(Optional.of(batch));
        when(itemRepository.findByBatchIdAndUserIdAndDraftItemIdIn("jdb_1", 7L, List.of("jdi_1", "jdi_2")))
            .thenReturn(List.of(fresh, imported));
        when(jobRepository.existsByUserIdAndSourceFingerprint(7L, "BOSS:external:boss_123")).thenReturn(false);
        when(jobRepository.save(any(JobEntity.class))).thenReturn(saved);

        ImportJobDraftItemsResultDTO result = jobDraftService.importItems(
            "jdb_1",
            new ImportJobDraftItemsRequest(List.of("jdi_1", "jdi_2")),
            7L
        );

        assertEquals(1, result.importedCount());
        assertEquals(1, result.skippedCount());
        assertTrue(fresh.isImported());
        assertEquals(100L, fresh.getImportedJobId());
        assertEquals(JobDraftBatchStatus.PARTIAL_IMPORTED, batch.getStatus());

        ArgumentCaptor<JobEntity> jobCaptor = ArgumentCaptor.forClass(JobEntity.class);
        verify(jobRepository).save(jobCaptor.capture());
        assertEquals("Java 后端开发", jobCaptor.getValue().getTitle());
        assertEquals("BOSS:external:boss_123", jobCaptor.getValue().getSourceFingerprint());
    }

    private JobDraftBatchEntity batch(String batchId, Long userId) {
        JobDraftBatchEntity batch = new JobDraftBatchEntity();
        batch.setBatchId(batchId);
        batch.setUserId(userId);
        batch.setSourceType(JobDraftSourceType.PAGE_SYNC);
        batch.setTotalCount(2);
        batch.setStatus(JobDraftBatchStatus.READY);
        return batch;
    }

    private JobDraftItemEntity item(String draftItemId, String batchId, Long userId, boolean selected, boolean imported) {
        JobDraftItemEntity item = new JobDraftItemEntity();
        item.setDraftItemId(draftItemId);
        item.setBatchId(batchId);
        item.setUserId(userId);
        item.setSourceType(JobDraftSourceType.PAGE_SYNC);
        item.setTitle("测试职位");
        item.setCompany("测试公司");
        item.setDescriptionPreview("测试描述");
        item.setSourceFingerprint("fp_" + draftItemId);
        item.setSelected(selected);
        item.setImported(imported);
        item.setDetailSyncStatus(JobDraftDetailSyncStatus.UNSYNCED);
        return item;
    }
}
```

- [ ] **Step 2: 运行导入测试确认失败**

Run:

```bash
.\gradlew.bat :app:test --tests com.nbwf.modules.jobdraft.service.JobDraftImportServiceTest
```

Expected: FAIL because selection/import request models and service methods do not exist.

- [ ] **Step 3: 新建选择与导入 DTO**

Create `app/src/main/java/com/nbwf/modules/jobdraft/model/UpdateJobDraftSelectionRequest.java`:

```java
package com.nbwf.modules.jobdraft.model;

import java.util.List;

public record UpdateJobDraftSelectionRequest(
    List<String> selectedDraftItemIds
) {
}
```

Create `app/src/main/java/com/nbwf/modules/jobdraft/model/ImportJobDraftItemsRequest.java`:

```java
package com.nbwf.modules.jobdraft.model;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record ImportJobDraftItemsRequest(
    @NotEmpty List<String> draftItemIds
) {
}
```

Create `app/src/main/java/com/nbwf/modules/jobdraft/model/ImportJobDraftItemsResultDTO.java`:

```java
package com.nbwf.modules.jobdraft.model;

import java.util.List;

public record ImportJobDraftItemsResultDTO(
    String batchId,
    int importedCount,
    int skippedCount,
    List<Long> importedJobIds
) {
}
```

- [ ] **Step 4: 给 `JobDraftService` 增加选择状态方法**

Modify `app/src/main/java/com/nbwf/modules/jobdraft/service/JobDraftService.java`:

```java
@Transactional
public JobDraftBatchDTO updateSelection(String batchId, UpdateJobDraftSelectionRequest req, Long userId) {
    JobDraftBatchEntity batch = findBatchOrThrow(batchId, userId);
    List<String> selectedIds = req.selectedDraftItemIds() == null ? List.of() : req.selectedDraftItemIds();
    Set<String> selectedSet = new HashSet<>(selectedIds);

    List<JobDraftItemEntity> items =
        itemRepository.findByBatchIdAndUserIdOrderByCoarseMatchScoreDescCreatedAtDesc(batchId, userId);

    LocalDateTime now = LocalDateTime.now();
    int selectedCount = 0;
    for (JobDraftItemEntity item : items) {
        boolean selected = selectedSet.contains(item.getDraftItemId()) && !item.isImported();
        item.setSelected(selected);
        item.setSelectedAt(selected ? now : null);
        if (selected) {
            selectedCount++;
        }
    }

    batch.setSelectedCount(selectedCount);
    itemRepository.saveAll(items);
    batchRepository.save(batch);
    return toBatchDTO(batch);
}
```

Add imports:

```java
import java.util.HashSet;
import java.util.Set;
```

- [ ] **Step 5: 给 `JobDraftService` 增加导入方法**

Modify `app/src/main/java/com/nbwf/modules/jobdraft/service/JobDraftService.java`:

```java
@Transactional
public ImportJobDraftItemsResultDTO importItems(String batchId, ImportJobDraftItemsRequest req, Long userId) {
    JobDraftBatchEntity batch = findBatchOrThrow(batchId, userId);
    List<JobDraftItemEntity> items =
        itemRepository.findByBatchIdAndUserIdAndDraftItemIdIn(batchId, userId, req.draftItemIds());

    List<Long> importedJobIds = new ArrayList<>();
    int skippedCount = 0;

    for (JobDraftItemEntity item : items) {
        if (item.isImported() || jobRepository.existsByUserIdAndSourceFingerprint(userId, item.getSourceFingerprint())) {
            skippedCount++;
            item.setSelected(false);
            continue;
        }

        JobEntity job = buildJobFromDraft(item, userId);
        JobEntity savedJob = jobRepository.save(job);
        item.setImported(true);
        item.setImportedJobId(savedJob.getId());
        item.setSelected(false);
        importedJobIds.add(savedJob.getId());
    }

    batch.setImportedCount(batch.getImportedCount() + importedJobIds.size());
    batch.setSelectedCount(0);
    if (batch.getImportedCount() >= batch.getTotalCount()) {
        batch.setStatus(JobDraftBatchStatus.COMPLETED);
    } else if (batch.getImportedCount() > 0) {
        batch.setStatus(JobDraftBatchStatus.PARTIAL_IMPORTED);
    }

    itemRepository.saveAll(items);
    batchRepository.save(batch);

    return new ImportJobDraftItemsResultDTO(batchId, importedJobIds.size(), skippedCount, importedJobIds);
}

private JobEntity buildJobFromDraft(JobDraftItemEntity item, Long userId) {
    JobEntity job = new JobEntity();
    job.setUserId(userId);
    job.setTitle(item.getTitle());
    job.setCompany(item.getCompany());
    job.setDescription(resolveDescription(item));
    job.setLocation(item.getLocation());
    job.setSalaryMin(item.getSalaryMin());
    job.setSalaryMax(item.getSalaryMax());
    job.setTechTags(String.join(",", fromJsonList(item.getTechTagsJson())));
    job.setNotes("由职位草稿导入。来源：" + nullToUnknown(item.getSourcePlatform()));
    job.setSourcePlatform(item.getSourcePlatform());
    job.setSourceUrl(item.getSourceUrl());
    job.setExternalJobId(item.getExternalJobId());
    job.setSourceFingerprint(item.getSourceFingerprint());
    job.setDraftItemId(item.getDraftItemId());
    job.setJdCompleteness(item.getDetailSyncStatus().name());
    return job;
}

private String resolveDescription(JobDraftItemEntity item) {
    String full = trimToNull(item.getDescriptionFull());
    if (full != null) {
        return full;
    }
    String preview = trimToNull(item.getDescriptionPreview());
    if (preview != null) {
        return preview;
    }
    return "该职位来自外部同步，当前缺少完整 JD，请打开职位详情页补全。";
}

private String nullToUnknown(String value) {
    String trimmed = trimToNull(value);
    return trimmed == null ? "UNKNOWN" : trimmed;
}
```

Add import:

```java
import com.nbwf.modules.job.model.JobEntity;
import java.util.ArrayList;
```

- [ ] **Step 6: 运行导入测试确认通过**

Run:

```bash
.\gradlew.bat :app:test --tests com.nbwf.modules.jobdraft.service.JobDraftImportServiceTest
```

Expected: PASS.

- [ ] **Step 7: 提交选择与导入能力**

Commit:

```bash
git add app/src/main/java/com/nbwf/modules/jobdraft app/src/test/java/com/nbwf/modules/jobdraft
git commit -m "feat: 新增职位草稿多选导入能力"
```

---

## Task 4: 后端接口与简历生成统一承接

**Files:**
- Create: `app/src/main/java/com/nbwf/modules/jobdraft/JobDraftController.java`
- Modify: `app/src/main/java/com/nbwf/modules/jobdraft/service/JobDraftService.java`
- Modify: `app/src/main/java/com/nbwf/modules/job/JobController.java`
- Modify: `app/src/main/java/com/nbwf/modules/job/service/JobService.java`
- Test: `app/src/test/java/com/nbwf/modules/jobdraft/service/JobDraftResumeBatchServiceTest.java`

- [ ] **Step 1: 写简历生成批次服务测试**

Create `app/src/test/java/com/nbwf/modules/jobdraft/service/JobDraftResumeBatchServiceTest.java`:

```java
package com.nbwf.modules.jobdraft.service;

import com.nbwf.modules.job.model.ResumeJobDraftDTO;
import com.nbwf.modules.job.repository.JobRepository;
import com.nbwf.modules.job.service.ResumeJobDraftService;
import com.nbwf.modules.jobdraft.model.JobDraftBatchCreatedDTO;
import com.nbwf.modules.jobdraft.model.JobDraftItemEntity;
import com.nbwf.modules.jobdraft.model.JobDraftSourceType;
import com.nbwf.modules.jobdraft.repository.JobDraftBatchRepository;
import com.nbwf.modules.jobdraft.repository.JobDraftItemRepository;
import com.nbwf.modules.resume.model.ResumeEntity;
import com.nbwf.modules.resume.repository.ResumeRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JobDraftResumeBatchServiceTest {

    @Mock
    private JobDraftBatchRepository batchRepository;

    @Mock
    private JobDraftItemRepository itemRepository;

    @Mock
    private ResumeRepository resumeRepository;

    @Mock
    private JobRepository jobRepository;

    @Mock
    private JobDraftFingerprintService fingerprintService;

    @Mock
    private ResumeJobDraftService resumeJobDraftService;

    @InjectMocks
    private JobDraftService jobDraftService;

    @Test
    void createBatchFromResumeShouldGenerateDraftItems() {
        ResumeEntity resume = new ResumeEntity();
        resume.setId(21L);
        resume.setUserId(7L);
        resume.setResumeText("Java Spring Boot Redis");

        when(resumeRepository.findByIdAndUserId(21L, 7L)).thenReturn(Optional.of(resume));
        when(resumeJobDraftService.generateDrafts("Java Spring Boot Redis"))
            .thenReturn(List.of(new ResumeJobDraftDTO(
                "Java 后端开发",
                "偏业务系统开发",
                "技能匹配",
                List.of("Java", "Spring Boot"),
                "负责 Java 服务开发",
                "补充公司和薪资"
            )));
        when(batchRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(itemRepository.saveAll(any())).thenAnswer(invocation -> invocation.getArgument(0));

        JobDraftBatchCreatedDTO result = jobDraftService.createBatchFromResume(21L, 7L);

        assertEquals(1, result.totalCount());
        assertEquals(21L, result.resumeId());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<JobDraftItemEntity>> captor = ArgumentCaptor.forClass(List.class);
        verify(itemRepository).saveAll(captor.capture());
        assertEquals(JobDraftSourceType.RESUME_GENERATION, captor.getValue().get(0).getSourceType());
        assertEquals("Java 后端开发", captor.getValue().get(0).getTitle());
    }
}
```

- [ ] **Step 2: 运行简历批次测试确认失败**

Run:

```bash
.\gradlew.bat :app:test --tests com.nbwf.modules.jobdraft.service.JobDraftResumeBatchServiceTest
```

Expected: FAIL because `createBatchFromResume` and `ResumeJobDraftService` dependency are missing.

- [ ] **Step 3: 给 `JobDraftService` 注入简历草稿生成服务**

Modify `app/src/main/java/com/nbwf/modules/jobdraft/service/JobDraftService.java` constructor dependencies:

```java
private final ResumeJobDraftService resumeJobDraftService;
```

Add import:

```java
import com.nbwf.modules.job.model.ResumeJobDraftDTO;
import com.nbwf.modules.job.service.ResumeJobDraftService;
import com.nbwf.modules.resume.model.ResumeEntity;
```

- [ ] **Step 4: 实现简历生成批次方法**

Modify `app/src/main/java/com/nbwf/modules/jobdraft/service/JobDraftService.java`:

```java
@Transactional
public JobDraftBatchCreatedDTO createBatchFromResume(Long resumeId, Long userId) {
    ResumeEntity resume = resumeRepository.findByIdAndUserId(resumeId, userId)
        .orElseThrow(() -> new BusinessException(ErrorCode.RESUME_NOT_FOUND));

    if (resume.getResumeText() == null || resume.getResumeText().isBlank()) {
        throw new BusinessException(ErrorCode.RESUME_PARSE_FAILED, "当前简历内容为空，无法生成职位草稿");
    }

    List<ResumeJobDraftDTO> drafts = resumeJobDraftService.generateDrafts(resume.getResumeText());

    JobDraftBatchEntity batch = new JobDraftBatchEntity();
    batch.setBatchId(generateBatchId());
    batch.setUserId(userId);
    batch.setSourceType(JobDraftSourceType.RESUME_GENERATION);
    batch.setResumeId(resumeId);
    batch.setSourcePlatform("SYSTEM");
    batch.setTotalCount(drafts.size());
    batch.setSelectedCount(0);
    batch.setImportedCount(0);
    batch.setStatus(JobDraftBatchStatus.READY);
    batchRepository.save(batch);

    List<JobDraftItemEntity> items = drafts.stream()
        .map(draft -> buildResumeGeneratedItem(batch, draft, userId))
        .toList();
    itemRepository.saveAll(items);

    return new JobDraftBatchCreatedDTO(batch.getBatchId(), batch.getStatus(), batch.getTotalCount(), resumeId, null, false);
}

private JobDraftItemEntity buildResumeGeneratedItem(JobDraftBatchEntity batch, ResumeJobDraftDTO draft, Long userId) {
    JobDraftItemEntity item = new JobDraftItemEntity();
    item.setDraftItemId(generateDraftItemId());
    item.setBatchId(batch.getBatchId());
    item.setUserId(userId);
    item.setSourceType(JobDraftSourceType.RESUME_GENERATION);
    item.setSourcePlatform("SYSTEM");
    item.setSourceFingerprint("SYSTEM:resume:" + batch.getBatchId() + ":" + draft.title());
    item.setTitle(draft.title());
    item.setCompany("待补充");
    item.setDescriptionPreview(draft.defaultDescription());
    item.setDescriptionFull(draft.defaultDescription());
    item.setTechTagsJson(toJson(draft.techTags()));
    item.setBenefitsJson(toJson(List.of()));
    item.setSelected(false);
    item.setImported(false);
    item.setDetailSyncStatus(JobDraftDetailSyncStatus.PARTIAL);
    item.setCoarseMatchScore(80);
    item.setMatchSummary(draft.reason());
    item.setOpenerText(draft.defaultNotes());
    return item;
}
```

- [ ] **Step 5: 新建控制器**

Create `app/src/main/java/com/nbwf/modules/jobdraft/JobDraftController.java`:

```java
package com.nbwf.modules.jobdraft;

import com.nbwf.common.result.Result;
import com.nbwf.modules.jobdraft.model.*;
import com.nbwf.modules.jobdraft.service.JobDraftService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "职位草稿池", description = "统一承接简历生成草稿与外部同步职位草稿")
@RestController
@RequestMapping("/api/job-drafts")
@RequiredArgsConstructor
public class JobDraftController {

    private final JobDraftService jobDraftService;

    @Operation(summary = "根据简历生成职位草稿批次")
    @PostMapping("/batches/from-resume/{resumeId}")
    public Result<JobDraftBatchCreatedDTO> createFromResume(@PathVariable Long resumeId,
                                                            @AuthenticationPrincipal Long userId) {
        return Result.success(jobDraftService.createBatchFromResume(resumeId, userId));
    }

    @Operation(summary = "从浏览器扩展同步当前页职位草稿")
    @PostMapping("/batches/from-page-sync")
    public Result<JobDraftBatchCreatedDTO> createFromPageSync(@Valid @RequestBody CreateDraftBatchFromPageSyncRequest req,
                                                              @AuthenticationPrincipal Long userId) {
        return Result.success(jobDraftService.createBatchFromPageSync(req, userId));
    }

    @Operation(summary = "查询职位草稿批次")
    @GetMapping("/batches/{batchId}")
    public Result<JobDraftBatchDTO> getBatch(@PathVariable String batchId,
                                             @AuthenticationPrincipal Long userId) {
        return Result.success(jobDraftService.getBatch(batchId, userId));
    }

    @Operation(summary = "查询职位草稿批次条目")
    @GetMapping("/batches/{batchId}/items")
    public Result<List<JobDraftItemDTO>> getItems(@PathVariable String batchId,
                                                  @AuthenticationPrincipal Long userId) {
        return Result.success(jobDraftService.getItems(batchId, userId));
    }

    @Operation(summary = "查询最近职位草稿批次")
    @GetMapping("/batches/latest")
    public Result<JobDraftBatchDTO> getLatestBatch(@AuthenticationPrincipal Long userId) {
        return Result.success(jobDraftService.getLatestBatch(userId));
    }

    @Operation(summary = "覆盖职位草稿批次选择状态")
    @PutMapping("/batches/{batchId}/selection")
    public Result<JobDraftBatchDTO> updateSelection(@PathVariable String batchId,
                                                    @RequestBody UpdateJobDraftSelectionRequest req,
                                                    @AuthenticationPrincipal Long userId) {
        return Result.success(jobDraftService.updateSelection(batchId, req, userId));
    }

    @Operation(summary = "批量导入职位草稿到职位工作台")
    @PostMapping("/batches/{batchId}/import")
    public Result<ImportJobDraftItemsResultDTO> importItems(@PathVariable String batchId,
                                                            @Valid @RequestBody ImportJobDraftItemsRequest req,
                                                            @AuthenticationPrincipal Long userId) {
        return Result.success(jobDraftService.importItems(batchId, req, userId));
    }
}
```

- [ ] **Step 6: 在旧职位接口保留兼容能力**

Modify `app/src/main/java/com/nbwf/modules/job/JobController.java`:

```java
private final JobDraftService jobDraftService;

@Operation(summary = "根据简历生成职位草稿批次")
@PostMapping("/draft-batches/from-resume/{resumeId}")
public Result<JobDraftBatchCreatedDTO> createDraftBatchFromResume(@PathVariable Long resumeId,
                                                                  @AuthenticationPrincipal Long userId) {
    return Result.success(jobDraftService.createBatchFromResume(resumeId, userId));
}
```

Add imports:

```java
import com.nbwf.modules.jobdraft.model.JobDraftBatchCreatedDTO;
import com.nbwf.modules.jobdraft.service.JobDraftService;
```

- [ ] **Step 7: 运行后端草稿服务测试**

Run:

```bash
.\gradlew.bat :app:test --tests com.nbwf.modules.jobdraft.service.*
```

Expected: PASS.

- [ ] **Step 8: 提交后端接口**

Commit:

```bash
git add app/src/main/java/com/nbwf/modules/jobdraft app/src/main/java/com/nbwf/modules/job/JobController.java app/src/test/java/com/nbwf/modules/jobdraft
git commit -m "feat: 新增职位草稿池接口"
```

---

## Task 5: 前端 API 与类型

**Files:**
- Create: `frontend/src/types/job-draft.ts`
- Create: `frontend/src/api/jobDrafts.ts`
- Modify: `frontend/src/api/index.ts`
- Modify: `frontend/src/api/jobs.ts`
- Modify: `frontend/src/types/job.ts`

- [ ] **Step 1: 新建前端草稿类型**

Create `frontend/src/types/job-draft.ts`:

```ts
export type JobDraftBatchStatus =
  | 'CREATED'
  | 'ANALYZING'
  | 'READY'
  | 'PARTIAL_IMPORTED'
  | 'COMPLETED'
  | 'FAILED';

export type JobDraftSourceType = 'RESUME_GENERATION' | 'PAGE_SYNC';

export type JobDraftDetailSyncStatus = 'UNSYNCED' | 'PARTIAL' | 'COMPLETED' | 'FAILED';

export interface JobDraftBatch {
  batchId: string;
  sourceType: JobDraftSourceType;
  resumeId: number | null;
  sourcePlatform: string | null;
  sourcePageUrl: string | null;
  sourcePageTitle: string | null;
  totalCount: number;
  selectedCount: number;
  importedCount: number;
  status: JobDraftBatchStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
}

export interface JobDraftItem {
  draftItemId: string;
  batchId: string;
  sourceType: JobDraftSourceType;
  sourcePlatform: string | null;
  externalJobId: string | null;
  sourceUrl: string | null;
  sourceFingerprint: string;
  title: string;
  company: string;
  descriptionPreview: string | null;
  descriptionFull: string | null;
  location: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryTextRaw: string | null;
  experienceTextRaw: string | null;
  educationTextRaw: string | null;
  techTags: string[];
  benefits: string[];
  recruiterName: string | null;
  selected: boolean;
  imported: boolean;
  importedJobId: number | null;
  detailSyncStatus: JobDraftDetailSyncStatus;
  coarseMatchScore: number | null;
  preciseMatchScore: number | null;
  matchSummary: string | null;
  openerText: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobDraftBatchCreated {
  batchId: string;
  status: JobDraftBatchStatus;
  totalCount: number;
  resumeId: number | null;
  taskId: string | null;
  needResumeSelection: boolean;
}

export interface PageSyncJobDraft {
  externalJobId?: string;
  sourceUrl?: string;
  title: string;
  company: string;
  location?: string;
  salaryTextRaw?: string;
  salaryMin?: number;
  salaryMax?: number;
  experienceTextRaw?: string;
  educationTextRaw?: string;
  descriptionPreview?: string;
  techTags?: string[];
  benefits?: string[];
  recruiterName?: string;
  rawPayload?: Record<string, unknown>;
}

export interface CreateDraftBatchFromPageSyncForm {
  resumeId?: number;
  sourcePlatform: string;
  sourcePageUrl?: string;
  sourcePageTitle?: string;
  pageFingerprint?: string;
  jobs: PageSyncJobDraft[];
}

export interface ImportJobDraftItemsResult {
  batchId: string;
  importedCount: number;
  skippedCount: number;
  importedJobIds: number[];
}
```

- [ ] **Step 2: 新建前端 API**

Create `frontend/src/api/jobDrafts.ts`:

```ts
import { request } from './request';
import type {
  CreateDraftBatchFromPageSyncForm,
  ImportJobDraftItemsResult,
  JobDraftBatch,
  JobDraftBatchCreated,
  JobDraftItem,
} from '../types/job-draft';

export const jobDraftApi = {
  async createBatchFromResume(resumeId: number): Promise<JobDraftBatchCreated> {
    return request.post<JobDraftBatchCreated>(`/api/job-drafts/batches/from-resume/${resumeId}`);
  },

  async createBatchFromPageSync(data: CreateDraftBatchFromPageSyncForm): Promise<JobDraftBatchCreated> {
    return request.post<JobDraftBatchCreated>('/api/job-drafts/batches/from-page-sync', data);
  },

  async getBatch(batchId: string): Promise<JobDraftBatch> {
    return request.get<JobDraftBatch>(`/api/job-drafts/batches/${batchId}`);
  },

  async getItems(batchId: string): Promise<JobDraftItem[]> {
    return request.get<JobDraftItem[]>(`/api/job-drafts/batches/${batchId}/items`);
  },

  async getLatestBatch(): Promise<JobDraftBatch | null> {
    return request.get<JobDraftBatch | null>('/api/job-drafts/batches/latest');
  },

  async updateSelection(batchId: string, selectedDraftItemIds: string[]): Promise<JobDraftBatch> {
    return request.put<JobDraftBatch>(`/api/job-drafts/batches/${batchId}/selection`, {
      selectedDraftItemIds,
    });
  },

  async importItems(batchId: string, draftItemIds: string[]): Promise<ImportJobDraftItemsResult> {
    return request.post<ImportJobDraftItemsResult>(`/api/job-drafts/batches/${batchId}/import`, {
      draftItemIds,
    });
  },
};
```

- [ ] **Step 3: 导出 API**

Modify `frontend/src/api/index.ts`:

```ts
export { jobDraftApi } from './jobDrafts';
```

Keep existing exports unchanged.

- [ ] **Step 4: 给旧 jobApi 增加兼容入口**

Modify `frontend/src/api/jobs.ts`:

```ts
import type { JobDraftBatchCreated } from '../types/job-draft';
```

Add method:

```ts
async createDraftBatchFromResume(resumeId: number): Promise<JobDraftBatchCreated> {
  return request.post<JobDraftBatchCreated>(`/api/jobs/draft-batches/from-resume/${resumeId}`);
},
```

- [ ] **Step 5: 前端构建检查**

Run:

```bash
cd frontend
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 6: 提交前端 API 类型**

Commit:

```bash
git add frontend/src/types/job-draft.ts frontend/src/api/jobDrafts.ts frontend/src/api/index.ts frontend/src/api/jobs.ts
git commit -m "feat: 新增职位草稿前端接口类型"
```

---

## Task 6: 前端职位草稿页面

**Files:**
- Create: `frontend/src/pages/JobDraftPage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Layout.tsx`
- Modify: `frontend/src/pages/JobManagePage.tsx`

- [ ] **Step 1: 新建草稿页面**

Create `frontend/src/pages/JobDraftPage.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, BriefcaseBusiness, CheckCircle2, Loader2, RefreshCw, Save, Search } from 'lucide-react';
import { jobDraftApi } from '../api';
import { getErrorMessage } from '../api/request';
import type { JobDraftBatch, JobDraftItem } from '../types/job-draft';
import { formatDateTime } from '../utils/date';

function formatSalary(item: JobDraftItem) {
  if (item.salaryTextRaw) {
    return item.salaryTextRaw;
  }
  if (item.salaryMin !== null && item.salaryMax !== null) {
    return `${item.salaryMin.toLocaleString()} - ${item.salaryMax.toLocaleString()}`;
  }
  if (item.salaryMin !== null) {
    return `${item.salaryMin.toLocaleString()} 起`;
  }
  if (item.salaryMax !== null) {
    return `最高 ${item.salaryMax.toLocaleString()}`;
  }
  return '薪资未填写';
}

function batchStatusLabel(status: JobDraftBatch['status']) {
  const labels: Record<JobDraftBatch['status'], string> = {
    CREATED: '已创建',
    ANALYZING: '分析中',
    READY: '可处理',
    PARTIAL_IMPORTED: '部分已导入',
    COMPLETED: '已完成',
    FAILED: '失败',
  };
  return labels[status];
}

function syncStatusLabel(status: JobDraftItem['detailSyncStatus']) {
  const labels: Record<JobDraftItem['detailSyncStatus'], string> = {
    UNSYNCED: '待补全',
    PARTIAL: '部分补全',
    COMPLETED: 'JD 已完整',
    FAILED: '补全失败',
  };
  return labels[status];
}

export default function JobDraftPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const batchId = searchParams.get('batchId');
  const [batch, setBatch] = useState<JobDraftBatch | null>(null);
  const [items, setItems] = useState<JobDraftItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingSelection, setSavingSelection] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadBatch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const targetBatchId = batchId;
      if (targetBatchId) {
        const [batchData, itemData] = await Promise.all([
          jobDraftApi.getBatch(targetBatchId),
          jobDraftApi.getItems(targetBatchId),
        ]);
        setBatch(batchData);
        setItems(itemData);
        setSelectedIds(new Set(itemData.filter((item) => item.selected && !item.imported).map((item) => item.draftItemId)));
        return;
      }

      const latest = await jobDraftApi.getLatestBatch();
      if (latest) {
        setSearchParams({ batchId: latest.batchId }, { replace: true });
      } else {
        setBatch(null);
        setItems([]);
        setSelectedIds(new Set());
      }
    } catch (err) {
      setError(getErrorMessage(err));
      setBatch(null);
      setItems([]);
      setSelectedIds(new Set());
    } finally {
      setLoading(false);
    }
  }, [batchId, setSearchParams]);

  useEffect(() => {
    void loadBatch();
  }, [loadBatch]);

  const filteredItems = useMemo(() => {
    const normalized = keyword.trim().toLowerCase();
    if (!normalized) {
      return items;
    }
    return items.filter((item) =>
      [item.title, item.company, item.location ?? '', item.salaryTextRaw ?? '', ...item.techTags]
        .join(' ')
        .toLowerCase()
        .includes(normalized),
    );
  }, [items, keyword]);

  const selectableItems = useMemo(() => items.filter((item) => !item.imported), [items]);

  const toggleItem = (item: JobDraftItem) => {
    if (item.imported) {
      return;
    }
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(item.draftItemId)) {
        next.delete(item.draftItemId);
      } else {
        next.add(item.draftItemId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds((current) => {
      if (current.size === selectableItems.length) {
        return new Set();
      }
      return new Set(selectableItems.map((item) => item.draftItemId));
    });
  };

  const saveSelection = async () => {
    if (!batch) {
      return;
    }
    setSavingSelection(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await jobDraftApi.updateSelection(batch.batchId, Array.from(selectedIds));
      setBatch(updated);
      setItems((current) =>
        current.map((item) => ({
          ...item,
          selected: selectedIds.has(item.draftItemId) && !item.imported,
        })),
      );
      setMessage('已保存本批次选择状态');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingSelection(false);
    }
  };

  const importSelected = async () => {
    if (!batch || selectedIds.size === 0) {
      return;
    }
    setImporting(true);
    setError(null);
    setMessage(null);
    try {
      const result = await jobDraftApi.importItems(batch.batchId, Array.from(selectedIds));
      setMessage(`已导入 ${result.importedCount} 个职位，跳过 ${result.skippedCount} 个重复或已导入职位`);
      await loadBatch();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-slate-800 dark:text-white">
            <BriefcaseBusiness className="h-7 w-7 text-primary-500" />
            职位草稿
          </h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            统一处理简历生成草稿和外部同步职位，多选后保存到职位工作台。
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void loadBatch()}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <RefreshCw className="h-4 w-4" />
            刷新
          </button>
          <button
            type="button"
            onClick={() => navigate('/jobs')}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
          >
            去职位工作台
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/70 dark:bg-red-900/30 dark:text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {message && (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/70 dark:bg-emerald-900/30 dark:text-emerald-200">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {!batch && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <BriefcaseBusiness className="mx-auto mb-4 h-10 w-10 text-slate-300 dark:text-slate-600" />
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">暂无职位草稿批次</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            可以先在简历详情页生成职位草稿，或之后通过浏览器扩展同步 BOSS 当前页职位。
          </p>
        </div>
      )}

      {batch && (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <SummaryCard label="批次状态" value={batchStatusLabel(batch.status)} />
            <SummaryCard label="草稿总数" value={String(batch.totalCount)} />
            <SummaryCard label="已选择" value={String(selectedIds.size)} />
            <SummaryCard label="已导入" value={String(batch.importedCount)} />
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                  {batch.sourceType === 'PAGE_SYNC' ? '外部页面同步' : '简历生成草稿'}
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  批次 {batch.batchId} · 更新时间 {formatDateTime(batch.updatedAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={toggleAll}
                  disabled={selectableItems.length === 0}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  {selectedIds.size === selectableItems.length && selectableItems.length > 0 ? '取消全选' : '全选未导入'}
                </button>
                <button
                  type="button"
                  onClick={saveSelection}
                  disabled={savingSelection}
                  className="rounded-xl border border-primary-200 px-3 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50 disabled:opacity-50 dark:border-primary-800 dark:text-primary-300 dark:hover:bg-primary-900/30"
                >
                  {savingSelection ? '保存中...' : '保存选择'}
                </button>
                <button
                  type="button"
                  onClick={importSelected}
                  disabled={importing || selectedIds.size === 0}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {importing ? '导入中...' : '导入职位工作台'}
                </button>
              </div>
            </div>

            <div className="relative mb-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜索职位、公司、地点或技术标签"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-700 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-3">
              {filteredItems.map((item) => (
                <button
                  key={item.draftItemId}
                  type="button"
                  onClick={() => toggleItem(item)}
                  disabled={item.imported}
                  className={`w-full rounded-2xl border p-4 text-left transition-all ${
                    selectedIds.has(item.draftItemId)
                      ? 'border-primary-400 bg-primary-50/60 dark:border-primary-500 dark:bg-primary-900/20'
                      : 'border-slate-200 bg-white hover:border-primary-300 dark:border-slate-700 dark:bg-slate-900/40'
                  } ${item.imported ? 'cursor-not-allowed opacity-70' : ''}`}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-semibold text-slate-800 dark:text-slate-100">{item.title}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                          {item.company}
                        </span>
                        {item.imported && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                            已导入
                          </span>
                        )}
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-200">
                          {syncStatusLabel(item.detailSyncStatus)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        {[item.location, formatSalary(item), item.experienceTextRaw, item.educationTextRaw].filter(Boolean).join(' · ')}
                      </p>
                      {item.matchSummary && (
                        <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {item.matchSummary}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.techTags.map((tag) => (
                          <span key={`${item.draftItemId}-${tag}`} className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-600 dark:bg-primary-900/30 dark:text-primary-300">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary-500">
                        {item.preciseMatchScore ?? item.coarseMatchScore ?? '--'}
                      </div>
                      <div className="text-xs text-slate-400">匹配分</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
    </div>
  );
}
```

- [ ] **Step 2: 注册路由**

Modify `frontend/src/App.tsx`:

```tsx
const JobDraftPage = lazy(() => import('./pages/JobDraftPage'));
```

Add route:

```tsx
<Route path="jobs/drafts" element={<JobDraftPage />} />
```

- [ ] **Step 3: 增加导航入口**

Modify `frontend/src/components/Layout.tsx` navigation list:

```tsx
{ id: 'job-drafts', path: '/jobs/drafts', label: '职位草稿', icon: ClipboardList, description: '批量确认职位' },
```

Add import:

```tsx
import { ClipboardList } from 'lucide-react';
```

- [ ] **Step 4: 职位工作台增加跳转按钮**

Modify `frontend/src/pages/JobManagePage.tsx` imports:

```tsx
import { FileStack } from 'lucide-react';
```

Add button near “新增职位”:

```tsx
<button
  type="button"
  onClick={() => navigate('/jobs/drafts')}
  className="flex items-center gap-2 rounded-xl border border-primary-200 bg-primary-50 px-4 py-2.5 text-sm font-medium text-primary-600 transition-colors hover:bg-primary-100 dark:border-primary-800 dark:bg-primary-900/20 dark:text-primary-300"
>
  <FileStack className="h-4 w-4" />
  查看职位草稿
</button>
```

- [ ] **Step 5: 前端构建检查**

Run:

```bash
cd frontend
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 6: 提交草稿页面**

Commit:

```bash
git add frontend/src/pages/JobDraftPage.tsx frontend/src/App.tsx frontend/src/components/Layout.tsx frontend/src/pages/JobManagePage.tsx
git commit -m "feat: 新增职位草稿选择页面"
```

---

## Task 7: 简历生成草稿跳转统一草稿池

**Files:**
- Modify: `frontend/src/pages/ResumeDetailPage.tsx`
- Modify: `frontend/src/components/ResumeJobDraftDialog.tsx`

- [ ] **Step 1: 定位旧草稿弹窗调用**

Run:

```bash
rg "ResumeJobDraftDialog|generateDraftsFromResume|createDraftTaskFromResume|draft" frontend/src/pages/ResumeDetailPage.tsx -n
```

Expected: Output shows the existing resume job draft generation flow.

- [ ] **Step 2: 改为创建草稿批次后跳转**

Modify `frontend/src/pages/ResumeDetailPage.tsx`:

```tsx
const handleGenerateJobDrafts = async () => {
  if (!resumeId) {
    return;
  }

  setJobDraftLoading(true);
  setJobDraftError(null);

  try {
    const created = await jobDraftApi.createBatchFromResume(Number(resumeId));
    navigate(`/jobs/drafts?batchId=${created.batchId}`);
  } catch (error) {
    setJobDraftError(getErrorMessage(error));
  } finally {
    setJobDraftLoading(false);
  }
};
```

Add imports:

```tsx
import { jobDraftApi } from '../api';
```

Keep `ResumeJobDraftDialog` only if the page still uses old synchronous drafts as fallback. If no code path opens it after this change, remove the import and related state variables in the same commit.

- [ ] **Step 3: 前端构建检查**

Run:

```bash
cd frontend
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 4: 提交简历草稿统一入口**

Commit:

```bash
git add frontend/src/pages/ResumeDetailPage.tsx frontend/src/components/ResumeJobDraftDialog.tsx
git commit -m "feat: 统一简历生成职位草稿入口"
```

---

## Task 8: 开发进度文档与整体验证

**Files:**
- Create or Modify: `docs/DEVELOPMENT_PROGRESS.md`

- [ ] **Step 1: 更新开发进度文档**

Create or modify `docs/DEVELOPMENT_PROGRESS.md`:

```markdown
# 开发进度

| 日期 | 模块 | 状态 | 说明 |
|---|---|---|---|
| 2026-04-20 | 用户登录注册与隔离 | 已完成 | 已完成基础登录注册和用户数据隔离 |
| 2026-04-20 | 职位工作台 | 已完成 | 已支持职位保存、编辑、删除、匹配分析与定向面试 |
| 2026-04-20 | AI 长任务恢复 | 进行中 | 已有 AI 任务模型，职位草稿池会继续复用后台任务思路 |
| 2026-04-20 | 统一职位草稿池 P0 | 进行中 | 新增草稿批次、草稿项、多选保存、当前页同步承接接口和草稿页面 |

## 当前重点

| 优先级 | 模块 | 下一步 |
|---|---|---|
| P0 | 统一职位草稿池 | 完成后端接口、前端草稿页面、简历生成草稿统一入口 |
| P1 | JD 自动补全 | 扩展详情页补全、精匹配、开场话术 |
| P1 | 任务中心 | 统一面试题生成、职位草稿生成、JD 补全的后台任务展示 |

## 提交规范

提交和推送统一使用 `英文类型: 中文说明` 的格式，例如：

| 示例 | 用途 |
|---|---|
| `feat: 新增职位草稿池接口` | 新功能 |
| `fix: 修复职位草稿重复导入问题` | 修复 |
| `docs: 更新开发进度文档` | 文档 |
| `test: 增加职位草稿导入测试` | 测试 |
```

- [ ] **Step 2: 后端草稿模块测试**

Run:

```bash
.\gradlew.bat :app:test --tests com.nbwf.modules.jobdraft.service.*
```

Expected: PASS.

- [ ] **Step 3: 后端相关回归测试**

Run:

```bash
.\gradlew.bat :app:test --tests com.nbwf.modules.job.service.JobServiceDraftsTest --tests com.nbwf.modules.aigeneration.service.AiGenerationTaskServiceTest
```

Expected: PASS.

- [ ] **Step 4: 前端构建**

Run:

```bash
cd frontend
npm.cmd run build
```

Expected: PASS.

- [ ] **Step 5: 全量构建测试**

Run:

```bash
npm.cmd run build
```

Expected: PASS if root package build script exists and is configured; if the root has no package script, use Task 8 Step 2 to Step 4 as最终验证。

- [ ] **Step 6: 最终提交**

Commit:

```bash
git add docs/DEVELOPMENT_PROGRESS.md
git commit -m "docs: 更新职位草稿池开发进度"
```

- [ ] **Step 7: 推送 master**

Run:

```bash
git push origin master
```

Expected: Push succeeds.

---

## 自检清单

| 检查项 | 结果 |
|---|---|
| 设计文档 P0 范围覆盖 | 已覆盖草稿批次、草稿项、同步承接、多选导入、前端草稿页面、最近批次恢复 |
| 非 P0 范围隔离 | 浏览器扩展本体、JD 自动补全、精匹配实时刷新、SSE/WebSocket 已从本计划拆出 |
| 提交规范 | 已统一为 `英文类型: 中文说明` |
| 测试入口 | 每个后端任务都有对应 JUnit/Mockito 测试命令 |
| 构建入口 | 前端使用 `cd frontend && npm.cmd run build`，整体验证优先使用已配置脚本 |
