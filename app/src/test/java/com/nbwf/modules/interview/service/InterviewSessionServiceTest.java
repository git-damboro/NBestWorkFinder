package com.nbwf.modules.interview.service;

import com.nbwf.infrastructure.redis.InterviewSessionCache;
import com.nbwf.modules.aigeneration.listener.AiGenerationStreamProducer;
import com.nbwf.modules.aigeneration.service.AiGenerationTaskService;
import com.nbwf.modules.interview.listener.EvaluateStreamProducer;
import com.nbwf.modules.interview.model.CreateInterviewRequest;
import com.nbwf.modules.interview.model.InterviewQuestionDTO;
import com.nbwf.modules.interview.model.InterviewSessionDTO;
import com.nbwf.modules.job.model.JobApplicationStatus;
import com.nbwf.modules.job.model.JobDetailDTO;
import com.nbwf.modules.job.service.JobService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.ObjectMapper;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InterviewSessionServiceTest {

    @Mock
    private InterviewQuestionService questionService;

    @Mock
    private AnswerEvaluationService evaluationService;

    @Mock
    private InterviewPersistenceService persistenceService;

    @Mock
    private InterviewSessionCache sessionCache;

    @Mock
    private ObjectMapper objectMapper;

    @Mock
    private EvaluateStreamProducer evaluateStreamProducer;

    @Mock
    private JobService jobService;

    @Mock
    private AiGenerationTaskService aiGenerationTaskService;

    @Mock
    private AiGenerationStreamProducer aiGenerationStreamProducer;

    @InjectMocks
    private InterviewSessionService interviewSessionService;

    @Test
    void createSessionShouldPassOwnedJobContextToQuestionGeneration() {
        LocalDateTime now = LocalDateTime.of(2026, 4, 18, 10, 0);
        JobDetailDTO job = new JobDetailDTO(
            31L,
            "Java 后端开发工程师",
            "示例科技",
            "负责 Spring Boot、Redis、MySQL 与高并发系统设计",
            "上海",
            18000,
            28000,
            List.of("Java", "Spring Boot", "Redis"),
            JobApplicationStatus.APPLIED,
            "重点关注系统设计",
            now,
            now
        );
        List<String> history = List.of("历史问题：请介绍 HashMap。");
        List<InterviewQuestionDTO> generatedQuestions = List.of(
            InterviewQuestionDTO.create(
                0,
                "结合目标岗位中的高并发要求，介绍你项目里的限流设计。",
                InterviewQuestionDTO.QuestionType.PROJECT,
                "职位定向 - 系统设计"
            )
        );

        when(persistenceService.getHistoricalQuestionsByResumeId(21L, 7L)).thenReturn(history);
        when(jobService.getDetail(31L, 7L)).thenReturn(job);

        ArgumentCaptor<String> jobContextCaptor = ArgumentCaptor.forClass(String.class);
        when(questionService.generateQuestions(
            eq("候选人简历文本"),
            eq(3),
            eq(history),
            jobContextCaptor.capture()
        )).thenReturn(generatedQuestions);

        InterviewSessionDTO session = interviewSessionService.createSession(
            new CreateInterviewRequest("候选人简历文本", 3, 21L, 31L, true),
            7L
        );

        assertEquals(1, session.questions().size());
        assertEquals("职位定向 - 系统设计", session.questions().get(0).category());
        assertTrue(jobContextCaptor.getValue().contains("Java 后端开发工程师"));
        assertTrue(jobContextCaptor.getValue().contains("Spring Boot、Redis、MySQL"));
        verify(jobService).getDetail(31L, 7L);
        verify(sessionCache).saveSession(
            session.sessionId(),
            7L,
            "候选人简历文本",
            21L,
            generatedQuestions,
            0,
            InterviewSessionDTO.SessionStatus.CREATED,
            31L,
            "Java 后端开发工程师",
            "示例科技"
        );
        verify(persistenceService).saveSession(
            session.sessionId(),
            21L,
            7L,
            generatedQuestions.size(),
            generatedQuestions,
            31L,
            "Java 后端开发工程师",
            "示例科技"
        );
        assertEquals(31L, session.targetJobId());
        assertEquals("Java 后端开发工程师", session.targetJobTitle());
        assertEquals("示例科技", session.targetJobCompany());
    }
}
