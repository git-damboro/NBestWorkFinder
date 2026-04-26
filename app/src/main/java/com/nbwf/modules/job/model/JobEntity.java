package com.nbwf.modules.job.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "jobs", indexes = {
    @Index(name = "idx_job_user_id", columnList = "user_id"),
    @Index(name = "idx_job_application_status", columnList = "application_status"),
    @Index(name = "idx_job_source_fingerprint", columnList = "source_fingerprint")
})
public class JobEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(nullable = false, length = 200)
    private String company;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;

    @Column(length = 100)
    private String location;

    private Integer salaryMin;

    private Integer salaryMax;

    @Column(columnDefinition = "TEXT")
    private String techTags;

    @Enumerated(EnumType.STRING)
    @Column(name = "application_status", nullable = false, length = 20)
    private JobApplicationStatus applicationStatus = JobApplicationStatus.SAVED;

    @Column(columnDefinition = "TEXT")
    private String notes;

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

    @Column(name = "applied_at")
    private LocalDateTime appliedAt;

    @Column(name = "last_follow_up_at")
    private LocalDateTime lastFollowUpAt;

    @Column(name = "next_follow_up_at")
    private LocalDateTime nextFollowUpAt;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getCompany() { return company; }
    public void setCompany(String company) { this.company = company; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getLocation() { return location; }
    public void setLocation(String location) { this.location = location; }

    public Integer getSalaryMin() { return salaryMin; }
    public void setSalaryMin(Integer salaryMin) { this.salaryMin = salaryMin; }

    public Integer getSalaryMax() { return salaryMax; }
    public void setSalaryMax(Integer salaryMax) { this.salaryMax = salaryMax; }

    public String getTechTags() { return techTags; }
    public void setTechTags(String techTags) { this.techTags = techTags; }

    public JobApplicationStatus getApplicationStatus() { return applicationStatus; }
    public void setApplicationStatus(JobApplicationStatus applicationStatus) { this.applicationStatus = applicationStatus; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public String getSourcePlatform() { return sourcePlatform; }
    public void setSourcePlatform(String sourcePlatform) { this.sourcePlatform = sourcePlatform; }

    public String getSourceUrl() { return sourceUrl; }
    public void setSourceUrl(String sourceUrl) { this.sourceUrl = sourceUrl; }

    public String getExternalJobId() { return externalJobId; }
    public void setExternalJobId(String externalJobId) { this.externalJobId = externalJobId; }

    public String getSourceFingerprint() { return sourceFingerprint; }
    public void setSourceFingerprint(String sourceFingerprint) { this.sourceFingerprint = sourceFingerprint; }

    public String getDraftItemId() { return draftItemId; }
    public void setDraftItemId(String draftItemId) { this.draftItemId = draftItemId; }

    public String getJdCompleteness() { return jdCompleteness; }
    public void setJdCompleteness(String jdCompleteness) { this.jdCompleteness = jdCompleteness; }

    public LocalDateTime getAppliedAt() { return appliedAt; }
    public void setAppliedAt(LocalDateTime appliedAt) { this.appliedAt = appliedAt; }

    public LocalDateTime getLastFollowUpAt() { return lastFollowUpAt; }
    public void setLastFollowUpAt(LocalDateTime lastFollowUpAt) { this.lastFollowUpAt = lastFollowUpAt; }

    public LocalDateTime getNextFollowUpAt() { return nextFollowUpAt; }
    public void setNextFollowUpAt(LocalDateTime nextFollowUpAt) { this.nextFollowUpAt = nextFollowUpAt; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
