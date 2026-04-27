package com.nbwf.modules.job.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "job_structured_analyses", indexes = {
    @Index(name = "idx_job_structured_analysis_job_user", columnList = "job_id,user_id"),
    @Index(name = "idx_job_structured_analysis_updated_at", columnList = "updated_at")
})
public class JobStructuredAnalysisEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "job_id", nullable = false)
    private Long jobId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "job_direction", length = 120)
    private String jobDirection;

    @Column(name = "required_skills", columnDefinition = "TEXT")
    private String requiredSkills;

    @Column(name = "preferred_skills", columnDefinition = "TEXT")
    private String preferredSkills;

    @Column(columnDefinition = "TEXT")
    private String responsibilities;

    @Column(name = "candidate_requirements", columnDefinition = "TEXT")
    private String candidateRequirements;

    @Column(name = "risk_points", columnDefinition = "TEXT")
    private String riskPoints;

    @Column(name = "opener_focus", columnDefinition = "TEXT")
    private String openerFocus;

    @Column(columnDefinition = "TEXT")
    private String summary;

    @Column(name = "raw_result", columnDefinition = "TEXT")
    private String rawResult;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
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

    public Long getJobId() { return jobId; }
    public void setJobId(Long jobId) { this.jobId = jobId; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getJobDirection() { return jobDirection; }
    public void setJobDirection(String jobDirection) { this.jobDirection = jobDirection; }

    public String getRequiredSkills() { return requiredSkills; }
    public void setRequiredSkills(String requiredSkills) { this.requiredSkills = requiredSkills; }

    public String getPreferredSkills() { return preferredSkills; }
    public void setPreferredSkills(String preferredSkills) { this.preferredSkills = preferredSkills; }

    public String getResponsibilities() { return responsibilities; }
    public void setResponsibilities(String responsibilities) { this.responsibilities = responsibilities; }

    public String getCandidateRequirements() { return candidateRequirements; }
    public void setCandidateRequirements(String candidateRequirements) { this.candidateRequirements = candidateRequirements; }

    public String getRiskPoints() { return riskPoints; }
    public void setRiskPoints(String riskPoints) { this.riskPoints = riskPoints; }

    public String getOpenerFocus() { return openerFocus; }
    public void setOpenerFocus(String openerFocus) { this.openerFocus = openerFocus; }

    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }

    public String getRawResult() { return rawResult; }
    public void setRawResult(String rawResult) { this.rawResult = rawResult; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
