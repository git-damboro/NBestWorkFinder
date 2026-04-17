package com.nbwf.modules.job;

import com.nbwf.common.result.Result;
import com.nbwf.modules.job.model.*;
import com.nbwf.modules.job.service.JobService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "职位管理", description = "用户私有职位收录、进展追踪与 AI 匹配分析")
@RestController
@RequestMapping("/api/jobs")
@RequiredArgsConstructor
public class JobController {

    private final JobService jobService;

    @Operation(summary = "收录职位（粘贴 JD）")
    @PostMapping
    public Result<JobDetailDTO> create(@Valid @RequestBody CreateJobRequest req,
                                       @AuthenticationPrincipal Long userId) {
        return Result.success(jobService.create(req, userId));
    }

    @Operation(summary = "我的职位列表，可按求职状态筛选")
    @GetMapping
    public Result<List<JobListItemDTO>> list(@AuthenticationPrincipal Long userId,
                                              @RequestParam(required = false) JobApplicationStatus status) {
        return Result.success(jobService.list(userId, status));
    }

    @Operation(summary = "职位详情")
    @GetMapping("/{id}")
    public Result<JobDetailDTO> detail(@PathVariable Long id,
                                        @AuthenticationPrincipal Long userId) {
        return Result.success(jobService.getDetail(id, userId));
    }

    @Operation(summary = "更新职位信息或求职状态")
    @PutMapping("/{id}")
    public Result<JobDetailDTO> update(@PathVariable Long id,
                                        @Valid @RequestBody UpdateJobRequest req,
                                        @AuthenticationPrincipal Long userId) {
        return Result.success(jobService.update(id, req, userId));
    }

    @Operation(summary = "删除职位")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id,
                                @AuthenticationPrincipal Long userId) {
        jobService.delete(id, userId);
        return Result.success();
    }

    @Operation(summary = "AI 简历匹配分析")
    @PostMapping("/{id}/match")
    public Result<JobMatchDTO> match(@PathVariable Long id,
                                      @RequestParam Long resumeId,
                                      @AuthenticationPrincipal Long userId) {
        return Result.success(jobService.match(id, resumeId, userId));
    }
}
