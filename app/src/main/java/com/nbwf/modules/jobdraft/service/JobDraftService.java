package com.nbwf.modules.jobdraft.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nbwf.common.exception.BusinessException;
import com.nbwf.common.exception.ErrorCode;
import com.nbwf.modules.job.model.JobEntity;
import com.nbwf.modules.job.model.ResumeJobDraftDTO;
import com.nbwf.modules.job.repository.JobRepository;
import com.nbwf.modules.job.service.ResumeJobDraftService;
import com.nbwf.modules.jobdraft.model.*;
import com.nbwf.modules.jobdraft.repository.JobDraftBatchRepository;
import com.nbwf.modules.jobdraft.repository.JobDraftItemRepository;
import com.nbwf.modules.resume.model.ResumeEntity;
import com.nbwf.modules.resume.repository.ResumeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class JobDraftService {

    private final JobDraftBatchRepository batchRepository;
    private final JobDraftItemRepository itemRepository;
    private final ResumeRepository resumeRepository;
    private final JobRepository jobRepository;
    private final ResumeJobDraftService resumeJobDraftService;
    private final JobDraftFingerprintService fingerprintService;
    private final ObjectMapper objectMapper;

    @Transactional
    public JobDraftBatchCreatedDTO createBatchFromResume(Long resumeId, Long userId) {
        ResumeEntity resume = resumeRepository.findByIdAndUserId(resumeId, userId)
            .orElseThrow(() -> new BusinessException(ErrorCode.RESUME_NOT_FOUND));

        if (resume.getResumeText() == null || resume.getResumeText().isBlank()) {
            throw new BusinessException(ErrorCode.RESUME_PARSE_FAILED, "当前简历内容为空，无法生成职位草稿");
        }

        List<ResumeJobDraftDTO> drafts = resumeJobDraftService.generateDrafts(resume.getResumeText());
        JobDraftBatchEntity batch = new JobDraftBatchEntity();
        batch.setBatchId(generateId("jdb_"));
        batch.setUserId(userId);
        batch.setSourceType(JobDraftSourceType.RESUME_GENERATION);
        batch.setResumeId(resumeId);
        batch.setSourcePlatform("SYSTEM");
        batch.setTotalCount(drafts.size());
        batch.setSelectedCount(0);
        batch.setImportedCount(0);
        batch.setStatus(JobDraftBatchStatus.READY);

        List<JobDraftItemEntity> items = drafts.stream()
            .map(draft -> buildResumeGeneratedItem(batch, draft, userId))
            .toList();
        batch.setImportedCount((int) items.stream().filter(JobDraftItemEntity::isImported).count());

        batchRepository.save(batch);
        itemRepository.saveAll(items);

        return new JobDraftBatchCreatedDTO(batch.getBatchId(), batch.getStatus(), batch.getTotalCount(), batch.getResumeId(), null, false);
    }

    @Transactional
    public JobDraftBatchCreatedDTO createBatchFromPageSync(CreateDraftBatchFromPageSyncRequest req, Long userId) {
        if (req.resumeId() != null) {
            resumeRepository.findByIdAndUserId(req.resumeId(), userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.RESUME_NOT_FOUND));
        }

        JobDraftBatchEntity batch = new JobDraftBatchEntity();
        batch.setBatchId(generateId("jdb_"));
        batch.setUserId(userId);
        batch.setSourceType(JobDraftSourceType.PAGE_SYNC);
        batch.setResumeId(req.resumeId());
        batch.setSourcePlatform(trimToNull(req.sourcePlatform()));
        batch.setSourcePageUrl(trimToNull(req.sourcePageUrl()));
        batch.setSourcePageTitle(trimToNull(req.sourcePageTitle()));
        batch.setTotalCount(req.jobs().size());
        batch.setSelectedCount(0);
        batch.setImportedCount(0);
        batch.setStatus(JobDraftBatchStatus.READY);

        List<JobDraftItemEntity> items = req.jobs().stream()
            .map(job -> buildPageSyncItem(batch, job, userId, req.sourcePlatform()))
            .toList();
        batch.setImportedCount((int) items.stream().filter(JobDraftItemEntity::isImported).count());

        batchRepository.save(batch);
        itemRepository.saveAll(items);

        return new JobDraftBatchCreatedDTO(batch.getBatchId(), batch.getStatus(), batch.getTotalCount(), batch.getResumeId(), null, req.resumeId() == null);
    }

    @Transactional(readOnly = true)
    public JobDraftBatchDTO getBatch(String batchId, Long userId) {
        return toBatchDTO(findBatchOrThrow(batchId, userId));
    }

    @Transactional(readOnly = true)
    public List<JobDraftItemDTO> getItems(String batchId, Long userId) {
        findBatchOrThrow(batchId, userId);
        return itemRepository.findByBatchIdAndUserIdOrderByCoarseMatchScoreDescCreatedAtDesc(batchId, userId).stream()
            .map(this::toItemDTO)
            .toList();
    }

    @Transactional(readOnly = true)
    public JobDraftBatchDTO getLatestBatch(Long userId) {
        return batchRepository.findFirstByUserIdOrderByUpdatedAtDesc(userId)
            .map(this::toBatchDTO)
            .orElse(null);
    }

    @Transactional
    public JobDraftBatchDTO updateSelection(String batchId, UpdateJobDraftSelectionRequest req, Long userId) {
        JobDraftBatchEntity batch = findBatchOrThrow(batchId, userId);
        Set<String> selectedIds = new HashSet<>(req.selectedDraftItemIds() == null ? List.of() : req.selectedDraftItemIds());
        List<JobDraftItemEntity> items = itemRepository.findByBatchIdAndUserIdOrderByCoarseMatchScoreDescCreatedAtDesc(batchId, userId);

        LocalDateTime now = LocalDateTime.now();
        int selectedCount = 0;
        for (JobDraftItemEntity item : items) {
            boolean selected = !item.isImported() && selectedIds.contains(item.getDraftItemId());
            item.setSelected(selected);
            item.setSelectedAt(selected ? now : null);
            if (selected) {
                selectedCount++;
            }
        }

        batch.setSelectedCount(selectedCount);
        itemRepository.saveAll(items);
        batchRepository.save(batch);
        return toBatchDTO(batch);
    }

    @Transactional
    public ImportJobDraftItemsResultDTO importItems(String batchId, ImportJobDraftItemsRequest req, Long userId) {
        JobDraftBatchEntity batch = findBatchOrThrow(batchId, userId);
        List<JobDraftItemEntity> items = itemRepository.findByBatchIdAndUserIdAndDraftItemIdIn(batchId, userId, req.draftItemIds());

        List<Long> importedJobIds = new ArrayList<>();
        int skippedCount = 0;
        for (JobDraftItemEntity item : items) {
            if (item.isImported() || jobRepository.existsByUserIdAndSourceFingerprint(userId, item.getSourceFingerprint())) {
                skippedCount++;
                item.setSelected(false);
                item.setSelectedAt(null);
                continue;
            }

            JobEntity savedJob = jobRepository.save(buildJobFromDraft(item, userId));
            item.setImported(true);
            item.setImportedJobId(savedJob.getId());
            item.setSelected(false);
            item.setSelectedAt(null);
            importedJobIds.add(savedJob.getId());
        }

        batch.setImportedCount(batch.getImportedCount() + importedJobIds.size());
        batch.setSelectedCount(0);
        if (batch.getImportedCount() >= batch.getTotalCount() && batch.getTotalCount() > 0) {
            batch.setStatus(JobDraftBatchStatus.COMPLETED);
        } else if (batch.getImportedCount() > 0) {
            batch.setStatus(JobDraftBatchStatus.PARTIAL_IMPORTED);
        } else {
            batch.setStatus(JobDraftBatchStatus.READY);
        }

        itemRepository.saveAll(items);
        batchRepository.save(batch);

        return new ImportJobDraftItemsResultDTO(batchId, importedJobIds.size(), skippedCount, importedJobIds);
    }

    private JobDraftBatchEntity findBatchOrThrow(String batchId, Long userId) {
        return batchRepository.findByBatchIdAndUserId(batchId, userId)
            .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "职位草稿批次不存在"));
    }

    private JobDraftItemEntity buildResumeGeneratedItem(JobDraftBatchEntity batch, ResumeJobDraftDTO draft, Long userId) {
        JobDraftItemEntity item = new JobDraftItemEntity();
        String fingerprint = "SYSTEM:resume:" + Integer.toHexString(Objects.hash(userId, trimToNull(draft.title())));
        item.setDraftItemId(generateId("jdi_"));
        item.setBatchId(batch.getBatchId());
        item.setUserId(userId);
        item.setSourceType(JobDraftSourceType.RESUME_GENERATION);
        item.setSourcePlatform("SYSTEM");
        item.setSourceFingerprint(fingerprint);
        item.setTitle(draft.title());
        item.setCompany("待补充");
        item.setDescriptionPreview(trimToNull(draft.defaultDescription()));
        item.setDescriptionFull(trimToNull(draft.defaultDescription()));
        item.setTechTagsJson(toJson(draft.techTags() == null ? List.of() : draft.techTags()));
        item.setBenefitsJson(toJson(List.of()));
        item.setSelected(false);
        item.setImported(jobRepository.existsByUserIdAndSourceFingerprint(userId, fingerprint));
        item.setDetailSyncStatus(JobDraftDetailSyncStatus.PARTIAL);
        item.setCoarseMatchScore(80);
        item.setMatchSummary(trimToNull(draft.reason()));
        item.setOpenerText(trimToNull(draft.defaultNotes()));
        return item;
    }

    private JobDraftItemEntity buildPageSyncItem(JobDraftBatchEntity batch,
                                                 PageSyncJobDraftRequest job,
                                                 Long userId,
                                                 String sourcePlatform) {
        String fingerprint = fingerprintService.build(sourcePlatform, job);
        JobDraftItemEntity item = new JobDraftItemEntity();
        item.setDraftItemId(generateId("jdi_"));
        item.setBatchId(batch.getBatchId());
        item.setUserId(userId);
        item.setSourceType(JobDraftSourceType.PAGE_SYNC);
        item.setSourcePlatform(trimToNull(sourcePlatform));
        item.setExternalJobId(trimToNull(job.externalJobId()));
        item.setSourceUrl(trimToNull(job.sourceUrl()));
        item.setSourceFingerprint(fingerprint);
        item.setTitle(job.title().trim());
        item.setCompany(job.company().trim());
        item.setDescriptionPreview(trimToNull(job.descriptionPreview()));
        item.setLocation(trimToNull(job.location()));
        item.setSalaryMin(job.salaryMin());
        item.setSalaryMax(job.salaryMax());
        item.setSalaryTextRaw(trimToNull(job.salaryTextRaw()));
        item.setExperienceTextRaw(trimToNull(job.experienceTextRaw()));
        item.setEducationTextRaw(trimToNull(job.educationTextRaw()));
        item.setTechTagsJson(toJson(job.techTags() == null ? List.of() : job.techTags()));
        item.setBenefitsJson(toJson(job.benefits() == null ? List.of() : job.benefits()));
        item.setRecruiterName(trimToNull(job.recruiterName()));
        item.setRawPayloadJson(toJson(job.rawPayload()));
        item.setSelected(false);
        item.setImported(jobRepository.existsByUserIdAndSourceFingerprint(userId, fingerprint));
        item.setDetailSyncStatus(JobDraftDetailSyncStatus.UNSYNCED);
        item.setCoarseMatchScore(calculateCoarseScore(job));
        item.setMatchSummary("当前结果基于列表页信息生成，打开职位详情后可补全更准的分析。");
        return item;
    }

    private JobEntity buildJobFromDraft(JobDraftItemEntity item, Long userId) {
        JobEntity job = new JobEntity();
        job.setUserId(userId);
        job.setTitle(item.getTitle());
        job.setCompany(item.getCompany());
        job.setDescription(resolveDescription(item));
        job.setLocation(item.getLocation());
        job.setSalaryMin(item.getSalaryMin());
        job.setSalaryMax(item.getSalaryMax());
        job.setTechTags(joinList(fromJsonList(item.getTechTagsJson())));
        job.setNotes(buildImportedNotes(item));
        job.setSourcePlatform(item.getSourcePlatform());
        job.setSourceUrl(item.getSourceUrl());
        job.setExternalJobId(item.getExternalJobId());
        job.setSourceFingerprint(item.getSourceFingerprint());
        job.setDraftItemId(item.getDraftItemId());
        job.setJdCompleteness(item.getDetailSyncStatus().name());
        return job;
    }

    private String resolveDescription(JobDraftItemEntity item) {
        String full = trimToNull(item.getDescriptionFull());
        if (full != null) {
            return full;
        }
        String preview = trimToNull(item.getDescriptionPreview());
        if (preview != null) {
            return preview;
        }
        return "该职位来自职位草稿池导入，当前缺少完整 JD，请后续补充。";
    }

    private String buildImportedNotes(JobDraftItemEntity item) {
        String openerText = trimToNull(item.getOpenerText());
        if (openerText != null) {
            return openerText;
        }
        return "由职位草稿导入，来源：" + Optional.ofNullable(trimToNull(item.getSourcePlatform())).orElse("UNKNOWN");
    }

    private Integer calculateCoarseScore(PageSyncJobDraftRequest job) {
        int score = 50;
        if (job.techTags() != null) {
            score += Math.min(job.techTags().size() * 5, 20);
        }
        if (trimToNull(job.descriptionPreview()) != null) {
            score += 10;
        }
        if (job.salaryMin() != null || job.salaryMax() != null) {
            score += 5;
        }
        return Math.min(score, 90);
    }

    private JobDraftBatchDTO toBatchDTO(JobDraftBatchEntity batch) {
        return new JobDraftBatchDTO(
            batch.getBatchId(),
            batch.getSourceType(),
            batch.getResumeId(),
            batch.getSourcePlatform(),
            batch.getSourcePageUrl(),
            batch.getSourcePageTitle(),
            batch.getTotalCount(),
            batch.getSelectedCount(),
            batch.getImportedCount(),
            batch.getStatus(),
            batch.getCreatedAt(),
            batch.getUpdatedAt(),
            batch.getExpiresAt()
        );
    }

    private JobDraftItemDTO toItemDTO(JobDraftItemEntity item) {
        return new JobDraftItemDTO(
            item.getDraftItemId(),
            item.getBatchId(),
            item.getSourceType(),
            item.getSourcePlatform(),
            item.getExternalJobId(),
            item.getSourceUrl(),
            item.getSourceFingerprint(),
            item.getTitle(),
            item.getCompany(),
            item.getDescriptionPreview(),
            item.getDescriptionFull(),
            item.getLocation(),
            item.getSalaryMin(),
            item.getSalaryMax(),
            item.getSalaryTextRaw(),
            item.getExperienceTextRaw(),
            item.getEducationTextRaw(),
            fromJsonList(item.getTechTagsJson()),
            fromJsonList(item.getBenefitsJson()),
            item.getRecruiterName(),
            item.isSelected(),
            item.isImported(),
            item.getImportedJobId(),
            item.getDetailSyncStatus(),
            item.getCoarseMatchScore(),
            item.getPreciseMatchScore(),
            item.getMatchSummary(),
            item.getOpenerText(),
            item.getCreatedAt(),
            item.getUpdatedAt()
        );
    }

    private String joinList(List<String> values) {
        return values == null || values.isEmpty() ? null : String.join(",", values);
    }

    private List<String> fromJsonList(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(
                value,
                objectMapper.getTypeFactory().constructCollectionType(List.class, String.class)
            );
        } catch (JsonProcessingException e) {
            return List.of();
        }
    }

    private String toJson(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "职位草稿数据序列化失败");
        }
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String generateId(String prefix) {
        return prefix + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }
}
