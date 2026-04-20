package com.nbwf.modules.jobdraft.model;

import java.time.LocalDateTime;
import java.util.List;

public record JobDraftItemDTO(
    String draftItemId,
    String batchId,
    JobDraftSourceType sourceType,
    String sourcePlatform,
    String externalJobId,
    String sourceUrl,
    String sourceFingerprint,
    String title,
    String company,
    String descriptionPreview,
    String descriptionFull,
    String location,
    Integer salaryMin,
    Integer salaryMax,
    String salaryTextRaw,
    String experienceTextRaw,
    String educationTextRaw,
    List<String> techTags,
    List<String> benefits,
    String recruiterName,
    boolean selected,
    boolean imported,
    Long importedJobId,
    JobDraftDetailSyncStatus detailSyncStatus,
    Integer coarseMatchScore,
    Integer preciseMatchScore,
    String matchSummary,
    String openerText,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {
}
