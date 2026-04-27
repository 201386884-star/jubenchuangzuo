'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FolderOpen, Search, Trash2, Plus, Loader2, Film } from 'lucide-react';
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

  const handleDelete = (outlineId: string) => {
    if (!confirm('确定删除该项目？关联的所有方案也会一起删除。')) return;
    const scripts = ScriptDB.getByOutlineId(outlineId);
    scripts.forEach((s) => ScriptDB.delete(s.id));
    OutlineDB.delete(outlineId);
    loadProjects();
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
    </div>
  );
}
