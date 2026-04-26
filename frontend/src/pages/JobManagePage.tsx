import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  Briefcase,
  Building2,
  CalendarDays,
  ClipboardList,
  Edit3,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import { jobApi, jobFollowUpApi } from '../api';
import { historyApi, type ResumeListItem } from '../api/history';
import { getErrorMessage } from '../api/request';
import ConfirmDialog from '../components/ConfirmDialog';
import DeleteConfirmDialog from '../components/DeleteConfirmDialog';
import JobFormDialog, { type JobFormData, type JobFormMode } from '../components/JobFormDialog';
import JobFollowUpDialog from '../components/JobFollowUpDialog';
import JobMatchDialog from '../components/JobMatchDialog';
import type { CreateJobFollowUpForm, JobFollowUpRecord } from '../types/job-follow-up';
import { jobFollowUpTypeLabelMap } from '../types/job-follow-up';
import type { InterviewJobTarget } from '../types/interview';
import type { CreateJobForm, JobApplicationStatus, JobDetail, JobListItem, UpdateJobForm } from '../types/job';
import { jobStatusLabelMap, jobStatusOptions } from '../types/job';
import { formatDateOnly, formatDateTime } from '../utils/date';

type StatusFilter = JobApplicationStatus | 'ALL';

const statusFilterOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: 'ALL', label: '全部状态' },
  ...jobStatusOptions,
];

function formatSalaryRange(salaryMin: number | null, salaryMax: number | null) {
  if (salaryMin !== null && salaryMax !== null) {
    return `￥${salaryMin.toLocaleString()} - ￥${salaryMax.toLocaleString()}`;
  }
  if (salaryMin !== null) {
    return `￥${salaryMin.toLocaleString()} 起`;
  }
  if (salaryMax !== null) {
    return `最高 ￥${salaryMax.toLocaleString()}`;
  }
  return '薪资未填写';
}

function getStatusBadgeClass(status: JobApplicationStatus) {
  switch (status) {
    case 'SAVED':
      return 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
    case 'APPLIED':
      return 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300';
    case 'INTERVIEWING':
      return 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    case 'OFFERED':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
    case 'REJECTED':
      return 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
    default:
      return 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
  }
}

function buildFormInitialData(job?: JobDetail | null): JobFormData | null {
  if (!job) {
    return null;
  }

  return {
    title: job.title,
    company: job.company,
    description: job.description,
    location: job.location ?? '',
    salaryMin: job.salaryMin ?? undefined,
    salaryMax: job.salaryMax ?? undefined,
    applicationStatus: job.applicationStatus,
    notes: job.notes ?? '',
  };
}

function normalizeOptionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function toCreatePayload(data: JobFormData): CreateJobForm {
  return {
    title: data.title,
    company: data.company,
    description: data.description,
    location: normalizeOptionalText(data.location),
    salaryMin: data.salaryMin,
    salaryMax: data.salaryMax,
    notes: normalizeOptionalText(data.notes),
  };
}

function toUpdatePayload(data: JobFormData): UpdateJobForm {
  return {
    title: data.title,
    company: data.company,
    description: data.description,
    location: normalizeOptionalText(data.location),
    salaryMin: data.salaryMin,
    salaryMax: data.salaryMax,
    applicationStatus: data.applicationStatus,
    notes: normalizeOptionalText(data.notes),
  };
}

function buildInterviewJobTarget(job: JobDetail): InterviewJobTarget {
  return {
    jobId: job.id,
    title: job.title,
    company: job.company,
    description: job.description,
    techTags: job.techTags,
  };
}

function matchKeyword(job: JobListItem, keyword: string) {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) {
    return true;
  }

  return [job.title, job.company, job.location ?? '', ...job.techTags]
    .join(' ')
    .toLowerCase()
    .includes(normalizedKeyword);
}

