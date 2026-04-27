package com.nbwf.modules.job.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "job_application_workflows", indexes = {
    @Index(name = "idx_job_workflow_user_id", columnList = "user_id"),
    @Index(name = "idx_job_workflow_job_id", columnList = "job_id", unique = true),
    @Index(name = "idx_job_workflow_status", columnList = "status")
})
public class JobApplicationWorkflowEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "job_id", nullable = false)
    private Long jobId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private JobApplicationWorkflowStatus status = JobApplicationWorkflowStatus.RUNNING;

    @Enumerated(EnumType.STRING)
    @Column(name = "current_node", nullable = false, length = 60)
    private JobApplicationWorkflowNode currentNode = JobApplicationWorkflowNode.JOB_IMPORTED;

    @Column(name = "next_action", length = 300)
    private String nextAction;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

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

    public Long getJobId() { return jobId; }
    public void setJobId(Long jobId) { this.jobId = jobId; }

    public JobApplicationWorkflowStatus getStatus() { return status; }
    public void setStatus(JobApplicationWorkflowStatus status) { this.status = status; }

    public JobApplicationWorkflowNode getCurrentNode() { return currentNode; }
    public void setCurrentNode(JobApplicationWorkflowNode currentNode) { this.currentNode = currentNode; }

    public String getNextAction() { return nextAction; }
    public void setNextAction(String nextAction) { this.nextAction = nextAction; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }

    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }
}
