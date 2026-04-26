const DEFAULT_API_BASE = 'http://localhost:8080';
const DEFAULT_FRONTEND_BASE = 'http://localhost:5173';

const apiBaseInput = document.getElementById('apiBase');
const frontendBaseInput = document.getElementById('frontendBase');
const accessTokenInput = document.getElementById('accessToken');
const loadTokenButton = document.getElementById('loadToken');
const saveConfigButton = document.getElementById('saveConfig');
const importJobButton = document.getElementById('importJob');
const openAppButton = document.getElementById('openApp');
const statusBox = document.getElementById('status');

function setStatus(message, type = '') {
  statusBox.textContent = message;
  statusBox.className = `status ${type}`.trim();
}

function cleanText(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function getTextBySelectors(selectors) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    const text = cleanText(element?.innerText || element?.textContent || '');
    if (text) {
      return text;
    }
  }
  return '';
}

function getLongTextBySelectors(selectors) {
  let bestText = '';
  for (const selector of selectors) {
    document.querySelectorAll(selector).forEach((element) => {
      const text = cleanText(element.innerText || element.textContent || '');
      if (text.length > bestText.length) {
        bestText = text;
      }
    });
  }
  return bestText;
}

function parseBossJobId(url) {
  const match = url.match(/job_detail\/([^/?#.]+)/);
  return match?.[1] || undefined;
}

function parseSalaryText(salaryText) {
  const normalized = cleanText(salaryText).toUpperCase();
  const rangeMatch = normalized.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*K/);
  if (rangeMatch) {
    return {
      salaryMin: Math.round(Number(rangeMatch[1]) * 1000),
      salaryMax: Math.round(Number(rangeMatch[2]) * 1000),
    };
  }
  const singleMatch = normalized.match(/(\d+(?:\.\d+)?)\s*K/);
  if (singleMatch) {
    return {
      salaryMin: Math.round(Number(singleMatch[1]) * 1000),
      salaryMax: undefined,
    };
  }
  return {};
}

function extractTechTags(text) {
  const keywords = [
    'Java',
    'SpringBoot',
    'Spring Boot',
    'Python',
    'RAG',
    'Agent',
    '向量检索',
    '知识库',
    'SSE',
    '流式',
    '接口',
    '后端',
    '前端',
    '全栈',
    'PostgreSQL',
    'Redis',
    'AI应用',
    '工程化',
  ];
  const lowerText = text.toLowerCase();
  return Array.from(new Set(
    keywords
      .filter((keyword) => lowerText.includes(keyword.toLowerCase()))
      .map((keyword) => keyword === 'Spring Boot' ? 'SpringBoot' : keyword),
  )).slice(0, 12);
}

function extractCurrentPageJob() {
  function cleanInjectedText(value) {
    return (value || '').replace(/\s+/g, ' ').trim();
  }

  function cleanInjectedBlockText(value) {
    return (value || '')
      .replace(/\r/g, '\n')
      .replace(/[ \t\f\v]+/g, ' ')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function getInjectedTextBySelectors(selectors) {
    return getInjectedTextBySelectorsIn(document, selectors);
  }

  function getInjectedTextBySelectorsIn(root, selectors) {
    for (const selector of selectors) {
      const element = root.querySelector(selector);
      const text = cleanInjectedText(element?.innerText || element?.textContent || '');
      if (text) {
        return text;
      }
    }
    return '';
  }

  function getInjectedLongTextBySelectors(selectors) {
    return getInjectedLongTextBySelectorsIn(document, selectors);
  }

  function getInjectedLongTextBySelectorsIn(root, selectors) {
    let bestText = '';
    for (const selector of selectors) {
      root.querySelectorAll(selector).forEach((element) => {
        const text = cleanInjectedBlockText(element.innerText || element.textContent || '');
        if (text.length > bestText.length) {
          bestText = text;
        }
      });
    }
    return bestText;
  }

  function formatInjectedJobDescription(value) {
    let text = cleanInjectedBlockText(value)
      .replace(/^微信扫码分享\s*举\s*报\s*/g, '')
      .replace(/^职位描述\s*校招\s*/g, '')
      .replace(/^职位描述\s*/g, '');

    const stopWords = [
      '竞争力分析',
      '查看完整个人竞争力',
      'BOSS 安全提示',
      'BOSS直聘严禁',
      '杭州 搜索',
      '城市招聘',
      '热门职位',
      '推荐公司',
      '热门企业',
      '页面更新时间',
    ];
    for (const stopWord of stopWords) {
      const index = text.indexOf(stopWord);
      if (index >= 0) {
        text = text.slice(0, index);
      }
    }

    text = text.replace(/\s*([一-龥]{2,4})\s*(校招顾问|招聘顾问|HR)\s*$/g, '');

    return text
      .replace(/[ \t]*(职位描述[:：])[ \t]*/g, '$1\n')
      .replace(/\s*(岗位职责[:：])\s*/g, '\n\n$1\n')
      .replace(/\s*(任职要求[:：])\s*/g, '\n\n$1\n')
      .replace(/\s*(岗位要求[:：])\s*/g, '\n\n$1\n')
      .replace(/\s*(职位要求[:：])\s*/g, '\n\n$1\n')
      .replace(/\s*(任职资格[:：])\s*/g, '\n\n$1\n')
      .replace(/[ \t]*\*[ \t]*/g, '\n* ')
      .replace(/\s*([1-9][0-9]*[、.])\s*/g, '\n$1')
      .replace(/\n[ \t]*\n[ \t]*(岗位职责[:：]|任职要求[:：]|岗位要求[:：]|职位要求[:：]|任职资格[:：])/g, '\n\n$1')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function parseInjectedBossJobId(value) {
    const match = value.match(/job_detail\/([^/?#.]+)/);
    return match?.[1] || undefined;
  }

  function parseInjectedSalaryText(value) {
    const normalized = cleanInjectedText(value).toUpperCase();
    const rangeMatch = normalized.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*K/);
    if (rangeMatch) {
      return {
        salaryMin: Math.round(Number(rangeMatch[1]) * 1000),
        salaryMax: Math.round(Number(rangeMatch[2]) * 1000),
      };
    }
    const singleMatch = normalized.match(/(\d+(?:\.\d+)?)\s*K/);
    if (singleMatch) {
      return {
        salaryMin: Math.round(Number(singleMatch[1]) * 1000),
        salaryMax: undefined,
      };
    }
    return {};
  }

  function extractInjectedTechTags(text) {
    const keywords = [
      'Java',
      'SpringBoot',
      'Spring Boot',
      'Python',
      'C++',
      'RAG',
      'Agent',
      '向量检索',
      '知识库',
      'SSE',
      '流式',
      '接口',
      '后端',
      '前端',
      '全栈',
      'PostgreSQL',
      'Redis',
      'AI应用',
      '工程化',
      '算法',
      '机器学习',
      '深度学习',
      '视觉',
      '导航',
    ];
    const lowerText = text.toLowerCase();
    return Array.from(new Set(
      keywords
        .filter((keyword) => lowerText.includes(keyword.toLowerCase()))
        .map((keyword) => keyword === 'Spring Boot' ? 'SpringBoot' : keyword),
    )).slice(0, 12);
  }

  const url = window.location.href;
  const host = window.location.hostname;
  const platform = host.includes('zhipin.com') ? 'BOSS' : 'WEB';
  const detailRoot = document.querySelector('.job-detail-box')
    || document.querySelector('.job-detail-container')
    || document.querySelector('.job-card-wrapper')
    || document.querySelector('.search-job-result .job-detail')
    || document;
  const selectedCard = document.querySelector('.job-card-box.active')
    || document.querySelector('.job-card-box.selected')
    || document.querySelector('.job-card-box:hover');
  const title = getInjectedTextBySelectorsIn(detailRoot, [
    '.job-name',
    '.job-title',
    '.detail-title',
    '.name',
    'h1',
    'h2',
  ]) || getInjectedTextBySelectors([
    '.job-card-box.active .job-name',
    '.job-card-box.active .job-title',
    '.job-name',
    '.job-banner .name',
    '.job-primary .name',
    '.info-primary .name',
    '.name',
    '[class*="job-title"]',
    '[class*="jobName"]',
    'h1',
  ]);
  const company = getInjectedTextBySelectorsIn(detailRoot, [
    '.company-name',
    '.company-info .name',
    '.info-company .name',
    '[class*="company-name"]',
    '[class*="companyName"]',
    '[class*="company"] a',
  ]) || (selectedCard ? getInjectedTextBySelectorsIn(selectedCard, [
    '.company-name',
    '.company-text',
    '[class*="company"]',
  ]) : '') || getInjectedTextBySelectors([
    '.job-banner .company',
    '.job-primary .company',
    '.info-company .name',
    '.company-info .name',
    '.company-name',
    '[class*="company-name"]',
    '[class*="companyName"]',
    '[class*="company"] a',
  ]);
  const location = getInjectedTextBySelectorsIn(detailRoot, [
    '.location-address',
    '.job-address',
    '.job-location',
    '[class*="location"]',
    '[class*="address"]',
  ]) || (selectedCard ? getInjectedTextBySelectorsIn(selectedCard, [
    '.job-area',
    '.job-location',
    '[class*="area"]',
  ]) : '') || getInjectedTextBySelectors([
    '.job-banner .job-tags span',
    '.job-primary .job-tags span',
    '.job-address',
    '.job-location',
    '.location-address',
    '[class*="location"]',
    '[class*="address"]',
  ]);
  const salaryText = getInjectedTextBySelectorsIn(detailRoot, [
    '.salary',
    '.job-salary',
    '[class*="salary"]',
  ]) || (selectedCard ? getInjectedTextBySelectorsIn(selectedCard, [
    '.salary',
    '.job-salary',
    '[class*="salary"]',
  ]) : '') || getInjectedTextBySelectors([
    '.job-banner .salary',
    '.job-primary .salary',
    '.salary',
    '.job-salary',
    '[class*="salary"]',
  ]);
  const description = getInjectedLongTextBySelectorsIn(detailRoot, [
    '.job-sec-text',
    '.job-detail-body',
    '.job-detail-content',
    '.job-detail-section',
    '.job-detail .job-sec-text',
    '.detail-content',
    '.job-description',
    '[class*="job-sec"]',
    '[class*="description"]',
  ]) || getInjectedLongTextBySelectors([
    '.job-sec-text',
    '.job-detail-section',
    '.job-detail .job-sec-text',
    '.detail-content',
    '.job-description',
  ]);
  const fallbackDescription = description || cleanInjectedBlockText(document.body.innerText).slice(0, 4000);
  const formattedDescription = formatInjectedJobDescription(fallbackDescription);
  const salary = parseInjectedSalaryText(salaryText);

  return {
    sourcePlatform: platform,
    externalJobId: platform === 'BOSS' ? parseInjectedBossJobId(url) : undefined,
    sourceUrl: url,
    title,
    company,
    location,
    salaryText,
    ...salary,
    description: formattedDescription,
    techTags: extractInjectedTechTags(`${title} ${formattedDescription}`),
  };
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

async function extractFromActiveTab() {
  const tab = await getActiveTab();
  if (!tab?.id) {
    throw new Error('未找到当前标签页');
  }
  if (!tab.url || !/^https?:\/\//.test(tab.url)) {
    throw new Error('当前标签页不是网页，请先打开 BOSS 岗位详情页再导入');
  }

  const [result] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: extractCurrentPageJob,
  });
  if (!result?.result) {
    throw new Error('无法读取当前页面内容，请刷新岗位页后重试');
  }
  return result.result;
}

async function loadConfig() {
  const config = await chrome.storage.local.get(['apiBase', 'frontendBase', 'accessToken']);
  apiBaseInput.value = config.apiBase || DEFAULT_API_BASE;
  frontendBaseInput.value = config.frontendBase || DEFAULT_FRONTEND_BASE;
  accessTokenInput.value = config.accessToken || '';
}

async function saveConfig() {
  await chrome.storage.local.set({
    apiBase: apiBaseInput.value.trim() || DEFAULT_API_BASE,
    frontendBase: frontendBaseInput.value.trim() || DEFAULT_FRONTEND_BASE,
    accessToken: accessTokenInput.value.trim(),
  });
  setStatus('配置已保存。', 'success');
}

function readTokenFromFrontendStorage() {
  const raw = localStorage.getItem('nbwf_auth_session');
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw)?.accessToken || null;
  } catch {
    return null;
  }
}

async function loadTokenFromFrontend() {
  const frontendBase = (frontendBaseInput.value.trim() || DEFAULT_FRONTEND_BASE).replace(/\/$/, '');
  const frontendUrl = `${frontendBase}/*`;
  setStatus('正在从已登录前端读取 Token...');

  try {
    const tabs = await chrome.tabs.query({ url: frontendUrl });
    const tab = tabs[0];
    if (!tab?.id) {
      throw new Error(`没有找到已打开的前端页面，请先打开并登录 ${frontendBase}`);
    }

    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: readTokenFromFrontendStorage,
    });
    const token = result?.result;
    if (!token) {
      throw new Error('前端页面没有登录 Token，请先在系统里重新登录');
    }

    accessTokenInput.value = token;
    await saveConfig();
    setStatus('已读取并保存最新 Token。', 'success');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : '读取 Token 失败', 'error');
  }
}

