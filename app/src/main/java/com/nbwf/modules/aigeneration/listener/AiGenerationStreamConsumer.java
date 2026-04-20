package com.nbwf.modules.aigeneration.listener;

import com.nbwf.common.async.AbstractStreamConsumer;
import com.nbwf.common.constant.AsyncTaskStreamConstants;
import com.nbwf.common.exception.BusinessException;
import com.nbwf.common.exception.ErrorCode;
import com.nbwf.infrastructure.redis.RedisService;
import com.nbwf.modules.aigeneration.model.AiGenerationTaskEntity;
import com.nbwf.modules.aigeneration.model.AiGenerationTaskType;
import com.nbwf.modules.aigeneration.service.AiGenerationTaskService;
import com.nbwf.modules.interview.model.CreateInterviewRequest;
import com.nbwf.modules.interview.model.InterviewSessionDTO;
import com.nbwf.modules.interview.service.InterviewSessionService;
import com.nbwf.modules.job.model.ResumeJobDraftDTO;
import com.nbwf.modules.job.service.ResumeJobDraftService;
import com.nbwf.modules.resume.model.ResumeEntity;
import com.nbwf.modules.resume.repository.ResumeRepository;
import lombok.extern.slf4j.Slf4j;
import org.redisson.api.stream.StreamMessageId;
import org.springframework.stereotype.Component;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 通用 AI 生成任务消费者。
 * 当前先处理“根据简历生成职位草稿”，后续面试题生成会接入同一个 Stream。
 */
@Slf4j
@Component
public class AiGenerationStreamConsumer extends AbstractStreamConsumer<AiGenerationStreamConsumer.AiGenerationPayload> {

    private final AiGenerationTaskService aiGenerationTaskService;
    private final ResumeRepository resumeRepository;
    private final ResumeJobDraftService resumeJobDraftService;
    private final InterviewSessionService interviewSessionService;
    private final ObjectMapper objectMapper;

    public AiGenerationStreamConsumer(RedisService redisService,
                                      AiGenerationTaskService aiGenerationTaskService,
                                      ResumeRepository resumeRepository,
                                      ResumeJobDraftService resumeJobDraftService,
                                      InterviewSessionService interviewSessionService,
                                      ObjectMapper objectMapper) {
        super(redisService);
        this.aiGenerationTaskService = aiGenerationTaskService;
        this.resumeRepository = resumeRepository;
        this.resumeJobDraftService = resumeJobDraftService;
        this.interviewSessionService = interviewSessionService;
        this.objectMapper = objectMapper;
    }

    static class AiGenerationPayload {
        private final String taskId;
        private final Long userId;
        private final AiGenerationTaskType type;
        private final Long sourceId;
        private final Long targetId;
        private String resultJson;

        AiGenerationPayload(String taskId,
                            Long userId,
                            AiGenerationTaskType type,
                            Long sourceId,
                            Long targetId) {
            this.taskId = taskId;
            this.userId = userId;
            this.type = type;
            this.sourceId = sourceId;
            this.targetId = targetId;
        }
    }

    @Override
    protected String taskDisplayName() {
        return "AI生成";
    }

    @Override
    protected String streamKey() {
        return AsyncTaskStreamConstants.AI_GENERATION_STREAM_KEY;
    }

    @Override
    protected String groupName() {
        return AsyncTaskStreamConstants.AI_GENERATION_GROUP_NAME;
    }

    @Override
    protected String consumerPrefix() {
        return AsyncTaskStreamConstants.AI_GENERATION_CONSUMER_PREFIX;
    }

    @Override
    protected String threadName() {
        return "ai-generation-consumer";
    }

    @Override
    protected AiGenerationPayload parsePayload(StreamMessageId messageId, Map<String, String> data) {
        try {
            String taskId = data.get(AsyncTaskStreamConstants.FIELD_TASK_ID);
            String userId = data.get(AsyncTaskStreamConstants.FIELD_USER_ID);
            String taskType = data.get(AsyncTaskStreamConstants.FIELD_TASK_TYPE);
            String sourceId = data.get(AsyncTaskStreamConstants.FIELD_SOURCE_ID);
            if (taskId == null || userId == null || taskType == null || sourceId == null) {
                log.warn("AI生成任务消息格式错误，跳过: messageId={}", messageId);
                return null;
            }
            String targetId = data.get(AsyncTaskStreamConstants.FIELD_TARGET_ID);
            return new AiGenerationPayload(
                taskId,
                Long.parseLong(userId),
                AiGenerationTaskType.valueOf(taskType),
                Long.parseLong(sourceId),
                targetId == null ? null : Long.parseLong(targetId)
            );
        } catch (RuntimeException e) {
            log.warn("AI生成任务消息解析失败，跳过: messageId={}, error={}", messageId, e.getMessage());
            return null;
        }
    }

