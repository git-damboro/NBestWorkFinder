package com.nbwf.modules.aigeneration.model;

import com.nbwf.common.model.AsyncTaskStatus;

import java.time.LocalDateTime;

/**
 * 通用 AI 生成任务 DTO
 */
public record AiGenerationTaskDTO(
    String taskId,
    AiGenerationTaskType type,
    Long sourceId,
    Long targetId,
    AsyncTaskStatus status,
    String resultJson,
    String errorMessage,
    LocalDateTime createdAt,
    LocalDateTime updatedAt,
    LocalDateTime completedAt
) {
}
