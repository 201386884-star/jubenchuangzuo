// ============================================================
// 后台生成管理器 —— 页面切换后任务继续运行
// 使用 BroadcastChannel 跨页面通信 + localStorage 持久化
// ============================================================

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { getTasks, updateTask, saveTasks, type BackgroundTask } from '@/lib/task-queue';
import { DeAIDB } from '@/lib/deai-db';

// BroadcastChannel 实例（跨页面实时推送）
let deaiChannel: BroadcastChannel | null = null;
let scriptStreamChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined') {
  deaiChannel = new BroadcastChannel('deai-progress');
  scriptStreamChannel = new BroadcastChannel('script-stream');
}

function broadcastDeaiProgress(data: {
  type: 'phase' | 'round-complete' | 'round-detecting' | 'done' | 'failed';
  sessionId: string;
  round?: number;
  totalRounds?: number;
  aiProbability?: number;
  phase?: string;
  progress?: number;
}) {
  try {
    deaiChannel?.postMessage(data);
  } catch { /* 静默 */ }
}

type TaskProcessor = (task: BackgroundTask) => Promise<any>;

const processors: Record<string, TaskProcessor> = {};

export function registerTaskProcessor(type: string, processor: TaskProcessor) {
  processors[type] = processor;
}

// 立即注册脚本生成处理器
if (typeof window !== 'undefined') {
  registerTaskProcessor('generate-script', async (task) => {
    const {
      apiConfig, outline, totalEpisodes, platform,
      scriptIndex = 1, totalScripts = 1,
      startFrom = 1, endAt,              // 批量生成范围
      userGuidance,                       // 用户创作方向
      existingEpisodes = [],              // 已有的集数（续写模式）
      previousSummary: initialSummary,    // 续写时的前情
    } = task.params;

    const actualEndAt = endAt || totalEpisodes;
    const batchCount = actualEndAt - startFrom + 1;
    const titlePrefix = `[${outline?.title || '剧本'}] `;
    const prefix = totalScripts > 1 ? `[方案${scriptIndex}/${totalScripts}] ` : titlePrefix;

    // 逐集生成
    const episodes: any[] = [...existingEpisodes];
    // 获取前情：用最后已有的集数的完整内容（而非摘要），确保衔接
    let previousContent = initialSummary
      || (episodes.length > 0 ? episodes[episodes.length - 1].content : '');
    let previousSummary = episodes.length > 0 ? episodes[episodes.length - 1].summary : '';

    for (let i = startFrom; i <= actualEndAt; i++) {
      // 检查任务是否被取消
      const current = getTasks().find(t => t.id === task.id);
      if (!current || current.status === 'failed') {
        throw new Error('任务已取消');
      }

      const progressInBatch = Math.round(((i - startFrom) / batchCount) * 100);
      updateTask(task.id, {
        status: 'running',
        progress: progressInBatch,
        currentEpisode: i,
        label: `${prefix}正在生成第${i}/${actualEndAt}集`,
      });

      // 广播：开始新集
      try {
        scriptStreamChannel?.postMessage({
          type: 'episode-start',
          taskId: task.id,
          episodeNumber: i,
          totalEpisodes: actualEndAt,
        });
      } catch { /* 静默 */ }

      // SSE 流式请求（10分钟超时，长内容需要更多时间）
      const res = await fetchWithTimeout('/api/generate-script-episode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outline,
          episodeNumber: i,
          totalEpisodes,
          platform,
          apiConfig,
          previousContent: previousContent || undefined,
          previousSummary: previousSummary || undefined,
          userGuidance: userGuidance || undefined,
          episodeDuration: outline?.episodeDuration,
        }),
      }, 600000);

      if (!res.ok) {
        // 非流式错误响应（如 400）
        const errData = await res.json().catch(() => ({ error: '请求失败' }));
        throw new Error(errData.error || `第${i}集生成失败`);
      }

      // 读取 SSE 流
      const reader = res.body?.getReader();
      if (!reader) throw new Error(`第${i}集：无法获取响应流`);

      const decoder = new TextDecoder();
      let buffer = '';
      let episode: any = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        lastHeartbeat = Date.now(); // 每收到数据就刷新心跳

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);

          try {
            const json = JSON.parse(data);

            if (json.type === 'token') {
              // 广播 token 到所有页面
              try {
                scriptStreamChannel?.postMessage({
                  type: 'token',
                  taskId: task.id,
                  episodeNumber: i,
                  content: json.content,
                });
              } catch { /* 静默 */ }
            } else if (json.type === 'done') {
              episode = json.episode;
            } else if (json.type === 'error') {
              throw new Error(json.error || `第${i}集生成失败`);
            }
          } catch (e) {
            if (e instanceof Error && e.message.includes('第')) throw e;
            // skip malformed
          }
        }
      }

      if (!episode) throw new Error(`第${i}集：未收到完整结果`);

      episodes.push(episode);
      previousContent = episode.content;
      previousSummary = episode.summary;

      // 广播：本集完成
      try {
        scriptStreamChannel?.postMessage({
          type: 'episode-done',
          taskId: task.id,
          episodeNumber: i,
          episode,
        });
      } catch { /* 静默 */ }
    }

    // 组装最终脚本
    const { nanoid } = await import('nanoid');
    const script = {
      id: nanoid(12),
      outlineId: outline.id,
      title: outline.logline?.substring(0, 30) || outline.title || '未命名剧本',
      platform,
      totalEpisodes,
      episodes,
      generatedUpTo: actualEndAt,
      status: 'complete',
      aiFlavorLevel: 'none',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      scriptIndex,
      startFrom,      // 记录本批从哪集开始
      batchCount,     // 本批生成了几集
    };

    return script;
  });

  registerTaskProcessor('generate-outline', async (task) => {
    const { userInput, genre, platform, apiConfig } = task.params;

    updateTask(task.id, { status: 'running', progress: 10, label: '正在生成大纲...' });

    const res = await fetchWithTimeout('/api/generate-outline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userInput, genre, platform, apiConfig }),
    });

    const data = await res.json();
    if (!data.success) throw new Error(data.error || '大纲生成失败');

    return data.outline;
  });

  // 注册剧本润色处理器（细化进度 + BroadcastChannel 实时推送）
  registerTaskProcessor('deai-process', async (task) => {
    const {
      sessionId, content, level, dialectStyle, genre,
      apiConfig, enablePostProcess,
      iterationMode, maxIterations = 1, targetProbability = 20,
      zhuqueConfig,
    } = task.params;

    const totalRounds = iterationMode === 'auto' ? maxIterations : 1;
    const hasZhuque = zhuqueConfig?.secretId && zhuqueConfig?.secretKey;

    const updateProgress = (progress: number, label: string, round?: number) => {
      updateTask(task.id, { progress, label });
      broadcastDeaiProgress({
        type: 'phase',
        sessionId,
        round,
        totalRounds,
        phase: label,
        progress,
      });
    };

    updateProgress(3, '准备处理...', 0);
    let currentContent = content;
    let currentProb: number | null = null;

    // 阶段1：检测原文AI概率
    if (hasZhuque) {
      updateProgress(5, '正在检测原文AI概率...');
      try {
        const detectRes = await fetchWithTimeout('/api/detect-ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, zhuqueConfig }),
        });
        const detectData = await detectRes.json();
        if (detectData.success) {
          currentProb = detectData.aiProbability;
          DeAIDB.update(sessionId, { inputAiProbability: detectData.aiProbability });
          broadcastDeaiProgress({
            type: 'phase',
            sessionId,
            phase: `原文AI概率: ${detectData.aiProbability}%`,
            progress: 10,
            aiProbability: detectData.aiProbability,
          });
        }
      } catch { /* 静默 */ }
    }

    // 阶段2：逐轮处理
    for (let round = 1; round <= totalRounds; round++) {
      const current = getTasks().find(t => t.id === task.id);
      if (!current || current.status === 'failed') throw new Error('任务已取消');

      // 检查是否被用户标记为"采纳并停止"
      if (current.params?.adoptAndStop) {
        updateTask(task.id, {
          label: `已采纳第${round - 1}轮结果`,
          progress: 100,
        });
        break;
      }

      const roundBase = hasZhuque ? 10 : 3;
      const roundRange = hasZhuque ? 85 : 95;
      const roundStart = roundBase + Math.round(((round - 1) / totalRounds) * roundRange);
      const roundMid = roundStart + Math.round((roundRange / totalRounds) * 0.5);
      const roundEnd = roundStart + Math.round((roundRange / totalRounds) * 0.9);

      // LLM改写阶段
      const roundLabel = totalRounds > 1
        ? `第${round}/${totalRounds}轮 · LLM语义改写中...`
        : 'LLM语义改写中...';
      updateProgress(roundStart, roundLabel, round);

      // 调用剧本润色API
      const res = await fetchWithTimeout('/api/remove-ai-flavor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: currentContent,
          level,
          genre: genre || undefined,
          dialectStyle,
          apiConfig,
          enablePostProcess,
          previousResult: round > 1 ? currentContent : undefined,
          previousAiProbability: round > 1 ? (currentProb ?? undefined) : undefined,
          iterationRound: round,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || '处理失败');
      currentContent = data.deAIedContent;

      // 后处理阶段
      const postLabel = totalRounds > 1
        ? `第${round}/${totalRounds}轮 · 统计后处理中...`
        : '统计后处理中...';
      updateProgress(roundMid, postLabel, round);

      // 检测输出AI概率
      let roundProb: number | null = null;
      if (hasZhuque) {
        updateProgress(roundEnd - 5, `第${round}轮 · 朱雀AI检测中...`, round);
        try {
          const detectRes = await fetchWithTimeout('/api/detect-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: currentContent, zhuqueConfig }),
          });
          const detectData = await detectRes.json();
          if (detectData.success) {
            roundProb = detectData.aiProbability;
            currentProb = detectData.aiProbability;
          }
        } catch { /* 静默 */ }
      }

      // 保存本轮结果到 DeAIDB
      DeAIDB.addRound(sessionId, {
        round,
        content: currentContent,
        aiProbability: roundProb ?? undefined,
        stats: data.stats || { connectorsReplaced: 0, sentencesModified: 0, imperfectionsInjected: 0, formatPreserved: 0 },
        modifications: data.modifications || [],
        timestamp: new Date().toISOString(),
      });

      DeAIDB.update(sessionId, {
        finalContent: currentContent,
        outputAiProbability: roundProb ?? undefined,
      });

      // 广播：本轮完成
      broadcastDeaiProgress({
        type: 'round-complete',
        sessionId,
        round,
        totalRounds,
        aiProbability: roundProb ?? undefined,
        progress: roundEnd,
      });

      updateProgress(roundEnd, `第${round}轮完成${roundProb !== null ? ` · AI: ${roundProb}%` : ''}`, round);

      // 自动迭代达标提前停止
      if (iterationMode === 'auto' && roundProb !== null && roundProb <= targetProbability) {
        broadcastDeaiProgress({
          type: 'phase',
          sessionId,
          phase: `已达标(${roundProb}% ≤ ${targetProbability}%)，提前结束`,
          round,
          progress: 98,
        });
        break;
      }
    }

    // 完成
    DeAIDB.update(sessionId, { status: 'completed' });
    broadcastDeaiProgress({
      type: 'done',
      sessionId,
      aiProbability: currentProb ?? undefined,
      progress: 100,
    });

    return {
      sessionId,
      finalContent: currentContent,
      outputAiProbability: currentProb,
      totalRounds: iterationMode === 'auto' ? maxIterations : 1,
    };
  });
}

