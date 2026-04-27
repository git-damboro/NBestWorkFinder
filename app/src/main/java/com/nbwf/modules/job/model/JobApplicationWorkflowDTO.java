package com.nbwf.modules.job.model;

import java.time.LocalDateTime;
import java.util.List;

public record JobApplicationWorkflowDTO(
    Long id,
    Long jobId,
    JobApplicationWorkflowStatus status,
    JobApplicationWorkflowNode currentNode,
    String nextAction,
    LocalDateTime createdAt,
    LocalDateTime updatedAt,
    LocalDateTime completedAt,
    List<JobApplicationWorkflowEventDTO> events
) {}