export default function JobManagePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [selectedJob, setSelectedJob] = useState<JobDetail | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<JobFormMode>('create');
  const [submitting, setSubmitting] = useState(false);
  const [matchOpen, setMatchOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<JobDetail | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [interviewOpen, setInterviewOpen] = useState(false);
  const [interviewResumes, setInterviewResumes] = useState<ResumeListItem[]>([]);
  const [loadingInterviewResumes, setLoadingInterviewResumes] = useState(false);
  const [selectedInterviewResumeId, setSelectedInterviewResumeId] = useState<number | null>(null);
  const [interviewError, setInterviewError] = useState<string | null>(null);
  const [followUps, setFollowUps] = useState<JobFollowUpRecord[]>([]);
  const [loadingFollowUps, setLoadingFollowUps] = useState(false);
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [followUpDialogOpen, setFollowUpDialogOpen] = useState(false);
  const [savingFollowUp, setSavingFollowUp] = useState(false);

  // 通过 ref 记录当前选中项，避免因为列表刷新函数依赖 selectedJobId 而反复重新请求列表。
  const selectedJobIdRef = useRef<number | null>(null);
  const detailRequestIdRef = useRef(0);
  const routeSelectedJobId = (location.state as { selectedJobId?: number } | null)?.selectedJobId ?? null;

  useEffect(() => {
    selectedJobIdRef.current = selectedJobId;
  }, [selectedJobId]);

  useEffect(() => {
    if (routeSelectedJobId === null) {
      return;
    }

    // 从简历详情页保存职位草稿后，优先聚焦刚创建的职位。
    selectedJobIdRef.current = routeSelectedJobId;
    setSelectedJobId(routeSelectedJobId);
    setDetailModalOpen(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [routeSelectedJobId, navigate, location.pathname]);

  const loadFollowUps = useCallback(async (jobId: number) => {
    setLoadingFollowUps(true);
    setFollowUpError(null);

    try {
      const data = await jobFollowUpApi.list(jobId);
      setFollowUps(data);
    } catch (error) {
      setFollowUps([]);
      setFollowUpError(getErrorMessage(error));
    } finally {
      setLoadingFollowUps(false);
    }
  }, []);

  const loadJobDetail = useCallback(async (jobId: number) => {
    const requestId = ++detailRequestIdRef.current;
    setLoadingDetail(true);
    setDetailError(null);

    try {
      const data = await jobApi.getJobDetail(jobId);
      if (detailRequestIdRef.current !== requestId) {
        return;
      }
      setSelectedJob(data);
      void loadFollowUps(jobId);
    } catch (error) {
      if (detailRequestIdRef.current !== requestId) {
        return;
      }
      setSelectedJob(null);
      setFollowUps([]);
      setDetailError(getErrorMessage(error));
    } finally {
      if (detailRequestIdRef.current === requestId) {
        setLoadingDetail(false);
      }
    }
  }, [loadFollowUps]);

  const loadJobs = useCallback(
    async (preferredId?: number | null) => {
      setLoadingList(true);
      setListError(null);

      try {
        const data = await jobApi.getJobs(statusFilter === 'ALL' ? undefined : statusFilter);
        setJobs(data);

        if (data.length === 0) {
          setSelectedJobId(null);
          setSelectedJob(null);
          setFollowUps([]);
          setDetailError(null);
          return;
        }

        const currentId = preferredId ?? selectedJobIdRef.current;
        const nextSelectedId =
          currentId !== null && data.some((job) => job.id === currentId) ? currentId : data[0].id;

        setSelectedJobId(nextSelectedId);
      } catch (error) {
        setListError(getErrorMessage(error));
        setJobs([]);
        setSelectedJobId(null);
        setSelectedJob(null);
        setFollowUps([]);
      } finally {
        setLoadingList(false);
      }
    },
    [statusFilter],
  );

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    if (selectedJobId === null) {
      setSelectedJob(null);
      setFollowUps([]);
      setDetailError(null);
      return;
    }

    void loadJobDetail(selectedJobId);
  }, [selectedJobId, loadJobDetail]);

  useEffect(() => {
    if (!interviewOpen) {
      return;
    }

    let cancelled = false;

    // 发起定向面试前先拉取当前用户简历列表，由用户选择本次面试使用的简历。
    const loadResumeOptions = async () => {
      setLoadingInterviewResumes(true);
      setInterviewError(null);

      try {
        const data = await historyApi.getResumes();
        if (cancelled) {
          return;
        }

        setInterviewResumes(data);
        setSelectedInterviewResumeId(data[0]?.id ?? null);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setInterviewResumes([]);
        setSelectedInterviewResumeId(null);
        setInterviewError(getErrorMessage(error));
      } finally {
        if (!cancelled) {
          setLoadingInterviewResumes(false);
        }
      }
    };

    void loadResumeOptions();

    return () => {
      cancelled = true;
    };
  }, [interviewOpen]);

  const filteredJobs = useMemo(
    () => jobs.filter((job) => matchKeyword(job, searchKeyword)),
    [jobs, searchKeyword],
  );

  useEffect(() => {
    if (filteredJobs.length === 0) {
      return;
    }

    if (!filteredJobs.some((job) => job.id === selectedJobId)) {
      setSelectedJobId(filteredJobs[0].id);
    }
  }, [filteredJobs, selectedJobId]);

  const selectedJobSummary = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? null,
    [jobs, selectedJobId],
  );

  const uniqueTagCount = useMemo(
    () => new Set(jobs.flatMap((job) => job.techTags)).size,
    [jobs],
  );

  const formInitialJob = formMode === 'edit' ? buildFormInitialData(selectedJob) : null;

  const openCreateDialog = () => {
    setActionError(null);
    setFormMode('create');
    setFormOpen(true);
  };

  const openEditDialog = () => {
    if (!selectedJob) {
      return;
    }
    setActionError(null);
    setFormMode('edit');
    setFormOpen(true);
  };

  const openDirectedInterviewDialog = () => {
    if (!selectedJob) {
      return;
    }

    setInterviewError(null);
    setInterviewOpen(true);
  };

  const openJobDetail = (jobId: number) => {
    setActionError(null);
    setSelectedJobId(jobId);
    setDetailModalOpen(true);
  };

  const handleRefresh = () => {
    void loadJobs(selectedJobIdRef.current);
  };

  const handleSubmit = async (data: JobFormData) => {
    setSubmitting(true);
    setActionError(null);

    try {
      if (formMode === 'create') {
        // 后端创建接口默认先落一条职位记录；若用户在弹窗里选择了其他状态，再补一次更新即可。
        const createdJob = await jobApi.createJob(toCreatePayload(data));
        const targetJob =
          data.applicationStatus === 'SAVED'
            ? createdJob
            : await jobApi.updateJob(createdJob.id, { applicationStatus: data.applicationStatus });

        setFormOpen(false);
        await loadJobs(targetJob.id);
        await loadJobDetail(targetJob.id);
      } else if (selectedJob) {
        await jobApi.updateJob(selectedJob.id, toUpdatePayload(data));
        setFormOpen(false);
        await loadJobs(selectedJob.id);
        await loadJobDetail(selectedJob.id);
      }
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    setDeleting(true);
    setActionError(null);

    try {
      const deletedId = deleteTarget.id;
      await jobApi.deleteJob(deletedId);
      setDeleteTarget(null);
      await loadJobs(selectedJobIdRef.current === deletedId ? null : selectedJobIdRef.current);
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  };

  const handleStartDirectedInterview = () => {
    if (!selectedJob) {
      return;
    }

    if (selectedInterviewResumeId === null) {
      setInterviewError('请先选择一份简历再开始面试。');
      return;
    }

    setInterviewOpen(false);
    navigate(`/interview/${selectedInterviewResumeId}`, {
      state: {
        jobTarget: buildInterviewJobTarget(selectedJob),
      },
    });
  };

  const handleCreateFollowUp = async (data: CreateJobFollowUpForm) => {
    if (!selectedJob) {
      return;
    }

    setSavingFollowUp(true);
    setActionError(null);

    try {
      await jobFollowUpApi.create(selectedJob.id, data);
      setFollowUpDialogOpen(false);
      await loadJobDetail(selectedJob.id);
      await loadFollowUps(selectedJob.id);
      await loadJobs(selectedJob.id);
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setSavingFollowUp(false);
    }
  };

  const updateSelectedJobStatus = async (status: JobApplicationStatus) => {
    if (!selectedJob || selectedJob.applicationStatus === status) {
      return;
    }

    setActionError(null);

    try {
      await jobApi.updateJob(selectedJob.id, { applicationStatus: status });
      await loadJobDetail(selectedJob.id);
      await loadFollowUps(selectedJob.id);
      await loadJobs(selectedJob.id);
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-slate-800 dark:text-white">
            <Briefcase className="h-7 w-7 text-primary-500" />
            职位工作台
          </h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            集中管理收藏职位、投递进度与简历匹配结果。
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleRefresh}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <RefreshCw className="h-4 w-4" />
            刷新列表
          </button>
          <button
            type="button"
            onClick={() => navigate('/jobs/drafts')}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <ClipboardList className="h-4 w-4" />
            查看职位草稿
          </button>
          <button
            type="button"
            onClick={openCreateDialog}
            className="flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-600"
          >
            <Plus className="h-4 w-4" />
            新增职位
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          icon={Briefcase}
          label="职位总数"
          value={jobs.length.toString()}
          hint="当前状态筛选下的职位数量"
          colorClass="bg-primary-500"
        />
        <SummaryCard
          icon={Target}
          label="可见结果"
          value={filteredJobs.length.toString()}
          hint="关键词搜索后的列表结果"
          colorClass="bg-indigo-500"
        />
        <SummaryCard
          icon={Sparkles}
          label="标签覆盖"
          value={uniqueTagCount.toString()}
          hint="已提取技术标签的去重总数"
          colorClass="bg-emerald-500"
        />
      </div>

      {actionError && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/70 dark:bg-red-900/30 dark:text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      <div className="grid gap-6">
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-4 grid gap-3 lg:grid-cols-[1fr,220px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(event) => setSearchKeyword(event.target.value)}
                placeholder="搜索职位、公司、地点或标签"
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-700 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-primary-900/30"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-primary-900/30"
            >
              {statusFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">职位列表</h2>
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                点击职位卡片查看详情、匹配简历或发起定向面试
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500 dark:bg-slate-700 dark:text-slate-300">
              共 {filteredJobs.length} 条
            </span>
          </div>

          {loadingList && (
            <div className="flex min-h-[280px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
            </div>
          )}

          {!loadingList && listError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/70 dark:bg-red-900/30 dark:text-red-200">
              <p>{listError}</p>
              <button
                type="button"
                onClick={handleRefresh}
                className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-medium text-red-600 dark:bg-slate-800 dark:text-red-300"
              >
                重试加载
              </button>
            </div>
          )}

          {!loadingList && !listError && jobs.length === 0 && (
            <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center dark:border-slate-700 dark:bg-slate-900/40">
              <Briefcase className="mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">还没有职位记录</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                先新增一个职位，后续就可以在这里跟踪投递和匹配结果。
              </p>
            </div>
          )}

          {!loadingList && !listError && jobs.length > 0 && filteredJobs.length === 0 && (
            <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center dark:border-slate-700 dark:bg-slate-900/40">
              <Search className="mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">没有匹配的职位</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                试试修改关键词，或者切换投递状态筛选。
              </p>
            </div>
          )}

          {!loadingList && !listError && filteredJobs.length > 0 && (
            <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
              {filteredJobs.map((job, index) => {
                const active = job.id === selectedJobId;

                return (
                  <motion.button
                    key={job.id}
                    type="button"
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    onClick={() => openJobDetail(job.id)}
                    className={`h-full w-full rounded-2xl border p-4 text-left transition-all ${
                      active
                        ? 'border-primary-500 bg-primary-50 shadow-sm dark:bg-primary-900/20'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                          {job.title}
                        </h3>
                        <p className="mt-1 truncate text-sm text-slate-500 dark:text-slate-400">
                          {job.company}
                        </p>
                      </div>
                      <span
                        className={`inline-flex flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(job.applicationStatus)}`}
                      >
                        {jobStatusLabelMap[job.applicationStatus]}
                      </span>
                    </div>

                    <div className="mt-3 space-y-2 text-xs text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>{job.location || '地点未填写'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-3.5 w-3.5" />
                        <span>创建于 {formatDateOnly(job.createdAt)}</span>
                      </div>
                    </div>

                    <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                      {formatSalaryRange(job.salaryMin, job.salaryMax)}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {job.techTags.length > 0 ? (
                        job.techTags.slice(0, 4).map((tag) => (
                          <span
                            key={`${job.id}-${tag}`}
                            className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                          >
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-500">暂无技术标签</span>
                      )}
                      {job.techTags.length > 4 && (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                          +{job.techTags.length - 4}
                        </span>
                      )}
                    </div>
                  </motion.button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <JobDetailModal
        open={detailModalOpen}
        job={selectedJob}
        loading={loadingDetail}
        error={detailError}
        followUps={followUps}
        loadingFollowUps={loadingFollowUps}
        followUpError={followUpError}
        onClose={() => setDetailModalOpen(false)}
        onRetry={() => {
          if (selectedJobId !== null) {
            void loadJobDetail(selectedJobId);
          }
        }}
        onRetryFollowUps={() => {
          if (selectedJobId !== null) {
            void loadFollowUps(selectedJobId);
          }
        }}
        onAddFollowUp={() => setFollowUpDialogOpen(true)}
        onChangeStatus={(status) => void updateSelectedJobStatus(status)}
        onEdit={() => {
          setDetailModalOpen(false);
          openEditDialog();
        }}
        onMatch={() => {
          setDetailModalOpen(false);
          setMatchOpen(true);
        }}
        onInterview={() => {
          setDetailModalOpen(false);
          openDirectedInterviewDialog();
        }}
        onDelete={() => {
          if (selectedJob) {
            setDetailModalOpen(false);
            setDeleteTarget(selectedJob);
          }
        }}
      />

      <JobFormDialog
        open={formOpen}
        mode={formMode}
        initialJob={formInitialJob}
        loading={submitting}
        onCancel={() => setFormOpen(false)}
        onSubmit={(data) => void handleSubmit(data)}
      />

      <JobMatchDialog
        open={matchOpen}
        job={
          selectedJobSummary
            ? {
                id: selectedJobSummary.id,
                title: selectedJobSummary.title,
                company: selectedJobSummary.company,
              }
            : null
        }
        onClose={() => setMatchOpen(false)}
      />

      <JobFollowUpDialog
        open={followUpDialogOpen}
        loading={savingFollowUp}
        onCancel={() => setFollowUpDialogOpen(false)}
        onSubmit={(data) => void handleCreateFollowUp(data)}
      />

      <ConfirmDialog
        open={interviewOpen}
        title="开始定向模拟面试"
        message={
          selectedJob
            ? `目标职位：${selectedJob.title} · ${selectedJob.company}`
            : '请选择职位后再开始面试'
        }
        confirmText="开始面试"
        cancelText="取消"
        loading={loadingInterviewResumes}
        onConfirm={handleStartDirectedInterview}
        onCancel={() => setInterviewOpen(false)}
        customContent={
          <div className="space-y-4">
            <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
              选择一份简历后，系统会结合该职位 JD、技术标签与简历内容生成更有针对性的面试题。
            </p>

            {loadingInterviewResumes && (
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-700/40 dark:text-slate-300">
                <Loader2 className="h-4 w-4 animate-spin" />
                正在加载简历列表...
              </div>
            )}

            {!loadingInterviewResumes && interviewResumes.length === 0 && (
              <div className="rounded-xl border border-amber-300/70 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-600/70 dark:bg-amber-900/20 dark:text-amber-200">
                暂无可用简历，请先上传并解析简历后再发起定向面试。
              </div>
            )}

            {!loadingInterviewResumes && interviewResumes.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">选择简历</p>
                <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                  {interviewResumes.map((resume) => {
                    const selected = selectedInterviewResumeId === resume.id;

                    return (
                      <button
                        key={resume.id}
                        type="button"
                        onClick={() => {
                          setSelectedInterviewResumeId(resume.id);
                          setInterviewError(null);
                        }}
                        className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${
                          selected
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                            : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/60'
                        }`}
                      >
                        <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                          {resume.filename}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          简历 ID：{resume.id}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {interviewError && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/70 dark:bg-red-900/30 dark:text-red-200">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{interviewError}</span>
              </div>
            )}
          </div>
        }
      />

      <DeleteConfirmDialog
        open={deleteTarget !== null}
        item={deleteTarget}
        itemType="职位"
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
        customMessage={
          deleteTarget ? (
            <>
              <p className="mb-2">
                确定要删除职位 <strong>“{deleteTarget.title}”</strong> 吗？
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                公司：{deleteTarget.company}。删除后该职位的匹配记录入口会一并失效，且无法恢复。
              </p>
            </>
          ) : undefined
        }
      />
    </div>
  );
}

interface JobDetailModalProps {
  open: boolean;
  job: JobDetail | null;
  loading: boolean;
  error: string | null;
  followUps: JobFollowUpRecord[];
  loadingFollowUps: boolean;
  followUpError: string | null;
  onClose: () => void;
  onRetry: () => void;
  onRetryFollowUps: () => void;
  onAddFollowUp: () => void;
  onChangeStatus: (status: JobApplicationStatus) => void;
  onEdit: () => void;
  onMatch: () => void;
  onInterview: () => void;
  onDelete: () => void;
}

function JobDetailModal({
  open,
  job,
  loading,
  error,
  followUps,
  loadingFollowUps,
  followUpError,
  onClose,
  onRetry,
  onRetryFollowUps,
  onAddFollowUp,
  onChangeStatus,
  onEdit,
  onMatch,
  onInterview,
  onDelete,
}: JobDetailModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="关闭职位详情弹窗"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-slate-950/50 backdrop-blur-sm"
      />

      <div className="pointer-events-none relative flex min-h-full items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.18 }}
          role="dialog"
          aria-modal="true"
          aria-label="职位详情"
          className="pointer-events-auto relative w-full max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900"
        >
          <button
            type="button"
            aria-label="关闭职位详情"
            onClick={onClose}
            className="absolute right-4 top-4 z-10 rounded-full border border-slate-200 bg-white/90 p-2 text-slate-500 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <X className="h-4 w-4" />
          </button>

          {loading && (
            <div className="flex min-h-[520px] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
            </div>
          )}

          {!loading && error && (
            <div className="flex min-h-[520px] items-center justify-center px-6">
              <div className="max-w-md rounded-2xl border border-red-200 bg-red-50 p-5 text-center dark:border-red-500/70 dark:bg-red-900/30">
                <AlertCircle className="mx-auto mb-3 h-8 w-8 text-red-500" />
                <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
                <button
                  type="button"
                  onClick={onRetry}
                  className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-medium text-red-600 dark:bg-slate-800 dark:text-red-300"
                >
                  重试加载详情
                </button>
              </div>
            </div>
          )}

          {!loading && !error && !job && (
            <div className="flex min-h-[520px] flex-col items-center justify-center px-6 text-center">
              <Briefcase className="mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">正在准备职位详情</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                如果长时间没有响应，请关闭弹窗后重新选择职位。
              </p>
            </div>
          )}

          {!loading && !error && job && (
            <div className="grid max-h-[90vh] min-h-[560px] lg:grid-cols-[320px,1fr]">
              <aside className="min-h-0 overflow-y-auto border-b border-slate-100 bg-slate-50/80 p-6 dark:border-slate-800 dark:bg-slate-950/40 lg:border-b-0 lg:border-r">
                <div className="mb-4 flex flex-wrap items-center gap-2 pr-12">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getStatusBadgeClass(job.applicationStatus)}`}
                  >
                    {jobStatusLabelMap[job.applicationStatus]}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    创建于 {formatDateTime(job.createdAt)}
                  </span>
                </div>

                <h2 className="text-2xl font-bold leading-tight text-slate-900 dark:text-white">
                  {job.title}
                </h2>
                <p className="mt-3 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <Building2 className="h-4 w-4 flex-shrink-0" />
                  <span>{job.company}</span>
                </p>

                <div className="mt-6 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-slate-400" />
                    <span>{job.location || '地点未填写'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-slate-400" />
                    <span>{formatSalaryRange(job.salaryMin, job.salaryMax)}</span>
                  </div>
                </div>

                <div className="mt-6">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    技术标签
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {job.techTags.length > 0 ? (
                      job.techTags.slice(0, 8).map((tag) => (
                        <span
                          key={`${job.id}-${tag}`}
                          className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm dark:bg-slate-800 dark:text-slate-300"
                        >
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 dark:text-slate-500">暂无技术标签</span>
                    )}
                    {job.techTags.length > 8 && (
                      <span className="rounded-full bg-white px-3 py-1 text-xs text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-400">
                        +{job.techTags.length - 8}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-8 grid gap-3">
                  <button
                    type="button"
                    onClick={onAddFollowUp}
                    className="flex items-center justify-center gap-2 rounded-xl border border-primary-200 bg-primary-50 px-4 py-2.5 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-100 dark:border-primary-700/60 dark:bg-primary-900/20 dark:text-primary-200"
                  >
                    添加跟进
                  </button>
                  {job.applicationStatus !== 'APPLIED' && (
                    <button
                      type="button"
                      onClick={() => onChangeStatus('APPLIED')}
                      className="rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-600"
                    >
                      标记已投递
                    </button>
                  )}
                  {job.applicationStatus !== 'INTERVIEWING' && (
                    <button
                      type="button"
                      onClick={() => onChangeStatus('INTERVIEWING')}
                      className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-amber-600"
                    >
                      进入面试中
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onMatch}
                    className="flex items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-600"
                  >
                    <Target className="h-4 w-4" />
                    简历匹配
                  </button>
                  <button
                    type="button"
                    onClick={onInterview}
                    className="flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-600"
                  >
                    <Sparkles className="h-4 w-4" />
                    定向面试
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    {job.applicationStatus !== 'OFFERED' && (
                      <button
                        type="button"
                        onClick={() => onChangeStatus('OFFERED')}
                        className="rounded-xl bg-emerald-500 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-600"
                      >
                        标记 Offer
                      </button>
                    )}
                    {job.applicationStatus !== 'REJECTED' && (
                      <button
                        type="button"
                        onClick={() => onChangeStatus('REJECTED')}
                        className="rounded-xl bg-rose-500 px-3 py-2.5 text-sm font-medium text-white transition-colors hover:bg-rose-600"
                      >
                        标记拒绝
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={onEdit}
                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    <Edit3 className="h-4 w-4" />
                    编辑职位
                  </button>
                  <button
                    type="button"
                    onClick={onDelete}
                    className="flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 dark:border-red-500/40 dark:bg-red-900/20 dark:text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                    删除职位
                  </button>
                </div>
              </aside>

              <section className="min-h-0 overflow-y-auto p-6 lg:p-8">
                <div className="mb-6 pr-12">
                  <p className="text-sm font-medium text-primary-500">职位详情</p>
                  <h3 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                    JD、状态与跟进信息
                  </h3>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <DetailCard icon={MapPin} label="工作地点" value={job.location || '未填写'} />
                  <DetailCard
                    icon={Sparkles}
                    label="薪资范围"
                    value={formatSalaryRange(job.salaryMin, job.salaryMax)}
                  />
                  <DetailCard
                    icon={CalendarDays}
                    label="下一步跟进"
                    value={job.nextFollowUpAt ? formatDateTime(job.nextFollowUpAt) : '未设置'}
                  />
                </div>

                <FollowUpTimeline
                  job={job}
                  followUps={followUps}
                  loadingFollowUps={loadingFollowUps}
                  followUpError={followUpError}
                  onRetryFollowUps={onRetryFollowUps}
                />

                <div className="mt-6 rounded-2xl border border-slate-100 p-5 dark:border-slate-700">
                  <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    职位描述
                  </h3>
                  <p className="whitespace-pre-wrap text-sm leading-7 text-slate-600 dark:text-slate-300">
                    {job.description}
                  </p>
                </div>

                <div className="mt-6 rounded-2xl border border-slate-100 p-5 dark:border-slate-700">
                  <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    技术标签
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {job.techTags.length > 0 ? (
                      job.techTags.map((tag) => (
                        <span
                          key={`${job.id}-${tag}`}
                          className="rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-600 dark:bg-primary-900/30 dark:text-primary-300"
                        >
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-slate-400 dark:text-slate-500">
                        暂无技术标签，后端会根据职位描述自动提取。
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-slate-100 p-5 dark:border-slate-700">
                  <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    跟进备注
                  </h3>
                  <p className="whitespace-pre-wrap text-sm leading-7 text-slate-600 dark:text-slate-300">
                    {job.notes || '暂无备注，可用于记录投递渠道、面试进度和 follow-up 计划。'}
                  </p>
                </div>
              </section>
            </div>
          )}
        </motion.div>
      </div>
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
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800"
    >
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
    </motion.div>
  );
}

interface DetailCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}

function DetailCard({ icon: Icon, label, value }: DetailCardProps) {
  return (
    <div className="rounded-2xl border border-slate-100 p-4 dark:border-slate-700">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
        <Icon className="h-4 w-4" />
        <span>{label}</span>
      </div>
      <p className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-100">{value}</p>
    </div>
  );
}

interface FollowUpTimelineProps {
  job: JobDetail;
  followUps: JobFollowUpRecord[];
  loadingFollowUps: boolean;
  followUpError: string | null;
  onRetryFollowUps: () => void;
}

function FollowUpTimeline({
  job,
  followUps,
  loadingFollowUps,
  followUpError,
  onRetryFollowUps,
}: FollowUpTimelineProps) {
  return (
    <div className="mt-6 rounded-2xl border border-primary-100 bg-primary-50/40 p-5 dark:border-primary-800/60 dark:bg-primary-900/10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
            投递跟进时间线
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            状态变化会自动记录，也可以手动添加沟通、面试和备注。
          </p>
        </div>
        {job.appliedAt && (
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
            投递于 {formatDateTime(job.appliedAt)}
          </span>
        )}
      </div>

      {loadingFollowUps && (
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在加载跟进记录...
        </div>
      )}

      {!loadingFollowUps && followUpError && (
        <button
          type="button"
          onClick={onRetryFollowUps}
          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-500/60 dark:bg-red-900/20 dark:text-red-200"
        >
          {followUpError}，点击重试
        </button>
      )}

      {!loadingFollowUps && !followUpError && followUps.length === 0 && (
        <p className="rounded-xl bg-white px-3 py-4 text-sm text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-400">
          还没有跟进记录。点击左侧“标记已投递”或“添加跟进”后，记录会显示在这里。
        </p>
      )}

      {!loadingFollowUps && !followUpError && followUps.length > 0 && (
        <div className="space-y-3">
          {followUps.map((record) => (
            <div key={record.id} className="rounded-xl bg-white p-3 shadow-sm dark:bg-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-600 dark:bg-primary-900/30 dark:text-primary-200">
                    {jobFollowUpTypeLabelMap[record.type]}
                  </span>
                  {record.contactMethod && (
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {record.contactMethod}
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  {formatDateTime(record.createdAt)}
                </span>
              </div>
              <p className="mt-3 text-sm font-medium text-slate-800 dark:text-slate-100">
                {record.title}
              </p>
              {record.content && (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-500 dark:text-slate-300">
                  {record.content}
                </p>
              )}
              {record.nextFollowUpAt && (
                <p className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-300">
                  下次跟进：{formatDateTime(record.nextFollowUpAt)}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
