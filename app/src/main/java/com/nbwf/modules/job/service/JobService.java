package com.nbwf.modules.job.service;

import com.nbwf.common.exception.BusinessException;
import com.nbwf.common.exception.ErrorCode;
import com.nbwf.modules.aigeneration.listener.AiGenerationStreamProducer;
import com.nbwf.modules.aigeneration.model.AiGenerationTaskDTO;
import com.nbwf.modules.aigeneration.model.AiGenerationTaskEntity;
import com.nbwf.modules.aigeneration.model.AiGenerationTaskType;
import com.nbwf.modules.aigeneration.service.AiGenerationTaskService;
import com.nbwf.modules.job.model.*;
import com.nbwf.modules.job.repository.JobRepository;
import com.nbwf.modules.resume.model.ResumeEntity;
import com.nbwf.modules.resume.repository.ResumeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Slf4j
@Service
@RequiredArgsConstructor
public class JobService {

    private final JobRepository jobRepository;
    private final JobTagExtractService tagExtractService;
    private final JobMatchService matchService;
    private final ResumeRepository resumeRepository;
    private final ResumeJobDraftService resumeJobDraftService;
    private final AiGenerationTaskService aiGenerationTaskService;
    private final AiGenerationStreamProducer aiGenerationStreamProducer;
    private final PlatformTransactionManager transactionManager;
    private final ObjectMapper objectMapper;

    @Transactional
    public JobDetailDTO create(CreateJobRequest req, Long userId) {
        JobEntity job = new JobEntity();
        job.setUserId(userId);
        job.setTitle(req.getTitle());
        job.setCompany(req.getCompany());
        job.setDescription(req.getDescription());
        job.setLocation(req.getLocation());
        job.setSalaryMin(req.getSalaryMin());
        job.setSalaryMax(req.getSalaryMax());
        job.setNotes(req.getNotes());

        List<String> tags = extractTagsSafely(req.getTitle(), req.getDescription());
        job.setTechTags(joinTags(tags));

        return toDetailDTO(jobRepository.save(job));
    }

    public List<JobListItemDTO> list(Long userId, JobApplicationStatus status) {
        List<JobEntity> jobs = status != null
            ? jobRepository.findByUserIdAndApplicationStatusOrderByCreatedAtDesc(userId, status)
            : jobRepository.findByUserIdOrderByCreatedAtDesc(userId);
        return jobs.stream().map(this::toListItemDTO).toList();
    }

    public JobDetailDTO getDetail(Long id, Long userId) {
        return toDetailDTO(findOrThrow(id, userId));
    }

    @Transactional
    public JobDetailDTO update(Long id, UpdateJobRequest req, Long userId) {
        JobEntity job = findOrThrow(id, userId);

        boolean descriptionChanged = req.getDescription() != null
            && !req.getDescription().equals(job.getDescription());

        if (req.getTitle() != null) job.setTitle(req.getTitle());
        if (req.getCompany() != null) job.setCompany(req.getCompany());
        if (req.getDescription() != null) job.setDescription(req.getDescription());
        if (req.getLocation() != null) job.setLocation(req.getLocation());
        if (req.getSalaryMin() != null) job.setSalaryMin(req.getSalaryMin());
        if (req.getSalaryMax() != null) job.setSalaryMax(req.getSalaryMax());
        if (req.getApplicationStatus() != null) job.setApplicationStatus(req.getApplicationStatus());
        if (req.getNotes() != null) job.setNotes(req.getNotes());

        if (descriptionChanged) {
            List<String> tags = extractTagsSafely(job.getTitle(), job.getDescription());
            job.setTechTags(joinTags(tags));
        }

        return toDetailDTO(jobRepository.save(job));
    }

    @Transactional
    public void delete(Long id, Long userId) {
        JobEntity job = findOrThrow(id, userId);
        jobRepository.delete(job);
    }

