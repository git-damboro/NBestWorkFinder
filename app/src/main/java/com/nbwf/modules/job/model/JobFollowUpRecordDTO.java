package com.nbwf.modules.job.model;

import java.time.LocalDateTime;

public record JobFollowUpRecordDTO(
    Long id,
    Long jobId,
    JobFollowUpType type,
    String title,
    String content,
    JobApplicationStatus fromStatus,
    JobApplicationStatus toStatus,
    String contactMethod,
    LocalDateTime nextFollowUpAt,
    LocalDateTime createdAt
) {}
