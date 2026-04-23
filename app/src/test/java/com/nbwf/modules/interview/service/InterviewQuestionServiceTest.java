package com.nbwf.modules.interview.service;

import com.nbwf.common.ai.StructuredOutputInvoker;
import com.nbwf.common.exception.ErrorCode;
import com.nbwf.modules.interview.model.InterviewQuestionDTO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.slf4j.Logger;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.converter.BeanOutputConverter;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;

import java.lang.reflect.Constructor;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InterviewQuestionServiceTest {

    @Mock
    private ChatClient.Builder chatClientBuilder;

    @Mock
    private ChatClient chatClient;

    @BeforeEach
    void setUp() {
        when(chatClientBuilder.build()).thenReturn(chatClient);
    }

    @Test
    void generateQuestionsShouldRespectRequestedTotalWhenAiReturnsFollowUps() throws Exception {
        InterviewQuestionService service = newService(new FixedResponseInvoker(questionListWithFollowUps(6, 1)), 1);

        List<InterviewQuestionDTO> questions = service.generateQuestions("resume text", 6, List.of(), null);

        assertEquals(6, questions.size());
        assertEquals(
            List.of(0, 1, 2, 3, 4, 5),
            questions.stream().map(InterviewQuestionDTO::questionIndex).toList()
        );
        assertTrue(questions.stream().anyMatch(InterviewQuestionDTO::isFollowUp));
    }

    @Test
    void generateQuestionsShouldLimitDefaultFallbackToRequestedTotal() throws Exception {
        InterviewQuestionService service = newService(new FailingInvoker(), 1);

        List<InterviewQuestionDTO> questions = service.generateQuestions("resume text", 6, List.of(), null);

        assertEquals(6, questions.size());
        assertEquals(
            List.of(0, 1, 2, 3, 4, 5),
            questions.stream().map(InterviewQuestionDTO::questionIndex).toList()
        );
        assertTrue(questions.stream().anyMatch(InterviewQuestionDTO::isFollowUp));
    }

    private InterviewQuestionService newService(StructuredOutputInvoker invoker, int followUpCount) throws Exception {
        Resource systemPrompt = new ByteArrayResource("system".getBytes(StandardCharsets.UTF_8));
        Resource userPrompt = new ByteArrayResource("{resumeText}".getBytes(StandardCharsets.UTF_8));
        return new InterviewQuestionService(chatClientBuilder, invoker, systemPrompt, userPrompt, followUpCount);
    }

    private Object questionListWithFollowUps(int mainCount, int followUpPerQuestion) throws Exception {
        Class<?> questionDtoClass = Class.forName(
            "com.nbwf.modules.interview.service.InterviewQuestionService$QuestionDTO"
        );
        Constructor<?> questionDtoConstructor = questionDtoClass.getDeclaredConstructor(
            String.class,
            String.class,
            String.class,
            List.class
        );
        questionDtoConstructor.setAccessible(true);

        List<Object> questionDtos = new ArrayList<>();
        for (int index = 0; index < mainCount; index++) {
            int questionIndex = index;
            List<String> followUps = IntStream.range(0, followUpPerQuestion)
                .mapToObj(followUpIndex -> "Follow-up " + questionIndex + "-" + followUpIndex)
                .toList();
            questionDtos.add(questionDtoConstructor.newInstance(
                "Question " + questionIndex,
                "PROJECT",
                "Project",
                followUps
            ));
        }

        Class<?> questionListDtoClass = Class.forName(
            "com.nbwf.modules.interview.service.InterviewQuestionService$QuestionListDTO"
        );
        Constructor<?> questionListDtoConstructor = questionListDtoClass.getDeclaredConstructor(List.class);
        questionListDtoConstructor.setAccessible(true);
        return questionListDtoConstructor.newInstance(questionDtos);
    }

    private static class FixedResponseInvoker extends StructuredOutputInvoker {
        private final Object response;

        FixedResponseInvoker(Object response) {
            super(1, false);
            this.response = response;
        }

        @Override
        @SuppressWarnings("unchecked")
        public <T> T invoke(
            ChatClient chatClient,
            String systemPromptWithFormat,
            String userPrompt,
            BeanOutputConverter<T> outputConverter,
            ErrorCode errorCode,
            String errorPrefix,
            String logContext,
            Logger log
        ) {
            return (T) response;
        }
    }

    private static class FailingInvoker extends StructuredOutputInvoker {
        FailingInvoker() {
            super(1, false);
        }

        @Override
        public <T> T invoke(
            ChatClient chatClient,
            String systemPromptWithFormat,
            String userPrompt,
            BeanOutputConverter<T> outputConverter,
            ErrorCode errorCode,
            String errorPrefix,
            String logContext,
            Logger log
        ) {
            throw new IllegalStateException("AI unavailable");
        }
    }
}
