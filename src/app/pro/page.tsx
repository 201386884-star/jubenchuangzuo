'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Wand2, BookOpen, Download, Trash2, Loader2, Sparkles,
  FileText, CheckCircle, AlertCircle, ArrowRight, Copy, FolderOpen,
  Bell, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectItem } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { loadApiConfigs, getApiConfigById } from '@/lib/api-configs';
import type { ApiConfig } from '@/lib/api-configs';
import { OutlineDB, ScriptDB, EvaluationDB } from '@/lib/db';
import { getTasks, addTask, removeTask, updateTask, newTaskId, type BackgroundTask } from '@/lib/task-queue';
import '@/lib/use-task-queue';
import type { StoryOutline, Script, EpisodeScript, ScriptEvaluation } from '@/types';

const GENRES = ['复仇', '甜宠', '穿越', '都市', '古风', '悬疑', '职场', '校园'];
const PLATFORMS = ['ReelShort', '抖音', '快手', '微信视频号'];
const AI_LEVELS = [
  { value: 'none', label: '无' },
  { value: 'light', label: '轻度' },
  { value: 'medium', label: '中度' },
  { value: 'heavy', label: '重度' },
];
const EPISODES = ['20', '30', '50', '60', '80', '100'];

export default function ProPage() {
  const [step, setStep] = useState(1);
  const [userInput, setUserInput] = useState('');
  const [genre, setGenre] = useState('都市');
  const [platform, setPlatform] = useState('ReelShort');
  const [modelProvider, setModelProvider] = useState('anthropic');
  const [totalEpisodes, setTotalEpisodes] = useState('50');
  const [customEpisodes, setCustomEpisodes] = useState('');
  const [showCustomEpisodes, setShowCustomEpisodes] = useState(false);
  const [aiFlavorLevel, setAiFlavorLevel] = useState('medium');
  const [models, setModels] = useState<ApiConfig[]>([]);

  useEffect(() => {
    const configs = loadApiConfigs();
    setModels(configs);
    if (configs.length > 0) {
      setModelProvider(configs[0].id);
    }
  }, []);

  const [isGeneratingOutline, setIsGeneratingOutline] = useState(false);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isRemovingAI, setIsRemovingAI] = useState(false);

  const [outline, setOutline] = useState<StoryOutline | null>(null);
  const [script, setScript] = useState<Script | null>(null);
  const [evaluation, setEvaluation] = useState<ScriptEvaluation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [currentEpisode, setCurrentEpisode] = useState(0);
  const [viewingEpisode, setViewingEpisode] = useState<EpisodeScript | null>(null);
  const [savedOutlineId, setSavedOutlineId] = useState<string | null>(null);
  const [savedScriptId, setSavedScriptId] = useState<string | null>(null);

  // 后台任务
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);
  const [showTaskPanel, setShowTaskPanel] = useState(false);

  // 轮询任务状态：消费已完成的脚本生成任务
  useEffect(() => {
    const interval = setInterval(() => {
      const allTasks = getTasks();
      setTasks(allTasks);

      // 检查是否有新完成的脚本生成任务（来自本页面提交的）
      allTasks.filter(t => t.status === 'completed' && t.type === 'generate-script').forEach(task => {
        if (task.result && task.params?._fromProPage) {
          const resultScript = task.result;
          setScript(resultScript);
          setIsGeneratingScript(false);

          // 持久化剧本
          if (savedOutlineId) {
            const title = outline?.title ? `${outline.title} - 专业方案` : '专业方案';
            const saved = ScriptDB.create(savedOutlineId, title, resultScript.platform, resultScript.totalEpisodes);
            ScriptDB.update(saved.id, {
              episodes: resultScript.episodes,
              status: 'complete',
            });
            setSavedScriptId(saved.id);
          }

          setStep(3);
          updateTask(task.id, { status: 'failed' as any }); // 标记已消费
        }
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [savedOutlineId, outline]);

  const handleGenerateOutline = async () => {
    if (!userInput.trim()) return;
    setIsGeneratingOutline(true);
    setError(null);

    try {
      const response = await fetch('/api/generate-outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userInput, genre, platform, apiConfig: getApiConfigById(modelProvider) }),
      });

      if (!response.ok) throw new Error('大纲生成失败');
      const data = await response.json();
      if (!data.success) throw new Error(data.error || '大纲生成失败');
      setOutline(data.outline);

      // 持久化大纲
      const saved = OutlineDB.create(data.outline.userInput || userInput);
      OutlineDB.update(saved.id, { ...data.outline, id: saved.id });
      setSavedOutlineId(saved.id);

      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败');
    } finally {
      setIsGeneratingOutline(false);
    }
  };

  const handleGenerateScript = () => {
    if (!outline) return;
    setIsGeneratingScript(true);
    setError(null);
    setCurrentEpisode(0);
    setScript(null);

    const episodes = showCustomEpisodes ? (parseInt(customEpisodes, 10) || 50) : parseInt(totalEpisodes);
    const selectedConfig = getApiConfigById(modelProvider);

    // 提交到后台任务队列
    addTask({
      id: newTaskId(),
      type: 'generate-script',
      status: 'pending',
      progress: 0,
      totalEpisodes: episodes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      params: {
        apiConfig: selectedConfig,
        outline,
        totalEpisodes: episodes,
        platform,
        scriptIndex: 1,
        totalScripts: 1,
        _fromProPage: true, // 标记来源
      },
      scriptIndex: 1,
      totalScripts: 1,
      label: `${outline.title || '专业方案'} - 等待生成...`,
    });
  };

  const handleRemoveAI = () => {
    if (!script) return;
    setIsRemovingAI(true);
    setError(null);

    // 逐集提交剧本润色任务到后台队列
    const episodes = script.episodes;
    for (let i = 0; i < episodes.length; i++) {
      const ep = episodes[i];
      addTask({
        id: newTaskId(),
        type: 'deai-process',
        status: 'pending',
        progress: 0,
        totalEpisodes: episodes.length,
        currentEpisode: i + 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        params: {
          sessionId: `pro-${script.id}-ep${ep.episodeNumber}`,
          content: ep.content,
          level: aiFlavorLevel,
          apiConfig: getApiConfigById(modelProvider),
          enablePostProcess: true,
          iterationMode: 'auto',
          maxIterations: 3,
          targetProbability: 20,
          _fromProPage: true,
          _scriptId: script.id,
          _episodeNumber: ep.episodeNumber,
        },
        label: `第${ep.episodeNumber}集剧本润色 (${i + 1}/${episodes.length})`,
      });
    }

    setIsRemovingAI(false);
  };

  const handleEvaluate = async () => {
    if (!script) return;
    setIsEvaluating(true);
    setError(null);

    try {
      const response = await fetch('/api/evaluate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script, platform, apiConfig: getApiConfigById(modelProvider) }),
      });

      if (!response.ok) throw new Error('评估失败');
      const data = await response.json();
      if (!data.success) throw new Error(data.error || '评估失败');
      setEvaluation(data.evaluation);

      // 持久化评估
      if (savedScriptId && data.evaluation) {
        EvaluationDB.create(savedScriptId, {
          scriptId: savedScriptId,
          overallScore: data.evaluation.overallScore,
          dimensionScores: data.evaluation.dimensionScores,
          strengths: data.evaluation.strengths || [],
          weaknesses: data.evaluation.weaknesses || [],
          improvementSuggestions: data.evaluation.improvementSuggestions || [],
          marketPositioning: data.evaluation.marketPositioning || '',
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '评估失败');
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleExport = () => {
    if (!script) return;
    const content = script.episodes.map((ep, i) =>
      `【第${i + 1}集】\n场景: ${ep.scene}\n\n${ep.content}\n\n【付费点】${ep.paymentHook}\n`
    ).join('\n═══════════════════════════\n\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `短剧剧本_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyEpisode = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">专业模式</h1>
          <p className="text-gray-500 text-sm">精细控制剧本生成的各个环节</p>
        </div>
        {(tasks.filter(t => t.status === 'pending' || t.status === 'running').length > 0) && (
          <button
            onClick={() => setShowTaskPanel(!showTaskPanel)}
            className="relative flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-50 text-purple-700 text-sm font-medium hover:bg-purple-100 transition-colors"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {tasks.filter(t => t.status === 'pending' || t.status === 'running').length}
            </span>
            任务队列
          </button>
        )}
      </div>

      {/* 任务面板 */}
      {showTaskPanel && tasks.filter(t => t.status === 'pending' || t.status === 'running').length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">后台任务</h3>
            <button onClick={() => setShowTaskPanel(false)} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-2">
            {tasks.filter(t => t.status === 'pending' || t.status === 'running').map(task => (
              <div key={task.id} className="flex items-center gap-3 p-2 bg-purple-50 rounded-lg">
                <Loader2 className="h-4 w-4 animate-spin text-purple-600" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-purple-800 truncate">{task.label}</p>
                  {task.progress > 0 && (
                    <div className="mt-1 w-full bg-purple-200 rounded-full h-1">
                      <div className="bg-purple-600 h-1 rounded-full transition-all" style={{ width: `${task.progress}%` }} />
                    </div>
                  )}
                </div>
                <button onClick={() => updateTask(task.id, { status: 'failed', error: '用户取消' })} className="text-gray-400 hover:text-red-500">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Steps Indicator */}
      <div className="flex mb-8">
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= s ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-400'
              }`}>
                {s}
              </div>
              {s < 3 && <ArrowRight className="w-4 h-4 mx-2 text-gray-300" />}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <Alert variant="error" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Step 1: Generate Outline */}
      {step === 1 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="mb-5">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-purple-600" />
              第一步：生成大纲
            </h3>
            <p className="text-sm text-gray-500 mt-1">输入你的故事想法，AI将为你生成结构化的大纲</p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">故事描述</label>
              <textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="一句话描述你的故事...
例如：女主被陷害失去一切，重生后步步为营复仇成功"
                className="w-full h-32 p-4 rounded-xl border border-gray-200 bg-white text-sm resize-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
                disabled={isGeneratingOutline}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">类型</label>
                <Select value={genre} onValueChange={setGenre} disabled={isGeneratingOutline}>
                    {GENRES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">平台</label>
                <Select value={platform} onValueChange={setPlatform} disabled={isGeneratingOutline}>
                    {PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </Select>
              </div>
            </div>
            <Button
              size="lg"
              className="w-full bg-purple-600 hover:bg-purple-700"
              onClick={handleGenerateOutline}
              disabled={isGeneratingOutline || !userInput.trim()}
            >
              {isGeneratingOutline ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" />生成中...</>
              ) : (
                <><Sparkles className="mr-2 h-5 w-5" />生成大纲</>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Confirm Outline & Generate Script */}
      {step === 2 && outline && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">故事大纲预览</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">类型</h4>
                  <p className="text-sm text-gray-500">{outline.genre}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">简介</h4>
                  <p className="text-sm text-gray-500">{outline.logline}</p>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">人物设定</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-xs font-medium text-gray-700">主角</p>
                    <p className="text-xs text-gray-500 mt-1">{outline.characters.protagonist.name}</p>
                    <p className="text-xs text-gray-400">{outline.characters.protagonist.trait}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-xs font-medium text-gray-700">反派</p>
                    <p className="text-xs text-gray-500 mt-1">{outline.characters.antagonist.name}</p>
                    <p className="text-xs text-gray-400">{outline.characters.antagonist.trait}</p>
                  </div>
                  {outline.characters.supporter && (
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-xs font-medium text-gray-700">助攻</p>
                      <p className="text-xs text-gray-500 mt-1">{outline.characters.supporter.name}</p>
                      <p className="text-xs text-gray-400">{outline.characters.supporter.trait}</p>
                    </div>
                  )}
                </div>
              </div>
              {outline.paymentPoints && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-1">推荐付费点</h4>
                  <p className="text-sm text-gray-500">{outline.paymentPoints.join(', ')}</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">第二步：生成剧本</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">集数</label>
                  <Select value={showCustomEpisodes ? 'custom' : totalEpisodes} onValueChange={(v) => {
                    if (v === 'custom') {
                      setShowCustomEpisodes(true);
                    } else {
                      setShowCustomEpisodes(false);
                      setTotalEpisodes(v);
                    }
                  }}>
                      {EPISODES.map((e) => <SelectItem key={e} value={e}>{e}集</SelectItem>)}
                      <SelectItem value="custom">自定义</SelectItem>
                    </Select>
                    {showCustomEpisodes && (
                      <input
                        type="number"
                        min="1"
                        max="500"
                        value={customEpisodes}
                        onChange={(e) => setCustomEpisodes(e.target.value)}
                        placeholder="输入集数"
                        className="mt-2 h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                      />
                    )}
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">AI模型</label>
                  <Select value={modelProvider} onValueChange={setModelProvider}>
                    {models.map((m) => <SelectItem key={m.id} value={m.id}>{m.name || m.model}</SelectItem>)}
                    </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">剧本润色</label>
                  <Select value={aiFlavorLevel} onValueChange={setAiFlavorLevel}>
                      {AI_LEVELS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                    </Select>
                </div>
              </div>
              <div className="flex gap-4">
                <Button
                  size="lg"
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                  onClick={handleGenerateScript}
                  disabled={isGeneratingScript}
                >
                  {isGeneratingScript ? (
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin" />已提交后台，生成中...</>
                  ) : (
                    <><BookOpen className="mr-2 h-5 w-5" />开始生成剧本</>
                  )}
                </Button>
                {!isGeneratingScript && (
                  <Button variant="outline" onClick={() => setStep(1)}>
                    返回修改大纲
                  </Button>
                )}
              </div>
              {isGeneratingScript && (
                <p className="text-xs text-gray-400 mt-2">生成在后台进行，你可以切换到其他页面。点击右上角任务按钮查看进度。</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 3: View & Manage Script */}
      {step === 3 && script && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">生成的剧本</h3>
                <p className="text-sm text-gray-500 mt-0.5">共 {script.totalEpisodes} 集</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleExport} className="text-sm">
                  <Download className="mr-2 h-4 w-4" />导出
                </Button>
                <Button
                  variant="outline"
                  onClick={handleRemoveAI}
                  disabled={isRemovingAI || aiFlavorLevel === 'none'}
                  className="text-sm"
                >
                  {isRemovingAI ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />处理中...</>
                  ) : (
                    <><Sparkles className="mr-2 h-4 w-4" />剧本润色</>
                  )}
                </Button>
                <Button onClick={handleEvaluate} disabled={isEvaluating} className="text-sm bg-purple-600 hover:bg-purple-700">
                  {isEvaluating ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />评估中...</>
                  ) : (
                    <><CheckCircle className="mr-2 h-4 w-4" />评估剧本</>
                  )}
                </Button>
                {savedScriptId && (
                  <a
                    href={`/scripts/${savedOutlineId}`}
                    className="inline-flex items-center gap-1 px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors no-underline"
                  >
                    <FolderOpen className="h-4 w-4" />我的剧本
                  </a>
                )}
              </div>
            </div>

            {/* Episode Grid */}
            <div className="grid grid-cols-8 md:grid-cols-12 gap-2 mb-6">
              {script.episodes.map((ep, i) => (
                <button
                  key={i}
                  onClick={() => setViewingEpisode(ep)}
                  className={`p-2 rounded-lg text-xs font-medium transition-colors ${
                    viewingEpisode === ep
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            {/* Episode Preview */}
            {viewingEpisode && (
              <div className="border border-gray-100 rounded-lg p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-gray-900">第{script.episodes.indexOf(viewingEpisode) + 1}集</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyEpisode(viewingEpisode.content)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <Copy className="h-4 w-4 mr-1" />复制
                  </Button>
                </div>
                <div className="text-sm text-gray-600">
                  <strong>场景：</strong>{viewingEpisode.scene}
                </div>
                <div className="bg-gray-50 p-4 rounded-lg whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
                  {viewingEpisode.content}
                </div>
                <div className="bg-purple-50 p-3 rounded-lg">
                  <p className="text-sm text-purple-700"><strong>付费点：</strong>{viewingEpisode.paymentHook}</p>
                </div>
              </div>
            )}
          </div>

          {/* Evaluation Results */}
          {evaluation && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">剧本评估结果</h3>
              <div className="text-center mb-6">
                <div className="text-5xl font-bold text-purple-600">{evaluation.overallScore}</div>
                <p className="text-sm text-gray-500 mt-1">综合评分</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {Object.entries(evaluation.dimensionScores).map(([key, score]) => (
                  <div key={key} className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">{key}</span>
                      <span className="text-sm font-bold text-gray-900">{score.score}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-purple-600 h-2 rounded-full"
                        style={{ width: `${score.score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {evaluation.improvementSuggestions && evaluation.improvementSuggestions.length > 0 && (
                <div className="mt-6">
                  <h4 className="font-medium text-gray-900 mb-3">改进建议</h4>
                  <ul className="space-y-2">
                    {evaluation.improvementSuggestions.slice(0, 5).map((s, i) => (
                      <li key={i} className="text-sm flex gap-2 text-gray-600">
                        <AlertCircle className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                        <span><strong>第{s.episode}集：</strong>{s.suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
