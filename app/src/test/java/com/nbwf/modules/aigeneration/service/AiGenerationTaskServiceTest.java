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
    void listRecentTasksShouldReturnTaskDtos() {
        AiGenerationTaskEntity task1 = new AiGenerationTaskEntity();
        task1.setTaskId("agt_recent_1");
        task1.setUserId(7L);
        task1.setType(AiGenerationTaskType.RESUME_JOB_DRAFT);
        task1.setSourceId(21L);
        task1.setStatus(AsyncTaskStatus.COMPLETED);
        task1.setResultJson("{\"drafts\":[1]}");
        task1.setCreatedAt(LocalDateTime.of(2026, 4, 19, 15, 0));
        task1.setUpdatedAt(LocalDateTime.of(2026, 4, 19, 15, 1));

        AiGenerationTaskEntity task2 = new AiGenerationTaskEntity();
        task2.setTaskId("agt_recent_2");
        task2.setUserId(7L);
        task2.setType(AiGenerationTaskType.INTERVIEW_SESSION_CREATE);
        task2.setSourceId(22L);
        task2.setStatus(AsyncTaskStatus.FAILED);
        task2.setErrorMessage("timeout");
        task2.setCreatedAt(LocalDateTime.of(2026, 4, 19, 14, 50));
        task2.setUpdatedAt(LocalDateTime.of(2026, 4, 19, 14, 51));

        when(aiGenerationTaskRepository.findTop50ByUserIdOrderByCreatedAtDesc(7L))
            .thenReturn(List.of(task1, task2));

        var actual = aiGenerationTaskService.listRecentTasks(7L);

        assertEquals(2, actual.size());
        assertEquals("agt_recent_1", actual.get(0).taskId());
        assertEquals(AsyncTaskStatus.COMPLETED, actual.get(0).status());
        assertEquals("agt_recent_2", actual.get(1).taskId());
        assertEquals(AsyncTaskStatus.FAILED, actual.get(1).status());
        verify(aiGenerationTaskRepository).findTop50ByUserIdOrderByCreatedAtDesc(7L);
    }

    @Test
    void listRecentTasksShouldReturnEmptyListWhenNoTaskExists() {
        when(aiGenerationTaskRepository.findTop50ByUserIdOrderByCreatedAtDesc(7L))
            .thenReturn(List.of());

        var actual = aiGenerationTaskService.listRecentTasks(7L);

        assertTrue(actual.isEmpty());
        verify(aiGenerationTaskRepository).findTop50ByUserIdOrderByCreatedAtDesc(7L);
    }

    @Test
    void resetForRetryShouldResetTaskToPending() {
        AiGenerationTaskEntity failedTask = new AiGenerationTaskEntity();
        failedTask.setTaskId("agt_retry");
        failedTask.setUserId(7L);
        failedTask.setType(AiGenerationTaskType.JOB_DRAFT_DETAIL_SYNC);
        failedTask.setSourceId(21L);
        failedTask.setStatus(AsyncTaskStatus.FAILED);
        failedTask.setResultJson("{\"old\":true}");
        failedTask.setErrorMessage("network error");
        failedTask.setCompletedAt(LocalDateTime.of(2026, 4, 19, 16, 0));

        when(aiGenerationTaskRepository.findByTaskIdAndUserId("agt_retry", 7L))
            .thenReturn(Optional.of(failedTask));
        when(aiGenerationTaskRepository.save(any(AiGenerationTaskEntity.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));

        var actual = aiGenerationTaskService.resetForRetry("agt_retry", 7L);

        assertEquals("agt_retry", actual.taskId());
        assertEquals(AsyncTaskStatus.PENDING, actual.status());
        assertNull(actual.resultJson());
        assertNull(actual.errorMessage());
        assertNull(actual.completedAt());
        verify(aiGenerationTaskRepository).findByTaskIdAndUserId("agt_retry", 7L);
        verify(aiGenerationTaskRepository).save(failedTask);
    }

    @Test
    void resetForRetryShouldThrowWhenTaskNotFound() {
        when(aiGenerationTaskRepository.findByTaskIdAndUserId("agt_missing_retry", 7L))
            .thenReturn(Optional.empty());

        assertThrows(BusinessException.class, () -> aiGenerationTaskService.resetForRetry("agt_missing_retry", 7L));
        verify(aiGenerationTaskRepository).findByTaskIdAndUserId("agt_missing_retry", 7L);
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