    public JobDetailDTO syncDetail(Long id, JobDetailSyncRequest req, Long userId) {
        AiGenerationTaskEntity task = aiGenerationTaskService.createTask(
            userId,
            AiGenerationTaskType.JOB_DRAFT_DETAIL_SYNC,
            id,
            null,
            buildJobDetailTaskRequestJson(id, req)
        );
        return executeDetailSyncTask(task, id, req);
    }

    public JobDetailDTO retryDetailSyncTask(AiGenerationTaskEntity task,
                                            Long id,
                                            JobDetailSyncRequest req) {
        return executeDetailSyncTask(task, id, req);
    }

    private JobDetailDTO executeDetailSyncTask(AiGenerationTaskEntity task,
                                               Long id,
                                               JobDetailSyncRequest req) {
        aiGenerationTaskService.markProcessing(task.getTaskId(), task.getUserId());
        try {
            JobDetailDTO result = Objects.requireNonNull(
                new TransactionTemplate(transactionManager).execute(status -> doSyncDetail(id, req, task.getUserId()))
            );
            Map<String, Object> resultJson = new LinkedHashMap<>();
            resultJson.put("targetKind", "JOB");
            resultJson.put("jobId", result.id());
            aiGenerationTaskService.markCompleted(task.getTaskId(), task.getUserId(), toJson(resultJson));
            return result;
        } catch (RuntimeException e) {
            aiGenerationTaskService.markFailed(task.getTaskId(), task.getUserId(), toTaskErrorMessage(e));
            throw e;
        }
    }

    private JobDetailDTO doSyncDetail(Long id, JobDetailSyncRequest req, Long userId) {
        JobEntity job = findOrThrow(id, userId);
        boolean descriptionChanged = trimToNull(req.descriptionFull()) != null
            && !req.descriptionFull().equals(job.getDescription());

        if (trimToNull(req.title()) != null) job.setTitle(req.title().trim());
        if (trimToNull(req.company()) != null) job.setCompany(req.company().trim());
        if (trimToNull(req.descriptionFull()) != null) job.setDescription(req.descriptionFull().trim());
        if (trimToNull(req.location()) != null) job.setLocation(req.location().trim());
        if (req.salaryMin() != null) job.setSalaryMin(req.salaryMin());
        if (req.salaryMax() != null) job.setSalaryMax(req.salaryMax());
        if (trimToNull(req.sourcePlatform()) != null) job.setSourcePlatform(req.sourcePlatform().trim());
        if (trimToNull(req.sourceUrl()) != null) job.setSourceUrl(req.sourceUrl().trim());
        if (trimToNull(req.externalJobId()) != null) job.setExternalJobId(req.externalJobId().trim());

        if (req.techTags() != null && !req.techTags().isEmpty()) {
            job.setTechTags(joinTags(sanitizeTags(req.techTags())));
        } else if (descriptionChanged) {
            job.setTechTags(joinTags(extractTagsSafely(job.getTitle(), job.getDescription())));
        }

        if (descriptionChanged) {
            job.setJdCompleteness("COMPLETED");
        }

        return toDetailDTO(jobRepository.save(job));
    }

