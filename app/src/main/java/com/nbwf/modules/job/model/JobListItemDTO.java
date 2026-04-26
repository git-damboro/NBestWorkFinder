package com.nbwf.modules.job.model;

import java.time.LocalDateTime;
import java.util.List;

public record JobListItemDTO(
    Long id,
    String title,
    String company,
    String location,
    Integer salaryMin,
    Integer salaryMax,
    String salaryText,
    List<String> techTags,
    JobApplicationStatus applicationStatus,
    String sourcePlatform,
    String sourceUrl,
    String externalJobId,
    LocalDateTime createdAt,
    LocalDateTime appliedAt,
    LocalDateTime lastFollowUpAt,
    LocalDateTime nextFollowUpAt
) {}
