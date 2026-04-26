package com.nbwf.modules.profile.model;

import java.time.LocalDateTime;
import java.util.List;

public record UserExperienceDTO(
    Long id,
    UserExperienceType type,
    String title,
    String content,
    List<String> tags,
    Boolean enabled,
    LocalDateTime createdAt,
    LocalDateTime updatedAt
) {}
