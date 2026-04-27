'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Clock, Search, Trash2, Eye, ArrowLeft, Tag, Filter,
  ChevronDown, RotateCw, Copy, Check, Eraser, Zap, Shield, Flame,
  ArrowLeftRight, List,
} from 'lucide-react';
import { DeAIDB } from '@/lib/deai-db';
import type { DeAISession } from '@/types';

const LEVEL_LABELS: Record<string, { label: string; color: string; icon: typeof Zap }> = {
  light: { label: '轻度', color: 'bg-blue-100 text-blue-700', icon: Zap },
  medium: { label: '中度', color: 'bg-purple-100 text-purple-700', icon: Shield },
  heavy: { label: '重度', color: 'bg-red-100 text-red-700', icon: Flame },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  processing: { label: '处理中', color: 'bg-yellow-100 text-yellow-700' },
  completed: { label: '已完成', color: 'bg-green-100 text-green-700' },
  failed: { label: '失败', color: 'bg-red-100 text-red-700' },
};

export default function DeAIHistoryPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<DeAISession[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setSessions(DeAIDB.getAll());
  }, []);

  const refresh = () => setSessions(DeAIDB.getAll());

  const handleDelete = (id: string) => {
    DeAIDB.delete(id);
    refresh();
  };

  const handleBatchDelete = () => {
    selectedIds.forEach(id => DeAIDB.delete(id));
    setSelectedIds(new Set());
    refresh();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filtered = sessions.filter(s => {
    if (searchQuery && !s.title.includes(searchQuery) && !s.originalContent.includes(searchQuery)) return false;
    if (filterLevel && s.config.level !== filterLevel) return false;
    if (filterStatus && s.status !== filterStatus) return false;
    return true;
  });

  const getProbabilityColor = (prob: number) => {
    if (prob <= 20) return 'text-green-600';
    if (prob <= 50) return 'text-yellow-600';
    if (prob <= 80) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/deai')} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
              <Clock className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">剧本润色历史记录</h1>
              <p className="text-sm text-gray-400">共 {sessions.length} 条记录</p>
            </div>
          </div>
        </div>
        {selectedIds.size > 0 && (
          <button onClick={handleBatchDelete}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-sm hover:bg-red-100 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />删除选中 ({selectedIds.size})
          </button>
        )}
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜索内容..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            />
          </div>
          <button onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
              filterLevel || filterStatus ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}>
            <Filter className="w-4 h-4" />筛选
            {(filterLevel || filterStatus) && <span className="w-2 h-2 rounded-full bg-amber-500" />}
          </button>
        </div>
        {showFilters && (
          <div className="mt-3 flex items-center gap-4 pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">强度：</span>
              <div className="flex gap-1">
                <button onClick={() => setFilterLevel('')}
                  className={`px-2 py-1 rounded text-xs ${!filterLevel ? 'bg-gray-200 text-gray-700' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}>全部</button>
                {['light', 'medium', 'heavy'].map(l => (
                  <button key={l} onClick={() => setFilterLevel(filterLevel === l ? '' : l)}
                    className={`px-2 py-1 rounded text-xs ${filterLevel === l ? 'bg-amber-100 text-amber-700' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}>
                    {LEVEL_LABELS[l]?.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">状态：</span>
              <div className="flex gap-1">
                <button onClick={() => setFilterStatus('')}
                  className={`px-2 py-1 rounded text-xs ${!filterStatus ? 'bg-gray-200 text-gray-700' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}>全部</button>
                {['completed', 'processing', 'failed'].map(s => (
                  <button key={s} onClick={() => setFilterStatus(filterStatus === s ? '' : s)}
                    className={`px-2 py-1 rounded text-xs ${filterStatus === s ? 'bg-amber-100 text-amber-700' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}>
                    {STATUS_LABELS[s]?.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Session List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Eraser className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400 mb-2">暂无历史记录</p>
          <Link href="/deai" className="text-sm text-amber-600 hover:text-amber-700">去工作台处理内容</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(session => {
            const levelInfo = LEVEL_LABELS[session.config.level];
            const statusInfo = STATUS_LABELS[session.status];
            return (
              <div key={session.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 transition-colors">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(session.id)}
                    onChange={() => toggleSelect(session.id)}
                    className="mt-1 w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h3 className="text-sm font-medium text-gray-900 truncate">{session.title}</h3>
                      {levelInfo && (
                        <span className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${levelInfo.color}`}>{levelInfo.label}</span>
                      )}
                      {statusInfo && (
                        <span className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      {session.config.dialectStyle && session.config.dialectStyle !== 'none' && (
                        <span className="flex items-center gap-1">
                          <Tag className="w-3 h-3" />{session.config.dialectStyle}
                        </span>
                      )}
                      {session.rounds.length > 0 && (
                        <span className="flex items-center gap-1">
                          <RotateCw className="w-3 h-3" />{session.rounds.length}轮
                        </span>
                      )}
                      {session.inputAiProbability !== undefined && session.outputAiProbability !== undefined && (
                        <span className="flex items-center gap-1">
                          <ArrowLeftRight className="w-3 h-3" />
                          <span className={getProbabilityColor(session.inputAiProbability)}>{session.inputAiProbability}%</span>
                          <span>→</span>
                          <span className={getProbabilityColor(session.outputAiProbability)}>{session.outputAiProbability}%</span>
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />{new Date(session.createdAt).toLocaleString('zh-CN')}
                      </span>
                    </div>

                    {session.tags.length > 0 && (
                      <div className="mt-2 flex gap-1">
                        {session.tags.map((tag, i) => (
                          <span key={i} className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Link
                      href={`/deai/history/${session.id}`}
                      className="p-2 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                      title="查看详情"
                    >
                      <Eye className="w-4 h-4" />
                    </Link>
                    <button
                      onClick={() => handleDelete(session.id)}
                      className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
