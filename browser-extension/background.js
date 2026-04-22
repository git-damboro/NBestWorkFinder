const DEFAULT_API_BASE = 'http://localhost:8080';
const DEFAULT_APP_BASE = 'http://localhost:5173';

const STORAGE_KEYS = {
  auth: 'nbwf_extension_auth',
  lastTask: 'nbwf_extension_last_task',
  lastBatch: 'nbwf_extension_last_batch',
  selectedResumeId: 'nbwf_extension_selected_resume_id',
};

const ALLOWED_APP_ORIGINS = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

chrome.runtime.onInstalled.addListener(() => {
  void ensureStorageDefaults();
});

chrome.runtime.onStartup.addListener(() => {
  void ensureStorageDefaults();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  void handleMessage(message, sender)
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : '操作失败' }));
  return true;
});

async function handleMessage(message, sender) {
  switch (message?.type) {
    case 'NBWF_AUTH_SESSION_UPDATED':
      return upsertAuthSession(message.payload, sender);
    case 'NBWF_GET_CONTEXT':
      return getPopupContext(message.tabId, message.url);
    case 'NBWF_LOAD_RESUMES':
      return loadResumes();
    case 'NBWF_SET_SELECTED_RESUME':
      return setSelectedResumeId(message.resumeId);
    case 'NBWF_SYNC_LIST_PAGE':
      return syncListPageJobs(message.tabId, message.resumeId);
    case 'NBWF_SYNC_DETAIL_PAGE':
      return syncDetailPageJob(message.tabId, message.resumeId);
    case 'NBWF_OPEN_DRAFT_PAGE':
      return openDraftPage(message.batchId);
    case 'NBWF_RESTORE_LAST_BATCH':
      return restoreLastBatch();
    default:
      throw new Error('未知消息类型');
  }
}

async function ensureStorageDefaults() {
  const stored = await chrome.storage.local.get([
    STORAGE_KEYS.auth,
    STORAGE_KEYS.lastTask,
    STORAGE_KEYS.lastBatch,
    STORAGE_KEYS.selectedResumeId,
  ]);

  const patch = {};
  if (!stored[STORAGE_KEYS.lastTask]) {
    patch[STORAGE_KEYS.lastTask] = null;
  }
  if (!stored[STORAGE_KEYS.lastBatch]) {
    patch[STORAGE_KEYS.lastBatch] = null;
  }
  if (!(STORAGE_KEYS.selectedResumeId in stored)) {
    patch[STORAGE_KEYS.selectedResumeId] = null;
  }

  if (Object.keys(patch).length > 0) {
    await chrome.storage.local.set(patch);
  }
}

async function upsertAuthSession(payload, sender) {
  if (!isAllowedAppSender(sender?.url)) {
    return { synced: false, ignored: true };
  }

  if (!payload || !payload.accessToken || !payload.refreshToken) {
    await chrome.storage.local.set({ [STORAGE_KEYS.auth]: null });
    return { synced: false };
  }

  const origin = sender?.url ? new URL(sender.url).origin : payload.appBase || DEFAULT_APP_BASE;
  const auth = {
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    userId: payload.userId ?? null,
    email: payload.email ?? null,
    role: payload.role ?? null,
    appBase: origin,
    syncedAt: new Date().toISOString(),
  };

  await chrome.storage.local.set({ [STORAGE_KEYS.auth]: auth });
  return { synced: true, auth };
}

async function getPopupContext(tabId, explicitUrl) {
  const [{ [STORAGE_KEYS.auth]: auth, [STORAGE_KEYS.lastTask]: lastTask, [STORAGE_KEYS.lastBatch]: lastBatch, [STORAGE_KEYS.selectedResumeId]: selectedResumeId }, tab] = await Promise.all([
    chrome.storage.local.get([
      STORAGE_KEYS.auth,
      STORAGE_KEYS.lastTask,
      STORAGE_KEYS.lastBatch,
      STORAGE_KEYS.selectedResumeId,
    ]),
    resolveTab(tabId, explicitUrl),
  ]);

  return {
    authReady: Boolean(auth?.accessToken),
    authEmail: auth?.email ?? null,
    appBase: auth?.appBase ?? DEFAULT_APP_BASE,
    apiBase: DEFAULT_API_BASE,
    pageType: detectBossPageType(tab?.url),
    pageUrl: tab?.url ?? explicitUrl ?? null,
    selectedResumeId: selectedResumeId ?? null,
    lastTask: lastTask ?? null,
    lastBatch: lastBatch ?? null,
  };
}

