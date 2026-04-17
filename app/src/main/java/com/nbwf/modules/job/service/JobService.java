package com.nbwf.modules.job.service;

import com.nbwf.common.exception.BusinessException;
import com.nbwf.common.exception.ErrorCode;
import com.nbwf.modules.job.model.*;
import com.nbwf.modules.job.repository.JobRepository;
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

    @Transactional
    public JobDetailDTO create(CreateJobRequest req, Long adminId) {
        JobEntity job = new JobEntity();
        job.setTitle(req.getTitle());
        job.setCompany(req.getCompany());
        job.setDescription(req.getDescription());
        job.setLocation(req.getLocation());
        job.setSalaryMin(req.getSalaryMin());
        job.setSalaryMax(req.getSalaryMax());
        job.setCreatedBy(adminId);

        List<String> tags = extractTagsSafely(req.getTitle(), req.getDescription());
        job.setTechTags(joinTags(tags));

        return toDetailDTO(jobRepository.save(job));
    }

    public List<JobListItemDTO> listActive() {
        return jobRepository.findByStatusOrderByCreatedAtDesc(JobStatus.ACTIVE)
            .stream().map(this::toListItemDTO).toList();
    }

    public List<JobListItemDTO> listAll() {
        return jobRepository.findAllByOrderByCreatedAtDesc()
            .stream().map(this::toListItemDTO).toList();
    }

    public JobDetailDTO getDetail(Long id) {
        return toDetailDTO(findOrThrow(id));
    }

    @Transactional
    public JobDetailDTO update(Long id, UpdateJobRequest req) {
        JobEntity job = findOrThrow(id);

        boolean descriptionChanged = req.getDescription() != null
            && !req.getDescription().equals(job.getDescription());

        if (req.getTitle() != null) job.setTitle(req.getTitle());
        if (req.getCompany() != null) job.setCompany(req.getCompany());
        if (req.getDescription() != null) job.setDescription(req.getDescription());
        if (req.getLocation() != null) job.setLocation(req.getLocation());
        if (req.getSalaryMin() != null) job.setSalaryMin(req.getSalaryMin());
        if (req.getSalaryMax() != null) job.setSalaryMax(req.getSalaryMax());
        if (req.getStatus() != null) job.setStatus(req.getStatus());

        if (descriptionChanged) {
            List<String> tags = extractTagsSafely(job.getTitle(), job.getDescription());
            job.setTechTags(joinTags(tags));
        }

        return toDetailDTO(jobRepository.save(job));
    }

    @Transactional
    public void delete(Long id) {
        JobEntity job = findOrThrow(id);
        jobRepository.delete(job);
    }

    private JobEntity findOrThrow(Long id) {
        return jobRepository.findById(id)
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
            job.getStatus(),
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
            job.getStatus(),
            job.getCreatedAt(),
            job.getUpdatedAt()
        );
    }
}
