package com.nbwf.modules.job;

import com.nbwf.common.result.Result;
import com.nbwf.modules.job.model.*;
import com.nbwf.modules.job.service.JobService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "职位管理", description = "职位发布、查询与管理")
@RestController
@RequestMapping("/api/jobs")
@RequiredArgsConstructor
public class JobController {

    private final JobService jobService;

    @Operation(summary = "发布职位（管理员）")
    @PostMapping
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public Result<JobDetailDTO> create(@Valid @RequestBody CreateJobRequest req,
                                       @AuthenticationPrincipal Long adminId) {
        return Result.success(jobService.create(req, adminId));
    }

    @Operation(summary = "查询职位列表（求职者：仅 ACTIVE；管理员：全部）")
    @GetMapping
    public Result<List<JobListItemDTO>> list(@AuthenticationPrincipal Long userId,
                                              @RequestParam(defaultValue = "false") boolean all) {
        List<JobListItemDTO> jobs = all ? jobService.listAll() : jobService.listActive();
        return Result.success(jobs);
    }

    @Operation(summary = "职位详情")
    @GetMapping("/{id}")
    public Result<JobDetailDTO> detail(@PathVariable Long id) {
        return Result.success(jobService.getDetail(id));
    }

    @Operation(summary = "更新职位（管理员）")
    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public Result<JobDetailDTO> update(@PathVariable Long id,
                                        @Valid @RequestBody UpdateJobRequest req) {
        return Result.success(jobService.update(id, req));
    }

    @Operation(summary = "删除职位（管理员）")
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public Result<Void> delete(@PathVariable Long id) {
        jobService.delete(id);
        return Result.success();
    }
}
