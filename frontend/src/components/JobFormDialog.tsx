import { useEffect, useMemo, useState } from 'react';
import type { JobApplicationStatus } from '../types/job';
import { jobStatusOptions } from '../types/job';
import ConfirmDialog from './ConfirmDialog';

export type JobFormMode = 'create' | 'edit';

export interface JobFormData {
  title: string;
  company: string;
  description: string;
  location: string;
  salaryMin?: number;
  salaryMax?: number;
  applicationStatus: JobApplicationStatus;
  notes: string;
}

export interface JobFormDialogProps {
  open: boolean;
  mode: JobFormMode;
  initialJob?: Partial<JobFormData> | null;
  loading?: boolean;
  onCancel: () => void;
  onSubmit: (data: JobFormData) => void;
}

interface JobFormState {
  title: string;
  company: string;
  description: string;
  location: string;
  salaryMin: string;
  salaryMax: string;
  applicationStatus: JobApplicationStatus;
  notes: string;
}

interface FormErrors {
  title?: string;
  company?: string;
  description?: string;
  applicationStatus?: string;
  salaryMin?: string;
  salaryMax?: string;
}

const EMPTY_FORM: JobFormState = {
  title: '',
  company: '',
  description: '',
  location: '',
  salaryMin: '',
  salaryMax: '',
  applicationStatus: 'SAVED',
  notes: '',
};

function toStringValue(value?: string | number | null) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
}

function buildInitialForm(initialJob?: Partial<JobFormData> | null): JobFormState {
  if (!initialJob) {
    return EMPTY_FORM;
  }

  return {
    title: initialJob.title ?? '',
    company: initialJob.company ?? '',
    description: initialJob.description ?? '',
    location: initialJob.location ?? '',
    salaryMin: toStringValue(initialJob.salaryMin),
    salaryMax: toStringValue(initialJob.salaryMax),
    applicationStatus: initialJob.applicationStatus ?? 'SAVED',
    notes: initialJob.notes ?? '',
  };
}

export default function JobFormDialog({
  open,
  mode,
  initialJob,
  loading = false,
  onCancel,
  onSubmit,
}: JobFormDialogProps) {
  const [form, setForm] = useState<JobFormState>(() => buildInitialForm(initialJob));
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (!open) {
      return;
    }

    setForm(buildInitialForm(initialJob));
    setErrors({});
  }, [open, mode, initialJob]);

  const dialogTitle = mode === 'create' ? '新增职位' : '编辑职位';
  const confirmText = mode === 'create' ? '创建' : '保存';

  const fieldClassName = useMemo(
    () =>
      'w-full rounded-xl border px-3 py-2.5 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 ' +
      'placeholder:text-slate-400 dark:placeholder:text-slate-500 border-slate-200 dark:border-slate-600 ' +
      'focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-colors',
    [],
  );

  const errorClassName = 'mt-1 text-xs text-red-500 dark:text-red-400';

  const updateField = (field: keyof JobFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validateForm = () => {
    const nextErrors: FormErrors = {};
    const minRaw = form.salaryMin.trim();
    const maxRaw = form.salaryMax.trim();
    const min = minRaw ? Number(minRaw) : undefined;
    const max = maxRaw ? Number(maxRaw) : undefined;

    if (!form.title.trim()) {
      nextErrors.title = '请输入职位名称';
    }
    if (!form.company.trim()) {
      nextErrors.company = '请输入公司名称';
    }
    if (!form.description.trim()) {
      nextErrors.description = '请输入职位描述';
    }
    if (!form.applicationStatus) {
      nextErrors.applicationStatus = '请选择投递状态';
    }

    if (minRaw && (Number.isNaN(min) || (min !== undefined && min < 0))) {
      nextErrors.salaryMin = '最低薪资需为大于等于 0 的数字';
    }
    if (maxRaw && (Number.isNaN(max) || (max !== undefined && max < 0))) {
      nextErrors.salaryMax = '最高薪资需为大于等于 0 的数字';
    }
    if (
      min !== undefined &&
      max !== undefined &&
      !Number.isNaN(min) &&
      !Number.isNaN(max) &&
      min > max
    ) {
      nextErrors.salaryMax = '最高薪资不能小于最低薪资';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleConfirm = () => {
    if (loading || !validateForm()) {
      return;
    }

    onSubmit({
      title: form.title.trim(),
      company: form.company.trim(),
      description: form.description.trim(),
      location: form.location.trim(),
      salaryMin: form.salaryMin.trim() ? Number(form.salaryMin.trim()) : undefined,
      salaryMax: form.salaryMax.trim() ? Number(form.salaryMax.trim()) : undefined,
      applicationStatus: form.applicationStatus,
      notes: form.notes.trim(),
    });
  };

  return (
    <ConfirmDialog
      open={open}
      title={dialogTitle}
      message=""
      confirmText={confirmText}
      cancelText="取消"
      confirmVariant="primary"
      loading={loading}
      onConfirm={handleConfirm}
      onCancel={onCancel}
      customContent={
        <div className="space-y-4">
          {/* 基础信息：创建与编辑都需要完整维护职位核心字段。 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              职位名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(event) => updateField('title', event.target.value)}
              className={fieldClassName}
              placeholder="例如：Java 后端开发工程师"
              maxLength={120}
            />
            {errors.title && <p className={errorClassName}>{errors.title}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              公司名称 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.company}
              onChange={(event) => updateField('company', event.target.value)}
              className={fieldClassName}
              placeholder="例如：某某科技有限公司"
              maxLength={120}
            />
            {errors.company && <p className={errorClassName}>{errors.company}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              职位描述 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={form.description}
              onChange={(event) => updateField('description', event.target.value)}
              className={`${fieldClassName} min-h-[96px] resize-y`}
              placeholder="填写岗位职责、技术栈、任职要求等信息"
              maxLength={4000}
            />
            {errors.description && <p className={errorClassName}>{errors.description}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              工作地点
            </label>
            <input
              type="text"
              value={form.location}
              onChange={(event) => updateField('location', event.target.value)}
              className={fieldClassName}
              placeholder="例如：上海 / 杭州 / 远程"
              maxLength={120}
            />
          </div>

          {/* 薪资与投递状态作为求职跟踪信息集中维护。 */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                最低薪资
              </label>
              <input
                type="number"
                min={0}
                step="1000"
                value={form.salaryMin}
                onChange={(event) => updateField('salaryMin', event.target.value)}
                className={fieldClassName}
                placeholder="例如：15000"
              />
              {errors.salaryMin && <p className={errorClassName}>{errors.salaryMin}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                最高薪资
              </label>
              <input
                type="number"
                min={0}
                step="1000"
                value={form.salaryMax}
                onChange={(event) => updateField('salaryMax', event.target.value)}
                className={fieldClassName}
                placeholder="例如：25000"
              />
              {errors.salaryMax && <p className={errorClassName}>{errors.salaryMax}</p>}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              投递状态 <span className="text-red-500">*</span>
            </label>
            <select
              value={form.applicationStatus}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  applicationStatus: event.target.value as JobApplicationStatus,
                }))
              }
              className={fieldClassName}
            >
              {jobStatusOptions.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
            {errors.applicationStatus && <p className={errorClassName}>{errors.applicationStatus}</p>}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              备注
            </label>
            <textarea
              value={form.notes}
              onChange={(event) => updateField('notes', event.target.value)}
              className={`${fieldClassName} min-h-[72px] resize-y`}
              placeholder="例如：内推信息、面试反馈、跟进计划等"
              maxLength={2000}
            />
          </div>
        </div>
      }
    />
  );
}