// 后台调度器
let intervalId: ReturnType<typeof setInterval> | null = null;
let isProcessing = false;
let lastHeartbeat = 0; // 心跳：记录当前任务最后活跃时间

// 带超时的 fetch
function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 180000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(timer));
}

async function processNextTask() {
  if (isProcessing) {
    // 心跳检测：如果超过5分钟没有更新，说明处理器卡住了
    if (lastHeartbeat > 0 && Date.now() - lastHeartbeat > 5 * 60 * 1000) {
      console.warn('任务处理器心跳超时，强制重置');
      isProcessing = false;
      lastHeartbeat = 0;
      // 把 running 的任务标记为失败
      const tasks = getTasks();
      for (const t of tasks) {
        if (t.status === 'running') {
          updateTask(t.id, { status: 'failed', error: '生成超时，请重试' });
        }
      }
    }
    return;
  }
  const tasks = getTasks();
  const next = tasks.find(t => t.status === 'pending');
  if (!next) return;

  isProcessing = true;
  lastHeartbeat = Date.now();
  const processor = processors[next.type];

  if (!processor) {
    updateTask(next.id, { status: 'failed', error: `未知任务类型: ${next.type}` });
    isProcessing = false;
    lastHeartbeat = 0;
    return;
  }

  try {
    const result = await processor(next);
    updateTask(next.id, { status: 'completed', progress: 100, result, label: '生成完成' });
  } catch (err) {
    updateTask(next.id, { status: 'failed', error: err instanceof Error ? err.message : '生成失败' });
  } finally {
    isProcessing = false;
    lastHeartbeat = 0;
  }
}

