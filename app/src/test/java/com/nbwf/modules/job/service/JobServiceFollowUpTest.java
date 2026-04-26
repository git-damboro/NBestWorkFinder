package com.nbwf.modules.job.service;

import com.nbwf.modules.aigeneration.listener.AiGenerationStreamProducer;
import com.nbwf.modules.aigeneration.service.AiGenerationTaskService;
import com.nbwf.modules.job.model.JobApplicationStatus;
import com.nbwf.modules.job.model.JobEntity;
import com.nbwf.modules.job.model.UpdateJobRequest;
import com.nbwf.modules.job.repository.JobRepository;
import com.nbwf.modules.resume.repository.ResumeRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;
import tools.jackson.databind.ObjectMapper;

import java.util.Optional;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JobServiceFollowUpTest {

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

    @Mock
    private PlatformTransactionManager transactionManager;

    @Mock
    private ObjectMapper objectMapper;

    @Mock
    private JobFollowUpService jobFollowUpService;

    @InjectMocks
    private JobService jobService;

    @Test
    void updateShouldRecordFollowUpWhenApplicationStatusChanges() {
        JobEntity job = buildJob();
        UpdateJobRequest request = new UpdateJobRequest();
        request.setApplicationStatus(JobApplicationStatus.APPLIED);

        when(jobRepository.findByIdAndUserId(10L, 7L)).thenReturn(Optional.of(job));
        when(jobRepository.save(job)).thenReturn(job);

        jobService.update(10L, request, 7L);

        verify(jobFollowUpService).recordStatusChange(job, JobApplicationStatus.SAVED, JobApplicationStatus.APPLIED);
    }

    @Test
    void updateShouldNotRecordFollowUpWhenApplicationStatusDoesNotChange() {
        JobEntity job = buildJob();
        UpdateJobRequest request = new UpdateJobRequest();
        request.setApplicationStatus(JobApplicationStatus.SAVED);

        when(jobRepository.findByIdAndUserId(10L, 7L)).thenReturn(Optional.of(job));
        when(jobRepository.save(job)).thenReturn(job);

        jobService.update(10L, request, 7L);

        verify(jobFollowUpService, never()).recordStatusChange(
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any()
        );
    }

    private static JobEntity buildJob() {
        JobEntity job = new JobEntity();
        job.setId(10L);
        job.setUserId(7L);
        job.setTitle("Java 后端");
        job.setCompany("示例公司");
        job.setDescription("负责后端开发");
        job.setApplicationStatus(JobApplicationStatus.SAVED);
        return job;
    }
}
