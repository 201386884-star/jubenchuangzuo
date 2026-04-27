import { NextRequest, NextResponse } from 'next/server';
import { generateDeAIPrompt } from '@/lib/prompts/deai';
import { deaiPostProcess } from '@/lib/deai-post-process';
import { chatWithConfig } from '@/lib/chat-with-config';
import type { AIFlavorLevel } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      content,
      level = 'medium',
      genre,
      dialectStyle = 'none',
      apiConfig,
      enablePostProcess = true,
      // 迭代参数
      previousResult,
      previousAiProbability,
      iterationRound = 1,
    } = body;

    if (!content?.trim()) {
      return NextResponse.json({ success: false, error: '请输入要处理的内容' }, { status: 400 });
    }

    if (level === 'none') {
      return NextResponse.json({
        success: true,
        deAIedContent: content,
        stats: { connectorsReplaced: 0, sentencesModified: 0, imperfectionsInjected: 0, formatPreserved: 0 },
        modifications: ['未做任何处理'],
      });
    }

    if (!apiConfig?.apiKey) {
      return NextResponse.json({ success: false, error: '请先在设置页面配置 API Key' }, { status: 400 });
    }

    // 第一层：LLM 语义改写
    const prompt = generateDeAIPrompt({
      originalContent: content,
      level: level as AIFlavorLevel,
      genre,
      dialectStyle,
      previousResult,
      previousAiProbability,
      iterationRound,
    });

    // 根据处理强度和迭代轮次选择温度（轮次越多温度越高，制造更多变化）
    const baseTemp: Record<string, number> = {
      light: 0.7,
      medium: 0.85,
      heavy: 1.0,
    };
    const temp = Math.min((baseTemp[level] || 0.85) + (iterationRound - 1) * 0.05, 1.0);

    const result = await chatWithConfig({
      baseUrl: apiConfig.baseUrl,
      model: apiConfig.model,
      apiKey: apiConfig.apiKey,
      messages: [{ role: 'user', content: prompt }],
      temperature: temp,
      maxTokens: 8192,
    });

    let finalContent = result.content;
    let stats = { connectorsReplaced: 0, sentencesModified: 0, imperfectionsInjected: 0, formatPreserved: 0 };

    // 第二层：统计后处理（迭代轮次增强后处理强度）
    if (enablePostProcess) {
      const baseIntensity: Record<string, { sentenceVariation: number; connectorReplace: number; injectImperfection: boolean }> = {
        light: { sentenceVariation: 0.3, connectorReplace: 0.5, injectImperfection: false },
        medium: { sentenceVariation: 0.5, connectorReplace: 0.7, injectImperfection: true },
        heavy: { sentenceVariation: 0.8, connectorReplace: 0.9, injectImperfection: true },
      };

      const postOptions = { ...(baseIntensity[level] || baseIntensity.medium) };
      // 迭代轮次增强后处理
      if (iterationRound > 1) {
        postOptions.sentenceVariation = Math.min(postOptions.sentenceVariation + 0.1 * (iterationRound - 1), 1.0);
        postOptions.connectorReplace = Math.min(postOptions.connectorReplace + 0.1 * (iterationRound - 1), 1.0);
        postOptions.injectImperfection = true;
      }

      const postResult = deaiPostProcess(finalContent, postOptions);
      finalContent = postResult.processed;
      stats = postResult.stats;
    }

    // 计算修改统计
    const modifications: string[] = [];
    if (iterationRound > 1) {
      modifications.push(`第${iterationRound}轮迭代优化`);
    }
    if (level === 'light') modifications.push('轻度剧本润色：连接词替换 + 句长打散');
    if (level === 'medium') modifications.push('中度剧本润色：口语化改写 + 语气词注入 + 不完美注入');
    if (level === 'heavy') modifications.push('重度剧本润色：风格重构 + 方言注入 + 节奏冲击');
    if (dialectStyle && dialectStyle !== 'none') modifications.push(`风格模板：${dialectStyle}`);
    if (enablePostProcess) modifications.push(`后处理：${stats.connectorsReplaced}处连接词替换，${stats.formatPreserved}处格式标记保留`);

    return NextResponse.json({
      success: true,
      deAIedContent: finalContent,
      stats,
      modifications,
      iterationRound,
      usage: result.usage,
    });
  } catch (error) {
    console.error('剧本润色失败:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '处理失败' },
      { status: 500 }
    );
  }
}
