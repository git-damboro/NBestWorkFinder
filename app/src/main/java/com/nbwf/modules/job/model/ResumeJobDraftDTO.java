package com.nbwf.modules.job.model;

import java.util.List;

/**
 * 根据简历临时生成的职位草稿。
 * 该 DTO 只用于前后端展示与用户确认，不直接落库。
 */
public record ResumeJobDraftDTO(
    String title,
    String summary,
    String reason,
    List<String> techTags,
    String defaultDescription,
    String defaultNotes
) {
}
