package com.nbwf.modules.job.model;

import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

public record CreateJobFollowUpRequest(
    JobFollowUpType type,
    @Size(max = 200) String title,
    @Size(max = 12000) String content,
    @Size(max = 80) String contactMethod,
    LocalDateTime nextFollowUpAt
) {}
