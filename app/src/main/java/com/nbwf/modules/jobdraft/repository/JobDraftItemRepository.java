package com.nbwf.modules.jobdraft.repository;

import com.nbwf.modules.jobdraft.model.JobDraftItemEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface JobDraftItemRepository extends JpaRepository<JobDraftItemEntity, Long> {

    List<JobDraftItemEntity> findByBatchIdAndUserIdOrderByCoarseMatchScoreDescCreatedAtDesc(String batchId, Long userId);

    List<JobDraftItemEntity> findByBatchIdAndUserIdAndDraftItemIdIn(String batchId, Long userId, Collection<String> draftItemIds);

    Optional<JobDraftItemEntity> findByDraftItemIdAndUserId(String draftItemId, Long userId);
}
