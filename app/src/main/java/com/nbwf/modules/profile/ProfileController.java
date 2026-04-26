package com.nbwf.modules.profile;

import com.nbwf.common.result.Result;
import com.nbwf.modules.profile.model.CreateUserExperienceRequest;
import com.nbwf.modules.profile.model.UpdateUserExperienceRequest;
import com.nbwf.modules.profile.model.UserExperienceDTO;
import com.nbwf.modules.profile.service.UserExperienceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "我的经历", description = "维护用户可复用的求职经历、项目亮点、技能和偏好素材")
@RestController
@RequestMapping("/api/profile/experiences")
@RequiredArgsConstructor
public class ProfileController {

    private final UserExperienceService userExperienceService;

    @Operation(summary = "查询我的经历")
    @GetMapping
    public Result<List<UserExperienceDTO>> list(@AuthenticationPrincipal Long userId,
                                                @RequestParam(required = false) Boolean enabled) {
        if (Boolean.TRUE.equals(enabled)) {
            return Result.success(userExperienceService.listEnabled(userId));
        }
        return Result.success(userExperienceService.list(userId));
    }

    @Operation(summary = "新增我的经历")
    @PostMapping
    public Result<UserExperienceDTO> create(@Valid @RequestBody CreateUserExperienceRequest req,
                                            @AuthenticationPrincipal Long userId) {
        return Result.success(userExperienceService.create(req, userId));
    }

    @Operation(summary = "更新我的经历")
    @PutMapping("/{id}")
    public Result<UserExperienceDTO> update(@PathVariable Long id,
                                            @Valid @RequestBody UpdateUserExperienceRequest req,
                                            @AuthenticationPrincipal Long userId) {
        return Result.success(userExperienceService.update(id, req, userId));
    }

    @Operation(summary = "删除我的经历")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id,
                               @AuthenticationPrincipal Long userId) {
        userExperienceService.delete(id, userId);
        return Result.success();
    }
}
