'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Trash2, Copy, Check, Download, RotateCw, Tag,
  Zap, Shield, Flame, Clock, ArrowLeftRight, X, Plus,
  Eye, FileText,
} from 'lucide-react';
import { DeAIDB } from '@/lib/deai-db';
import type { DeAISession, DeAIRound } from '@/types';

const LEVEL_LABELS: Record<string, { label: string; color: string }> = {
  light: { label: '轻度', color: 'bg-blue-100 text-blue-700' },
  medium: { label: '中度', color: 'bg-purple-100 text-purple-700' },
  heavy: { label: '重度', color: 'bg-red-100 text-red-700' },
};

export default function DeAIHistoryDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [session, setSession] = useState<DeAISession | null>(null);
  const [selectedRound, setSelectedRound] = useState<number>(-1); // -1 = final
  const [copied, setCopied] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [showAddTag, setShowAddTag] = useState(false);
  const [viewMode, setViewMode] = useState<'side' | 'output'>('output');

  useEffect(() => {
    const s = DeAIDB.getById(id);
    if (s) {
      setSession(s);
      if (s.rounds.length > 0) {
        setSelectedRound(s.rounds[s.rounds.length - 1].round);
      }
    }
  }, [id]);

  if (!session) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="text-center py-20">
          <FileText className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">记录不存在</p>
          <Link href="/deai/history" className="text-sm text-amber-600 hover:text-amber-700 mt-2 inline-block">返回历史记录</Link>
        </div>
      </div>
    );
  }

  const currentContent = selectedRound === -1
    ? session.finalContent
    : session.rounds.find(r => r.round === selectedRound)?.content || session.finalContent;

  const currentRoundData = selectedRound >= 0
    ? session.rounds.find(r => r.round === selectedRound)
    : null;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = () => {
    const blob = new Blob([currentContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `剧本润色_${session.title.slice(0, 20)}_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = () => {
    DeAIDB.delete(id);
    router.push('/deai/history');
  };

  const handleAddTag = () => {
    if (!newTag.trim()) return;
    const tags = [...session.tags, newTag.trim()];
    DeAIDB.updateTags(id, tags);
    setSession({ ...session, tags });
    setNewTag('');
    setShowAddTag(false);
  };

  const handleRemoveTag = (idx: number) => {
    const tags = session.tags.filter((_, i) => i !== idx);
    DeAIDB.updateTags(id, tags);
    setSession({ ...session, tags });
  };

  const getProbabilityColor = (prob: number) => {
    if (prob <= 20) return { text: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', label: '人类写作' };
    if (prob <= 50) return { text: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200', label: '疑似AI' };
    if (prob <= 80) return { text: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', label: '可能AI' };
    return { text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', label: 'AI生成' };
  };

  const levelInfo = LEVEL_LABELS[session.config.level];

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/deai/history')} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-gray-900 truncate max-w-md">{session.title}</h1>
              {levelInfo && <span className={`px-2 py-0.5 rounded text-xs font-medium ${levelInfo.color}`}>{levelInfo.label}</span>}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date(session.createdAt).toLocaleString('zh-CN')}
              {session.rounds.length > 0 && ` · ${session.rounds.length}轮迭代`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? '已复制' : '复制'}
          </button>
          <button onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            <Download className="w-3.5 h-3.5" />导出
          </button>
          <button onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-sm text-red-600 hover:bg-red-50 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />删除
          </button>
        </div>
      </div>

      {/* Tags */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <Tag className="w-4 h-4 text-gray-400" />
        {session.tags.map((tag, i) => (
          <span key={i} className="flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-600 text-xs">
            {tag}
            <button onClick={() => handleRemoveTag(i)} className="hover:text-red-500">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        {showAddTag ? (
          <div className="flex items-center gap-1">
            <input
              value={newTag}
              onChange={e => setNewTag(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddTag()}
              placeholder="标签名"
              className="w-24 px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-amber-500/30"
              autoFocus
            />
            <button onClick={handleAddTag} className="text-xs text-amber-600 hover:text-amber-700">添加</button>
            <button onClick={() => setShowAddTag(false)} className="text-xs text-gray-400 hover:text-gray-600">取消</button>
          </div>
        ) : (
          <button onClick={() => setShowAddTag(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-full border border-dashed border-gray-300 text-gray-400 text-xs hover:border-gray-400 hover:text-gray-500 transition-colors">
            <Plus className="w-3 h-3" />添加标签
          </button>
        )}
      </div>

      {/* Config summary */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
          <div>
            <span className="text-gray-400 block mb-0.5">处理强度</span>
            <span className="font-medium text-gray-700">{levelInfo?.label || session.config.level}</span>
          </div>
          <div>
            <span className="text-gray-400 block mb-0.5">风格模板</span>
            <span className="font-medium text-gray-700">{session.config.dialectStyle === 'none' ? '无' : session.config.dialectStyle}</span>
          </div>
          <div>
            <span className="text-gray-400 block mb-0.5">题材</span>
            <span className="font-medium text-gray-700">{session.config.genre || '自动'}</span>
          </div>
          <div>
            <span className="text-gray-400 block mb-0.5">迭代模式</span>
            <span className="font-medium text-gray-700">{session.config.iterationMode === 'auto' ? `自动(${session.config.maxIterations}轮)` : '手动'}</span>
          </div>
          <div>
            <span className="text-gray-400 block mb-0.5">AI模型</span>
            <span className="font-medium text-gray-700">{session.config.apiModelName}</span>
          </div>
        </div>

        {/* AI Probability comparison */}
        {session.inputAiProbability !== undefined && session.outputAiProbability !== undefined && (
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-4">
            <div className="text-center">
              <div className="text-xs text-gray-400 mb-0.5">原文AI概率</div>
              <div className={`text-xl font-bold ${getProbabilityColor(session.inputAiProbability).text}`}>
                {session.inputAiProbability}%
              </div>
            </div>
            <ArrowLeftRight className="w-4 h-4 text-gray-300" />
            <div className="text-center">
              <div className="text-xs text-gray-400 mb-0.5">最终AI概率</div>
              <div className={`text-xl font-bold ${getProbabilityColor(session.outputAiProbability).text}`}>
                {session.outputAiProbability}%
              </div>
            </div>
            <div className="px-3 py-1 rounded-lg bg-green-50 border border-green-200">
              <span className="text-sm font-bold text-green-600">
                下降 {session.inputAiProbability - session.outputAiProbability}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* View mode toggle */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-1 bg-gray-200 rounded-lg p-0.5">
          <button onClick={() => setViewMode('output')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${viewMode === 'output' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
            结果查看
          </button>
          <button onClick={() => setViewMode('side')}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${viewMode === 'side' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
            原文对比
          </button>
        </div>
      </div>

      {/* Iteration timeline */}
      {session.rounds.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <RotateCw className="w-4 h-4" />迭代时间线
          </h3>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {session.rounds.map((round) => {
              const prob = round.aiProbability;
              const probColor = prob !== undefined ? getProbabilityColor(prob) : null;
              const isSelected = selectedRound === round.round;
              return (
                <button
                  key={round.round}
                  onClick={() => setSelectedRound(round.round)}
                  className={`shrink-0 px-4 py-3 rounded-lg border text-left transition-all ${
                    isSelected
                      ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-300'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="text-xs font-medium text-gray-600 mb-1">第{round.round}轮</div>
                  {prob !== undefined && probColor && (
                    <div className={`text-lg font-bold ${probColor.text}`}>{prob}%</div>
                  )}
                  {round.stats && (
                    <div className="text-xs text-gray-400 mt-1">
                      改写{round.stats.connectorsReplaced}处 · {round.stats.formatPreserved}格式保留
                    </div>
                  )}
                </button>
              );
            })}
            {session.finalContent && (
              <button
                onClick={() => setSelectedRound(-1)}
                className={`shrink-0 px-4 py-3 rounded-lg border text-left transition-all ${
                  selectedRound === -1
                    ? 'border-green-400 bg-green-50 ring-1 ring-green-300'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="text-xs font-medium text-gray-600 mb-1">最终结果</div>
                {session.outputAiProbability !== undefined && (
                  <div className={`text-lg font-bold ${getProbabilityColor(session.outputAiProbability).text}`}>
                    {session.outputAiProbability}%
                  </div>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Content area */}
      {viewMode === 'side' ? (
        <div className="grid grid-cols-2 gap-0 border border-gray-200 rounded-xl overflow-hidden bg-white">
          <div className="flex flex-col border-r border-gray-200">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
              <span className="text-sm font-medium text-gray-700">原始内容</span>
              <span className="text-xs text-gray-400 ml-2">{session.originalContent.replace(/\s/g, '').length} 字</span>
            </div>
            <pre className="flex-1 min-h-[500px] max-h-[700px] overflow-auto px-4 py-3 text-sm text-gray-800 whitespace-pre-wrap font-mono leading-relaxed">
              {session.originalContent}
            </pre>
          </div>
          <div className="flex flex-col">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
              <span className="text-sm font-medium text-gray-700">
                {selectedRound === -1 ? '最终结果' : `第${selectedRound}轮结果`}
              </span>
              <span className="text-xs text-gray-400 ml-2">{currentContent.replace(/\s/g, '').length} 字</span>
            </div>
            <pre className="flex-1 min-h-[500px] max-h-[700px] overflow-auto px-4 py-3 text-sm text-gray-800 whitespace-pre-wrap font-mono leading-relaxed">
              {currentContent}
            </pre>
          </div>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-700">
                {selectedRound === -1 ? '最终结果' : `第${selectedRound}轮结果`}
              </span>
              <span className="text-xs text-gray-400 ml-2">{currentContent.replace(/\s/g, '').length} 字</span>
            </div>
            {currentRoundData && currentRoundData.modifications.length > 0 && (
              <div className="flex gap-1">
                {currentRoundData.modifications.slice(0, 3).map((mod, i) => (
                  <span key={i} className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">{mod}</span>
                ))}
              </div>
            )}
          </div>
          <pre className="min-h-[500px] max-h-[700px] overflow-auto px-4 py-3 text-sm text-gray-800 whitespace-pre-wrap font-mono leading-relaxed">
            {currentContent}
          </pre>
        </div>
      )}

      {/* Round stats detail */}
      {currentRoundData && (
        <div className="mt-4 bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-medium text-gray-700 mb-3">第{currentRoundData.round}轮处理统计</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{currentRoundData.stats.connectorsReplaced}</div>
              <div className="text-xs text-blue-500 mt-0.5">连接词替换</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{currentRoundData.stats.formatPreserved}</div>
              <div className="text-xs text-purple-500 mt-0.5">格式标记保留</div>
            </div>
            <div className="text-center p-3 bg-amber-50 rounded-lg">
              <div className="text-2xl font-bold text-amber-600">{currentRoundData.stats.imperfectionsInjected}</div>
              <div className="text-xs text-amber-500 mt-0.5">不完美注入</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{currentRoundData.stats.sentencesModified}</div>
              <div className="text-xs text-green-500 mt-0.5">句式修改</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
