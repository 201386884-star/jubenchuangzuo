'use client';

export interface ApiConfig {
  id: string;
  name: string;
  baseUrl: string;
  model: string;
  apiKey: string;
}

const STORAGE_KEY = 'short-drama-api-configs';

export function loadApiConfigs(): ApiConfig[] {
  if (typeof window === 'undefined') return [];
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) return JSON.parse(data);
  return [
    { id: '1', name: 'Anthropic Claude', baseUrl: 'https://api.anthropic.com/v1/messages', model: 'claude-sonnet-4-20250514', apiKey: '' },
    { id: '2', name: 'OpenAI GPT', baseUrl: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini', apiKey: '' },
  ];
}

export function saveApiConfigs(configs: ApiConfig[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
}

export function getApiConfigById(id: string): ApiConfig | undefined {
  return loadApiConfigs().find(c => c.id === id);
}
