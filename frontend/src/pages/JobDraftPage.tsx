import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  BriefcaseBusiness,
  CheckSquare,
  Download,
  Loader2,
  RefreshCw,
  Save,
} from 'lucide-react';
import { jobDraftApi } from '../api';
import { getErrorMessage } from '../api/request';
import type { JobDraftBatch, JobDraftItem } from '../types/job-draft';
import { formatDateOnly, formatDateTime } from '../utils/date';

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

export default function JobDraftPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const batchId = searchParams.get('batchId');

  const [batch, setBatch] = useState<JobDraftBatch | null>(null);
  const [items, setItems] = useState<JobDraftItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadBatch = useCallback(async (targetBatchId: string) => {
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const [batchData, itemData] = await Promise.all([
        jobDraftApi.getBatch(targetBatchId),
        jobDraftApi.getItems(targetBatchId),
      ]);

      setBatch(batchData);
      setItems(itemData);
      setSelectedIds(new Set(itemData.filter((item) => item.selected).map((item) => item.draftItemId)));
    } catch (requestError) {
      setBatch(null);
      setItems([]);
      setSelectedIds(new Set());
      setError(getErrorMessage(requestError));
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
        setError(null);
        return;
      }

      setSearchParams({ batchId: latest.batchId }, { replace: true });
      await loadBatch(latest.batchId);
    } catch (requestError) {
      setBatch(null);
      setItems([]);
      setSelectedIds(new Set());
      setError(getErrorMessage(requestError));
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
  const allSelected = items.length > 0 && selectedCount === items.length;

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => Number(b.selected) - Number(a.selected)),
    [items],
  );

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
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(items.map((item) => item.draftItemId)));
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

    if (selectedIds.size === 0) {
      setError('请先选择至少一条职位草稿。');
      return;
    }

    setActionLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await jobDraftApi.importItems(batch.batchId, Array.from(selectedIds));
      setSuccessMessage(`导入完成：成功 ${result.importedCount} 条，跳过 ${result.skippedCount} 条。`);
      await loadBatch(batch.batchId);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setActionLoading(false);
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
            disabled={!batch || loading || actionLoading || selectedCount === 0}
            className="flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-600 disabled:opacity-60"
          >
            {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            批量导入（{selectedCount}）
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
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/70 dark:bg-emerald-900/30 dark:text-emerald-200">
          {successMessage}
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
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                草稿列表（{items.length}）
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

            {items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
                当前批次暂无草稿项。
              </div>
            ) : (
              <div className="space-y-3">
                {sortedItems.map((item) => {
                  const checked = selectedIds.has(item.draftItemId);
                  return (
                    <label
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
                        onChange={() => toggleItemSelection(item.draftItemId)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-500"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{item.title}</p>
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{item.company}</p>
                          </div>
                          {item.imported && (
                            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                              已导入
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
                          <span>{item.location || '地点未知'}</span>
                          <span>{formatSalary(item)}</span>
                          {item.experienceTextRaw && <span>{item.experienceTextRaw}</span>}
                          {item.educationTextRaw && <span>{item.educationTextRaw}</span>}
                        </div>
                        {item.descriptionPreview && (
                          <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">
                            {item.descriptionPreview}
                          </p>
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
                      </div>
                    </label>
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

