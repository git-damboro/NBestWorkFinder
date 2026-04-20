import {useCallback, useEffect, useState} from 'react';
import {useLocation, useNavigate} from 'react-router-dom';
import {AnimatePresence, motion} from 'framer-motion';
import {historyApi, InterviewDetail, ResumeDetail} from '../api/history';
import {aiGenerationTaskApi, jobApi} from '../api';
import {getErrorMessage} from '../api/request';
import AnalysisPanel from '../components/AnalysisPanel';
import InterviewPanel from '../components/InterviewPanel';
import InterviewDetailPanel from '../components/InterviewDetailPanel';
import ResumeJobDraftDialog from '../components/ResumeJobDraftDialog';
import type {AiGenerationTask} from '../types/ai-generation-task';
import type {ResumeJobDraft} from '../types/job';
import {formatDateOnly} from '../utils/date';
import {BriefcaseBusiness, CheckSquare, ChevronLeft, Clock, Download, MessageSquare, Mic} from 'lucide-react';

interface ResumeDetailPageProps {
  resumeId: number;
  onBack: () => void;
  onStartInterview: (resumeText: string, resumeId: number) => void;
}

type TabType = 'analysis' | 'interview';
type DetailViewType = 'list' | 'interviewDetail';
const JOB_DRAFT_POLL_INTERVAL_MS = 3000;

