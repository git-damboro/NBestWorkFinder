package com.nbwf.modules.user.model;

public class AuthResponse {

    private String accessToken;
    private String refreshToken;
    private Long userId;
    private String email;
    private String role;

    public AuthResponse(String accessToken, String refreshToken, Long userId, String email, String role) {
        this.accessToken = accessToken;
        this.refreshToken = refreshToken;
        this.userId = userId;
        this.email = email;
        this.role = role;
    }

    public String getAccessToken() { return accessToken; }
    public String getRefreshToken() { return refreshToken; }
    public Long getUserId() { return userId; }
    public String getEmail() { return email; }
    public String getRole() { return role; }
}
