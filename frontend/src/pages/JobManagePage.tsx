import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  Briefcase,
  Building2,
  CalendarDays,
  ChevronDown,
  CheckCircle2,
  ClipboardList,
  Copy,
  Edit3,
  ExternalLink,
  FileText,
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
import { jobApi, jobFollowUpApi, userExperienceApi } from '../api';
import { historyApi, type ResumeDetail, type ResumeListItem } from '../api/history';
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
import type { UserExperience } from '../types/user-experience';
import { userExperienceTypeLabelMap } from '../types/user-experience';
import { formatDateOnly, formatDateTime } from '../utils/date';

type StatusFilter = JobApplicationStatus | 'ALL';
type DeliveryPrepFilter = 'ALL' | 'WAITING_SEND' | 'PREPARED' | 'FOLLOW_UP' | 'IN_PROGRESS' | 'NEED_INFO';

const statusFilterOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: 'ALL', label: '全部状态' },
  ...jobStatusOptions,
];

const deliveryPrepFilterOptions: Array<{ value: DeliveryPrepFilter; label: string }> = [
  { value: 'ALL', label: '全部准备状态' },
  { value: 'WAITING_SEND', label: '待发送' },
  { value: 'PREPARED', label: '已准备' },
  { value: 'FOLLOW_UP', label: '待跟进' },
  { value: 'IN_PROGRESS', label: '已进入流程' },
  { value: 'NEED_INFO', label: '待完善' },
];