export default function ResumeDetailPage({ resumeId, onBack, onStartInterview }: ResumeDetailPageProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [resume, setResume] = useState<ResumeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('analysis');
  const [exporting, setExporting] = useState<string | null>(null);
  const [[page, direction], setPage] = useState([0, 0]);
  const [detailView, setDetailView] = useState<DetailViewType>('list');
  const [selectedInterview, setSelectedInterview] = useState<InterviewDetail | null>(null);
  const [loadingInterview, setLoadingInterview] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [jobDraftDialogOpen, setJobDraftDialogOpen] = useState(false);
  const [jobDrafts, setJobDrafts] = useState<ResumeJobDraft[]>([]);
  const [generatingJobDrafts, setGeneratingJobDrafts] = useState(false);
  const [savingJobDraft, setSavingJobDraft] = useState(false);
  const [jobDraftError, setJobDraftError] = useState<string | null>(null);
  const [jobDraftTaskId, setJobDraftTaskId] = useState<string | null>(null);

  // 静默加载数据（用于轮询）
  const loadResumeDetailSilent = useCallback(async () => {
    try {
      const data = await historyApi.getResumeDetail(resumeId);
      setResume(data);
    } catch (err) {
      console.error('加载简历详情失败', err);
    }
  }, [resumeId]);

  const loadResumeDetail = useCallback(async () => {
    setLoading(true);
    try {
      const data = await historyApi.getResumeDetail(resumeId);
      setResume(data);
    } catch (err) {
      console.error('加载简历详情失败', err);
    } finally {
      setLoading(false);
    }
  }, [resumeId]);

  useEffect(() => {
    loadResumeDetail();
  }, [loadResumeDetail]);

  // 轮询：当分析状态为待处理时，每5秒刷新一次
  // 待处理判断：显式的 PENDING/PROCESSING 状态，或状态未定义且无分析结果
  useEffect(() => {
    const isProcessing = resume && (
      resume.analyzeStatus === 'PENDING' ||
      resume.analyzeStatus === 'PROCESSING' ||
      (resume.analyzeStatus === undefined && (!resume.analyses || resume.analyses.length === 0))
    );

    if (isProcessing && !loading) {
      const timer = setInterval(() => {
        loadResumeDetailSilent();
      }, 5000);

      return () => clearInterval(timer);
    }
  }, [resume, loading, loadResumeDetailSilent]);

  // 重新分析
  const handleReanalyze = async () => {
    try {
      setReanalyzing(true);
      await historyApi.reanalyze(resumeId);
      await loadResumeDetailSilent();
    } catch (err) {
      console.error('重新分析失败', err);
    } finally {
      setReanalyzing(false);
    }
  };

  // 检查是否需要自动打开面试详情
  useEffect(() => {
    const viewInterview = (location.state as { viewInterview?: string })?.viewInterview;
    if (viewInterview && resume) {
      // 切换到面试标签页
      setActiveTab('interview');
      // 加载并显示面试详情
      const loadAndViewInterview = async () => {
        setLoadingInterview(true);
        try {
          const detail = await historyApi.getInterviewDetail(viewInterview);
          setSelectedInterview(detail);
          setDetailView('interviewDetail');
        } catch (err) {
          console.error('加载面试详情失败', err);
        } finally {
          setLoadingInterview(false);
        }
      };
      loadAndViewInterview();
    }
  }, [location.state, resume]);

  const handleExportAnalysisPdf = async () => {
    setExporting('analysis');
    try {
      const blob = await historyApi.exportAnalysisPdf(resumeId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `简历分析报告_${resume?.filename || resumeId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('导出失败，请重试');
    } finally {
      setExporting(null);
    }
  };

  const handleExportInterviewPdf = async (sessionId: string) => {
    setExporting(sessionId);
    try {
      const blob = await historyApi.exportInterviewPdf(sessionId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `面试报告_${sessionId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('导出失败，请重试');
    } finally {
      setExporting(null);
    }
  };

  const handleViewInterview = async (sessionId: string) => {
    setLoadingInterview(true);
    try {
      const detail = await historyApi.getInterviewDetail(sessionId);
      setSelectedInterview(detail);
      setDetailView('interviewDetail');
    } catch (err) {
      alert('加载面试详情失败');
    } finally {
      setLoadingInterview(false);
    }
  };

  const handleBackToInterviewList = () => {
    setDetailView('list');
    setSelectedInterview(null);
  };

  const getDismissedJobDraftTaskKey = (taskId: string) => `resume-job-draft-task-dismissed:${taskId}`;

  const isDismissedJobDraftTask = (taskId: string) => {
    try {
      return window.sessionStorage.getItem(getDismissedJobDraftTaskKey(taskId)) === '1';
    } catch {
      return false;
    }
  };

  const dismissJobDraftTask = (taskId: string) => {
    try {
      window.sessionStorage.setItem(getDismissedJobDraftTaskKey(taskId), '1');
    } catch {
      // sessionStorage 不可用时忽略，只影响是否重复自动弹出结果。
    }
  };

  const parseJobDraftTaskResult = (task: AiGenerationTask): ResumeJobDraft[] => {
    if (!task.resultJson) {
      return [];
    }
    const parsed = JSON.parse(task.resultJson) as { drafts?: ResumeJobDraft[] };
    return Array.isArray(parsed.drafts) ? parsed.drafts : [];
  };

  const applyJobDraftTask = useCallback((task: AiGenerationTask) => {
    setJobDraftTaskId(task.taskId);
    setJobDraftDialogOpen(true);

    if (task.status === 'PENDING' || task.status === 'PROCESSING') {
      setGeneratingJobDrafts(true);
      setJobDraftError(null);
      return;
    }

    setGeneratingJobDrafts(false);

    if (task.status === 'FAILED') {
      setJobDrafts([]);
      setJobDraftError(task.errorMessage || '职位草稿生成失败，请重试。');
      setJobDraftTaskId(null);
      return;
    }

    try {
      const drafts = parseJobDraftTaskResult(task);
      setJobDrafts(drafts);
      if (drafts.length === 0) {
        setJobDraftError('当前简历暂未生成可用的职位草稿，请补充更完整的简历内容后重试。');
      } else {
        setJobDraftError(null);
      }
      setJobDraftTaskId(null);
    } catch (error) {
      setJobDrafts([]);
      setJobDraftError(getErrorMessage(error));
      setJobDraftTaskId(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const recoverLatestDraftTask = async () => {
      try {
        const task = await aiGenerationTaskApi.getLatestTask('RESUME_JOB_DRAFT', resumeId);
        if (!task || cancelled || isDismissedJobDraftTask(task.taskId)) {
          return;
        }
        applyJobDraftTask(task);
      } catch (error) {
        console.error('恢复最近职位草稿任务失败', error);
      }
    };

    recoverLatestDraftTask();

    return () => {
      cancelled = true;
    };
  }, [resumeId, applyJobDraftTask]);

  useEffect(() => {
    if (!jobDraftTaskId) {
      return;
    }

    let cancelled = false;
    const pollTask = async () => {
      try {
        const task = await aiGenerationTaskApi.getTask(jobDraftTaskId);
        if (!cancelled) {
          applyJobDraftTask(task);
        }
      } catch (error) {
        if (!cancelled) {
          setGeneratingJobDrafts(false);
          setJobDraftError(getErrorMessage(error));
          setJobDraftTaskId(null);
        }
      }
    };

    const timer = window.setInterval(pollTask, JOB_DRAFT_POLL_INTERVAL_MS);
    pollTask();

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [jobDraftTaskId, applyJobDraftTask]);

  const handleGenerateJobDrafts = async () => {
    setGeneratingJobDrafts(true);
    setJobDraftError(null);
    setJobDrafts([]);

    try {
      const batch = await jobApi.createDraftBatchFromResume(resumeId);
      navigate(`/jobs/drafts?batchId=${encodeURIComponent(batch.batchId)}`);
    } catch (error) {
      setJobDrafts([]);
      setJobDraftError(getErrorMessage(error));
      setJobDraftTaskId(null);
    } finally {
      setGeneratingJobDrafts(false);
    }
  };

  const handleCloseJobDraftDialog = () => {
    if (jobDraftTaskId && !generatingJobDrafts) {
      dismissJobDraftTask(jobDraftTaskId);
    }
    setJobDraftDialogOpen(false);
    setJobDraftTaskId(null);
    setGeneratingJobDrafts(false);
  };

  const markCurrentDraftTaskDismissed = () => {
    if (jobDraftTaskId) {
      dismissJobDraftTask(jobDraftTaskId);
    }
  };

  const handleSaveJobDraft = async (draft: ResumeJobDraft) => {
    setSavingJobDraft(true);
    setJobDraftError(null);

    try {
      const createdJob = await jobApi.createJob({
        title: draft.title,
        company: '待补充',
        description: draft.defaultDescription,
        notes: draft.defaultNotes,
      });

      markCurrentDraftTaskDismissed();
      setJobDraftDialogOpen(false);
      setJobDraftTaskId(null);
      navigate('/jobs', {
        state: {
          selectedJobId: createdJob.id,
        },
      });
    } catch (error) {
      setJobDraftError(getErrorMessage(error));
    } finally {
      setSavingJobDraft(false);
    }
  };

  const handleDeleteInterview = async (sessionId: string) => {
    // 删除后重新加载简历详情
    await loadResumeDetail();
    // 如果删除的是当前查看的面试，返回列表
    if (selectedInterview?.sessionId === sessionId) {
      setDetailView('list');
      setSelectedInterview(null);
    }
  };

  const handleTabChange = (tab: TabType) => {
    const newPage = tab === 'analysis' ? 0 : 1;
    setPage([newPage, newPage > page ? 1 : -1]);
    setActiveTab(tab);
    setDetailView('list');
    setSelectedInterview(null);
  };

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 300 : -300,
      opacity: 0,
    }),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
          <motion.div
              className="w-12 h-12 border-4 border-slate-200 dark:border-slate-600 border-t-primary-500 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      </div>
    );
  }

  if (!resume) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500 mb-4">加载失败，请返回重试</p>
        <button onClick={onBack} className="px-6 py-2 bg-primary-500 text-white rounded-lg">返回列表</button>
      </div>
    );
  }

  const latestAnalysis = resume.analyses?.[0];
  const tabs = [
    { id: 'analysis' as const, label: '简历分析', icon: CheckSquare },
    { id: 'interview' as const, label: '面试记录', icon: MessageSquare, count: resume.interviews?.length || 0 },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full"
    >
      {/* 顶部导航栏 */}
      <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
        <div className="flex items-center gap-4">
            <motion.button
            onClick={detailView === 'interviewDetail' ? handleBackToInterviewList : onBack}
            className="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-300 transition-all shadow-sm"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <ChevronLeft className="w-5 h-5" />
          </motion.button>
          <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {detailView === 'interviewDetail' ? `面试详情 #${selectedInterview?.sessionId?.slice(-6) || ''}` : resume.filename}
            </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
                  {detailView === 'interviewDetail'
                ? `完成于 ${formatDateOnly(selectedInterview?.completedAt || selectedInterview?.createdAt || '')}`
                : `上传于 ${formatDateOnly(resume.uploadedAt)}`
              }
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          {detailView === 'interviewDetail' && selectedInterview && (
            <motion.button
              onClick={() => handleExportInterviewPdf(selectedInterview.sessionId)}
              disabled={exporting === selectedInterview.sessionId}
              className="px-5 py-2.5 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-50 transition-all disabled:opacity-50 flex items-center gap-2"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Download className="w-4 h-4" />
              {exporting === selectedInterview.sessionId ? '导出中...' : '导出 PDF'}
            </motion.button>
          )}
          {detailView !== 'interviewDetail' && (
            <>
              <motion.button
                onClick={handleGenerateJobDrafts}
                disabled={generatingJobDrafts || !resume.resumeText?.trim()}
                className="px-5 py-2.5 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-50 transition-all disabled:opacity-50 flex items-center gap-2"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <BriefcaseBusiness className="w-4 h-4" />
                {generatingJobDrafts ? '生成中...' : '生成职位草稿'}
              </motion.button>
              <motion.button
                onClick={() => onStartInterview(resume.resumeText, resumeId)}
                className="px-5 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-medium shadow-lg shadow-primary-500/30 hover:shadow-xl transition-all flex items-center gap-2"
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
              >
                <Mic className="w-4 h-4" />
                开始模拟面试
              </motion.button>
            </>
          )}
        </div>
      </div>

      {/* 标签页切换 - 仅在非面试详情时显示 */}
      {detailView !== 'interviewDetail' && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-2 mb-6 inline-flex gap-1">
          {tabs.map((tab) => (
            <motion.button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`relative px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-colors
                ${activeTab === tab.id ? 'text-primary-600 dark:text-primary-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-primary-50 dark:bg-primary-900 rounded-xl"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                <tab.icon className="w-5 h-5" />
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                    <span
                        className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400 text-xs rounded-full">{tab.count}</span>
                )}
              </span>
            </motion.button>
          ))}
        </div>
      )}

      {/* 内容区域 */}
      <div className="relative overflow-hidden">
        {detailView === 'interviewDetail' && selectedInterview ? (
          <InterviewDetailPanel interview={selectedInterview} />
        ) : (
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={activeTab}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              {activeTab === 'analysis' ? (
                <AnalysisPanel
                  analysis={latestAnalysis}
                  analyzeStatus={resume.analyzeStatus}
                  analyzeError={resume.analyzeError}
                  onExport={handleExportAnalysisPdf}
                  exporting={exporting === 'analysis'}
                  onReanalyze={handleReanalyze}
                  reanalyzing={reanalyzing}
                />
              ) : (
                  <InterviewPanel
                      interviews={resume.interviews || []}
                  onStartInterview={() => onStartInterview(resume.resumeText, resumeId)}
                  onViewInterview={handleViewInterview}
                  onExportInterview={handleExportInterviewPdf}
                  onDeleteInterview={handleDeleteInterview}
                  exporting={exporting}
                  loadingInterview={loadingInterview}
                />
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      <ResumeJobDraftDialog
        open={jobDraftDialogOpen}
        drafts={jobDrafts}
        loading={generatingJobDrafts}
        saving={savingJobDraft}
        error={jobDraftError}
        onClose={handleCloseJobDraftDialog}
        onRetry={() => void handleGenerateJobDrafts()}
        onSelect={(draft) => void handleSaveJobDraft(draft)}
      />
    </motion.div>
  );
}
