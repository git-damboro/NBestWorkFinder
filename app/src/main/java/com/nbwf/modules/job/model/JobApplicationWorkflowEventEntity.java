package com.nbwf.modules.job.model;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "job_application_workflow_events", indexes = {
    @Index(name = "idx_job_workflow_event_workflow_id", columnList = "workflow_id"),
    @Index(name = "idx_job_workflow_event_job_id", columnList = "job_id"),
    @Index(name = "idx_job_workflow_event_user_id", columnList = "user_id"),
    @Index(name = "idx_job_workflow_event_created_at", columnList = "created_at")
})
public class JobApplicationWorkflowEventEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "workflow_id", nullable = false)
    private Long workflowId;

    @Column(name = "job_id", nullable = false)
    private Long jobId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "node_key", nullable = false, length = 60)
    private JobApplicationWorkflowNode nodeKey;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, length = 60)
    private JobApplicationWorkflowEventType eventType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private JobApplicationWorkflowStatus status;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String content;

    @Column(name = "input_snapshot", columnDefinition = "TEXT")
    private String inputSnapshot;

    @Column(name = "output_snapshot", columnDefinition = "TEXT")
    private String outputSnapshot;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "requires_human_action", nullable = false)
    private boolean requiresHumanAction;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getWorkflowId() { return workflowId; }
    public void setWorkflowId(Long workflowId) { this.workflowId = workflowId; }

    public Long getJobId() { return jobId; }
    public void setJobId(Long jobId) { this.jobId = jobId; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public JobApplicationWorkflowNode getNodeKey() { return nodeKey; }
    public void setNodeKey(JobApplicationWorkflowNode nodeKey) { this.nodeKey = nodeKey; }

    public JobApplicationWorkflowEventType getEventType() { return eventType; }
    public void setEventType(JobApplicationWorkflowEventType eventType) { this.eventType = eventType; }

    public JobApplicationWorkflowStatus getStatus() { return status; }
    public void setStatus(JobApplicationWorkflowStatus status) { this.status = status; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public String getInputSnapshot() { return inputSnapshot; }
    public void setInputSnapshot(String inputSnapshot) { this.inputSnapshot = inputSnapshot; }

    public String getOutputSnapshot() { return outputSnapshot; }
    public void setOutputSnapshot(String outputSnapshot) { this.outputSnapshot = outputSnapshot; }

    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }

    public boolean isRequiresHumanAction() { return requiresHumanAction; }
    public void setRequiresHumanAction(boolean requiresHumanAction) { this.requiresHumanAction = requiresHumanAction; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
