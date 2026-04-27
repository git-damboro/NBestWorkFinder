package com.nbwf.modules.job.service;

import com.nbwf.common.exception.BusinessException;
import com.nbwf.common.exception.ErrorCode;
import com.nbwf.modules.job.model.CreateJobFollowUpRequest;
import com.nbwf.modules.job.model.JobApplicationStatus;
import com.nbwf.modules.job.model.JobEntity;
import com.nbwf.modules.job.model.JobFollowUpRecordDTO;
import com.nbwf.modules.job.model.JobFollowUpRecordEntity;
import com.nbwf.modules.job.model.JobFollowUpType;
import com.nbwf.modules.job.repository.JobFollowUpRecordRepository;
import com.nbwf.modules.job.repository.JobRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class JobFollowUpService {

    private final JobRepository jobRepository;
    private final JobFollowUpRecordRepository recordRepository;
    private final JobApplicationWorkflowService workflowService;

    @Transactional(readOnly = true)
    public List<JobFollowUpRecordDTO> list(Long jobId, Long userId) {
        findJob(jobId, userId);
        return recordRepository.findByJobIdAndUserIdOrderByCreatedAtDesc(jobId, userId)
            .stream()
            .map(this::toDTO)
            .toList();
    }

    @Transactional
    public JobFollowUpRecordDTO createManual(Long jobId, CreateJobFollowUpRequest req, Long userId) {
        JobEntity job = findJob(jobId, userId);
        JobFollowUpType type = req.type() == null ? JobFollowUpType.MANUAL_NOTE : req.type();
        String content = trimToNull(req.content());

        if (content == null) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "跟进内容不能为空");
        }

        JobFollowUpRecordEntity record = new JobFollowUpRecordEntity();
        record.setJobId(jobId);
        record.setUserId(userId);
        record.setType(type);
        record.setTitle(resolveManualTitle(type, req.title()));
        record.setContent(content);
        record.setContactMethod(trimToNull(req.contactMethod()));
        record.setNextFollowUpAt(req.nextFollowUpAt());

        JobFollowUpRecordEntity saved = recordRepository.save(record);
        updateJobSnapshots(job, saved);
        workflowService.recordFollowUpScheduled(job, saved.getNextFollowUpAt());
        jobRepository.save(job);
        return toDTO(saved);
    }

    @Transactional
    public void recordStatusChange(JobEntity job, JobApplicationStatus fromStatus, JobApplicationStatus toStatus) {
        if (fromStatus == toStatus) {
            return;
        }

        JobFollowUpRecordEntity record = new JobFollowUpRecordEntity();
        record.setJobId(job.getId());
        record.setUserId(job.getUserId());
        record.setType(JobFollowUpType.STATUS_CHANGE);
        record.setTitle("状态变更：" + statusLabel(fromStatus) + " → " + statusLabel(toStatus));
        record.setContent("职位状态从「" + statusLabel(fromStatus) + "」更新为「" + statusLabel(toStatus) + "」。");
        record.setFromStatus(fromStatus);
        record.setToStatus(toStatus);

        JobFollowUpRecordEntity saved = recordRepository.save(record);
        if (toStatus == JobApplicationStatus.APPLIED && job.getAppliedAt() == null) {
            job.setAppliedAt(saved.getCreatedAt());
        }
        updateJobSnapshots(job, saved);
    }

    private JobEntity findJob(Long jobId, Long userId) {
        return jobRepository.findByIdAndUserId(jobId, userId)
            .orElseThrow(() -> new BusinessException(ErrorCode.JOB_NOT_FOUND));
    }

    private void updateJobSnapshots(JobEntity job, JobFollowUpRecordEntity record) {
        job.setLastFollowUpAt(record.getCreatedAt());
        if (record.getNextFollowUpAt() != null) {
            job.setNextFollowUpAt(record.getNextFollowUpAt());
        }
    }

    private String resolveManualTitle(JobFollowUpType type, String title) {
        String trimmed = trimToNull(title);
        if (trimmed != null) {
            return trimmed;
        }
        return switch (type) {
            case CONTACT -> "新增沟通记录";
            case INTERVIEW -> "新增面试记录";
            case OFFER -> "新增 Offer 记录";
            case REJECTION -> "新增拒绝记录";
            case STATUS_CHANGE -> "状态变化";
            case MANUAL_NOTE -> "新增备注";
        };
    }

    private String statusLabel(JobApplicationStatus status) {
        if (status == null) {
            return "未知";
        }
        return switch (status) {
            case SAVED -> "已收藏";
            case APPLIED -> "已投递";
            case INTERVIEWING -> "面试中";
            case OFFERED -> "已拿 Offer";
            case REJECTED -> "已拒绝";
        };
    }

    private JobFollowUpRecordDTO toDTO(JobFollowUpRecordEntity record) {
        return new JobFollowUpRecordDTO(
            record.getId(),
            record.getJobId(),
            record.getType(),
            record.getTitle(),
            record.getContent(),
            record.getFromStatus(),
            record.getToStatus(),
            record.getContactMethod(),
            record.getNextFollowUpAt(),
            record.getCreatedAt()
        );
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
