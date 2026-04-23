package com.nbwf.modules.jobdraft.model;

import java.util.List;

public record ImportJobDraftItemsResultDTO(
    String batchId,
    int importedCount,
    int skippedCount,
    int failedCount,
    List<String> failedDraftItemIds,
    List<Long> importedJobIds
) {
}
