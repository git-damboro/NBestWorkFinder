(() => {
  const AUTH_STORAGE_KEY = 'nbwf_auth_session';

  function readAuthSession() {
    try {
      const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.accessToken !== 'string' || typeof parsed.refreshToken !== 'string') {
        return null;
      }

      return {
        accessToken: parsed.accessToken,
        refreshToken: parsed.refreshToken,
        userId: typeof parsed.userId === 'number' ? parsed.userId : null,
        email: typeof parsed.email === 'string' ? parsed.email : null,
        role: typeof parsed.role === 'string' ? parsed.role : null,
      };
    } catch {
      return null;
    }
  }

  async function syncAuthSession() {
    try {
      await chrome.runtime.sendMessage({
        type: 'NBWF_AUTH_SESSION_UPDATED',
        payload: readAuthSession(),
      });
    } catch {}
  }

  void syncAuthSession();

  window.addEventListener('focus', () => {
    void syncAuthSession();
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      void syncAuthSession();
    }
  });

  window.setInterval(() => {
    void syncAuthSession();
  }, 5000);
})();
