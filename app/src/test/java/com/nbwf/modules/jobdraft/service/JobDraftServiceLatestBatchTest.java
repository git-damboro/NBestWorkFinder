package com.nbwf.modules.jobdraft.service;

import com.nbwf.modules.aigeneration.service.AiGenerationTaskService;
import com.nbwf.modules.job.repository.JobRepository;
import com.nbwf.modules.job.service.JobMatchService;
import com.nbwf.modules.job.service.ResumeJobDraftService;
import com.nbwf.modules.jobdraft.model.JobDraftBatchEntity;
import com.nbwf.modules.jobdraft.model.JobDraftBatchStatus;
import com.nbwf.modules.jobdraft.model.JobDraftSourceType;
import com.nbwf.modules.jobdraft.repository.JobDraftBatchRepository;
import com.nbwf.modules.jobdraft.repository.JobDraftItemRepository;
import com.nbwf.modules.resume.repository.ResumeRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;
import org.springframework.transaction.PlatformTransactionManager;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JobDraftServiceLatestBatchTest {

    @Mock
    private JobDraftBatchRepository batchRepository;

    @Mock
    private JobDraftItemRepository itemRepository;

    @Mock
    private ResumeRepository resumeRepository;

    @Mock
    private JobRepository jobRepository;

    @Mock
    private ResumeJobDraftService resumeJobDraftService;

    @Mock
    private JobMatchService jobMatchService;

    @Mock
    private JobDraftFingerprintService fingerprintService;

    @Mock
    private AiGenerationTaskService aiGenerationTaskService;

    @Mock
    private PlatformTransactionManager transactionManager;

    @Mock
    private ObjectMapper objectMapper;

    @InjectMocks
    private JobDraftService jobDraftService;

    @Test
    void getLatestBatchShouldReturnLatestRecoverableBatch() {
        JobDraftBatchEntity batch = new JobDraftBatchEntity();
        batch.setBatchId("jdb_latest");
        batch.setUserId(7L);
        batch.setSourceType(JobDraftSourceType.PAGE_SYNC);
        batch.setSourcePlatform("BOSS");
        batch.setStatus(JobDraftBatchStatus.PARTIAL_IMPORTED);
        batch.setResumeId(21L);
        batch.setTotalCount(6);
        batch.setSelectedCount(2);
        batch.setImportedCount(4);
        batch.setCreatedAt(LocalDateTime.of(2026, 4, 21, 10, 0));
        batch.setUpdatedAt(LocalDateTime.of(2026, 4, 21, 10, 5));
        batch.setExpiresAt(LocalDateTime.of(2026, 5, 21, 10, 0));

        when(batchRepository.findLatestRecoverableBatches(
            eq(7L),
            eq(recoverableStatuses()),
            any(LocalDateTime.class),
            any(Pageable.class)
        )).thenReturn(List.of(batch));

        var actual = jobDraftService.getLatestBatch(7L);

        assertEquals("jdb_latest", actual.batchId());
        assertEquals(JobDraftBatchStatus.PARTIAL_IMPORTED, actual.status());
        assertEquals(21L, actual.resumeId());
        verify(batchRepository).findLatestRecoverableBatches(
            eq(7L),
            eq(recoverableStatuses()),
            any(LocalDateTime.class),
            any(Pageable.class)
        );
    }

    @Test
    void getLatestBatchShouldReturnNullWhenNoRecoverableBatchExists() {
        when(batchRepository.findLatestRecoverableBatches(
            eq(7L),
            eq(recoverableStatuses()),
            any(LocalDateTime.class),
            any(Pageable.class)
        )).thenReturn(List.of());

        var actual = jobDraftService.getLatestBatch(7L);

        assertNull(actual);
    }

    private static List<JobDraftBatchStatus> recoverableStatuses() {
        return List.of(
            JobDraftBatchStatus.CREATED,
            JobDraftBatchStatus.ANALYZING,
            JobDraftBatchStatus.READY,
            JobDraftBatchStatus.PARTIAL_IMPORTED,
            JobDraftBatchStatus.FAILED
        );
    }
}
