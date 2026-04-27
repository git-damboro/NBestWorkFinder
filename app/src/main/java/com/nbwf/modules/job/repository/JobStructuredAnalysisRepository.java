package com.nbwf.modules.job.repository;

import com.nbwf.modules.job.model.JobStructuredAnalysisEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface JobStructuredAnalysisRepository extends JpaRepository<JobStructuredAnalysisEntity, Long> {

    Optional<JobStructuredAnalysisEntity> findFirstByJobIdAndUserIdOrderByUpdatedAtDesc(Long jobId, Long userId);

    void deleteByJobIdAndUserId(Long jobId, Long userId);
}
