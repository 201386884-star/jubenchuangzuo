import { NextRequest, NextResponse } from 'next/server';
import { generateEvaluationPrompt, parseEvaluationResponse } from '@/lib/prompts/evaluation';
import { chatWithConfig } from '@/lib/chat-with-config';
import { nanoid } from 'nanoid';
import type { Script, Platform, ScriptEvaluation } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { script, platform = 'ReelShort', apiConfig } = body;

    if (!script?.episodes?.length) {
      return NextResponse.json({ success: false, error: '请提供剧本内容' }, { status: 400 });
    }

    if (!apiConfig?.apiKey) {
      return NextResponse.json({ success: false, error: '请先在设置页面配置 API Key' }, { status: 400 });
    }

    const scriptContent = script.episodes
      .map((ep: any) => `[第${ep.episodeNumber}集]\n${ep.content}`)
      .join('\n\n');

    const prompt = generateEvaluationPrompt({
      genre: script.title || '都市',
      platform,
      totalEpisodes: script.totalEpisodes,
      scriptContent,
    });

    const result = await chatWithConfig({
      baseUrl: apiConfig.baseUrl,
      model: apiConfig.model,
      apiKey: apiConfig.apiKey,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      maxTokens: 4096,
    });

    const parsed = parseEvaluationResponse(result.content);

    const evaluation: ScriptEvaluation = {
      id: nanoid(12),
      scriptId: script.id,
      overallScore: parsed.overallScore || 0,
      dimensionScores: {
        hook: {
          score: parsed.dimensionScores?.hook?.score || 0,
          comment: parsed.dimensionScores?.hook?.comment || '',
        },
        emotionDensity: {
          score: parsed.dimensionScores?.emotion_density?.score || 0,
          comment: parsed.dimensionScores?.emotion_density?.comment || '',
        },
        twistDesign: {
          score: parsed.dimensionScores?.twist_design?.score || 0,
          comment: parsed.dimensionScores?.twist_design?.comment || '',
        },
        paymentDesign: {
          score: parsed.dimensionScores?.payment_design?.score || 0,
          comment: parsed.dimensionScores?.payment_design?.comment || '',
        },
        dialogueNaturalness: {
          score: parsed.dimensionScores?.dialogue_naturalness?.score || 0,
          comment: parsed.dimensionScores?.dialogue_naturalness?.comment || '',
        },
        marketAdaptation: {
          score: parsed.dimensionScores?.market_adaptation?.score || 0,
          comment: parsed.dimensionScores?.market_adaptation?.comment || '',
        },
      },
      strengths: parsed.strengths || [],
      weaknesses: parsed.weaknesses || [],
      improvementSuggestions: parsed.improvementSuggestions || [],
      marketPositioning: parsed.marketPositioning || '',
      createdAt: new Date(),
    };

    return NextResponse.json({ success: true, evaluation });
  } catch (error) {
    console.error('评估失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '评估失败' },
      { status: 500 }
    );
  }
}
