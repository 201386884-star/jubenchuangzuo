// ============================================================
// 模型配置 API
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAvailableModels, getProviderDisplayName, getDefaultModel } from '@/lib/models';
import type { ModelProvider } from '@/types';

export async function GET() {
  const models = getAvailableModels();
  const result = models.map(group => ({
    provider: group.provider,
    providerName: getProviderDisplayName(group.provider),
    models: group.models.map(m => ({
      id: m.id,
      name: m.name,
      isDefault: m.id === getDefaultModel(group.provider),
    })),
  }));

  return NextResponse.json({
    success: true,
    models: result,
    defaultProvider: 'anthropic' as ModelProvider,
    defaultModel: getDefaultModel('anthropic'),
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider, modelName, apiKey, settings } = body;

    // 保存模型配置到本地存储
    // 这里可以扩展为保存到数据库
    return NextResponse.json({
      success: true,
      message: '配置已保存',
    });
  } catch (error) {
    console.error('保存配置失败:', error);
    return NextResponse.json(
      { success: false, error: '保存失败' },
      { status: 500 }
    );
  }
}