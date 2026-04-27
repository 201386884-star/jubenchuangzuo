'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  Eraser, Loader2, Copy, Check, Download, Zap, Shield, Flame,
  Search, ArrowLeftRight, RotateCw, StopCircle, Clock,
} from 'lucide-react';
import { loadApiConfigs, getApiConfigById, type ApiConfig } from '@/lib/api-configs';
import { loadZhuqueConfig, type ZhuqueConfig } from '@/lib/zhuque-config';
import { DIALECT_TEMPLATES } from '@/lib/prompts/deai';
import { DeAIDB } from '@/lib/deai-db';
import { submitTask, cancelTask, adoptAndStop } from '@/lib/use-task-queue';
import { getTasks, newTaskId, type BackgroundTask } from '@/lib/task-queue';

type Level = 'none' | 'light' | 'medium' | 'heavy';

const LEVELS: { value: Level; label: string; icon: typeof Zap; desc: string; color: string }[] = [
  { value: 'light', label: '轻度', icon: Zap, desc: '保留90%原意，打散AI统计指纹', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  { value: 'medium', label: '中度', icon: Shield, desc: '保留75%原意，注入短剧人味', color: 'text-purple-600 bg-purple-50 border-purple-200' },
  { value: 'heavy', label: '重度', icon: Flame, desc: '保留60%核心情节，彻底重写', color: 'text-red-600 bg-red-50 border-red-200' },
];

const GENRES = ['复仇', '甜宠', '穿越', '都市', '古风', '悬疑', '职场', '校园', '玄幻', '家庭'];

interface DetectionResult {
  aiProbability: number;
  isAIGenerated: boolean;
  label: string;
}

export default function DeAIPage() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [level, setLevel] = useState<Level>('medium');
  const [dialect, setDialect] = useState('none');
  const [genre, setGenre] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [apiConfigs, setApiConfigs] = useState<ApiConfig[]>([]);
  const [selectedConfig, setSelectedConfig] = useState('');
  const [stats, setStats] = useState<{
    connectorsReplaced: number;
    sentencesModified: number;
    imperfectionsInjected: number;
    formatPreserved: number;
  } | null>(null);
  const [modifications, setModifications] = useState<string[]>([]);

  // 朱雀检测
  const [zhuqueConfig, setZhuqueConfig] = useState<ZhuqueConfig | null>(null);
  const [inputDetection, setInputDetection] = useState<DetectionResult | null>(null);
  const [outputDetection, setOutputDetection] = useState<DetectionResult | null>(null);
  const [isDetectingInput, setIsDetectingInput] = useState(false);
  const [isDetectingOutput, setIsDetectingOutput] = useState(false);

  // 任务队列
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [taskProgress, setTaskProgress] = useState(0);
  const [taskLabel, setTaskLabel] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 多轮迭代
  const [iterationMode, setIterationMode] = useState<'manual' | 'auto'>('manual');
  const [maxIterations, setMaxIterations] = useState(3);
  const [targetProbability, setTargetProbability] = useState(20);

  // 当前session（用于追踪处理过程中的轮次）
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessionRounds, setSessionRounds] = useState<{ round: number; aiProbability?: number; timestamp: string }[]>([]);

  // 展开方言描述
  const [showDialectDesc, setShowDialectDesc] = useState(false);

  // 最近历史记录数
  const [recentCount, setRecentCount] = useState(0);

  useEffect(() => {
    const configs = loadApiConfigs();
    setApiConfigs(configs);
    if (configs.length > 0 && configs[0].apiKey) {
      setSelectedConfig(configs[0].id);
    }
    setZhuqueConfig(loadZhuqueConfig());
    setRecentCount(DeAIDB.getAll().length);
  }, []);

  // 轮询任务状态
  useEffect(() => {
    if (!currentTaskId) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }

    pollRef.current = setInterval(() => {
      const tasks = getTasks();
      const task = tasks.find(t => t.id === currentTaskId);
      if (!task) return;

      setTaskProgress(task.progress);
      setTaskLabel(task.label || '');

      // 同步轮次数据
      if (currentSessionId) {
        const session = DeAIDB.getById(currentSessionId);
        if (session) {
          setSessionRounds(session.rounds.map(r => ({ round: r.round, aiProbability: r.aiProbability, timestamp: r.timestamp })));
          // 实时更新输出面板
          if (session.rounds.length > 0) {
            const latest = session.rounds[session.rounds.length - 1];
            setOutput(latest.content);
            setStats(latest.stats);
            setModifications(latest.modifications);
            if (latest.aiProbability !== undefined) {
              setOutputDetection({
                aiProbability: latest.aiProbability,
                isAIGenerated: latest.aiProbability >= 70,
                label: '',
              });
            }
          }
        }
      }

      if (task.status === 'completed') {
        // 处理完成
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        setCurrentTaskId(null);
        setTaskProgress(100);

        // 从结果中获取最终数据
        if (task.result) {
          setOutput(task.result.finalContent || '');
          if (task.result.outputAiProbability !== null && task.result.outputAiProbability !== undefined) {
            setOutputDetection({
              aiProbability: task.result.outputAiProbability,
              isAIGenerated: task.result.outputAiProbability >= 70,
              label: '',
            });
          }
        }

        // 刷新session数据
        if (currentSessionId) {
          const session = DeAIDB.getById(currentSessionId);
          if (session) {
            setOutput(session.finalContent);
            setSessionRounds(session.rounds.map(r => ({ round: r.round, aiProbability: r.aiProbability, timestamp: r.timestamp })));
            const lastRound = session.rounds[session.rounds.length - 1];
            if (lastRound) {
              setStats(lastRound.stats);
              setModifications(lastRound.modifications);
            }
          }
        }

        setRecentCount(DeAIDB.getAll().length);
      } else if (task.status === 'failed') {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        setCurrentTaskId(null);
        setError(task.error || '处理失败');
        // 标记session失败
        if (currentSessionId) DeAIDB.update(currentSessionId, { status: 'failed' });
      }
    }, 800);

    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [currentTaskId, currentSessionId]);

  // BroadcastChannel 实时监听（比轮询更快感知进度变化）
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const channel = new BroadcastChannel('deai-progress');
    channel.onmessage = (event) => {
      const data = event.data;
      if (!data || data.sessionId !== currentSessionId) return;

      if (data.type === 'phase') {
        if (data.progress !== undefined) setTaskProgress(data.progress);
        if (data.phase) setTaskLabel(data.phase);
      }

      if (data.type === 'round-complete') {
        // 立即同步最新 round 数据
        const session = DeAIDB.getById(data.sessionId);
        if (session) {
          setSessionRounds(session.rounds.map(r => ({ round: r.round, aiProbability: r.aiProbability, timestamp: r.timestamp })));
          const latest = session.rounds[session.rounds.length - 1];
          if (latest) {
            setOutput(latest.content);
            setStats(latest.stats);
            setModifications(latest.modifications);
            if (latest.aiProbability !== undefined) {
              setOutputDetection({
                aiProbability: latest.aiProbability,
                isAIGenerated: latest.aiProbability >= 70,
                label: '',
              });
            }
          }
        }
      }

      if (data.type === 'done') {
        setCurrentTaskId(null);
        setTaskProgress(100);
        const session = DeAIDB.getById(data.sessionId);
        if (session) {
          setOutput(session.finalContent);
          setSessionRounds(session.rounds.map(r => ({ round: r.round, aiProbability: r.aiProbability, timestamp: r.timestamp })));
          setRecentCount(DeAIDB.getAll().length);
        }
      }

      if (data.type === 'failed') {
        setCurrentTaskId(null);
        setError('处理失败');
      }
    };
    return () => channel.close();
  }, [currentSessionId]);

  const isProcessing = currentTaskId !== null;

  // ---- 朱雀检测 ----
  const detectContent = async (content: string, target: 'input' | 'output'): Promise<number | null> => {
    if (!zhuqueConfig?.secretId || !zhuqueConfig?.secretKey) return null;

    const setDetecting = target === 'input' ? setIsDetectingInput : setIsDetectingOutput;
    const setResult = target === 'input' ? setInputDetection : setOutputDetection;

    setDetecting(true);
    setResult(null);

    try {
      const res = await fetch('/api/detect-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          zhuqueConfig: {
            secretId: zhuqueConfig.secretId,
            secretKey: zhuqueConfig.secretKey,
            region: zhuqueConfig.region,
          },
        }),
      });

      const data = await res.json();
      if (data.success) {
        const result: DetectionResult = {
          aiProbability: data.aiProbability,
          isAIGenerated: data.isAIGenerated,
          label: data.label,
        };
        setResult(result);
        return data.aiProbability;
      }
    } catch {
      // 静默
    } finally {
      setDetecting(false);
    }
    return null;
  };

  // ---- 提交处理任务 ----
  const handleSubmitTask = async () => {
    if (!input.trim()) { setError('请输入要处理的内容'); return; }

    const config = getApiConfigById(selectedConfig);
    if (!config?.apiKey) { setError('请先在设置页面配置 API Key'); return; }

    setError('');
    setOutput('');
    setStats(null);
    setModifications([]);
    setOutputDetection(null);
    setSessionRounds([]);

    // 创建历史记录session
    const session = DeAIDB.create({
      originalContent: input,
      level,
      dialectStyle: dialect,
      genre: genre || undefined,
      apiModelName: config.name || config.model,
      enablePostProcess: true,
      iterationMode,
      maxIterations: iterationMode === 'auto' ? maxIterations : undefined,
      targetProbability: iterationMode === 'auto' ? targetProbability : undefined,
    });

    setCurrentSessionId(session.id);

    // 如果有朱雀，先检测原文
    if (hasZhuque) {
      const inputProb = await detectContent(input, 'input');
      if (inputProb !== null) {
        DeAIDB.update(session.id, { inputAiProbability: inputProb });
      }
    }

    // 提交到任务队列
    const taskId = newTaskId();
    const task: BackgroundTask = {
      id: taskId,
      type: 'deai-process',
      status: 'pending',
      progress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      label: '等待处理...',
      params: {
        sessionId: session.id,
        content: input,
        level,
        dialectStyle: dialect,
        genre: genre || undefined,
        apiConfig: { baseUrl: config.baseUrl, model: config.model, apiKey: config.apiKey },
        enablePostProcess: true,
        iterationMode,
        maxIterations: iterationMode === 'auto' ? maxIterations : 1,
        targetProbability: iterationMode === 'auto' ? targetProbability : 20,
        zhuqueConfig: hasZhuque ? {
          secretId: zhuqueConfig!.secretId,
          secretKey: zhuqueConfig!.secretKey,
          region: zhuqueConfig!.region,
        } : undefined,
      },
    };

    submitTask(task);
    setCurrentTaskId(taskId);
    setTaskProgress(0);
    setTaskLabel('等待处理...');
  };

  // ---- 停止任务 ----
  const handleStopTask = () => {
    if (currentTaskId) {
      cancelTask(currentTaskId);
      setCurrentTaskId(null);
      if (currentSessionId) DeAIDB.update(currentSessionId, { status: 'failed' });
    }
  };

  // ---- 查看某一轮结果 ----
  const viewRound = (roundNum: number) => {
    if (!currentSessionId) return;
    const session = DeAIDB.getById(currentSessionId);
    if (!session) return;
    const round = session.rounds.find(r => r.round === roundNum);
    if (!round) return;
    setOutput(round.content);
    if (round.stats) setStats(round.stats);
    setModifications(round.modifications || []);
    if (round.aiProbability !== undefined) {
      setOutputDetection({
        aiProbability: round.aiProbability,
        isAIGenerated: round.aiProbability >= 70,
        label: '',
      });
    }
  };

  // ---- 工具函数 ----
  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `剧本润色剧本_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getProbabilityColor = (prob: number) => {
    if (prob <= 20) return { text: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', label: '人类写作' };
    if (prob <= 50) return { text: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200', label: '疑似AI' };
    if (prob <= 80) return { text: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', label: '可能AI' };
    return { text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', label: 'AI生成' };
  };

  const ProbabilityBar = ({ detection, label }: { detection: DetectionResult; label: string }) => {
    const colors = getProbabilityColor(detection.aiProbability);
    return (
      <div className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${colors.bg} ${colors.border}`}>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-gray-600">{label}</span>
            <span className={`text-xs font-bold ${colors.text}`}>{colors.label}</span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                detection.aiProbability <= 20 ? 'bg-green-500' :
                detection.aiProbability <= 50 ? 'bg-yellow-500' :
                detection.aiProbability <= 80 ? 'bg-orange-500' : 'bg-red-500'
              }`}
              style={{ width: `${detection.aiProbability}%` }}
            />
          </div>
        </div>
        <div className={`text-lg font-bold ${colors.text}`}>{detection.aiProbability}%</div>
      </div>
    );
  };

  const inputChars = input.replace(/\s/g, '').length;
  const outputChars = output.replace(/\s/g, '').length;
  const hasZhuque = zhuqueConfig?.enabled && zhuqueConfig?.secretId && zhuqueConfig?.secretKey;
  const reduction = inputDetection && outputDetection
    ? inputDetection.aiProbability - outputDetection.aiProbability
    : null;

  const dialectEntries = Object.entries(DIALECT_TEMPLATES);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
            <Eraser className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">剧本润色工作台</h1>
            <p className="text-sm text-gray-500">
              短剧专用 · 三层处理引擎 · 多轮迭代
              {hasZhuque && ' · 朱雀检测已启用'}
            </p>
          </div>
        </div>
        <Link
          href="/deai/history"
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors no-underline"
        >
          <Clock className="w-4 h-4" />
          历史记录
          {recentCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">{recentCount}</span>
          )}
        </Link>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        {/* Row 1: Model, Genre, Process buttons */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">AI模型</label>
            <select value={selectedConfig} onChange={e => setSelectedConfig(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500">
              {apiConfigs.filter(c => c.apiKey).map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              {apiConfigs.filter(c => c.apiKey).length === 0 && <option value="">请先配置API</option>}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">题材</label>
            <select value={genre} onChange={e => setGenre(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500">
              <option value="">自动识别</option>
              {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">风格模板</label>
            <select value={dialect} onChange={e => setDialect(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500">
              {dialectEntries.map(([key, t]) => (
                <option key={key} value={key}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            {isProcessing ? (
              <div className="w-full px-4 py-2 rounded-lg text-sm font-medium text-amber-700 bg-amber-100 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />处理中...
              </div>
            ) : (
              <button onClick={handleSubmitTask} disabled={!input.trim()}
                className="w-full px-4 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                <Eraser className="w-4 h-4" />
                {iterationMode === 'auto' ? '自动迭代' : '单次处理'}
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Intensity */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">处理强度</label>
          <div className="flex gap-3">
            {LEVELS.map(l => {
              const Icon = l.icon;
              return (
                <button key={l.value} onClick={() => setLevel(l.value)}
                  className={`flex-1 border rounded-lg p-3 text-left transition-all ${
                    level === l.value
                      ? `${l.color} border-current ring-1 ring-current`
                      : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                  }`}>
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-4 h-4" />
                    <span className="font-medium text-sm">{l.label}</span>
                  </div>
                  <p className="text-xs opacity-75">{l.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 3: Iteration settings */}
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <RotateCw className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">多轮迭代设置</span>
            </div>
            <div className="flex items-center gap-1 bg-gray-200 rounded-lg p-0.5">
              <button onClick={() => setIterationMode('manual')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${iterationMode === 'manual' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                手动
              </button>
              <button onClick={() => setIterationMode('auto')}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${iterationMode === 'auto' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                自动
              </button>
            </div>
          </div>

          {iterationMode === 'auto' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">最大迭代轮数</label>
                <select value={maxIterations} onChange={e => setMaxIterations(Number(e.target.value))}
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30">
                  {[2, 3, 5, 8].map(n => <option key={n} value={n}>{n}轮</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">目标AI概率</label>
                <select value={targetProbability} onChange={e => setTargetProbability(Number(e.target.value))}
                  className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30">
                  {[10, 15, 20, 30, 40].map(n => <option key={n} value={n}>≤{n}%</option>)}
                </select>
              </div>
            </div>
          )}

          {iterationMode === 'manual' && (
            <p className="text-xs text-gray-400">手动模式：提交一次处理任务，后台完成后查看结果</p>
          )}
        </div>

        {/* Task progress with real-time round cards */}
        {isProcessing && (
          <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                <span className="text-sm font-medium text-amber-800">{taskLabel || '处理中...'}</span>
              </div>
              <span className="text-xs text-amber-600 font-medium">{taskProgress}%</span>
            </div>
            <div className="w-full h-2 bg-amber-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-500 transition-all duration-500"
                style={{ width: `${taskProgress}%` }}
              />
            </div>

            {/* 实时轮次卡片 */}
            {sessionRounds.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {sessionRounds.map((r) => {
                  const probColor = r.aiProbability !== undefined ? getProbabilityColor(r.aiProbability) : null;
                  const isLatest = r.round === sessionRounds[sessionRounds.length - 1].round;
                  return (
                    <div key={r.round}
                      className={`flex items-center gap-3 p-2 rounded-lg text-xs transition-all ${
                        isLatest ? 'bg-amber-100 border border-amber-300' : 'bg-white border border-gray-100'
                      }`}>
                      <span className={`font-medium w-14 ${isLatest ? 'text-amber-800' : 'text-gray-600'}`}>
                        第{r.round}轮
                      </span>
                      {r.aiProbability !== undefined && probColor && (
                        <span className={`font-bold ${probColor.text}`}>AI: {r.aiProbability}%</span>
                      )}
                      {isLatest && r.aiProbability === undefined && (
                        <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
                      )}
                      <span className="text-gray-300 ml-auto">{new Date(r.timestamp).toLocaleTimeString()}</span>
                      <button onClick={() => viewRound(r.round)}
                        className="text-amber-600 hover:text-amber-700 font-medium">查看</button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 操作按钮 */}
            <div className="mt-3 flex items-center gap-2">
              {sessionRounds.length > 0 && (
                <button onClick={() => currentTaskId && adoptAndStop(currentTaskId)}
                  className="px-3 py-1.5 rounded-lg bg-green-500 text-white text-xs font-medium hover:bg-green-600 transition-colors flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />满意了，采纳当前结果
                </button>
              )}
              <button onClick={handleStopTask}
                className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-medium hover:bg-red-600 transition-colors flex items-center gap-1.5">
                <StopCircle className="w-3.5 h-3.5" />取消
              </button>
            </div>
            <p className="text-xs text-amber-600 mt-2">任务在后台运行中，你可以切换到其他页面继续工作</p>
          </div>
        )}

        {/* Dialect description */}
        {dialect !== 'none' && DIALECT_TEMPLATES[dialect]?.desc && (
          <div className="mt-3 px-3 py-2 bg-amber-50 rounded-lg text-xs text-amber-700 border border-amber-100">
            <strong>{DIALECT_TEMPLATES[dialect].label}</strong>：{DIALECT_TEMPLATES[dialect].desc}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
      )}

      {/* Detection Summary */}
      {inputDetection && outputDetection && (
        <div className="mb-4 bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <div className="text-center">
                <div className="text-xs text-gray-400 mb-1">原文</div>
                <div className={`text-2xl font-bold ${getProbabilityColor(inputDetection.aiProbability).text}`}>
                  {inputDetection.aiProbability}%
                </div>
              </div>
              <ArrowLeftRight className="w-5 h-5 text-gray-300 shrink-0" />
              <div className="text-center">
                <div className="text-xs text-gray-400 mb-1">处理后</div>
                <div className={`text-2xl font-bold ${getProbabilityColor(outputDetection.aiProbability).text}`}>
                  {outputDetection.aiProbability}%
                </div>
              </div>
              {reduction !== null && (
                <div className="ml-4 px-3 py-1.5 rounded-lg bg-green-50 border border-green-200">
                  <span className="text-sm font-bold text-green-600">AI概率下降 {reduction}%</span>
                </div>
              )}
            </div>
            <div className="text-right">
              {outputDetection.aiProbability <= 20 ? (
                <span className="text-xs px-3 py-1.5 rounded-full bg-green-100 text-green-700 font-medium">通过检测</span>
              ) : outputDetection.aiProbability <= 50 ? (
                <span className="text-xs px-3 py-1.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">建议加大强度</span>
              ) : (
                <span className="text-xs px-3 py-1.5 rounded-full bg-red-100 text-red-700 font-medium">需要重度处理</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Editor: Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 border border-gray-200 rounded-xl overflow-hidden bg-white">
        {/* Input */}
        <div className="flex flex-col border-r border-gray-200">
          <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">原始内容</span>
              <span className="text-xs text-gray-400">{inputChars} 字</span>
            </div>
            <div className="flex items-center gap-2">
              {hasZhuque && (
                <button onClick={() => input.trim() && detectContent(input, 'input')} disabled={isDetectingInput || !input.trim()}
                  className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1 disabled:opacity-40">
                  {isDetectingInput ? <><Loader2 className="w-3 h-3 animate-spin" />检测中</> : <><Search className="w-3 h-3" />朱雀检测</>}
                </button>
              )}
              <button onClick={() => { setInput(''); setOutput(''); setStats(null); setInputDetection(null); setOutputDetection(null); setSessionRounds([]); setCurrentSessionId(null); }}
                className="text-xs text-gray-400 hover:text-gray-600">清空</button>
            </div>
          </div>
          {inputDetection && (
            <div className="px-4 py-2 border-b border-gray-100">
              <ProbabilityBar detection={inputDetection} label="朱雀AI检测" />
            </div>
          )}
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={`粘贴AI生成的短剧剧本...\n\n支持格式：\n【第1集】\n[零桢画面：xxx]\n1-1 某场景 日内\n人物：张三、李四\n▶ 动作描述\n张三（愤怒）：台词\n张三OS：内心独白\n[假卡点]`}
            className="flex-1 min-h-[480px] px-4 py-3 text-sm text-gray-800 resize-none focus:outline-none placeholder:text-gray-300 font-mono"
            spellCheck={false}
          />
        </div>

        {/* Output */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">处理结果</span>
              <span className="text-xs text-gray-400">{outputChars} 字</span>
              {output && inputChars > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  Math.abs(outputChars - inputChars) / inputChars < 0.2 ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'
                }`}>
                  {outputChars > inputChars ? '+' : ''}{((outputChars - inputChars) / inputChars * 100).toFixed(0)}%
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {output && hasZhuque && (
                <button onClick={() => detectContent(output, 'output')} disabled={isDetectingOutput}
                  className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1 disabled:opacity-40">
                  {isDetectingOutput ? <><Loader2 className="w-3 h-3 animate-spin" />检测中</> : <><Search className="w-3 h-3" />朱雀检测</>}
                </button>
              )}
              {output && (
                <>
                  <button onClick={handleCopy} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                    {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copied ? '已复制' : '复制'}
                  </button>
                  <button onClick={handleDownload} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                    <Download className="w-3 h-3" />导出
                  </button>
                </>
              )}
            </div>
          </div>
          {outputDetection && (
            <div className="px-4 py-2 border-b border-gray-100">
              <ProbabilityBar detection={outputDetection} label="朱雀AI检测" />
            </div>
          )}
          <div className="flex-1 min-h-[480px] px-4 py-3 overflow-auto">
            {isProcessing && !output ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin mb-3" />
                <p className="text-sm">{taskLabel || '正在剧本润色...'}</p>
                <p className="text-xs mt-1">任务在后台运行中，可以切换页面</p>
              </div>
            ) : output ? (
              <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono leading-relaxed">{output}</pre>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-300">
                <Eraser className="w-12 h-12 mb-3 opacity-30" />
                <p className="text-sm">处理结果将显示在这里</p>
                <p className="text-xs mt-1">提交任务后自动在后台处理，完成后自动显示</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Panel */}
      {stats && (
        <div className="mt-4 bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-medium text-gray-700 mb-3">处理统计</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{stats.connectorsReplaced}</div>
              <div className="text-xs text-blue-500 mt-0.5">连接词替换</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{stats.formatPreserved}</div>
              <div className="text-xs text-purple-500 mt-0.5">格式标记保留</div>
            </div>
            <div className="text-center p-3 bg-amber-50 rounded-lg">
              <div className="text-2xl font-bold text-amber-600">{stats.imperfectionsInjected}</div>
              <div className="text-xs text-amber-500 mt-0.5">不完美注入</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{level === 'light' ? '轻度' : level === 'medium' ? '中度' : '重度'}</div>
              <div className="text-xs text-green-500 mt-0.5">处理强度</div>
            </div>
          </div>
          {modifications.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {modifications.map((mod, i) => (
                <span key={i} className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">{mod}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tips */}
      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-5">
        <h3 className="text-sm font-medium text-amber-800 mb-2">剧本润色原理</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs text-amber-700">
          <div>
            <strong>第一层：LLM语义改写</strong>
            <p className="mt-1 opacity-80">专业短剧编辑Prompt改写台词、注入风格模板</p>
          </div>
          <div>
            <strong>第二层：统计后处理</strong>
            <p className="mt-1 opacity-80">代码精确控制连接词替换、句长随机化</p>
          </div>
          <div>
            <strong>第三层：格式保护</strong>
            <p className="mt-1 opacity-80">零桢画面、▶动作线、OS等标记100%保留</p>
          </div>
          <div>
            <strong>多轮迭代</strong>
            <p className="mt-1 opacity-80">自动检测→反馈→提升强度重跑，直到达标</p>
          </div>
        </div>
      </div>
    </div>
  );
}
