(() => {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    try {
      if (message?.type === 'NBWF_EXTRACT_LIST_PAGE') {
        sendResponse(extractListPage());
        return;
      }

      if (message?.type === 'NBWF_EXTRACT_DETAIL_PAGE') {
        sendResponse(extractDetailPage());
      }
    } catch (error) {
      sendResponse({
        error: error instanceof Error ? error.message : '页面解析失败',
      });
    }
  });

  function extractListPage() {
    const cards = findJobCards();
    const jobs = [];
    const dedupe = new Set();

    for (const card of cards) {
      const anchor = card.querySelector('a[href*="/job_detail/"]');
      const sourceUrl = toAbsoluteUrl(anchor?.getAttribute('href'));
      const title = firstText(card, [
        '.job-name',
        '.job-card-body .job-title',
        '.job-card-body .job-name',
        'a[ka*="job"] .job-name',
      ]);
      const company = firstText(card, [
        '.company-name',
        '.company-text .name',
        '.company-info .company-name',
      ]);

      if (!title || !company) {
        continue;
      }

      const salaryTextRaw = firstText(card, [
        '.salary',
        '.job-card-body .salary',
      ]);
      const detailTokens = collectTexts(card, [
        '.job-info .tag-list li',
        '.job-card-left .tag-list li',
        '.job-area',
        '.job-area-wrapper .job-area',
      ]);
      const techTags = collectTexts(card, [
        '.job-card-footer .tag-list li',
        '.tag-list li',
      ]).filter((value) => !isMetaToken(value));
      const benefits = collectTexts(card, [
        '.job-card-footer .info-desc',
        '.job-card-footer .tag-list li',
      ]).filter((value) => looksLikeBenefit(value));

      const job = {
        externalJobId: extractExternalJobId(sourceUrl),
        sourceUrl,
        title,
        company,
        location: pickLocation(detailTokens),
        salaryTextRaw,
        ...parseSalaryRange(salaryTextRaw),
        experienceTextRaw: pickExperience(detailTokens),
        educationTextRaw: pickEducation(detailTokens),
        descriptionPreview: firstText(card, [
          '.info-desc',
          '.job-card-footer .info-desc',
          '.job-card-body .job-description',
        ]),
        techTags: uniqueStrings(techTags, 8),
        benefits: uniqueStrings(benefits, 6),
        recruiterName: firstText(card, [
          '.info-public em',
          '.boss-name',
          '.boss-info .name',
        ]),
        rawPayload: {
          pageType: 'LIST',
          capturedAt: new Date().toISOString(),
          text: limitText(card.innerText, 1200),
        },
      };

      const dedupeKey = `${job.externalJobId || ''}|${normalizeText(job.sourceUrl) || ''}|${normalizeText(job.title)}|${normalizeText(job.company)}`;
      if (dedupe.has(dedupeKey)) {
        continue;
      }
      dedupe.add(dedupeKey);
      jobs.push(job);
    }

    return {
      sourcePageUrl: window.location.href,
      sourcePageTitle: document.title,
      pageFingerprint: buildPageFingerprint(jobs.length),
      jobs,
    };
  }

  function extractDetailPage() {
    const title = firstText(document, [
      '.job-banner .name h1',
      '.job-primary .name h1',
      '.job-name',
      'h1',
    ]);
    const company = firstText(document, [
      '.company-info .name',
      '.company-name',
      '.job-detail-company .company-name',
      'a[href*="gongsi"]',
    ]);
    const salaryTextRaw = firstText(document, [
      '.job-banner .salary',
      '.job-primary .salary',
      '.salary',
    ]);
    const detailTokens = collectTexts(document, [
      '.job-primary .info-primary p span',
      '.job-primary .job-limit span',
      '.job-banner .tag-list li',
      '.job-label-list span',
      '.job-tag-list span',
    ]);
    const techTags = collectTexts(document, [
      '.job-detail-section .tag-list li',
      '.job-label-list span',
      '.job-tag-list span',
      '.job-sec-text + .job-tags span',
    ]).filter((value) => !isMetaToken(value));
    const benefits = collectTexts(document, [
      '.job-benefit-tag',
      '.job-detail-company .company-tag li',
      '.welfare-tab-box span',
      '.job-label-list span',
    ]).filter((value) => looksLikeBenefit(value));
    const descriptionFull = longestText(document, [
      '.job-sec-text',
      '.job-detail-section .text',
      '.job-detail-section',
      '.job-detail-box',
    ]);

    return {
      externalJobId: extractExternalJobId(window.location.href),
      sourceUrl: window.location.href,
      title,
      company,
      location: pickLocation(detailTokens),
      salaryTextRaw,
      ...parseSalaryRange(salaryTextRaw),
      experienceTextRaw: pickExperience(detailTokens),
      educationTextRaw: pickEducation(detailTokens),
      descriptionPreview: limitText(descriptionFull, 180),
      descriptionFull,
      techTags: uniqueStrings(techTags, 12),
      benefits: uniqueStrings(benefits, 8),
      recruiterName: firstText(document, [
        '.boss-info-attr .name',
        '.job-boss-info .name',
        '.boss-info-name',
      ]),
      rawPayload: {
        pageType: 'DETAIL',
        capturedAt: new Date().toISOString(),
        title: document.title,
      },
    };
  }

  function findJobCards() {
    const directCards = Array.from(document.querySelectorAll('.job-card-wrapper'));
    if (directCards.length > 0) {
      return directCards;
    }

    const anchors = Array.from(document.querySelectorAll('a[href*="/job_detail/"]'));
    return anchors
      .map((anchor) => anchor.closest('.search-job-result, .job-card-wrapper, li, .job-list-box > div, .job-card-left'))
      .filter(Boolean);
  }

  function collectTexts(root, selectors) {
    const values = [];
    for (const selector of selectors) {
      const nodes = root.querySelectorAll(selector);
      nodes.forEach((node) => {
        const text = node.textContent?.trim();
        if (text) {
          values.push(cleanText(text));
        }
      });
    }
    return uniqueStrings(values, 20);
  }

  function firstText(root, selectors) {
    for (const selector of selectors) {
      const text = root.querySelector(selector)?.textContent?.trim();
      if (text) {
        return cleanText(text);
      }
    }
    return '';
  }

  function longestText(root, selectors) {
    let winner = '';
    for (const selector of selectors) {
      root.querySelectorAll(selector).forEach((node) => {
        const text = cleanText(node.textContent || '');
        if (text.length > winner.length) {
          winner = text;
        }
      });
    }
    return winner;
  }

  function cleanText(value) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .replace(/[\u200b-\u200d\ufeff]/g, '')
      .trim();
  }

  function uniqueStrings(values, limit = 10) {
    const result = [];
    const seen = new Set();
    for (const value of values) {
      const normalized = cleanText(value);
      if (!normalized || seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      result.push(normalized);
      if (result.length >= limit) {
        break;
      }
    }
    return result;
  }

  function limitText(value, size) {
    const normalized = cleanText(value);
    if (normalized.length <= size) {
      return normalized;
    }
    return `${normalized.slice(0, size)}…`;
  }

  function parseSalaryRange(value) {
    const normalized = cleanText(value);
    if (!normalized) {
      return { salaryMin: null, salaryMax: null };
    }

    const match = normalized.match(/(\d+(?:\.\d+)?)\s*[-~]\s*(\d+(?:\.\d+)?)\s*[kK]/);
    if (match) {
      return {
        salaryMin: Math.round(Number(match[1]) * 1000),
        salaryMax: Math.round(Number(match[2]) * 1000),
      };
    }

    const single = normalized.match(/(\d+(?:\.\d+)?)\s*[kK]/);
    if (single) {
      const amount = Math.round(Number(single[1]) * 1000);
      return { salaryMin: amount, salaryMax: amount };
    }

    return { salaryMin: null, salaryMax: null };
  }

  function pickLocation(tokens) {
    return tokens.find((value) => /区|市|县|镇|remote|远程|在家/i.test(value)) || tokens[0] || '';
  }

  function pickExperience(tokens) {
    return tokens.find((value) => /经验|应届|不限/i.test(value)) || '';
  }

  function pickEducation(tokens) {
    return tokens.find((value) => /学历|博士|硕士|本科|大专|中专|高中|不限/i.test(value)) || '';
  }

  function isMetaToken(value) {
    return /经验|学历|本科|大专|硕士|博士|不限|届|急聘|校招|社招|招聘中/i.test(value);
  }

  function looksLikeBenefit(value) {
    return /休|补|餐|金|险|假|团建|期权|双休|年终|福利|旅游|体检|弹性|补贴/i.test(value);
  }

  function extractExternalJobId(url) {
    if (!url) {
      return '';
    }

    try {
      const parsed = new URL(url, window.location.origin);
      const securityId = parsed.searchParams.get('securityId');
      if (securityId) {
        return securityId;
      }

      const jobId = parsed.searchParams.get('jobId');
      if (jobId) {
        return jobId;
      }

      const pathMatch = parsed.pathname.match(/\/job_detail\/([^./?]+)/);
      if (pathMatch) {
        return pathMatch[1];
      }
    } catch {}

    return '';
  }

  function toAbsoluteUrl(url) {
    if (!url) {
      return '';
    }
    try {
      return new URL(url, window.location.origin).toString();
    } catch {
      return url;
    }
  }

  function buildPageFingerprint(jobCount) {
    return `${window.location.pathname}|${jobCount}|${document.title}`.slice(0, 160);
  }

  function normalizeText(value) {
    return cleanText(value).toLowerCase();
  }
})();
