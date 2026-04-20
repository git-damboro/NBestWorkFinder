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
import java.time.LocalDateTime;

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

    public record TaskCreationResult(AiGenerationTaskEntity task, boolean reused) {
    }

    /**
     * 创建一个新的任务记录。
     * 同步型任务每次用户触发都需要独立记录，不能复用运行中任务，否则接口无法稳定返回本次结果。
     */
    @Transactional
    public AiGenerationTaskEntity createTask(Long userId,
                                             AiGenerationTaskType type,
                                             Long sourceId,
                                             Long targetId,
                                             String requestJson) {
        return aiGenerationTaskRepository.save(buildPendingTask(userId, type, sourceId, targetId, requestJson));
    }

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
        return createOrReuseTaskResult(userId, type, sourceId, targetId, requestJson).task();
    }

    /**
     * 创建任务或复用同类运行中任务，并返回是否复用，便于调用方只对新任务入队一次。
     */
    @Transactional
    public TaskCreationResult createOrReuseTaskResult(Long userId,
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
                .map(task -> new TaskCreationResult(task, true))
                .orElseGet(() -> new TaskCreationResult(aiGenerationTaskRepository.save(buildPendingTask(
                    userId,
                    type,
                    sourceId,
                    targetId,
                    requestJson
                )), false));
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
     * 仅供后台消费者读取完整任务实体，避免 requestJson 对外暴露。
     */
    @Transactional(readOnly = true)
    public AiGenerationTaskEntity getTaskEntity(String taskId, Long userId) {
        return findTaskOrThrow(taskId, userId);
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
     * 查询当前用户最近任务列表（V1 固定最近 50 条）。
     */
    @Transactional(readOnly = true)
    public List<AiGenerationTaskDTO> listRecentTasks(Long userId) {
        return aiGenerationTaskRepository.findTop50ByUserIdOrderByCreatedAtDesc(userId)
            .stream()
            .map(this::toDTO)
            .toList();
    }

    /**
     * 标记任务进入后台处理中。
     */
    @Transactional
    public void markProcessing(String taskId, Long userId) {
        AiGenerationTaskEntity task = findTaskOrThrow(taskId, userId);
        task.setStatus(AsyncTaskStatus.PROCESSING);
        task.setErrorMessage(null);
        aiGenerationTaskRepository.save(task);
    }

    /**
     * 标记任务完成，并写入可被前端恢复的结果 JSON。
     */
    @Transactional
    public void markCompleted(String taskId, Long userId, String resultJson) {
        AiGenerationTaskEntity task = findTaskOrThrow(taskId, userId);
        task.setStatus(AsyncTaskStatus.COMPLETED);
        task.setResultJson(resultJson);
        task.setErrorMessage(null);
        task.setCompletedAt(LocalDateTime.now());
        aiGenerationTaskRepository.save(task);
    }

    /**
     * 标记任务失败，保留简短错误信息给前端展示。
     */
    @Transactional
    public void markFailed(String taskId, Long userId, String errorMessage) {
        AiGenerationTaskEntity task = findTaskOrThrow(taskId, userId);
        task.setStatus(AsyncTaskStatus.FAILED);
        task.setErrorMessage(errorMessage);
        task.setCompletedAt(LocalDateTime.now());
        aiGenerationTaskRepository.save(task);
    }

    /**
     * 重置任务以便重试（基础能力，不做额外重试规则控制）。
     */
    @Transactional
    public AiGenerationTaskDTO resetForRetry(String taskId, Long userId) {
        AiGenerationTaskEntity task = findTaskOrThrow(taskId, userId);
        task.setStatus(AsyncTaskStatus.PENDING);
        task.setResultJson(null);
        task.setErrorMessage(null);
        task.setCompletedAt(null);
        return toDTO(aiGenerationTaskRepository.save(task));
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

    private AiGenerationTaskEntity findTaskOrThrow(String taskId, Long userId) {
        return aiGenerationTaskRepository.findByTaskIdAndUserId(taskId, userId)
            .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "AI 生成任务不存在"));
    }

    private String buildLockKey(Long userId,
                                AiGenerationTaskType type,
                                Long sourceId,
                                Long targetId) {
        return userId + ":" + type + ":" + sourceId + ":" + String.valueOf(targetId);
    }
}
