package com.nbwf.modules.job.model;

import java.time.LocalDateTime;
import java.util.List;

public record JobDetailDTO(
    Long id,
    String title,
    String company,
    String description,
    String location,
    Integer salaryMin,
    Integer salaryMax,
    List<String> techTags,
    JobApplicationStatus applicationStatus,
    String notes,
    String sourcePlatform,
    String sourceUrl,
    String externalJobId,
    LocalDateTime createdAt,
    LocalDateTime updatedAt,
    LocalDateTime appliedAt,
    LocalDateTime lastFollowUpAt,
    LocalDateTime nextFollowUpAt
) {}
