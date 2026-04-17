package com.nbwf.modules.job.service;

import com.nbwf.common.exception.BusinessException;
import com.nbwf.common.exception.ErrorCode;
import com.nbwf.modules.job.model.*;
import com.nbwf.modules.job.repository.JobRepository;
import com.nbwf.modules.resume.model.ResumeEntity;
import com.nbwf.modules.resume.repository.ResumeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class JobService {

    private final JobRepository jobRepository;
    private final JobTagExtractService tagExtractService;
    private final JobMatchService matchService;
    private final ResumeRepository resumeRepository;

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

    public JobMatchDTO match(Long jobId, Long resumeId, Long userId) {
        JobEntity job = findOrThrow(jobId, userId);
        ResumeEntity resume = resumeRepository.findById(resumeId)
            .orElseThrow(() -> new BusinessException(ErrorCode.RESUME_NOT_FOUND));

        if (resume.getResumeText() == null || resume.getResumeText().isBlank()) {
            throw new BusinessException(ErrorCode.RESUME_PARSE_FAILED);
        }

        var result = matchService.analyze(resume.getResumeText(), job.getTitle(), job.getDescription());
        return new JobMatchDTO(
            result.overallScore(),
            result.matchedSkills(),
            result.missingSkills(),
            result.suggestions(),
            result.summary()
        );
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
