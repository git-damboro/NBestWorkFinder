import { AnimatePresence, motion } from 'framer-motion';
import type { InterviewJobTarget, InterviewSession } from '../types/interview';

interface InterviewConfigPanelProps {
  questionCount: number;
  onQuestionCountChange: (count: number) => void;
  onStart: () => void;
  isCreating: boolean;
  checkingUnfinished: boolean;
  unfinishedSession: InterviewSession | null;
  onContinueUnfinished: () => void;
  onStartNew: () => void;
  resumeText: string;
  jobTarget?: InterviewJobTarget | null;
  onBack: () => void;
  error?: string;
  interviewTaskId?: string | null;
}

export default function InterviewConfigPanel({
  questionCount,
  onQuestionCountChange,
  onStart,
  isCreating,
  checkingUnfinished,
  unfinishedSession,
  onContinueUnfinished,
  onStartNew,
  resumeText,
  jobTarget,
  onBack,
  error,
  interviewTaskId,
}: InterviewConfigPanelProps) {
  const questionCounts = [6, 8, 10, 12, 15];
  const previewText =
    resumeText.substring(0, 500) + (resumeText.length > 500 ? '...' : '');

  return (
    <motion.div
      className="mx-auto max-w-2xl"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="rounded-2xl border border-slate-100 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:shadow-slate-900/50">
        <h2 className="mb-6 flex items-center gap-3 text-2xl font-bold text-slate-900 dark:text-white">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 dark:bg-primary-900/50">
            <svg className="h-5 w-5 text-primary-600 dark:text-primary-400" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="2" />
              <circle cx="12" cy="12" r="2" fill="currentColor" />
            </svg>
          </div>
          面试配置
        </h2>

        <AnimatePresence>
          {checkingUnfinished && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-center text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
            >
              <div className="flex items-center justify-center gap-2">
                <motion.div
                  className="h-4 w-4 rounded-full border-2 border-blue-500 border-t-transparent"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
                正在检查是否有未完成的面试...
              </div>
            </motion.div>
          )}

          {unfinishedSession && !checkingUnfinished && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 rounded-xl border-2 border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-5 dark:border-amber-800 dark:from-amber-900/30 dark:to-orange-900/30"
            >
              <div className="mb-4 flex items-start gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/50">
                  <svg className="h-5 w-5 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 2L2 7L12 12L22 7L12 2Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M2 17L12 22L22 17"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M2 12L12 17L22 12"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="mb-1 font-semibold text-amber-900 dark:text-amber-300">
                    检测到未完成的模拟面试
                  </h3>
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    已完成 {unfinishedSession.currentQuestionIndex} / {unfinishedSession.totalQuestions} 题
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <motion.button
                  onClick={onContinueUnfinished}
                  className="flex-1 rounded-lg bg-amber-500 px-4 py-2.5 font-medium text-white transition-colors hover:bg-amber-600"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  继续完成
                </motion.button>
                <motion.button
                  onClick={onStartNew}
                  className="flex-1 rounded-lg border border-amber-300 bg-white px-4 py-2.5 font-medium text-amber-700 transition-colors hover:bg-amber-50 dark:border-amber-700 dark:bg-slate-700 dark:text-amber-400 dark:hover:bg-amber-900/30"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  开始新的
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-6">
          {jobTarget && (
            <div className="rounded-xl border border-primary-200 bg-primary-50/70 p-4 dark:border-primary-800 dark:bg-primary-900/20">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary-700 dark:text-primary-300">
                <span>本次为定向模拟面试</span>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-200">
                目标职位：{jobTarget.title} · {jobTarget.company}
              </p>
              <p className="mt-2 text-xs leading-6 text-slate-500 dark:text-slate-400">
                题目会优先围绕该职位 JD、技术标签和简历交集生成。
              </p>
              {jobTarget.techTags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {jobTarget.techTags.map(tag => (
                    <span
                      key={`${jobTarget.jobId}-${tag}`}
                      className="rounded-full bg-white px-2.5 py-1 text-xs text-primary-600 dark:bg-slate-800 dark:text-primary-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="mb-3 block text-sm font-semibold text-slate-700 dark:text-slate-300">
              题目数量
            </label>
            <div className="grid grid-cols-5 gap-3">
              {questionCounts.map(count => (
                <motion.button
                  key={count}
                  onClick={() => onQuestionCountChange(count)}
                  className={`rounded-xl px-4 py-3 font-medium transition-all ${
                    questionCount === count
                      ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {count}
                </motion.button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-3 block text-sm font-semibold text-slate-600 dark:text-slate-400">
              简历预览（前 500 字）
            </label>
            <textarea
              value={previewText}
              readOnly
              className="h-32 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400"
            />
          </div>

          <div className="rounded-xl border border-dashed border-primary-200 bg-primary-50/40 p-4 text-sm text-slate-600 dark:border-primary-800 dark:bg-primary-900/10 dark:text-slate-300">
            <p>题目分布：项目经验 + Java + MySQL + Redis + Spring 综合考察。</p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {isCreating || interviewTaskId
                ? '后台正在生成题目，切换到别的页面也会继续，回来后会自动恢复。'
                : '点击开始后会先创建后台任务，题目生成期间可以自由切换页面。'}
            </p>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex justify-center gap-4">
            <motion.button
              onClick={onBack}
              className="rounded-xl border border-slate-200 px-6 py-3 font-medium text-slate-600 transition-all hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              返回
            </motion.button>
            <motion.button
              onClick={onStart}
              disabled={isCreating}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 px-8 py-3 font-semibold text-white shadow-lg shadow-primary-500/30 transition-all disabled:cursor-not-allowed disabled:opacity-60"
              whileHover={{ scale: isCreating ? 1 : 1.02, y: isCreating ? 0 : -1 }}
              whileTap={{ scale: isCreating ? 1 : 0.98 }}
            >
              {isCreating ? (
                <>
                  <motion.span
                    className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  />
                  后台生成中...
                </>
              ) : (
                <>开始面试</>
              )}
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
