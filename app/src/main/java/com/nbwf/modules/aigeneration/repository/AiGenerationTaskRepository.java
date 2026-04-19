package com.nbwf.modules.aigeneration.repository;

import com.nbwf.common.model.AsyncTaskStatus;
import com.nbwf.modules.aigeneration.model.AiGenerationTaskEntity;
import com.nbwf.modules.aigeneration.model.AiGenerationTaskType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * 通用 AI 生成任务仓库。
 */
@Repository
public interface AiGenerationTaskRepository extends JpaRepository<AiGenerationTaskEntity, Long> {

    /**
     * 按任务 ID 和用户范围查询单个任务。
     */
    Optional<AiGenerationTaskEntity> findByTaskIdAndUserId(String taskId, Long userId);

    /**
     * 查询同用户、同类型、同来源、同目标下最近一条运行中任务。
     */
    Optional<AiGenerationTaskEntity> findFirstByUserIdAndTypeAndSourceIdAndTargetIdAndStatusInOrderByCreatedAtDesc(
        Long userId,
        AiGenerationTaskType type,
        Long sourceId,
        Long targetId,
        List<AsyncTaskStatus> statuses
    );

    /**
     * 查询指定来源最近一条任务，用于页面自动恢复。
     */
    Optional<AiGenerationTaskEntity> findFirstByUserIdAndTypeAndSourceIdOrderByCreatedAtDesc(
        Long userId,
        AiGenerationTaskType type,
        Long sourceId
    );
}
