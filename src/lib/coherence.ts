// ============================================================
// 连贯性锚点系统 - 跨集追踪
// ============================================================

// -------------------- 类型定义 --------------------

/**
 * 人物状态锚点 - 追踪角色在剧中的关键状态变化
 */
export interface CharacterStateAnchor {
  characterName: string;
  stateType: 'location' | 'emotion' | 'belief' | 'possession' | 'relationship' | 'status';
  from?: string;       // 之前状态
  to: string;          // 当前状态
  episodeNumber: number;
  description: string; // 人类可读描述
}

/**
 * 关系变化锚点 - 追踪角色之间的关系变化
 */
export interface RelationshipAnchor {
  characterA: string;
  characterB: string;
  relationshipType: 'friend' | 'enemy' | 'family' | 'love' | 'business' | 'neutral';
  changeType: 'improve' | 'worsen' | 'new' | 'end' | 'reveal';
  from?: string;
  to: string;
  episodeNumber: number;
  description: string;
}

/**
 * 关键事实锚点 - 追踪剧情中的重要事实/秘密
 */
export interface FactAnchor {
  factType: 'secret' | 'identity' | 'evidence' | 'agreement' | 'plan' | 'event';
  fact: string;
  knownBy: string[];           // 已知此事实的角色
  revealedTo: string[];         // 被揭露给谁
  episodeNumber: number;
  isPublic: boolean;
  description: string;
}

/**
 * 伏笔锚点 - 追踪埋下的伏笔
 */
export interface ForeshadowAnchor {
  foreshadowType: 'dialogue' | '_object' | 'action' | 'hint' | 'question';
  foreshadow: string;
  payoffEpisode?: number;       // 预计回收集数
  episodeNumber: number;
  description: string;
}

/**
 * 情感曲线锚点 - 追踪集的情绪状态
 */
export interface EmotionalBeatAnchor {
  characterName: string;
  emotionType: 'joy' | 'anger' | 'sadness' | 'fear' | 'surprise' | 'anticipation' | 'neutral';
  intensity: 'low' | 'medium' | 'high' | 'peak';
  trigger: string;
  episodeNumber: number;
  description: string;
}

/**
 * 钩子锚点 - 追踪集末钩子
 */
export interface HookAnchor {
  hookType: 'cliffhanger' | 'revelation' | 'decision' | 'crisis' | 'question';
  description: string;
  episodeNumber: number;
  willResolve: boolean;
  resolutionEpisode?: number;
}

/**
 * 完整连贯性锚点集
 */
export interface CoherenceAnchors {
  characterStates: CharacterStateAnchor[];   // 人物状态
  relationships: RelationshipAnchor[];         // 关系变化
  facts: FactAnchor[];                        // 关键事实
  foreshadows: ForeshadowAnchor[];           // 伏笔
  emotionalBeats: EmotionalBeatAnchor[];    // 情感节拍
  hooks: HookAnchor[];                       // 钩子
  // 当前集提取的新锚点
  newCharacterStates: CharacterStateAnchor[];
  newRelationships: RelationshipAnchor[];
  newFacts: FactAnchor[];
  newForeshadows: ForeshadowAnchor[];
  newEmotionalBeats: EmotionalBeatAnchor[];
  newHooks: HookAnchor[];
}

// -------------------- 锚点提取器 --------------------

/**
 * 从剧集内容中提取连贯性锚点
 * 这个函数使用规则匹配来识别关键剧情元素
 */
