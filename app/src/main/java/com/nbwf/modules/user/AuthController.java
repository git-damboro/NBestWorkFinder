package com.nbwf.modules.user;

import com.nbwf.common.result.Result;
import com.nbwf.modules.user.model.AuthResponse;
import com.nbwf.modules.user.model.LoginRequest;
import com.nbwf.modules.user.model.RegisterRequest;
import com.nbwf.modules.user.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@Tag(name = "认证", description = "注册/登录/刷新/登出")
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @Operation(summary = "注册")
    @PostMapping("/register")
    public Result<AuthResponse> register(@Valid @RequestBody RegisterRequest req) {
        return Result.success(authService.register(req.getEmail(), req.getPassword()));
    }

    @Operation(summary = "登录")
    @PostMapping("/login")
    public Result<AuthResponse> login(@Valid @RequestBody LoginRequest req) {
        return Result.success(authService.login(req.getEmail(), req.getPassword()));
    }

    @Operation(summary = "刷新 Token")
    @PostMapping("/refresh")
    public Result<AuthResponse> refresh(@RequestParam String refreshToken) {
        return Result.success(authService.refresh(refreshToken));
    }

    @Operation(summary = "登出")
    @PostMapping("/logout")
    public Result<Void> logout(@AuthenticationPrincipal Long userId) {
        authService.logout(userId);
        return Result.success();
    }
}
