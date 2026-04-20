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

