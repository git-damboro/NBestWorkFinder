import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  ListChecks,
  Loader2,
  RefreshCw,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { aiGenerationTaskApi, getErrorMessage } from '../api';
import type {
  AiGenerationTask,
  AiGenerationTaskStatus,
  AiGenerationTaskType,
} from '../types/ai-generation-task';
import { formatDateTime } from '../utils/date';

type TypeFilter = AiGenerationTaskType | 'ALL';
type StatusFilter = AiGenerationTaskStatus | 'ALL';

const typeOptions: Array<{ value: TypeFilter; label: string }> = [
  { value: 'ALL', label: '全部类型' },
  { value: 'RESUME_JOB_DRAFT', label: '简历职位草稿生成' },
  { value: 'JOB_DRAFT_PAGE_SYNC', label: '职位草稿页同步' },
  { value: 'JOB_DRAFT_DETAIL_SYNC', label: '职位草稿详情同步' },
  { value: 'INTERVIEW_SESSION_CREATE', label: '面试会话创建' },
];

const statusOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: 'ALL', label: '全部状态' },
  { value: 'PENDING', label: '排队中' },
  { value: 'PROCESSING', label: '处理中' },
  { value: 'COMPLETED', label: '已完成' },
  { value: 'FAILED', label: '失败' },
];

const typeLabelMap: Record<AiGenerationTaskType, string> = {
  RESUME_JOB_DRAFT: '简历职位草稿生成',
  JOB_DRAFT_PAGE_SYNC: '职位草稿页同步',
  JOB_DRAFT_DETAIL_SYNC: '职位草稿详情同步',
  INTERVIEW_SESSION_CREATE: '面试会话创建',
};

const statusLabelMap: Record<AiGenerationTaskStatus, string> = {
  PENDING: '排队中',
  PROCESSING: '处理中',
  COMPLETED: '已完成',
  FAILED: '失败',
};

function getStatusBadgeClass(status: AiGenerationTaskStatus) {
  switch (status) {
    case 'PENDING':
      return 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
    case 'PROCESSING':
      return 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300';
    case 'COMPLETED':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
    case 'FAILED':
      return 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
    default:
      return 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
  }
}

