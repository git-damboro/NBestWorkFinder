package com.nbwf.modules.job.service;

import com.nbwf.common.ai.StructuredOutputInvoker;
import com.nbwf.common.exception.ErrorCode;
import com.nbwf.modules.job.model.JobMatchDTO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.converter.BeanOutputConverter;
import org.springframework.stereotype.Service;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class JobMatchService {

    private static final Logger logger = LoggerFactory.getLogger(JobMatchService.class);

    private final ChatClient chatClient;
    private final StructuredOutputInvoker structuredOutputInvoker;

    private record MatchResult(
        int overallScore,
        List<String> matchedSkills,
        List<String> missingSkills,
        List<String> suggestions,
        String summary
    ) {}

    private static final String SYSTEM_PROMPT = """
你是一位专业的求职顾问，请分析候选人简历与目标职位的匹配程度。

分析维度：
1. 技术技能匹配（编程语言、框架、工具等）
2. 经验年限与要求的吻合度
3. 项目经历与岗位需求的相关性
4. 简历中的亮点与职位要求的契合

输出格式（仅返回 JSON，不加任何说明）：
{
  "overallScore": 75,
  "matchedSkills": ["Java", "Spring Boot"],
  "missingSkills": ["Kubernetes", "Kafka"],
  "suggestions": [
    "建议在简历中突出分布式系统相关经验",
    "可以补充容器化部署的项目经历"
  ],
  "summary": "整体匹配度较高，主要技术栈吻合，但缺少云原生相关经验..."
}
""";

    public JobMatchDTO analyze(String resumeText, String jobTitle, String jobDescription) {
        String userPrompt = String.format(
            "目标职位：%s\n\n职位描述：\n%s\n\n候选人简历：\n%s",
            jobTitle, jobDescription, resumeText
        );

        BeanOutputConverter<MatchResult> converter = new BeanOutputConverter<>(MatchResult.class);

        MatchResult result = structuredOutputInvoker.invoke(
            chatClient,
            SYSTEM_PROMPT,
            userPrompt,
            converter,
            ErrorCode.AI_SERVICE_ERROR,
            "简历匹配分析失败：",
            "JobMatch",
            logger
        );

        return new JobMatchDTO(
            result.overallScore(),
            result.matchedSkills(),
            result.missingSkills(),
            result.suggestions(),
            result.summary()
        );
    }
}
