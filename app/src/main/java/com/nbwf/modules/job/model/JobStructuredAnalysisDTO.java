package com.nbwf.modules.job.model;

import java.time.LocalDateTime;
import java.util.List;

public record JobStructuredAnalysisDTO(
    Long id,
    Long jobId,
    String jobDirection,
    List<String> requiredSkills,
    List<String> preferredSkills,
    List<String> responsibilities,
    List<String> candidateRequirements,
    List<String> riskPoints,
    String openerFocus,
    String summary,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {}
