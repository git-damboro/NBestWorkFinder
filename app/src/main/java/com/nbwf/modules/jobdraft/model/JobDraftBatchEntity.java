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

