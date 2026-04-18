import type { AuthResponse, AuthSession } from '../types/auth';

const AUTH_STORAGE_KEY = 'nbwf_auth_session';

export function toAuthSession(response: AuthResponse): AuthSession {
  return {
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
    userId: response.userId,
    email: response.email,
    role: response.role,
  };
}

export function loadAuthSession(): AuthSession | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(AUTH_STORAGE_KEY);
  } catch {
    return null;
  }

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (
      typeof parsed.accessToken !== 'string' ||
      typeof parsed.refreshToken !== 'string' ||
      typeof parsed.userId !== 'number' ||
      typeof parsed.email !== 'string' ||
      typeof parsed.role !== 'string'
    ) {
      clearAuthSession();
      return null;
    }
    return parsed as AuthSession;
  } catch {
    clearAuthSession();
    return null;
  }
}

export function saveAuthSession(session: AuthSession): void {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  } catch {}
}

export function clearAuthSession(): void {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {}
}

export function getAccessToken(): string | null {
  return loadAuthSession()?.accessToken ?? null;
}
