const state = {
  activeTabId: null,
  context: null,
  resumes: [],
  loading: false,
};

const elements = {
  refreshButton: document.getElementById('refreshButton'),
  statusBadge: document.getElementById('statusBadge'),
  statusText: document.getElementById('statusText'),
  resumeSelect: document.getElementById('resumeSelect'),
  syncListButton: document.getElementById('syncListButton'),
  syncDetailButton: document.getElementById('syncDetailButton'),
  openDraftButton: document.getElementById('openDraftButton'),
  restoreBatchButton: document.getElementById('restoreBatchButton'),
  actionHint: document.getElementById('actionHint'),
  batchTitle: document.getElementById('batchTitle'),
  batchMeta: document.getElementById('batchMeta'),
  taskTitle: document.getElementById('taskTitle'),
  taskMeta: document.getElementById('taskMeta'),
};

document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  void initializePopup();
});

function bindEvents() {
  elements.refreshButton.addEventListener('click', () => {
    void initializePopup();
  });

  elements.resumeSelect.addEventListener('change', async (event) => {
    const value = Number(event.target.value);
    const resumeId = Number.isFinite(value) && value > 0 ? value : null;
    await sendMessage('NBWF_SET_SELECTED_RESUME', { resumeId });
    if (state.context) {
      state.context.selectedResumeId = resumeId;
    }
    render();
  });

  elements.syncListButton.addEventListener('click', () => {
    void runAction('NBWF_SYNC_LIST_PAGE');
  });

  elements.syncDetailButton.addEventListener('click', () => {
    void runAction('NBWF_SYNC_DETAIL_PAGE');
  });

  elements.openDraftButton.addEventListener('click', () => {
    void runAction('NBWF_OPEN_DRAFT_PAGE', {
      batchId: state.context?.lastTask?.batchId || state.context?.lastBatch?.batchId || null,
    });
  });

  elements.restoreBatchButton.addEventListener('click', () => {
    void runAction('NBWF_RESTORE_LAST_BATCH');
  });
}

async function initializePopup() {
  setLoading(true);
  try {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    state.activeTabId = activeTab?.id ?? null;
    state.context = await sendMessage('NBWF_GET_CONTEXT', {
      tabId: state.activeTabId,
      url: activeTab?.url ?? null,
    });

    if (state.context.authReady) {
      state.resumes = await sendMessage('NBWF_LOAD_RESUMES');
      if (!state.context.lastBatch) {
        const restoredBatch = await sendMessage('NBWF_RESTORE_LAST_BATCH');
        if (restoredBatch) {
          state.context = await sendMessage('NBWF_GET_CONTEXT', {
            tabId: state.activeTabId,
            url: activeTab?.url ?? null,
          });
        }
      }
      if (
        state.context.selectedResumeId == null &&
        Array.isArray(state.resumes) &&
        state.resumes.length > 0
      ) {
        const fallbackId = state.resumes[0].id;
        await sendMessage('NBWF_SET_SELECTED_RESUME', { resumeId: fallbackId });
        state.context.selectedResumeId = fallbackId;
      }
    } else {
      state.resumes = [];
    }
  } catch (error) {
    state.context = {
      authReady: false,
      pageType: 'unknown',
      selectedResumeId: null,
      lastTask: {
        status: 'FAILED',
        message: getErrorMessage(error),
        updatedAt: new Date().toISOString(),
      },
      lastBatch: null,
    };
    state.resumes = [];
  } finally {
    setLoading(false);
    render();
  }
}

async function runAction(type, payload = {}) {
  const actionNeedsTab = type !== 'NBWF_OPEN_DRAFT_PAGE' && type !== 'NBWF_RESTORE_LAST_BATCH';
  if (!state.activeTabId && actionNeedsTab) {
    renderTask({
      status: 'FAILED',
      message: '未找到当前活动标签页',
      updatedAt: new Date().toISOString(),
    });
    return;
  }

  setLoading(true);
  renderTask({
    status: 'RUNNING',
    message:
      type === 'NBWF_SYNC_DETAIL_PAGE'
        ? '正在补全当前 JD…'
        : type === 'NBWF_RESTORE_LAST_BATCH'
          ? '正在恢复最近批次…'
          : '任务已提交到后台执行…',
    updatedAt: new Date().toISOString(),
  });

  try {
    await sendMessage(type, {
      tabId: state.activeTabId,
      resumeId: state.context?.selectedResumeId ?? null,
      ...payload,
    });
    await initializePopup();
  } catch (error) {
    renderTask({
      status: 'FAILED',
      message: getErrorMessage(error),
      updatedAt: new Date().toISOString(),
    });
    setLoading(false);
  }
}

function render() {
  renderStatus();
  renderResumeOptions();
  renderActionHint();
  renderBatch(state.context?.lastBatch ?? null);
  renderTask(state.context?.lastTask ?? null);
  renderButtons();
}

