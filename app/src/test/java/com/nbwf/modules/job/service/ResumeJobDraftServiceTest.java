package com.nbwf.modules.job.service;

import com.nbwf.common.ai.StructuredOutputInvoker;
import com.nbwf.common.exception.ErrorCode;
import com.nbwf.modules.job.model.ResumeJobDraftDTO;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.converter.BeanOutputConverter;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ResumeJobDraftServiceTest {

    @Mock
    private ChatClient.Builder chatClientBuilder;

    @Mock
    private ChatClient chatClient;

    @Mock
    private StructuredOutputInvoker structuredOutputInvoker;

    private ResumeJobDraftService resumeJobDraftService;

    @BeforeEach
    void setUp() {
        when(chatClientBuilder.build()).thenReturn(chatClient);
        resumeJobDraftService = new ResumeJobDraftService(chatClientBuilder, structuredOutputInvoker);
    }

    @Test
    void generateDraftsShouldTrimFieldsLimitToThreeAndFillDefaults() {
        when(structuredOutputInvoker.invoke(
            eq(chatClient),
            org.mockito.ArgumentMatchers.any(String.class),
            contains("候选人简历"),
            org.mockito.ArgumentMatchers.<BeanOutputConverter<ResumeJobDraftResult>>any(),
            eq(ErrorCode.AI_SERVICE_ERROR),
            contains("职位草稿生成失败"),
            eq("ResumeJobDraft"),
            org.mockito.ArgumentMatchers.any()
        )).thenReturn(new ResumeJobDraftResult(List.of(
            new ResumeJobDraftDTO(" Java 后端开发工程师 ", " 偏向业务系统开发 ", " 技术栈集中在 Java / Spring Boot ", List.of("Java", "Spring Boot"), "", ""),
            new ResumeJobDraftDTO("Spring Boot 开发工程师", "服务开发方向", "具备接口与数据库经验", List.of("Spring Boot", "MySQL"), null, null),
            new ResumeJobDraftDTO("后端研发工程师", "系统建设方向", "有缓存与数据库经验", List.of("Redis", "MySQL"), "自定义描述", "自定义备注"),
            new ResumeJobDraftDTO("额外草稿", "不会保留", "超过上限", List.of("Kafka"), "X", "Y")
        )));

        List<ResumeJobDraftDTO> drafts = resumeJobDraftService.generateDrafts("候选人简历内容");

        assertEquals(3, drafts.size());
        assertEquals("Java 后端开发工程师", drafts.get(0).title());
        assertEquals("偏向业务系统开发", drafts.get(0).summary());
        assertEquals("技术栈集中在 Java / Spring Boot", drafts.get(0).reason());
        assertTrue(drafts.get(0).defaultDescription().contains("Java 后端开发工程师"));
        assertTrue(drafts.get(0).defaultNotes().contains("简历智能生成"));
        assertEquals("自定义描述", drafts.get(2).defaultDescription());
        assertEquals("自定义备注", drafts.get(2).defaultNotes());
    }
}
