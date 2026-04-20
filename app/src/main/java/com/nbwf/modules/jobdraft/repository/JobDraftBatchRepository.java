package com.nbwf.modules.jobdraft.repository;

import com.nbwf.modules.jobdraft.model.JobDraftBatchEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface JobDraftBatchRepository extends JpaRepository<JobDraftBatchEntity, Long> {

    Optional<JobDraftBatchEntity> findByBatchIdAndUserId(String batchId, Long userId);

    Optional<JobDraftBatchEntity> findFirstByUserIdOrderByUpdatedAtDesc(Long userId);
}
