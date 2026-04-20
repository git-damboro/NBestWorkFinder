package com.nbwf.modules.job.model;

import jakarta.validation.constraints.Size;

import java.util.List;

public record JobDetailSyncRequest(
    @Size(max = 40) String sourcePlatform,
    @Size(max = 120) String externalJobId,
    String sourceUrl,
    @Size(max = 200) String title,
    @Size(max = 200) String company,
    @Size(max = 100) String location,
    Integer salaryMin,
    Integer salaryMax,
    String descriptionFull,
    List<String> techTags
) {
}
