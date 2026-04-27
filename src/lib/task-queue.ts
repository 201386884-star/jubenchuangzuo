// ============================================================
// 后台任务队列 —— 支持切换页面、关闭页面后继续生成
// ============================================================

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed';
export type TaskType = 'generate-outline' | 'generate-script' | 'deai-process';

export interface BackgroundTask {
  id: string;
  type: TaskType;
  status: TaskStatus;
  progress: number;       // 0-100
  currentEpisode?: number;
  totalEpisodes?: number;
  createdAt: string;
  updatedAt: string;
  // 请求参数
  params: Record<string, any>;
  // 结果
  result?: any;
  error?: string;
  // 多剧本相关
  scriptIndex?: number;   // 第几个剧本
  totalScripts?: number;  // 总共要生成几个
  label?: string;         // 用户可见的任务标签
}

const STORAGE_KEY = 'short-drama-tasks';

export function getTasks(): BackgroundTask[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveTasks(tasks: BackgroundTask[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

export function addTask(task: BackgroundTask) {
  const tasks = getTasks();
  tasks.push(task);
  saveTasks(tasks);
  return task;
}

export function updateTask(id: string, updates: Partial<BackgroundTask>) {
  const tasks = getTasks();
  const idx = tasks.findIndex(t => t.id === id);
  if (idx >= 0) {
    tasks[idx] = { ...tasks[idx], ...updates, updatedAt: new Date().toISOString() };
    saveTasks(tasks);
  }
}

export function removeTask(id: string) {
  saveTasks(getTasks().filter(t => t.id !== id));
}

export function getActiveTasks(): BackgroundTask[] {
  return getTasks().filter(t => t.status === 'pending' || t.status === 'running');
}

export function newTaskId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
