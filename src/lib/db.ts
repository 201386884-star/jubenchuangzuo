// ============================================================
// 本地存储数据库 - 使用 localStorage 模拟数据库
// ============================================================

import { nanoid } from 'nanoid';
import type {
  StoryOutline,
  Script,
  ScriptEvaluation,
  ModelConfig,
  LearningScript,
  UserSettings,
  Platform,
  AIFlavorLevel,
  Genre,
} from '@/types';

const STORAGE_KEYS = {
  OUTLINES: 'short-drama-outlines',
  SCRIPTS: 'short-drama-scripts',
  EVALUATIONS: 'short-drama-evaluations',
  MODELS: 'short-drama-models',
  LEARNING: 'short-drama-learning',
  SETTINGS: 'short-drama-settings',
};

// -------------------- 辅助函数 --------------------

function getStorage<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
}

function setStorage<T>(key: string, data: T[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(data));
}

function generateId(): string {
  return nanoid(12);
}

// -------------------- 故事大纲 --------------------

export const OutlineDB = {
  create(userInput: string): StoryOutline {
    const outline: StoryOutline = {
      id: generateId(),
      userInput,
      genre: '都市',
      logline: '',
      characters: {
        protagonist: { name: '', trait: '', role: 'protagonist' },
        antagonist: { name: '', trait: '', role: 'antagonist' },
      },
      worldSetting: '',
      coreConflicts: [],
      plotStructure: { setup: '', development: '', climax: '', resolution: '' },
      paymentPoints: [],
      emotionalArc: '',
      createdAt: new Date(),
    };

    const outlines = getStorage<StoryOutline>(STORAGE_KEYS.OUTLINES);
    outlines.push(outline);
    setStorage(STORAGE_KEYS.OUTLINES, outlines);

    return outline;
  },

  update(id: string, updates: Partial<StoryOutline>): StoryOutline | null {
    const outlines = getStorage<StoryOutline>(STORAGE_KEYS.OUTLINES);
    const index = outlines.findIndex(o => o.id === id);
    if (index === -1) return null;

    outlines[index] = { ...outlines[index], ...updates };
    setStorage(STORAGE_KEYS.OUTLINES, outlines);

    return outlines[index];
  },

  getById(id: string): StoryOutline | null {
    const outlines = getStorage<StoryOutline>(STORAGE_KEYS.OUTLINES);
    return outlines.find(o => o.id === id) || null;
  },

  getAll(): StoryOutline[] {
    return getStorage<StoryOutline>(STORAGE_KEYS.OUTLINES);
  },

  delete(id: string): boolean {
    const outlines = getStorage<StoryOutline>(STORAGE_KEYS.OUTLINES);
    const filtered = outlines.filter(o => o.id !== id);
    if (filtered.length === outlines.length) return false;
    setStorage(STORAGE_KEYS.OUTLINES, filtered);
    return true;
  },
};

// -------------------- 剧本 --------------------

