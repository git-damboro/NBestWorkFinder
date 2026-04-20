package com.nbwf.modules.jobdraft;

import com.nbwf.common.result.Result;
import com.nbwf.modules.jobdraft.model.*;
import com.nbwf.modules.jobdraft.service.JobDraftService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "职位草稿池", description = "统一承接简历生成草稿与外部同步职位草稿")
@RestController
@RequestMapping("/api/job-drafts")
@RequiredArgsConstructor
public class JobDraftController {

    private final JobDraftService jobDraftService;

    @Operation(summary = "根据简历生成职位草稿批次")
    @PostMapping("/batches/from-resume/{resumeId}")
    public Result<JobDraftBatchCreatedDTO> createFromResume(@PathVariable Long resumeId,
                                                            @AuthenticationPrincipal Long userId) {
        return Result.success(jobDraftService.createBatchFromResume(resumeId, userId));
    }

    @Operation(summary = "从浏览器扩展同步当前页职位草稿")
    @PostMapping("/batches/from-page-sync")
    public Result<JobDraftBatchCreatedDTO> createFromPageSync(@Valid @RequestBody CreateDraftBatchFromPageSyncRequest req,
                                                              @AuthenticationPrincipal Long userId) {
        return Result.success(jobDraftService.createBatchFromPageSync(req, userId));
    }

    @Operation(summary = "查询职位草稿批次")
    @GetMapping("/batches/{batchId}")
    public Result<JobDraftBatchDTO> getBatch(@PathVariable String batchId,
                                             @AuthenticationPrincipal Long userId) {
        return Result.success(jobDraftService.getBatch(batchId, userId));
    }

    @Operation(summary = "查询职位草稿批次条目")
    @GetMapping("/batches/{batchId}/items")
    public Result<List<JobDraftItemDTO>> getItems(@PathVariable String batchId,
                                                  @AuthenticationPrincipal Long userId) {
        return Result.success(jobDraftService.getItems(batchId, userId));
    }

    @Operation(summary = "同步补全职位草稿详情 JD")
    @PostMapping("/items/{draftItemId}/detail-sync")
    public Result<JobDraftItemDTO> syncItemDetail(@PathVariable String draftItemId,
                                                  @Valid @RequestBody JobDraftDetailSyncRequest req,
                                                  @AuthenticationPrincipal Long userId) {
        return Result.success(jobDraftService.syncItemDetail(draftItemId, req, userId));
    }

    @Operation(summary = "查询最近职位草稿批次")
    @GetMapping("/batches/latest")
    public Result<JobDraftBatchDTO> getLatestBatch(@AuthenticationPrincipal Long userId) {
        return Result.success(jobDraftService.getLatestBatch(userId));
    }

    @Operation(summary = "覆盖职位草稿选择状态")
    @PutMapping("/batches/{batchId}/selection")
    public Result<JobDraftBatchDTO> updateSelection(@PathVariable String batchId,
                                                    @RequestBody UpdateJobDraftSelectionRequest req,
                                                    @AuthenticationPrincipal Long userId) {
        return Result.success(jobDraftService.updateSelection(batchId, req, userId));
    }

    @Operation(summary = "批量导入职位草稿到职位工作台")
    @PostMapping("/batches/{batchId}/import")
    public Result<ImportJobDraftItemsResultDTO> importItems(@PathVariable String batchId,
                                                            @Valid @RequestBody ImportJobDraftItemsRequest req,
                                                            @AuthenticationPrincipal Long userId) {
        return Result.success(jobDraftService.importItems(batchId, req, userId));
    }
}
