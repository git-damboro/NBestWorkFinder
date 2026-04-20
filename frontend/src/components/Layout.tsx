import { Link, Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Briefcase,
  ChevronRight,
  ClipboardList,
  Database,
  FileStack,
  ListChecks,
  LogOut,
  MessageSquare,
  Moon,
  Sparkles,
  Sun,
  Upload,
  Users,
} from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import { useAuth } from '../auth/AuthContext';

interface NavItem {
  id: string;
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}

interface NavGroup {
  id: string;
  title: string;
  items: NavItem[];
}

export default function Layout() {
  const location = useLocation();
  const currentPath = location.pathname;
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();

  const navGroups: NavGroup[] = [
    {
      id: 'career',
      title: '简历与面试',
      items: [
        { id: 'upload', path: '/upload', label: '上传简历', icon: Upload, description: 'AI 分析简历' },
        { id: 'resumes', path: '/history', label: '简历库', icon: FileStack, description: '管理所有简历' },
        { id: 'interviews', path: '/interviews', label: '面试记录', icon: Users, description: '查看面试历史' },
        { id: 'tasks', path: '/tasks', label: '任务中心', icon: ListChecks, description: '跟踪 AI 任务状态' },
        {
          id: 'job-drafts',
          path: '/jobs/drafts',
          label: '职位草稿',
          icon: ClipboardList,
          description: '批量确认职位草稿',
        },
        { id: 'jobs', path: '/jobs', label: '职位工作台', icon: Briefcase, description: '跟踪职位与投递进度' },
      ],
    },
    {
      id: 'knowledge',
      title: '知识库',
      items: [
        {
          id: 'kb-manage',
          path: '/knowledgebase',
          label: '知识库管理',
          icon: Database,
          description: '管理知识文档',
        },
        {
          id: 'chat',
          path: '/knowledgebase/chat',
          label: '问答助手',
          icon: MessageSquare,
          description: '基于知识库问答',
        },
      ],
    },
  ];

  const isActive = (path: string) => {
    if (path === '/upload') {
      return currentPath === '/upload' || currentPath === '/';
    }
    if (path === '/knowledgebase') {
      return currentPath === '/knowledgebase' || currentPath === '/knowledgebase/upload';
    }
    if (path === '/jobs') {
      return currentPath === '/jobs';
    }
    return currentPath.startsWith(path);
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800">
      <aside className="fixed left-0 top-0 z-50 flex h-screen w-64 flex-col border-r border-slate-100 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 p-6 dark:border-slate-700">
          <Link to="/upload" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/30">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <span className="block text-lg font-bold tracking-tight text-slate-800 dark:text-white">
                AI Interview
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500">智能面试助手</span>
            </div>
          </Link>
        </div>

        <div className="px-4 pb-2">
          <button
            onClick={toggleTheme}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-slate-600 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="h-4 w-4" />
                <span className="text-sm font-medium">浅色模式</span>
              </>
            ) : (
              <>
                <Moon className="h-4 w-4" />
                <span className="text-sm font-medium">深色模式</span>
              </>
            )}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-4">
          <div className="space-y-6">
            {navGroups.map((group) => (
              <div key={group.id}>
                <div className="mb-2 px-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {group.title}
                  </span>
                </div>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const active = isActive(item.path);
                    return (
                      <Link
                        key={item.id}
                        to={item.path}
                        className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200 ${
                          active
                            ? 'bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
                        }`}
                      >
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                            active
                              ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/50 dark:text-primary-400'
                              : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200 group-hover:text-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:group-hover:bg-slate-700 dark:group-hover:text-white'
                          }`}
                        >
                          <item.icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className={`block text-sm ${active ? 'font-semibold' : 'font-medium'}`}>
                            {item.label}
                          </span>
                          {item.description && (
                            <span className="block truncate text-xs text-slate-400 dark:text-slate-500">
                              {item.description}
                            </span>
                          )}
                        </div>
                        {active && <ChevronRight className="h-4 w-4 text-primary-400" />}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        <div className="space-y-3 border-t border-slate-100 p-4 dark:border-slate-700">
          <div className="rounded-xl bg-gradient-to-r from-primary-50 to-indigo-50 px-3 py-2 dark:from-primary-900/30 dark:to-slate-800">
            <p className="text-xs font-medium text-primary-600 dark:text-primary-400">AI 面试助手 v1.0</p>
            <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">Powered by AI</p>
          </div>

          {user && (
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-800">
              <p className="text-xs text-slate-400 dark:text-slate-500">当前用户</p>
              <p className="mt-1 truncate text-sm font-medium text-slate-700 dark:text-slate-200">{user.email}</p>
              <button
                type="button"
                onClick={() => void logout()}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <LogOut className="h-4 w-4" />
                <span className="text-sm font-medium">退出登录</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="ml-64 min-h-screen flex-1 overflow-y-auto p-10">
        <motion.div
          key={currentPath}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
}
