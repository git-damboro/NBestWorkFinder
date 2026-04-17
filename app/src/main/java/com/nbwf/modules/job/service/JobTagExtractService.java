package com.nbwf.modules.job.service;

import com.nbwf.common.ai.StructuredOutputInvoker;
import com.nbwf.common.exception.ErrorCode;
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
public class JobTagExtractService {

    private static final Logger logger = LoggerFactory.getLogger(JobTagExtractService.class);

    private final ChatClient chatClient;
    private final StructuredOutputInvoker structuredOutputInvoker;

    private record TagResult(List<String> tags) {}

    private static final String SYSTEM_PROMPT = """
你是技术招聘专家，负责从职位描述中提取技术标签。
提取规则：
1. 只提取技术相关标签：编程语言、框架、中间件、数据库、工具、平台等
2. 每个标签使用官方名称（如 Spring Boot、MySQL、Kubernetes）
3. 最多提取 15 个，按重要程度排序
4. 不提取软技能或非技术要求

输出格式（仅返回 JSON，不加任何说明）：
{"tags": ["Spring Boot", "Java", "MySQL"]}
""";

    public List<String> extract(String jobTitle, String description) {
        String userPrompt = "职位：" + jobTitle + "\n\n职位描述：\n" + description;

        BeanOutputConverter<TagResult> converter = new BeanOutputConverter<>(TagResult.class);

        TagResult result = structuredOutputInvoker.invoke(
            chatClient,
            SYSTEM_PROMPT,
            userPrompt,
            converter,
            ErrorCode.AI_SERVICE_ERROR,
            "技术标签提取失败：",
            "JobTagExtract",
            logger
        );

        return result.tags() != null ? result.tags() : List.of();
    }
}
