// ============================================================
// 剧本评估 Prompt
// ============================================================

interface EvaluationPromptOptions {
  genre: string;
  platform: string;
  totalEpisodes: number;
  scriptContent: string;
}

export function generateEvaluationPrompt(options: EvaluationPromptOptions): string {
  const { genre, platform, totalEpisodes, scriptContent } = options;

  return `你是一个专业的短剧剧本评估师，拥有丰富的短剧创作和运营经验。

## 剧本信息

- **类型**：${genre}
- **目标平台**：${platform}
- **总集数**：${totalEpisodes}

## 剧本内容

${scriptContent}

## 评估维度及评分标准（满分100分）

### 1. 钩子质量 (20分)
评估标准：
- 前3秒吸引力：开头是否有冲击力？
- 悬念设置：是否能持续吸引观众？
- 引导性：是否能让观众想看下一集？

评分参考：
- 18-20分：开头极具冲击力，悬念设计精妙
- 14-17分：开头有吸引力，悬念合理
- 10-13分：开头平淡，但有基本悬念
- 0-9分：开头乏味，悬念薄弱

### 2. 情绪密度 (20分)
评估标准：
- 情绪波动频率：每集是否有足够的情绪起伏？
- 爽点分布：爽点是否密集且有力？
- 情感共鸣：是否能引起观众情感共鸣？

评分参考：
- 18-20分：情绪波动频繁，爽点密集
- 14-17分：情绪节奏良好，爽点合理
- 10-13分：情绪平稳，爽点稀疏
- 0-9分：情绪单调，缺乏爽点

### 3. 反转设计 (20分)
评估标准：
- 反转的合理性：反转是否符合剧情逻辑？
- 反转的意外性：是否出乎意料但合理？
- 反转频率：反转数量是否适中？

评分参考：
- 18-20分：反转精妙，既意外又合理
- 14-17分：反转合理，节奏恰当
- 10-13分：反转平淡，略显刻意
- 0-9分：反转牵强或数量不当

### 4. 付费点设计 (20分)
评估标准：
- 钩子强度：付费点的吸引力有多强？
- 转化诱导性：是否能让观众付费？
- 悬念持续：悬念是否足够支撑付费？

评分参考：
- 18-20分：付费点设计精妙，转化率极高
- 14-17分：付费点合理，有吸引力
- 10-13分：付费点平淡，转化力一般
- 0-9分：付费点薄弱，难以转化

### 5. 对话自然度 (10分)
评估标准：
- 口语化程度：对话是否像真人说话？
- 角色区分：不同角色说话风格是否有差异？
- 真实感：整体是否有真实感？

评分参考：
- 9-10分：对话非常自然，角色区分鲜明
- 7-8分：对话自然，角色有一定区分
- 5-6分：对话基本自然，角色区分不明显
- 0-4分：对话书面化，角色无区分

### 6. 市场适配 (10分)
评估标准：
- 平台匹配：是否符合目标平台用户偏好？
- 当前趋势：是否符合当前市场趋势？
- 受众定位：受众群体是否清晰？

评分参考：
- 9-10分：完美匹配平台和趋势
- 7-8分：符合平台风格
- 5-6分：基本匹配
- 0-4分：不匹配或定位模糊

## 输出格式

请严格按照以下JSON格式输出评估结果：

\`\`\`json
{
  "overall_score": 总分（0-100）,
  "dimension_scores": {
    "hook": {
      "score": 分数（0-20）,
      "comment": "该维度的详细评价（1-2句话）"
    },
    "emotion_density": {
      "score": 分数（0-20）,
      "comment": "该维度的详细评价（1-2句话）"
    },
    "twist_design": {
      "score": 分数（0-20）,
      "comment": "该维度的详细评价（1-2句话）"
    },
    "payment_design": {
      "score": 分数（0-20）,
      "comment": "该维度的详细评价（1-2句话）"
    },
    "dialogue_naturalness": {
      "score": 分数（0-10）,
      "comment": "该维度的详细评价（1-2句话）"
    },
    "market_adaptation": {
      "score": 分数（0-10）,
      "comment": "该维度的详细评价（1-2句话）"
    }
  },
  "strengths": ["优点1", "优点2", "优点3"],
  "weaknesses": ["缺点1", "缺点2", "缺点3"],
  "improvement_suggestions": [
    {
      "episode": 集数（数字）,
      "issue": "该集存在的问题（1句话）",
      "suggestion": "具体的改进建议（1-2句话）"
    }
  ],
  "market_positioning": "市场定位建议（2-3句话）"
}
\`\`\`

## 注意事项

- 所有分数必须是数字，不能是文字
- comment必须是中文评价
- improvement_suggestions至少包含2条，最多5条
- 不要输出任何JSON格式以外的内容`;
}

export function parseEvaluationResponse(response: string): {
  overallScore: number;
  dimensionScores: any;
  strengths: string[];
  weaknesses: string[];
  improvementSuggestions: { episode: number; issue: string; suggestion: string }[];
  marketPositioning: string;
} {
  // 1. 尝试从代码块提取
  const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(cleanJson(codeBlockMatch[1]));
    } catch {}
  }

  // 2. 尝试提取最外层 { ... }
  const braceMatch = response.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      return JSON.parse(cleanJson(braceMatch[0]));
    } catch {}
  }

  // 3. 尝试直接解析
  try {
    return JSON.parse(cleanJson(response));
  } catch {}

  throw new Error('无法解析评估响应，请重试');
}

function cleanJson(str: string): string {
  let s = str.trim();
  s = s.replace(/^\s*(\/\/|#).*$/gm, '');
  s = s.replace(/,\s*([\]}])/g, '$1');
  return s;
}

export function formatEvaluationForDisplay(evaluation: any): {
  radarData: { dimension: string; score: number; maxScore: number }[];
  summary: string;
  suggestions: string[];
} {
  const dimensionMap: Record<string, { label: string; maxScore: number }> = {
    hook: { label: '钩子质量', maxScore: 20 },
    emotion_density: { label: '情绪密度', maxScore: 20 },
    twist_design: { label: '反转设计', maxScore: 20 },
    payment_design: { label: '付费点设计', maxScore: 20 },
    dialogue_naturalness: { label: '对话自然度', maxScore: 10 },
    market_adaptation: { label: '市场适配', maxScore: 10 },
  };

  const radarData = Object.entries(evaluation.dimensionScores || {}).map(([key, data]: [string, any]) => ({
    dimension: dimensionMap[key]?.label || key,
    score: data.score || 0,
    maxScore: dimensionMap[key]?.maxScore || 10,
  }));

  const summary = `综合评分：${evaluation.overall_score || 0}分\n` +
    radarData.map(d => `${d.dimension}：${d.score}/${d.maxScore}分`).join('\n');

  const suggestions = (evaluation.improvement_suggestions || []).map((s: any) =>
    `第${s.episode}集：${s.suggestion}`
  );

  return { radarData, summary, suggestions };
}