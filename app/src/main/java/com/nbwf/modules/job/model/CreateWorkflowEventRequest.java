package com.nbwf.modules.job.model;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateWorkflowEventRequest(
    @NotNull
    JobApplicationWorkflowNode nodeKey,

    @Size(max = 200)
    String title,

    String content,

    String inputSnapshot,

    String outputSnapshot,

    Boolean requiresHumanAction
) {}
