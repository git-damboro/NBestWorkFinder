package com.nbwf.modules.job.service;

import com.nbwf.common.exception.BusinessException;
import com.nbwf.modules.job.model.CreateJobFollowUpRequest;
import com.nbwf.modules.job.model.JobApplicationStatus;
import com.nbwf.modules.job.model.JobEntity;
import com.nbwf.modules.job.model.JobFollowUpRecordEntity;
import com.nbwf.modules.job.model.JobFollowUpType;
import com.nbwf.modules.job.repository.JobFollowUpRecordRepository;
import com.nbwf.modules.job.repository.JobRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JobFollowUpServiceTest {

    @Mock
    private JobRepository jobRepository;

    @Mock
    private JobFollowUpRecordRepository recordRepository;

    @Mock
    private JobApplicationWorkflowService workflowService;

    @InjectMocks
    private JobFollowUpService service;

    @Test
    void createManualShouldSaveRecordAndUpdateJobFollowUpSnapshots() {
        JobEntity job = buildJob(10L, 7L);
        LocalDateTime createdAt = LocalDateTime.of(2026, 4, 26, 9, 0);
        LocalDateTime nextTime = LocalDateTime.of(2026, 4, 28, 10, 30);

        when(jobRepository.findByIdAndUserId(10L, 7L)).thenReturn(Optional.of(job));
        when(recordRepository.save(any(JobFollowUpRecordEntity.class))).thenAnswer(invocation -> {
            JobFollowUpRecordEntity record = invocation.getArgument(0);
            record.setId(101L);
            record.setCreatedAt(createdAt);
            return record;
        });

        var actual = service.createManual(10L, new CreateJobFollowUpRequest(
            JobFollowUpType.CONTACT,
            "已联系 HR",
            "通过 BOSS 发送开场话术，等待回复。",
            "BOSS",
            nextTime
        ), 7L);

        assertEquals(101L, actual.id());
        assertEquals(JobFollowUpType.CONTACT, actual.type());
        assertEquals("已联系 HR", actual.title());
        assertEquals(nextTime, actual.nextFollowUpAt());
        assertEquals(nextTime, job.getNextFollowUpAt());
        assertEquals(createdAt, job.getLastFollowUpAt());
        verify(jobRepository).save(job);
    }

    @Test
    void recordStatusChangeShouldSetAppliedAtOnFirstAppliedStatus() {
        JobEntity job = buildJob(10L, 7L);
        LocalDateTime createdAt = LocalDateTime.of(2026, 4, 26, 9, 30);

        when(recordRepository.save(any(JobFollowUpRecordEntity.class))).thenAnswer(invocation -> {
            JobFollowUpRecordEntity record = invocation.getArgument(0);
            record.setId(102L);
            record.setCreatedAt(createdAt);
            return record;
        });

        service.recordStatusChange(job, JobApplicationStatus.SAVED, JobApplicationStatus.APPLIED);

        assertEquals(createdAt, job.getAppliedAt());
        assertEquals(createdAt, job.getLastFollowUpAt());
    }

    @Test
    void listShouldRejectOtherUsersJob() {
        when(jobRepository.findByIdAndUserId(10L, 8L)).thenReturn(Optional.empty());

        assertThrows(BusinessException.class, () -> service.list(10L, 8L));
    }

    @Test
    void listShouldReturnCurrentUsersTimeline() {
        JobEntity job = buildJob(10L, 7L);
        JobFollowUpRecordEntity record = new JobFollowUpRecordEntity();
        record.setId(101L);
        record.setJobId(10L);
        record.setUserId(7L);
        record.setType(JobFollowUpType.MANUAL_NOTE);
        record.setTitle("备注");
        record.setContent("准备二次沟通");
        record.setCreatedAt(LocalDateTime.of(2026, 4, 26, 9, 0));

        when(jobRepository.findByIdAndUserId(10L, 7L)).thenReturn(Optional.of(job));
        when(recordRepository.findByJobIdAndUserIdOrderByCreatedAtDesc(10L, 7L)).thenReturn(List.of(record));

        var actual = service.list(10L, 7L);

        assertEquals(1, actual.size());
        assertEquals("备注", actual.get(0).title());
    }

    private static JobEntity buildJob(Long id, Long userId) {
        JobEntity job = new JobEntity();
        job.setId(id);
        job.setUserId(userId);
        job.setTitle("Java 后端");
        job.setCompany("示例公司");
        job.setDescription("负责后端开发");
        job.setApplicationStatus(JobApplicationStatus.SAVED);
        return job;
    }
}
