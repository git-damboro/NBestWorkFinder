package com.nbwf.modules.aigeneration.service;

import com.nbwf.common.exception.BusinessException;
import com.nbwf.common.model.AsyncTaskStatus;
import com.nbwf.modules.aigeneration.listener.AiGenerationStreamProducer;
import com.nbwf.modules.aigeneration.model.AiGenerationTaskDTO;
import com.nbwf.modules.aigeneration.model.AiGenerationTaskEntity;
import com.nbwf.modules.aigeneration.model.AiGenerationTaskType;
import com.nbwf.modules.job.service.JobService;
import com.nbwf.modules.jobdraft.model.JobDraftDetailSyncRequest;
import com.nbwf.modules.jobdraft.service.JobDraftService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import tools.jackson.databind.ObjectMapper;

@ExtendWith(MockitoExtension.class)
class AiGenerationTaskRetryServiceTest {

    @Mock
    private AiGenerationTaskService aiGenerationTaskService;

    @Mock
    private AiGenerationStreamProducer aiGenerationStreamProducer;

    @Mock
    private JobDraftService jobDraftService;

    @Mock
    private JobService jobService;

    private AiGenerationTaskRetryService retryService;

    @BeforeEach
    void setUp() {
        retryService = new AiGenerationTaskRetryService(
            aiGenerationTaskService,
            aiGenerationStreamProducer,
            jobDraftService,
            jobService,
            new ObjectMapper()
        );
    }

    @Test
    void retryAsyncTaskShouldResetAndRequeueExistingTask() {
        AiGenerationTaskEntity failedTask = task("agt_resume", AiGenerationTaskType.RESUME_JOB_DRAFT, AsyncTaskStatus.FAILED);
        AiGenerationTaskEntity resetTask = task("agt_resume", AiGenerationTaskType.RESUME_JOB_DRAFT, AsyncTaskStatus.PENDING);
        AiGenerationTaskDTO dto = dto("agt_resume", AiGenerationTaskType.RESUME_JOB_DRAFT, AsyncTaskStatus.PENDING);

        when(aiGenerationTaskService.getTaskEntity("agt_resume", 7L)).thenReturn(failedTask, resetTask);
        when(aiGenerationTaskService.getTask("agt_resume", 7L)).thenReturn(dto);

        AiGenerationTaskDTO actual = retryService.retry("agt_resume", 7L);

        assertEquals("agt_resume", actual.taskId());
        verify(aiGenerationTaskService).resetForRetry("agt_resume", 7L);
        verify(aiGenerationStreamProducer).sendTask(resetTask);
    }

    @Test
    void retryDraftDetailTaskShouldReplayStoredRequest() {
        AiGenerationTaskEntity failedTask = task("agt_detail", AiGenerationTaskType.JOB_DRAFT_DETAIL_SYNC, AsyncTaskStatus.FAILED);
        AiGenerationTaskEntity resetTask = task("agt_detail", AiGenerationTaskType.JOB_DRAFT_DETAIL_SYNC, AsyncTaskStatus.PENDING);
        resetTask.setRequestJson("""
            {"v":1,"targetKind":"DRAFT","draftItemId":"jdi_1","request":{"title":"Java 后端","company":"示例科技"}}
            """);
        AiGenerationTaskDTO dto = dto("agt_detail", AiGenerationTaskType.JOB_DRAFT_DETAIL_SYNC, AsyncTaskStatus.COMPLETED);

        when(aiGenerationTaskService.getTaskEntity("agt_detail", 7L)).thenReturn(failedTask, resetTask);
        when(aiGenerationTaskService.getTask("agt_detail", 7L)).thenReturn(dto);

        retryService.retry("agt_detail", 7L);

        ArgumentCaptor<JobDraftDetailSyncRequest> requestCaptor = ArgumentCaptor.forClass(JobDraftDetailSyncRequest.class);
        verify(jobDraftService).retryItemDetailSyncTask(eq(resetTask), eq("jdi_1"), requestCaptor.capture());
        assertEquals("Java 后端", requestCaptor.getValue().title());
        verify(aiGenerationStreamProducer, never()).sendTask(resetTask);
    }

    @Test
    void retryShouldRejectNonFailedTask() {
        AiGenerationTaskEntity runningTask = task("agt_running", AiGenerationTaskType.INTERVIEW_SESSION_CREATE, AsyncTaskStatus.PROCESSING);
        when(aiGenerationTaskService.getTaskEntity("agt_running", 7L)).thenReturn(runningTask);

        assertThrows(BusinessException.class, () -> retryService.retry("agt_running", 7L));

        verify(aiGenerationTaskService, never()).resetForRetry("agt_running", 7L);
    }

    private AiGenerationTaskEntity task(String taskId,
                                        AiGenerationTaskType type,
                                        AsyncTaskStatus status) {
        AiGenerationTaskEntity task = new AiGenerationTaskEntity();
        task.setTaskId(taskId);
        task.setUserId(7L);
        task.setType(type);
        task.setSourceId(21L);
        task.setStatus(status);
        task.setRequestJson("{}");
        return task;
    }

    private AiGenerationTaskDTO dto(String taskId,
                                    AiGenerationTaskType type,
                                    AsyncTaskStatus status) {
        return new AiGenerationTaskDTO(
            taskId,
            type,
            21L,
            null,
            status,
            null,
            null,
            null,
            null,
            null
        );
    }
}
