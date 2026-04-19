package com.nbwf.modules.aigeneration.service;

import com.nbwf.common.exception.BusinessException;
import com.nbwf.common.exception.ErrorCode;
import com.nbwf.common.model.AsyncTaskStatus;
import com.nbwf.modules.aigeneration.model.AiGenerationTaskDTO;
import com.nbwf.modules.aigeneration.model.AiGenerationTaskEntity;
import com.nbwf.modules.aigeneration.model.AiGenerationTaskType;
import com.nbwf.modules.aigeneration.repository.AiGenerationTaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;

/**
 * 通用 AI 生成任务服务。
 * 负责任务创建、复用以及查询，供后续职位草稿与面试题生成复用。
 */
@Service
@RequiredArgsConstructor
public class AiGenerationTaskService {

    private static final List<AsyncTaskStatus> RUNNING_STATUSES = List.of(
        AsyncTaskStatus.PENDING,
        AsyncTaskStatus.PROCESSING
    );

    private final AiGenerationTaskRepository aiGenerationTaskRepository;
    private final ConcurrentHashMap<String, ReentrantLock> taskCreationLocks = new ConcurrentHashMap<>();

    /**
     * 创建任务或复用同类运行中任务，避免短时间重复生成。
     * 这里按任务业务键加本地锁，避免同一应用实例内并发请求重复创建运行中任务。
     */
    @Transactional
    public AiGenerationTaskEntity createOrReuseTask(Long userId,
                                                    AiGenerationTaskType type,
                                                    Long sourceId,
                                                    Long targetId,
                                                    String requestJson) {
        String lockKey = buildLockKey(userId, type, sourceId, targetId);
        ReentrantLock lock = taskCreationLocks.computeIfAbsent(lockKey, key -> new ReentrantLock());
        lock.lock();
        try {
            return aiGenerationTaskRepository
                .findFirstByUserIdAndTypeAndSourceIdAndTargetIdAndStatusInOrderByCreatedAtDesc(
                    userId,
                    type,
                    sourceId,
                    targetId,
                    RUNNING_STATUSES
                )
                .orElseGet(() -> aiGenerationTaskRepository.save(buildPendingTask(
                    userId,
                    type,
                    sourceId,
                    targetId,
                    requestJson
                )));
        } finally {
            lock.unlock();
            if (!lock.hasQueuedThreads()) {
                taskCreationLocks.remove(lockKey, lock);
            }
        }
    }

    /**
     * 查询当前用户下的单个任务。
     */
    @Transactional(readOnly = true)
    public AiGenerationTaskDTO getTask(String taskId, Long userId) {
        return toDTO(aiGenerationTaskRepository.findByTaskIdAndUserId(taskId, userId)
            .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "AI 生成任务不存在")));
    }

    /**
     * 查询指定来源最近一条任务；若不存在则返回 null，便于前端静默恢复。
     */
    @Transactional(readOnly = true)
    public AiGenerationTaskDTO getLatestTask(Long userId,
                                             AiGenerationTaskType type,
                                             Long sourceId) {
        return aiGenerationTaskRepository
            .findFirstByUserIdAndTypeAndSourceIdOrderByCreatedAtDesc(userId, type, sourceId)
            .map(this::toDTO)
            .orElse(null);
    }

    /**
     * 将实体映射为对外 DTO，统一对前端暴露字段。
     */
    public AiGenerationTaskDTO toDTO(AiGenerationTaskEntity entity) {
        return new AiGenerationTaskDTO(
            entity.getTaskId(),
            entity.getType(),
            entity.getSourceId(),
            entity.getTargetId(),
            entity.getStatus(),
            entity.getResultJson(),
            entity.getErrorMessage(),
            entity.getCreatedAt(),
            entity.getUpdatedAt(),
            entity.getCompletedAt()
        );
    }

    private AiGenerationTaskEntity buildPendingTask(Long userId,
                                                    AiGenerationTaskType type,
                                                    Long sourceId,
                                                    Long targetId,
                                                    String requestJson) {
        AiGenerationTaskEntity task = new AiGenerationTaskEntity();
        task.setTaskId(generateTaskId());
        task.setUserId(userId);
        task.setType(type);
        task.setSourceId(sourceId);
        task.setTargetId(targetId);
        task.setStatus(AsyncTaskStatus.PENDING);
        task.setRequestJson(requestJson);
        return task;
    }

    private String generateTaskId() {
        return "agt_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }

    private String buildLockKey(Long userId,
                                AiGenerationTaskType type,
                                Long sourceId,
                                Long targetId) {
        return userId + ":" + type + ":" + sourceId + ":" + String.valueOf(targetId);
    }
}
