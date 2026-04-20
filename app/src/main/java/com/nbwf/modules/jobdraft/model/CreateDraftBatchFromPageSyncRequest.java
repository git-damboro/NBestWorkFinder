package com.nbwf.modules.jobdraft.model;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

public record CreateDraftBatchFromPageSyncRequest(
    Long resumeId,
    @NotBlank @Size(max = 40) String sourcePlatform,
    String sourcePageUrl,
    @Size(max = 300) String sourcePageTitle,
    @Size(max = 160) String pageFingerprint,
    @NotEmpty List<@Valid PageSyncJobDraftRequest> jobs
) {
}

