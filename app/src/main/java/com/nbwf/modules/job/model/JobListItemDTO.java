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
    JobStatus status,
    LocalDateTime createdAt
) {}
