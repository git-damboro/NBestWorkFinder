package com.nbwf.modules.jobdraft.model;

import java.util.List;

public record UpdateJobDraftSelectionRequest(
    List<String> selectedDraftItemIds
) {
}
