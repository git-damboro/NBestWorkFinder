package com.nbwf.modules.profile.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;

public record UpdateUserExperienceRequest(
    @NotNull UserExperienceType type,
    @NotBlank @Size(max = 200) String title,
    @NotBlank @Size(max = 12000) String content,
    @Size(max = 20) List<@Size(max = 40) String> tags,
    Boolean enabled
) {}
