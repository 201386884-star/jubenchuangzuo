'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Loader2, Film, Library, Settings, Bell, X, Trash2, CheckCircle, FolderOpen } from 'lucide-react';
import StoryInput from '@/components/forms/StoryInput';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getApiConfigById } from '@/lib/api-configs';
import { getTasks, removeTask, updateTask, type BackgroundTask } from '@/lib/task-queue';
// 确保后台任务处理器和调度器被加载
import '@/lib/use-task-queue';
import { OutlineDB } from '@/lib/db';

export default function Home() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');

  // 后台任务
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);
  const [showTaskPanel, setShowTaskPanel] = useState(false);

  // 挂载时检查后台任务
  useEffect(() => {
    const allTasks = getTasks();
    const runningTasks = allTasks.filter(t => t.status === 'pending' || t.status === 'running');
    if (runningTasks.length > 0) {
      setProgressLabel(`${runningTasks.length}个任务正在后台生成中...`);
    }
  }, []);

  // 轮询任务状态
  useEffect(() => {
    const interval = setInterval(() => {
      const allTasks = getTasks();
      setTasks(allTasks);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const scriptTasks = tasks.filter(t => t.type === 'generate-script');
  const allRunningTasks = tasks.filter(t => t.status === 'pending' || t.status === 'running');

  // 提交：生成大纲 → 直接跳转到 scripts/[id]
  const handleSubmit = async (data: {
    userInput: string;
    genre: string;
    episodes: number;
    episodeDuration: number;
    orientation: 'vertical' | 'horizontal';
    platform: string;
    modelProvider: string;
  }) => {
    setIsLoading(true);
    setError(null);
    setProgress(0);

    try {
      const selectedConfig = getApiConfigById(data.modelProvider);
      if (!selectedConfig?.apiKey) throw new Error('请先在设置页面配置 API Key');

      setProgressLabel('正在生成大纲...');
      setProgress(10);

      const outlineRes = await fetch('/api/generate-outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userInput: data.userInput,
          genre: data.genre,
          platform: data.platform,
          totalEpisodes: data.episodes,
          episodeDuration: data.episodeDuration,
          apiConfig: selectedConfig,
        }),
      });
      const outlineData = await outlineRes.json();
      if (!outlineData.success) throw new Error(outlineData.error || '大纲生成失败');

      // 持久化大纲
      const savedOutline = OutlineDB.create(outlineData.outline.userInput || data.userInput);
      OutlineDB.update(savedOutline.id, { ...outlineData.outline, id: savedOutline.id, episodeDuration: data.episodeDuration, orientation: data.orientation });

      setProgress(100);
      setProgressLabel('大纲生成完成！正在跳转...');

      // 直接跳转到详情页
      setTimeout(() => {
        router.push(`/scripts/${savedOutline.id}`);
      }, 300);

    } catch (err) {
      setError(err instanceof Error ? err.message : '生成过程中出现错误');
      setIsLoading(false);
    }
  };

  const handleCancelTask = (id: string) => {
    updateTask(id, { status: 'failed', error: '用户取消' });
  };

  const handleRemoveTask = (id: string) => {
    removeTask(id);
  };

  return (
    <div className="p-10">
      <div className="max-w-4xl mx-auto">
        {/* 标题 + 任务通知 */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">词元剧本</h1>
            <p className="text-sm text-gray-400">输入创意 → 生成大纲 → 分批生成剧本</p>
          </div>
          <div className="flex items-center gap-2">
            {allRunningTasks.length > 0 && (
              <button
                onClick={() => setShowTaskPanel(!showTaskPanel)}
                className="relative flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-50 text-purple-700 text-sm font-medium hover:bg-purple-100 transition-colors"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {allRunningTasks.length}
                </span>
                后台任务
              </button>
            )}
          </div>
        </div>

        {/* 任务面板 */}
        {showTaskPanel && allRunningTasks.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">后台任务</h3>
              <button onClick={() => setShowTaskPanel(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2">
              {allRunningTasks.map(task => (
                <div key={task.id} className={`flex items-center gap-3 p-2 rounded-lg ${task.status === 'running' ? 'bg-purple-50' : 'bg-gray-50'}`}>
                  {task.status === 'running' ? (
                    <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border-2 border-gray-300 border-t-purple-500 animate-spin" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-purple-800 truncate">{task.label}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${task.status === 'running' ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-500'}`}>
                        {task.status === 'running' ? '生成中' : '排队中'}
                      </span>
                    </div>
                    {task.currentEpisode && task.totalEpisodes && task.status === 'running' && (
                      <p className="text-[10px] text-purple-500 mt-0.5">第{task.currentEpisode}/{task.totalEpisodes}集</p>
                    )}
                    {task.progress > 0 && task.status === 'running' && (
                      <div className="mt-1 w-full bg-purple-200 rounded-full h-1">
                        <div className="bg-purple-600 h-1 rounded-full transition-all" style={{ width: `${task.progress}%` }} />
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleCancelTask(task.id)}
                    className="px-2 py-1 text-[11px] text-red-500 border border-red-200 rounded hover:bg-red-50 transition-colors"
                  >
                    取消
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 输入区 */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <StoryInput onSubmit={handleSubmit} isLoading={isLoading} />
        </div>

        {/* 错误 */}
        {error && (
          <div className="mb-6">
            <Alert variant="error"><AlertDescription>{error}</AlertDescription></Alert>
          </div>
        )}

        {/* 大纲生成中 */}
        {isLoading && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
              <span className="text-sm text-gray-600">{progressLabel || '正在生成大纲...'}</span>
            </div>
            <div className="mt-4 w-full bg-gray-100 rounded-full h-1.5">
              <div className="bg-purple-600 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-3 text-xs text-gray-400">大纲包含故事梗概、人物设定、分集梗概等，通常需要 30-60 秒</p>
          </div>
        )}

        {/* 底部入口 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { href: '/scripts', icon: FolderOpen, title: '我的剧本', desc: '管理已生成的剧本项目，支持编辑和导出' },
            { href: '/deai', icon: Film, title: '剧本润色', desc: 'AI剧本润色，让台词更自然更有味道' },
            { href: '/library', icon: Library, title: '剧本学习库', desc: '上传优质剧本，让AI学习提升质量' },
            { href: '/settings', icon: Settings, title: '设置', desc: '配置API密钥、选择默认模型' },
          ].map((item) => (
            <Link key={item.href} href={item.href} className="no-underline">
              <div className="bg-white rounded-xl border border-gray-200 p-5 hover:border-purple-300 transition-colors cursor-pointer h-full">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                    <item.icon className="h-4 w-4 text-purple-600" />
                  </div>
                  <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">{item.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
