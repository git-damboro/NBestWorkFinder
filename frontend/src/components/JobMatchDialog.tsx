import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { historyApi, type ResumeListItem } from '../api/history';
import { jobApi } from '../api/jobs';
import { getErrorMessage } from '../api/request';
import type { JobMatchResult } from '../types/job';
import ConfirmDialog from './ConfirmDialog';

interface MatchTargetJob {
  id: number;
  title?: string;
  company?: string;
}

interface JobMatchDialogProps {
  open: boolean;
  job: MatchTargetJob | null;
  onClose: () => void;
}

export default function JobMatchDialog({ open, job, onClose }: JobMatchDialogProps) {
  const [resumes, setResumes] = useState<ResumeListItem[]>([]);
  const [loadingResumes, setLoadingResumes] = useState(false);
  const [selectedResumeId, setSelectedResumeId] = useState<number | null>(null);
  const [matching, setMatching] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [matchResult, setMatchResult] = useState<JobMatchResult | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    // 弹窗打开时拉取简历列表，保证用户能立刻开始匹配。
    const fetchResumes = async () => {
      setLoadingResumes(true);
      setMatchError(null);
      setMatchResult(null);

      try {
        const data = await historyApi.getResumes();
        if (cancelled) {
          return;
        }
        setResumes(data);
        setSelectedResumeId(data[0]?.id ?? null);
      } catch (error) {
        if (cancelled) {
          return;
        }
        setResumes([]);
        setSelectedResumeId(null);
        setMatchError(getErrorMessage(error));
      } finally {
        if (!cancelled) {
          setLoadingResumes(false);
        }
      }
    };

    void fetchResumes();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const canMatch = useMemo(
    () => !!open && !!job && !loadingResumes && !matching && selectedResumeId !== null,
    [open, job, loadingResumes, matching, selectedResumeId],
  );

  const handleMatch = async () => {
    if (!job) {
      return;
    }

    if (selectedResumeId === null) {
      setMatchError('请先选择一份简历');
      return;
    }

    setMatching(true);
    setMatchError(null);
    setMatchResult(null);

    try {
      const result = await jobApi.matchJob(job.id, { resumeId: selectedResumeId });
      setMatchResult(result);
    } catch (error) {
      setMatchError(getErrorMessage(error));
    } finally {
      setMatching(false);
    }
  };

  return (
    <ConfirmDialog
      open={open}
      title={job?.title ? `简历匹配：${job.title}` : '简历匹配'}
      message={job?.company ? `公司：${job.company}` : '选择简历后开始匹配'}
      confirmText={matching ? '匹配中...' : matchResult ? '重新匹配' : '开始匹配'}
      cancelText="关闭"
      loading={matching}
      onConfirm={handleMatch}
      onCancel={onClose}
      customContent={
        <div className="space-y-4">
          {loadingResumes && (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-700/40 dark:text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在加载简历列表...
            </div>
          )}

          {!loadingResumes && resumes.length === 0 && (
            <div className="rounded-xl border border-amber-300/70 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-600/70 dark:bg-amber-900/20 dark:text-amber-200">
              暂无可匹配简历，请先上传简历后再试。
            </div>
          )}

          {!loadingResumes && resumes.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">选择简历</p>
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  共 {resumes.length} 份
                </span>
              </div>
              <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                {resumes.map((resume) => {
                  const selected = selectedResumeId === resume.id;

                  return (
                    <button
                      key={resume.id}
                      type="button"
                      onClick={() => {
                        setSelectedResumeId(resume.id);
                        setMatchError(null);
                      }}
                      className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${
                        selected
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60'
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

          {!loadingResumes && !canMatch && resumes.length > 0 && !matchError && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              当前状态暂不可匹配，请稍后重试。
            </p>
          )}

          {matchError && (
            <div className="flex gap-2 rounded-xl border border-red-300/70 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/70 dark:bg-red-900/30 dark:text-red-200">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{matchError}</span>
            </div>
          )}

          {matchResult && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3 rounded-2xl border border-emerald-200/70 bg-emerald-50/70 p-4 dark:border-emerald-700/70 dark:bg-emerald-900/20"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  匹配结果
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-sm font-semibold text-emerald-700 dark:bg-emerald-800/60 dark:text-emerald-200">
                  <CheckCircle2 className="h-4 w-4" />
                  {matchResult.overallScore} 分
                </span>
              </div>

              <ResultSection
                title="已匹配技能"
                value={matchResult.matchedSkills}
                emptyText="暂无明显匹配项"
              />
              <ResultSection
                title="待补充技能"
                value={matchResult.missingSkills}
                emptyText="暂无明显缺口"
              />
              <ResultSection
                title="优化建议"
                value={matchResult.suggestions}
                emptyText="暂无建议"
                separator="；"
              />

              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  总结
                </p>
                <p className="text-sm leading-6 text-slate-700 dark:text-slate-200">
                  {matchResult.summary || '暂无总结'}
                </p>
              </div>
            </motion.div>
          )}
        </div>
      }
    />
  );
}

interface ResultSectionProps {
  title: string;
  value: string[];
  emptyText: string;
  separator?: string;
}

function ResultSection({
  title,
  value,
  emptyText,
  separator = '、',
}: ResultSectionProps) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </p>
      <p className="text-sm text-slate-700 dark:text-slate-200">
        {value.length > 0 ? value.join(separator) : emptyText}
      </p>
    </div>
  );
}
