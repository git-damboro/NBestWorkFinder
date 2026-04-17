package com.nbwf.modules.job.model;

import java.util.List;

public record JobMatchDTO(
    int overallScore,
    List<String> matchedSkills,
    List<String> missingSkills,
    List<String> suggestions,
    String summary
) {}
