package com.nbwf.modules.job.model;

import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UpdateJobRequest {

    @Size(max = 200, message = "职位名称不超过200字")
    private String title;

    @Size(max = 200, message = "公司名称不超过200字")
    private String company;

    private String description;

    @Size(max = 100, message = "地点不超过100字")
    private String location;

    @Positive(message = "最低薪资必须为正数")
    private Integer salaryMin;

    @Positive(message = "最高薪资必须为正数")
    private Integer salaryMax;

    private JobApplicationStatus applicationStatus;

    @Size(max = 2000, message = "备注不超过2000字")
    private String notes;
}
