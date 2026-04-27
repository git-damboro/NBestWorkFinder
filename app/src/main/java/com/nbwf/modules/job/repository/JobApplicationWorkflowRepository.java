package com.nbwf.modules.job.repository;

import com.nbwf.modules.job.model.JobApplicationWorkflowEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface JobApplicationWorkflowRepository extends JpaRepository<JobApplicationWorkflowEntity, Long> {

    Optional<JobApplicationWorkflowEntity> findByJobIdAndUserId(Long jobId, Long userId);

    void deleteByJobIdAndUserId(Long jobId, Long userId);
}
