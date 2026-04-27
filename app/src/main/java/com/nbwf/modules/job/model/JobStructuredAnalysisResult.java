package com.nbwf.modules.job.model;

import java.util.List;

public record JobStructuredAnalysisResult(
    String jobDirection,
    List<String> requiredSkills,
    List<String> preferredSkills,
    List<String> responsibilities,
    List<String> candidateRequirements,
    List<String> riskPoints,
    String openerFocus,
    String summary
) {}
