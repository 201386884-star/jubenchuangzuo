'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FolderOpen, Search, Trash2, Plus, Loader2, Film, Upload, X, ChevronDown } from 'lucide-react';
import { OutlineDB, ScriptDB } from '@/lib/db';
import type { StoryOutline, Script } from '@/types';

interface ProjectGroup {
  outline: StoryOutline;
  scripts: Script[];
}

export default function ScriptsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGenre, setFilterGenre] = useState('全部');

  // Import modal state
  const [importModal, setImportModal] = useState(false);
  const [importMode, setImportMode] = useState<'script' | 'synopsis'>('script');
  const [importText, setImportText] = useState('');
  const [importPreview, setImportPreview] = useState<{
    parsed: any[];
    errors: string[];
    healthReport?: {
      status: 'good' | 'warning' | 'error';
      message: string;
      issues: { type: string; description: string; level: 'error' | 'warning' | 'info' }[];
    };
  } | null>(null);
  const [importLoading, setImportLoading] = useState(false);

  // Continue creation dropdown
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadProjects = () => {
    setIsLoading(true);
    const outlines = OutlineDB.getAll();
    const allScripts = ScriptDB.getAll();
    const grouped = outlines.map((outline) => ({
      outline,
      scripts: allScripts.filter((s) => s.outlineId === outline.id),
    }));
    // Sort by most recent first
    grouped.sort((a, b) => {
      const dateA = new Date(a.outline.createdAt).getTime();
      const dateB = new Date(b.outline.createdAt).getTime();
      return dateB - dateA;
    });
    setProjects(grouped);
    setIsLoading(false);
  };

  useEffect(() => {
    loadProjects();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownOpen && dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [dropdownOpen]);

  const handleDelete = (outlineId: string) => {
    if (!confirm('确定删除该项目？关联的所有方案也会一起删除。')) return;
    const scripts = ScriptDB.getByOutlineId(outlineId);
    scripts.forEach((s) => ScriptDB.delete(s.id));
    OutlineDB.delete(outlineId);
    loadProjects();
  };

  // ---- Import Handlers ----
  // Health check for imported content
  const generateHealthReport = (
    parsed: any[],
    errors: string[],
    mode: 'script' | 'synopsis'
  ): NonNullable<typeof importPreview>['healthReport'] => {
    const issues: { type: string; description: string; level: 'error' | 'warning' | 'info' }[] = [];

    if (errors.length > 0) {
      errors.forEach(e => issues.push({ type: 'parse_error', description: e, level: 'error' }));
    }

    if (parsed.length === 0) {
      return {
        status: 'error',
        message: '无法解析内容',
        issues: [{ type: 'no_content', description: '未能解析到任何有效内容', level: 'error' }],
      };
    }

    // Episode count check
    if (parsed.length < 10) {
      issues.push({ type: 'episode_count', description: `集数较少（${parsed.length}集），可能影响用户留存`, level: 'warning' });
    } else if (parsed.length > 100) {
      issues.push({ type: 'episode_count', description: `集数偏多（${parsed.length}集），建议控制在合理范围`, level: 'info' });
    }

    if (mode === 'script') {
      // Check for zero frames in scripts (empty content)
      const emptyEpisodes = parsed.filter((ep: any) => !ep.content || ep.content.trim().length < 50);
      if (emptyEpisodes.length > 0) {
        issues.push({
          type: 'zero_frames',
          description: `${emptyEpisodes.length}集内容过少（<50字），可能被平台标记为低质量`,
          level: 'warning',
        });
      }

      // Check for proper episode numbering
      const episodeNumbers = parsed.map((ep: any) => ep.episodeNumber).filter((n: number) => !isNaN(n));
      const missingNumbers: number[] = [];
      for (let i = 1; i <= parsed.length; i++) {
        if (!episodeNumbers.includes(i)) missingNumbers.push(i);
      }
      if (missingNumbers.length > 0) {
        issues.push({
          type: 'missing_episodes',
          description: `缺少集数：第${missingNumbers.slice(0, 3).join('、')}集${missingNumbers.length > 3 ? '...' : ''}`,
          level: 'warning',
        });
      }

      // Check content quality indicators
      const avgLength = parsed.reduce((sum: number, ep: any) => sum + (ep.content?.length || 0), 0) / parsed.length;
      if (avgLength < 200) {
        issues.push({ type: 'short_content', description: `平均每集仅${Math.round(avgLength)}字，内容偏短可能影响完播率`, level: 'info' });
      }

      // Check for emotion annotations (AI味检测相关)
      const hasEmotionMarkers = parsed.some((ep: any) =>
        ep.content?.includes('【') && ep.content?.includes('】') &&
        (ep.content?.includes('情绪') || ep.content?.includes('转折') || ep.content?.includes('爽点'))
      );
      if (hasEmotionMarkers) {
        issues.push({
          type: 'ai_markers',
          description: '检测到AI写作标记（如【情绪】【转折】等），建议后续使用去AI味处理',
          level: 'info',
        });
      }
    } else {
      // Synopsis mode checks
      const missingSynopses = parsed.filter((ep: any) => !ep.synopsis || ep.synopsis.trim().length < 20);
      if (missingSynopses.length > parsed.length * 0.3) {
        issues.push({
          type: 'incomplete_synopses',
          description: `${missingSynopses.length}集缺少概述或概述过短`,
          level: 'warning',
        });
      }

      const missingKeyEvents = parsed.filter((ep: any) => !ep.keyEvent || ep.keyEvent.trim().length < 10);
      if (missingKeyEvents.length > parsed.length * 0.5) {
        issues.push({
          type: 'missing_key_events',
          description: `${missingKeyEvents.length}集缺少关键事件描述`,
          level: 'warning',
        });
      }
    }

    // Determine overall status
    const hasErrors = issues.some(i => i.level === 'error');
    const hasWarnings = issues.some(i => i.level === 'warning');

    return {
      status: hasErrors ? 'error' : hasWarnings ? 'warning' : 'good',
      message: hasErrors ? '存在格式问题，请检查' : hasWarnings ? '格式基本正确，有几处可优化' : '格式良好，可直接导入',
      issues,
    };
  };

  const handleImportPreview = () => {
    const text = importText.trim();
    if (!text) { alert('请输入内容或上传文件'); return; }
    setImportLoading(true);
    const errors: string[] = [];

    if (importMode === 'script') {
      const rawBlocks = text.split(/(?=【?第\s*\d+\s*集)/);
      const parsed = rawBlocks.map(block => {
        const numMatch = block.match(/第\s*(\d+)\s*集/);
        if (!numMatch) return null;
        const epNum = parseInt(numMatch[1]);
        const content = block.replace(/【?第\s*\d+\s*集】?\s*/, '').replace(/【第\d+集完】\s*/g, '').trim();
        return { episodeNumber: epNum, content };
      }).filter(Boolean);
      if (parsed.length === 0) errors.push('未能解析到任何集数，请确保使用【第X集】格式');
      const healthReport = generateHealthReport(parsed as any[], errors, 'script');
      setImportPreview({ parsed: parsed as any[], errors, healthReport });
    } else {
      try {
        const trimmed = text.trim();
        let parsed: any[] = [];
        if (trimmed.startsWith('[')) {
          parsed = JSON.parse(trimmed);
        } else {
          // TSV格式
          const lines = trimmed.split('\n').filter(l => l.trim());
          for (const line of lines) {
            const parts = line.split('\t');
            if (parts.length >= 1) {
              const epNum = parseInt(parts[0]);
              if (!isNaN(epNum)) {
                parsed.push({
                  episodeNumber: epNum,
                  title: parts[1] || `第${epNum}集`,
                  synopsis: parts[2] || '',
                  keyEvent: parts[3] || '',
                  emotionalBeat: parts[4] || '',
                });
              }
            }
          }
        }
        if (parsed.length === 0) errors.push('未能解析到任何概述，请检查格式');
        const healthReport = generateHealthReport(parsed, errors, 'synopsis');
        setImportPreview({ parsed, errors, healthReport });
      } catch {
        errors.push('JSON格式解析失败，请检查语法');
        setImportPreview({ parsed: [], errors });
      }
    }
    setImportLoading(false);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImportText(ev.target?.result as string || '');
      setImportPreview(null);
    };
    reader.readAsText(file);
  };

  const handleImportConfirm = () => {
    if (!importPreview?.parsed.length) return;

    if (importMode === 'script') {
      // 创建新项目
      const basicOutline = OutlineDB.create('导入剧本');
      OutlineDB.update(basicOutline.id, {
        genre: '都市',
        logline: '导入的剧本项目',
        characters: { protagonist: { name: '角色', trait: '主角', role: 'protagonist' }, antagonist: { name: '反派', trait: '反派', role: 'antagonist' } },
        worldSetting: '都市',
        coreConflicts: [],
        plotStructure: { setup: '', development: '', climax: '', resolution: '' },
        episodeOutlines: [],
        paymentPoints: [],
        emotionalArc: '',
      });

      const createdScript = ScriptDB.create(
        basicOutline.id,
        '导入剧本',
        '抖音' as const,
        importPreview.parsed.length
      );
      ScriptDB.update(createdScript.id, {
        episodes: importPreview.parsed.map((ep: any) => ({
          episodeNumber: ep.episodeNumber,
          scene: '场景',
          timeOfDay: '日内' as const,
          content: ep.content,
          paymentHook: '查看悬念',
          summary: `第${ep.episodeNumber}集`,
        })),
        status: 'complete',
        aiFlavorLevel: 'none',
      });
    } else {
      // 创建新项目（概述）
      const basicOutline = OutlineDB.create('导入概述');
      OutlineDB.update(basicOutline.id, {
        genre: '都市',
        logline: '导入的概述项目',
        characters: { protagonist: { name: '角色', trait: '主角', role: 'protagonist' }, antagonist: { name: '反派', trait: '反派', role: 'antagonist' } },
        worldSetting: '都市',
        coreConflicts: [],
        plotStructure: { setup: '', development: '', climax: '', resolution: '' },
        episodeOutlines: importPreview.parsed.map((ep: any) => ({
          episodeNumber: ep.episodeNumber,
          title: ep.title || `第${ep.episodeNumber}集`,
          synopsis: ep.synopsis || '',
          keyEvent: ep.keyEvent || '',
          emotionalBeat: ep.emotionalBeat || '',
        })),
        paymentPoints: [],
        emotionalArc: '',
      });

      const synopsisScript = ScriptDB.create(
        basicOutline.id,
        '导入概述',
        '抖音' as const,
        importPreview.parsed.length
      );
      ScriptDB.update(synopsisScript.id, {
        episodes: [],
        status: 'draft',
        aiFlavorLevel: 'none',
      });
    }

    setImportModal(false);
    setImportText('');
    setImportPreview(null);
    loadProjects();
    alert('导入成功！');
  };

  const genreList = ['全部', '复仇', '甜宠', '穿越', '都市', '古风', '悬疑', '职场', '校园', '玄幻', '家庭'];

  const filtered = projects.filter((p) => {
    const matchesSearch =
      !searchQuery ||
      (p.outline.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.outline.userInput.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.outline.logline || '').toLowerCase().includes(searchQuery.toLowerCase());
    const genre = Array.isArray(p.outline.genre) ? p.outline.genre[0] : p.outline.genre;
    const matchesGenre = filterGenre === '全部' || genre === filterGenre;
    return matchesSearch && matchesGenre;
  });

  const formatDate = (d: Date) => {
    const date = new Date(d);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const getGenre = (outline: StoryOutline) =>
    Array.isArray(outline.genre) ? outline.genre.join(' / ') : outline.genre;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">我的剧本</h1>
          <p className="text-gray-500 text-sm">管理已生成的剧本项目，支持重新编辑和生成新方案</p>
        </div>
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新建项目
        </button>
        {/* Continue Creation Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDropdownOpen(!dropdownOpen);
            }}
            className="flex items-center gap-2 px-4 py-2.5 border border-purple-200 text-purple-600 rounded-lg text-sm font-medium hover:bg-purple-50 transition-colors"
          >
            <Upload className="w-4 h-4" />
            继续创作
            <ChevronDown className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50">
              <button
                onClick={() => {
                  setImportModal(true);
                  setImportText('');
                  setImportPreview(null);
                  setImportMode('script');
                  setDropdownOpen(false);
                }}
                className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700 flex items-center gap-2"
              >
                <Film className="w-4 h-4" />
                导入剧本
              </button>
              <button
                onClick={() => {
                  setImportModal(true);
                  setImportText('');
                  setImportPreview(null);
                  setImportMode('synopsis');
                  setDropdownOpen(false);
                }}
                className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-purple-50 hover:text-purple-700 flex items-center gap-2"
              >
                <FolderOpen className="w-4 h-4" />
                导入概述
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索剧本项目..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-300"
            />
          </div>
          <select
            value={filterGenre}
            onChange={(e) => setFilterGenre(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-300"
          >
            {genreList.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Project List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 py-20 text-center">
          <FolderOpen className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500 text-lg mb-2">
            {searchQuery || filterGenre !== '全部' ? '没有匹配的项目' : '暂无剧本项目'}
          </p>
          <p className="text-sm text-gray-400 mb-6">
            {searchQuery || filterGenre !== '全部' ? '试试其他搜索条件' : '前往首页或专业模式创建你的第一个剧本'}
          </p>
          {!searchQuery && filterGenre === '全部' && (
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors"
            >
              去创建剧本
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(({ outline, scripts }) => (
            <div
              key={outline.id}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:border-purple-200 transition-colors cursor-pointer group"
              onClick={() => router.push(`/scripts/${outline.id}`)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-base font-semibold text-gray-900 truncate">
                      {outline.title || outline.userInput.slice(0, 30)}
                    </h3>
                    <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 font-medium">
                      {getGenre(outline)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 truncate mb-3">
                    {outline.logline || outline.userInput}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Film className="w-3.5 h-3.5" />
                      {scripts.length} 个方案
                    </span>
                    <span>{formatDate(outline.createdAt)}</span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(outline.id);
                  }}
                  className="shrink-0 p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Import Modal */}
      {importModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setImportModal(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">导入项目</h3>
              <button onClick={() => setImportModal(false)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg mb-4">
              <button onClick={() => { setImportMode('script'); setImportPreview(null); }} className={`flex-1 py-2 text-sm rounded-md transition-colors ${importMode === 'script' ? 'bg-white text-purple-600 shadow-sm font-medium' : 'text-gray-600 hover:text-gray-900'}`}>导入剧本</button>
              <button onClick={() => { setImportMode('synopsis'); setImportPreview(null); }} className={`flex-1 py-2 text-sm rounded-md transition-colors ${importMode === 'synopsis' ? 'bg-white text-purple-600 shadow-sm font-medium' : 'text-gray-600 hover:text-gray-900'}`}>导入概述</button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col">
              {importMode === 'script' ? (
                <div className="flex-1 flex flex-col">
                  <p className="text-xs text-gray-500 mb-3">粘贴剧本内容，每集用【第X集】开头、【第X集完】结尾。导入后将创建为新项目。</p>
                  <textarea
                    value={importText}
                    onChange={(e) => { setImportText(e.target.value); setImportPreview(null); }}
                    placeholder={'【第1集】\n[零桢画面：...] \n1-1 场景地点 日内\n▶ 动作描写\n角色名（情绪）：台词\n\n【第1集完】\n\n【第2集】\n...\n【第2集完】'}
                    className="flex-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono resize-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                    style={{ minHeight: '200px' }}
                  />
                </div>
              ) : (
                <div className="flex-1 flex flex-col">
                  <p className="text-xs text-gray-500 mb-3">支持JSON数组格式或TSV格式（集号、标题、梗概、核心事件、情绪节拍，tab分隔）。</p>
                  <textarea
                    value={importText}
                    onChange={(e) => { setImportText(e.target.value); setImportPreview(null); }}
                    placeholder={'JSON格式示例：\n[\n  {"episodeNumber": 1, "title": "第1集标题", "synopsis": "梗概内容"},\n  ...\n]\n\nTSV格式示例：\n1\t第1集标题\t梗概内容\t核心事件\t情绪节拍\n2\t第2集标题\t...'}
                    className="flex-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono resize-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                    style={{ minHeight: '200px' }}
                  />
                </div>
              )}

              <div className="flex gap-2 mt-4">
                <button onClick={() => document.getElementById('import-file-input')?.click()} className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 flex items-center gap-2">
                  <Upload className="w-4 h-4" />上传文件
                </button>
                <input id="import-file-input" type="file" accept=".txt,.json,.tsv,.csv" className="hidden" onChange={handleImportFile} />
                <button onClick={handleImportPreview} disabled={!importText.trim() || importLoading} className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                  预览解析
                </button>
              </div>

              {importLoading && (
                <div className="text-center py-6 text-gray-500">
                  <div className="animate-spin w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                  解析中...
                </div>
              )}

              {importPreview && !importLoading && (
                <div className="bg-gray-50 rounded-lg p-3 max-h-40 overflow-y-auto mt-4">
                  {importPreview.errors.length > 0 && (
                    <div className="mb-3 p-2 bg-red-50 rounded text-xs text-red-600">
                      {importPreview.errors.map((err, i) => <p key={i}>{err}</p>)}
                    </div>
                  )}
                  {importPreview.parsed.length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-xs text-gray-600 font-medium mb-2">解析结果：{importPreview.parsed.length}集</p>
                      {importPreview.parsed.map((item: any, i: number) => (
                        <div key={i} className="text-xs text-gray-600 flex gap-2">
                          <span className="text-purple-600 font-medium">第{item.episodeNumber}集</span>
                          <span>{importMode === 'script' ? `${item.content.length}字` : item.title}</span>
                        </div>
                      ))}
                    </div>
                  ) : importPreview.errors.length === 0 ? (
                    <p className="text-xs text-gray-500">未能解析到任何内容</p>
                  ) : null}

                  {/* Health Report */}
                  {importPreview.healthReport && (
                    <div className={`mt-3 p-3 rounded-lg border ${
                      importPreview.healthReport.status === 'good' ? 'bg-green-50 border-green-200' :
                      importPreview.healthReport.status === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                      'bg-red-50 border-red-200'
                    }`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`w-2 h-2 rounded-full ${
                          importPreview.healthReport.status === 'good' ? 'bg-green-500' :
                          importPreview.healthReport.status === 'warning' ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`} />
                        <span className={`text-xs font-medium ${
                          importPreview.healthReport.status === 'good' ? 'text-green-700' :
                          importPreview.healthReport.status === 'warning' ? 'text-yellow-700' :
                          'text-red-700'
                        }`}>
                          {importPreview.healthReport.message}
                        </span>
                      </div>
                      {importPreview.healthReport.issues.length > 0 && (
                        <div className="space-y-1">
                          {importPreview.healthReport.issues.slice(0, 3).map((issue, i) => (
                            <div key={i} className={`text-xs ${
                              issue.level === 'error' ? 'text-red-600' :
                              issue.level === 'warning' ? 'text-yellow-700' :
                              'text-gray-600'
                            }`}>
                              <span className="mr-1">•</span>
                              {issue.description}
                            </div>
                          ))}
                          {importPreview.healthReport.issues.length > 3 && (
                            <p className="text-xs text-gray-500">
                              还有{importPreview.healthReport.issues.length - 3}项提示...
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end mt-4 pt-4 border-t">
              <button onClick={() => setImportModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">取消</button>
              <button onClick={handleImportConfirm} disabled={!importPreview?.parsed.length || importLoading} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50">
                确认导入
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
