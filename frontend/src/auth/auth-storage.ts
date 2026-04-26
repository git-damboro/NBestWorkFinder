import type { AuthResponse, AuthSession } from '../types/auth';

const AUTH_STORAGE_KEY = 'nbwf_auth_session';
const AUTH_SESSION_CHANGED_EVENT = 'nbwf:auth-session-changed';

function emitAuthSessionChanged(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new Event(AUTH_SESSION_CHANGED_EVENT));
}

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
  emitAuthSessionChanged();
}

export function clearAuthSession(): void {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {}
  emitAuthSessionChanged();
}

export function getAccessToken(): string | null {
  return loadAuthSession()?.accessToken ?? null;
}

export function getRefreshToken(): string | null {
  return loadAuthSession()?.refreshToken ?? null;
}

export function subscribeAuthSessionChange(listener: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === AUTH_STORAGE_KEY) {
      listener();
    }
  };

  window.addEventListener(AUTH_SESSION_CHANGED_EVENT, listener);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, listener);
    window.removeEventListener('storage', handleStorage);
  };
}
