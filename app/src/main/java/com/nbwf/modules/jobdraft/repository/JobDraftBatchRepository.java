package com.nbwf.modules.jobdraft.repository;

import com.nbwf.modules.jobdraft.model.JobDraftBatchEntity;
import com.nbwf.modules.jobdraft.model.JobDraftBatchStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.Optional;

public interface JobDraftBatchRepository extends JpaRepository<JobDraftBatchEntity, Long> {

    Optional<JobDraftBatchEntity> findByBatchIdAndUserId(String batchId, Long userId);

    Optional<JobDraftBatchEntity> findFirstByUserIdOrderByUpdatedAtDesc(Long userId);

    @Query("""
        select b
        from JobDraftBatchEntity b
        where b.userId = :userId
          and b.status in :statuses
          and (b.expiresAt is null or b.expiresAt > :now)
        order by b.updatedAt desc
        """)
    Optional<JobDraftBatchEntity> findLatestRecoverableBatch(
        @Param("userId") Long userId,
        @Param("statuses") Collection<JobDraftBatchStatus> statuses,
        @Param("now") LocalDateTime now
    );
}