async function resolveTab(tabId, explicitUrl) {
  if (tabId) {
    try {
      return await chrome.tabs.get(tabId);
    } catch {}
  }

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab) {
    return activeTab;
  }
  return explicitUrl ? { url: explicitUrl } : null;
}

function detectBossPageType(url) {
  const parsed = safeParseUrl(url);
  if (!parsed) {
    return 'unknown';
  }
  if (!isBossHost(parsed.hostname)) {
    return 'unsupported';
  }
  if (parsed.pathname.includes('/job_detail/')) {
    return 'detail';
  }
  if (
    parsed.pathname.includes('/web/geek/job')
    || parsed.pathname.includes('/web/geek/jobs')
    || parsed.pathname.includes('/web/geek/recommend')
    || parsed.pathname.includes('/joblist')
  ) {
    return 'list';
  }
  return 'boss';
}

async function loadResumes() {
  return apiRequest('/api/resumes', { method: 'GET' });
}

async function setSelectedResumeId(resumeId) {
  const normalized = typeof resumeId === 'number' && Number.isFinite(resumeId) ? resumeId : null;
  await chrome.storage.local.set({ [STORAGE_KEYS.selectedResumeId]: normalized });
  return { selectedResumeId: normalized };
}

async function syncListPageJobs(tabId, resumeId) {
  try {
    const tab = await requireTabByPageType(tabId, 'list');

    await setLastTask({
      type: 'PAGE_SYNC',
      status: 'RUNNING',
      message: '正在同步当前页职位，请稍候…',
    });

    const pageData = await sendTabMessage(tab.id, { type: 'NBWF_EXTRACT_LIST_PAGE' });
    if (!pageData?.jobs?.length) {
      throw new Error('当前页面未识别到可同步的职位卡片');
    }

    const payload = {
      resumeId: normalizeResumeId(resumeId),
      sourcePlatform: 'BOSS',
      sourcePageUrl: pageData.sourcePageUrl,
      sourcePageTitle: pageData.sourcePageTitle,
      pageFingerprint: pageData.pageFingerprint,
      jobs: pageData.jobs,
    };

    const batch = await apiRequest('/api/job-drafts/batches/from-page-sync', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const items = await apiRequest(`/api/job-drafts/batches/${encodeURIComponent(batch.batchId)}/items`, {
      method: 'GET',
    });

    const lastBatch = {
      batchId: batch.batchId,
      batchStatus: batch.status ?? null,
      totalCount: batch.totalCount ?? (Array.isArray(items) ? items.length : 0),
      resumeId: payload.resumeId ?? null,
      sourcePlatform: 'BOSS',
      sourcePageUrl: payload.sourcePageUrl ?? null,
      sourcePageTitle: payload.sourcePageTitle ?? null,
      items: Array.isArray(items) ? items.map(toCachedDraftItem) : [],
      updatedAt: new Date().toISOString(),
    };

    await chrome.storage.local.set({
      [STORAGE_KEYS.lastBatch]: lastBatch,
      [STORAGE_KEYS.selectedResumeId]: payload.resumeId ?? null,
    });

    await setLastTask({
      type: 'PAGE_SYNC',
      status: 'SUCCESS',
      message: `当前页同步完成，共 ${batch.totalCount} 条职位草稿`,
      batchId: batch.batchId,
      totalCount: batch.totalCount,
    });

    return {
      batchId: batch.batchId,
      totalCount: batch.totalCount,
      sourcePageTitle: payload.sourcePageTitle ?? null,
    };
  } catch (error) {
    await setLastTask({
      type: 'PAGE_SYNC',
      status: 'FAILED',
      message: error instanceof Error ? error.message : '同步当前页职位失败',
    });
    throw error;
  }
}

async function syncDetailPageJob(tabId, resumeId) {
  try {
    const tab = await requireTabByPageType(tabId, 'detail');

    await setLastTask({
      type: 'DETAIL_SYNC',
      status: 'RUNNING',
      message: '正在补全当前职位 JD，请稍候…',
    });

    const detail = await sendTabMessage(tab.id, { type: 'NBWF_EXTRACT_DETAIL_PAGE' });
    if (!detail?.title || !detail?.company) {
      throw new Error('当前页面未识别到职位详情，请打开具体职位详情页后重试');
    }

    const matchingContext = await resolveMatchingDraft(detail);
    if (!matchingContext) {
      throw new Error('未找到对应职位草稿，请先在 BOSS 列表页执行一次“同步当前页职位”');
    }

    const syncPayload = {
      ...detail,
      resumeId: normalizeResumeId(resumeId) ?? matchingContext.resumeId ?? null,
    };

    const updatedItem = await apiRequest(
      `/api/job-drafts/items/${encodeURIComponent(matchingContext.item.draftItemId)}/detail-sync`,
      {
        method: 'POST',
        body: JSON.stringify(syncPayload),
      },
    );

    await patchCachedDraftItem(updatedItem);
    await setLastTask({
      type: 'DETAIL_SYNC',
      status: 'SUCCESS',
      message: `JD 补全完成：${updatedItem.title}`,
      batchId: updatedItem.batchId,
      draftItemId: updatedItem.draftItemId,
      preciseMatchScore: updatedItem.preciseMatchScore ?? null,
    });

    return {
      batchId: updatedItem.batchId,
      draftItemId: updatedItem.draftItemId,
      preciseMatchScore: updatedItem.preciseMatchScore ?? null,
      detailSyncStatus: updatedItem.detailSyncStatus,
    };
  } catch (error) {
    await setLastTask({
      type: 'DETAIL_SYNC',
      status: 'FAILED',
      message: error instanceof Error ? error.message : '补全当前 JD 失败',
    });
    throw error;
  }
}

async function resolveMatchingDraft(detail) {
  const { [STORAGE_KEYS.lastBatch]: lastBatch } = await chrome.storage.local.get(STORAGE_KEYS.lastBatch);
  const cachedMatch = findDraftItemMatch(lastBatch, detail);
  if (cachedMatch) {
    return cachedMatch;
  }

  const lastBatchCache = await restoreLastBatch();
  if (!lastBatchCache) {
    return null;
  }
  return findDraftItemMatch(lastBatchCache, detail);
}

function findDraftItemMatch(batchCache, detail) {
  if (!batchCache?.items?.length) {
    return null;
  }

  const detailKeys = buildMatchKeys(detail.externalJobId, detail.sourceUrl, detail.title, detail.company);
  for (const item of batchCache.items) {
    const itemKeys = buildMatchKeys(item.externalJobId, item.sourceUrl, item.title, item.company);
    if (itemKeys.some((key) => detailKeys.includes(key))) {
      return { resumeId: batchCache.resumeId ?? null, item };
    }
  }
  return null;
}

function buildMatchKeys(externalJobId, sourceUrl, title, company) {
  const keys = [];
  if (externalJobId) {
    keys.push(`job:${String(externalJobId).trim()}`);
  }

  const normalizedUrl = normalizeJobUrl(sourceUrl);
  if (normalizedUrl) {
    keys.push(`url:${normalizedUrl}`);
  }

  const titleText = normalizeText(title);
  const companyText = normalizeText(company);
  if (titleText && companyText) {
    keys.push(`title:${titleText}|company:${companyText}`);
  }
  return keys;
}

function normalizeJobUrl(sourceUrl) {
  if (!sourceUrl) {
    return '';
  }
  try {
    const url = new URL(sourceUrl);
    const picked = new URL(url.origin + url.pathname);
    const securityId = url.searchParams.get('securityId');
    if (securityId) {
      picked.searchParams.set('securityId', securityId);
    }
    return picked.toString();
  } catch {
    return String(sourceUrl).trim();
  }
}

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function toCachedDraftItem(item) {
  return {
    draftItemId: item.draftItemId,
    batchId: item.batchId,
    externalJobId: item.externalJobId ?? null,
    sourceUrl: item.sourceUrl ?? null,
    title: item.title,
    company: item.company,
    detailSyncStatus: item.detailSyncStatus ?? 'UNSYNCED',
    preciseMatchScore: item.preciseMatchScore ?? null,
    matchSummary: item.matchSummary ?? null,
  };
}

async function patchCachedDraftItem(updatedItem) {
  const { [STORAGE_KEYS.lastBatch]: lastBatch } = await chrome.storage.local.get(STORAGE_KEYS.lastBatch);
  if (!lastBatch?.items?.length) {
    return;
  }

  const nextItems = lastBatch.items.map((item) => (
    item.draftItemId === updatedItem.draftItemId
      ? toCachedDraftItem(updatedItem)
      : item
  ));

  await chrome.storage.local.set({
    [STORAGE_KEYS.lastBatch]: {
      ...lastBatch,
      batchId: updatedItem.batchId ?? lastBatch.batchId,
      items: nextItems,
      updatedAt: new Date().toISOString(),
    },
  });
}

async function openDraftPage(batchId) {
  const { [STORAGE_KEYS.auth]: auth, [STORAGE_KEYS.lastBatch]: lastBatch } = await chrome.storage.local.get([
    STORAGE_KEYS.auth,
    STORAGE_KEYS.lastBatch,
  ]);

  let targetBatchId = batchId || lastBatch?.batchId;
  if (!targetBatchId && auth?.accessToken) {
    const restoredBatch = await restoreLastBatch();
    targetBatchId = restoredBatch?.batchId ?? null;
  }
  if (!targetBatchId) {
    throw new Error('当前还没有可打开的职位草稿批次');
  }

  const appBase = auth?.appBase ?? DEFAULT_APP_BASE;
  const targetUrl = `${appBase.replace(/\/$/, '')}/jobs/drafts?batchId=${encodeURIComponent(targetBatchId)}`;
  await chrome.tabs.create({ url: targetUrl });
  return { batchId: targetBatchId, url: targetUrl };
}

async function restoreLastBatch() {
  const latestBatch = await apiRequest('/api/job-drafts/batches/latest', { method: 'GET' });
  if (!latestBatch?.batchId) {
    await chrome.storage.local.set({ [STORAGE_KEYS.lastBatch]: null });
    return null;
  }

  const items = await apiRequest(`/api/job-drafts/batches/${encodeURIComponent(latestBatch.batchId)}/items`, {
    method: 'GET',
  });
  const lastBatchCache = {
    batchId: latestBatch.batchId,
    batchStatus: latestBatch.status ?? null,
    totalCount: latestBatch.totalCount ?? (Array.isArray(items) ? items.length : 0),
    resumeId: latestBatch.resumeId ?? null,
    sourcePlatform: latestBatch.sourcePlatform ?? 'BOSS',
    sourcePageUrl: latestBatch.sourcePageUrl ?? null,
    sourcePageTitle: latestBatch.sourcePageTitle ?? null,
    items: Array.isArray(items) ? items.map(toCachedDraftItem) : [],
    updatedAt: latestBatch.updatedAt ?? new Date().toISOString(),
  };
  await chrome.storage.local.set({ [STORAGE_KEYS.lastBatch]: lastBatchCache });
  return lastBatchCache;
}

async function setLastTask(task) {
  await chrome.storage.local.set({
    [STORAGE_KEYS.lastTask]: {
      ...task,
      updatedAt: new Date().toISOString(),
    },
  });
}

async function apiRequest(path, options) {
  const { [STORAGE_KEYS.auth]: auth } = await chrome.storage.local.get(STORAGE_KEYS.auth);
  if (!auth?.accessToken) {
    throw new Error('扩展还没有同步到系统登录态，请先打开系统页面并登录一次');
  }

  const requestOptions = {
    method: options?.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${auth.accessToken}`,
      ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options?.body,
  };

  let response = await fetch(`${DEFAULT_API_BASE}${path}`, requestOptions);
  if (response.status === 401 && auth.refreshToken) {
    const refreshed = await tryRefreshAuth(auth.refreshToken);
    if (refreshed?.accessToken) {
      requestOptions.headers.Authorization = `Bearer ${refreshed.accessToken}`;
      response = await fetch(`${DEFAULT_API_BASE}${path}`, requestOptions);
    }
  }

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const message = result?.message || `请求失败（${response.status}）`;
    throw new Error(message);
  }
  if (!result || typeof result !== 'object' || !('code' in result)) {
    throw new Error('接口返回格式不符合预期');
  }
  if (result.code !== 200) {
    throw new Error(result.message || '请求失败');
  }
  return result.data;
}

async function tryRefreshAuth(refreshToken) {
  const response = await fetch(
    `${DEFAULT_API_BASE}/api/auth/refresh?refreshToken=${encodeURIComponent(refreshToken)}`,
    { method: 'POST' },
  );
  const result = await response.json().catch(() => null);
  if (!response.ok || !result || result.code !== 200 || !result.data?.accessToken) {
    await chrome.storage.local.set({ [STORAGE_KEYS.auth]: null });
    throw new Error(result?.message || '登录态已失效，请重新打开系统页面并登录');
  }

  const { [STORAGE_KEYS.auth]: currentAuth } = await chrome.storage.local.get(STORAGE_KEYS.auth);
  const nextAuth = {
    ...currentAuth,
    ...result.data,
    appBase: currentAuth?.appBase ?? DEFAULT_APP_BASE,
    syncedAt: new Date().toISOString(),
  };
  await chrome.storage.local.set({ [STORAGE_KEYS.auth]: nextAuth });
  return nextAuth;
}

async function sendTabMessage(tabId, message) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, message);
    if (response?.error) {
      throw new Error(response.error);
    }
    return response;
  } catch (error) {
    const messageText = error instanceof Error ? error.message : '';
    if (
      messageText.includes('Receiving end does not exist')
      || messageText.includes('Could not establish connection')
    ) {
      throw new Error('当前页面未注入扩展脚本，请刷新 BOSS 页面后重试。');
    }
    if (messageText) {
      throw error;
    }
    throw new Error('当前页面未注入扩展脚本，请确认你正在 BOSS 职位列表页或详情页');
  }
}

function normalizeResumeId(resumeId) {
  return typeof resumeId === 'number' && Number.isFinite(resumeId) ? resumeId : null;
}

function safeParseUrl(url) {
  if (!url) {
    return null;
  }
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function isBossHost(hostname) {
  return hostname === 'zhipin.com' || hostname === 'www.zhipin.com' || hostname.endsWith('.zhipin.com');
}

function isAllowedAppSender(url) {
  const parsed = safeParseUrl(url);
  return Boolean(parsed && ALLOWED_APP_ORIGINS.has(parsed.origin));
}

async function requireTabByPageType(tabId, expectedType) {
  if (!tabId) {
    throw new Error('未找到当前标签页');
  }

  const tab = await chrome.tabs.get(tabId);
  const pageType = detectBossPageType(tab?.url);
  if (pageType !== expectedType) {
    if (expectedType === 'list') {
      throw new Error('请先打开 BOSS 职位列表页再执行同步。');
    }
    if (expectedType === 'detail') {
      throw new Error('请先打开具体职位详情页后再补全当前 JD。');
    }
  }
  return tab;
}
