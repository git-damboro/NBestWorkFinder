package com.nbwf.modules.interview.service;

import com.nbwf.modules.interview.model.InterviewQuestionDTO;
import com.nbwf.modules.interview.model.InterviewSessionEntity;
import com.nbwf.modules.interview.repository.InterviewAnswerRepository;
import com.nbwf.modules.interview.repository.InterviewSessionRepository;
import com.nbwf.modules.resume.model.ResumeEntity;
import com.nbwf.modules.resume.repository.ResumeRepository;
import com.nbwf.infrastructure.redis.InterviewSessionCache;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import tools.jackson.databind.ObjectMapper;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InterviewPersistenceServiceTest {

    @Mock
    private InterviewSessionRepository sessionRepository;

    @Mock
    private InterviewAnswerRepository answerRepository;

    @Mock
    private ResumeRepository resumeRepository;

    @Mock
    private ObjectMapper objectMapper;

    @Mock
    private InterviewSessionCache interviewSessionCache;

    @InjectMocks
    private InterviewPersistenceService interviewPersistenceService;

    @Test
    void saveSessionShouldBindSessionToCurrentUserAndOwnedResume() throws Exception {
        ResumeEntity resume = new ResumeEntity();
        resume.setId(21L);
        resume.setUserId(7L);

        when(resumeRepository.findByIdAndUserId(21L, 7L)).thenReturn(Optional.of(resume));
        when(objectMapper.writeValueAsString(any())).thenReturn("[]");
        when(sessionRepository.save(any(InterviewSessionEntity.class))).thenAnswer(invocation -> invocation.getArgument(0));

        interviewPersistenceService.saveSession(
            "session-1",
            21L,
            7L,
            3,
            List.of(InterviewQuestionDTO.create(
                0,
                "Q1",
                InterviewQuestionDTO.QuestionType.JAVA_BASIC,
                "Java"
            ))
        );

        ArgumentCaptor<InterviewSessionEntity> captor = ArgumentCaptor.forClass(InterviewSessionEntity.class);
        verify(sessionRepository).save(captor.capture());

        assertEquals(7L, captor.getValue().getUserId());
        assertEquals(21L, captor.getValue().getResume().getId());
        verify(resumeRepository).findByIdAndUserId(21L, 7L);
    }
}
