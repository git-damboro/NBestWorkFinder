package com.nbwf.modules.jobdraft.service;

import com.nbwf.modules.aigeneration.service.AiGenerationTaskService;
import com.nbwf.modules.job.model.JobEntity;
import com.nbwf.modules.job.repository.JobRepository;
import com.nbwf.modules.job.service.JobMatchService;
import com.nbwf.modules.job.service.ResumeJobDraftService;
import com.nbwf.modules.jobdraft.model.ImportJobDraftItemsRequest;
import com.nbwf.modules.jobdraft.model.ImportJobDraftItemsResultDTO;
import com.nbwf.modules.jobdraft.model.JobDraftBatchEntity;
import com.nbwf.modules.jobdraft.model.JobDraftBatchStatus;
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

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JobDraftServiceImportItemsTest {

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
    void importItemsShouldContinueWhenOneDraftFailsToSave() {
        JobDraftBatchEntity batch = new JobDraftBatchEntity();
        batch.setBatchId("jdb_1");
        batch.setUserId(7L);
        batch.setSourceType(JobDraftSourceType.PAGE_SYNC);
        batch.setStatus(JobDraftBatchStatus.READY);
        batch.setTotalCount(2);
        batch.setSelectedCount(2);
        batch.setImportedCount(0);

        JobDraftItemEntity brokenItem = buildItem("jdi_broken", "fp_broken");
        JobDraftItemEntity validItem = buildItem("jdi_valid", "fp_valid");

        when(batchRepository.findByBatchIdAndUserId("jdb_1", 7L)).thenReturn(Optional.of(batch));
        when(itemRepository.findByBatchIdAndUserIdAndDraftItemIdIn(
            "jdb_1",
            7L,
            List.of("jdi_broken", "jdi_valid")
        )).thenReturn(List.of(brokenItem, validItem));
        when(jobRepository.save(any(JobEntity.class)))
            .thenThrow(new RuntimeException("database rejected draft"))
            .thenAnswer(invocation -> {
                JobEntity saved = invocation.getArgument(0);
                saved.setId(101L);
                return saved;
            });

        ImportJobDraftItemsResultDTO actual = assertDoesNotThrow(() ->
            jobDraftService.importItems("jdb_1", new ImportJobDraftItemsRequest(List.of("jdi_broken", "jdi_valid")), 7L)
        );

        assertEquals(1, actual.importedCount());
        assertEquals(0, actual.skippedCount());
        assertEquals(List.of(101L), actual.importedJobIds());
        assertFalse(brokenItem.isImported());
        assertTrue(validItem.isImported());
        assertEquals(1, batch.getImportedCount());
        assertEquals(JobDraftBatchStatus.PARTIAL_IMPORTED, batch.getStatus());
    }

    private static JobDraftItemEntity buildItem(String draftItemId, String sourceFingerprint) {
        JobDraftItemEntity item = new JobDraftItemEntity();
        item.setDraftItemId(draftItemId);
        item.setBatchId("jdb_1");
        item.setUserId(7L);
        item.setSourceType(JobDraftSourceType.PAGE_SYNC);
        item.setSourcePlatform("BOSS");
        item.setSourceFingerprint(sourceFingerprint);
        item.setTitle("Java 后端工程师");
        item.setCompany("示例公司");
        item.setDescriptionPreview("负责 Spring Boot 后端开发");
        item.setDetailSyncStatus(JobDraftDetailSyncStatus.PARTIAL);
        item.setSelected(true);
        return item;
    }
}
