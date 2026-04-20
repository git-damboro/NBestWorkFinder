package com.nbwf.modules.jobdraft.model;

import java.time.LocalDateTime;

public record JobDraftBatchDTO(
    String batchId,
    JobDraftSourceType sourceType,
    Long resumeId,
    String sourcePlatform,
    String sourcePageUrl,
    String sourcePageTitle,
    int totalCount,
    int selectedCount,
    int importedCount,
    JobDraftBatchStatus status,
    LocalDateTime createdAt,
    LocalDateTime updatedAt,
    LocalDateTime expiresAt
) {
}

