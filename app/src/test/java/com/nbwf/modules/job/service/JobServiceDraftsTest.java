package com.nbwf.modules.job.service;

import com.nbwf.common.exception.BusinessException;
import com.nbwf.common.exception.ErrorCode;
import com.nbwf.common.model.AsyncTaskStatus;
import com.nbwf.modules.aigeneration.listener.AiGenerationStreamProducer;
import com.nbwf.modules.aigeneration.model.AiGenerationTaskDTO;
import com.nbwf.modules.aigeneration.model.AiGenerationTaskEntity;
import com.nbwf.modules.aigeneration.model.AiGenerationTaskType;
import com.nbwf.modules.aigeneration.service.AiGenerationTaskService;
import com.nbwf.modules.job.model.ResumeJobDraftDTO;
import com.nbwf.modules.job.repository.JobRepository;
import com.nbwf.modules.resume.model.ResumeEntity;
import com.nbwf.modules.resume.repository.ResumeRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JobServiceDraftsTest {

    @Mock
    private JobRepository jobRepository;

    @Mock
    private JobTagExtractService tagExtractService;

    @Mock
    private JobMatchService matchService;

    @Mock
    private ResumeRepository resumeRepository;

    @Mock
    private ResumeJobDraftService resumeJobDraftService;

    @Mock
    private AiGenerationTaskService aiGenerationTaskService;

    @Mock
    private AiGenerationStreamProducer aiGenerationStreamProducer;

    @InjectMocks
    private JobService jobService;

    @Test
    void generateDraftsFromResumeShouldUseOwnedResumeText() {
        ResumeEntity resume = new ResumeEntity();
        resume.setId(21L);
        resume.setUserId(7L);
        resume.setResumeText("Java / Spring Boot / Redis");

        when(resumeRepository.findByIdAndUserId(21L, 7L)).thenReturn(Optional.of(resume));
        when(resumeJobDraftService.generateDrafts("Java / Spring Boot / Redis"))
            .thenReturn(List.of(new ResumeJobDraftDTO(
                "Java 后端开发工程师",
                "偏向服务开发",
                "技能较匹配",
                List.of("Java", "Spring Boot"),
                "默认描述",
                "默认备注"
            )));

        List<ResumeJobDraftDTO> drafts = jobService.generateDraftsFromResume(21L, 7L);

        assertEquals(1, drafts.size());
        verify(resumeRepository).findByIdAndUserId(21L, 7L);
        verify(resumeJobDraftService).generateDrafts("Java / Spring Boot / Redis");
    }

    @Test
    void generateDraftsFromResumeShouldRejectBlankResumeText() {
        ResumeEntity resume = new ResumeEntity();
        resume.setId(21L);
        resume.setUserId(7L);
        resume.setResumeText("   ");

        when(resumeRepository.findByIdAndUserId(21L, 7L)).thenReturn(Optional.of(resume));

        BusinessException exception = assertThrows(
            BusinessException.class,
            () -> jobService.generateDraftsFromResume(21L, 7L)
        );

        assertEquals(ErrorCode.RESUME_PARSE_FAILED.getCode(), exception.getCode());
        verify(resumeRepository).findByIdAndUserId(21L, 7L);
        verifyNoInteractions(resumeJobDraftService);
    }

    @Test
    void createDraftTaskFromResumeShouldCreateAndEnqueueNewTask() {
        ResumeEntity resume = new ResumeEntity();
        resume.setId(21L);
        resume.setUserId(7L);
        resume.setResumeText("Java / Spring Boot / Redis");

        AiGenerationTaskEntity newTask = new AiGenerationTaskEntity();
        newTask.setTaskId("agt_new");
        newTask.setUserId(7L);
        newTask.setType(AiGenerationTaskType.RESUME_JOB_DRAFT);
        newTask.setSourceId(21L);
        newTask.setStatus(AsyncTaskStatus.PENDING);

        AiGenerationTaskDTO taskDTO = new AiGenerationTaskDTO(
            "agt_new",
            AiGenerationTaskType.RESUME_JOB_DRAFT,
            21L,
            null,
            AsyncTaskStatus.PENDING,
            null,
            null,
            null,
            null,
            null
        );

        when(resumeRepository.findByIdAndUserId(21L, 7L)).thenReturn(Optional.of(resume));
        when(aiGenerationTaskService.createOrReuseTaskResult(
            eq(7L),
            eq(AiGenerationTaskType.RESUME_JOB_DRAFT),
            eq(21L),
            eq(null),
            eq("{\"resumeId\":21}")
        )).thenReturn(new AiGenerationTaskService.TaskCreationResult(newTask, false));
        when(aiGenerationTaskService.getTask("agt_new", 7L)).thenReturn(taskDTO);

        AiGenerationTaskDTO actual = jobService.createDraftTaskFromResume(21L, 7L);

        assertEquals("agt_new", actual.taskId());
        verify(aiGenerationStreamProducer).sendTask(newTask);
        verifyNoInteractions(resumeJobDraftService);
    }

    @Test
    void createDraftTaskFromResumeShouldReuseRunningTaskWithoutReenqueue() {
        ResumeEntity resume = new ResumeEntity();
        resume.setId(21L);
        resume.setUserId(7L);
        resume.setResumeText("Java / Spring Boot / Redis");

        AiGenerationTaskEntity reusedTask = new AiGenerationTaskEntity();
        reusedTask.setTaskId("agt_reused");
        reusedTask.setUserId(7L);
        reusedTask.setType(AiGenerationTaskType.RESUME_JOB_DRAFT);
        reusedTask.setSourceId(21L);
        reusedTask.setStatus(AsyncTaskStatus.PROCESSING);

        AiGenerationTaskDTO taskDTO = new AiGenerationTaskDTO(
            "agt_reused",
            AiGenerationTaskType.RESUME_JOB_DRAFT,
            21L,
            null,
            AsyncTaskStatus.PROCESSING,
            null,
            null,
            null,
            null,
            null
        );

        when(resumeRepository.findByIdAndUserId(21L, 7L)).thenReturn(Optional.of(resume));
        when(aiGenerationTaskService.createOrReuseTaskResult(
            eq(7L),
            eq(AiGenerationTaskType.RESUME_JOB_DRAFT),
            eq(21L),
            eq(null),
            eq("{\"resumeId\":21}")
        )).thenReturn(new AiGenerationTaskService.TaskCreationResult(reusedTask, true));
        when(aiGenerationTaskService.getTask("agt_reused", 7L)).thenReturn(taskDTO);

        AiGenerationTaskDTO actual = jobService.createDraftTaskFromResume(21L, 7L);

        assertEquals("agt_reused", actual.taskId());
        verify(aiGenerationStreamProducer, never()).sendTask(reusedTask);
        verifyNoInteractions(resumeJobDraftService);
    }
}
