package com.nbwf.modules.aigeneration.listener;

import com.nbwf.infrastructure.redis.RedisService;
import com.nbwf.modules.aigeneration.model.AiGenerationTaskType;
import com.nbwf.modules.aigeneration.service.AiGenerationTaskService;
import com.nbwf.modules.job.model.ResumeJobDraftDTO;
import com.nbwf.modules.job.service.ResumeJobDraftService;
import com.nbwf.modules.resume.model.ResumeEntity;
import com.nbwf.modules.resume.repository.ResumeRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AiGenerationStreamConsumerTest {

    @Mock
    private RedisService redisService;

    @Mock
    private AiGenerationTaskService aiGenerationTaskService;

    @Mock
    private ResumeRepository resumeRepository;

    @Mock
    private ResumeJobDraftService resumeJobDraftService;

    @Test
    void resumeJobDraftTaskShouldGenerateDraftsAndWriteResultJson() {
        AiGenerationStreamConsumer consumer = new AiGenerationStreamConsumer(
            redisService,
            aiGenerationTaskService,
            resumeRepository,
            resumeJobDraftService,
            new ObjectMapper()
        );
        AiGenerationStreamConsumer.AiGenerationPayload payload =
            new AiGenerationStreamConsumer.AiGenerationPayload(
                "agt_draft",
                7L,
                AiGenerationTaskType.RESUME_JOB_DRAFT,
                21L,
                null
            );

        ResumeEntity resume = new ResumeEntity();
        resume.setId(21L);
        resume.setUserId(7L);
        resume.setResumeText("Java / Spring Boot / Redis");

        when(resumeRepository.findByIdAndUserId(21L, 7L)).thenReturn(Optional.of(resume));
        when(resumeJobDraftService.generateDrafts("Java / Spring Boot / Redis"))
            .thenReturn(List.of(new ResumeJobDraftDTO(
                "Java 后端开发工程师",
                "偏服务端",
                "技能匹配",
                List.of("Java", "Spring Boot"),
                "默认描述",
                "默认备注"
            )));

        consumer.markProcessing(payload);
        consumer.processBusiness(payload);
        consumer.markCompleted(payload);

        ArgumentCaptor<String> resultCaptor = ArgumentCaptor.forClass(String.class);
        verify(aiGenerationTaskService).markProcessing("agt_draft", 7L);
        verify(aiGenerationTaskService).markCompleted(eq("agt_draft"), eq(7L), resultCaptor.capture());
        String resultJson = resultCaptor.getValue();
        assertTrue(resultJson.contains("\"drafts\""));
        assertTrue(resultJson.contains("Java 后端开发工程师"));
    }

    @Test
    void markFailedShouldPersistFailureStatus() {
        AiGenerationStreamConsumer consumer = new AiGenerationStreamConsumer(
            redisService,
            aiGenerationTaskService,
            resumeRepository,
            resumeJobDraftService,
            new ObjectMapper()
        );
        AiGenerationStreamConsumer.AiGenerationPayload payload =
            new AiGenerationStreamConsumer.AiGenerationPayload(
                "agt_draft",
                7L,
                AiGenerationTaskType.RESUME_JOB_DRAFT,
                21L,
                null
            );

        consumer.markFailed(payload, "失败");

        verify(aiGenerationTaskService).markFailed("agt_draft", 7L, "失败");
    }
}