    @Override
    protected String payloadIdentifier(AiGenerationPayload payload) {
        return "taskId=" + payload.taskId + ", type=" + payload.type;
    }

    @Override
    protected void markProcessing(AiGenerationPayload payload) {
        aiGenerationTaskService.markProcessing(payload.taskId, payload.userId);
    }

    @Override
    protected void processBusiness(AiGenerationPayload payload) {
        switch (payload.type) {
            case RESUME_JOB_DRAFT -> processResumeJobDraft(payload);
            case INTERVIEW_SESSION_CREATE -> processInterviewSessionCreate(payload);
            case JOB_DRAFT_PAGE_SYNC, JOB_DRAFT_DETAIL_SYNC ->
                throw new BusinessException(ErrorCode.BAD_REQUEST, "该任务类型不支持 AI Stream 消费");
        }
    }

    @Override
    protected void markCompleted(AiGenerationPayload payload) {
        aiGenerationTaskService.markCompleted(payload.taskId, payload.userId, payload.resultJson);
    }

    @Override
    protected void markFailed(AiGenerationPayload payload, String error) {
        aiGenerationTaskService.markFailed(payload.taskId, payload.userId, error);
    }

    @Override
    protected void retryMessage(AiGenerationPayload payload, int retryCount) {
        try {
            Map<String, String> message = new HashMap<>();
            message.put(AsyncTaskStreamConstants.FIELD_TASK_ID, payload.taskId);
            message.put(AsyncTaskStreamConstants.FIELD_USER_ID, payload.userId.toString());
            message.put(AsyncTaskStreamConstants.FIELD_TASK_TYPE, payload.type.name());
            message.put(AsyncTaskStreamConstants.FIELD_SOURCE_ID, payload.sourceId.toString());
            if (payload.targetId != null) {
                message.put(AsyncTaskStreamConstants.FIELD_TARGET_ID, payload.targetId.toString());
            }
            message.put(AsyncTaskStreamConstants.FIELD_RETRY_COUNT, String.valueOf(retryCount));

            redisService().streamAdd(
                AsyncTaskStreamConstants.AI_GENERATION_STREAM_KEY,
                message,
                AsyncTaskStreamConstants.STREAM_MAX_LEN
            );
            log.info("AI生成任务已重新入队: taskId={}, retryCount={}", payload.taskId, retryCount);
        } catch (Exception e) {
            log.error("AI生成任务重试入队失败: taskId={}, error={}", payload.taskId, e.getMessage(), e);
            aiGenerationTaskService.markFailed(payload.taskId, payload.userId,
                truncateError("重试入队失败: " + e.getMessage()));
        }
    }

    private void processResumeJobDraft(AiGenerationPayload payload) {
        ResumeEntity resume = resumeRepository.findByIdAndUserId(payload.sourceId, payload.userId)
            .orElseThrow(() -> new BusinessException(ErrorCode.RESUME_NOT_FOUND));
        if (resume.getResumeText() == null || resume.getResumeText().isBlank()) {
            throw new BusinessException(ErrorCode.RESUME_PARSE_FAILED, "当前简历内容为空，无法生成职位草稿");
        }

        List<ResumeJobDraftDTO> drafts = resumeJobDraftService.generateDrafts(resume.getResumeText());
        try {
            payload.resultJson = objectMapper.writeValueAsString(Map.of("drafts", drafts));
        } catch (JacksonException e) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "序列化职位草稿结果失败");
        }
    }

    private void processInterviewSessionCreate(AiGenerationPayload payload) {
        AiGenerationTaskEntity task = aiGenerationTaskService.getTaskEntity(payload.taskId, payload.userId);
        try {
            CreateInterviewRequest request = objectMapper.readValue(task.getRequestJson(), CreateInterviewRequest.class);
            InterviewSessionDTO session = interviewSessionService.createSession(request, payload.userId);
            payload.resultJson = objectMapper.writeValueAsString(Map.of("sessionId", session.sessionId()));
        } catch (JacksonException e) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "序列化面试任务数据失败");
        }
    }
}
