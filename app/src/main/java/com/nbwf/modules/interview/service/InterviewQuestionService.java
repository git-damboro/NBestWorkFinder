package com.nbwf.modules.interview.service;

import com.nbwf.common.ai.StructuredOutputInvoker;
import com.nbwf.common.exception.BusinessException;
import com.nbwf.common.exception.ErrorCode;
import com.nbwf.modules.interview.model.InterviewQuestionDTO;
import com.nbwf.modules.interview.model.InterviewQuestionDTO.QuestionType;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.converter.BeanOutputConverter;
import org.springframework.ai.chat.prompt.PromptTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 面试问题生成服务。
 */
@Service
public class InterviewQuestionService {

    private static final Logger log = LoggerFactory.getLogger(InterviewQuestionService.class);

    private static final double PROJECT_RATIO = 0.20;
    private static final double MYSQL_RATIO = 0.20;
    private static final double REDIS_RATIO = 0.20;
    private static final double JAVA_BASIC_RATIO = 0.10;
    private static final double JAVA_COLLECTION_RATIO = 0.10;
    private static final double JAVA_CONCURRENT_RATIO = 0.10;
    private static final int MAX_FOLLOW_UP_COUNT = 2;

    private final ChatClient chatClient;
    private final PromptTemplate systemPromptTemplate;
    private final PromptTemplate userPromptTemplate;
    private final BeanOutputConverter<QuestionListDTO> outputConverter;
    private final StructuredOutputInvoker structuredOutputInvoker;
    private final int followUpCount;

    private record QuestionListDTO(List<QuestionDTO> questions) {
    }

    private record QuestionDTO(
        String question,
        String type,
        String category,
        List<String> followUps
    ) {
    }

    private record QuestionDistribution(
        int project,
        int mysql,
        int redis,
        int javaBasic,
        int javaCollection,
        int javaConcurrent,
        int spring
    ) {
    }

    public InterviewQuestionService(
        ChatClient.Builder chatClientBuilder,
        StructuredOutputInvoker structuredOutputInvoker,
        @Value("classpath:prompts/interview-question-system.st") Resource systemPromptResource,
        @Value("classpath:prompts/interview-question-user.st") Resource userPromptResource,
        @Value("${app.interview.follow-up-count:1}") int followUpCount
    ) throws IOException {
        this.chatClient = chatClientBuilder.build();
        this.structuredOutputInvoker = structuredOutputInvoker;
        this.systemPromptTemplate = new PromptTemplate(systemPromptResource.getContentAsString(StandardCharsets.UTF_8));
        this.userPromptTemplate = new PromptTemplate(userPromptResource.getContentAsString(StandardCharsets.UTF_8));
        this.outputConverter = new BeanOutputConverter<>(QuestionListDTO.class);
        this.followUpCount = Math.max(0, Math.min(followUpCount, MAX_FOLLOW_UP_COUNT));
    }

    public List<InterviewQuestionDTO> generateQuestions(String resumeText, int questionCount) {
        return generateQuestions(resumeText, questionCount, null, null);
    }

    public List<InterviewQuestionDTO> generateQuestions(
        String resumeText,
        int questionCount,
        List<String> historicalQuestions
    ) {
        return generateQuestions(resumeText, questionCount, historicalQuestions, null);
    }

