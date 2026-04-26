import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Edit3,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { getErrorMessage, userExperienceApi } from '../api';
import DeleteConfirmDialog from '../components/DeleteConfirmDialog';
import type { UserExperience, UserExperienceForm, UserExperienceType } from '../types/user-experience';
import { userExperienceTypeLabelMap, userExperienceTypeOptions } from '../types/user-experience';
import { formatDateTime } from '../utils/date';

type TypeFilter = UserExperienceType | 'ALL';

const emptyForm: UserExperienceForm = {
  type: 'SELF_INTRO',
  title: '',
  content: '',
  tags: [],
  enabled: true,
};

function toTagText(tags: string[]) {
  return tags.join('，');
}

function parseTagText(value: string) {
  return value
    .split(/[，,]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function buildForm(item: UserExperience): UserExperienceForm {
  return {
    type: item.type,
    title: item.title,
    content: item.content,
    tags: item.tags ?? [],
    enabled: item.enabled,
  };
}

function getTypeBadgeClass(type: UserExperienceType) {
  switch (type) {
    case 'SELF_INTRO':
      return 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300';
    case 'PROJECT':
      return 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300';
    case 'WORK':
      return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
    case 'SKILL':
      return 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    case 'PREFERENCE':
      return 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300';
    default:
      return 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
  }
}

export default function UserExperiencePage() {
  const [items, setItems] = useState<UserExperience[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [editingItem, setEditingItem] = useState<UserExperience | null>(null);
  const [deleteItem, setDeleteItem] = useState<UserExperience | null>(null);
  const [form, setForm] = useState<UserExperienceForm>(emptyForm);
  const [tagText, setTagText] = useState('');

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await userExperienceApi.list();
      setItems(data);
    } catch (err) {
      setItems([]);
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const filteredItems = useMemo(() => {
    return typeFilter === 'ALL'
      ? items
      : items.filter((item) => item.type === typeFilter);
  }, [items, typeFilter]);

  const stats = useMemo(() => {
    return {
      total: items.length,
      enabled: items.filter((item) => item.enabled).length,
      selfIntro: items.filter((item) => item.type === 'SELF_INTRO').length,
      project: items.filter((item) => item.type === 'PROJECT').length,
    };
  }, [items]);

  const resetForm = () => {
    setEditingItem(null);
    setForm(emptyForm);
    setTagText('');
    setActionError(null);
  };

  const startEdit = (item: UserExperience) => {
    setEditingItem(item);
    setForm(buildForm(item));
    setTagText(toTagText(item.tags ?? []));
    setActionError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setActionError(null);

    const payload: UserExperienceForm = {
      ...form,
      title: form.title.trim(),
      content: form.content.trim(),
      tags: parseTagText(tagText),
    };

    try {
      if (editingItem) {
        await userExperienceApi.update(editingItem.id, payload);
      } else {
        await userExperienceApi.create(payload);
      }
      resetForm();
      await loadItems();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) {
      return;
    }
    setDeleting(true);
    setActionError(null);
    try {
      await userExperienceApi.delete(deleteItem.id);
      setDeleteItem(null);
      if (editingItem?.id === deleteItem.id) {
        resetForm();
      }
      await loadItems();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setDeleting(false);
    }
  };

  const toggleEnabled = async (item: UserExperience) => {
    setActionError(null);
    try {
      await userExperienceApi.update(item.id, {
        ...buildForm(item),
        enabled: !item.enabled,
      });
      await loadItems();
    } catch (err) {
      setActionError(getErrorMessage(err));
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-slate-800 dark:text-white">
            <UserRound className="h-7 w-7 text-primary-500" />
            我的经历
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
            维护自我介绍、项目、实习工作、技能亮点和求职偏好。后续 Boss 开场白会优先引用启用的经历素材，让辅助投递越用越顺手。
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadItems()}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          <RefreshCw className="h-4 w-4" />
          刷新
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="总素材" value={String(stats.total)} hint="全部我的经历" />
        <StatCard label="已启用" value={String(stats.enabled)} hint="会进入生成上下文" />
        <StatCard label="自我介绍" value={String(stats.selfIntro)} hint="用于开场介绍" />
        <StatCard label="项目经历" value={String(stats.project)} hint="用于能力匹配" />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-500/60 dark:bg-red-900/20 dark:text-red-200">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {actionError && (
        <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 dark:border-amber-500/60 dark:bg-amber-900/20 dark:text-amber-200">
          <AlertCircle className="h-4 w-4" />
          {actionError}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[420px,1fr]">
        <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                {editingItem ? '编辑经历素材' : '新增经历素材'}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                内容越具体，后续生成开场白越贴近你本人。
              </p>
            </div>
            {editingItem && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-full border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                aria-label="取消编辑"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                素材类型
              </label>
              <select
                value={form.type}
                onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value as UserExperienceType }))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-primary-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                {userExperienceTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                标题
              </label>
              <input
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="例如：AI 简历分析平台、Java 后端能力、求职偏好"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-primary-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                required
                maxLength={200}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                内容
              </label>
              <textarea
                value={form.content}
                onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
                placeholder="写清楚背景、你做了什么、结果如何，以及适合在投递开场白里强调的点。"
                className="min-h-40 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6 text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-primary-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                required
                maxLength={12000}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                标签
              </label>
              <input
                value={tagText}
                onChange={(event) => setTagText(event.target.value)}
                placeholder="Java，AI，后端，Spring Boot"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors placeholder:text-slate-400 focus:border-primary-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">用逗号分隔，最多保留 20 个标签。</p>
            </div>

            <label className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900">
              <span className="font-medium text-slate-700 dark:text-slate-200">启用到开场白生成</span>
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(event) => setForm((prev) => ({ ...prev, enabled: event.target.checked }))}
                className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
            </label>

            <button
              type="submit"
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-primary-500/20 transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingItem ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {saving ? '保存中...' : editingItem ? '保存修改' : '新增经历'}
            </button>
          </form>
        </section>

        <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">经历素材列表</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                已启用素材会作为后续辅助投递生成上下文。
              </p>
            </div>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus:border-primary-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="ALL">全部类型</option>
              {userExperienceTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="flex min-h-72 items-center justify-center text-slate-500 dark:text-slate-400">
              <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary-500" />
              正在加载我的经历...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 text-center dark:border-slate-700">
              <Sparkles className="mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">还没有经历素材</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                先从自我介绍、项目经历或技能亮点开始补充。
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredItems.map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl border border-slate-100 p-5 transition-colors hover:border-primary-100 hover:bg-primary-50/20 dark:border-slate-700 dark:hover:border-primary-800 dark:hover:bg-primary-900/10"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${getTypeBadgeClass(item.type)}`}>
                          {userExperienceTypeLabelMap[item.type]}
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                          item.enabled
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
                        }`}>
                          {item.enabled ? <CheckCircle2 className="h-3 w-3" /> : <ToggleLeft className="h-3 w-3" />}
                          {item.enabled ? '已启用' : '未启用'}
                        </span>
                      </div>
                      <h3 className="text-base font-semibold text-slate-800 dark:text-white">{item.title}</h3>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">
                        {item.content}
                      </p>
                      {item.tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.tags.map((tag) => (
                            <span
                              key={`${item.id}-${tag}`}
                              className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500 dark:bg-slate-700 dark:text-slate-300"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
                        更新于 {formatDateTime(item.updatedAt)}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void toggleEnabled(item)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        {item.enabled ? <ToggleLeft className="h-4 w-4" /> : <ToggleRight className="h-4 w-4" />}
                        {item.enabled ? '停用' : '启用'}
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-primary-200 bg-primary-50 px-3 py-2 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-100 dark:border-primary-700/60 dark:bg-primary-900/20 dark:text-primary-200"
                      >
                        <Edit3 className="h-4 w-4" />
                        编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteItem(item)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100 dark:border-red-500/40 dark:bg-red-900/20 dark:text-red-300"
                      >
                        <Trash2 className="h-4 w-4" />
                        删除
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <DeleteConfirmDialog
        open={Boolean(deleteItem)}
        item={deleteItem}
        itemType="我的经历"
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteItem(null)}
      />
    </div>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{hint}</p>
    </div>
  );
}
