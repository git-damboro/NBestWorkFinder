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
    List<String> techTags,
    JobApplicationStatus applicationStatus,
    LocalDateTime createdAt,
    LocalDateTime appliedAt,
    LocalDateTime lastFollowUpAt,
    LocalDateTime nextFollowUpAt
) {}