    public List<InterviewQuestionDTO> generateQuestions(
        String resumeText,
        int questionCount,
        List<String> historicalQuestions,
        String targetJobContext
    ) {
        int totalQuestionCount = Math.max(1, questionCount);
        int mainQuestionCount = calculateMainQuestionCount(totalQuestionCount);

        log.info(
            "开始生成面试问题，简历长度: {}, 目标总题数: {}, 历史问题数: {}",
            resumeText.length(),
            totalQuestionCount,
            historicalQuestions != null ? historicalQuestions.size() : 0
        );

        QuestionDistribution distribution = calculateDistribution(mainQuestionCount);

        try {
            String systemPrompt = systemPromptTemplate.render();

            Map<String, Object> variables = new HashMap<>();
            variables.put("questionCount", mainQuestionCount);
            variables.put("projectCount", distribution.project);
            variables.put("mysqlCount", distribution.mysql);
            variables.put("redisCount", distribution.redis);
            variables.put("javaBasicCount", distribution.javaBasic);
            variables.put("javaCollectionCount", distribution.javaCollection);
            variables.put("javaConcurrentCount", distribution.javaConcurrent);
            variables.put("springCount", distribution.spring);
            variables.put("followUpCount", followUpCount);
            variables.put("resumeText", resumeText);
            variables.put(
                "historicalQuestions",
                historicalQuestions != null && !historicalQuestions.isEmpty()
                    ? String.join("\n", historicalQuestions)
                    : "暂无历史提问"
            );
            variables.put(
                "targetJobContext",
                targetJobContext != null && !targetJobContext.isBlank()
                    ? targetJobContext
                    : "未指定目标职位，请仅根据候选人简历生成问题。"
            );

            String userPrompt = userPromptTemplate.render(variables);
            String systemPromptWithFormat = systemPrompt + "\n\n" + outputConverter.getFormat();

            QuestionListDTO dto;
            try {
                dto = structuredOutputInvoker.invoke(
                    chatClient,
                    systemPromptWithFormat,
                    userPrompt,
                    outputConverter,
                    ErrorCode.INTERVIEW_QUESTION_GENERATION_FAILED,
                    "面试问题生成失败：",
                    "结构化面试问题生成",
                    log
                );
                log.debug("AI 响应解析成功: questions count={}", dto.questions().size());
            } catch (Exception e) {
                log.error("面试问题生成 AI 调用失败: {}", e.getMessage(), e);
                throw new BusinessException(
                    ErrorCode.INTERVIEW_QUESTION_GENERATION_FAILED,
                    "面试问题生成失败：" + e.getMessage()
                );
            }

            List<InterviewQuestionDTO> questions = convertToQuestions(dto, totalQuestionCount);
            log.info("成功生成 {} 个面试问题", questions.size());
            return questions;
        } catch (Exception e) {
            log.error("生成面试问题失败: {}", e.getMessage(), e);
            return generateDefaultQuestions(totalQuestionCount);
        }
    }

    private QuestionDistribution calculateDistribution(int total) {
        if (total <= 0) {
            return new QuestionDistribution(0, 0, 0, 0, 0, 0, 0);
        }

        double springRatio = Math.max(
            0D,
            1D - PROJECT_RATIO - MYSQL_RATIO - REDIS_RATIO - JAVA_BASIC_RATIO - JAVA_COLLECTION_RATIO - JAVA_CONCURRENT_RATIO
        );
        double[] weights = {
            PROJECT_RATIO,
            MYSQL_RATIO,
            REDIS_RATIO,
            JAVA_BASIC_RATIO,
            JAVA_COLLECTION_RATIO,
            JAVA_CONCURRENT_RATIO,
            springRatio
        };
        int[] counts = new int[weights.length];
        double[] remainders = new double[weights.length];
        int assigned = 0;

        for (int index = 0; index < weights.length; index++) {
            double raw = total * weights[index];
            counts[index] = (int) Math.floor(raw);
            remainders[index] = raw - counts[index];
            assigned += counts[index];
        }

        int remaining = total - assigned;
        while (remaining > 0) {
            int bestIndex = 0;
            for (int index = 1; index < remainders.length; index++) {
                if (remainders[index] > remainders[bestIndex]) {
                    bestIndex = index;
                }
            }
            counts[bestIndex]++;
            remainders[bestIndex] = -1;
            remaining--;
        }

        return new QuestionDistribution(
            counts[0],
            counts[1],
            counts[2],
            counts[3],
            counts[4],
            counts[5],
            counts[6]
        );
    }

    private List<InterviewQuestionDTO> convertToQuestions(QuestionListDTO dto, int totalQuestionCount) {
        List<InterviewQuestionDTO> questions = new ArrayList<>();
        int index = 0;

        if (dto == null || dto.questions() == null || totalQuestionCount <= 0) {
            return questions;
        }

        for (QuestionDTO questionDTO : dto.questions()) {
            if (index >= totalQuestionCount) {
                break;
            }
            if (questionDTO == null || questionDTO.question() == null || questionDTO.question().isBlank()) {
                continue;
            }

            QuestionType type = parseQuestionType(questionDTO.type());
            int mainQuestionIndex = index;
            questions.add(
                InterviewQuestionDTO.create(
                    index++,
                    questionDTO.question(),
                    type,
                    questionDTO.category(),
                    false,
                    null
                )
            );

            List<String> followUps = sanitizeFollowUps(questionDTO.followUps());
            for (int followUpIndex = 0; followUpIndex < followUps.size(); followUpIndex++) {
                if (index >= totalQuestionCount) {
                    break;
                }
                questions.add(
                    InterviewQuestionDTO.create(
                        index++,
                        followUps.get(followUpIndex),
                        type,
                        buildFollowUpCategory(questionDTO.category(), followUpIndex + 1),
                        true,
                        mainQuestionIndex
                    )
                );
            }
        }

        return questions;
    }

