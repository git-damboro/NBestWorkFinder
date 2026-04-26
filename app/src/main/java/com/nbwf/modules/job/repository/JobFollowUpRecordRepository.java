package com.nbwf.modules.job.repository;

import com.nbwf.modules.job.model.JobFollowUpRecordEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface JobFollowUpRecordRepository extends JpaRepository<JobFollowUpRecordEntity, Long> {

    List<JobFollowUpRecordEntity> findByJobIdAndUserIdOrderByCreatedAtDesc(Long jobId, Long userId);
}
