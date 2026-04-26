package com.nbwf.modules.jobdraft.service;

import com.nbwf.modules.aigeneration.service.AiGenerationTaskService;
import com.nbwf.modules.job.repository.JobRepository;
import com.nbwf.modules.job.service.JobMatchService;
import com.nbwf.modules.job.service.ResumeJobDraftService;
import com.nbwf.modules.jobdraft.model.JobDraftBatchEntity;
import com.nbwf.modules.jobdraft.model.JobDraftDetailSyncRequest;
import com.nbwf.modules.jobdraft.model.JobDraftDetailSyncStatus;
import com.nbwf.modules.jobdraft.model.JobDraftItemEntity;
import com.nbwf.modules.jobdraft.model.JobDraftSourceType;
import com.nbwf.modules.jobdraft.repository.JobDraftBatchRepository;
import com.nbwf.modules.jobdraft.repository.JobDraftItemRepository;
import com.nbwf.modules.resume.repository.ResumeRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.PlatformTransactionManager;
import tools.jackson.databind.ObjectMapper;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JobDraftServiceUpdateItemTest {

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
    void updateItemShouldSaveManualEditWithoutCreatingAiGenerationTask() {
        JobDraftBatchEntity batch = new JobDraftBatchEntity();
        batch.setBatchId("jdb_1");
        batch.setUserId(7L);
        batch.setSourceType(JobDraftSourceType.RESUME_GENERATION);
        batch.setResumeId(null);

        JobDraftItemEntity item = new JobDraftItemEntity();
        item.setDraftItemId("jdi_1");
        item.setBatchId("jdb_1");
        item.setUserId(7L);
        item.setSourceType(JobDraftSourceType.RESUME_GENERATION);
        item.setSourcePlatform("SYSTEM");
        item.setSourceFingerprint("SYSTEM:resume:abc");
        item.setTitle("旧职位");
        item.setCompany("待补充");
        item.setDetailSyncStatus(JobDraftDetailSyncStatus.PARTIAL);

        when(itemRepository.findByDraftItemIdAndUserId("jdi_1", 7L)).thenReturn(Optional.of(item));
        when(batchRepository.findByBatchIdAndUserId("jdb_1", 7L)).thenReturn(Optional.of(batch));
        when(itemRepository.save(item)).thenReturn(item);

        var actual = jobDraftService.updateItem("jdi_1", new JobDraftDetailSyncRequest(
            null,
            null,
            null,
            "Java 后端开发工程师",
            "示例科技",
            "上海",
            "20k-30k",
            null,
            null,
            "3-5年",
            "本科",
            "负责 Spring Boot、Redis、PostgreSQL 后端开发。",
            "负责 Spring Boot、Redis、PostgreSQL 后端开发。",
            null,
            null,
            "HR 张三",
            null
        ), 7L);

        assertEquals("Java 后端开发工程师", actual.title());
        assertEquals("示例科技", actual.company());
        assertEquals("上海", actual.location());
        assertEquals(JobDraftDetailSyncStatus.COMPLETED, actual.detailSyncStatus());
        assertNull(actual.preciseMatchScore());
        verify(aiGenerationTaskService, never()).createTask(
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any(),
            org.mockito.ArgumentMatchers.any()
        );
    }
}
