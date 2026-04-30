// ============================================================
// 故事大纲生成 Prompt V2（深度行业知识注入版）
// ============================================================

import type { Genre } from '@/types';
import {
  SATISFACTION_CATEGORIES,
  getPaymentBlueprint,
  FORMULAS,
  COMPLIANCE_RULES,
  CORE_PITFALLS,
} from './knowledge-base';

interface OutlinePromptOptions {
  userInput: string;
  genre?: Genre;
  platform?: string;
  totalEpisodes?: number;
  strictAnalysis?: boolean;
}

export function generateOutlinePrompt({ userInput, genre, platform = 'ReelShort', totalEpisodes = 50, strictAnalysis = false }: OutlinePromptOptions): string {
  const paymentBP = getPaymentBlueprint(totalEpisodes);
  const paymentBPText = paymentBP.map(p => `  ${p.range}【${p.stage}】${p.desc} → 目标：${p.goal}`).join('\n');

  // 构建爽点类型速查表
  const catEntries = Object.values(SATISFACTION_CATEGORIES);
  const satisfactionRef = catEntries.map(cat => {
    const subs = cat.subtypes.map(s => `    - ${s.name}：${s.desc}（规则：${s.rule}）`).join('\n');
    return `  【${cat.name}】\n${subs}`;
  }).join('\n\n');

  const strictAnalysisRules = strictAnalysis ? `
## 导入剧本严格复盘模式

本次任务不是创作、续写、润色或优化，而是对用户导入/已有剧本做结构化复盘。

硬性规则：
1. 只能依据“用户创意”中的导入剧本原文和现有资料提取信息。
2. 禁止新增角色、事件、伏笔、感情线、爽点、付费点、结局或世界观。
3. 禁止为了满足爆款公式而改写、补写、合理化原剧本没有写明的内容。
4. 未在剧本中明确出现的信息，必须写“未在剧本中明确”，不要猜。
5. episodeOutlines 只分析导入剧本中实际存在的集数；每集概述必须对应原文剧情，不要扩展后续集。
6. title、logline、synopsis、characters、plotStructure、coreConflicts、paymentPoints、emotionalArc、buzzScenes 都必须来自剧本文本，不得额外加工剧情。
7. 可以归纳结构和标签，但不能改变原剧情含义。
` : '';

  return `你是一位操盘过30+部播放量破亿爆款短剧的顶级策划总监，精通红果、抖音等主流平台的算法规则与用户心理。

${strictAnalysisRules}

## 用户创意
"${userInput}"

${genre ? `## 指定类型\n${genre}` : '## 类型判断\n根据故事内核判断（复仇/甜宠/穿越/都市/古风/悬疑/职场/校园/玄幻/家庭），可组合。'}

## 目标平台：${platform} | 总集数：${totalEpisodes}集（每集60-120秒）

---

## 一、策划必须掌握的行业核心知识

### 1. 爽点类型库（八类，覆盖99%爆款内容）
${satisfactionRef}

### 2. 付费节奏蓝图（${totalEpisodes}集版）
${paymentBPText}

### 3. 爆款公式速查
- 女频重生：${FORMULAS.femaleReborn}
- 男频赘婿：${FORMULAS.maleSonInLaw}
- 甜宠：${FORMULAS.sweetLove}
- 年代：${FORMULAS.period}
- 商战：${FORMULAS.business}

### 4. 创作避坑指南（来自20条核心痛点）
${CORE_PITFALLS.slice(0, 8).map((p, i) => `${i + 1}. ${p}`).join('\n')}

### 5. 合规红线（踩中直接毙稿）
${COMPLIANCE_RULES.map((r, i) => `${i + 1}. ${r}`).join('\n')}

---

## 二、策划铁律

1. **前3秒铁律**：第1集第1个画面/台词必须制造情绪冲击（震撼/悬念/愤怒/好奇）
2. **爽点密度公式**：每10秒1小爽点 + 每30秒1大爽点，核心公式 = 极致压制 + 反差反转 + 即时兑现
3. **金手指法则**：主角必须有独一无二的核心优势（技能/身份/信息/系统），且优势有代价和限制
4. **反派强度法则**：反派必须足够强、足够可恨，主角碾压才有成就感；但反派不能无限强导致主角只能开挂
5. **钩子链法则**：每集结尾钩子 → 下集开头回收 → 新钩子抛出，环环相扣不能断链
6. **人设标签法则**：每个角色需要3个记忆标签 + 1个核心矛盾 + 1个成长弧线

---

## 三、输出格式

严格按以下JSON输出，所有字段必填：

\`\`\`json
{
  "title": "《剧名》（简短有冲击力，6字以内最佳）",
  "alternativeTitles": ["备选1", "备选2"],
  "genre": "主类型",
  "subGenre": "副类型",
  "targetAudience": "男频/女频/通用",
  "logline": "一句话推广语（20字以内，突出核心冲突+最大看点）",
  "synopsis": "300-400字故事梗概，包含主角身份、关键事件、核心谜团、情感走向",
  "formula": "故事路线公式（用→连接各阶段，如：女主被害→重生觉醒→隐忍布局→身份曝光→终极复仇）",
  "goldenFingerFormula": "本剧使用的爆款公式组合（从上述爆款公式中选择匹配的组合）",
  "characters": {
    "protagonist": {
      "name": "名字",
      "gender": "男/女",
      "age": "年龄",
      "trait": "3个性格标签（如：外冷内热/毒舌/极度护短）",
      "backstory": "50字内核心背景",
      "goldenFinger": "金手指名称+核心能力+使用限制/代价",
      "goal": "核心目标",
      "arc": "成长弧线（从A到B的转变）",
      "tags": ["标签1", "标签2", "标签3"]
    },
    "antagonist": {
      "name": "名字",
      "gender": "男/女",
      "trait": "3个性格标签",
      "motivation": "作恶动机（必须合理，不能为坏而坏）",
      "threatLevel": "高/中/低",
      "arc": "最终结局",
      "tags": ["标签1", "标签2"]
    },
    "supporter": {
      "name": "名字",
      "trait": "性格+作用",
      "tags": ["标签"]
    },
    "loveInterest": {
      "name": "名字",
      "trait": "性格+与主角关系发展",
      "tags": ["标签"]
    },
    "secondaryVillain": {
      "name": "名字",
      "trait": "性格+作用",
      "tags": ["标签"]
    },
    "mentor": {
      "name": "名字",
      "trait": "性格+作用",
      "tags": ["标签"]
    }
  },
  "worldSetting": "故事背景（时代、地点、社会环境、权力结构）",
  "coreConflicts": ["核心冲突1", "核心冲突2", "核心冲突3", "核心冲突4"],
  "plotStructure": {
    "setup": "起始（建立世界观、人物关系、核心矛盾）",
    "development": "发展（冲突升级、关系变化、伏笔展开）",
    "climax": "高潮（重大转折、真相揭露、终极对决）",
    "resolution": "结局（收尾、情感闭环、正义实现）"
  },
  "episodeOutline": [
    {"range": "1-3集", "title": "阶段标题", "summary": "核心事件+爽点类型+钩子设计", "satisfactionTypes": ["使用的爽点类型"]},
    {"range": "4-10集", "title": "...", "summary": "...", "satisfactionTypes": ["..."]},
    {"range": "11-20集", "title": "...", "summary": "...", "satisfactionTypes": ["..."]},
    {"range": "21-30集", "title": "...", "summary": "...", "satisfactionTypes": ["..."]},
    {"range": "31-40集", "title": "...", "summary": "...", "satisfactionTypes": ["..."]},
    {"range": "41-${totalEpisodes}集", "title": "...", "summary": "...", "satisfactionTypes": ["..."]}
  ],
  "episodeOutlines": [
    {"episodeNumber": 1, "title": "集标题", "synopsis": "1-2句本集核心事件+钩子"},
    {"episodeNumber": 2, "title": "...", "synopsis": "..."},
    "... (必须输出全部${totalEpisodes}集的简要梗概，每集1-2句即可)"
  ],
  "paymentPoints": [${totalEpisodes <= 30 ? '5, 10, 20' : totalEpisodes <= 60 ? '8, 12, 25, 40, 50' : '8, 12, 25, 40, 55, 70, ' + (totalEpisodes - 5)}],
  "paymentHooks": [
    {"episode": 8, "hook": "该集结尾的悬念描述"},
    {"episode": 12, "hook": "该集结尾的悬念描述"}
  ],
  "satisfactionPointTypes": ["本剧核心爽点类型1", "类型2", "类型3", "类型4"],
  "emotionalArc": "情绪曲线描述（压制→释放→再压制→大释放的节奏）",
  "buzzScenes": ["预计爆点名场面1（具体描述）", "爆点场面2", "爆点场面3"],
  "hookChain": "钩子链设计（主线悬念如何从第1集贯穿到最后一集）"
}
\`\`\`

## 关键要求
1. episodeOutline 中每阶段必须标注使用了哪些爽点类型
2. **episodeOutlines 必须输出全部${totalEpisodes}集的简要梗概，每集只需 title + synopsis（1-2句），这是最重要的输出**
3. paymentHooks 必须明确每个付费点的具体悬念内容
4. characters 的 goldenFinger 必须包含限制/代价，不能无限开挂
5. hookChain 必须说明主线悬念如何逐层揭露、环环相扣
6. 所有内容必须过合规审核，不踩红线
7. **输出务必精简，episodeOutlines 每集 synopsis 不超过30字**
${strictAnalysis ? '8. 严格复盘模式下，如果导入剧本实际集数少于目标集数，只输出实际存在的集数，绝对不要补齐不存在的集数。' : ''}`;
}

export function parseOutlineResponse(response: string): any {
  const codeBlockMatch = response.match(/\`\`\`(?:json)?\s*([\s\S]*?)\s*\`\`\`/);
  if (codeBlockMatch) {
    try { return JSON.parse(cleanJson(codeBlockMatch[1])); } catch {}
  }

  const braceMatch = response.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try { return JSON.parse(cleanJson(braceMatch[0])); } catch {}
  }

  try { return JSON.parse(cleanJson(response)); } catch {}

  throw new Error('无法解析大纲响应，请重试');
}

function cleanJson(str: string): string {
  let s = str.trim();
  s = s.replace(/^\s*(\/\/|#).*$/gm, '');
  s = s.replace(/,\s*([\]}])/g, '$1');
  return s;
}
