package com.nbwf.modules.job.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.List;

public record ImportJobRequest(
    @NotBlank(message = "来源平台不能为空")
    @Size(max = 40, message = "来源平台不超过40字")
    String sourcePlatform,

    @Size(max = 120, message = "外部职位ID不超过120字")
    String externalJobId,

    String sourceUrl,

    @NotBlank(message = "职位名称不能为空")
    @Size(max = 200, message = "职位名称不超过200字")
    String title,

    @NotBlank(message = "公司名称不能为空")
    @Size(max = 200, message = "公司名称不超过200字")
    String company,

    @Size(max = 100, message = "地点不超过100字")
    String location,

    Integer salaryMin,

    Integer salaryMax,

    String salaryText,

    @NotBlank(message = "职位描述不能为空")
    String description,

    List<String> techTags,

    @Size(max = 2000, message = "备注不超过2000字")
    String notes
) {
}
