import { motion } from 'framer-motion';
import { AlertCircle, BriefcaseBusiness, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import type { ResumeJobDraft } from '../types/job';
import ConfirmDialog from './ConfirmDialog';

interface ResumeJobDraftDialogProps {
  open: boolean;
  drafts: ResumeJobDraft[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onRetry: () => void;
  onSelect: (draft: ResumeJobDraft) => void;
}

export default function ResumeJobDraftDialog({
  open,
  drafts,
  loading,
  saving,
  error,
  onClose,
  onRetry,
  onSelect,
}: ResumeJobDraftDialogProps) {
  const showEmptyState = !loading && !error && drafts.length === 0;

  return (
    <ConfirmDialog
      open={open}
      title="根据简历生成职位草稿"
      message="以下职位方向来自当前简历内容分析，选择 1 个即可保存到职位工作台。"
      confirmText="关闭"
      cancelText="关闭"
      onConfirm={onClose}
      onCancel={onClose}
      hideButtons
      customContent={
        <div className="space-y-4">
          {loading && (
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-700/40 dark:text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在生成职位草稿，请稍候...
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/70 dark:bg-red-900/30 dark:text-red-200">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
              <button
                type="button"
                onClick={onRetry}
                disabled={loading || saving}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50 dark:bg-slate-800 dark:text-red-300 dark:hover:bg-slate-700"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                重新生成
              </button>
            </div>
          )}

          {showEmptyState && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center dark:border-slate-700 dark:bg-slate-900/40">
              <BriefcaseBusiness className="mx-auto mb-3 h-8 w-8 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">暂未生成职位草稿</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                可以重试一次，或先补充更完整的简历内容。
              </p>
            </div>
          )}

          {!loading && !error && drafts.length > 0 && (
            <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
              {drafts.map((draft, index) => (
                <motion.button
                  key={`${draft.title}-${index}`}
                  type="button"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  onClick={() => onSelect(draft)}
                  disabled={saving}
                  className="w-full rounded-2xl border border-slate-200 p-4 text-left transition-all hover:border-primary-400 hover:bg-primary-50/60 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:hover:border-primary-500 dark:hover:bg-primary-900/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                        {draft.title}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {draft.summary || '暂无概述'}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      选中保存
                    </span>
                  </div>

                  <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-600 dark:bg-slate-800/80 dark:text-slate-300">
                    <span className="font-medium text-slate-700 dark:text-slate-200">推荐原因：</span>
                    {draft.reason || '暂无补充说明'}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {draft.techTags.length > 0 ? (
                      draft.techTags.map((tag) => (
                        <span
                          key={`${draft.title}-${tag}`}
                          className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-600 dark:bg-primary-900/30 dark:text-primary-300"
                        >
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 dark:text-slate-500">暂无技术标签</span>
                    )}
                  </div>
                </motion.button>
              ))}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              {saving ? '保存中...' : '关闭'}
            </button>
          </div>
        </div>
      }
    />
  );
}
