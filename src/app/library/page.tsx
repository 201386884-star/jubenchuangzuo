'use client';

import { useState, useEffect } from 'react';
import {
  Library, Upload, Trash2, BookOpen, FileText,
  Search, Loader2, CheckCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectItem } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { LearningDB } from '@/lib/db';
import type { LearningScript } from '@/types';

const GENRES = ['全部', '复仇', '甜宠', '穿越', '都市', '古风', '悬疑', '职场', '校园'];
const SOURCES = ['全部', 'ReelShort', '抖音', '快手', '微信视频号'];

export default function LibraryPage() {
  const [scripts, setScripts] = useState<LearningScript[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGenre, setFilterGenre] = useState('全部');
  const [filterSource, setFilterSource] = useState('全部');
  const [selectedScript, setSelectedScript] = useState<LearningScript | null>(null);

  const loadScripts = async () => {
    setIsLoading(true);
    try {
      const data = LearningDB.getAll();
      setScripts(data);
    } catch (err) {
      setError('加载失败');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadScripts();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      const content = await file.text();
      const newScript: LearningScript = {
        id: `script_${Date.now()}`,
        title: file.name.replace('.txt', ''),
        content,
        genre: '都市',
        source: 'ReelShort',
        createdAt: new Date(),
      };

      LearningDB.create(newScript);
      await loadScripts();
    } catch (err) {
      setError('上传失败');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = (id: string) => {
    LearningDB.delete(id);
    loadScripts();
    if (selectedScript?.id === id) {
      setSelectedScript(null);
    }
  };

  const handleUpdateGenre = (id: string, genre: string) => {
    LearningDB.update(id, { genre: genre as import('@/types').Genre });
    loadScripts();
  };

  const filteredScripts = scripts.filter((script) => {
    const matchesSearch = searchQuery === '' ||
      script.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      script.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGenre = filterGenre === '全部' || script.genre === filterGenre;
    const matchesSource = filterSource === '全部' || script.source === filterSource;
    return matchesSearch && matchesGenre && matchesSource;
  });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">剧本学习库</h1>
        <p className="text-gray-500 text-sm">上传优质剧本，让AI学习并提升生成质量</p>
      </div>

      {error && (
        <Alert variant="error" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Script List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search & Filters */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索剧本..."
                  className="pl-10 border-gray-200"
                />
              </div>
              <Select value={filterGenre} onValueChange={setFilterGenre} className="w-full md:w-32">
                {GENRES.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
              </Select>
              <Select value={filterSource} onValueChange={setFilterSource} className="w-full md:w-40">
                {SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </Select>
            </div>
          </div>

          {/* Script List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filteredScripts.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 py-12 text-center">
              <BookOpen className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">暂无剧本</p>
              <p className="text-sm text-gray-400 mt-1">上传你的第一个剧本开始学习</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredScripts.map((script) => (
                <div
                  key={script.id}
                  className={`bg-white rounded-xl shadow-sm border cursor-pointer transition-colors p-4 ${
                    selectedScript?.id === script.id ? 'border-purple-300' : 'border-gray-100 hover:border-gray-200'
                  }`}
                  onClick={() => setSelectedScript(script)}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900">{script.title}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {script.genre} · {script.source}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(script.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Panel - Upload & Preview */}
        <div className="space-y-4">
          {/* Upload Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-1">
              <Upload className="h-4 w-4 text-purple-600" />
              上传剧本
            </h3>
            <p className="text-xs text-gray-500 mb-4">支持 TXT 格式的剧本文件</p>
            <label className="block">
              <input
                type="file"
                accept=".txt"
                onChange={handleUpload}
                className="hidden"
                disabled={isUploading}
              />
              <div className={`border-2 border-dashed border-gray-200 rounded-lg p-6 text-center cursor-pointer transition-colors ${
                isUploading ? 'opacity-50' : 'hover:border-purple-300 hover:bg-purple-50/50'
              }`}>
                {isUploading ? (
                  <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin text-gray-400" />
                ) : (
                  <FileText className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                )}
                <p className="text-sm text-gray-500">
                  {isUploading ? '上传中...' : '点击或拖拽上传剧本'}
                </p>
              </div>
            </label>
          </div>

          {/* Stats Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">学习统计</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">剧本总数</span>
                <span className="font-bold text-gray-900">{scripts.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">已学习</span>
                <span className="font-bold text-gray-900 flex items-center gap-1">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  {scripts.filter(s => s.featuresExtracted).length}
                </span>
              </div>
            </div>
          </div>

          {/* Preview Card */}
          {selectedScript && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">{selectedScript.title}</h3>
              <div className="mb-3">
                <Select value={selectedScript.genre} onValueChange={(v) => handleUpdateGenre(selectedScript.id, v)} className="w-24 h-8 text-xs">
                  {GENRES.filter(g => g !== '全部').map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </Select>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg max-h-64 overflow-y-auto">
                <pre className="text-xs text-gray-600 whitespace-pre-wrap">{selectedScript.content.slice(0, 1000)}</pre>
                {selectedScript.content.length > 1000 && (
                  <p className="text-xs text-gray-400 mt-2">...</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