    private QuestionType parseQuestionType(String typeStr) {
        try {
            return QuestionType.valueOf(typeStr.toUpperCase());
        } catch (Exception e) {
            return QuestionType.JAVA_BASIC;
        }
    }

    private List<InterviewQuestionDTO> generateDefaultQuestions(int count) {
        List<InterviewQuestionDTO> questions = new ArrayList<>();
        int mainQuestionCount = calculateMainQuestionCount(count);

        String[][] defaultQuestions = {
            {"请介绍一下你简历中最重要的项目，你在其中承担了什么角色？", "PROJECT", "项目经历"},
            {"MySQL 索引有哪些类型？B+ 树索引的核心原理是什么？", "MYSQL", "MySQL"},
            {"Redis 支持哪些数据结构？各自适合什么场景？", "REDIS", "Redis"},
            {"HashMap 的底层实现原理是什么？JDK 8 做了哪些优化？", "JAVA_COLLECTION", "Java 集合"},
            {"synchronized 和 ReentrantLock 有什么区别？", "JAVA_CONCURRENT", "Java 并发"},
            {"Spring 的 IoC 和 AOP 原理分别是什么？", "SPRING", "Spring"},
            {"MySQL 事务的 ACID 分别是什么？隔离级别有哪些？", "MYSQL", "MySQL"},
            {"Redis 的持久化机制有哪些？RDB 和 AOF 有什么区别？", "REDIS", "Redis"},
            {"Java 垃圾回收机制是怎样的？常见 GC 算法有哪些？", "JAVA_BASIC", "Java 基础"},
            {"线程池的核心参数有哪些？应该如何合理配置？", "JAVA_CONCURRENT", "Java 并发"}
        };

        int index = 0;
        for (int questionIndex = 0; questionIndex < Math.min(mainQuestionCount, defaultQuestions.length); questionIndex++) {
            if (index >= count) {
                break;
            }

            String mainQuestion = defaultQuestions[questionIndex][0];
            QuestionType type = QuestionType.valueOf(defaultQuestions[questionIndex][1]);
            String category = defaultQuestions[questionIndex][2];
            questions.add(
                InterviewQuestionDTO.create(
                    index++,
                    mainQuestion,
                    type,
                    category,
                    false,
                    null
                )
            );

            int mainQuestionIndex = index - 1;
            for (int followUpIndex = 0; followUpIndex < followUpCount; followUpIndex++) {
                if (index >= count) {
                    break;
                }
                questions.add(
                    InterviewQuestionDTO.create(
                        index++,
                        buildDefaultFollowUp(mainQuestion, followUpIndex + 1),
                        type,
                        buildFollowUpCategory(category, followUpIndex + 1),
                        true,
                        mainQuestionIndex
                    )
                );
            }
        }

        return questions;
    }

    private int calculateMainQuestionCount(int totalQuestionCount) {
        if (totalQuestionCount <= 0) {
            return 0;
        }
        if (followUpCount <= 0) {
            return totalQuestionCount;
        }
        return (int) Math.ceil((double) totalQuestionCount / (followUpCount + 1));
    }

    private List<String> sanitizeFollowUps(List<String> followUps) {
        if (followUpCount == 0 || followUps == null || followUps.isEmpty()) {
            return List.of();
        }
        return followUps.stream()
            .filter(item -> item != null && !item.isBlank())
            .map(String::trim)
            .limit(followUpCount)
            .collect(Collectors.toList());
    }

    private String buildFollowUpCategory(String category, int order) {
        String baseCategory = (category == null || category.isBlank()) ? "追问" : category;
        return baseCategory + "（追问 " + order + "）";
    }

    private String buildDefaultFollowUp(String mainQuestion, int order) {
        if (order == 1) {
            return "基于“" + mainQuestion + "”，请结合你亲自做过的一个真实场景展开说明。";
        }
        return "基于“" + mainQuestion + "”，如果线上出现异常，你会如何定位并给出修复方案？";
    }
}
