package com.nbwf.modules.job.service;

import com.nbwf.common.ai.StructuredOutputInvoker;
import com.nbwf.common.exception.BusinessException;
import com.nbwf.common.exception.ErrorCode;
import com.nbwf.modules.job.model.JobEntity;
import com.nbwf.modules.job.model.JobStructuredAnalysisDTO;
import com.nbwf.modules.job.model.JobStructuredAnalysisEntity;
import com.nbwf.modules.job.model.JobStructuredAnalysisResult;
import com.nbwf.modules.job.repository.JobRepository;
import com.nbwf.modules.job.repository.JobStructuredAnalysisRepository;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.converter.BeanOutputConverter;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.util.List;

@Slf4j
@Service
public class JobStructuredAnalysisService {

    private static final Logger logger = LoggerFactory.getLogger(JobStructuredAnalysisService.class);

    private static final String SYSTEM_PROMPT = """
你是辅助投递 Agent Workflow 中的“岗位结构化分析节点”。
你的任务是只基于用户提供的职位标题、公司和 JD，把非结构化岗位信息拆成后续投递可用的结构化结果。

分析规则：
1. 只根据 JD 原文提取，不编造公司业务、岗位职责、技术栈或候选人能力。
2. requiredSkills 只放 JD 明确要求或明显核心的硬技能，最多 8 个，去重。
3. preferredSkills 只放加分项、优先项、可增强开场白的方向，最多 8 个，去重。
4. responsibilities 提炼岗位实际要做的事情，最多 6 条，不要照抄长句。
5. candidateRequirements 提炼学历、专业、经验、能力等候选人要求，最多 6 条。
6. riskPoints 写候选人投递时需要注意的潜在风险，最多 5 条，语气克制。
7. openerFocus 写成一句给开场白生成节点使用的重点建议。
8. summary 写成一句自然中文总结，说明岗位方向和核心要求。
9. 所有内容使用中文自然表达，英文技术名词保持官方写法。

仅返回 JSON 对象，字段必须为：
{
  "jobDirection": "岗位方向",
  "requiredSkills": ["核心技能"],
  "preferredSkills": ["加分技能"],
  "responsibilities": ["岗位职责"],
  "candidateRequirements": ["任职要求"],
  "riskPoints": ["风险点"],
  "openerFocus": "开场白重点",
  "summary": "岗位总结"
}
""";

    private final JobRepository jobRepository;
    private final JobStructuredAnalysisRepository analysisRepository;
    private final StructuredOutputInvoker structuredOutputInvoker;
    private final ChatClient chatClient;
    private final JobApplicationWorkflowService workflowService;
    private final ObjectMapper objectMapper;

    public JobStructuredAnalysisService(JobRepository jobRepository,
                                        JobStructuredAnalysisRepository analysisRepository,
                                        StructuredOutputInvoker structuredOutputInvoker,
                                        ChatClient.Builder chatClientBuilder,
                                        JobApplicationWorkflowService workflowService,
                                        ObjectMapper objectMapper) {
        this.jobRepository = jobRepository;
        this.analysisRepository = analysisRepository;
        this.structuredOutputInvoker = structuredOutputInvoker;
        this.chatClient = chatClientBuilder.build();
        this.workflowService = workflowService;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public JobStructuredAnalysisDTO getLatest(Long jobId, Long userId) {
        ensureOwnedJob(jobId, userId);
        return analysisRepository.findFirstByJobIdAndUserIdOrderByUpdatedAtDesc(jobId, userId)
            .map(this::toDTO)
            .orElse(null);
    }

    @Transactional
    public JobStructuredAnalysisDTO analyze(Long jobId, Long userId) {
        JobEntity job = ensureOwnedJob(jobId, userId);
        BeanOutputConverter<JobStructuredAnalysisResult> converter =
            new BeanOutputConverter<>(JobStructuredAnalysisResult.class);

        JobStructuredAnalysisResult result = structuredOutputInvoker.invoke(
            chatClient,
            SYSTEM_PROMPT,
            buildUserPrompt(job),
            converter,
            ErrorCode.AI_SERVICE_ERROR,
            "岗位结构化分析失败：",
            "JobStructuredAnalysis",
            logger
        );

        analysisRepository.deleteByJobIdAndUserId(jobId, userId);
        JobStructuredAnalysisEntity saved = analysisRepository.save(toEntity(job, result));
        JobStructuredAnalysisDTO dto = toDTO(saved);
        workflowService.recordJobStructured(job, saved.getRawResult());
        return dto;
    }

    @Transactional
    public void deleteByJob(Long jobId, Long userId) {
        analysisRepository.deleteByJobIdAndUserId(jobId, userId);
    }

    private JobEntity ensureOwnedJob(Long jobId, Long userId) {
        return jobRepository.findByIdAndUserId(jobId, userId)
            .orElseThrow(() -> new BusinessException(ErrorCode.JOB_NOT_FOUND));
    }

    private String buildUserPrompt(JobEntity job) {
        return "职位：" + nullToEmpty(job.getTitle())
            + "\n公司：" + nullToEmpty(job.getCompany())
            + "\n\nJD：\n" + nullToEmpty(job.getDescription());
    }

    private JobStructuredAnalysisEntity toEntity(JobEntity job, JobStructuredAnalysisResult result) {
        JobStructuredAnalysisEntity entity = new JobStructuredAnalysisEntity();
        entity.setJobId(job.getId());
        entity.setUserId(job.getUserId());
        entity.setJobDirection(trimToNull(result.jobDirection()));
        entity.setRequiredSkills(toJsonList(sanitizeList(result.requiredSkills(), 8)));
        entity.setPreferredSkills(toJsonList(sanitizeList(result.preferredSkills(), 8)));
        entity.setResponsibilities(toJsonList(sanitizeList(result.responsibilities(), 6)));
        entity.setCandidateRequirements(toJsonList(sanitizeList(result.candidateRequirements(), 6)));
        entity.setRiskPoints(toJsonList(sanitizeList(result.riskPoints(), 5)));
        entity.setOpenerFocus(trimToNull(result.openerFocus()));
        entity.setSummary(trimToNull(result.summary()));
        entity.setRawResult(toJson(result));
        return entity;
    }

    private JobStructuredAnalysisDTO toDTO(JobStructuredAnalysisEntity entity) {
        return new JobStructuredAnalysisDTO(
            entity.getId(),
            entity.getJobId(),
            entity.getJobDirection(),
            parseList(entity.getRequiredSkills()),
            parseList(entity.getPreferredSkills()),
            parseList(entity.getResponsibilities()),
            parseList(entity.getCandidateRequirements()),
            parseList(entity.getRiskPoints()),
            entity.getOpenerFocus(),
            entity.getSummary(),
            entity.getCreatedAt(),
            entity.getUpdatedAt()
        );
    }

    private List<String> sanitizeList(List<String> values, int limit) {
        if (values == null) {
            return List.of();
        }
        return values.stream()
            .map(this::trimToNull)
            .filter(item -> item != null)
            .distinct()
            .limit(limit)
            .toList();
    }

    private String toJsonList(List<String> values) {
        return toJson(values == null ? List.of() : values);
    }

    private List<String> parseList(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<String>>() {});
        } catch (JacksonException e) {
            log.warn("岗位结构化分析列表解析失败: {}", e.getMessage());
            return List.of();
        }
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JacksonException e) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "岗位结构化分析结果序列化失败");
        }
    }

    private String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
