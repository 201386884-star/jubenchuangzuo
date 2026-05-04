// ============================================================
// 剧本连贯性验证 API
// 检查生成后的剧本是否存在前后矛盾、锚点不一致等问题
// ============================================================

import { NextRequest } from 'next/server';

interface VerificationResult {
  success: boolean;
  episodeNumber: number;
  issues: VerificationIssue[];
  overallCoherence: 'good' | 'warning' | 'problem';
  warnings: string[];
}

interface VerificationIssue {
  type: 'character_contradiction' | 'relationship_contradiction' | 'fact_forgotten' | 'timeline_error' | 'emotion_breaks';
  description: string;
  severity: 'info' | 'warning' | 'critical';
  fixSuggestion: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { episodes, outline, currentEpisode } = body;

    if (!episodes || !Array.isArray(episodes)) {
      return new Response(JSON.stringify({ success: false, error: '缺少剧集数据' }), { status: 400 });
    }

    const issues: VerificationIssue[] = [];
    const warnings: string[] = [];

    // 分析已有剧集的一致性
    const characterStates = new Map<string, string>(); // 角色 -> 最新状态
    const relationships = new Map<string, string>();    // 关系对 -> 状态
    const knownFacts = new Map<string, string>();        // 事实 -> 描述

    // 从已有锚点中提取一致性信息
    for (const ep of episodes) {
      if (ep.anchors) {
        // 收集角色状态
        if (ep.anchors.characterStates) {
          for (const state of ep.anchors.characterStates) {
            characterStates.set(state.name, state.state);
          }
        }
        // 收集关系
        if (ep.anchors.relationships) {
          for (const rel of ep.anchors.relationships) {
            const key = `${rel.characterA}-${rel.characterB}`;
            relationships.set(key, rel.relation);
          }
        }
        // 收集已知事实
        if (ep.anchors.keyFacts) {
          for (const fact of ep.anchors.keyFacts) {
            knownFacts.set(fact.fact.substring(0, 50), fact.description);
          }
        }
      }
    }

    // 检查本集内容是否与已知状态矛盾
    const currentEpisodeData = episodes.find((ep: any) => ep.episodeNumber === currentEpisode);
    if (currentEpisodeData?.content) {
      const content = currentEpisodeData.content;

      // 检查人物状态一致性
      characterStates.forEach((state, name) => {
        if (state === '入狱' && content.includes(`${name}正常上班`)) {
          issues.push({
            type: 'character_contradiction',
            description: `${name}在前文中已被关押，但本集内容显示其正常活动`,
            severity: 'critical',
            fixSuggestion: `将本集中${name}的场景改为探监、会见室或其他合理场所`,
          });
        }
        if (state === '死亡' && content.includes(`${name}走进房间`)) {
          issues.push({
            type: 'character_contradiction',
            description: `${name}已被宣布死亡，但本集内容显示其正常出现`,
            severity: 'critical',
            fixSuggestion: `如果${name}是假死，需要在前文补充说明；否则需要修正本集内容`,
          });
        }
      });

      // 检查关键事实是否被遗忘
      if (outline?.characters?.protagonist?.goldenFinger) {
        const goldenFinger = outline.characters.protagonist.goldenFinger;
        if (content.includes('普通家庭') || content.includes('一无所有')) {
          if (!goldenFinger.includes('隐藏身份')) {
            warnings.push('本集提到了主角的贫困状态，但未提及金手指能力的恢复或使用');
          }
        }
      }

      // 检查情感连贯性
      const emotionalMarkers = ['非常愤怒', '狂喜', '彻底崩溃', '冰冷'];
      for (const marker of emotionalMarkers) {
        if (content.includes(marker) && content.includes('微笑着说')) {
          issues.push({
            type: 'emotion_breaks',
            description: `情绪描述前后矛盾：刚说完"${marker}"，又描写"微笑着"`,
            severity: 'warning',
            fixSuggestion: '统一情绪描写，保持角色情感状态的一致性',
          });
        }
      }
    }

    // 生成连贯性评估
    let overallCoherence: 'good' | 'warning' | 'problem' = 'good';
    if (issues.some(i => i.severity === 'critical')) {
      overallCoherence = 'problem';
    } else if (issues.length > 0 || warnings.length > 2) {
      overallCoherence = 'warning';
    }

    const result: VerificationResult = {
      success: true,
      episodeNumber: currentEpisode,
      issues,
      overallCoherence,
      warnings,
    };

    return new Response(JSON.stringify(result));
  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: err instanceof Error ? err.message : '验证失败',
    }), { status: 500 });
  }
}