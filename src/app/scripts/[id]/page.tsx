'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Edit3, Save, X, Trash2, Plus, Film,
  ChevronDown, ChevronRight, Loader2, Copy, FileText, Sparkles,
  CheckCircle, AlertCircle, Star, Download, RefreshCw, GitCompare, Pencil, Wand2, Shield, Upload
} from 'lucide-react';
import { OutlineDB, ScriptDB, EvaluationDB } from '@/lib/db';
import { loadApiConfigs, getApiConfigById, type ApiConfig } from '@/lib/api-configs';
import { loadZhuqueConfig } from '@/lib/zhuque-config';
import { addTask, newTaskId, getTasks, updateTask, removeTask } from '@/lib/task-queue';
// 确保后台任务处理器和调度器被加载
import '@/lib/use-task-queue';
import type { StoryOutline, Script, EpisodeScript, Genre, Platform, ScriptEvaluation } from '@/types';

export default function ScriptDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [outline, setOutline] = useState<StoryOutline | null>(null);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditingOutline, setIsEditingOutline] = useState(false);
  const [editDraft, setEditDraft] = useState('');
  const [editingTitle, setEditingTitle] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [expandedScript, setExpandedScript] = useState<string | null>(null);
  const [expandedEpisode, setExpandedEpisode] = useState<number | null>(null);
  const [batchDetecting, setBatchDetecting] = useState(false);
  const [apiConfigs, setApiConfigs] = useState<ApiConfig[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [evaluations, setEvaluations] = useState<Record<string, ScriptEvaluation>>({});

  // Episode editing state
  const [editingEpisode, setEditingEpisode] = useState<{ scriptId: string; epNumber: number } | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editPaymentHook, setEditPaymentHook] = useState('');

  // Regeneration state
  const [regeneratingFrom, setRegeneratingFrom] = useState<{ scriptId: string; fromEp: number } | null>(null);
  const [regeneratingSingle, setRegeneratingSingle] = useState<{ scriptId: string; epNum: number } | null>(null);
  const [regenConfig, setRegenConfig] = useState('');

  // Comparison state
  const [compareMode, setCompareMode] = useState(false);
  const [compareScripts, setCompareScripts] = useState<[string, string] | null>(null);
  const [compareEpisode, setCompareEpisode] = useState(1);

  // Evaluation loading
  const [evaluatingScript, setEvaluatingScript] = useState<string | null>(null);

  // DeAI per-episode
  const [deaiEpisode, setDeaiEpisode] = useState<{ scriptId: string; epNumber: number } | null>(null);
  const [deaiLevel, setDeaiLevel] = useState('medium');

  // Per-episode AI detection
  const [detectingEpisode, setDetectingEpisode] = useState<{ scriptId: string; epNumber: number } | null>(null);
  const [episodeAiResults, setEpisodeAiResults] = useState<Record<string, { probability: number; decision: string; isAIGenerated: boolean }>>({});

  // Batch generation state
  const [batchGenScript, setBatchGenScript] = useState<string | null>(null);
  const [batchStartFrom, setBatchStartFrom] = useState(1);
  const [batchCount, setBatchCount] = useState(5);
  const [batchGuidance, setBatchGuidance] = useState('');
  const [batchConfig, setBatchConfig] = useState('');

  // Import modal state
  const [importModal, setImportModal] = useState<string | null>(null); // scriptId
  const [importMode, setImportMode] = useState<'script' | 'synopsis'>('script');
  const [importText, setImportText] = useState('');
  const [importPreview, setImportPreview] = useState<{ parsed: any[]; errors: string[] } | null>(null);
  const [importLoading, setImportLoading] = useState(false);

  // Streaming state - real-time content display
  const [streamingContent, setStreamingContent] = useState<Record<number, string>>({});
  const [streamingEpisode, setStreamingEpisode] = useState<number | null>(null);
  const [streamingTaskId, setStreamingTaskId] = useState<string | null>(null);
  const [batchJustCompleted, setBatchJustCompleted] = useState<string | null>(null); // scriptId of completed batch

  // 大纲标题编辑
  const [editingOutlineTitle, setEditingOutlineTitle] = useState(false);
  const [outlineTitleDraft, setOutlineTitleDraft] = useState('');

  // Recover running task state on page load (for when user navigates away and comes back)
  const [recoveredRunningTask, setRecoveredRunningTask] = useState<{
    taskId: string; currentEpisode: number; totalEpisodes: number; progress: number; label: string;
  } | null>(null);

  const handleDeaiEpisode = (scriptId: string, ep: EpisodeScript) => {
    if (apiConfigs.length === 0) { alert('请先在设置页面配置 API'); return; }
    const config = apiConfigs[0];
    const zhuqueConfig = loadZhuqueConfig();
    addTask({
      id: newTaskId(),
      type: 'deai-process',
      status: 'pending',
      progress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      params: {
        sessionId: `script-${scriptId}-ep${ep.episodeNumber}`,
        content: ep.content,
        level: deaiLevel,
        apiConfig: config,
        enablePostProcess: true,
        iterationMode: 'auto',
        maxIterations: 3,
        targetProbability: 20,
        zhuqueConfig: zhuqueConfig.enabled ? zhuqueConfig : undefined,
      },
      label: `[${outline?.title || '剧本'}] 第${ep.episodeNumber}集剧本润色 - 等待处理...`,
    });
    setDeaiEpisode(null);
    if (confirm('已提交剧本润色任务到后台，是否前往剧本润色页面查看进度？')) router.push('/deai');
  };

  const handleDetectAI = async (scriptId: string, ep: EpisodeScript) => {
    const zhuqueConfig = loadZhuqueConfig();
    if (!zhuqueConfig.enabled || !zhuqueConfig.secretId || !zhuqueConfig.secretKey || !zhuqueConfig.bizType) {
      alert('请先在设置页面配置并启用朱雀AI检测');
      return;
    }
    const key = `${scriptId}-${ep.episodeNumber}`;
    setDetectingEpisode({ scriptId, epNumber: ep.episodeNumber });
    try {
      const res = await fetch('/api/detect-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: ep.content, zhuqueConfig }),
      });
      const data = await res.json();
      if (data.success) {
        setEpisodeAiResults(prev => ({
          ...prev,
          [key]: { probability: data.aiProbability, decision: data.decision, isAIGenerated: data.isAIGenerated },
        }));
      } else {
        alert(data.error || '检测失败');
      }
    } catch {
      alert('检测请求失败');
    } finally {
      setDetectingEpisode(null);
    }
  };

  // Batch generation handler
  const handleBatchGenerate = (scriptId: string) => {
    const script = scripts.find(s => s.id === scriptId);
    if (!script || !outline) return;
    const config = apiConfigs.find(c => c.id === (batchConfig || apiConfigs[0]?.id));
    if (!config) { alert('请先在设置页面配置 API'); return; }

    const startFrom = batchStartFrom;
    const endAt = Math.min(batchStartFrom + batchCount - 1, script.totalEpisodes);
    const existingEpisodes = script.episodes.filter(ep => ep.episodeNumber < startFrom);
    const prevEp = existingEpisodes.length > 0 ? existingEpisodes[existingEpisodes.length - 1] : null;

    addTask({
      id: newTaskId(),
      type: 'generate-script',
      status: 'pending',
      progress: 0,
      totalEpisodes: script.totalEpisodes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      params: {
        apiConfig: config,
        outline,
        totalEpisodes: script.totalEpisodes,
        platform: script.platform,
        scriptIndex: 1,
        totalScripts: 1,
        startFrom,
        endAt,
        userGuidance: batchGuidance || undefined,
        existingEpisodes,
        previousSummary: prevEp?.summary,
        _scriptId: scriptId,
      },
      scriptIndex: 1,
      totalScripts: 1,
      label: `[${outline?.title || '剧本'}] 生成第${startFrom}-${endAt}集 (${batchGuidance ? '含方向建议' : '自动'})`,
    });

    setBatchGenScript(null);
    setBatchGuidance('');
  };

  // Continue generating from last episode
  const handleContinueGenerate = (script: Script) => {
    const lastEp = script.episodes.length;
    setBatchGenScript(script.id);
    setBatchStartFrom(lastEp + 1);
    setBatchCount(5);
  };

  const loadData = useCallback(() => {
    setIsLoading(true);
    const o = OutlineDB.getById(id);
    setOutline(o);
    let s = ScriptDB.getByOutlineId(id);

    // 如果没有剧本且有大纲，自动创建一个空剧本
    if (s.length === 0 && o) {
      const title = o.title || o.logline?.substring(0, 30) || '新方案';
      const totalEpisodes = o.episodeOutlines?.length || 50;
      const newScript = ScriptDB.create(id, title, 'ReelShort', totalEpisodes);
      ScriptDB.update(newScript.id, { status: 'draft' });
      s = ScriptDB.getByOutlineId(id);
      // 自动展开并显示批量生成面板
      if (s.length > 0) {
        setExpandedScript(s[0].id);
        setBatchGenScript(s[0].id);
        setBatchStartFrom(1);
        setBatchCount(5);
      }
    }

    setScripts(s);

    const evals: Record<string, ScriptEvaluation> = {};
    s.forEach(script => {
      const scriptEvals = EvaluationDB.getByScriptId(script.id);
      if (scriptEvals.length > 0) {
        evals[script.id] = scriptEvals[scriptEvals.length - 1];
      }
    });
    setEvaluations(evals);
    setIsLoading(false);
  }, [id]);

  useEffect(() => {
    loadData();
    const configs = loadApiConfigs();
    setApiConfigs(configs);
    if (configs.length > 0) {
      setRegenConfig(configs[0].id);
    }
  }, [loadData]);

  // On mount: recover running task state (handles page re-entry during generation)
  useEffect(() => {
    const checkRunning = () => {
      const allTasks = getTasks();
      // 只查找属于当前剧本的运行中任务
      const running = allTasks.find(t => t.type === 'generate-script' && t.status === 'running' && t.params?._scriptId === id);
      // Only show recovered state when we don't have active streaming content
      if (running && !streamingEpisode && Object.keys(streamingContent).length === 0) {
        setRecoveredRunningTask({
          taskId: running.id,
          currentEpisode: running.currentEpisode || 0,
          totalEpisodes: running.totalEpisodes || 0,
          progress: running.progress || 0,
          label: running.label || '生成中...',
        });
        // Auto-expand linked script
        const linkedScriptId = running.params?._scriptId;
        if (linkedScriptId) setExpandedScript(linkedScriptId);
      } else if (!running) {
        setRecoveredRunningTask(null);
      }
    };
    checkRunning();
    const interval = setInterval(checkRunning, 2000);
    return () => clearInterval(interval);
  }, [streamingEpisode, streamingContent]);

  // Listen to script-stream BroadcastChannel for real-time tokens
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const channel = new BroadcastChannel('script-stream');

    channel.onmessage = (event) => {
      const data = event.data;
      if (data.type === 'episode-start') {
        setStreamingEpisode(data.episodeNumber);
        setStreamingTaskId(data.taskId);
        setRecoveredRunningTask(null); // Clear recovery once real streaming starts
        setStreamingContent(prev => ({ ...prev, [data.episodeNumber]: '' }));
        // Auto-expand the script card that is generating（只在当前剧本页面展开）
        if (data.taskId) {
          const runningTask = getTasks().find(t => t.id === data.taskId);
          if (runningTask?.params?._scriptId === id) {
            setExpandedScript(runningTask.params._scriptId);
          }
        }
      } else if (data.type === 'token' && data.episodeNumber != null) {
        setStreamingContent(prev => ({
          ...prev,
          [data.episodeNumber]: (prev[data.episodeNumber] || '') + data.content,
        }));
      } else if (data.type === 'episode-done') {
        loadData();
        setStreamingContent(prev => {
          const next = { ...prev };
          delete next[data.episodeNumber];
          return next;
        });
        setTimeout(() => {
          setStreamingContent(current => {
            if (Object.keys(current).length === 0) {
              setStreamingEpisode(null);
              setStreamingTaskId(null);
              // Check if there's a completed script that still needs more episodes
              if (data.taskId) {
                const completedTask = getTasks().find(t => t.id === data.taskId);
                if (completedTask?.params?._scriptId) {
                  setBatchJustCompleted(completedTask.params._scriptId);
                }
              }
            }
            return current;
          });
        }, 500);
      }
    };

    return () => channel.close();
  }, [loadData]);

  // Poll task queue: save completed generate-script results to ScriptDB
  useEffect(() => {
    const interval = setInterval(() => {
      const allTasks = getTasks();
      allTasks.filter(t => t.type === 'generate-script' && t.status === 'completed' && t.result).forEach(task => {
        const resultScript = task.result;
        // Match by _scriptId (set when submitting from this page)
        const linkedScriptId = task.params?._scriptId;
        if (linkedScriptId) {
          const existingScript = ScriptDB.getById(linkedScriptId);
          if (existingScript) {
            // Merge new episodes into existing script
            const merged = [...(existingScript.episodes || [])];
            for (const ep of resultScript.episodes) {
              const idx = merged.findIndex((e: any) => e.episodeNumber === ep.episodeNumber);
              if (idx >= 0) merged[idx] = ep;
              else merged.push(ep);
            }
            merged.sort((a: any, b: any) => a.episodeNumber - b.episodeNumber);
            ScriptDB.update(linkedScriptId, {
              episodes: merged,
              status: 'complete',
              generatedUpTo: resultScript.generatedUpTo || Math.max(...merged.map((e: any) => e.episodeNumber)),
            });
          }
        } else {
          // Fallback: find by outline id + title（仅更新已存在的方案，不创建新的）
          const existingScript = ScriptDB.getByOutlineId(id).find(s => s.title === resultScript.title);
          if (existingScript) {
            const merged = [...existingScript.episodes];
            for (const ep of resultScript.episodes) {
              const idx = merged.findIndex(e => e.episodeNumber === ep.episodeNumber);
              if (idx >= 0) merged[idx] = ep;
              else merged.push(ep);
            }
            merged.sort((a, b) => a.episodeNumber - b.episodeNumber);
            ScriptDB.update(existingScript.id, {
              episodes: merged,
              status: 'complete',
              generatedUpTo: resultScript.generatedUpTo || Math.max(...merged.map(e => e.episodeNumber)),
            });
          }
        }
        removeTask(task.id);
        loadData();
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [id, loadData]);

  // ---- Outline editing ----
  const handleSaveOutline = () => {
    if (!outline) return;
    try {
      const parsed = JSON.parse(editDraft);
      OutlineDB.update(outline.id, { ...parsed, genre: parsed.genre || outline.genre, paymentPoints: parsed.paymentPoints || outline.paymentPoints });
      loadData();
      setIsEditingOutline(false);
    } catch { alert('JSON 格式错误，请检查后重试'); }
  };

  const startEditOutline = () => {
    if (!outline) return;
    setEditDraft(JSON.stringify(outline, null, 2));
    setIsEditingOutline(true);
  };

  // ---- Script management ----
  const handleRenameScript = (scriptId: string) => {
    if (!titleDraft.trim()) return;
    ScriptDB.update(scriptId, { title: titleDraft.trim() });
    setEditingTitle(null);
    loadData();
  };

  const handleDeleteScript = (scriptId: string) => {
    if (!confirm('确定删除此方案？')) return;
    ScriptDB.delete(scriptId);
    if (expandedScript === scriptId) setExpandedScript(null);
    loadData();
  };

  const handleDuplicateScript = (script: Script) => {
    ScriptDB.create(outline!.id, script.title + ' (副本)', script.platform, script.totalEpisodes);
    const all = ScriptDB.getByOutlineId(outline!.id);
    const dup = all[all.length - 1];
    if (dup) ScriptDB.update(dup.id, { episodes: script.episodes, status: script.status, aiFlavorLevel: script.aiFlavorLevel });
    loadData();
  };

  const handleBatchDetectAI = async () => {
    if (!expandedScript || batchDetecting) return;
    const script = scripts.find(s => s.id === expandedScript);
    if (!script) return;
    const zhuqueConfig = loadZhuqueConfig();
    if (!zhuqueConfig?.enabled || !zhuqueConfig?.secretId || !zhuqueConfig?.secretKey) {
      alert('请先在设置页面配置朱雀AI检测');
      return;
    }
    setBatchDetecting(true);
    const episodes = script.episodes.filter(ep => ep.content);
    for (const ep of episodes) {
      try {
        const res = await fetch('/api/detect-ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: ep.content, zhuqueConfig }),
        });
        const data = await res.json();
        if (data.success) {
          const aiKey = `${script.id}-${ep.episodeNumber}`;
          setEpisodeAiResults(prev => ({
            ...prev,
            [aiKey]: {
              probability: data.aiProbability,
              decision: data.decision,
              isAIGenerated: data.aiProbability > 50,
            },
          }));
        }
      } catch { /* skip failed episodes */ }
    }
    setBatchDetecting(false);
  };

  // ---- Episode editing ----
  const startEditEpisode = (scriptId: string, ep: EpisodeScript) => {
    setEditingEpisode({ scriptId, epNumber: ep.episodeNumber });
    setEditContent(ep.content);
    setEditPaymentHook(ep.paymentHook);
  };

  const saveEditEpisode = () => {
    if (!editingEpisode) return;
    const script = scripts.find(s => s.id === editingEpisode.scriptId);
    if (!script) return;
    const updatedEpisodes = script.episodes.map(ep =>
      ep.episodeNumber === editingEpisode.epNumber
        ? { ...ep, content: editContent, paymentHook: editPaymentHook }
        : ep
    );
    ScriptDB.update(editingEpisode.scriptId, { episodes: updatedEpisodes });
    setEditingEpisode(null);
    loadData();
  };

  // ---- Regeneration from episode ----
  const startRegenerate = (scriptId: string, fromEp: number) => {
    setRegeneratingFrom({ scriptId, fromEp });
  };

  const confirmRegenerate = () => {
    if (!regeneratingFrom || !outline) return;
    const config = apiConfigs.find(c => c.id === regenConfig);
    if (!config) return;
    const script = scripts.find(s => s.id === regeneratingFrom.scriptId);
    if (!script) return;
    const guidanceInput = document.getElementById('regen-guidance') as HTMLTextAreaElement;
    const userGuidance = guidanceInput?.value?.trim() || undefined;

    // Keep episodes before the regeneration point
    const keptEpisodes = script.episodes.filter(ep => ep.episodeNumber < regeneratingFrom.fromEp);
    const previousSummary = keptEpisodes.length > 0 ? keptEpisodes[keptEpisodes.length - 1].summary : '';

    addTask({
      id: newTaskId(), type: 'generate-script', status: 'pending', progress: 0,
      totalEpisodes: script.totalEpisodes,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      params: {
        apiConfig: config, outline, totalEpisodes: script.totalEpisodes, platform: script.platform,
        scriptIndex: 1, totalScripts: 1, startFromEpisode: regeneratingFrom.fromEp,
        existingEpisodes: keptEpisodes, previousSummary,
        _scriptId: regeneratingFrom.scriptId,
        userGuidance,
      },
      scriptIndex: 1, totalScripts: 1,
      label: `[${outline?.title || '剧本'}] 从第${regeneratingFrom.fromEp}集重新生成...`,
    });

    setRegeneratingFrom(null);
    if (confirm('已提交重新生成任务，前往首页查看进度？')) router.push('/');
  };

  // ---- Regenerate single episode ----
  const handleRegenerateSingle = (scriptId: string, epNum: number) => {
    setRegeneratingSingle({ scriptId, epNum });
  };

  const confirmRegenerateSingle = () => {
    if (!regeneratingSingle || !outline) return;
    const config = apiConfigs.find(c => c.id === (batchConfig || apiConfigs[0]?.id));
    if (!config) { alert('请先在设置页面配置 API'); return; }
    const script = scripts.find(s => s.id === regeneratingSingle.scriptId);
    if (!script) return;
    const guidanceInput = document.getElementById('single-regen-guidance') as HTMLTextAreaElement;
    const userGuidance = guidanceInput?.value?.trim() || undefined;

    const existingEpisodes = script.episodes.filter(ep => ep.episodeNumber !== regeneratingSingle.epNum);
    const prevEp = script.episodes.find(ep => ep.episodeNumber === regeneratingSingle.epNum - 1)
      || existingEpisodes.filter(ep => ep.episodeNumber < regeneratingSingle.epNum).pop();

    addTask({
      id: newTaskId(), type: 'generate-script', status: 'pending', progress: 0,
      totalEpisodes: script.totalEpisodes,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      params: {
        apiConfig: config, outline, totalEpisodes: script.totalEpisodes, platform: script.platform,
        scriptIndex: 1, totalScripts: 1,
        startFrom: regeneratingSingle.epNum, endAt: regeneratingSingle.epNum,
        existingEpisodes,
        previousSummary: prevEp?.summary || '',
        _scriptId: regeneratingSingle.scriptId,
        _replaceEpisodes: true,
        userGuidance,
      },
      scriptIndex: 1, totalScripts: 1,
      label: `[${outline?.title || '剧本'}] 重新生成第${regeneratingSingle.epNum}集`,
    });

    setRegeneratingSingle(null);
    alert('已提交重新生成第' + regeneratingSingle.epNum + '集任务');
  };

  // ---- Evaluation ----
  const handleEvaluate = async (scriptId: string) => {
    const script = scripts.find(s => s.id === scriptId);
    if (!script || apiConfigs.length === 0) return;
    const config = apiConfigs[0];
    setEvaluatingScript(scriptId);

    try {
      const res = await fetch('/api/evaluate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script, platform: script.platform, apiConfig: config }),
      });
      const data = await res.json();
      if (data.success && data.evaluation) {
        EvaluationDB.create(scriptId, {
          scriptId,
          overallScore: data.evaluation.overallScore,
          dimensionScores: data.evaluation.dimensionScores,
          strengths: data.evaluation.strengths || [],
          weaknesses: data.evaluation.weaknesses || [],
          improvementSuggestions: data.evaluation.improvementSuggestions || [],
          marketPositioning: data.evaluation.marketPositioning || '',
        });
        loadData();
      } else {
        alert(data.error || '评估失败');
      }
    } catch (err) {
      alert('评估请求失败');
    } finally {
      setEvaluatingScript(null);
    }
  };

  // ---- Export ----
  const handleExportScript = (script: Script) => {
    const title = outline?.title || '剧本';
    const header = `剧名：${title}\n类型：${getGenre(outline!)}\n平台：${script.platform}\n集数：${script.totalEpisodes}\n\n`;
    const outlineSection = outline?.synopsis ? `【故事梗概】\n${outline.synopsis}\n\n` : '';
    const content = header + outlineSection + `═══════════════════════════\n\n` +
      script.episodes.map((ep) =>
        `【第${ep.episodeNumber}集】${ep.scene ? ` · ${ep.scene}` : ''} · ${ep.timeOfDay || ''}\n\n${ep.content}\n\n【第${ep.episodeNumber}集完】\n\n【付费钩子】${ep.paymentHook}\n`
      ).join('\n═══════════════════════════\n\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `${title}_${script.title || '方案'}_${Date.now()}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  // ---- Import ----
  const handleImportPreview = () => {
    const text = importText.trim();
    if (!text) { alert('请输入内容或上传文件'); return; }

    const errors: string[] = [];

    if (importMode === 'script') {
      // 解析剧本格式：支持【第X集】或 第X集 开头，【第X集完】或 第X集完 结尾
      const episodeBlocks: { episodeNumber: number; content: string }[] = [];
      // 用正则匹配集数分隔
      const regex = /(?:【?第\s*(\d+)\s*集[】　 ]*|(?<=\n)\s*(\d+)[-　](?=\s))/g;
      const rawBlocks = text.split(/(?=【?第\s*\d+\s*集)/);
      for (const block of rawBlocks) {
        const numMatch = block.match(/第\s*(\d+)\s*集/);
        if (!numMatch) continue;
        const epNum = parseInt(numMatch[1]);
        // 去掉结尾的【第X集完】标记
        const content = block
          .replace(/【?\s*第\s*\d+\s*集\s*完\s*】?\s*$/g, '')
          .replace(/【?\s*第\s*\d+\s*集\s*】?\s*/, '')
          .trim();
        if (!content) { errors.push(`第${epNum}集内容为空`); continue; }
        episodeBlocks.push({ episodeNumber: epNum, content });
      }

      if (episodeBlocks.length === 0) {
        errors.push('未识别到任何集数，请确保使用【第X集】或 第X集 格式标记');
      }

      setImportPreview({ parsed: episodeBlocks, errors });
    } else {
      // 解析分集概述格式
      let data: any[] = [];
      const trimmed = text.trim();

      // 尝试 JSON 格式
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        try { data = JSON.parse(trimmed); } catch { errors.push('JSON 格式解析失败，请检查语法'); }
      } else {
        // 尝试 TSV/CSV 格式：集数\t标题\t梗概\t核心事件\t情绪节拍
        const lines = trimmed.split('\n').filter(l => l.trim());
        for (const line of lines) {
          // 支持制表符或逗号分隔
          const parts = line.includes('\t') ? line.split('\t') : line.split(/[,，]/);
          if (parts.length < 3) { errors.push(`行解析失败: ${line.substring(0, 30)}`); continue; }
          const epNum = parseInt(parts[0].replace(/第/g, '').trim());
          if (isNaN(epNum)) { errors.push(`集数解析失败: ${parts[0]}`); continue; }
          data.push({
            episodeNumber: epNum,
            title: parts[1]?.trim() || '',
            synopsis: parts[2]?.trim() || '',
            keyEvent: parts[3]?.trim() || '',
            emotionalBeat: parts[4]?.trim() || '',
          });
        }
      }

      if (data.length === 0 && errors.length === 0) {
        errors.push('未识别到任何分集概述，请使用 JSON 格式或 TSV/CSV 格式（集数,标题,梗概,核心事件,情绪节拍）');
      }

      setImportPreview({ parsed: data, errors });
    }
    setImportLoading(false);
  };

  const handleImportConfirm = () => {
    if (!importPreview || importPreview.parsed.length === 0) { alert('没有可导入的内容'); return; }
    const script = scripts.find(s => s.id === importModal);
    if (!script || !outline) { alert('剧本不存在'); return; }

    if (importMode === 'script') {
      // 导入剧本内容到剧本
      for (const ep of importPreview.parsed as { episodeNumber: number; content: string }[]) {
        const existingIdx = script.episodes.findIndex(e => e.episodeNumber === ep.episodeNumber);
        // 从内容中提取场景（第一个换行前的部分）
        const firstLine = ep.content.split('\n')[0]?.trim() || '';
        const scene = firstLine.replace(/^\d+-\d+\s*/, '').replace(/[日夜内外晨昏]+$/, '').trim() || '场景待定';
        const timeOfDay = ep.content.includes('夜内') || ep.content.includes('夜外') ? '夜内'
          : ep.content.includes('晨') ? '晨'
          : ep.content.includes('昏') ? '昏'
          : ep.content.includes('日外') ? '日外'
          : '日内';

        const episodeScript: EpisodeScript = {
          episodeNumber: ep.episodeNumber,
          scene,
          timeOfDay: timeOfDay as any,
          content: ep.content,
          paymentHook: '查看本集悬念',
          summary: `第${ep.episodeNumber}集：${ep.content.substring(0, 200).replace(/\n/g, ' ')}`,
          isComplete: true,
        };

        if (existingIdx >= 0) {
          script.episodes[existingIdx] = episodeScript;
        } else {
          script.episodes.push(episodeScript);
        }
      }
      script.episodes.sort((a, b) => a.episodeNumber - b.episodeNumber);
      script.updatedAt = new Date() as any;
      ScriptDB.update(script.id, script);
      loadData();
      alert(`成功导入 ${importPreview.parsed.length} 集剧本`);
    } else {
      // 导入分集概述到大纲
      const synopses = importPreview.parsed as any[];
      const existingOutlines = outline.episodeOutlines || [];
      for (const s of synopses) {
        const idx = existingOutlines.findIndex((o: any) => o.episodeNumber === s.episodeNumber);
        if (idx >= 0) {
          existingOutlines[idx] = { ...existingOutlines[idx], ...s };
        } else {
          existingOutlines.push(s);
        }
      }
      existingOutlines.sort((a: any, b: any) => a.episodeNumber - b.episodeNumber);
      outline.episodeOutlines = existingOutlines;
      OutlineDB.update(outline.id, outline as any);
      loadData();
      alert(`成功导入 ${synopses.length} 集分集概述`);
    }

    setImportModal(null);
    setImportText('');
    setImportPreview(null);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setImportText(text);
      // 自动触发预览
      setTimeout(() => {
        const fakeEvent = { preventDefault: () => {} } as any;
        setImportText(text);
        handleImportPreview();
      }, 100);
    };
    reader.readAsText(file);
    e.target.value = '';
  };
  const formatDate = (d: Date) => {
    const date = new Date(d);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };
  const getGenre = (o: StoryOutline) => Array.isArray(o.genre) ? o.genre.join(' / ') : o.genre;
  const getStatusLabel = (s: Script) => ({ draft: '草稿', generating: '生成中', complete: '已完成', evaluated: '已评估' }[s.status] || s.status);
  const getStatusColor = (status: string) => ({ draft: 'bg-gray-100 text-gray-600', generating: 'bg-yellow-50 text-yellow-600', complete: 'bg-green-50 text-green-600', evaluated: 'bg-blue-50 text-blue-600' }[status] || 'bg-gray-100 text-gray-600');

  const getScriptById = (scriptId: string) => scripts.find(s => s.id === scriptId);
  const getEpisodeContent = (scriptId: string, epNum: number) => {
    const s = scripts.find(sc => sc.id === scriptId);
    return s?.episodes.find(ep => ep.episodeNumber === epNum) || null;
  };

  if (isLoading) return <div className="flex items-center justify-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-gray-400" /></div>;
  if (!outline) return <div className="p-8 max-w-4xl mx-auto text-center py-20"><p className="text-gray-500 mb-4">项目不存在</p><button onClick={() => router.push('/scripts')} className="text-purple-600 text-sm hover:underline">返回我的剧本</button></div>;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push('/scripts')} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          {editingOutlineTitle ? (
            <form className="flex items-center gap-2" onSubmit={(e) => {
              e.preventDefault();
              if (outlineTitleDraft.trim()) {
                OutlineDB.update(id, { title: outlineTitleDraft.trim() });
                loadData();
              }
              setEditingOutlineTitle(false);
            }}>
              <input
                autoFocus
                value={outlineTitleDraft}
                onChange={(e) => setOutlineTitleDraft(e.target.value)}
                className="text-2xl font-bold text-gray-900 border border-purple-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-purple-200 flex-1"
                onKeyDown={(e) => { if (e.key === 'Escape') setEditingOutlineTitle(false); }}
                maxLength={50}
              />
              <button type="submit" className="text-xs text-purple-600 hover:underline shrink-0">保存</button>
              <button type="button" onClick={() => setEditingOutlineTitle(false)} className="text-xs text-gray-400 hover:underline shrink-0">取消</button>
            </form>
          ) : (
            <h1
              className="text-2xl font-bold text-gray-900 cursor-pointer hover:text-purple-600 transition-colors"
              onClick={() => { setEditingOutlineTitle(true); setOutlineTitleDraft(outline.title || outline.userInput.slice(0, 30)); }}
              title="点击编辑标题"
            >
              {outline.title || outline.userInput.slice(0, 30)}
            </h1>
          )}
          <p className="text-sm text-gray-500 mt-1"><span className="mr-3">{getGenre(outline)}</span><span>{formatDate(outline.createdAt)}</span></p>
        </div>
        {scripts.length >= 2 && (
          <button
            onClick={() => { setCompareMode(!compareMode); if (!compareScripts && scripts.length >= 2) setCompareScripts([scripts[0].id, scripts[1].id]); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${compareMode ? 'bg-purple-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            <GitCompare className="w-3.5 h-3.5" />方案对比
          </button>
        )}
      </div>

      {/* Outline Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">故事大纲</h2>
          <div className="flex items-center gap-2">
            {isEditingOutline ? (
              <>
                <button onClick={handleSaveOutline} className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 transition-colors"><Save className="w-3.5 h-3.5" />保存</button>
                <button onClick={() => setIsEditingOutline(false)} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition-colors"><X className="w-3.5 h-3.5" />取消</button>
              </>
            ) : (
              <button onClick={startEditOutline} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 transition-colors"><Edit3 className="w-3.5 h-3.5" />编辑大纲</button>
            )}
          </div>
        </div>
        <div className="p-5">
          {isEditingOutline ? (
            <div>
              <p className="text-xs text-gray-500 mb-2">以 JSON 格式编辑大纲内容：</p>
              <textarea value={editDraft} onChange={(e) => setEditDraft(e.target.value)} className="w-full h-96 p-4 border border-gray-200 rounded-lg text-xs font-mono resize-y focus:outline-none focus:border-purple-300" />
            </div>
          ) : (
            <div className="space-y-4">
              {outline.synopsis && <div><h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">故事梗概</h3><p className="text-sm text-gray-700">{outline.synopsis}</p></div>}
              {outline.logline && <div><h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Logline</h3><p className="text-sm text-gray-700">{outline.logline}</p></div>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(outline.characters).map(([role, char]) =>
                  char && char.name ? (
                    <div key={role} className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-purple-600 font-medium mb-1">{role === 'protagonist' ? '主角' : role === 'antagonist' ? '反派' : role === 'supporter' ? '助攻' : role === 'loveInterest' ? '感情线' : role === 'secondaryVillain' ? '二号反派' : role === 'mentor' ? '导师' : role}</p>
                      <p className="text-sm font-medium text-gray-900">{char.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{char.trait}</p>
                      {char.goldenFinger && <p className="text-xs text-amber-600 mt-1">金手指：{char.goldenFinger}</p>}
                    </div>
                  ) : null
                )}
              </div>
              {outline.coreConflicts.length > 0 && <div><h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">核心冲突</h3><div className="flex flex-wrap gap-2">{outline.coreConflicts.map((c, i) => <span key={i} className="text-xs px-2.5 py-1 bg-red-50 text-red-600 rounded-full">{c}</span>)}</div></div>}
              {outline.paymentPoints.length > 0 && <div><h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">付费点</h3><div className="flex flex-wrap gap-2">{outline.paymentPoints.map((ep, i) => <span key={i} className="text-xs px-2.5 py-1 bg-amber-50 text-amber-600 rounded-full">第 {ep} 集</span>)}</div></div>}
              {outline.buzzScenes?.length ? <div><h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">预计爆点场面</h3><div className="flex flex-wrap gap-2">{outline.buzzScenes.map((s, i) => <span key={i} className="text-xs px-2.5 py-1 bg-purple-50 text-purple-600 rounded-full">{s}</span>)}</div></div> : null}
            </div>
          )}
        </div>
      </div>

      {/* Compare Mode */}
      {compareMode && scripts.length >= 2 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
          <div className="px-5 py-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2"><GitCompare className="w-4 h-4 text-purple-600" />方案对比</h2>
              <button onClick={() => setCompareMode(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex items-center gap-3">
              <select value={compareScripts?.[0] || ''} onChange={(e) => setCompareScripts([e.target.value, compareScripts?.[1] || scripts[1].id])} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs">
                {scripts.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
              <span className="text-xs text-gray-400">vs</span>
              <select value={compareScripts?.[1] || ''} onChange={(e) => setCompareScripts([compareScripts?.[0] || scripts[0].id, e.target.value])} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs">
                {scripts.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
              <span className="text-xs text-gray-400 ml-2">第</span>
              <select value={compareEpisode} onChange={(e) => setCompareEpisode(Number(e.target.value))} className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs w-16">
                {Array.from({ length: Math.min(scripts[0]?.totalEpisodes || 50, 50) }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <span className="text-xs text-gray-400">集</span>
            </div>
          </div>
          {compareScripts && (() => {
            const epA = getEpisodeContent(compareScripts[0], compareEpisode);
            const epB = getEpisodeContent(compareScripts[1], compareEpisode);
            const scrA = getScriptById(compareScripts[0]);
            const scrB = getScriptById(compareScripts[1]);
            return (
              <div className="grid grid-cols-2 divide-x divide-gray-100">
                {[{ ep: epA, label: scrA?.title || '方案A' }, { ep: epB, label: scrB?.title || '方案B' }].map(({ ep, label }, idx) => (
                  <div key={idx} className="p-4">
                    <p className="text-xs font-medium text-gray-700 mb-2">{label}</p>
                    {ep ? (
                      <>
                        <pre className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">{ep.content}</pre>
                        {ep.paymentHook && <p className="text-xs text-amber-600 mt-2 border-t border-gray-100 pt-2">付费钩子：{ep.paymentHook}</p>}
                      </>
                    ) : (
                      <p className="text-xs text-gray-400 py-8 text-center">暂无第{compareEpisode}集内容</p>
                    )}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Scripts / Schemes Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">剧本方案<span className="ml-2 text-sm font-normal text-gray-400">({scripts.length})</span></h2>
          <button onClick={handleBatchDetectAI} disabled={batchDetecting || !expandedScript} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 transition-colors disabled:opacity-50">
            {batchDetecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}朱雀AI检测
          </button>
        </div>

        {scripts.length === 0 ? (
          <div className="py-16 text-center">
            <Loader2 className="h-12 w-12 mx-auto mb-3 text-gray-300 animate-spin" />
            <p className="text-gray-500 text-sm">正在初始化...</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {scripts.map((script) => (
              <div key={script.id}>
                {/* Scheme Header */}
                <div className="flex items-center gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setExpandedScript(expandedScript === script.id ? null : script.id)}>
                  <button className="shrink-0 text-gray-400">{expandedScript === script.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {editingTitle === script.id ? (
                        <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); handleRenameScript(script.id); }} onClick={(e) => e.stopPropagation()}>
                          <input autoFocus value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} className="px-2 py-1 border border-gray-200 rounded text-sm focus:outline-none focus:border-purple-300" onKeyDown={(e) => { if (e.key === 'Escape') setEditingTitle(null); }} />
                          <button type="submit" className="text-purple-600 text-xs hover:underline">保存</button>
                          <button type="button" onClick={() => setEditingTitle(null)} className="text-gray-400 text-xs hover:underline">取消</button>
                        </form>
                      ) : (
                        <span className="text-sm font-medium text-gray-900 cursor-text hover:text-purple-600" onClick={(e) => { e.stopPropagation(); setEditingTitle(script.id); setTitleDraft(script.title); }} title="点击重命名">{script.title}</span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(script.status)}`}>{getStatusLabel(script)}</span>
                      {/* Evaluation score badge on card */}
                      {evaluations[script.id] && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 font-medium" title="综合评分">
                          {evaluations[script.id].overallScore}分
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{script.totalEpisodes} 集 · {script.platform} · {formatDate(script.updatedAt || script.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => handleEvaluate(script.id)} disabled={evaluatingScript === script.id} className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors disabled:opacity-50" title="评估剧本">
                      {evaluatingScript === script.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Star className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => handleDuplicateScript(script)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors" title="复制方案"><Copy className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDeleteScript(script.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors" title="删除方案"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedScript === script.id && (
                  <div className="bg-gray-50/50 px-5 py-4 border-t border-gray-100">
                    {/* Action buttons bar */}
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
                      <button onClick={() => { setBatchGenScript(script.id); setBatchStartFrom(script.episodes.length + 1); setBatchCount(5); }} className="flex items-center gap-1.5 px-3 py-2 text-xs bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors">
                        <Sparkles className="w-3.5 h-3.5" />
                        {script.episodes.length === 0 ? '开始生成' : '继续生成'}
                      </button>
                      <button onClick={() => handleExportScript(script)} className="flex items-center gap-1.5 px-3 py-2 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-white transition-colors"><Download className="w-3.5 h-3.5" />导出</button>
                      <button onClick={() => { setImportModal(script.id); setImportText(''); setImportPreview(null); setImportMode('script'); }} className="flex items-center gap-1.5 px-3 py-2 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-white transition-colors"><Upload className="w-3.5 h-3.5" />导入剧本</button>
                      <button onClick={() => { setImportModal(script.id); setImportText(''); setImportPreview(null); setImportMode('synopsis'); }} className="flex items-center gap-1.5 px-3 py-2 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-white transition-colors"><FileText className="w-3.5 h-3.5" />导入概述</button>
                      <button onClick={() => handleEvaluate(script.id)} disabled={evaluatingScript === script.id} className="flex items-center gap-1.5 px-3 py-2 text-xs border border-gray-200 rounded-lg text-gray-600 hover:bg-white transition-colors disabled:opacity-50">
                        {evaluatingScript === script.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Star className="w-3.5 h-3.5" />}AI评估
                      </button>
                      <div className="flex-1" />
                      {script.episodes.length > 0 && (
                        <span className="text-xs text-gray-400">
                          已生成 {script.episodes.length}/{script.totalEpisodes} 集
                        </span>
                      )}
                    </div>

                    {/* Evaluation card */}
                    {evaluations[script.id] && (() => {
                      const ev = evaluations[script.id];
                      return (
                        <div className="mb-4 bg-white rounded-lg border border-gray-100 p-4">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="text-2xl font-bold text-purple-600">{ev.overallScore}</div>
                            <div><p className="text-xs font-medium text-gray-900">综合评分</p><p className="text-xs text-gray-400">{formatDate(ev.createdAt)}</p></div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 mb-3">
                            {[
                              { label: '钩子质量', score: ev.dimensionScores.hook },
                              { label: '情绪密度', score: ev.dimensionScores.emotionDensity },
                              { label: '反转设计', score: ev.dimensionScores.twistDesign },
                              { label: '付费设计', score: ev.dimensionScores.paymentDesign },
                              { label: '对话自然', score: ev.dimensionScores.dialogueNaturalness },
                              { label: '市场适配', score: ev.dimensionScores.marketAdaptation },
                            ].map(({ label, score }) => (
                              <div key={label} className="text-center">
                                <div className="text-sm font-semibold text-gray-900">{score.score}</div>
                                <div className="text-[10px] text-gray-500">{label}</div>
                                <div className="mt-1 w-full bg-gray-200 rounded-full h-1"><div className={`h-1 rounded-full ${score.score >= 70 ? 'bg-green-500' : score.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${score.score}%` }} /></div>
                              </div>
                            ))}
                          </div>
                          {ev.improvementSuggestions?.length > 0 && (
                            <div className="border-t border-gray-100 pt-2">
                              <p className="text-[10px] font-medium text-gray-500 mb-1">改进建议</p>
                              {ev.improvementSuggestions.slice(0, 3).map((s, i) => <p key={i} className="text-[10px] text-gray-500 leading-relaxed"><span className="text-amber-600">第{s.episode}集：</span>{s.suggestion}</p>)}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Batch Generation Panel */}
                    {batchGenScript === script.id && (
                      <div className="mb-4 bg-white rounded-lg border border-purple-200 p-4">
                        <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-purple-600" />
                          {script.episodes.length === 0 ? '开始生成剧本' : `继续生成（已生成 ${script.episodes.length}/${script.totalEpisodes} 集）`}
                        </h4>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div>
                            <label className="text-xs font-medium text-gray-600 mb-1.5 block">从第几集开始</label>
                            <input type="number" min={1} max={script.totalEpisodes} value={batchStartFrom} onChange={e => setBatchStartFrom(Math.max(1, parseInt(e.target.value) || 1))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-300" />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-600 mb-1.5 block">本次生成集数</label>
                            <div className="flex gap-1.5">
                              {[1, 3, 5, 10, 20].map(n => (
                                <button key={n} onClick={() => setBatchCount(n)} className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${batchCount === n ? 'bg-purple-600 text-white shadow-sm' : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-purple-50 hover:border-purple-300'}`}>{n}</button>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="mb-3">
                          <label className="text-xs font-medium text-gray-600 mb-1.5 block">创作方向建议（可选）</label>
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {[
                              '这阶段要虐男主', '要甜宠互动', '加反转打脸', '感情线升温',
                              '大高潮爆发', '身份曝光', '反派反扑', '轻松搞笑过渡',
                            ].map(tag => (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => {
                                  const current = batchGuidance;
                                  setBatchGuidance(current ? `${current}；${tag}` : tag);
                                }}
                                className="px-2.5 py-1 rounded-full text-[11px] bg-purple-50 border border-purple-100 text-purple-700 hover:bg-purple-100 transition-colors"
                              >
                                {tag}
                              </button>
                            ))}
                          </div>
                          <textarea
                            value={batchGuidance}
                            onChange={e => setBatchGuidance(e.target.value)}
                            placeholder="例如：这阶段要突出女主的反击，语气要强势；或者要多加感情戏..."
                            className="w-full h-16 px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:border-purple-300"
                          />
                        </div>
                        {apiConfigs.length > 1 && (
                          <div className="mb-3">
                            <label className="text-xs font-medium text-gray-600 mb-1.5 block">AI模型</label>
                            <select value={batchConfig || apiConfigs[0]?.id} onChange={e => setBatchConfig(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-300">
                              {apiConfigs.map(c => <option key={c.id} value={c.id}>{c.name || c.model}</option>)}
                            </select>
                          </div>
                        )}
                        <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                          <p className="text-xs text-gray-400">
                            第{batchStartFrom} ~ 第{Math.min(batchStartFrom + batchCount - 1, script.totalEpisodes)}集
                            {batchGuidance && <span className="text-purple-500 ml-1">（含方向建议）</span>}
                          </p>
                          <div className="flex gap-2">
                            <button onClick={() => setBatchGenScript(null)} className="px-4 py-2 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50">取消</button>
                            <button onClick={() => handleBatchGenerate(script.id)} className="px-5 py-2 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 shadow-sm">
                              <Sparkles className="w-3 h-3 inline mr-1" />开始生成
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Streaming Content Display */}
                    {streamingEpisode != null && streamingContent[streamingEpisode] != null && (
                      <div className="mb-4 bg-white rounded-lg border border-purple-200 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                            <span className="text-sm font-medium text-purple-700">
                              第{streamingEpisode}集 · 实时生成中
                            </span>
                            <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">
                              {streamingContent[streamingEpisode].length} 字
                            </span>
                          </div>
                          {streamingTaskId && (
                            <button
                              onClick={() => {
                                if (confirm('确定取消当前生成？已生成的内容不会丢失。')) {
                                  updateTask(streamingTaskId, { status: 'failed', error: '用户取消' });
                                  setStreamingEpisode(null);
                                  setStreamingTaskId(null);
                                  setStreamingContent({});
                                }
                              }}
                              className="px-2.5 py-1 text-[11px] text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                            >
                              取消生成
                            </button>
                          )}
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 max-h-64 overflow-y-auto">
                          <pre className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">
                            {streamingContent[streamingEpisode]}
                            <span className="inline-block w-0.5 h-3.5 bg-purple-500 animate-pulse ml-0.5 align-text-bottom" />
                          </pre>
                        </div>
                      </div>
                    )}

                    {/* Recovered running task indicator (for page re-entry) */}
                    {recoveredRunningTask && !streamingEpisode && Object.keys(streamingContent).length === 0 && (
                      <div className="mb-4 bg-purple-50 rounded-lg border border-purple-200 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                          <span className="text-sm font-medium text-purple-700">
                            {recoveredRunningTask.label}
                          </span>
                          <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full">
                            {recoveredRunningTask.progress}%
                          </span>
                        </div>
                        <div className="w-full bg-purple-200 rounded-full h-2">
                          <div className="bg-purple-600 h-2 rounded-full transition-all" style={{ width: `${recoveredRunningTask.progress}%` }} />
                        </div>
                        <p className="text-xs text-purple-500 mt-2">生成在后台进行中，实时内容需在生成开始时就在页面才能看到。完成后将自动刷新。</p>
                        <button
                          onClick={() => {
                            if (confirm('确定取消当前生成？已生成的内容不会丢失。')) {
                              updateTask(recoveredRunningTask.taskId, { status: 'failed', error: '用户取消' });
                              setRecoveredRunningTask(null);
                            }
                          }}
                          className="mt-2 px-2.5 py-1 text-[11px] text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          取消生成
                        </button>
                      </div>
                    )}

                    {/* Batch completed — show continue prompt */}
                    {batchJustCompleted === script.id && script.episodes.length < script.totalEpisodes && !streamingEpisode && !batchGenScript && (
                      <div className="mb-4 bg-green-50 rounded-lg border border-green-200 p-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-xs font-medium text-green-800">
                            本批完成！已生成 {script.episodes.length}/{script.totalEpisodes} 集
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            setBatchJustCompleted(null);
                            setBatchGenScript(script.id);
                            setBatchStartFrom(script.episodes.length + 1);
                            setBatchCount(5);
                            setBatchGuidance('');
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors"
                        >
                          <Sparkles className="w-3 h-3" />继续下一批
                        </button>
                      </div>
                    )}

                    {/* Episode List with synopsis + status */}
                    {(() => {
                      const epOutlines = outline?.episodeOutlines || [];
                      const generatedEps = new Set(script.episodes.map(ep => ep.episodeNumber));
                      const totalEps = script.totalEpisodes;

                      // Build episode list: show all if we have outlines, else just generated
                      const showAllEps = epOutlines.length > 0;
                      const epRange = showAllEps
                        ? Array.from({ length: totalEps }, (_, i) => i + 1)
                        : script.episodes.map(ep => ep.episodeNumber);

                      if (epRange.length === 0) {
                        return (
                          <div className="py-8 text-center">
                            <p className="text-xs text-gray-400">该方案暂无剧集内容</p>
                            <button onClick={() => { setBatchGenScript(script.id); setBatchStartFrom(1); setBatchCount(5); }} className="mt-2 text-xs text-purple-600 hover:text-purple-700 font-medium">开始生成剧本</button>
                          </div>
                        );
                      }

                      return (
                        <div className="bg-white rounded-lg border border-gray-100">
                          {/* Progress summary */}
                          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
                            <div className="flex items-center gap-4 text-xs">
                              <span className="text-green-600 font-medium">✅ 已完成 {script.episodes.length}</span>
                              <span className="text-gray-400">📋 待生成 {totalEps - script.episodes.length}</span>
                              <span className="text-gray-400">共 {totalEps} 集</span>
                            </div>
                            {script.episodes.length < totalEps && (
                              <button onClick={() => handleContinueGenerate(script)} className="text-xs text-purple-600 hover:text-purple-700 font-medium">
                                继续生成 →
                              </button>
                            )}
                          </div>

                          <div className="divide-y divide-gray-50">
                            {epRange.map((epNum) => {
                              const generatedEp = script.episodes.find(ep => ep.episodeNumber === epNum);
                              const synopsis = epOutlines.find(e => e.episodeNumber === epNum);
                              const isGenerated = generatedEps.has(epNum);
                              const isExpanded = expandedEpisode === epNum;

                              return (
                                <div key={epNum}>
                                  <div className={`w-full flex items-center gap-2 py-2 px-4 transition-colors group ${isGenerated ? 'hover:bg-purple-50/50' : 'hover:bg-gray-50'}`}>
                                    <button onClick={() => {
                                      if (isGenerated) setExpandedEpisode(isExpanded ? null : epNum);
                                    }} className="flex items-center gap-2 flex-1 text-left min-w-0">
                                      {isGenerated ? (
                                        <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                                      ) : (
                                        <FileText className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                                      )}
                                      <span className={`text-xs font-medium shrink-0 ${isGenerated ? 'text-gray-700' : 'text-gray-400'}`}>第{epNum}集</span>
                                      {synopsis ? (
                                        <span className="text-xs text-gray-500 truncate italic">{synopsis.title} — {synopsis.synopsis}</span>
                                      ) : isGenerated && generatedEp ? (
                                        <span className="text-xs text-gray-500 truncate">{generatedEp.summary}</span>
                                      ) : null}
                                      {isGenerated && generatedEp && (
                                        <>
                                          <span className="text-gray-400 text-xs shrink-0">({generatedEp.content.length}字)</span>
                                          {generatedEp.isComplete === false && (
                                            <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full border bg-red-50 text-red-600 border-red-200 font-medium">不完整</span>
                                          )}
                                        </>
                                      )}
                                      {/* AI detection result badge */}
                                      {isGenerated && (() => {
                                        const aiKey = `${script.id}-${epNum}`;
                                        const aiResult = episodeAiResults[aiKey];
                                        if (!aiResult) return null;
                                        const colorMap: Record<string, string> = {
                                          Pass: 'bg-green-50 text-green-600 border-green-200',
                                          Review: 'bg-yellow-50 text-yellow-600 border-yellow-200',
                                          Block: 'bg-red-50 text-red-600 border-red-200',
                                        };
                                        const cls = colorMap[aiResult.decision] || 'bg-gray-50 text-gray-500 border-gray-200';
                                        return (
                                          <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${cls}`}>
                                            AI: {aiResult.probability}% ({aiResult.decision === 'Pass' ? '通过' : aiResult.decision === 'Review' ? '待审' : '拦截'})
                                          </span>
                                        );
                                      })()}
                                    </button>
                                    {isGenerated && generatedEp && (
                                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                        <button onClick={(e) => { e.stopPropagation(); startEditEpisode(script.id, generatedEp); }} className="p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50" title="编辑本集"><Pencil className="w-3 h-3" /></button>
                                        <button onClick={(e) => { e.stopPropagation(); handleRegenerateSingle(script.id, epNum); }} className="p-1 rounded text-gray-400 hover:text-orange-600 hover:bg-orange-50" title="重新生成本集（带描述）"><RefreshCw className="w-3 h-3" /></button>
                                        <button onClick={(e) => { e.stopPropagation(); startRegenerate(script.id, epNum); }} className="p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50" title="从本集开始重新生成到结尾"><RefreshCw className="w-3 h-3 rotate-90" /></button>
                                        <button onClick={(e) => { e.stopPropagation(); setDeaiEpisode({ scriptId: script.id, epNumber: epNum }); }} className="p-1 rounded text-gray-400 hover:text-purple-600 hover:bg-purple-50" title="剧本润色"><Wand2 className="w-3 h-3" /></button>
                                        <button onClick={(e) => { e.stopPropagation(); handleDetectAI(script.id, generatedEp); }} disabled={!!detectingEpisode} className="p-1 rounded text-gray-400 hover:text-amber-600 hover:bg-amber-50 disabled:opacity-50" title="朱雀AI检测">
                                          {detectingEpisode?.scriptId === script.id && detectingEpisode.epNumber === epNum
                                            ? <Loader2 className="w-3 h-3 animate-spin" />
                                            : <Shield className="w-3 h-3" />}
                                        </button>
                                      </div>
                                    )}
                                  </div>

                                  {/* Expanded episode content */}
                                  {isExpanded && isGenerated && generatedEp && (
                                    <div className="mx-4 mb-2 p-3 bg-gray-50 rounded-lg">
                                      <p className="text-[11px] text-gray-400 mb-2">{generatedEp.scene} · {generatedEp.timeOfDay}</p>
                                      <pre className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{generatedEp.content + `\n\n【第${epNum}集完】`}</pre>
                                      {generatedEp.paymentHook && <div className="mt-2 pt-2 border-t border-gray-200"><p className="text-xs text-amber-600">付费钩子：{generatedEp.paymentHook}</p></div>}
                                    </div>
                                  )}

                                  {/* Episode Editor */}
                                  {editingEpisode?.scriptId === script.id && editingEpisode.epNumber === epNum && isGenerated && generatedEp && (
                                    <div className="mx-4 mb-2 p-4 bg-blue-50 rounded-lg border border-blue-200">
                                      <p className="text-xs font-medium text-gray-700 mb-2">编辑第{epNum}集</p>
                                      <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="w-full h-48 p-3 border border-gray-200 rounded-lg text-xs font-mono resize-y focus:outline-none focus:border-blue-300 mb-2" />
                                      <div className="mb-2">
                                        <label className="text-xs text-gray-600 mb-1 block">付费钩子</label>
                                        <input value={editPaymentHook} onChange={(e) => setEditPaymentHook(e.target.value)} className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-blue-300" />
                                      </div>
                                      <div className="flex gap-2">
                                        <button onClick={saveEditEpisode} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700"><Save className="w-3 h-3" />保存</button>
                                        <button onClick={() => setEditingEpisode(null)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-white">取消</button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Regenerate Modal */}
      {regeneratingFrom && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setRegeneratingFrom(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 mb-2">从第{regeneratingFrom.fromEp}集开始重新生成</h3>
            <p className="text-sm text-gray-500 mb-4">将保留第1到第{regeneratingFrom.fromEp - 1}集的内容，从第{regeneratingFrom.fromEp}集开始重新生成到结束。</p>
            <div className="mb-4">
              <label className="text-xs text-gray-600 mb-1 block">选择模型</label>
              <select value={regenConfig} onChange={(e) => setRegenConfig(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                {apiConfigs.map((c) => <option key={c.id} value={c.id}>{c.name || c.model}</option>)}
              </select>
            </div>
            <div className="mb-4">
              <label className="text-xs text-gray-600 mb-1 block">创作方向建议（可选）</label>
              <textarea
                id="regen-guidance"
                placeholder="例如：要加强情绪表达、反派要更嚣张、第3集要加入爱情线..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
                rows={3}
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setRegeneratingFrom(null)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">取消</button>
              <button onClick={confirmRegenerate} className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700">确认重新生成</button>
            </div>
          </div>
        </div>
      )}

      {/* Single Episode Regenerate Modal */}
      {regeneratingSingle && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setRegeneratingSingle(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 mb-2">重新生成第{regeneratingSingle.epNum}集</h3>
            <p className="text-sm text-gray-500 mb-4">将重新生成第{regeneratingSingle.epNum}集的内容，其他集保持不变。</p>
            <div className="mb-4">
              <label className="text-xs text-gray-600 mb-1 block">选择模型</label>
              <select value={batchConfig} onChange={(e) => setBatchConfig(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                {apiConfigs.map((c) => <option key={c.id} value={c.id}>{c.name || c.model}</option>)}
              </select>
            </div>
            <div className="mb-4">
              <label className="text-xs text-gray-600 mb-1 block">创作方向建议（可选）</label>
              <textarea
                id="single-regen-guidance"
                placeholder="例如：要加强情绪表达、反派要更嚣张、本集要加入反转..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
                rows={3}
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setRegeneratingSingle(null)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">取消</button>
              <button onClick={confirmRegenerateSingle} className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700">确认重新生成</button>
            </div>
          </div>
        </div>
      )}

      {/* Single Episode Regenerate Modal */}
      {regeneratingSingle && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setRegeneratingSingle(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-gray-900 mb-2">重新生成第{regeneratingSingle.epNum}集</h3>
            <p className="text-sm text-gray-500 mb-4">将重新生成第{regeneratingSingle.epNum}集的内容，其他集保持不变。</p>
            <div className="mb-4">
              <label className="text-xs text-gray-600 mb-1 block">选择模型</label>
              <select value={batchConfig} onChange={(e) => setBatchConfig(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                {apiConfigs.map((c) => <option key={c.id} value={c.id}>{c.name || c.model}</option>)}
              </select>
            </div>
            <div className="mb-4">
              <label className="text-xs text-gray-600 mb-1 block">创作方向建议（可选）</label>
              <textarea
                id="single-regen-guidance"
                placeholder="例如：要加强情绪表达、反派要更嚣张、本集要加入反转..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
                rows={3}
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setRegeneratingSingle(null)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">取消</button>
              <button onClick={confirmRegenerateSingle} className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700">确认重新生成</button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {importModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setImportModal(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">导入内容</h3>
              <button onClick={() => setImportModal(null)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-4">
              <button onClick={() => { setImportMode('script'); setImportPreview(null); }} className={`flex-1 py-2 text-sm rounded-md transition-colors ${importMode === 'script' ? 'bg-white text-orange-600 shadow-sm font-medium' : 'text-gray-600 hover:text-gray-900'}`}>导入剧本</button>
              <button onClick={() => { setImportMode('synopsis'); setImportPreview(null); }} className={`flex-1 py-2 text-sm rounded-md transition-colors ${importMode === 'synopsis' ? 'bg-white text-orange-600 shadow-sm font-medium' : 'text-gray-600 hover:text-gray-900'}`}>导入概述</button>
            </div>

            {importMode === 'script' ? (
              <div className="flex-1 overflow-hidden flex flex-col">
                <p className="text-xs text-gray-500 mb-3">
                  粘贴剧本内容，每集用【第X集】开头、【第X集完】结尾。可一次粘贴多集。
                </p>
                <textarea
                  value={importText}
                  onChange={(e) => { setImportText(e.target.value); setImportPreview(null); }}
                  placeholder={'【第1集】\n[零桢画面：...] \n1-1 场景地点 日内\n▶ 动作描写\n角色名（情绪）：台词\n\n【第1集完】\n\n【第2集】\n...\n【第2集完】'}
                  className="flex-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono resize-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  style={{ minHeight: '200px' }}
                />
              </div>
            ) : (
              <div className="flex-1 overflow-hidden flex flex-col">
                <p className="text-xs text-gray-500 mb-3">
                  支持JSON数组格式或TSV格式（集号、标题、梗概、核心事件、情绪节拍，tab分隔）。
                </p>
                <textarea
                  value={importText}
                  onChange={(e) => { setImportText(e.target.value); setImportPreview(null); }}
                  placeholder={'JSON格式示例：\n[\n  {"episodeNumber": 1, "title": "第1集标题", "synopsis": "梗概内容", "keyEvent": "核心事件", "emotionalBeat": "情绪节拍"},\n  ...\n]\n\nTSV格式示例：\n1\t第1集标题\t梗概内容\t核心事件\t情绪节拍\n2\t第2集标题\t...'}
                  className="flex-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono resize-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
                  style={{ minHeight: '200px' }}
                />
              </div>
            )}

            <div className="mt-4">
              <div className="flex gap-2 mb-4">
                <button onClick={() => document.getElementById('import-file-input')?.click()} className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2">
                  <Upload className="w-4 h-4" />上传文件
                </button>
                <input id="import-file-input" type="file" accept=".txt,.json,.tsv,.csv" className="hidden" onChange={handleImportFile} />
                <button onClick={handleImportPreview} disabled={!importText.trim() || importLoading} className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                  预览解析结果
                </button>
              </div>

              {importLoading && (
                <div className="text-center py-8 text-gray-500">
                  <div className="animate-spin w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                  正在解析...
                </div>
              )}

              {importPreview && !importLoading && (
                <div className="bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto mb-4">
                  {importPreview.errors.length > 0 && (
                    <div className="mb-3 p-2 bg-red-50 rounded text-xs text-red-600">
                      <p className="font-medium mb-1">解析错误：</p>
                      {importPreview.errors.map((err, i) => <p key={i}>{err}</p>)}
                    </div>
                  )}
                  {importPreview.parsed.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs text-gray-600 font-medium">解析结果：</p>
                      {importPreview.parsed.map((item: any, i: number) => (
                        <div key={i} className="text-xs border-l-2 border-orange-400 pl-2 py-1">
                          <span className="font-medium text-orange-600">{importMode === 'script' ? `第${item.episodeNumber}集` : `第${item.episodeNumber}集`}</span>
                          {importMode === 'script' ? (
                            <span className="text-gray-600 ml-2">{item.content.length}字</span>
                          ) : (
                            <span className="text-gray-500 ml-2">{item.title || '无标题'}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">未能解析到任何内容</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end mt-4 pt-4 border-t">
              <button onClick={() => setImportModal(null)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">取消</button>
              <button onClick={handleImportConfirm} disabled={!importPreview?.parsed.length || importLoading} className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50">
                确认导入
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DeAI Episode Modal */}
      {deaiEpisode && (() => {
        const script = scripts.find(s => s.id === deaiEpisode.scriptId);
        const ep = script?.episodes.find(e => e.episodeNumber === deaiEpisode.epNumber);
        if (!ep) return null;
        return (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setDeaiEpisode(null)}>
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-base font-semibold text-gray-900 mb-2">第{deaiEpisode.epNumber}集剧本润色</h3>
              <p className="text-sm text-gray-500 mb-4">将本集内容提交到后台队列进行剧本润色处理，支持多轮迭代自动优化。</p>
              <div className="mb-2">
                <label className="text-xs text-gray-600 mb-1 block">处理强度</label>
                <select value={deaiLevel} onChange={(e) => setDeaiLevel(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                  <option value="light">轻度 - 保留较多原文风格</option>
                  <option value="medium">中度 - 平衡改写</option>
                  <option value="heavy">重度 - 深度改写</option>
                </select>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 mb-4 max-h-32 overflow-y-auto">
                <p className="text-xs text-gray-500 line-clamp-4">{ep.content.slice(0, 200)}...</p>
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={() => setDeaiEpisode(null)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">取消</button>
                <button onClick={() => handleDeaiEpisode(deaiEpisode.scriptId, ep)} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">
                  <Wand2 className="w-4 h-4 inline mr-1" />开始剧本润色
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
