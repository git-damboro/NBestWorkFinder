package com.nbwf.modules.job.model;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CreateJobRequest {

    @NotBlank(message = "职位名称不能为空")
    @Size(max = 200, message = "职位名称不超过200字")
    private String title;

    @NotBlank(message = "公司名称不能为空")
    @Size(max = 200, message = "公司名称不超过200字")
    private String company;

    @NotBlank(message = "职位描述不能为空")
    private String description;

    @Size(max = 100, message = "地点不超过100字")
    private String location;

    @Positive(message = "最低薪资必须为正数")
    private Integer salaryMin;

    @Positive(message = "最高薪资必须为正数")
    private Integer salaryMax;

    @Size(max = 2000, message = "备注不超过2000字")
    private String notes;
}