export const ScriptDB = {
  create(outlineId: string, title: string, platform: Platform, totalEpisodes: number): Script {
    const script: Script = {
      id: generateId(),
      outlineId,
      title,
      platform,
      totalEpisodes,
      episodes: [],
      status: 'draft',
      aiFlavorLevel: 'none',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const scripts = getStorage<Script>(STORAGE_KEYS.SCRIPTS);
    scripts.push(script);
    setStorage(STORAGE_KEYS.SCRIPTS, scripts);

    return script;
  },

  update(id: string, updates: Partial<Script>): Script | null {
    const scripts = getStorage<Script>(STORAGE_KEYS.SCRIPTS);
    const index = scripts.findIndex(s => s.id === id);
    if (index === -1) return null;

    scripts[index] = { ...scripts[index], ...updates, updatedAt: new Date() };
    setStorage(STORAGE_KEYS.SCRIPTS, scripts);

    return scripts[index];
  },

  getById(id: string): Script | null {
    const scripts = getStorage<Script>(STORAGE_KEYS.SCRIPTS);
    return scripts.find(s => s.id === id) || null;
  },

  getByOutlineId(outlineId: string): Script[] {
    const scripts = getStorage<Script>(STORAGE_KEYS.SCRIPTS);
    return scripts.filter(s => s.outlineId === outlineId);
  },

  getAll(): Script[] {
    return getStorage<Script>(STORAGE_KEYS.SCRIPTS);
  },

  delete(id: string): boolean {
    const scripts = getStorage<Script>(STORAGE_KEYS.SCRIPTS);
    const filtered = scripts.filter(s => s.id !== id);
    if (filtered.length === scripts.length) return false;
    setStorage(STORAGE_KEYS.SCRIPTS, filtered);
    return true;
  },

  addEpisode(scriptId: string, episode: Script['episodes'][0]): boolean {
    const scripts = getStorage<Script>(STORAGE_KEYS.SCRIPTS);
    const script = scripts.find(s => s.id === scriptId);
    if (!script) return false;

    script.episodes.push(episode);
    script.updatedAt = new Date();
    setStorage(STORAGE_KEYS.SCRIPTS, scripts);
    return true;
  },
};

// -------------------- 评估 --------------------

export const EvaluationDB = {
  create(scriptId: string, evaluation: Omit<ScriptEvaluation, 'id' | 'createdAt'>): ScriptEvaluation {
    const record: ScriptEvaluation = {
      ...evaluation,
      id: generateId(),
      createdAt: new Date(),
    };

    const evaluations = getStorage<ScriptEvaluation>(STORAGE_KEYS.EVALUATIONS);
    evaluations.push(record);
    setStorage(STORAGE_KEYS.EVALUATIONS, evaluations);

    return record;
  },

  getByScriptId(scriptId: string): ScriptEvaluation[] {
    const evaluations = getStorage<ScriptEvaluation>(STORAGE_KEYS.EVALUATIONS);
    return evaluations.filter(e => e.scriptId === scriptId);
  },

  delete(id: string): boolean {
    const evaluations = getStorage<ScriptEvaluation>(STORAGE_KEYS.EVALUATIONS);
    const filtered = evaluations.filter(e => e.id !== id);
    if (filtered.length === evaluations.length) return false;
    setStorage(STORAGE_KEYS.EVALUATIONS, filtered);
    return true;
  },
};

// -------------------- 模型配置 --------------------

export const ModelDB = {
  create(config: Omit<ModelConfig, 'id' | 'createdAt'>): ModelConfig {
    const record: ModelConfig = {
      ...config,
      id: generateId(),
      createdAt: new Date(),
    };

    const models = getStorage<ModelConfig>(STORAGE_KEYS.MODELS);
    models.push(record);
    setStorage(STORAGE_KEYS.MODELS, models);

    return record;
  },

  getAll(): ModelConfig[] {
    return getStorage<ModelConfig>(STORAGE_KEYS.MODELS);
  },

  getDefault(): ModelConfig | null {
    const models = getStorage<ModelConfig>(STORAGE_KEYS.MODELS);
    return models.find(m => m.isDefault) || models[0] || null;
  },

  setDefault(id: string): boolean {
    const models = getStorage<ModelConfig>(STORAGE_KEYS.MODELS);
    models.forEach(m => (m.isDefault = m.id === id));
    setStorage(STORAGE_KEYS.MODELS, models);
    return true;
  },

  delete(id: string): boolean {
    const models = getStorage<ModelConfig>(STORAGE_KEYS.MODELS);
    const filtered = models.filter(m => m.id !== id);
    if (filtered.length === models.length) return false;
    setStorage(STORAGE_KEYS.MODELS, filtered);
    return true;
  },

  // 初始化默认模型
  initDefaults(): void {
    const existing = getStorage<ModelConfig>(STORAGE_KEYS.MODELS);
    if (existing.length > 0) return;

    const defaults: ModelConfig[] = [
      {
        id: generateId(),
        provider: 'anthropic',
        modelName: 'claude-sonnet-4-20250514',
        isDefault: true,
        settings: { temperature: 0.8, maxTokens: 4096 },
        createdAt: new Date(),
      },
      {
        id: generateId(),
        provider: 'openai',
        modelName: 'gpt-4o-mini',
        isDefault: false,
        settings: { temperature: 0.8, maxTokens: 4096 },
        createdAt: new Date(),
      },
    ];

    setStorage(STORAGE_KEYS.MODELS, defaults);
  },
};

// -------------------- 学习库 --------------------

export const LearningDB = {
  create(script: Omit<LearningScript, 'id' | 'createdAt'>): LearningScript {
    const record: LearningScript = {
      ...script,
      id: generateId(),
      createdAt: new Date(),
    };

    const scripts = getStorage<LearningScript>(STORAGE_KEYS.LEARNING);
    scripts.push(record);
    setStorage(STORAGE_KEYS.LEARNING, scripts);

    return record;
  },

  update(id: string, updates: Partial<LearningScript>): LearningScript | null {
    const scripts = getStorage<LearningScript>(STORAGE_KEYS.LEARNING);
    const index = scripts.findIndex(s => s.id === id);
    if (index === -1) return null;

    scripts[index] = { ...scripts[index], ...updates };
    setStorage(STORAGE_KEYS.LEARNING, scripts);
    return scripts[index];
  },

  getAll(): LearningScript[] {
    return getStorage<LearningScript>(STORAGE_KEYS.LEARNING);
  },

  getByGenre(genre: Genre): LearningScript[] {
    const scripts = getStorage<LearningScript>(STORAGE_KEYS.LEARNING);
    return scripts.filter(s => s.genre === genre);
  },

  delete(id: string): boolean {
    const scripts = getStorage<LearningScript>(STORAGE_KEYS.LEARNING);
    const filtered = scripts.filter(s => s.id !== id);
    if (filtered.length === scripts.length) return false;
    setStorage(STORAGE_KEYS.LEARNING, filtered);
    return true;
  },
};

// -------------------- 用户设置 --------------------

export const SettingsDB = {
  get(): UserSettings {
    if (typeof window === 'undefined') {
      return {
        id: 'default',
        defaultPlatform: 'ReelShort',
        defaultEpisodes: 50,
        aiFlavorPreference: 'medium',
        theme: 'auto',
        updatedAt: new Date(),
      };
    }

    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (data) return JSON.parse(data);

    const defaults: UserSettings = {
      id: 'default',
      defaultPlatform: 'ReelShort',
      defaultEpisodes: 50,
      aiFlavorPreference: 'medium',
      theme: 'auto',
      updatedAt: new Date(),
    };

    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(defaults));
    return defaults;
  },

  update(updates: Partial<UserSettings>): UserSettings {
    const current = this.get();
    const updated = { ...current, ...updates, updatedAt: new Date() };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
    return updated;
  },
};

// -------------------- 初始化 --------------------

export function initDatabase(): void {
  ModelDB.initDefaults();
  SettingsDB.get();
}

export { STORAGE_KEYS };