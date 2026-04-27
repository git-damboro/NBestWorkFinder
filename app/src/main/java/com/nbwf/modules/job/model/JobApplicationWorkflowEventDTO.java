package com.nbwf.modules.job.model;

import java.time.LocalDateTime;

public record JobApplicationWorkflowEventDTO(
    Long id,
    Long workflowId,
    Long jobId,
    JobApplicationWorkflowNode nodeKey,
    JobApplicationWorkflowEventType eventType,
    JobApplicationWorkflowStatus status,
    String title,
    String content,
    String inputSnapshot,
    String outputSnapshot,
    String errorMessage,
    boolean requiresHumanAction,
    LocalDateTime createdAt
) {}
