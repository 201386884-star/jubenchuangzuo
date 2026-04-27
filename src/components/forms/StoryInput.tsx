'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectItem } from '@/components/ui/select';
import { loadApiConfigs } from '@/lib/api-configs';
import type { ApiConfig } from '@/lib/api-configs';

interface StoryInputProps {
  onSubmit: (data: {
    userInput: string;
    genre: string;
    episodes: number;
    episodeDuration: number;
    orientation: 'vertical' | 'horizontal';
    platform: string;
    modelProvider: string;
  }) => void;
  isLoading: boolean;
}

const genres = ['复仇', '甜宠', '穿越', '都市', '古风', '悬疑', '职场', '校园'];
const maleGenres = ['逆袭', '赘婿', '战神', '重生', '系统', '玄幻', '都市', '悬疑'];
const femaleGenres = ['复仇', '甜宠', '穿越', '豪门', '古风', '虐恋', '职场', '校园'];
const platforms = ['红果短剧', 'ReelShort', '抖音', '快手', '微信视频号'];

export default function StoryInput({ onSubmit, isLoading }: StoryInputProps) {
  const [userInput, setUserInput] = useState('');
  const [category, setCategory] = useState<'female' | 'male'>('female');
  const [orientation, setOrientation] = useState<'vertical' | 'horizontal'>('vertical');
  const [genre, setGenre] = useState('复仇');
  const [customGenre, setCustomGenre] = useState('');
  const [showCustomGenre, setShowCustomGenre] = useState(false);
  const [episodes, setEpisodes] = useState('60');
  const [customEpisodes, setCustomEpisodes] = useState('');
  const [showCustomEpisodes, setShowCustomEpisodes] = useState(false);
  const [episodeDuration, setEpisodeDuration] = useState('1');
  const [customDuration, setCustomDuration] = useState('');
  const [showCustomDuration, setShowCustomDuration] = useState(false);
  const [platform, setPlatform] = useState('红果短剧');
  const [modelProvider, setModelProvider] = useState('anthropic');
  const [models, setModels] = useState<ApiConfig[]>([]);

  useEffect(() => {
    const configs = loadApiConfigs();
    setModels(configs);
    if (configs.length > 0 && !configs.find(c => c.id === modelProvider)) {
      setModelProvider(configs[0].id);
    }
  }, []);

  const currentGenres = category === 'male' ? maleGenres : femaleGenres;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim()) return;
    onSubmit({
      userInput: userInput.trim(),
      genre: showCustomGenre ? (customGenre.trim() || '都市') : genre,
      episodes: showCustomEpisodes ? parseInt(customEpisodes, 10) || 60 : parseInt(episodes, 10),
      episodeDuration: showCustomDuration ? parseFloat(customDuration) || 1 : parseFloat(episodeDuration),
      orientation,
      platform,
      modelProvider,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* 文本输入 */}
      <div className="relative">
        <textarea
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="一句话描述你的故事... 例如：女主被陷害失去一切，重生后步步为营复仇成功"
          style={{ borderColor: '#e5e7eb' }}
          className="w-full h-24 p-4 rounded-lg border bg-white text-sm text-gray-700 resize-none focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 placeholder:text-gray-400"
          disabled={isLoading}
        />
        <span className="absolute bottom-3 right-3 text-xs text-gray-300">{userInput.length}/500</span>
      </div>

      {/* 类目选择：男频 / 女频 */}
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-gray-500">类目</label>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {[
            { key: 'female' as const, label: '女频' },
            { key: 'male' as const, label: '男频' },
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setCategory(key);
                setGenre(key === 'male' ? maleGenres[0] : femaleGenres[0]);
              }}
              disabled={isLoading}
              className={`px-4 py-1.5 text-xs font-medium transition-colors ${
                category === key
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="text-xs font-medium text-gray-500 ml-4">屏幕</label>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {[
            { key: 'vertical' as const, label: '竖屏' },
            { key: 'horizontal' as const, label: '横屏' },
          ].map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setOrientation(key)}
              disabled={isLoading}
              className={`px-4 py-1.5 text-xs font-medium transition-colors ${
                orientation === key
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-5 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1.5 block">类型</label>
          <Select value={showCustomGenre ? 'custom' : genre} onValueChange={(v) => {
            if (v === 'custom') {
              setShowCustomGenre(true);
            } else {
              setShowCustomGenre(false);
              setGenre(v);
            }
          }} disabled={isLoading}>
            {currentGenres.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
            <SelectItem value="custom">自定义</SelectItem>
          </Select>
          {showCustomGenre && (
            <input
              type="text"
              value={customGenre}
              onChange={(e) => setCustomGenre(e.target.value)}
              placeholder="输入类型"
              disabled={isLoading}
              style={{ borderColor: '#e5e7eb' }}
              className="mt-2 h-9 w-full rounded-lg border bg-white px-3 text-sm text-gray-700 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
            />
          )}
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1.5 block">集数</label>
          <Select value={showCustomEpisodes ? 'custom' : episodes} onValueChange={(v) => {
            if (v === 'custom') {
              setShowCustomEpisodes(true);
            } else {
              setShowCustomEpisodes(false);
              setEpisodes(v);
            }
          }} disabled={isLoading}>
            <SelectItem value="20">20集</SelectItem>
            <SelectItem value="30">30集</SelectItem>
            <SelectItem value="50">50集</SelectItem>
            <SelectItem value="60">60集</SelectItem>
            <SelectItem value="80">80集</SelectItem>
            <SelectItem value="100">100集</SelectItem>
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
              disabled={isLoading}
              style={{ borderColor: '#e5e7eb' }}
              className="mt-2 h-9 w-full rounded-lg border bg-white px-3 text-sm text-gray-700 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
            />
          )}
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1.5 block">每集时长</label>
          <Select value={showCustomDuration ? 'custom' : episodeDuration} onValueChange={(v) => {
            if (v === 'custom') {
              setShowCustomDuration(true);
            } else {
              setShowCustomDuration(false);
              setEpisodeDuration(v);
            }
          }} disabled={isLoading}>
            <SelectItem value="1">1分钟</SelectItem>
            <SelectItem value="2">2分钟</SelectItem>
            <SelectItem value="3">3分钟</SelectItem>
            <SelectItem value="5">5分钟</SelectItem>
            <SelectItem value="custom">自定义</SelectItem>
          </Select>
          {showCustomDuration && (
            <input
              type="number"
              min="0.5"
              max="30"
              step="0.5"
              value={customDuration}
              onChange={(e) => setCustomDuration(e.target.value)}
              placeholder="分钟"
              disabled={isLoading}
              style={{ borderColor: '#e5e7eb' }}
              className="mt-2 h-9 w-full rounded-lg border bg-white px-3 text-sm text-gray-700 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
            />
          )}
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1.5 block">平台</label>
          <Select value={platform} onValueChange={setPlatform} disabled={isLoading}>
            {platforms.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1.5 block">AI模型</label>
          <Select value={modelProvider} onValueChange={setModelProvider} disabled={isLoading}>
            {models.map((m) => <SelectItem key={m.id} value={m.id}>{m.name || m.model}</SelectItem>)}
          </Select>
        </div>
      </div>

      {/* 按钮 */}
      <Button type="submit" size="lg" className="w-full" disabled={isLoading || !userInput.trim()}>
        {isLoading ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />生成中...</>
        ) : (
          <><Sparkles className="mr-2 h-4 w-4" />生成剧本</>
        )}
      </Button>
    </form>
  );
}