function renderStatus() {
  if (!state.context) {
    setStatus('初始化中', 'badge-neutral', '正在读取扩展上下文…');
    return;
  }

  if (!state.context.authReady) {
    setStatus('未登录', 'badge-warning', '请先打开 NBWF 系统页面并登录一次，扩展会自动同步登录态。');
    return;
  }

  const pageTypeText = {
    list: 'BOSS 列表页',
    detail: 'BOSS 详情页',
    boss: 'BOSS 页面',
    unsupported: '非 BOSS 页面',
    unknown: '未知页面',
  }[state.context.pageType] || '未知页面';

  setStatus('已连接', 'badge-success', `登录账号：${state.context.authEmail || '已同步'}；当前页面：${pageTypeText}`);
}

function setStatus(label, badgeClassName, text) {
  elements.statusBadge.className = `badge ${badgeClassName}`;
  elements.statusBadge.textContent = label;
  elements.statusText.textContent = text;
}

function renderResumeOptions() {
  elements.resumeSelect.innerHTML = '';

  if (!state.context?.authReady) {
    appendOption('', '请先登录系统');
    elements.resumeSelect.disabled = true;
    return;
  }

  if (!Array.isArray(state.resumes) || state.resumes.length === 0) {
    appendOption('', '暂无可用简历');
    elements.resumeSelect.disabled = true;
    return;
  }

  appendOption('', '跟随最近批次 / 不指定');
  state.resumes.forEach((resume) => {
    appendOption(String(resume.id), `#${resume.id} ${resume.filename}`);
  });
  elements.resumeSelect.disabled = state.loading;
  elements.resumeSelect.value = state.context?.selectedResumeId ? String(state.context.selectedResumeId) : '';
}

function renderActionHint() {
  if (!state.context) {
    elements.actionHint.textContent = '正在读取当前页面状态…';
    return;
  }

  if (!state.context.authReady) {
    elements.actionHint.textContent = '请先打开 NBWF 系统并登录，扩展才能同步职位与恢复批次。';
    return;
  }

  if (state.context.pageType === 'list') {
    elements.actionHint.textContent = '当前是 BOSS 列表页，可直接同步当前页职位到草稿池。';
    return;
  }

  if (state.context.pageType === 'detail') {
    elements.actionHint.textContent = '当前是职位详情页，可补全完整 JD、匹配结果和开场话术。';
    return;
  }

  if (state.context.pageType === 'boss') {
    elements.actionHint.textContent = '当前是 BOSS 页面，但不是列表页或详情页；请切到对应页面后再操作。';
    return;
  }

  if (state.context.lastBatch?.batchId) {
    elements.actionHint.textContent = '当前不是 BOSS 页面，但你仍可恢复最近批次或打开职位草稿继续处理。';
    return;
  }

  elements.actionHint.textContent = '当前不是可同步页面；可先恢复最近批次，或切回 BOSS 列表页继续同步。';
}

function renderBatch(batch) {
  if (!batch?.batchId) {
    elements.batchTitle.textContent = '暂无最近批次';
    elements.batchMeta.textContent = '可以先在 BOSS 列表页同步职位，或点击“恢复最近批次”尝试找回。';
    return;
  }

  elements.batchTitle.textContent = `批次 ${batch.batchId}`;
  const totalCount = typeof batch.totalCount === 'number' ? `${batch.totalCount} 条` : '条数未知';
  const status = batch.batchStatus || '状态未知';
  const updatedAt = batch.updatedAt ? new Date(batch.updatedAt).toLocaleString('zh-CN') : '时间未知';
  const sourceTitle = batch.sourcePageTitle || batch.sourcePlatform || '来源未知';
  elements.batchMeta.textContent = `${status}，${totalCount}，${sourceTitle}，${updatedAt}`;
}

function appendOption(value, label) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  elements.resumeSelect.appendChild(option);
}

function renderTask(task) {
  if (!task) {
    elements.taskTitle.textContent = '暂无后台任务';
    elements.taskMeta.textContent = '等待执行';
    return;
  }

  const statusText = {
    RUNNING: '执行中',
    SUCCESS: '已完成',
    FAILED: '失败',
  }[task.status] || '等待执行';

  elements.taskTitle.textContent = task.message || statusText;
  const timeText = task.updatedAt ? new Date(task.updatedAt).toLocaleString('zh-CN') : '未知时间';
  const batchText = task.batchId ? `，批次 ${task.batchId}` : '';
  elements.taskMeta.textContent = `${statusText}${batchText}，${timeText}`;
}

function renderButtons() {
  const pageType = state.context?.pageType;
  const authReady = Boolean(state.context?.authReady);
  const hasBatch = Boolean(state.context?.lastTask?.batchId || state.context?.lastBatch?.batchId);

  elements.syncListButton.disabled = !authReady || state.loading || pageType !== 'list';
  elements.syncDetailButton.disabled = !authReady || state.loading || pageType !== 'detail';
  elements.openDraftButton.disabled = !authReady || state.loading || !hasBatch;
  elements.restoreBatchButton.disabled = !authReady || state.loading;
  elements.refreshButton.disabled = state.loading;
}

function setLoading(loading) {
  state.loading = loading;
  renderButtons();
}

function getErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }
  return '操作失败';
}

async function sendMessage(type, payload = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...payload });
  if (!response?.ok) {
    throw new Error(response?.error || '操作失败');
  }
  return response.data;
}
