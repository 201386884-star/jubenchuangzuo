// ============================================================
// 剧本润色历史记录存储层 —— 基于 localStorage
// ============================================================

import { nanoid } from 'nanoid';
import type { DeAISession, DeAIRound, AIFlavorLevel } from '@/types';

const STORAGE_KEY = 'short-drama-deai-sessions';

function getAll(): DeAISession[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveAll(sessions: DeAISession[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export const DeAIDB = {
  create(params: {
    originalContent: string;
    level: AIFlavorLevel;
    dialectStyle: string;
    genre?: string;
    apiModelName: string;
    enablePostProcess: boolean;
    iterationMode: 'manual' | 'auto';
    maxIterations?: number;
    targetProbability?: number;
  }): DeAISession {
    const now = new Date().toISOString();
    const preview = params.originalContent.slice(0, 20).replace(/\n/g, ' ');
    const levelLabel = { none: '', light: '轻度', medium: '中度', heavy: '重度' }[params.level] || '';
    const dialectLabel = params.dialectStyle && params.dialectStyle !== 'none' ? ` · ${params.dialectStyle}` : '';
    const title = `${preview}... · ${levelLabel}${dialectLabel}`;

    const session: DeAISession = {
      id: nanoid(12),
      title,
      originalContent: params.originalContent,
      finalContent: '',
      config: {
        level: params.level,
        dialectStyle: params.dialectStyle,
        genre: params.genre,
        apiModelName: params.apiModelName,
        enablePostProcess: params.enablePostProcess,
        iterationMode: params.iterationMode,
        maxIterations: params.maxIterations,
        targetProbability: params.targetProbability,
      },
      rounds: [],
      status: 'processing',
      tags: [],
      createdAt: now,
      updatedAt: now,
    };

    const sessions = getAll();
    sessions.unshift(session);
    saveAll(sessions);
    return session;
  },

  update(id: string, updates: Partial<DeAISession>): DeAISession | null {
    const sessions = getAll();
    const idx = sessions.findIndex(s => s.id === id);
    if (idx === -1) return null;
    sessions[idx] = { ...sessions[idx], ...updates, updatedAt: new Date().toISOString() };
    saveAll(sessions);
    return sessions[idx];
  },

  getById(id: string): DeAISession | null {
    return getAll().find(s => s.id === id) || null;
  },

  getAll(): DeAISession[] {
    return getAll();
  },

  delete(id: string): boolean {
    const sessions = getAll();
    const filtered = sessions.filter(s => s.id !== id);
    if (filtered.length === sessions.length) return false;
    saveAll(filtered);
    return true;
  },

  addRound(id: string, round: DeAIRound): DeAISession | null {
    const sessions = getAll();
    const idx = sessions.findIndex(s => s.id === id);
    if (idx === -1) return null;
    sessions[idx].rounds.push(round);
    sessions[idx].updatedAt = new Date().toISOString();
    saveAll(sessions);
    return sessions[idx];
  },

  updateTags(id: string, tags: string[]): DeAISession | null {
    return this.update(id, { tags });
  },

  clear(): void {
    saveAll([]);
  },
};
