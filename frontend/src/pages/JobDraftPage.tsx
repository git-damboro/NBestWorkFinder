import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  BriefcaseBusiness,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Copy,
  Download,
  ExternalLink,
  Filter,
  Loader2,
  MessageSquare,
  RefreshCw,
  Save,
  Target,
} from 'lucide-react';
import { jobDraftApi } from '../api';
import { getErrorMessage } from '../api/request';
import type { JobDraftBatch, JobDraftItem } from '../types/job-draft';
import { formatDateOnly, formatDateTime } from '../utils/date';

type DraftFilter = 'ALL' | 'PENDING_IMPORT' | 'IMPORTED' | 'NEEDS_DETAIL' | 'DETAIL_COMPLETED' | 'HIGH_MATCH';

const draftFilterOptions: Array<{ value: DraftFilter; label: string }> = [
  { value: 'ALL', label: '全部草稿' },
  { value: 'PENDING_IMPORT', label: '未导入' },
  { value: 'IMPORTED', label: '已导入' },
  { value: 'NEEDS_DETAIL', label: '待补全 JD' },
  { value: 'DETAIL_COMPLETED', label: '已补全 JD' },
  { value: 'HIGH_MATCH', label: '高匹配' },
];

function formatSalary(item: JobDraftItem) {
  if (item.salaryMin !== null && item.salaryMax !== null) {
    return `¥${item.salaryMin.toLocaleString()} - ¥${item.salaryMax.toLocaleString()}`;
  }
  if (item.salaryTextRaw) {
    return item.salaryTextRaw;
  }
  return '薪资未知';
}

function formatSource(batch: JobDraftBatch) {
  if (batch.sourceType === 'RESUME_GENERATION') {
    return batch.resumeId ? `简历 #${batch.resumeId}` : '简历生成';
  }
  return batch.sourcePlatform || '页面同步';
}

function getDetailStatusLabel(item: JobDraftItem) {
  switch (item.detailSyncStatus) {
    case 'COMPLETED':
      return 'JD 已补全';
    case 'PARTIAL':
      return '部分补全';
    case 'FAILED':
      return '补全失败';
    case 'UNSYNCED':
    default:
      return item.descriptionFull ? '待确认补全' : '待补全 JD';
  }
}

function getDetailStatusClass(item: JobDraftItem) {
  switch (item.detailSyncStatus) {
    case 'COMPLETED':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
    case 'PARTIAL':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    case 'FAILED':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
    case 'UNSYNCED':
    default:
      return 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
  }
}

function getBestMatchScore(item: JobDraftItem) {
  return item.preciseMatchScore ?? item.coarseMatchScore;
}

function getMatchScoreLabel(item: JobDraftItem) {
  const score = getBestMatchScore(item);
  if (score === null) {
    return '待评估';
  }
  if (item.preciseMatchScore !== null) {
    return `精匹配 ${score}`;
  }
  return `粗匹配 ${score}`;
}

function getMatchScoreClass(item: JobDraftItem) {
  const score = getBestMatchScore(item);
  if (score === null) {
    return 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300';
  }
  if (score >= 80) {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
  }
  if (score >= 60) {
    return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
  }
  return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
}

function isHighMatch(item: JobDraftItem) {
  const score = getBestMatchScore(item);
  return score !== null && score >= 80;
}

function shouldShowInFilter(item: JobDraftItem, filter: DraftFilter) {
  switch (filter) {
    case 'PENDING_IMPORT':
      return !item.imported;
    case 'IMPORTED':
      return item.imported;
    case 'NEEDS_DETAIL':
      return item.detailSyncStatus !== 'COMPLETED';
    case 'DETAIL_COMPLETED':
      return item.detailSyncStatus === 'COMPLETED';
    case 'HIGH_MATCH':
      return isHighMatch(item);
    case 'ALL':
    default:
      return true;
  }
}

