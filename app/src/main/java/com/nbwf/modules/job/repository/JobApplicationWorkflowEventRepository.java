package com.nbwf.modules.job.repository;

import com.nbwf.modules.job.model.JobApplicationWorkflowEventEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface JobApplicationWorkflowEventRepository extends JpaRepository<JobApplicationWorkflowEventEntity, Long> {

    List<JobApplicationWorkflowEventEntity> findByWorkflowIdOrderByCreatedAtDesc(Long workflowId);

    void deleteByJobIdAndUserId(Long jobId, Long userId);
}
