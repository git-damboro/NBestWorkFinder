package com.nbwf.modules.jobdraft.model;

public record JobDraftBatchCreatedDTO(
    String batchId,
    JobDraftBatchStatus status,
    int totalCount,
    Long resumeId,
    String taskId,
    boolean needResumeSelection
) {
}
