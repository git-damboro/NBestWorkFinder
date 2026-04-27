package com.nbwf.modules.job.service;

import com.nbwf.common.ai.StructuredOutputInvoker;
import com.nbwf.modules.job.model.JobEntity;
import com.nbwf.modules.job.model.JobStructuredAnalysisDTO;
import com.nbwf.modules.job.model.JobStructuredAnalysisEntity;
import com.nbwf.modules.job.model.JobStructuredAnalysisResult;
import com.nbwf.modules.job.repository.JobRepository;
import com.nbwf.modules.job.repository.JobStructuredAnalysisRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.ai.chat.client.ChatClient;
import tools.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JobStructuredAnalysisServiceTest {

    @Mock
    private JobRepository jobRepository;

    @Mock
    private JobStructuredAnalysisRepository analysisRepository;

    @Mock
    private StructuredOutputInvoker structuredOutputInvoker;

    @Mock
    private ChatClient.Builder chatClientBuilder;

    @Mock
    private ChatClient chatClient;

    @Mock
    private JobApplicationWorkflowService workflowService;

    @Test
    void analyzeShouldPersistStructuredResultAndRecordWorkflowNode() {
        JobEntity job = new JobEntity();
        job.setId(10L);
        job.setUserId(7L);
        job.setTitle("AI 应用开发实习生");
        job.setCompany("示例公司");
        job.setDescription("负责 Agent 平台搭建，要求 React、Python、FastAPI，熟悉 RAG 加分。");

        JobStructuredAnalysisResult aiResult = new JobStructuredAnalysisResult(
            "AI 应用全栈开发",
            List.of("React", "Python", "FastAPI"),
            List.of("Agent", "RAG"),
            List.of("AI 应用前后端开发", "Agent 平台搭建"),
            List.of("计算机相关专业", "熟悉 React"),
            List.of("岗位 Python 和前端占比较高，Java 候选人需要突出 AI 应用落地能力"),
            "强调 AI 应用开发、Agent 平台搭建和前后端协作能力",
            "该岗位偏 AI 应用全栈开发，核心要求是 React、Python、FastAPI 和 Agent 落地能力。"
        );

        when(chatClientBuilder.build()).thenReturn(chatClient);
        when(jobRepository.findByIdAndUserId(10L, 7L)).thenReturn(Optional.of(job));
        when(structuredOutputInvoker.invoke(
            eq(chatClient),
            any(),
            any(),
            any(),
            any(),
            any(),
            eq("JobStructuredAnalysis"),
            any()
        )).thenReturn(aiResult);
        when(analysisRepository.save(any(JobStructuredAnalysisEntity.class))).thenAnswer(invocation -> {
            JobStructuredAnalysisEntity entity = invocation.getArgument(0);
            entity.setId(99L);
            return entity;
        });

        JobStructuredAnalysisService service = new JobStructuredAnalysisService(
            jobRepository,
            analysisRepository,
            structuredOutputInvoker,
            chatClientBuilder,
            workflowService,
            new ObjectMapper()
        );

        JobStructuredAnalysisDTO dto = service.analyze(10L, 7L);

        assertEquals("AI 应用全栈开发", dto.jobDirection());
        assertEquals(List.of("React", "Python", "FastAPI"), dto.requiredSkills());
        assertEquals(List.of("Agent", "RAG"), dto.preferredSkills());
        assertTrue(dto.summary().contains("Agent 落地能力"));

        ArgumentCaptor<JobStructuredAnalysisEntity> captor = ArgumentCaptor.forClass(JobStructuredAnalysisEntity.class);
        verify(analysisRepository).deleteByJobIdAndUserId(10L, 7L);
        verify(analysisRepository).save(captor.capture());
        assertEquals(10L, captor.getValue().getJobId());
        assertEquals(7L, captor.getValue().getUserId());
        assertTrue(captor.getValue().getRawResult().contains("AI 应用全栈开发"));
        verify(workflowService).recordJobStructured(eq(job), any());
    }
}
