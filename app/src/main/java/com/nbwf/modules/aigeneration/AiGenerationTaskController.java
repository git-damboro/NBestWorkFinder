package com.nbwf.modules.aigeneration;

import com.nbwf.common.result.Result;
import com.nbwf.modules.aigeneration.model.AiGenerationTaskDTO;
import com.nbwf.modules.aigeneration.model.AiGenerationTaskType;
import com.nbwf.modules.aigeneration.service.AiGenerationTaskService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

/**
 * 通用 AI 生成任务查询接口。
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/ai-generation/tasks")
@Tag(name = "AI 生成任务", description = "查询长耗时 AI 生成任务状态与最近结果")
public class AiGenerationTaskController {

    private final AiGenerationTaskService aiGenerationTaskService;

    /**
     * 查询单个任务状态。
     */
    @GetMapping("/{taskId}")
    @Operation(summary = "查询 AI 生成任务")
    public Result<AiGenerationTaskDTO> getTask(@PathVariable String taskId,
                                               @AuthenticationPrincipal Long userId) {
        return Result.success(aiGenerationTaskService.getTask(taskId, userId));
    }

    /**
     * 查询指定来源最近一次任务。
     */
    @GetMapping("/latest")
    @Operation(summary = "查询最近一次 AI 生成任务")
    public Result<AiGenerationTaskDTO> getLatestTask(@RequestParam AiGenerationTaskType type,
                                                     @RequestParam Long sourceId,
                                                     @AuthenticationPrincipal Long userId) {
        return Result.success(aiGenerationTaskService.getLatestTask(userId, type, sourceId));
    }
}
