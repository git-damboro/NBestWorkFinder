package com.nbwf.modules.job.service;

import com.nbwf.common.ai.StructuredOutputInvoker;
import com.nbwf.common.exception.ErrorCode;
import com.nbwf.modules.job.model.ResumeJobDraftDTO;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.converter.BeanOutputConverter;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Objects;

/**
 * 根据简历文本生成可供用户选择的职位草稿。
 */
@Slf4j
@Service
public class ResumeJobDraftService {

    private static final Logger logger = LoggerFactory.getLogger(ResumeJobDraftService.class);

    /**
     * 这里保持和现有 job 模块一致的“内联 prompt”风格，
     * 方便后续继续在同一处微调字段和输出约束。
     */
    private static final String SYSTEM_PROMPT = """
你是一位专业的技术招聘顾问，请根据候选人简历内容生成 3 个适合投递的职位草稿。

要求：
1. 只生成与简历真实技能、项目经历高度相关的岗位；
2. 岗位名称必须自然、常见、清晰；
3. 不要编造公司、薪资、城市等不可靠信息；
4. techTags 最多 8 个，按重要程度排序；
5. defaultDescription 用于用户保存到职位工作台时的默认职位描述；
6. defaultNotes 用于提醒用户后续补充公司、地点、薪资与具体 JD；
7. 仅返回 JSON，不要附加任何解释。

输出格式：
{
  "drafts": [
    {
      "title": "Java 后端开发工程师",
      "summary": "偏向业务系统开发",
      "reason": "候选人在 Java、Spring Boot、数据库接口开发方面经验较集中",
      "techTags": ["Java", "Spring Boot", "MySQL"],
      "defaultDescription": "适合作为默认职位描述的内容",
      "defaultNotes": "适合作为默认备注的内容"
    }
  ]
}
""";

    private final ChatClient chatClient;
    private final StructuredOutputInvoker structuredOutputInvoker;

    public ResumeJobDraftService(
        ChatClient.Builder chatClientBuilder,
        StructuredOutputInvoker structuredOutputInvoker
    ) {
        this.chatClient = chatClientBuilder.build();
        this.structuredOutputInvoker = structuredOutputInvoker;
    }

    public List<ResumeJobDraftDTO> generateDrafts(String resumeText) {
        BeanOutputConverter<ResumeJobDraftResult> converter = new BeanOutputConverter<>(ResumeJobDraftResult.class);
        ResumeJobDraftResult result = structuredOutputInvoker.invoke(
            chatClient,
            SYSTEM_PROMPT,
            "候选人简历：\n" + resumeText,
            converter,
            ErrorCode.AI_SERVICE_ERROR,
            "职位草稿生成失败：",
            "ResumeJobDraft",
            logger
        );

        return sanitize(result == null ? null : result.drafts());
    }

    /**
     * 对 AI 输出做最小可信收口：
     * - 最多保留 3 条
     * - 过滤空标题
     * - 统一 trim
     * - 补齐默认描述与备注
     */
    private List<ResumeJobDraftDTO> sanitize(List<ResumeJobDraftDTO> drafts) {
        if (drafts == null) {
            return List.of();
        }

        return drafts.stream()
            .filter(Objects::nonNull)
            .map(this::sanitizeDraft)
            .filter(Objects::nonNull)
            .limit(3)
            .toList();
    }

    private ResumeJobDraftDTO sanitizeDraft(ResumeJobDraftDTO draft) {
        String title = trimToNull(draft.title());
        if (title == null) {
            return null;
        }

        String summary = trimToEmpty(draft.summary());
        String reason = trimToEmpty(draft.reason());
        List<String> techTags = sanitizeTags(draft.techTags());
        String defaultDescription = buildDefaultDescription(title, summary, reason, draft.defaultDescription());
        String defaultNotes = buildDefaultNotes(draft.defaultNotes());

        return new ResumeJobDraftDTO(title, summary, reason, techTags, defaultDescription, defaultNotes);
    }

    private List<String> sanitizeTags(List<String> techTags) {
        if (techTags == null) {
            return List.of();
        }

        return techTags.stream()
            .filter(Objects::nonNull)
            .map(String::trim)
            .filter(tag -> !tag.isEmpty())
            .distinct()
            .limit(8)
            .toList();
    }

    private String buildDefaultDescription(String title, String summary, String reason, String customDescription) {
        String normalized = trimToNull(customDescription);
        if (normalized != null) {
            return normalized;
        }

        StringBuilder builder = new StringBuilder("根据当前简历内容推荐该职位方向：").append(title).append("。");
        if (!summary.isEmpty()) {
            builder.append("\n岗位概述：").append(summary).append("。");
        }
        if (!reason.isEmpty()) {
            builder.append("\n推荐原因：").append(reason).append("。");
        }
        builder.append("\n建议后续补充更具体的岗位职责、业务场景和任职要求。");
        return builder.toString();
    }

    private String buildDefaultNotes(String customNotes) {
        String normalized = trimToNull(customNotes);
        if (normalized != null) {
            return normalized;
        }

        return "该职位由简历智能生成，请补充公司、地点、薪资范围与具体 JD。";
    }

    private String trimToEmpty(String value) {
        return value == null ? "" : value.trim();
    }

    private String trimToNull(String value) {
        String trimmed = trimToEmpty(value);
        return trimmed.isEmpty() ? null : trimmed;
    }
}

record ResumeJobDraftResult(List<ResumeJobDraftDTO> drafts) {
}
