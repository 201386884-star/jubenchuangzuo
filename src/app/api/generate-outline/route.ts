import { NextRequest, NextResponse } from 'next/server';
import { generateOutlinePrompt, parseOutlineResponse } from '@/lib/prompts/outline';
import { chatWithConfig } from '@/lib/chat-with-config';
import { nanoid } from 'nanoid';
import type { StoryOutline, Genre, Platform } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userInput, genre, platform, totalEpisodes, apiConfig } = body;

    if (!userInput?.trim()) {
      return NextResponse.json({ success: false, error: '请输入故事描述' }, { status: 400 });
    }

    if (!apiConfig?.apiKey) {
      return NextResponse.json({ success: false, error: '请先在设置页面配置 API Key' }, { status: 400 });
    }

    const prompt = generateOutlinePrompt({ userInput, genre, platform, totalEpisodes });

    const result = await chatWithConfig({
      baseUrl: apiConfig.baseUrl,
      model: apiConfig.model,
      apiKey: apiConfig.apiKey,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      maxTokens: 16384,
    });

    const parsed = parseOutlineResponse(result.content);

    const outline: StoryOutline = {
      id: nanoid(12),
      userInput,
      genre: parsed.genre || genre || '都市',
      logline: parsed.logline || userInput,
      title: parsed.title,
      alternativeTitles: parsed.alternativeTitles,
      synopsis: parsed.synopsis,
      formula: parsed.formula,
      targetAudience: parsed.targetAudience,
      characters: {
        protagonist: {
          name: parsed.characters?.protagonist?.name || '主角',
          trait: parsed.characters?.protagonist?.trait || '',
          role: 'protagonist',
          gender: parsed.characters?.protagonist?.gender,
          age: parsed.characters?.protagonist?.age,
          backstory: parsed.characters?.protagonist?.backstory,
          goldenFinger: parsed.characters?.protagonist?.goldenFinger,
          goal: parsed.characters?.protagonist?.goal,
          arc: parsed.characters?.protagonist?.arc,
        },
        antagonist: {
          name: parsed.characters?.antagonist?.name || '反派',
          trait: parsed.characters?.antagonist?.trait || '',
          role: 'antagonist',
          motivation: parsed.characters?.antagonist?.motivation,
          threatLevel: parsed.characters?.antagonist?.threatLevel,
          arc: parsed.characters?.antagonist?.arc,
        },
        supporter: parsed.characters?.supporter ? {
          name: parsed.characters.supporter.name,
          trait: parsed.characters.supporter.trait || '',
          role: 'supporter',
        } : undefined,
        loveInterest: parsed.characters?.loveInterest ? {
          name: parsed.characters.loveInterest.name,
          trait: parsed.characters.loveInterest.trait || '',
          role: 'love_interest',
        } : undefined,
        secondaryVillain: parsed.characters?.secondaryVillain,
        mentor: parsed.characters?.mentor,
      },
      worldSetting: parsed.worldSetting || '现代都市',
      coreConflicts: parsed.coreConflicts || [],
      plotStructure: parsed.plotStructure || { setup: '', development: '', climax: '', resolution: '' },
      episodeOutline: parsed.episodeOutline,
      episodeOutlines: parsed.episodeOutlines,  // 详细分集梗概
      paymentPoints: parsed.paymentPoints || [5, 15, 25, 40],
      satisfactionPointTypes: parsed.satisfactionPointTypes,
      emotionalArc: parsed.emotionalArc || '',
      buzzScenes: parsed.buzzScenes,
      createdAt: new Date(),
    };

    return NextResponse.json({ success: true, outline });
  } catch (error) {
    console.error('生成大纲失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '生成失败' },
      { status: 500 }
    );
  }
}