export default function JobDraftPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const batchId = searchParams.get('batchId');

  const [batch, setBatch] = useState<JobDraftBatch | null>(null);
  const [items, setItems] = useState<JobDraftItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<DraftFilter>('ALL');
  const [recoveredBatchMessage, setRecoveredBatchMessage] = useState<string | null>(null);
  const [lastImportedJobIds, setLastImportedJobIds] = useState<number[]>([]);
  const [expandedDescriptionIds, setExpandedDescriptionIds] = useState<Set<string>>(new Set());
  const [copiedOpenerDraftId, setCopiedOpenerDraftId] = useState<string | null>(null);
  const [syncingDraftItemId, setSyncingDraftItemId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadBatch = useCallback(async (targetBatchId: string) => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    setRecoveredBatchMessage(null);

    try {
      const [batchData, itemData] = await Promise.all([
        jobDraftApi.getBatch(targetBatchId),
        jobDraftApi.getItems(targetBatchId),
      ]);

      setBatch(batchData);
      setItems(itemData);
      setSelectedIds(new Set(itemData.filter((item) => item.selected).map((item) => item.draftItemId)));
      setExpandedDescriptionIds(new Set());
      setLastImportedJobIds([]);
      setCopiedOpenerDraftId(null);
      setSyncingDraftItemId(null);
      return true;
    } catch (requestError) {
      setBatch(null);
      setItems([]);
      setSelectedIds(new Set());
      setExpandedDescriptionIds(new Set());
      setLastImportedJobIds([]);
      setCopiedOpenerDraftId(null);
      setSyncingDraftItemId(null);
      setError(getErrorMessage(requestError));
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const recoverLatestBatch = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const latest = await jobDraftApi.getLatestBatch();
      if (!latest) {
        setBatch(null);
        setItems([]);
        setSelectedIds(new Set());
        setRecoveredBatchMessage(null);
        setLastImportedJobIds([]);
        setError(null);
        return;
      }

      setSearchParams({ batchId: latest.batchId }, { replace: true });
      const loaded = await loadBatch(latest.batchId);
      if (loaded) {
        setRecoveredBatchMessage(`已恢复最近批次：${latest.batchId}`);
      }
    } catch (requestError) {
      setBatch(null);
      setItems([]);
      setSelectedIds(new Set());
      setRecoveredBatchMessage(null);
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [loadBatch, setSearchParams]);

  useEffect(() => {
    if (batchId) {
      void loadBatch(batchId);
      return;
    }
    void recoverLatestBatch();
  }, [batchId, loadBatch, recoverLatestBatch]);

  const selectedCount = selectedIds.size;

  const importableSelectedIds = useMemo(
    () => items
      .filter((item) => !item.imported && selectedIds.has(item.draftItemId))
      .map((item) => item.draftItemId),
    [items, selectedIds],
  );

  const importableSelectedCount = importableSelectedIds.length;

  const filteredItems = useMemo(
    () => items.filter((item) => shouldShowInFilter(item, filter)),
    [filter, items],
  );

  const selectableFilteredItems = useMemo(
    () => filteredItems.filter((item) => !item.imported),
    [filteredItems],
  );

  const allSelected =
    selectableFilteredItems.length > 0
    && selectableFilteredItems.every((item) => selectedIds.has(item.draftItemId));

  const sortedItems = useMemo(
    () => [...filteredItems].sort((a, b) => {
      const leftScore = getBestMatchScore(a) ?? -1;
      const rightScore = getBestMatchScore(b) ?? -1;
      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }
      return Number(b.selected) - Number(a.selected);
    }),
    [filteredItems],
  );

  const stats = useMemo(() => ({
    pendingImportCount: items.filter((item) => !item.imported).length,
    needsDetailCount: items.filter((item) => item.detailSyncStatus !== 'COMPLETED').length,
    detailCompletedCount: items.filter((item) => item.detailSyncStatus === 'COMPLETED').length,
    highMatchCount: items.filter(isHighMatch).length,
  }), [items]);

  const toggleItemSelection = (draftItemId: string) => {
    setSuccessMessage(null);
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(draftItemId)) {
        next.delete(draftItemId);
      } else {
        next.add(draftItemId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSuccessMessage(null);
    if (allSelected) {
      setSelectedIds((previous) => {
        const next = new Set(previous);
        selectableFilteredItems.forEach((item) => next.delete(item.draftItemId));
        return next;
      });
      return;
    }
    setSelectedIds((previous) => {
      const next = new Set(previous);
      selectableFilteredItems.forEach((item) => next.add(item.draftItemId));
      return next;
    });
  };

  const saveSelection = async () => {
    if (!batch) {
      return;
    }

    setActionLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const nextSelectedIds = Array.from(selectedIds);
      const updated = await jobDraftApi.updateSelection(batch.batchId, nextSelectedIds);
      setBatch(updated);
      setItems((previous) =>
        previous.map((item) => ({
          ...item,
          selected: selectedIds.has(item.draftItemId),
        })),
      );
      setSuccessMessage('已保存当前选择。');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setActionLoading(false);
    }
  };

  const importSelected = async () => {
    if (!batch) {
      return;
    }

    const importableIds = importableSelectedIds;

    if (importableIds.length === 0) {
      setError('请先选择至少一条职位草稿。');
      return;
    }

    setActionLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await jobDraftApi.importItems(batch.batchId, importableIds);
      await loadBatch(batch.batchId);
      setLastImportedJobIds(result.importedJobIds);
      setSuccessMessage(
        `导入完成：成功 ${result.importedCount} 条，跳过 ${result.skippedCount} 条，失败 ${result.failedCount} 条。`
      );
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setActionLoading(false);
    }
  };

  const openImportedJobs = () => {
    if (lastImportedJobIds.length === 1) {
      navigate('/jobs', { state: { selectedJobId: lastImportedJobIds[0] } });
      return;
    }
    navigate('/jobs');
  };

  const toggleDescriptionExpanded = (draftItemId: string) => {
    setExpandedDescriptionIds((previous) => {
      const next = new Set(previous);
      if (next.has(draftItemId)) {
        next.delete(draftItemId);
      } else {
        next.add(draftItemId);
      }
      return next;
    });
  };

  const copyOpenerText = async (item: JobDraftItem) => {
    if (!item.openerText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(item.openerText);
      setCopiedOpenerDraftId(item.draftItemId);
      setSuccessMessage(`已复制开场话术：${item.title}`);
    } catch {
      setError('复制开场话术失败，请手动复制。');
    }
  };

  const syncSingleDraftItem = async (item: JobDraftItem) => {
    if (!batch || !item.descriptionFull) {
      setError('当前草稿缺少完整 JD，建议先在 BOSS 详情页点击“补全当前 JD”。');
      return;
    }

    setSyncingDraftItemId(item.draftItemId);
    setError(null);
    setSuccessMessage(null);

    try {
      const updatedItem = await jobDraftApi.syncItemDetail(item.draftItemId, {
        resumeId: batch.resumeId ?? undefined,
        externalJobId: item.externalJobId ?? undefined,
        sourceUrl: item.sourceUrl ?? undefined,
        title: item.title,
        company: item.company,
        location: item.location ?? undefined,
        salaryTextRaw: item.salaryTextRaw ?? undefined,
        salaryMin: item.salaryMin ?? undefined,
        salaryMax: item.salaryMax ?? undefined,
        experienceTextRaw: item.experienceTextRaw ?? undefined,
        educationTextRaw: item.educationTextRaw ?? undefined,
        descriptionPreview: item.descriptionPreview ?? undefined,
        descriptionFull: item.descriptionFull,
        techTags: item.techTags,
        benefits: item.benefits,
        recruiterName: item.recruiterName ?? undefined,
      });

      setItems((previous) =>
        previous.map((current) => (
          current.draftItemId === updatedItem.draftItemId ? updatedItem : current
        )),
      );
      setSuccessMessage(`已刷新草稿分析：${updatedItem.title}`);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSyncingDraftItemId(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-slate-800 dark:text-white">
            <BriefcaseBusiness className="h-7 w-7 text-primary-500" />
            职位草稿
          </h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            支持恢复最近批次、多选确认并批量导入到职位工作台。
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void recoverLatestBatch()}
            disabled={loading || actionLoading}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <RefreshCw className="h-4 w-4" />
            恢复最近批次
          </button>
          <button
            type="button"
            onClick={saveSelection}
            disabled={!batch || loading || actionLoading}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <Save className="h-4 w-4" />
            保存选择
          </button>
          <button
            type="button"
            onClick={() => void importSelected()}
            disabled={!batch || loading || actionLoading || importableSelectedCount === 0}
            className="flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-600 disabled:opacity-60"
          >
            {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            批量导入（{importableSelectedCount}）
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/70 dark:bg-red-900/30 dark:text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/70 dark:bg-emerald-900/30 dark:text-emerald-200">
          <span>{successMessage}</span>
          {lastImportedJobIds.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={openImportedJobs}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-300 bg-white px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:bg-slate-800 dark:text-emerald-300 dark:hover:bg-slate-700"
              >
                <ExternalLink className="h-4 w-4" />
                查看职位工作台
              </button>
            </div>
          )}
        </div>
      )}

      {recoveredBatchMessage && !successMessage && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-500/70 dark:bg-blue-900/30 dark:text-blue-200">
          {recoveredBatchMessage}
        </div>
      )}

      {loading && (
        <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-slate-100 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
        </div>
      )}

      {!loading && !batch && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-900/40">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">暂无职位草稿批次</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            可先在简历详情页生成职位草稿，或之后通过扩展同步职位。
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/jobs')}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              去职位工作台
            </button>
            <button
              type="button"
              onClick={() => void recoverLatestBatch()}
              className="rounded-xl bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600"
            >
              恢复最近批次
            </button>
          </div>
        </div>
      )}

      {!loading && batch && (
        <>
          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-900/40">
                <p className="text-xs text-slate-400 dark:text-slate-500">批次 ID</p>
                <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">{batch.batchId}</p>
              </div>
              <div className="rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-900/40">
                <p className="text-xs text-slate-400 dark:text-slate-500">来源</p>
                <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">{formatSource(batch)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-900/40">
                <p className="text-xs text-slate-400 dark:text-slate-500">状态</p>
                <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">{batch.status}</p>
              </div>
              <div className="rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-900/40">
                <p className="text-xs text-slate-400 dark:text-slate-500">创建时间</p>
                <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-100">
                  {formatDateTime(batch.createdAt)}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-slate-100 px-4 py-3 dark:border-slate-700">
                <p className="text-xs text-slate-400 dark:text-slate-500">草稿总数</p>
                <p className="mt-1 text-lg font-semibold text-slate-800 dark:text-slate-100">{batch.totalCount}</p>
              </div>
              <div className="rounded-xl border border-slate-100 px-4 py-3 dark:border-slate-700">
                <p className="text-xs text-slate-400 dark:text-slate-500">当前选择</p>
                <p className="mt-1 text-lg font-semibold text-slate-800 dark:text-slate-100">{selectedCount}</p>
              </div>
              <div className="rounded-xl border border-slate-100 px-4 py-3 dark:border-slate-700">
                <p className="text-xs text-slate-400 dark:text-slate-500">已导入</p>
                <p className="mt-1 text-lg font-semibold text-slate-800 dark:text-slate-100">{batch.importedCount}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-4">
              <div className="rounded-xl border border-slate-100 px-4 py-3 dark:border-slate-700">
                <p className="text-xs text-slate-400 dark:text-slate-500">未导入</p>
                <p className="mt-1 text-lg font-semibold text-slate-800 dark:text-slate-100">{stats.pendingImportCount}</p>
              </div>
              <div className="rounded-xl border border-slate-100 px-4 py-3 dark:border-slate-700">
                <p className="text-xs text-slate-400 dark:text-slate-500">待补全 JD</p>
                <p className="mt-1 text-lg font-semibold text-slate-800 dark:text-slate-100">{stats.needsDetailCount}</p>
              </div>
              <div className="rounded-xl border border-slate-100 px-4 py-3 dark:border-slate-700">
                <p className="text-xs text-slate-400 dark:text-slate-500">已补全 JD</p>
                <p className="mt-1 text-lg font-semibold text-slate-800 dark:text-slate-100">{stats.detailCompletedCount}</p>
              </div>
              <div className="rounded-xl border border-slate-100 px-4 py-3 dark:border-slate-700">
                <p className="text-xs text-slate-400 dark:text-slate-500">高匹配</p>
                <p className="mt-1 text-lg font-semibold text-slate-800 dark:text-slate-100">{stats.highMatchCount}</p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                草稿列表（{filteredItems.length}/{items.length}）
              </h2>
              <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-300">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
                >
                  <CheckSquare className="h-4 w-4" />
                  {allSelected ? '取消全选' : '全选'}
                </button>
                <span>批次更新：{formatDateOnly(batch.updatedAt)}</span>
              </div>
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <Filter className="h-4 w-4" />
                当前筛选
              </span>
              {draftFilterOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFilter(option.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    filter === option.value
                      ? 'bg-primary-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {filteredItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
                当前筛选条件下暂无草稿项。
              </div>
            ) : (
              <div className="space-y-3">
                {sortedItems.map((item) => {
                  const checked = selectedIds.has(item.draftItemId);
                  const isExpanded = expandedDescriptionIds.has(item.draftItemId);
                  const fullDescription = item.descriptionFull || item.descriptionPreview;
                  return (
                    <div
                      key={item.draftItemId}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
                        checked
                          ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={item.imported}
                        onChange={() => toggleItemSelection(item.draftItemId)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-500"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{item.title}</p>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{item.company}</p>
                          </div>
                          <div className="flex flex-wrap justify-end gap-2">
                            {item.imported && (
                              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                                已导入
                              </span>
                            )}
                            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getDetailStatusClass(item)}`}>
                              {getDetailStatusLabel(item)}
                            </span>
                            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getMatchScoreClass(item)}`}>
                              {getMatchScoreLabel(item)}
                            </span>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
                          <span>{item.location || '地点未知'}</span>
                          <span>{formatSalary(item)}</span>
                          {item.experienceTextRaw && <span>{item.experienceTextRaw}</span>}
                          {item.educationTextRaw && <span>{item.educationTextRaw}</span>}
                        </div>
                        {fullDescription && (
                          <div className="mt-3 rounded-xl bg-slate-50 px-3 py-3 dark:bg-slate-900/40">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">JD 摘要</p>
                              {item.descriptionFull && item.descriptionFull.length > 180 && (
                                <button
                                  type="button"
                                  onClick={() => toggleDescriptionExpanded(item.draftItemId)}
                                  className="inline-flex items-center gap-1 text-xs font-medium text-primary-500 hover:text-primary-600"
                                >
                                  {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                  {isExpanded ? '收起' : '展开'}
                                </button>
                              )}
                            </div>
                            <p className={`mt-2 text-sm text-slate-600 dark:text-slate-300 ${isExpanded ? '' : 'line-clamp-3'}`}>
                              {fullDescription}
                            </p>
                          </div>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.techTags.slice(0, 8).map((tag) => (
                            <span
                              key={`${item.draftItemId}-${tag}`}
                              className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>

                        <div className="mt-3 grid gap-3 lg:grid-cols-2">
                          <div className="rounded-xl border border-slate-100 px-3 py-3 dark:border-slate-700">
                            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                              <Target className="h-3.5 w-3.5" />
                              匹配摘要
                            </div>
                            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                              {item.matchSummary || '补全 JD 后可生成更准确的匹配摘要。'}
                            </p>
                          </div>
                          <div className="rounded-xl border border-slate-100 px-3 py-3 dark:border-slate-700">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                                <MessageSquare className="h-3.5 w-3.5" />
                                开场话术
                              </div>
                              {item.openerText && (
                                <button
                                  type="button"
                                  onClick={() => void copyOpenerText(item)}
                                  className="inline-flex items-center gap-1 text-xs font-medium text-primary-500 hover:text-primary-600"
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                  {copiedOpenerDraftId === item.draftItemId ? '已复制' : '复制'}
                                </button>
                              )}
                            </div>
                            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                              {item.openerText || '请先在 BOSS 详情页中点击“补全当前 JD”，系统会生成更贴近岗位的开场话术。'}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.sourceUrl && (
                            <a
                              href={item.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              打开来源
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => void syncSingleDraftItem(item)}
                            disabled={syncingDraftItemId === item.draftItemId || !item.descriptionFull}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                          >
                            {syncingDraftItemId === item.draftItemId ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3.5 w-3.5" />
                            )}
                            {item.descriptionFull ? '重新计算匹配' : '需先补全 JD'}
                          </button>
                        </div>

                        {item.detailSyncStatus !== 'COMPLETED' && (
                          <div className="mt-3 rounded-xl border border-dashed border-slate-200 px-3 py-3 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                            补全指引：先在 BOSS 列表页完成同步，再打开对应职位详情页，点击扩展中的“补全当前 JD”。
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
