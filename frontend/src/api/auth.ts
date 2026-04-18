import request from './request';
import type { AuthResponse, LoginRequest, RegisterRequest } from '../types/auth';

export const authApi = {
  register(data: RegisterRequest): Promise<AuthResponse> {
    return request.post<AuthResponse>('/api/auth/register', data);
  },

  login(data: LoginRequest): Promise<AuthResponse> {
    return request.post<AuthResponse>('/api/auth/login', data);
  },

  logout(): Promise<void> {
    return request.post<void>('/api/auth/logout');
  },
};
