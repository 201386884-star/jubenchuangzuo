'use client';

import { useState, useEffect } from 'react';
import {
  Settings, Key, Sparkles, Palette, Save, Plus, Trash2,
  CheckCircle, Loader2, Eye, EyeOff, Zap, XCircle, Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectItem } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SettingsDB } from '@/lib/db';
import { loadApiConfigs, saveApiConfigs } from '@/lib/api-configs';
import type { ApiConfig } from '@/lib/api-configs';
import { loadZhuqueConfig, saveZhuqueConfig } from '@/lib/zhuque-config';
import type { ZhuqueConfig } from '@/lib/zhuque-config';
import type { UserSettings, Platform, AIFlavorLevel } from '@/types';

const PLATFORMS = ['ReelShort', '抖音', '快手', '微信视频号'];
const AI_LEVELS = [
  { value: 'none', label: '无' },
  { value: 'light', label: '轻度' },
  { value: 'medium', label: '中度' },
  { value: 'heavy', label: '重度' },
];
const THEMES = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
  { value: 'system', label: '跟随系统' },
];

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [apiConfigs, setApiConfigs] = useState<ApiConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [defaultPlatform, setDefaultPlatform] = useState('ReelShort');
  const [defaultEpisodes, setDefaultEpisodes] = useState('50');
  const [aiFlavorPreference, setAiFlavorPreference] = useState('medium');
  const [theme, setTheme] = useState('system');
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; msg: string }>>({});

  // 朱雀API配置
  const [zhuqueConfig, setZhuqueConfig] = useState<ZhuqueConfig>({ secretId: '', secretKey: '', bizType: '', region: 'ap-guangzhou', enabled: false });
  const [showZhuqueKey, setShowZhuqueKey] = useState(false);
  const [testingZhuque, setTestingZhuque] = useState(false);
  const [zhuqueTestResult, setZhuqueTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    setIsLoading(true);
    try {
      const userSettings = SettingsDB.get();
      setSettings(userSettings);
      setApiConfigs(loadApiConfigs());
      setZhuqueConfig(loadZhuqueConfig());

      if (userSettings) {
        setDefaultPlatform(userSettings.defaultPlatform || 'ReelShort');
        setDefaultEpisodes(userSettings.defaultEpisodes?.toString() || '50');
        setAiFlavorPreference(userSettings.aiFlavorPreference || 'medium');
        setTheme(userSettings.theme || 'system');
      }
    } catch {
      setError('加载设置失败');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateConfig = (id: string, field: keyof ApiConfig, value: string) => {
    setApiConfigs(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const addConfig = () => {
    setApiConfigs(prev => [
      ...prev,
      { id: newId(), name: '', baseUrl: '', model: '', apiKey: '' },
    ]);
  };

  const removeConfig = (id: string) => {
    setApiConfigs(prev => prev.filter(c => c.id !== id));
  };

  const toggleKeyVisible = (id: string) => {
    setVisibleKeys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleTestConnection = async (config: ApiConfig) => {
    setTestingId(config.id);
    setTestResults(prev => { const next = { ...prev }; delete next[config.id]; return next; });

    try {
      const res = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      setTestResults(prev => ({ ...prev, [config.id]: { ok: data.success, msg: data.success ? data.message : data.error } }));
    } catch {
      setTestResults(prev => ({ ...prev, [config.id]: { ok: false, msg: '请求失败' } }));
    } finally {
      setTestingId(null);
    }
  };

  const handleTestZhuque = async () => {
    setTestingZhuque(true);
    setZhuqueTestResult(null);
    try {
      const res = await fetch('/api/detect-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: '这是一段测试文本，用于验证朱雀API是否配置成功。',
          zhuqueConfig: { secretId: zhuqueConfig.secretId, secretKey: zhuqueConfig.secretKey, bizType: zhuqueConfig.bizType, region: zhuqueConfig.region },
        }),
      });
      const data = await res.json();
      setZhuqueTestResult({
        ok: data.success,
        msg: data.success ? `连接成功！AI概率: ${data.aiProbability}%` : data.error,
      });
    } catch {
      setZhuqueTestResult({ ok: false, msg: '请求失败' });
    } finally {
      setTestingZhuque(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      saveApiConfigs(apiConfigs);
      saveZhuqueConfig(zhuqueConfig);

      const updatedSettings: UserSettings = {
        id: settings?.id || 'default',
        defaultModel: apiConfigs[0]?.name || 'anthropic',
        defaultPlatform: defaultPlatform as Platform,
        defaultEpisodes: parseInt(defaultEpisodes),
        aiFlavorPreference: aiFlavorPreference as AIFlavorLevel,
        theme: theme as 'light' | 'dark' | 'auto',
        updatedAt: new Date(),
      };
      SettingsDB.update(updatedSettings);

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch {
      setError('保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-10">
      <div className="max-w-3xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">设置</h1>
          <p className="text-sm text-gray-400">配置API密钥和个性化选项</p>
        </div>

        {error && (
          <div className="mb-6"><Alert variant="error"><AlertDescription>{error}</AlertDescription></Alert></div>
        )}
        {showSuccess && (
          <div className="mb-6">
            <Alert variant="success">
              <AlertDescription className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />设置已保存
              </AlertDescription>
            </Alert>
          </div>
        )}

        <div className="space-y-6">
          {/* API 密钥配置 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <Key className="h-4 w-4 text-purple-600" />
                  API 密钥配置
                </h3>
                <p className="text-xs text-gray-400 mt-1">添加或删除AI服务接口，密钥仅保存在本地浏览器</p>
              </div>
              <Button variant="outline" size="sm" onClick={addConfig}>
                <Plus className="h-4 w-4 mr-1" />添加
              </Button>
            </div>

            <div className="space-y-4">
              {apiConfigs.map((config) => (
                <div key={config.id} className="border border-gray-100 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-400">接口配置</span>
                    <button
                      type="button"
                      onClick={() => removeConfig(config.id)}
                      className="text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">名称</label>
                      <Input
                        value={config.name}
                        onChange={(e) => updateConfig(config.id, 'name', e.target.value)}
                        placeholder="如：Anthropic Claude"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">模型名</label>
                      <Input
                        value={config.model}
                        onChange={(e) => updateConfig(config.id, 'model', e.target.value)}
                        placeholder="如：claude-sonnet-4-20250514"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">接口 URL</label>
                    <Input
                      value={config.baseUrl}
                      onChange={(e) => updateConfig(config.id, 'baseUrl', e.target.value)}
                      placeholder="如：https://api.anthropic.com/v1/messages"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">API Key</label>
                    <div className="relative">
                      <Input
                        type={visibleKeys[config.id] ? 'text' : 'password'}
                        value={config.apiKey}
                        onChange={(e) => updateConfig(config.id, 'apiKey', e.target.value)}
                        placeholder="sk-..."
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => toggleKeyVisible(config.id)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {visibleKeys[config.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestConnection(config)}
                      disabled={testingId === config.id || !config.apiKey}
                    >
                      {testingId === config.id ? (
                        <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />测试中...</>
                      ) : (
                        <><Zap className="h-3.5 w-3.5 mr-1" />测试连接</>
                      )}
                    </Button>
                    {testResults[config.id] && (
                      <span className={`flex items-center gap-1 text-xs ${testResults[config.id].ok ? 'text-green-600' : 'text-red-500'}`}>
                        {testResults[config.id].ok
                          ? <><CheckCircle className="h-3.5 w-3.5" />{testResults[config.id].msg}</>
                          : <><XCircle className="h-3.5 w-3.5" />{testResults[config.id].msg}</>
                        }
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {apiConfigs.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-4">暂无接口配置，点击"添加"新增</p>
              )}
            </div>
          </div>

          {/* 朱雀AI检测配置 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-amber-600" />
                  朱雀AI检测配置
                </h3>
                <p className="text-xs text-gray-400 mt-1">腾讯云文本内容安全服务，用于检测文本AI生成概率</p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-xs text-gray-500">启用</span>
                <input
                  type="checkbox"
                  checked={zhuqueConfig.enabled}
                  onChange={e => setZhuqueConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                />
              </label>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">SecretId</label>
                  <Input
                    value={zhuqueConfig.secretId}
                    onChange={e => setZhuqueConfig(prev => ({ ...prev, secretId: e.target.value }))}
                    placeholder="腾讯云 SecretId"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">SecretKey</label>
                  <div className="relative">
                    <Input
                      type={showZhuqueKey ? 'text' : 'password'}
                      value={zhuqueConfig.secretKey}
                      onChange={e => setZhuqueConfig(prev => ({ ...prev, secretKey: e.target.value }))}
                      placeholder="腾讯云 SecretKey"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowZhuqueKey(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showZhuqueKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">BizType（业务策略）</label>
                <Input
                  value={zhuqueConfig.bizType || ''}
                  onChange={e => setZhuqueConfig(prev => ({ ...prev, bizType: e.target.value }))}
                  placeholder="一般填 default，或从控制台获取自定义策略"
                />
                <p className="text-[11px] text-gray-400 mt-1">前往腾讯云控制台 → 内容安全 → 业务配置 → 查看 BizType。默认策略填 default 即可</p>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">地域</label>
                <select
                  value={zhuqueConfig.region}
                  onChange={e => setZhuqueConfig(prev => ({ ...prev, region: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                >
                  <option value="ap-guangzhou">广州 (ap-guangzhou)</option>
                  <option value="ap-shanghai">上海 (ap-shanghai)</option>
                  <option value="ap-beijing">北京 (ap-beijing)</option>
                </select>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestZhuque}
                  disabled={testingZhuque || !zhuqueConfig.secretId || !zhuqueConfig.secretKey}
                >
                  {testingZhuque ? (
                    <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />测试中...</>
                  ) : (
                    <><Zap className="h-3.5 w-3.5 mr-1" />测试连接</>
                  )}
                </Button>
                {zhuqueTestResult && (
                  <span className={`flex items-center gap-1 text-xs ${zhuqueTestResult.ok ? 'text-green-600' : 'text-red-500'}`}>
                    {zhuqueTestResult.ok
                      ? <><CheckCircle className="h-3.5 w-3.5" />{zhuqueTestResult.msg}</>
                      : <><XCircle className="h-3.5 w-3.5" />{zhuqueTestResult.msg}</>
                    }
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 默认生成设置 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="mb-5">
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-600" />
                默认生成设置
              </h3>
              <p className="text-xs text-gray-400 mt-1">设置生成剧本时的默认参数</p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1.5 block">默认平台</label>
                <Select value={defaultPlatform} onValueChange={setDefaultPlatform}>
                  {PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1.5 block">默认集数</label>
                <Select value={defaultEpisodes} onValueChange={setDefaultEpisodes}>
                  <SelectItem value="20">20集</SelectItem>
                  <SelectItem value="30">30集</SelectItem>
                  <SelectItem value="50">50集</SelectItem>
                  <SelectItem value="60">60集</SelectItem>
                  <SelectItem value="80">80集</SelectItem>
                  <SelectItem value="100">100集</SelectItem>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1.5 block">默认剧本润色</label>
                <Select value={aiFlavorPreference} onValueChange={setAiFlavorPreference}>
                  {AI_LEVELS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                </Select>
              </div>
            </div>
          </div>

          {/* 外观 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="mb-5">
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <Palette className="h-4 w-4 text-purple-600" />
                外观
              </h3>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">主题</label>
              <Select value={theme} onValueChange={setTheme} className="w-48">
                {THEMES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </Select>
            </div>
          </div>

          {/* 保存按钮 */}
          <Button size="lg" className="w-full" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />保存中...</>
            ) : (
              <><Save className="mr-2 h-4 w-4" />保存设置</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
