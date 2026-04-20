package com.nbwf.modules.jobdraft.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.Map;

public record PageSyncJobDraftRequest(
    @Size(max = 120) String externalJobId,
    String sourceUrl,
    @NotBlank @Size(max = 200) String title,
    @NotBlank @Size(max = 200) String company,
    @Size(max = 100) String location,
    @Size(max = 100) String salaryTextRaw,
    Integer salaryMin,
    Integer salaryMax,
    @Size(max = 100) String experienceTextRaw,
    @Size(max = 100) String educationTextRaw,
    String descriptionPreview,
    List<String> techTags,
    List<String> benefits,
    @Size(max = 100) String recruiterName,
    Map<String, Object> rawPayload
) {
}