    private String buildJobDetailTaskRequestJson(Long jobId, JobDetailSyncRequest req) {
        return toJson(Map.of(
            "v", 1,
            "targetKind", "JOB",
            "jobId", jobId,
            "request", req
        ));
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JacksonException e) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "职位任务数据序列化失败");
        }
    }

    private String toTaskErrorMessage(RuntimeException e) {
        String message = e.getMessage();
        if (message == null || message.isBlank()) {
            message = e.getClass().getSimpleName();
        }
        return message.length() > 500 ? message.substring(0, 500) : message;
    }

    public JobMatchDTO match(Long jobId, Long resumeId, Long userId) {
        JobEntity job = findOrThrow(jobId, userId);
        ResumeEntity resume = resumeRepository.findByIdAndUserId(resumeId, userId)
            .orElseThrow(() -> new BusinessException(ErrorCode.RESUME_NOT_FOUND));

        if (resume.getResumeText() == null || resume.getResumeText().isBlank()) {
            throw new BusinessException(ErrorCode.RESUME_PARSE_FAILED);
        }

        return matchService.analyze(resume.getResumeText(), job.getTitle(), job.getDescription());
    }

    /**
     * 基于当前用户自己的简历文本生成临时职位草稿。
     * 草稿只用于前端确认，不新增数据库表。
     */
    public List<ResumeJobDraftDTO> generateDraftsFromResume(Long resumeId, Long userId) {
        ResumeEntity resume = resumeRepository.findByIdAndUserId(resumeId, userId)
            .orElseThrow(() -> new BusinessException(ErrorCode.RESUME_NOT_FOUND));

        if (resume.getResumeText() == null || resume.getResumeText().isBlank()) {
            throw new BusinessException(ErrorCode.RESUME_PARSE_FAILED, "当前简历内容为空，无法生成职位草稿");
        }

        return resumeJobDraftService.generateDrafts(resume.getResumeText());
    }

    /**
     * 创建“根据简历生成职位草稿”的后台任务。
     * 旧同步接口保留兼容，前端新流程优先调用该方法并轮询任务结果。
     */
    public AiGenerationTaskDTO createDraftTaskFromResume(Long resumeId, Long userId) {
        ResumeEntity resume = resumeRepository.findByIdAndUserId(resumeId, userId)
            .orElseThrow(() -> new BusinessException(ErrorCode.RESUME_NOT_FOUND));

        if (resume.getResumeText() == null || resume.getResumeText().isBlank()) {
            throw new BusinessException(ErrorCode.RESUME_PARSE_FAILED, "当前简历内容为空，无法生成职位草稿");
        }

        AiGenerationTaskService.TaskCreationResult creationResult =
            aiGenerationTaskService.createOrReuseTaskResult(
                userId,
                AiGenerationTaskType.RESUME_JOB_DRAFT,
                resumeId,
                null,
                "{\"resumeId\":" + resumeId + "}"
            );

        AiGenerationTaskEntity task = creationResult.task();
        if (!creationResult.reused()) {
            aiGenerationStreamProducer.sendTask(task);
        }
        return aiGenerationTaskService.getTask(task.getTaskId(), userId);
    }

    private JobEntity findOrThrow(Long id, Long userId) {
        return jobRepository.findByIdAndUserId(id, userId)
            .orElseThrow(() -> new BusinessException(ErrorCode.JOB_NOT_FOUND));
    }

    private List<String> extractTagsSafely(String title, String description) {
        try {
            return tagExtractService.extract(title, description);
        } catch (Exception e) {
            log.warn("AI标签提取失败，跳过标签: {}", e.getMessage());
            return List.of();
        }
    }

    private String joinTags(List<String> tags) {
        return tags.isEmpty() ? null : String.join(",", tags);
    }

    private List<String> sanitizeTags(List<String> tags) {
        if (tags == null) return List.of();
        return tags.stream()
            .filter(Objects::nonNull)
            .map(String::trim)
            .filter(tag -> !tag.isEmpty())
            .distinct()
            .limit(12)
            .toList();
    }

    private String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private List<String> splitTags(String techTags) {
        if (techTags == null || techTags.isBlank()) return List.of();
        return Arrays.stream(techTags.split(","))
            .map(String::trim)
            .filter(s -> !s.isEmpty())
            .toList();
    }

    private JobListItemDTO toListItemDTO(JobEntity job) {
        return new JobListItemDTO(
            job.getId(),
            job.getTitle(),
            job.getCompany(),
            job.getLocation(),
            job.getSalaryMin(),
            job.getSalaryMax(),
            splitTags(job.getTechTags()),
            job.getApplicationStatus(),
            job.getCreatedAt()
        );
    }

    private JobDetailDTO toDetailDTO(JobEntity job) {
        return new JobDetailDTO(
            job.getId(),
            job.getTitle(),
            job.getCompany(),
            job.getDescription(),
            job.getLocation(),
            job.getSalaryMin(),
            job.getSalaryMax(),
            splitTags(job.getTechTags()),
            job.getApplicationStatus(),
            job.getNotes(),
            job.getCreatedAt(),
            job.getUpdatedAt()
        );
    }
}
