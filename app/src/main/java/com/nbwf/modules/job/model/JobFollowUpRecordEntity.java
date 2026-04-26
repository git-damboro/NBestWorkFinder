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
