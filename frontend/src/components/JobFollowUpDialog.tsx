import { useEffect, useState } from 'react';
import ConfirmDialog from './ConfirmDialog';
import type { CreateJobFollowUpForm, JobFollowUpType } from '../types/job-follow-up';

interface JobFollowUpDialogProps {
  open: boolean;
  loading?: boolean;
  onCancel: () => void;
  onSubmit: (data: CreateJobFollowUpForm) => void;
}

const typeOptions: Array<{ value: JobFollowUpType; label: string }> = [
  { value: 'MANUAL_NOTE', label: '备注' },
  { value: 'CONTACT', label: '沟通' },
  { value: 'INTERVIEW', label: '面试' },
  { value: 'OFFER', label: 'Offer' },
  { value: 'REJECTION', label: '拒绝' },
];

const fieldClassName =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors ' +
  'placeholder:text-slate-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 ' +
  'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500';

export default function JobFollowUpDialog({
  open,
  loading = false,
  onCancel,
  onSubmit,
}: JobFollowUpDialogProps) {
  const [type, setType] = useState<JobFollowUpType>('CONTACT');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [contactMethod, setContactMethod] = useState('BOSS');
  const [nextFollowUpAt, setNextFollowUpAt] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }

    setType('CONTACT');
    setTitle('');
    setContent('');
    setContactMethod('BOSS');
    setNextFollowUpAt('');
    setError('');
  }, [open]);

  const handleConfirm = () => {
    if (!content.trim()) {
      setError('请输入跟进内容');
      return;
    }

    onSubmit({
      type,
      title: title.trim() || undefined,
      content: content.trim(),
      contactMethod: contactMethod.trim() || undefined,
      nextFollowUpAt: nextFollowUpAt || undefined,
    });
  };

  return (
    <ConfirmDialog
      open={open}
      title="添加投递跟进"
      message=""
      confirmText="保存跟进"
      cancelText="取消"
      loading={loading}
      onConfirm={handleConfirm}
      onCancel={onCancel}
      customContent={
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              跟进类型
            </label>
            <select
              value={type}
              onChange={(event) => setType(event.target.value as JobFollowUpType)}
              className={fieldClassName}
            >
              {typeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              标题
            </label>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className={fieldClassName}
              placeholder="可不填，系统会按类型生成默认标题"
              maxLength={200}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              沟通方式
            </label>
            <input
              value={contactMethod}
              onChange={(event) => setContactMethod(event.target.value)}
              className={fieldClassName}
              placeholder="例如 BOSS / 微信 / 电话 / 邮件"
              maxLength={80}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              跟进内容 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={content}
              onChange={(event) => {
                setContent(event.target.value);
                setError('');
              }}
              className={`${fieldClassName} min-h-32 resize-y`}
              placeholder="记录沟通内容、反馈或下一步计划"
              maxLength={12000}
            />
            {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              下一步跟进时间
            </label>
            <input
              type="datetime-local"
              value={nextFollowUpAt}
              onChange={(event) => setNextFollowUpAt(event.target.value)}
              className={fieldClassName}
            />
          </div>
        </div>
      }
    />
  );
}
