import { NextRequest } from 'next/server';
import { generateScriptPrompt, parseScriptResponse } from '@/lib/prompts/script';
import { chatStream } from '@/lib/chat-with-config';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { outline, episodeNumber, totalEpisodes, platform, apiConfig, previousContent, previousSummary, userGuidance, episodeDuration } = body;

  if (!outline?.logline && !outline?.title) {
    return new Response(JSON.stringify({ success: false, error: '缺少故事大纲' }), { status: 400 });
  }
  if (!apiConfig?.apiKey) {
    return new Response(JSON.stringify({ success: false, error: '请先在设置页面配置 API Key' }), { status: 400 });
  }

  const characters = {
    protagonist: {
      name: outline.characters?.protagonist?.name || '主角',
      trait: outline.characters?.protagonist?.trait || '',
      goal: outline.characters?.protagonist?.goal || outline.characters?.protagonist?.trait || '',
      goldenFinger: outline.characters?.protagonist?.goldenFinger,
    },
    antagonist: {
      name: outline.characters?.antagonist?.name || '反派',
      trait: outline.characters?.antagonist?.trait || '',
      motivation: outline.characters?.antagonist?.motivation || outline.characters?.antagonist?.trait || '',
    },
    supporter: outline.characters?.supporter ? {
      name: outline.characters.supporter.name,
      trait: outline.characters.supporter.trait,
    } : undefined,
    loveInterest: outline.characters?.loveInterest ? {
      name: outline.characters.loveInterest.name,
      trait: outline.characters.loveInterest.trait,
    } : undefined,
    secondaryVillain: outline.characters?.secondaryVillain ? {
      name: outline.characters.secondaryVillain.name,
      trait: outline.characters.secondaryVillain.trait,
    } : undefined,
  };

  const prompt = generateScriptPrompt({
    episodeNumber,
    totalEpisodes: totalEpisodes || 50,
    genre: outline.genre as string || '都市',
    logline: outline.logline || outline.title || '',
    characters,
    worldSetting: outline.worldSetting || '现代都市',
    coreConflicts: outline.coreConflicts || [],
    previousSummary,
    previousContent: previousContent || undefined,
    platform: platform || 'ReelShort',
    paymentPoints: outline.paymentPoints,
    satisfactionPointTypes: outline.satisfactionPointTypes,
    userGuidance,
    episodeOutline: outline.episodeOutlines?.find?.((ep: any) => ep.episodeNumber === episodeNumber),
    nextEpisodeOutline: outline.episodeOutlines?.find?.((ep: any) => ep.episodeNumber === episodeNumber + 1),
    episodeDuration: episodeDuration || outline.episodeDuration || 1,
  });

  // SSE 流式响应
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        await chatStream(
          {
            baseUrl: apiConfig.baseUrl,
            model: apiConfig.model,
            apiKey: apiConfig.apiKey,
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.85,
            maxTokens: 16384,
          },
          {
            onToken(token) {
              send({ type: 'token', content: token });
            },
            onDone(fullContent) {
              // 解析完整内容
              const parsed = parseScriptResponse(episodeNumber, fullContent);
              send({
                type: 'done',
                episode: {
                  episodeNumber,
                  scene: parsed.scene,
                  timeOfDay: '日内',
                  content: parsed.content,
                  paymentHook: parsed.paymentHook,
                  summary: parsed.summary,
                  isComplete: parsed.isComplete,
                },
              });
              controller.close();
            },
            onError(err) {
              send({ type: 'error', error: err.message });
              controller.close();
            },
          },
        );
      } catch (err) {
        send({ type: 'error', error: err instanceof Error ? err.message : '生成失败' });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
