package com.nbwf.modules.user.service;

import com.nbwf.common.exception.BusinessException;
import com.nbwf.common.exception.ErrorCode;
import com.nbwf.modules.user.config.JwtProperties;
import com.nbwf.modules.user.model.AuthResponse;
import com.nbwf.modules.user.model.UserEntity;
import com.nbwf.modules.user.repository.UserRepository;
import org.redisson.api.RBucket;
import org.redisson.api.RedissonClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
public class AuthService {

    private static final String REFRESH_TOKEN_KEY = "refresh_token:";

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final JwtProperties jwtProperties;
    private final RedissonClient redissonClient;

    public AuthService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtService jwtService,
                       JwtProperties jwtProperties,
                       RedissonClient redissonClient) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.jwtProperties = jwtProperties;
        this.redissonClient = redissonClient;
    }

    public AuthResponse register(String email, String rawPassword) {
        if (userRepository.existsByEmail(email)) {
            throw new BusinessException(ErrorCode.USER_EMAIL_EXISTS);
        }
        UserEntity user = new UserEntity();
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(rawPassword));
        userRepository.save(user);
        return buildTokens(user);
    }

    public AuthResponse login(String email, String rawPassword) {
        UserEntity user = userRepository.findByEmail(email)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_PASSWORD_INCORRECT));
        if (!passwordEncoder.matches(rawPassword, user.getPassword())) {
            throw new BusinessException(ErrorCode.USER_PASSWORD_INCORRECT);
        }
        return buildTokens(user);
    }

    public AuthResponse refresh(String refreshToken) {
        if (!jwtService.isValid(refreshToken)) {
            throw new BusinessException(ErrorCode.USER_REFRESH_TOKEN_INVALID);
        }
        Long userId = jwtService.extractUserId(refreshToken);
        RBucket<String> bucket = redissonClient.getBucket(REFRESH_TOKEN_KEY + userId);
        String stored = bucket.get();
        if (!refreshToken.equals(stored)) {
            throw new BusinessException(ErrorCode.USER_REFRESH_TOKEN_INVALID);
        }
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
        return buildTokens(user);
    }

    public void logout(Long userId) {
        redissonClient.getBucket(REFRESH_TOKEN_KEY + userId).delete();
    }

    private AuthResponse buildTokens(UserEntity user) {
        String accessToken = jwtService.generateAccessToken(user.getId(), user.getEmail(), user.getRole().name());
        String refreshToken = jwtService.generateRefreshToken(user.getId());
        RBucket<String> bucket = redissonClient.getBucket(REFRESH_TOKEN_KEY + user.getId());
        bucket.set(refreshToken, Duration.ofSeconds(jwtProperties.getRefreshTokenExpiry()));
        return new AuthResponse(accessToken, refreshToken, user.getId(), user.getEmail(), user.getRole().name());
    }
}
