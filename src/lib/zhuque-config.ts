'use client';

export interface ZhuqueConfig {
  secretId: string;
  secretKey: string;
  bizType: string;
  region: string;
  enabled: boolean;
}

const STORAGE_KEY = 'short-drama-zhuque-config';

export function loadZhuqueConfig(): ZhuqueConfig {
  if (typeof window === 'undefined') {
    return { secretId: '', secretKey: '', bizType: '', region: 'ap-guangzhou', enabled: false };
  }
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) return JSON.parse(data);
  return { secretId: '', secretKey: '', bizType: '', region: 'ap-guangzhou', enabled: false };
}

export function saveZhuqueConfig(config: ZhuqueConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}