function formatSalaryRange(salaryMin: number | null, salaryMax: number | null, salaryText?: string | null) {
  if (salaryMin !== null && salaryMax !== null) {
    return `￥${salaryMin.toLocaleString()} - ￥${salaryMax.toLocaleString()}`;
  }
  if (salaryMin !== null) {
    return `￥${salaryMin.toLocaleString()} 起`;
  }
  if (salaryMax !== null) {
    return `最高 ￥${salaryMax.toLocaleString()}`;
  }
  if (salaryText?.trim()) {
    return salaryText.trim();
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

function getDeliveryPrepState(job: JobListItem) {
  if (job.applicationStatus !== 'SAVED') {
    return {
      key: 'IN_PROGRESS' as const,
      label: jobStatusLabelMap[job.applicationStatus],
      hint: job.appliedAt ? `投递于 ${formatDateOnly(job.appliedAt)}` : '已进入投递流程',
      className: getStatusBadgeClass(job.applicationStatus),
    };
  }

  if (job.nextFollowUpAt) {
    return {
      key: 'FOLLOW_UP' as const,
      label: '待跟进',
      hint: `跟进时间 ${formatDateOnly(job.nextFollowUpAt)}`,
      className: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    };
  }

  if (job.lastFollowUpAt) {
    return {
      key: 'PREPARED' as const,
      label: '已准备',
      hint: `最近记录 ${formatDateOnly(job.lastFollowUpAt)}`,
      className: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
    };
  }

  if (job.sourceUrl) {
    return {
      key: 'WAITING_SEND' as const,
      label: '待发送',
      hint: '已导入岗位，建议准备开场白',
      className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    };
  }

  return {
    key: 'NEED_INFO' as const,
    label: '待完善',
    hint: '补全岗位信息后再投递',
    className: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  };
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

function matchDeliveryPrepFilter(job: JobListItem, filter: DeliveryPrepFilter) {
  if (filter === 'ALL') {
    return true;
  }

  return getDeliveryPrepState(job).key === filter;
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
  const [deliveryPrepFilter, setDeliveryPrepFilter] = useState<DeliveryPrepFilter>('ALL');
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
  const [appliedDialogOpen, setAppliedDialogOpen] = useState(false);
  const [appliedNote, setAppliedNote] = useState('已发送开场白，等待 HR 回复。');
  const [savingApplied, setSavingApplied] = useState(false);
  const [deliveryPrepOpen, setDeliveryPrepOpen] = useState(false);
  const [deliveryExperiences, setDeliveryExperiences] = useState<UserExperience[]>([]);
  const [loadingDeliveryExperiences, setLoadingDeliveryExperiences] = useState(false);
  const [deliveryPrepError, setDeliveryPrepError] = useState<string | null>(null);
  const [deliveryResumes, setDeliveryResumes] = useState<ResumeListItem[]>([]);
  const [loadingDeliveryResumes, setLoadingDeliveryResumes] = useState(false);
  const [deliveryResumeError, setDeliveryResumeError] = useState<string | null>(null);

  // 通过 ref 记录当前选中项，避免因为列表刷新函数依赖 selectedJobId 而反复重新请求列表。
  const selectedJobIdRef = useRef<number | null>(null);
  const detailRequestIdRef = useRef(0);
  const pendingDeliveryPrepJobIdRef = useRef<number | null>(null);
  const routeSelectedJobId = (location.state as { selectedJobId?: number } | null)?.selectedJobId ?? null;
  const queryParams = new URLSearchParams(location.search);
  const querySelectedJobId = Number(queryParams.get('selectedJobId'));
  const importedSelectedJobId = Number.isFinite(querySelectedJobId) && querySelectedJobId > 0 ? querySelectedJobId : null;
  const shouldOpenDeliveryPrep = queryParams.get('deliveryPrep') === '1';

  useEffect(() => {
    selectedJobIdRef.current = selectedJobId;
  }, [selectedJobId]);

  useEffect(() => {
    const nextSelectedJobId = routeSelectedJobId ?? importedSelectedJobId;
    if (nextSelectedJobId === null) {
      return;
    }

    // 从简历详情页保存职位草稿后，优先聚焦刚创建的职位。
    selectedJobIdRef.current = nextSelectedJobId;
    setSelectedJobId(nextSelectedJobId);
    if (shouldOpenDeliveryPrep) {
      pendingDeliveryPrepJobIdRef.current = nextSelectedJobId;
      setDetailModalOpen(false);
    } else {
      setDetailModalOpen(true);
    }
    navigate(location.pathname, { replace: true, state: null });
  }, [routeSelectedJobId, importedSelectedJobId, shouldOpenDeliveryPrep, navigate, location.pathname]);

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

  const loadDeliveryExperiences = useCallback(async () => {
    setLoadingDeliveryExperiences(true);
    setDeliveryPrepError(null);

    try {
      const data = await userExperienceApi.list(true);
      setDeliveryExperiences(data);
    } catch (error) {
      setDeliveryExperiences([]);
      setDeliveryPrepError(getErrorMessage(error));
    } finally {
      setLoadingDeliveryExperiences(false);
    }
  }, []);

  const loadDeliveryResumes = useCallback(async () => {
    setLoadingDeliveryResumes(true);
    setDeliveryResumeError(null);

    try {
      const data = await historyApi.getResumes();
      setDeliveryResumes(data);
    } catch (error) {
      setDeliveryResumes([]);
      setDeliveryResumeError(getErrorMessage(error));
    } finally {
      setLoadingDeliveryResumes(false);
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
    () => jobs.filter((job) => matchKeyword(job, searchKeyword) && matchDeliveryPrepFilter(job, deliveryPrepFilter)),
    [jobs, searchKeyword, deliveryPrepFilter],
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

  const deliveryPrepCounts = useMemo(
    () =>
      jobs.reduce(
        (counts, job) => {
          const state = getDeliveryPrepState(job);
          counts[state.key] += 1;
          return counts;
        },
        {
          WAITING_SEND: 0,
          PREPARED: 0,
          FOLLOW_UP: 0,
          IN_PROGRESS: 0,
          NEED_INFO: 0,
        } as Record<Exclude<DeliveryPrepFilter, 'ALL'>, number>,
      ),
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

  const openDeliveryPrepDialog = () => {
    if (!selectedJob) {
      return;
    }

    setDeliveryPrepError(null);
    setDeliveryPrepOpen(true);
    void loadDeliveryExperiences();
    void loadDeliveryResumes();
  };

  useEffect(() => {
    if (
      !selectedJob ||
      loadingDetail ||
      pendingDeliveryPrepJobIdRef.current !== selectedJob.id
    ) {
      return;
    }

    pendingDeliveryPrepJobIdRef.current = null;
    setDeliveryPrepError(null);
    setDeliveryPrepOpen(true);
    void loadDeliveryExperiences();
    void loadDeliveryResumes();
  }, [selectedJob, loadingDetail, loadDeliveryExperiences, loadDeliveryResumes]);

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

  const refreshSelectedJobProgress = async (jobId: number) => {
    await loadJobDetail(jobId);
    await loadFollowUps(jobId);
    await loadJobs(jobId);
  };

  const handleRecordOpenerCopied = async (draft: string, resume: ResumeListItem | null) => {
    if (!selectedJob) {
      return;
    }

    await jobFollowUpApi.create(selectedJob.id, {
      type: 'CONTACT',
      title: '已复制 Boss 开场白',
      content: [
        '已复制开场白，准备前往 BOSS 发送。',
        resume ? `使用简历：${resume.filename}` : '当前未选择简历。',
        '',
        draft,
      ].join('\n'),
      contactMethod: 'BOSS',
    });
    await refreshSelectedJobProgress(selectedJob.id);
  };

  const openAppliedConfirmDialog = () => {
    if (!selectedJob) {
      return;
    }

    setActionError(null);
    setAppliedNote('已发送开场白，等待 HR 回复。');
    setAppliedDialogOpen(true);
  };

  const handleConfirmApplied = async () => {
    if (!selectedJob) {
      return;
    }

    setSavingApplied(true);
    setActionError(null);

    try {
      if (selectedJob.applicationStatus !== 'APPLIED') {
        await jobApi.updateJob(selectedJob.id, { applicationStatus: 'APPLIED' });
      }
      await jobFollowUpApi.create(selectedJob.id, {
        type: 'CONTACT',
        title: '已发送开场白',
        content: appliedNote.trim() || '已发送开场白，等待 HR 回复。',
        contactMethod: 'BOSS',
      });
      setAppliedDialogOpen(false);
      await refreshSelectedJobProgress(selectedJob.id);
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setSavingApplied(false);
    }
  };

  const updateSelectedJobStatus = async (status: JobApplicationStatus) => {
    if (!selectedJob || selectedJob.applicationStatus === status) {
      return;
    }

    setActionError(null);

    try {
      await jobApi.updateJob(selectedJob.id, { applicationStatus: status });
      await refreshSelectedJobProgress(selectedJob.id);
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={Briefcase}
          label="职位总数"
          value={jobs.length.toString()}
          hint="当前状态筛选下的职位数量"
          colorClass="bg-primary-500"
        />
        <SummaryCard
          icon={Copy}
          label="待发送"
          value={deliveryPrepCounts.WAITING_SEND.toString()}
          hint="已导入岗位，下一步准备并发送开场白"
          colorClass="bg-emerald-500"
          active={deliveryPrepFilter === 'WAITING_SEND'}
          onClick={() => setDeliveryPrepFilter('WAITING_SEND')}
        />
        <SummaryCard
          icon={CheckCircle2}
          label="已准备"
          value={deliveryPrepCounts.PREPARED.toString()}
          hint="已复制开场白或已有沟通记录"
          colorClass="bg-sky-500"
          active={deliveryPrepFilter === 'PREPARED'}
          onClick={() => setDeliveryPrepFilter('PREPARED')}
        />
        <SummaryCard
          icon={CalendarDays}
          label="待跟进"
          value={deliveryPrepCounts.FOLLOW_UP.toString()}
          hint="已设置下一次跟进时间"
          colorClass="bg-amber-500"
          active={deliveryPrepFilter === 'FOLLOW_UP'}
          onClick={() => setDeliveryPrepFilter('FOLLOW_UP')}
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
          <div className="mb-4 grid gap-3 lg:grid-cols-[1fr,200px,200px]">
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

            <select
              value={deliveryPrepFilter}
              onChange={(event) => setDeliveryPrepFilter(event.target.value as DeliveryPrepFilter)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-100 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-primary-900/30"
            >
              {deliveryPrepFilterOptions.map((option) => (
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
                const deliveryPrepState = getDeliveryPrepState(job);

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
                      {formatSalaryRange(job.salaryMin, job.salaryMax, job.salaryText)}
                    </p>

                    <div className="mt-3 rounded-xl bg-white/70 px-3 py-2 text-xs dark:bg-slate-900/30">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex flex-shrink-0 rounded-full px-2.5 py-1 font-medium ${deliveryPrepState.className}`}
                        >
                          {deliveryPrepState.label}
                        </span>
                        <span className="truncate text-slate-500 dark:text-slate-400">
                          {deliveryPrepState.hint}
                        </span>
                      </div>
                    </div>

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
        onPrepareDelivery={() => {
          setDetailModalOpen(false);
          openDeliveryPrepDialog();
        }}
        onChangeStatus={(status) => {
          if (status === 'APPLIED') {
            openAppliedConfirmDialog();
            return;
          }
          void updateSelectedJobStatus(status);
        }}
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

      <DeliveryPrepDialog
        open={deliveryPrepOpen}
        job={selectedJob}
        experiences={deliveryExperiences}
        resumes={deliveryResumes}
        loadingExperiences={loadingDeliveryExperiences}
        loadingResumes={loadingDeliveryResumes}
        error={deliveryPrepError}
        resumeError={deliveryResumeError}
        followUps={followUps}
        loadingFollowUps={loadingFollowUps}
        followUpError={followUpError}
        onClose={() => setDeliveryPrepOpen(false)}
        onRetry={() => void loadDeliveryExperiences()}
        onRetryResumes={() => void loadDeliveryResumes()}
        onOpenExperiences={() => {
          setDeliveryPrepOpen(false);
          navigate('/profile/experiences');
        }}
        onCopyDraft={(draft, resume) => handleRecordOpenerCopied(draft, resume)}
        onMatch={() => {
          setDeliveryPrepOpen(false);
          setMatchOpen(true);
        }}
        onMarkApplied={openAppliedConfirmDialog}
      />

      <ConfirmDialog
        open={appliedDialogOpen}
        title="标记已投递"
        message="确认已经在 BOSS 等渠道发送开场白后，会把职位状态更新为已投递，并写入一条跟进记录。"
        confirmText="保存并标记已投递"
        cancelText="取消"
        loading={savingApplied}
        onConfirm={() => void handleConfirmApplied()}
        onCancel={() => setAppliedDialogOpen(false)}
        customContent={
          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              投递备注
            </label>
            <textarea
              value={appliedNote}
              onChange={(event) => setAppliedNote(event.target.value)}
              className="min-h-28 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              placeholder="例如：已发送开场白，等待 HR 回复。"
              maxLength={12000}
            />
          </div>
        }
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
  onPrepareDelivery: () => void;
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
  onPrepareDelivery,
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
          className="pointer-events-auto relative h-[calc(100vh-2rem)] max-h-[900px] w-full max-w-6xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900"
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
            <div className="grid h-full min-h-0 overflow-y-auto lg:grid-cols-[320px,1fr]">
              <aside className="border-b border-slate-100 bg-slate-50/80 p-6 dark:border-slate-800 dark:bg-slate-950/40 lg:border-b-0 lg:border-r">
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
                    <span>{formatSalaryRange(job.salaryMin, job.salaryMax, job.salaryText)}</span>
                  </div>
                </div>

                <FollowUpTimeline
                  job={job}
                  followUps={followUps}
                  loadingFollowUps={loadingFollowUps}
                  followUpError={followUpError}
                  onRetryFollowUps={onRetryFollowUps}
                />

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
                    onClick={onPrepareDelivery}
                    className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-600"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    准备投递
                  </button>
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

              <section className="p-6 lg:p-8">
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
                    value={formatSalaryRange(job.salaryMin, job.salaryMax, job.salaryText)}
                  />
                  <DetailCard
                    icon={CalendarDays}
                    label="下一步跟进"
                    value={job.nextFollowUpAt ? formatDateTime(job.nextFollowUpAt) : '未设置'}
                  />
                </div>

                {(job.sourcePlatform || job.sourceUrl || job.externalJobId) && (
                  <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-5 dark:border-emerald-800/60 dark:bg-emerald-900/10">
                    <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
                      岗位来源
                    </h3>
                    <div className="space-y-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                      {job.sourcePlatform && <p>来源平台：{job.sourcePlatform}</p>}
                      {job.externalJobId && <p>外部职位 ID：{job.externalJobId}</p>}
                      {job.sourceUrl && (
                        <a
                          href={job.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="break-all text-emerald-700 hover:underline dark:text-emerald-300"
                        >
                          打开原始岗位链接
                        </a>
                      )}
                    </div>
                  </div>
                )}

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

interface DeliveryPrepDialogProps {
  open: boolean;
  job: JobDetail | null;
  experiences: UserExperience[];
  resumes: ResumeListItem[];
  loadingExperiences: boolean;
  loadingResumes: boolean;
  error: string | null;
  resumeError: string | null;
  followUps: JobFollowUpRecord[];
  loadingFollowUps: boolean;
  followUpError: string | null;
  onClose: () => void;
  onRetry: () => void;
  onRetryResumes: () => void;
  onOpenExperiences: () => void;
  onCopyDraft: (draft: string, resume: ResumeListItem | null) => Promise<void>;
  onMatch: () => void;
  onMarkApplied: () => void;
}

function sortResumesByLatest(resumes: ResumeListItem[]) {
  return [...resumes].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
}

function shortenText(value: string, maxLength = 80) {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength)}...`;
}

function normalizeOpenerText(value: string) {
  return value
    .replace(/[「」『』“”"《》（）()]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/([\u4e00-\u9fa5])\s+([A-Za-z0-9])/g, '$1$2')
    .replace(/([A-Za-z0-9])\s+([\u4e00-\u9fa5])/g, '$1$2')
    .trim();
}

function collectMatchedKeywords(sources: string[], keywords: string[]) {
  const sourceText = sources.join(' ').toLowerCase();
  return keywords.filter((keyword) => sourceText.includes(keyword.toLowerCase()));
}

function uniqueLimited(values: string[], limit: number) {
  return Array.from(new Set(values.filter(Boolean))).slice(0, limit);
}

function getResumeSignals(resumeDetail: ResumeDetail | null, experiences: UserExperience[]) {
  const latestAnalysis = resumeDetail?.analyses?.[0];
  const sources = [
    resumeDetail?.resumeText ?? '',
    latestAnalysis?.summary ?? '',
    ...(latestAnalysis?.strengths ?? []),
    ...experiences.map((item) => `${item.title} ${item.content} ${item.tags.join(' ')}`),
  ].map(normalizeOpenerText);

  const technicalKeywords = uniqueLimited(collectMatchedKeywords(sources, [
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
  ]).map((keyword) => keyword.replace('Spring Boot', 'SpringBoot')), 4);

  const abilityKeywords = uniqueLimited(collectMatchedKeywords(sources, [
    '项目落地',
    '系统开发',
    '接口开发',
    '前后端协作',
    '任务流转',
    '数据持久化',
    '业务闭环',
    '问题拆解',
    '工程落地',
  ]), 3);

  return { technicalKeywords, abilityKeywords };
}

function buildTechnicalEvidence(keywords: string[], primaryExperience: string | null) {
  if (keywords.length === 0) {
    return primaryExperience
      ? `我之前做过${shortenText(primaryExperience, 28)}相关项目`
      : '我目前也在做岗位方向需要的项目和技术积累';
  }

  const backendKeywords = keywords.filter((keyword) => ['Java', 'SpringBoot', 'Python', '接口', '后端'].includes(keyword)).slice(0, 2);
  const aiKeywords = keywords.filter((keyword) => ['RAG', 'Agent', '向量检索', '知识库', 'SSE', '流式', 'AI应用', '工程化'].includes(keyword)).slice(0, 2);
  const otherKeywords = keywords.filter((keyword) => !backendKeywords.includes(keyword) && !aiKeywords.includes(keyword));

  if (backendKeywords.length > 0 && aiKeywords.length > 0) {
    return `我之前做过${backendKeywords.join('、')}相关的后端开发，也接触过${aiKeywords.join('、')}这类AI应用功能开发`;
  }

  if (backendKeywords.length > 0) {
    return `我之前做过${backendKeywords.join('、')}相关的后端开发和业务功能落地`;
  }

  if (aiKeywords.length > 0) {
    return `我之前接触过${aiKeywords.join('、')}这类AI应用功能开发，也会结合业务场景推进落地`;
  }

  return `我之前在项目里主要用到${otherKeywords.join('、')}，能结合需求完成具体功能开发`;
}

function buildAbilityEvidence(keywords: string[], secondaryExperience: string | null) {
  if (keywords.length > 0) {
    const normalizedKeywords = keywords.map((keyword) => {
      if (keyword === '接口开发') {
        return '接口实现';
      }
      if (keyword === '项目落地' || keyword === '工程落地') {
        return '业务功能落地';
      }
      return keyword;
    });

    return `平时会参与${uniqueLimited(normalizedKeywords, 3).join('、')}这些工作`;
  }

  return secondaryExperience
    ? `也做过${shortenText(secondaryExperience, 24)}相关内容`
    : '平时会参与接口实现、前后端协作和业务功能落地';
}

function buildBossOpenerDraft(
  job: JobDetail,
  resume: ResumeListItem | null,
  resumeDetail: ResumeDetail | null,
  experiences: UserExperience[],
) {
  const normalizedTitle = normalizeOpenerText(job.title);
  const resumeSignals = getResumeSignals(resumeDetail, experiences);
  const primaryExperience = experiences[0] ? normalizeOpenerText(shortenText(experiences[0].content, 54)) : null;
  const secondaryExperience = experiences[1] ? normalizeOpenerText(shortenText(experiences[1].content, 36)) : null;
  const resumeClose = resume
    ? '希望您查看一下我的简历，方便后续进一步交流。'
    : '希望后续有机会进一步交流。';

  const firstParagraph = normalizeOpenerText(
    `您好，我看到${normalizedTitle}这个岗位后，感觉和我最近在做的方向比较接近，所以想和您沟通一下。`,
  );
  const technicalText = buildTechnicalEvidence(resumeSignals.technicalKeywords, primaryExperience);
  const abilityText = buildAbilityEvidence(resumeSignals.abilityKeywords, secondaryExperience);
  const experienceText = `${technicalText}，${abilityText}。`;
  const secondParagraph = normalizeOpenerText(`${experienceText}${resumeClose}`);

  return normalizeOpenerText(`${firstParagraph}${secondParagraph}`);
}

function DeliveryPrepDialog({
  open,
  job,
  experiences,
  resumes,
  loadingExperiences,
  loadingResumes,
  error,
  resumeError,
  followUps,
  loadingFollowUps,
  followUpError,
  onClose,
  onRetry,
  onRetryResumes,
  onOpenExperiences,
  onCopyDraft,
  onMatch,
  onMarkApplied,
}: DeliveryPrepDialogProps) {
  const sortedResumes = useMemo(() => sortResumesByLatest(resumes), [resumes]);
  const [selectedResumeId, setSelectedResumeId] = useState<number | null>(null);
  const [selectedResumeDetail, setSelectedResumeDetail] = useState<ResumeDetail | null>(null);
  const [loadingResumeDetail, setLoadingResumeDetail] = useState(false);
  const [resumeDetailError, setResumeDetailError] = useState<string | null>(null);
  const [openerDraft, setOpenerDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setSelectedResumeId(sortedResumes[0]?.id ?? null);
  }, [open, sortedResumes]);

  useEffect(() => {
    if (!open || selectedResumeId === null) {
      setSelectedResumeDetail(null);
      setResumeDetailError(null);
      return;
    }

    let cancelled = false;
    setLoadingResumeDetail(true);
    setResumeDetailError(null);

    historyApi.getResumeDetail(selectedResumeId)
      .then((detail) => {
        if (!cancelled) {
          setSelectedResumeDetail(detail);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setSelectedResumeDetail(null);
          setResumeDetailError(getErrorMessage(loadError));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingResumeDetail(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, selectedResumeId]);

  const selectedResume = useMemo(
    () => sortedResumes.find((resume) => resume.id === selectedResumeId) ?? null,
    [sortedResumes, selectedResumeId],
  );

  const generateOpenerDraft = useCallback(() => {
    if (!job) {
      return;
    }
    setOpenerDraft(buildBossOpenerDraft(job, selectedResume, selectedResumeDetail, experiences));
    setCopied(false);
    setCopyError(null);
  }, [job, selectedResume, selectedResumeDetail, experiences]);

  useEffect(() => {
    if (!open || !job) {
      return;
    }
    generateOpenerDraft();
  }, [open, job, selectedResumeDetail, generateOpenerDraft]);

  if (!open || !job) {
    return null;
  }

  const hasFullJd = job.description.trim().length >= 80;
  const hasTechTags = job.techTags.length > 0;
  const hasEnabledExperience = experiences.length > 0;
  const hasSelectedResume = selectedResume !== null;
  const alreadyApplied = job.applicationStatus === 'APPLIED'
    || job.applicationStatus === 'INTERVIEWING'
    || job.applicationStatus === 'OFFERED'
    || job.applicationStatus === 'REJECTED';
  const readyCount = [hasFullJd, hasTechTags, hasSelectedResume].filter(Boolean).length;
  const sourceUrl = job.sourceUrl?.trim() || '';

  const checks = [
    {
      label: '岗位 JD 已补全',
      ready: hasFullJd,
      hint: hasFullJd ? '岗位描述可用于生成更贴合的开场白。' : '当前 JD 偏短，建议先补全岗位详情。',
    },
    {
      label: '岗位标签已提取',
      ready: hasTechTags,
      hint: hasTechTags ? `已识别 ${job.techTags.length} 个技术标签。` : '暂未识别技术标签，后续匹配质量会受影响。',
    },
    {
      label: '投递简历已选择',
      ready: hasSelectedResume,
      hint: hasSelectedResume ? `当前使用「${selectedResume.filename}」。` : '没有可用简历时仍可先生成基础开场白。',
    },
  ];

  const copyOpenerDraft = async () => {
    if (!openerDraft.trim()) {
      return;
    }

    try {
      await navigator.clipboard.writeText(openerDraft);
      setCopied(true);
      setCopyError(null);
      try {
        await onCopyDraft(openerDraft, selectedResume);
      } catch (recordError) {
        setCopyError(`已复制，但操作记录保存失败：${getErrorMessage(recordError)}`);
      }
    } catch {
      setCopied(false);
      setCopyError('复制失败，请手动选中文案复制。');
    }
  };
  const latestFollowUp = followUps[0] ?? null;

  return (
    <div className="fixed inset-0 z-[60]">
      <button
        type="button"
        aria-label="关闭投递准备面板"
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
          aria-label="准备投递"
          className="pointer-events-auto relative h-[calc(100vh-2rem)] max-h-[860px] w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900"
        >
          <button
            type="button"
            aria-label="关闭准备投递"
            onClick={onClose}
            className="absolute right-4 top-4 z-10 rounded-full border border-slate-200 bg-white/90 p-2 text-slate-500 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="h-full overflow-y-auto p-6 lg:p-8">
            <div className="pr-12">
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-300">辅助投递准备</p>
              <h2 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                {job.title}
              </h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                {job.company} · {job.location || '地点未填写'} · {formatSalaryRange(job.salaryMin, job.salaryMax, job.salaryText)}
              </p>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                <p className="text-sm text-slate-500 dark:text-slate-400">准备完成度</p>
                <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{readyCount}/3</p>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">职位、标签和简历越完整越好</p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                <p className="text-sm text-slate-500 dark:text-slate-400">当前状态</p>
                <p className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
                  {jobStatusLabelMap[job.applicationStatus]}
                </p>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  {alreadyApplied ? '该职位已有投递后状态。' : '尚未标记投递。'}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
                <p className="text-sm text-slate-500 dark:text-slate-400">选中简历</p>
                <p className="mt-2 truncate text-lg font-bold text-slate-900 dark:text-white">
                  {selectedResume?.filename ?? '暂无简历'}
                </p>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">默认使用最新上传简历</p>
              </div>
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1fr,360px]">
              <section className="space-y-4">
                <div className="rounded-2xl border border-slate-100 p-5 dark:border-slate-700">
                  <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">选择投递简历</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    默认选择最新上传的简历，生成开场白前可以手动切换。
                  </p>

                  {loadingResumes && (
                    <div className="mt-4 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      正在加载简历列表...
                    </div>
                  )}

                  {!loadingResumes && resumeError && (
                    <button
                      type="button"
                      onClick={onRetryResumes}
                      className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-500/60 dark:bg-red-900/20 dark:text-red-200"
                    >
                      {resumeError}，点击重试
                    </button>
                  )}

                  {!loadingResumes && !resumeError && sortedResumes.length === 0 && (
                    <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                      还没有可用简历。当前仍可生成基础开场白，后续建议先上传简历。
                    </div>
                  )}

                  {!loadingResumes && !resumeError && sortedResumes.length > 0 && (
                    <>
                      <select
                        value={selectedResumeId ?? ''}
                        onChange={(event) => setSelectedResumeId(Number(event.target.value))}
                        className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-primary-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                      >
                        {sortedResumes.map((resume, index) => (
                          <option key={resume.id} value={resume.id}>
                            {index === 0 ? '最新 · ' : ''}{resume.filename} · 上传于 {formatDateOnly(resume.uploadedAt)}
                          </option>
                        ))}
                      </select>
                      {loadingResumeDetail && (
                        <p className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          正在读取选中简历内容...
                        </p>
                      )}
                      {!loadingResumeDetail && resumeDetailError && (
                        <p className="mt-2 text-xs text-amber-600 dark:text-amber-300">
                          简历详情读取失败，当前会用职位和我的经历生成：{resumeDetailError}
                        </p>
                      )}
                      {!loadingResumeDetail && !resumeDetailError && selectedResumeDetail && (
                        <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-300">
                          已读取选中简历内容，开场白会结合简历摘要和正文片段生成。
                        </p>
                      )}
                    </>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-100 p-5 dark:border-slate-700">
                  <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">准备检查</h3>
                  <div className="mt-4 space-y-3">
                    {checks.map((check) => (
                      <div key={check.label} className="flex gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                        <CheckCircle2
                          className={`mt-0.5 h-5 w-5 flex-shrink-0 ${
                            check.ready ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'
                          }`}
                        />
                        <div>
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{check.label}</p>
                          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{check.hint}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 p-5 dark:border-slate-700">
                  <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">已启用经历素材</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    我的经历是增强材料，没有也不阻塞生成。
                  </p>

                  {loadingExperiences && (
                    <div className="mt-4 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      正在加载我的经历...
                    </div>
                  )}

                  {!loadingExperiences && error && (
                    <button
                      type="button"
                      onClick={onRetry}
                      className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-500/60 dark:bg-red-900/20 dark:text-red-200"
                    >
                      {error}，点击重试
                    </button>
                  )}

                  {!loadingExperiences && !error && experiences.length === 0 && (
                    <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                      还没有启用的经历素材。建议先补充“自我介绍”“项目经历”或“技能亮点”。
                    </div>
                  )}

                  {!loadingExperiences && !error && experiences.length > 0 && (
                    <div className="mt-4 space-y-3">
                      {experiences.map((item) => (
                        <article key={item.id} className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-600 dark:bg-primary-900/30 dark:text-primary-300">
                              {userExperienceTypeLabelMap[item.type]}
                            </span>
                            {item.tags.slice(0, 3).map((tag) => (
                              <span key={`${item.id}-${tag}`} className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                                {tag}
                              </span>
                            ))}
                          </div>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{item.title}</p>
                          <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-slate-500 dark:text-slate-400">
                            {item.content}
                          </p>
                        </article>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-3xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-white p-5 shadow-lg shadow-emerald-500/10 dark:border-emerald-800/70 dark:from-emerald-900/20 dark:via-slate-900 dark:to-slate-900">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <span className="mb-2 inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                        可直接复制发送
                      </span>
                      <h3 className="flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-slate-100">
                        <FileText className="h-4 w-4 text-primary-500" />
                        Boss 开场白草稿
                      </h3>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        第一版按职位信息、选中简历和启用经历拼接，可手动编辑后复制。
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={generateOpenerDraft}
                        className="rounded-xl border border-primary-200 bg-white px-3 py-2 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-50 dark:border-primary-700/60 dark:bg-slate-800 dark:text-primary-200"
                      >
                        重新生成
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyOpenerDraft()}
                        disabled={!openerDraft.trim()}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Copy className="h-4 w-4" />
                        {copied ? '已复制' : '复制草稿'}
                      </button>
                    </div>
                  </div>

                  <textarea
                    value={openerDraft}
                    onChange={(event) => {
                      setOpenerDraft(event.target.value);
                      setCopied(false);
                      setCopyError(null);
                    }}
                    className="mt-4 min-h-72 w-full resize-y rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm leading-7 text-slate-800 shadow-inner outline-none transition-colors focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 dark:border-emerald-800/60 dark:bg-slate-950 dark:text-slate-100"
                    placeholder="点击“重新生成”创建开场白草稿"
                  />

                  {!hasEnabledExperience && (
                    <p className="mt-3 text-xs text-amber-600 dark:text-amber-300">
                      当前没有启用的“我的经历”，已生成基础话术；补充经历后文案会更贴近你本人。
                    </p>
                  )}
                  {copyError && (
                    <p className="mt-3 text-xs text-red-600 dark:text-red-300">{copyError}</p>
                  )}
                </div>
              </section>

              <aside className="space-y-4">
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 dark:border-emerald-800/60 dark:bg-emerald-900/10">
                  <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">下一步操作</h3>
                  {copied && (
                    <div className="mt-3 rounded-xl bg-white/80 px-3 py-2 text-xs leading-5 text-emerald-700 dark:bg-slate-900/40 dark:text-emerald-200">
                      <p>已复制开场白。现在回到原岗位页发送给 HR，发送后回这里标记已投递。</p>
                      {sourceUrl && (
                        <a
                          href={sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 inline-flex items-center gap-1 font-semibold text-emerald-800 underline-offset-4 hover:underline dark:text-emerald-100"
                        >
                          打开原始岗位页
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  )}
                  <div className="mt-4 grid gap-3">
                    {sourceUrl && (
                      <a
                        href={sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                      >
                        <ExternalLink className="h-4 w-4" />
                        打开原岗位发送
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={onMarkApplied}
                      disabled={alreadyApplied}
                      className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {alreadyApplied ? '已进入投递流程' : '已发送，标记已投递'}
                    </button>
                    <button
                      type="button"
                      onClick={onMatch}
                      className="rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-600"
                    >
                      先做简历匹配
                    </button>
                    <button
                      type="button"
                      onClick={onOpenExperiences}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      维护我的经历
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 p-5 dark:border-slate-700">
                  <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">最近投递记录</h3>
                  {loadingFollowUps && (
                    <p className="mt-3 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      正在读取跟进记录...
                    </p>
                  )}
                  {!loadingFollowUps && followUpError && (
                    <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-200">
                      {followUpError}
                    </p>
                  )}
                  {!loadingFollowUps && !followUpError && latestFollowUp && (
                    <div className="mt-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-600 dark:bg-primary-900/30 dark:text-primary-200">
                          {jobFollowUpTypeLabelMap[latestFollowUp.type]}
                        </span>
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          {formatDateTime(latestFollowUp.createdAt)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-100">
                        {latestFollowUp.title}
                      </p>
                      {latestFollowUp.content && (
                        <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-slate-500 dark:text-slate-300">
                          {latestFollowUp.content}
                        </p>
                      )}
                    </div>
                  )}
                  {!loadingFollowUps && !followUpError && !latestFollowUp && (
                    <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                      还没有投递记录。复制开场白、标记已投递或添加跟进后会显示在这里。
                    </p>
                  )}
                </div>
              </aside>
            </div>
          </div>
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
  active?: boolean;
  onClick?: () => void;
}

function SummaryCard({ icon: Icon, label, value, hint, colorClass, active = false, onClick }: SummaryCardProps) {
  const content = (
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
  );

  if (onClick) {
    return (
      <motion.button
        type="button"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={onClick}
        className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-800 ${
          active
            ? 'border-primary-300 ring-2 ring-primary-100 dark:border-primary-500 dark:ring-primary-900/40'
            : 'border-slate-100 dark:border-slate-700'
        }`}
      >
        {content}
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800"
    >
      {content}
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
  const [expanded, setExpanded] = useState(false);
  const latestFollowUp = followUps[0] ?? null;

  useEffect(() => {
    setExpanded(false);
  }, [job.id]);

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="w-full rounded-2xl border border-primary-100 bg-primary-50/70 p-4 text-left shadow-sm transition-colors hover:border-primary-200 hover:bg-primary-100/70 dark:border-primary-800/60 dark:bg-primary-900/10 dark:hover:bg-primary-900/20"
        aria-expanded={expanded}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                投递跟进时间线
              </span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(job.applicationStatus)}`}>
                {jobStatusLabelMap[job.applicationStatus]}
              </span>
            </div>
            <p className="mt-2 truncate text-sm font-medium text-slate-700 dark:text-slate-200">
              {loadingFollowUps
                ? '正在加载当前进度...'
                : followUpError
                  ? '跟进记录加载失败，点击展开后可重试'
                  : latestFollowUp
                    ? latestFollowUp.title
                    : '暂无跟进记录'}
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {latestFollowUp
                ? `最近更新：${formatDateTime(latestFollowUp.createdAt)}`
                : job.appliedAt
                  ? `投递于：${formatDateTime(job.appliedAt)}`
                  : '点击后查看全部跟进进度'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-xs font-medium text-primary-600 dark:text-primary-300">
            {loadingFollowUps && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{expanded ? '收起' : '展开'}</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </div>
        </div>
      </button>

      {expanded && (
        <div className="mt-3 rounded-2xl border border-primary-100 bg-primary-50/40 p-4 dark:border-primary-800/60 dark:bg-primary-900/10">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              状态变化会自动记录，也可以手动添加沟通、面试和备注。
            </p>
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
      )}
    </div>
  );
}
