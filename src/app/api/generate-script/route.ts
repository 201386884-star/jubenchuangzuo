import { NextRequest, NextResponse } from 'next/server';
import { generateScriptPrompt, parseScriptResponse } from '@/lib/prompts/script';
import { chatWithConfig } from '@/lib/chat-with-config';
import { nanoid } from 'nanoid';
import type { StoryOutline, Script, Platform } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { outline, totalEpisodes = 50, platform = 'ReelShort', apiConfig, startFrom = 1 } = body;
    const episodes = totalEpisodes;

    if (!outline?.logline) {
      return NextResponse.json({ success: false, error: '缺少故事大纲' }, { status: 400 });
    }

    if (!apiConfig?.apiKey) {
      return NextResponse.json({ success: false, error: '请先在设置页面配置 API Key' }, { status: 400 });
    }

    const characters = {
      protagonist: {
        name: outline.characters.protagonist.name,
        trait: outline.characters.protagonist.trait,
        goal: outline.characters.protagonist.trait,
      },
      antagonist: {
        name: outline.characters.antagonist.name,
        trait: outline.characters.antagonist.trait,
        motivation: outline.characters.antagonist.trait,
      },
      supporter: outline.characters.supporter ? {
        name: outline.characters.supporter.name,
        trait: outline.characters.supporter.trait,
      } : undefined,
      loveInterest: outline.characters.loveInterest ? {
        name: outline.characters.loveInterest.name,
        trait: outline.characters.loveInterest.trait,
      } : undefined,
    };

    const scriptEpisodes: Script['episodes'] = [];
    let previousSummary = '';

    for (let i = startFrom; i <= episodes; i++) {
      const prompt = generateScriptPrompt({
        episodeNumber: i,
        totalEpisodes: episodes,
        genre: outline.genre as string,
        logline: outline.logline,
        characters,
        worldSetting: outline.worldSetting,
        coreConflicts: outline.coreConflicts,
        previousSummary: i > 1 ? previousSummary : undefined,
        platform,
        paymentPoints: outline.paymentPoints,
        satisfactionPointTypes: outline.satisfactionPointTypes,
      });

      try {
        const result = await chatWithConfig({
          baseUrl: apiConfig.baseUrl,
          model: apiConfig.model,
          apiKey: apiConfig.apiKey,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.85,
          maxTokens: 2048,
        });

        const parsed = parseScriptResponse(i, result.content);
        scriptEpisodes.push({
          episodeNumber: i,
          scene: parsed.scene,
          timeOfDay: '日内' as const,
          content: parsed.content,
          paymentHook: parsed.paymentHook,
          summary: parsed.summary,
        });
        previousSummary = parsed.summary;
      } catch (error) {
        console.error(`生成第${i}集失败:`, error);
        scriptEpisodes.push({
          episodeNumber: i,
          scene: '场景待定',
          timeOfDay: '日内' as const,
          content: `[第${i}集生成失败，请手动编写或重试]`,
          paymentHook: '待定',
          summary: `第${i}集内容待补充`,
        });
      }
    }

    const script: Script = {
      id: nanoid(12),
      outlineId: outline.id,
      title: outline.logline.substring(0, 30),
      platform,
      totalEpisodes: episodes,
      episodes: scriptEpisodes,
      status: 'complete',
      aiFlavorLevel: 'none',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    return NextResponse.json({ success: true, script, generatedCount: scriptEpisodes.length });
  } catch (error) {
    console.error('生成剧本失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '生成失败' },
      { status: 500 }
    );
  }
}