function parseResultJson(resultJson: string | null): Record<string, unknown> | null {
  if (!resultJson) {
    return null;
  }

  try {
    const parsed = JSON.parse(resultJson) as unknown;
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function getStringValue(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return null;
}

function extractBatchId(task: AiGenerationTask): string | null {
  const result = parseResultJson(task.resultJson);
  if (!result) {
    return null;
  }

  const nestedBatch = result.batch;
  const nestedResult = result.result;

  const directCandidates = [
    result.batchId,
    result.jobDraftBatchId,
    nestedBatch && typeof nestedBatch === 'object'
      ? (nestedBatch as Record<string, unknown>).batchId
      : null,
    nestedResult && typeof nestedResult === 'object'
      ? (nestedResult as Record<string, unknown>).batchId
      : null,
  ];

  for (const candidate of directCandidates) {
    const value = getStringValue(candidate);
    if (value) {
      return value;
    }
  }

  return null;
}

function resolveResultPath(task: AiGenerationTask): string | null {
  switch (task.type) {
    case 'RESUME_JOB_DRAFT': {
      const batchId = extractBatchId(task);
      if (batchId) {
        return `/jobs/drafts?batchId=${encodeURIComponent(batchId)}`;
      }
      return `/history/${task.sourceId}`;
    }
    case 'JOB_DRAFT_PAGE_SYNC': {
      const batchId = extractBatchId(task);
      if (!batchId) {
        return null;
      }
      return `/jobs/drafts?batchId=${encodeURIComponent(batchId)}`;
    }
    case 'JOB_DRAFT_DETAIL_SYNC': {
      const batchId = extractBatchId(task);
      if (batchId) {
        return `/jobs/drafts?batchId=${encodeURIComponent(batchId)}`;
      }
      return '/jobs';
    }
    case 'INTERVIEW_SESSION_CREATE':
      return '/interviews';
    default:
      return null;
  }
}

function toTaskTimeValue(task: AiGenerationTask): number {
  const time = task.updatedAt ?? task.createdAt ?? task.completedAt;
  if (!time) {
    return 0;
  }
  const parsed = new Date(time).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

export default function TaskCenterPage() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<AiGenerationTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [retryingTaskId, setRetryingTaskId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  const loadTasks = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await aiGenerationTaskApi.getTasks();
      setTasks(data);
    } catch (err) {
      setTasks([]);
      setError(getErrorMessage(err));
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    const hasRunningTask = tasks.some((task) => task.status === 'PENDING' || task.status === 'PROCESSING');
    if (!hasRunningTask) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadTasks(false);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [tasks, loadTasks]);

  const filteredTasks = useMemo(() => {
    return tasks
      .filter((task) => (typeFilter === 'ALL' ? true : task.type === typeFilter))
      .filter((task) => (statusFilter === 'ALL' ? true : task.status === statusFilter))
      .sort((a, b) => toTaskTimeValue(b) - toTaskTimeValue(a));
  }, [tasks, typeFilter, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: tasks.length,
      processing: tasks.filter((task) => task.status === 'PENDING' || task.status === 'PROCESSING').length,
      completed: tasks.filter((task) => task.status === 'COMPLETED').length,
      failed: tasks.filter((task) => task.status === 'FAILED').length,
    };
  }, [tasks]);

  const handleRefresh = () => {
    void loadTasks();
  };

  const handleRetry = async (taskId: string) => {
    setRetryingTaskId(taskId);
    setActionError(null);

    try {
      await aiGenerationTaskApi.retryTask(taskId);
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setRetryingTaskId(null);
      await loadTasks();
    }
  };

  const handleViewResult = (task: AiGenerationTask) => {
    const path = resolveResultPath(task);
    if (!path) {
      setActionError('当前任务结果缺少结果定位信息，暂时无法跳转结果页。');
      return;
    }
    navigate(path);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-slate-800 dark:text-white">
            <ListChecks className="h-7 w-7 text-primary-500" />
            任务中心
          </h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            统一查看 AI 异步任务状态，支持失败重试与结果跳转。
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          手动刷新
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard
          icon={ListChecks}
          label="任务总数"
          value={stats.total.toString()}
          hint="当前账号下全部任务"
          colorClass="bg-primary-500"
        />
        <SummaryCard
          icon={Clock3}
          label="进行中"
          value={stats.processing.toString()}
          hint="排队中 + 处理中"
          colorClass="bg-blue-500"
        />
        <SummaryCard
          icon={CheckCircle2}
          label="已完成"
          value={stats.completed.toString()}
          hint="可查看结果"
          colorClass="bg-emerald-500"
        />
        <SummaryCard
          icon={XCircle}
          label="失败"
          value={stats.failed.toString()}
          hint="支持单任务重试"
          colorClass="bg-rose-500"
        />
      </div>

      {actionError && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/70 dark:bg-red-900/30 dark:text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-4 grid gap-3 md:grid-cols-2">
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-primary-900/30"
          >
            {typeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-primary-900/30"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">任务列表</h2>
          <span className="text-xs text-slate-400 dark:text-slate-500">共 {filteredTasks.length} 条</span>
        </div>

        {loading && (
          <div className="flex min-h-[300px] items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-primary-500" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/70 dark:bg-red-900/30 dark:text-red-200">
            <p>{error}</p>
            <button
              type="button"
              onClick={handleRefresh}
              className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-medium text-red-600 dark:bg-slate-800 dark:text-red-300"
            >
              重试加载
            </button>
          </div>
        )}

        {!loading && !error && filteredTasks.length === 0 && (
          <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center dark:border-slate-700 dark:bg-slate-900/40">
            <ListChecks className="mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">暂无任务</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              当前筛选条件下没有可展示的任务记录。
            </p>
          </div>
        )}

        {!loading && !error && filteredTasks.length > 0 && (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:border-slate-700 dark:text-slate-500">
                  <th className="px-3 py-3">任务类型</th>
                  <th className="px-3 py-3">状态</th>
                  <th className="px-3 py-3">来源 ID</th>
                  <th className="px-3 py-3">目标 ID</th>
                  <th className="px-3 py-3">更新时间</th>
                  <th className="px-3 py-3">错误信息</th>
                  <th className="px-3 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((task) => {
                  const canViewResult = task.status === 'COMPLETED' && resolveResultPath(task) !== null;
                  return (
                    <tr
                      key={task.taskId}
                      className="border-b border-slate-100 text-slate-700 last:border-b-0 dark:border-slate-700 dark:text-slate-200"
                    >
                      <td className="px-3 py-3">
                        <p className="font-medium">{typeLabelMap[task.type]}</p>
                        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">ID: {task.taskId}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(task.status)}`}
                        >
                          {statusLabelMap[task.status]}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400">{task.sourceId}</td>
                      <td className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400">{task.targetId ?? '-'}</td>
                      <td className="px-3 py-3 text-xs text-slate-500 dark:text-slate-400">
                        <p>{formatDateTime(task.updatedAt)}</p>
                        <p className="mt-1">创建: {formatDateTime(task.createdAt)}</p>
                      </td>
                      <td className="max-w-[280px] px-3 py-3 text-xs text-slate-500 dark:text-slate-400">
                        {task.errorMessage ? (
                          <span className="line-clamp-2">{task.errorMessage}</span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">-</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleViewResult(task)}
                            disabled={!canViewResult}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-700"
                          >
                            查看结果
                          </button>
                          {task.status === 'FAILED' && (
                            <button
                              type="button"
                              onClick={() => void handleRetry(task.taskId)}
                              disabled={retryingTaskId === task.taskId}
                              className="flex items-center gap-1 rounded-lg bg-primary-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {retryingTaskId === task.taskId ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <RotateCcw className="h-3.5 w-3.5" />
                              )}
                              重试
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

interface SummaryCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: string;
  colorClass: string;
}

function SummaryCard({ icon: Icon, label, value, hint, colorClass }: SummaryCardProps) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-start gap-4">
        <div className={`rounded-xl p-3 text-white ${colorClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{hint}</p>
        </div>
      </div>
    </div>
  );
}