async function parseApiResult(response) {
  const rawText = await response.text();
  if (!rawText.trim()) {
    if (response.status === 401 || response.status === 403) {
      throw new Error(`导入接口返回 HTTP ${response.status}。登录 Token 可能已过期，请重新登录系统后点击“从已登录前端读取 Token”。`);
    }
    throw new Error(`导入接口返回空响应，HTTP ${response.status}。请确认后端服务正常。`);
  }

  try {
    return JSON.parse(rawText);
  } catch {
    throw new Error(`导入接口返回的不是 JSON，HTTP ${response.status}：${rawText.slice(0, 160)}`);
  }
}

async function importJob() {
  const apiBase = apiBaseInput.value.trim() || DEFAULT_API_BASE;
  const frontendBase = frontendBaseInput.value.trim() || DEFAULT_FRONTEND_BASE;
  const accessToken = accessTokenInput.value.trim();

  if (!accessToken) {
    setStatus('请先填写登录 Token。', 'error');
    return;
  }

  importJobButton.disabled = true;
  setStatus('正在采集当前页面...');

  try {
    await saveConfig();
    const job = await extractFromActiveTab();
    if (!job) {
      throw new Error('未采集到岗位信息，请确认当前标签页是岗位详情页');
    }
    if (!job.title || !job.company || !job.description) {
      throw new Error('未识别到完整岗位信息，请确认当前页面是岗位详情页');
    }

    setStatus('岗位信息已采集，正在导入系统...');
    const response = await fetch(`${apiBase.replace(/\/$/, '')}/api/jobs/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(job),
    });

    const result = await parseApiResult(response);
    if (!response.ok || result.code !== 200) {
      throw new Error(result.message || `导入失败，HTTP ${response.status}`);
    }

    const importedJob = result.data;
    setStatus(`导入成功：${importedJob.title} · ${importedJob.company}`, 'success');
    await chrome.tabs.create({
      url: `${frontendBase.replace(/\/$/, '')}/jobs?selectedJobId=${importedJob.id}`,
    });
  } catch (error) {
    setStatus(error instanceof Error ? error.message : '导入失败', 'error');
  } finally {
    importJobButton.disabled = false;
  }
}

async function openApp() {
  const frontendBase = frontendBaseInput.value.trim() || DEFAULT_FRONTEND_BASE;
  await chrome.tabs.create({ url: `${frontendBase.replace(/\/$/, '')}/jobs` });
}

saveConfigButton.addEventListener('click', () => void saveConfig());
loadTokenButton.addEventListener('click', () => void loadTokenFromFrontend());
importJobButton.addEventListener('click', () => void importJob());
openAppButton.addEventListener('click', () => void openApp());

void loadConfig();
