import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { authApi } from '../api/auth';
import type { AuthSession, AuthUser, LoginRequest, RegisterRequest } from '../types/auth';
import { clearAuthSession, loadAuthSession, saveAuthSession, toAuthSession } from './auth-storage';

interface AuthContextValue {
  session: AuthSession | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (data: LoginRequest) => Promise<void>;
  register: (data: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  clearSession: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<AuthSession | null>(() => loadAuthSession());

  const applySession = useCallback((nextSession: AuthSession) => {
    saveAuthSession(nextSession);
    setSession(nextSession);
  }, []);

  const clearSession = useCallback(() => {
    clearAuthSession();
    setSession(null);
  }, []);

  const login = useCallback(async (data: LoginRequest) => {
    const response = await authApi.login(data);
    applySession(toAuthSession(response));
  }, [applySession]);

  const register = useCallback(async (data: RegisterRequest) => {
    const response = await authApi.register(data);
    applySession(toAuthSession(response));
  }, [applySession]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const user = useMemo<AuthUser | null>(() => {
    if (!session) {
      return null;
    }

    return {
      userId: session.userId,
      email: session.email,
      role: session.role,
    };
  }, [session]);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    user,
    isAuthenticated: Boolean(session?.accessToken),
    login,
    register,
    logout,
    clearSession,
  }), [session, user, login, register, logout, clearSession]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
