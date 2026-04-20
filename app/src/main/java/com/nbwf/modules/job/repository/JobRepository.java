package com.nbwf.modules.job.repository;

import com.nbwf.modules.job.model.JobApplicationStatus;
import com.nbwf.modules.job.model.JobEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface JobRepository extends JpaRepository<JobEntity, Long> {

    List<JobEntity> findByUserIdOrderByCreatedAtDesc(Long userId);

    List<JobEntity> findByUserIdAndApplicationStatusOrderByCreatedAtDesc(Long userId, JobApplicationStatus status);

    Optional<JobEntity> findByIdAndUserId(Long id, Long userId);

    boolean existsByIdAndUserId(Long id, Long userId);

    boolean existsByUserIdAndSourceFingerprint(Long userId, String sourceFingerprint);

    Optional<JobEntity> findFirstByUserIdAndSourceFingerprint(Long userId, String sourceFingerprint);
}
