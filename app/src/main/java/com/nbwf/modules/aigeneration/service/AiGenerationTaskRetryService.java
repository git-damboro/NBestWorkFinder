package com.nbwf.modules.aigeneration.service;

import com.nbwf.common.exception.BusinessException;
import com.nbwf.common.exception.ErrorCode;
import com.nbwf.common.model.AsyncTaskStatus;
import com.nbwf.modules.aigeneration.listener.AiGenerationStreamProducer;
import com.nbwf.modules.aigeneration.model.AiGenerationTaskDTO;
import com.nbwf.modules.aigeneration.model.AiGenerationTaskEntity;
import com.nbwf.modules.job.model.JobDetailSyncRequest;
import com.nbwf.modules.job.service.JobService;
import com.nbwf.modules.jobdraft.model.CreateDraftBatchFromPageSyncRequest;
import com.nbwf.modules.jobdraft.model.JobDraftDetailSyncRequest;
import com.nbwf.modules.jobdraft.service.JobDraftService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * 统一任务重试编排服务。
 * 异步 AI 任务重新投递到 Redis Stream，同步型职位任务则读取原始 requestJson 直接回放业务逻辑。
 */
@Service
@RequiredArgsConstructor
public class AiGenerationTaskRetryService {

    private static final String TARGET_KIND_DRAFT = "DRAFT";
    private static final String TARGET_KIND_JOB = "JOB";

    private final AiGenerationTaskService aiGenerationTaskService;
    private final AiGenerationStreamProducer aiGenerationStreamProducer;
    private final JobDraftService jobDraftService;
    private final JobService jobService;
    private final ObjectMapper objectMapper;

    public AiGenerationTaskDTO retry(String taskId, Long userId) {
        AiGenerationTaskEntity task = aiGenerationTaskService.getTaskEntity(taskId, userId);
        if (task.getStatus() != AsyncTaskStatus.FAILED) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "只有失败任务可以重试");
        }

        aiGenerationTaskService.resetForRetry(taskId, userId);
        AiGenerationTaskEntity resetTask = aiGenerationTaskService.getTaskEntity(taskId, userId);

        switch (resetTask.getType()) {
            case RESUME_JOB_DRAFT, INTERVIEW_SESSION_CREATE -> aiGenerationStreamProducer.sendTask(resetTask);
            case JOB_DRAFT_PAGE_SYNC -> retryPageSync(resetTask);
            case JOB_DRAFT_DETAIL_SYNC -> retryDetailSync(resetTask);
        }

        return aiGenerationTaskService.getTask(taskId, userId);
    }

    private void retryPageSync(AiGenerationTaskEntity task) {
        JsonNode root = readTaskRequest(task);
        CreateDraftBatchFromPageSyncRequest request =
            readRequest(root, CreateDraftBatchFromPageSyncRequest.class);
        jobDraftService.retryPageSyncTask(task, request);
    }

    private void retryDetailSync(AiGenerationTaskEntity task) {
        JsonNode root = readTaskRequest(task);
        String targetKind = readRequiredText(root, "targetKind");
        if (TARGET_KIND_DRAFT.equals(targetKind)) {
            String draftItemId = readRequiredText(root, "draftItemId");
            JobDraftDetailSyncRequest request = readRequest(root, JobDraftDetailSyncRequest.class);
            jobDraftService.retryItemDetailSyncTask(task, draftItemId, request);
            return;
        }
        if (TARGET_KIND_JOB.equals(targetKind)) {
            long jobId = readRequiredLong(root, "jobId");
            JobDetailSyncRequest request = readRequest(root, JobDetailSyncRequest.class);
            jobService.retryDetailSyncTask(task, jobId, request);
            return;
        }
        throw new BusinessException(ErrorCode.BAD_REQUEST, "无法识别的详情补全任务类型");
    }

    private JsonNode readTaskRequest(AiGenerationTaskEntity task) {
        try {
            return objectMapper.readTree(task.getRequestJson());
        } catch (JacksonException e) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "任务请求数据解析失败");
        }
    }

    private <T> T readRequest(JsonNode root, Class<T> type) {
        JsonNode requestNode = root.get("request");
        if (requestNode == null || requestNode.isNull()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "任务请求缺少 request 字段");
        }
        try {
            return objectMapper.treeToValue(requestNode, type);
        } catch (JacksonException e) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "任务请求数据解析失败");
        }
    }

    private String readRequiredText(JsonNode root, String fieldName) {
        JsonNode value = root.get(fieldName);
        if (value == null || value.isNull() || value.asText().isBlank()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "任务请求缺少 " + fieldName);
        }
        return value.asText();
    }

    private long readRequiredLong(JsonNode root, String fieldName) {
        JsonNode value = root.get(fieldName);
        if (value == null || !value.canConvertToLong()) {
            throw new BusinessException(ErrorCode.BAD_REQUEST, "任务请求缺少 " + fieldName);
        }
        return value.asLong();
    }
}