function startScheduler() {
  if (intervalId) return;

  // 恢复卡住的 running 任务（页面刷新后这些任务无人处理）
  const tasks = getTasks();
  let changed = false;
  for (const t of tasks) {
    if (t.status === 'running') {
      // running 但没有处理器在执行 → 说明是上次刷新遗留的孤儿任务
      t.status = 'pending';
      t.label = (t.label || '').replace('正在', '恢复：正在');
      changed = true;
    }
  }
  if (changed) saveTasks(tasks);

  intervalId = setInterval(processNextTask, 1000);
}

// 浏览器环境下自动启动调度器
if (typeof window !== 'undefined') {
  startScheduler();
}

function stopScheduler() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

// React Hook: 在页面中使用，自动启动/停止调度器 + 提供任务状态
export function useTaskQueue() {
  const tasksRef = useRef<BackgroundTask[]>([]);

  const refresh = useCallback(() => {
    tasksRef.current = getTasks();
    return tasksRef.current;
  }, []);

  useEffect(() => {
    startScheduler();
    return () => {
      // 不在这里停止调度器——让其他页面继续使用
      // stopScheduler();
    };
  }, []);

  return { getTasks: refresh, tasksRef };
}

// 提交新任务到队列
export function submitTask(task: BackgroundTask) {
  const { addTask } = require('@/lib/task-queue');
  addTask(task);
  startScheduler();
}

// 取消任务
export function cancelTask(id: string) {
  updateTask(id, { status: 'failed', error: '用户取消' });
}

// 采纳当前结果并停止迭代
export function adoptAndStop(id: string) {
  const tasks = getTasks();
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.params = { ...task.params, adoptAndStop: true };
  updateTask(id, { params: task.params, label: '采纳当前结果中...' });
  saveTasksToStorage(tasks);
}

function saveTasksToStorage(tasks: BackgroundTask[]) {
  const { saveTasks } = require('@/lib/task-queue');
  saveTasks(tasks);
}

// 清理所有已完成/失败的任务
export function cleanupTasks() {
  const tasks = getTasks().filter(t => t.status === 'pending' || t.status === 'running');
  const { saveTasks } = require('@/lib/task-queue');
  saveTasks(tasks);
}