export function extractAnchorsFromEpisode(
  episodeContent: string,
  episodeNumber: number,
  characters: string[]
): CoherenceAnchors {
  const anchors: CoherenceAnchors = {
    characterStates: [],
    relationships: [],
    facts: [],
    foreshadows: [],
    emotionalBeats: [],
    hooks: [],
    newCharacterStates: [],
    newRelationships: [],
    newFacts: [],
    newForeshadows: [],
    newEmotionalBeats: [],
    newHooks: [],
  };

  const lines = episodeContent.split('\n');

  // 1. 提取情绪标注
  const emotionPatterns: Record<string, string[]> = {
    joy: ['兴奋', '激动', '得意', '温柔', '郑重', '宠溺', '心疼', '感动', '释然', '骄傲', '狂喜', '开心', '高兴'],
    anger: ['愤怒', '咬牙', '冷笑', '厌恶', '暴怒', '生气', '恼火', '冷哼', '冷笑'],
    sadness: ['悲伤', '委屈', '绝望', '崩溃', '哭泣', '哽咽', '泪', '伤心', '难过', '心碎'],
    fear: ['恐惧', '害怕', '心虚', '颤抖', '哆嗦', '惊慌', '惊恐'],
    surprise: ['震惊', '惊讶', '愣住', '惊呆', '目瞪口呆', '错愕', '意外'],
    anticipation: ['期待', '兴奋', '好奇', '神秘', '若有所思', '盘算', '思索'],
  };

  // 2. 提取关系变化关键词
  const relationshipPatterns = {
    improve: ['原谅', '和解', '和好', '信任', '感激', '喜欢', '爱', '支持', '帮助', '并肩', '联手'],
    worsen: ['背叛', '欺骗', '仇恨', '敌视', '反目', '决裂', '翻脸', '威胁', '陷害', '抛弃'],
    new: ['认识', '相遇', '初见', '邂逅', '结交', '结盟'],
    reveal: ['原来', '竟然', '居然', '真相', '揭露', '曝光', '暴露', '发现'],
  };

  // 3. 提取关键事实类型
  const factPatterns = {
    secret: ['秘密', '隐情', '真相', '隐瞒', '隐瞒', '不可告人', '内幕'],
    identity: ['身份', '真实身份', '原来你是', '谁才是', '冒充', '伪装', '替身'],
    evidence: ['证据', '录音', '录像', '照片', '文件', '合同', '证明'],
    agreement: ['协议', '约定', '承诺', '誓言', '合同', '交易'],
    plan: ['计划', '阴谋', '策划', '布局', '算计', '图谋'],
    event: ['车祸', '火灾', '爆炸', '死亡', '失踪', '破产', '入狱'],
  };

  // 4. 提取伏笔类型
  const foreshadowPatterns = {
    dialogue: ['这不简单', '迟早会', '以后你会', '终有一天', '记住今天'],
    object: ['留下', '藏好', '保管', '交给', '钥匙', '信封', '照片'],
    action: ['假装', '故意', '暗暗', '悄悄', '暗中', '不动声色'],
    hint: ['为什么', '怎么回事', '难道', '难道说', '莫非'],
    question: ['为什么', '凭什么', '怎么办', '如何'],
  };

  // 5. 提取钩子类型
  const hookPatterns = {
    cliffhanger: ['欲知后事', '精彩继续', '下集', '敬请期待', '震惊'],
    revelation: ['揭露', '曝光', '真相大白', '揭晓', '公开'],
    decision: ['决定', '选择', '抉择', '赌一把', '豁出去'],
    crisis: ['危机', '危险', '紧急', '来不及', '怎么办'],
    question: ['为什么', '怎么回事', '谁才是', '到底是谁'],
  };

  for (const line of lines) {
    const trimmedLine = line.trim();

    // 提取情绪锚点
    for (const [emotionType, keywords] of Object.entries(emotionPatterns)) {
      for (const keyword of keywords) {
        if (trimmedLine.includes(keyword)) {
          // 尝试提取角色名
          const match = trimmedLine.match(/^([^\s（(【]+)/);
          const characterName = match ? match[1] : '未知角色';

          // 避免重复
          const existing = anchors.newEmotionalBeats.find(
            e => e.characterName === characterName && e.emotionType === emotionType
          );
          if (!existing) {
            anchors.newEmotionalBeats.push({
              characterName,
              emotionType: emotionType as any,
              intensity: keyword.length > 2 ? 'high' : 'medium',
              trigger: trimmedLine.substring(0, 50),
              episodeNumber,
              description: `第${episodeNumber}集：${characterName}表现出${keyword}`,
            });
          }
          break;
        }
      }
    }

    // 提取关系变化
    for (const [changeType, keywords] of Object.entries(relationshipPatterns)) {
      for (const keyword of keywords) {
        if (trimmedLine.includes(keyword)) {
          anchors.newRelationships.push({
            characterA: '角色A',
            characterB: '角色B',
            relationshipType: 'neutral',
            changeType: changeType as any,
            to: keyword,
            episodeNumber,
            description: trimmedLine.substring(0, 80),
          });
          break;
        }
      }
    }

    // 提取关键事实
    for (const [factType, keywords] of Object.entries(factPatterns)) {
      for (const keyword of keywords) {
        if (trimmedLine.includes(keyword)) {
          anchors.newFacts.push({
            factType: factType as any,
            fact: trimmedLine.substring(0, 100),
            knownBy: [],
            revealedTo: [],
            episodeNumber,
            isPublic: false,
            description: trimmedLine.substring(0, 80),
          });
          break;
        }
      }
    }

    // 提取伏笔
    for (const [foreshadowType, keywords] of Object.entries(foreshadowPatterns)) {
      for (const keyword of keywords) {
        if (trimmedLine.includes(keyword)) {
          anchors.newForeshadows.push({
            foreshadowType: foreshadowType as any,
            foreshadow: trimmedLine.substring(0, 80),
            episodeNumber,
            description: trimmedLine.substring(0, 60),
          });
          break;
        }
      }
    }

    // 提取钩子（通常是集末）
    for (const [hookType, keywords] of Object.entries(hookPatterns)) {
      for (const keyword of keywords) {
        if (trimmedLine.includes(keyword)) {
          anchors.newHooks.push({
            hookType: hookType as any,
            description: trimmedLine.substring(0, 80),
            episodeNumber,
            willResolve: true,
          });
          break;
        }
      }
    }
  }

  // 限制每种锚点数量，避免过多
  anchors.newEmotionalBeats = anchors.newEmotionalBeats.slice(0, 5);
  anchors.newRelationships = anchors.newRelationships.slice(0, 3);
  anchors.newFacts = anchors.newFacts.slice(0, 3);
  anchors.newForeshadows = anchors.newForeshadows.slice(0, 3);
  anchors.newHooks = anchors.newHooks.slice(0, 2);

  return anchors;
}

/**
 * 合并多集的锚点，返回统一的锚点集
 */
export function mergeAnchors(allEpisodeAnchors: CoherenceAnchors[]): CoherenceAnchors {
  const merged: CoherenceAnchors = {
    characterStates: [],
    relationships: [],
    facts: [],
    foreshadows: [],
    emotionalBeats: [],
    hooks: [],
    newCharacterStates: [],
    newRelationships: [],
    newFacts: [],
    newForeshadows: [],
    newEmotionalBeats: [],
    newHooks: [],
  };

  for (const anchors of allEpisodeAnchors) {
    merged.characterStates.push(...anchors.characterStates, ...anchors.newCharacterStates);
    merged.relationships.push(...anchors.relationships, ...anchors.newRelationships);
    merged.facts.push(...anchors.facts, ...anchors.newFacts);
    merged.foreshadows.push(...anchors.foreshadows, ...anchors.newForeshadows);
    merged.emotionalBeats.push(...anchors.emotionalBeats, ...anchors.newEmotionalBeats);
    merged.hooks.push(...anchors.hooks, ...anchors.newHooks);
  }

  // 去重（基于描述相似度）
  return deduplicateAnchors(merged);
}

/**
 * 去重锚点
 */
function deduplicateAnchors(anchors: CoherenceAnchors): CoherenceAnchors {
  const dedup = (arr: any[], key: string) => {
    const seen = new Set<string>();
    return arr.filter(item => {
      const k = item[key]?.substring(0, 30) || '';
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };

  return {
    ...anchors,
    characterStates: dedup(anchors.characterStates, 'description'),
    relationships: dedup(anchors.relationships, 'description'),
    facts: dedup(anchors.facts, 'description'),
    foreshadows: dedup(anchors.foreshadows, 'description'),
    emotionalBeats: dedup(anchors.emotionalBeats, 'description'),
    hooks: dedup(anchors.hooks, 'description'),
    newCharacterStates: [],
    newRelationships: [],
    newFacts: [],
    newForeshadows: [],
    newEmotionalBeats: [],
    newHooks: [],
  };
}

/**
 * 生成锚点摘要（用于提示词）
 */
export function formatAnchorsForPrompt(anchors: CoherenceAnchors): string {
  const lines: string[] = [];

  if (anchors.facts.length > 0) {
    lines.push('### 关键事实（必须保持一致）');
    for (const fact of anchors.facts.slice(-5)) {
      lines.push(`- ${fact.factType === 'secret' ? '【秘密】' : ''}${fact.fact}`);
    }
  }

  if (anchors.relationships.length > 0) {
    lines.push('### 关系状态（记住当前关系）');
    const recentRelationships = anchors.relationships.slice(-5);
    for (const rel of recentRelationships) {
      lines.push(`- ${rel.characterA}与${rel.characterB}：${rel.description}`);
    }
  }

  if (anchors.emotionalBeats.length > 0) {
    lines.push('### 情感走向（保持连贯）');
    const recentEmotions = anchors.emotionalBeats.slice(-5);
    for (const emotion of recentEmotions) {
      lines.push(`- ${emotion.characterName}：${emotion.description}`);
    }
  }

  if (anchors.foreshadows.length > 0) {
    lines.push('### 未回收伏笔（可选择推进）');
    for (const fs of anchors.foreshadows.slice(-3)) {
      lines.push(`- 第${fs.episodeNumber}集埋下：${fs.description}`);
    }
  }

  if (anchors.hooks.length > 0) {
    lines.push('### 未解决悬念');
    for (const hook of anchors.hooks.slice(-3)) {
      if (!hook.willResolve || hook.resolutionEpisode === undefined || hook.resolutionEpisode > hook.episodeNumber) {
        lines.push(`- 第${hook.episodeNumber}集悬念：${hook.description}`);
      }
    }
  }

  return lines.length > 0 ? lines.join('\n') : '';
}

/**
 * 生成简洁的锚点提示（用于前情摘要）
 */
export function formatAnchorsSummary(anchors: CoherenceAnchors): string {
  const parts: string[] = [];

  // 最近的关系变化
  const recentRel = anchors.relationships.slice(-2);
  if (recentRel.length > 0) {
    parts.push(recentRel.map(r => `${r.description}`).join('；'));
  }

  // 未解决的悬念
  const unresolvedHooks = anchors.hooks.filter(h => !h.willResolve || h.resolutionEpisode === undefined);
  if (unresolvedHooks.length > 0) {
    parts.push(`悬念：${unresolvedHooks[0].description}`);
  }

  // 关键事实
  const secrets = anchors.facts.filter(f => f.factType === 'secret' && !f.isPublic);
  if (secrets.length > 0) {
    parts.push(`秘密：${secrets[0].fact.substring(0, 30)}`);
  }

  return parts.length > 0 ? parts.join('；') : '';
}
