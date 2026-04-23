import { useEffect, useMemo, useState } from 'react';
import type { JobDraftItem } from '../types/job-draft';
import ConfirmDialog from './ConfirmDialog';

export interface JobDraftEditFormData {
  title: string;
  company: string;
  location: string;
  salaryTextRaw: string;
  experienceTextRaw: string;
  educationTextRaw: string;
  recruiterName: string;
  techTags: string[];
  descriptionFull: string;
}

interface JobDraftEditDialogProps {
  open: boolean;
  item: JobDraftItem | null;
  loading?: boolean;
  onCancel: () => void;
  onSubmit: (data: JobDraftEditFormData) => void;
}

interface JobDraftEditFormState {
  title: string;
  company: string;
  location: string;
  salaryTextRaw: string;
  experienceTextRaw: string;
  educationTextRaw: string;
  recruiterName: string;
  techTagsText: string;
  descriptionFull: string;
}

interface FormErrors {
  title?: string;
  company?: string;
}

const EMPTY_FORM: JobDraftEditFormState = {
  title: '',
  company: '',
  location: '',
  salaryTextRaw: '',
  experienceTextRaw: '',
  educationTextRaw: '',
  recruiterName: '',
  techTagsText: '',
  descriptionFull: '',
};

function buildInitialForm(item: JobDraftItem | null): JobDraftEditFormState {
  if (!item) {
    return EMPTY_FORM;
  }

  return {
    title: item.title ?? '',
    company: item.company ?? '',
    location: item.location ?? '',
    salaryTextRaw: item.salaryTextRaw ?? '',
    experienceTextRaw: item.experienceTextRaw ?? '',
    educationTextRaw: item.educationTextRaw ?? '',
    recruiterName: item.recruiterName ?? '',
    techTagsText: item.techTags.join(', '),
    descriptionFull: item.descriptionFull ?? item.descriptionPreview ?? '',
  };
}

function parseTags(value: string): string[] {
  return value
    .split(/[\n,，、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function JobDraftEditDialog({
  open,
  item,
  loading = false,
  onCancel,
  onSubmit,
}: JobDraftEditDialogProps) {
  const [form, setForm] = useState<JobDraftEditFormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (!open) {
      return;
    }
    setForm(buildInitialForm(item));
    setErrors({});
  }, [item, open]);

  const fieldClassName = useMemo(
    () =>
      'w-full rounded-xl border px-3 py-2.5 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 ' +
      'placeholder:text-slate-400 dark:placeholder:text-slate-500 border-slate-200 dark:border-slate-600 ' +
      'focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-colors',
    [],
  );

  const errorClassName = 'mt-1 text-xs text-red-500 dark:text-red-400';

  const updateField = (field: keyof JobDraftEditFormState, value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }));
    if (field === 'title' || field === 'company') {
      setErrors((previous) => ({ ...previous, [field]: undefined }));
    }
  };

  const validateForm = () => {
    const nextErrors: FormErrors = {};
    if (!form.title.trim()) {
      nextErrors.title = '请输入职位名称';
    }
    if (!form.company.trim()) {
      nextErrors.company = '请输入公司名称';
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
      location: form.location.trim(),
      salaryTextRaw: form.salaryTextRaw.trim(),
      experienceTextRaw: form.experienceTextRaw.trim(),
      educationTextRaw: form.educationTextRaw.trim(),
      recruiterName: form.recruiterName.trim(),
      techTags: parseTags(form.techTagsText),
      descriptionFull: form.descriptionFull.trim(),
    });
  };

  return (
    <ConfirmDialog
      open={open}
      title="编辑职位草稿"
      message=""
      confirmText="保存草稿"
      cancelText="取消"
      confirmVariant="primary"
      loading={loading}
      onConfirm={handleConfirm}
      onCancel={onCancel}
      customContent={
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
                maxLength={200}
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
                maxLength={200}
              />
              {errors.company && <p className={errorClassName}>{errors.company}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
                maxLength={100}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                薪资描述
              </label>
              <input
                type="text"
                value={form.salaryTextRaw}
                onChange={(event) => updateField('salaryTextRaw', event.target.value)}
                className={fieldClassName}
                placeholder="例如：20k-30k·14薪"
                maxLength={100}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                经验要求
              </label>
              <input
                type="text"
                value={form.experienceTextRaw}
                onChange={(event) => updateField('experienceTextRaw', event.target.value)}
                className={fieldClassName}
                placeholder="例如：3-5年"
                maxLength={100}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                学历要求
              </label>
              <input
                type="text"
                value={form.educationTextRaw}
                onChange={(event) => updateField('educationTextRaw', event.target.value)}
                className={fieldClassName}
                placeholder="例如：本科"
                maxLength={100}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                招聘方
              </label>
              <input
                type="text"
                value={form.recruiterName}
                onChange={(event) => updateField('recruiterName', event.target.value)}
                className={fieldClassName}
                placeholder="例如：HR 张三"
                maxLength={100}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              技术标签
            </label>
            <textarea
              value={form.techTagsText}
              onChange={(event) => updateField('techTagsText', event.target.value)}
              className={`${fieldClassName} min-h-[72px] resize-y`}
              placeholder="支持英文逗号、中文逗号或换行分隔，例如：Java, Spring Boot, Redis"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              完整 JD
            </label>
            <textarea
              value={form.descriptionFull}
              onChange={(event) => updateField('descriptionFull', event.target.value)}
              className={`${fieldClassName} min-h-[160px] resize-y`}
              placeholder="补充或修正职位职责、任职要求、技术栈等信息"
              maxLength={12000}
            />
          </div>
        </div>
      }
    />
  );
}
