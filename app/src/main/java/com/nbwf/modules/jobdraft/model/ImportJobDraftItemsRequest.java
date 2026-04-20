package com.nbwf.modules.jobdraft.model;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record ImportJobDraftItemsRequest(
    @NotEmpty List<String> draftItemIds
) {
}
