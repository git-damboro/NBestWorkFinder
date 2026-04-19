package com.nbwf.modules.aigeneration.service;

import com.nbwf.common.model.AsyncTaskStatus;
import com.nbwf.common.exception.BusinessException;
import com.nbwf.modules.aigeneration.model.AiGenerationTaskEntity;
import com.nbwf.modules.aigeneration.model.AiGenerationTaskType;
import com.nbwf.modules.aigeneration.repository.AiGenerationTaskRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AiGenerationTaskServiceTest {

    @Mock
    private AiGenerationTaskRepository aiGenerationTaskRepository;

    @InjectMocks
    private AiGenerationTaskService aiGenerationTaskService;

    @Test
    void createOrReuseTaskShouldReuseExistingRunningTask() {
        AiGenerationTaskEntity runningTask = new AiGenerationTaskEntity();
        runningTask.setId(10L);
        runningTask.setTaskId("agt_existing");
        runningTask.setUserId(7L);
        runningTask.setType(AiGenerationTaskType.RESUME_JOB_DRAFT);
        runningTask.setSourceId(21L);
        runningTask.setTargetId(31L);
        runningTask.setStatus(AsyncTaskStatus.PROCESSING);
        runningTask.setCreatedAt(LocalDateTime.of(2026, 4, 19, 12, 0));

        when(aiGenerationTaskRepository.findFirstByUserIdAndTypeAndSourceIdAndTargetIdAndStatusInOrderByCreatedAtDesc(
            7L,
            AiGenerationTaskType.RESUME_JOB_DRAFT,
            21L,
            31L,
            List.of(AsyncTaskStatus.PENDING, AsyncTaskStatus.PROCESSING)
        )).thenReturn(Optional.of(runningTask));

        AiGenerationTaskEntity actual = aiGenerationTaskService.createOrReuseTask(
            7L,
            AiGenerationTaskType.RESUME_JOB_DRAFT,
            21L,
            31L,
            "{\"foo\":\"bar\"}"
        );

        assertSame(runningTask, actual);
    }

    @Test
    void createOrReuseTaskShouldCreatePendingTaskWhenNoRunningTask() {
        when(aiGenerationTaskRepository.findFirstByUserIdAndTypeAndSourceIdAndTargetIdAndStatusInOrderByCreatedAtDesc(
            7L,
            AiGenerationTaskType.INTERVIEW_SESSION_CREATE,
            21L,
            31L,
            List.of(AsyncTaskStatus.PENDING, AsyncTaskStatus.PROCESSING)
        )).thenReturn(Optional.empty());
        when(aiGenerationTaskRepository.save(any(AiGenerationTaskEntity.class))).thenAnswer(invocation -> {
            AiGenerationTaskEntity entity = invocation.getArgument(0);
            entity.setId(100L);
            return entity;
        });

        AiGenerationTaskEntity actual = aiGenerationTaskService.createOrReuseTask(
            7L,
            AiGenerationTaskType.INTERVIEW_SESSION_CREATE,
            21L,
            31L,
            "{\"resumeId\":21}"
        );

        assertEquals(100L, actual.getId());
        assertEquals(7L, actual.getUserId());
        assertEquals(AiGenerationTaskType.INTERVIEW_SESSION_CREATE, actual.getType());
        assertEquals(21L, actual.getSourceId());
        assertEquals(31L, actual.getTargetId());
        assertEquals(AsyncTaskStatus.PENDING, actual.getStatus());
        assertEquals("{\"resumeId\":21}", actual.getRequestJson());
        assertTrue(actual.getTaskId().startsWith("agt_"));

        verify(aiGenerationTaskRepository).save(any(AiGenerationTaskEntity.class));
        verify(aiGenerationTaskRepository).findFirstByUserIdAndTypeAndSourceIdAndTargetIdAndStatusInOrderByCreatedAtDesc(
            eq(7L),
            eq(AiGenerationTaskType.INTERVIEW_SESSION_CREATE),
            eq(21L),
            eq(31L),
            eq(List.of(AsyncTaskStatus.PENDING, AsyncTaskStatus.PROCESSING))
        );
    }

    @Test
    void getLatestTaskShouldReturnLatestTaskDto() {
        AiGenerationTaskEntity latestTask = new AiGenerationTaskEntity();
        latestTask.setTaskId("agt_latest");
        latestTask.setUserId(7L);
        latestTask.setType(AiGenerationTaskType.RESUME_JOB_DRAFT);
        latestTask.setSourceId(21L);
        latestTask.setStatus(AsyncTaskStatus.COMPLETED);
        latestTask.setResultJson("{\"drafts\":[]}");
        latestTask.setCreatedAt(LocalDateTime.of(2026, 4, 19, 13, 0));
        latestTask.setUpdatedAt(LocalDateTime.of(2026, 4, 19, 13, 5));

        when(aiGenerationTaskRepository.findFirstByUserIdAndTypeAndSourceIdOrderByCreatedAtDesc(
            7L,
            AiGenerationTaskType.RESUME_JOB_DRAFT,
            21L
        )).thenReturn(Optional.of(latestTask));

        var actual = aiGenerationTaskService.getLatestTask(
            7L,
            AiGenerationTaskType.RESUME_JOB_DRAFT,
            21L
        );

        assertEquals("agt_latest", actual.taskId());
        assertEquals(AsyncTaskStatus.COMPLETED, actual.status());
        assertEquals("{\"drafts\":[]}", actual.resultJson());
    }

    @Test
    void getLatestTaskShouldReturnNullWhenNoTaskExists() {
        when(aiGenerationTaskRepository.findFirstByUserIdAndTypeAndSourceIdOrderByCreatedAtDesc(
            7L,
            AiGenerationTaskType.RESUME_JOB_DRAFT,
            21L
        )).thenReturn(Optional.empty());

        var actual = aiGenerationTaskService.getLatestTask(
            7L,
            AiGenerationTaskType.RESUME_JOB_DRAFT,
            21L
        );

        assertNull(actual);
    }

    @Test
    void getTaskShouldReadTaskWithinCurrentUserScope() {
        AiGenerationTaskEntity entity = new AiGenerationTaskEntity();
        entity.setTaskId("agt_scope");
        entity.setUserId(7L);
        entity.setType(AiGenerationTaskType.RESUME_JOB_DRAFT);
        entity.setSourceId(21L);
        entity.setStatus(AsyncTaskStatus.PROCESSING);
        entity.setCreatedAt(LocalDateTime.of(2026, 4, 19, 14, 0));
        entity.setUpdatedAt(LocalDateTime.of(2026, 4, 19, 14, 1));

        when(aiGenerationTaskRepository.findByTaskIdAndUserId("agt_scope", 7L))
            .thenReturn(Optional.of(entity));

        var actual = aiGenerationTaskService.getTask("agt_scope", 7L);

        assertEquals("agt_scope", actual.taskId());
        assertEquals(AiGenerationTaskType.RESUME_JOB_DRAFT, actual.type());
        assertEquals(AsyncTaskStatus.PROCESSING, actual.status());
        verify(aiGenerationTaskRepository).findByTaskIdAndUserId("agt_scope", 7L);
    }

    @Test
    void getTaskShouldThrowWhenTaskNotFound() {
        when(aiGenerationTaskRepository.findByTaskIdAndUserId("agt_missing", 7L))
            .thenReturn(Optional.empty());

        assertThrows(BusinessException.class, () -> aiGenerationTaskService.getTask("agt_missing", 7L));
        verify(aiGenerationTaskRepository).findByTaskIdAndUserId("agt_missing", 7L);
    }
}
