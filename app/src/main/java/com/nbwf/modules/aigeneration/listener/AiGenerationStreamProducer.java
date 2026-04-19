package com.nbwf.modules.aigeneration.listener;

import com.nbwf.common.async.AbstractStreamProducer;
import com.nbwf.common.constant.AsyncTaskStreamConstants;
import com.nbwf.infrastructure.redis.RedisService;
import com.nbwf.modules.aigeneration.model.AiGenerationTaskEntity;
import com.nbwf.modules.aigeneration.service.AiGenerationTaskService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

/**
 * 通用 AI 生成任务生产者。
 * 负责把已持久化的任务投递到 Redis Stream，让页面切换后任务仍可在后台执行。
 */
@Slf4j
@Component
public class AiGenerationStreamProducer extends AbstractStreamProducer<AiGenerationTaskEntity> {

    private final AiGenerationTaskService aiGenerationTaskService;

    public AiGenerationStreamProducer(RedisService redisService,
                                      AiGenerationTaskService aiGenerationTaskService) {
        super(redisService);
        this.aiGenerationTaskService = aiGenerationTaskService;
    }

    /**
     * 将 AI 生成任务入队。
     */
    public void sendTask(AiGenerationTaskEntity task) {
        super.sendTask(task);
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
    protected Map<String, String> buildMessage(AiGenerationTaskEntity payload) {
        Map<String, String> message = new HashMap<>();
        message.put(AsyncTaskStreamConstants.FIELD_TASK_ID, payload.getTaskId());
        message.put(AsyncTaskStreamConstants.FIELD_USER_ID, payload.getUserId().toString());
        message.put(AsyncTaskStreamConstants.FIELD_TASK_TYPE, payload.getType().name());
        message.put(AsyncTaskStreamConstants.FIELD_SOURCE_ID, payload.getSourceId().toString());
        if (payload.getTargetId() != null) {
            message.put(AsyncTaskStreamConstants.FIELD_TARGET_ID, payload.getTargetId().toString());
        }
        message.put(AsyncTaskStreamConstants.FIELD_RETRY_COUNT, "0");
        return message;
    }

    @Override
    protected String payloadIdentifier(AiGenerationTaskEntity payload) {
        return "taskId=" + payload.getTaskId() + ", type=" + payload.getType();
    }

    @Override
    protected void onSendFailed(AiGenerationTaskEntity payload, String error) {
        aiGenerationTaskService.markFailed(payload.getTaskId(), payload.getUserId(), truncateError(error));
    }
}
